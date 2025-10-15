import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChevronLeft, FileText, CheckCircle2, Circle, Maximize2, Download, ZoomIn, ZoomOut, X } from "lucide-react";
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface DeckFile {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  progress?: {
    status: 'pending' | 'completed';
    completedAt: Date | null;
  };
}

interface WeekProgress {
  total: number;
  completed: number;
  percentage: number;
}

export default function CourseView() {
  const { weekId } = useParams<{ weekId: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.8); // Higher default scale for HD clarity
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [viewingStartTime, setViewingStartTime] = useState<number | null>(null);
  const [hasMarkedComplete, setHasMarkedComplete] = useState<boolean>(false);

  // Fetch deck files with progress
  const { data: deckFiles = [], isLoading } = useQuery<DeckFile[]>({
    queryKey: ['/api/training-weeks', weekId, 'deck-files'],
    enabled: !!weekId,
  });

  // Fetch week progress
  const { data: weekProgress } = useQuery<WeekProgress>({
    queryKey: ['/api/training-weeks', weekId, 'deck-progress'],
    enabled: !!weekId,
  });

  // Fetch week details
  const { data: weeks = [] } = useQuery<any[]>({
    queryKey: ['/api/training-weeks'],
  });
  const currentWeek = weeks.find((w) => w.id === weekId);

  // Save progress mutation
  const saveProgressMutation = useMutation({
    mutationFn: async (data: {
      deckFileId: string;
      status: string;
      completedAt?: Date;
    }) => {
      return apiRequest('POST', '/api/deck-progress', {
        weekId,
        ...data
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/training-weeks', weekId, 'deck-files'] });
      queryClient.invalidateQueries({ queryKey: ['/api/training-weeks', weekId, 'deck-progress'] });
    },
  });

  // Get selected file
  const selectedFile = deckFiles.find(file => file.id === selectedFileId);

  // Auto-select first file
  useEffect(() => {
    if (deckFiles.length > 0 && !selectedFileId) {
      const firstFile = deckFiles[0];
      setSelectedFileId(firstFile.id);
      setViewingStartTime(Date.now());
      setHasMarkedComplete(firstFile.progress?.status === 'completed');
    }
  }, [deckFiles, selectedFileId]);

  // Fetch presigned URL when file is selected
  useEffect(() => {
    const fetchViewUrl = async () => {
      if (!selectedFile) {
        setViewUrl(null);
        return;
      }

      try {
        const isPptx = selectedFile.fileName.toLowerCase().endsWith('.pptx') || 
                       selectedFile.fileName.toLowerCase().endsWith('.ppt');
        
        if (isPptx) {
          // For PowerPoint files, convert to PDF for HD viewing
          const convertUrl = `/api/files/convert-to-pdf?url=${encodeURIComponent(selectedFile.fileUrl)}`;
          setViewUrl(convertUrl);
        } else {
          // For other files, use the proxy endpoint
          const response = await fetch(
            `/api/files/view-url?fileUrl=${encodeURIComponent(selectedFile.fileUrl)}`
          );
          const data = await response.json();
          setViewUrl(data.viewUrl);
        }
      } catch (error) {
        console.error('Error fetching view URL:', error);
        setViewUrl(selectedFile.fileUrl); // Fallback to direct URL
      }
    };

    fetchViewUrl();
    setPageNumber(1); // Reset page number when switching files
  }, [selectedFile]);

  // Handle file click - start viewing timer
  const handleFileClick = (file: DeckFile) => {
    setSelectedFileId(file.id);
    // Reset timer and completion flag for new file
    setViewingStartTime(Date.now());
    setHasMarkedComplete(file.progress?.status === 'completed');
  };

  // Timer effect - mark as completed after 60 seconds of viewing
  useEffect(() => {
    if (!selectedFile || !viewingStartTime || hasMarkedComplete || selectedFile.progress?.status === 'completed') {
      return;
    }

    const timer = setInterval(() => {
      const elapsed = Date.now() - viewingStartTime;
      const REQUIRED_VIEWING_TIME = 60 * 1000; // 60 seconds

      if (elapsed >= REQUIRED_VIEWING_TIME && !hasMarkedComplete) {
        saveProgressMutation.mutate({
          deckFileId: selectedFile.id,
          status: 'completed',
          completedAt: new Date(),
        });
        setHasMarkedComplete(true);
      }
    }, 1000); // Check every second

    return () => clearInterval(timer);
  }, [selectedFile, viewingStartTime, hasMarkedComplete, saveProgressMutation]);

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-primary" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground/40" />;
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Sidebar Panel */}
        <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
          <div className="h-full border-r bg-card flex flex-col">
            <div className="p-6 border-b">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="mb-4 -ml-2"
                data-testid="button-back-to-weeks"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back to Weeks
              </Button>
              <h2 className="text-xl font-bold mb-1">
                Week {currentWeek?.weekNumber}
              </h2>
              <p className="text-sm text-muted-foreground">
                {currentWeek?.competencyFocus || 'Training Content'}
              </p>

              {/* Objectives */}
              {currentWeek?.objective && (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-foreground mb-2">
                    Learning Objectives
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                    {currentWeek.objective}
                  </p>
                </div>
              )}

              {/* Progress Bar */}
              {weekProgress && weekProgress.total > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-muted-foreground">
                      Course Progress
                    </span>
                    <span className="text-xs font-bold text-primary">
                      {weekProgress.percentage}%
                    </span>
                  </div>
                  <Progress value={weekProgress.percentage} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {weekProgress.completed} of {weekProgress.total} completed
                  </p>
                </div>
              )}
            </div>

            {/* Content List */}
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-2">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Loading content...
                  </div>
                ) : deckFiles.length === 0 ? (
                  <div className="text-center py-8 px-4">
                    <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      No content available yet
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      An administrator needs to add files to this training week.
                    </p>
                  </div>
                ) : (
                  deckFiles.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => handleFileClick(file)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedFileId === file.id
                          ? 'bg-primary/10 border-2 border-primary'
                          : 'hover:bg-muted/50 border-2 border-transparent'
                      }`}
                      data-testid={`button-file-${file.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getStatusIcon(file.progress?.status)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                            <span className="font-semibold text-sm truncate">{file.fileName}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {(file.fileSize / 1024 / 1024).toFixed(2)} MB
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </ResizablePanel>

        {/* Resizable Handle */}
        <ResizableHandle withHandle />

        {/* Main Content Panel */}
        <ResizablePanel defaultSize={75} minSize={60}>
          <div className="h-full flex flex-col">
        {selectedFile ? (
          <div className="flex-1 flex flex-col">
            {/* Content Header */}
            <div className="p-6 border-b bg-card">
              <h1 className="text-2xl font-bold mb-1">{selectedFile.fileName}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Presentation File</span>
                {selectedFile.progress?.status && (
                  <>
                    <span>•</span>
                    <span className="capitalize">{selectedFile.progress.status}</span>
                  </>
                )}
              </div>
            </div>

            {/* Content Display */}
            <div className="flex-1 overflow-auto bg-muted/20">
              {(selectedFile.fileName.toLowerCase().endsWith('.pdf') || 
                selectedFile.fileName.toLowerCase().endsWith('.pptx') || 
                selectedFile.fileName.toLowerCase().endsWith('.ppt')) ? (
                <div className="h-full flex flex-col items-center justify-center p-6">
                  <div className="flex flex-col items-center gap-4">
                    {viewUrl && (
                      <>
                        <Document
                          file={viewUrl}
                          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                          className="shadow-2xl rounded-xl overflow-hidden"
                        >
                          <Page
                            pageNumber={pageNumber}
                            scale={scale}
                            renderTextLayer={true}
                            renderAnnotationLayer={true}
                          />
                        </Document>
                        <div className="flex items-center gap-4 flex-wrap justify-center">
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() => setScale(s => Math.max(0.5, s - 0.2))}
                              variant="outline"
                              size="sm"
                              data-testid="button-zoom-out"
                            >
                              <ZoomOut className="h-4 w-4" />
                            </Button>
                            <span className="text-sm text-muted-foreground min-w-16 text-center">
                              {Math.round(scale * 100)}%
                            </span>
                            <Button
                              onClick={() => setScale(s => Math.min(2.5, s + 0.2))}
                              variant="outline"
                              size="sm"
                              data-testid="button-zoom-in"
                            >
                              <ZoomIn className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                              disabled={pageNumber <= 1}
                              variant="outline"
                              size="sm"
                            >
                              Previous
                            </Button>
                            <span className="text-sm text-muted-foreground min-w-24 text-center">
                              Page {pageNumber} of {numPages}
                            </span>
                            <Button
                              onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
                              disabled={pageNumber >= numPages}
                              variant="outline"
                              size="sm"
                            >
                              Next
                            </Button>
                          </div>
                          <Button
                            onClick={() => window.open(viewUrl, '_blank')}
                            variant="default"
                            size="sm"
                            data-testid="button-download-file"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col">
                  <div className="flex-1 bg-muted/20 p-6">
                    {viewUrl ? (
                      <div className="h-full flex flex-col items-center">
                        <div className="w-full max-w-7xl h-full flex flex-col">
                          <iframe
                            src={viewUrl}
                            className="w-full flex-1 min-h-0 rounded-xl shadow-2xl border-0"
                            title={selectedFile.fileName}
                            data-testid="file-viewer"
                          />
                          <div className="mt-4 flex gap-3 justify-center">
                            <Button
                              onClick={() => setIsFullscreen(true)}
                              variant="default"
                              size="lg"
                              data-testid="button-fullscreen"
                            >
                              <Maximize2 className="h-5 w-5 mr-2" />
                              Fullscreen View
                            </Button>
                            <Button
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = viewUrl;
                                link.download = selectedFile.fileName;
                                link.click();
                              }}
                              variant="outline"
                              size="lg"
                              data-testid="button-download-file"
                            >
                              <Download className="h-5 w-5 mr-2" />
                              Download
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-muted-foreground">Loading presentation...</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : deckFiles.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center max-w-md">
              <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground/40" />
              <h3 className="text-xl font-semibold mb-2">No Content Available</h3>
              <p className="text-muted-foreground">
                This training week doesn't have any files yet. Please check back later or contact an administrator.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground">Select a file from the sidebar to begin</p>
          </div>
        )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Fullscreen Dialog */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-[100vw] w-full h-screen p-0 gap-0">
          <div className="flex flex-col h-full bg-background">
            {/* Fullscreen header */}
            <div className="flex items-center justify-between p-4 border-b bg-card">
              <h2 className="text-lg font-semibold">{selectedFile?.fileName}</h2>
              <Button
                onClick={() => setIsFullscreen(false)}
                variant="ghost"
                size="icon"
                data-testid="button-close-fullscreen"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Fullscreen content */}
            <div className="flex-1 p-6 overflow-auto bg-muted/20">
              {selectedFile && viewUrl && (
                (selectedFile.fileName.toLowerCase().endsWith('.pdf') || 
                 selectedFile.fileName.toLowerCase().endsWith('.pptx') || 
                 selectedFile.fileName.toLowerCase().endsWith('.ppt')) ? (
                  <div className="h-full flex flex-col items-center">
                    <Document
                      file={viewUrl}
                      onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                      className="shadow-2xl"
                    >
                      <Page
                        pageNumber={pageNumber}
                        scale={2.0}
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                      />
                    </Document>
                    <div className="mt-4 flex items-center gap-4">
                      <Button
                        onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                        disabled={pageNumber <= 1}
                        variant="outline"
                      >
                        Previous
                      </Button>
                      <span className="text-sm">
                        Page {pageNumber} of {numPages}
                      </span>
                      <Button
                        onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
                        disabled={pageNumber >= numPages}
                        variant="outline"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                ) : (
                  <iframe
                    src={viewUrl}
                    className="w-full h-full border-0"
                    title={selectedFile.fileName}
                  />
                )
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
