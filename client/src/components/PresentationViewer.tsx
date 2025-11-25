import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PresentationViewerProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName: string;
}

export function PresentationViewer({ isOpen, onClose, fileUrl, fileName }: PresentationViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [containerWidth, setContainerWidth] = useState(800);
  const containerRef = useRef<HTMLDivElement>(null);

  // Detect file type
  const fileExtension = fileName.toLowerCase().split('.').pop() || '';
  const isPDF = fileExtension === 'pdf';
  const isPPT = ['ppt', 'pptx'].includes(fileExtension);

  // Handle window resize to adjust page width
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth - 32);
      }
    };

    if (isFullscreen) {
      handleResize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [isFullscreen]);

  const handleDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setCurrentPage(1);
  };

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, numPages || prev));
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // PPT Viewer Component
  const PPTViewer = ({ fullscreen = false }) => {
    const fullFileUrl = `${window.location.origin}${fileUrl}`;
    const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fullFileUrl)}`;

    if (fullscreen) {
      return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex-1 overflow-auto">
            <iframe
              src={viewerUrl}
              className="w-full h-full border-0"
              title={fileName}
              allow="fullscreen"
            />
          </div>
          <div className="flex-shrink-0 border-t bg-background flex items-center justify-between gap-4 px-6 py-4">
            <span className="text-sm font-medium truncate">{fileName}</span>
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleFullscreen}
              data-testid="button-exit-fullscreen"
              className="ml-auto"
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      );
    }

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl w-full h-[80vh] p-0 gap-0 flex flex-col">
          <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between gap-4">
              <DialogTitle className="truncate text-lg">{fileName}</DialogTitle>
              <Button
                size="icon"
                variant="ghost"
                onClick={toggleFullscreen}
                data-testid="button-enter-fullscreen"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <iframe
              src={viewerUrl}
              className="w-full h-full border-0"
              title={fileName}
              allow="fullscreen"
            />
          </div>
          <div className="flex-shrink-0 border-t bg-background flex items-center justify-between gap-4 px-6 py-4">
            <span className="text-xs text-muted-foreground">Document Viewer</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  // PDF Viewer Component
  const PDFViewer = ({ fullscreen = false }) => {
    if (fullscreen) {
      return (
        <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden">
          {/* Main Content Area */}
          <div className="flex-1 overflow-auto bg-muted/50">
            <div className="flex justify-center py-8">
              <div className="bg-white dark:bg-black rounded-lg shadow-lg" style={{ width: containerWidth }}>
                <Document
                  file={fileUrl}
                  onLoadSuccess={handleDocumentLoadSuccess}
                  error={<div className="p-8 text-center text-red-500">Failed to load PDF</div>}
                >
                  <Page
                    pageNumber={currentPage}
                    width={containerWidth}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                  />
                </Document>
              </div>
            </div>
          </div>

          {/* Fixed Control Bar at Bottom */}
          <div className="flex-shrink-0 border-t bg-background flex items-center justify-between gap-4 px-6 py-4">
            <span className="text-sm font-medium">{fileName}</span>
            <div className="flex items-center gap-2 ml-auto">
              <Button
                size="icon"
                variant="outline"
                onClick={handlePrevPage}
                disabled={currentPage <= 1}
                data-testid="button-prev-page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <span className="text-sm font-medium px-4 py-2 bg-muted rounded-md min-w-[80px] text-center">
                {currentPage} / {numPages || '?'}
              </span>

              <Button
                size="icon"
                variant="outline"
                onClick={handleNextPage}
                disabled={currentPage >= (numPages || 1)}
                data-testid="button-next-page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>

              <Button
                size="icon"
                variant="ghost"
                onClick={toggleFullscreen}
                data-testid="button-exit-fullscreen"
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl w-full h-[85vh] p-0 gap-0 flex flex-col">
          <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between gap-4">
              <DialogTitle className="truncate text-lg">{fileName}</DialogTitle>
              <Button
                size="icon"
                variant="ghost"
                onClick={toggleFullscreen}
                data-testid="button-enter-fullscreen"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          {/* Main Content Area - Scrollable */}
          <div className="flex-1 overflow-auto bg-muted/50">
            <div className="flex justify-center py-8" ref={containerRef}>
              <div className="bg-white dark:bg-black rounded-lg shadow-lg" style={{ width: containerWidth }}>
                <Document
                  file={fileUrl}
                  onLoadSuccess={handleDocumentLoadSuccess}
                  error={<div className="p-8 text-center text-red-500">Failed to load PDF</div>}
                >
                  <Page
                    pageNumber={currentPage}
                    width={containerWidth}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                  />
                </Document>
              </div>
            </div>
          </div>

          {/* Fixed Control Bar at Bottom - Never Scrolls */}
          <div className="flex-shrink-0 border-t bg-background flex items-center justify-between gap-4 px-6 py-4">
            <span className="text-xs text-muted-foreground">Page {currentPage} of {numPages || '?'}</span>

            <div className="flex items-center gap-2 ml-auto">
              <Button
                size="icon"
                variant="outline"
                onClick={handlePrevPage}
                disabled={currentPage <= 1}
                data-testid="button-prev-page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <span className="text-sm font-medium px-4 py-2 bg-muted rounded-md min-w-[80px] text-center">
                {currentPage} / {numPages || '?'}
              </span>

              <Button
                size="icon"
                variant="outline"
                onClick={handleNextPage}
                disabled={currentPage >= (numPages || 1)}
                data-testid="button-next-page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  // Render appropriate viewer based on file type
  if (isPPT) {
    return <PPTViewer fullscreen={isFullscreen} />;
  }

  if (isPDF) {
    return <PDFViewer fullscreen={isFullscreen} />;
  }

  // Fallback for other file types - use Office Online viewer
  return <PPTViewer fullscreen={isFullscreen} />;
}
