import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, ChevronDown, FileText, CheckCircle2, Circle, Maximize2, ZoomIn, ZoomOut, X, Award, List, PanelLeftClose, PanelLeftOpen, Menu } from "lucide-react";
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { QuizDialog } from "@/components/QuizDialog";
import { FileQuizDialog } from "@/components/FileQuizDialog";
import { useScreenshotProtection } from "@/hooks/use-screenshot-protection";
import { ScreenshotWarning } from "@/components/ScreenshotWarning";
import { TableOfContents } from "@/components/TableOfContents";
import type { TocEntry } from "@shared/schema";

// DocumentViewer component for displaying DOCX files converted to HTML
function DocumentViewer({ url }: { url: string }) {
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        const response = await fetch(url);
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Invalid response format: expected JSON');
        }
        
        const data = await response.json();
        if (data.html) {
          setHtml(data.html);
          setError(null);
        } else {
          throw new Error('No HTML content in response');
        }
      } catch (error) {
        console.error('Error loading document:', error);
        setError('Failed to load document. Please try again.');
        setHtml('');
      } finally {
        setLoading(false);
      }
    };
    fetchDocument();
  }, [url]);

  if (loading) {
    return <div className="flex items-center justify-center w-full p-12"><p className="text-muted-foreground">Loading document...</p></div>;
  }

  if (error) {
    return <div className="flex items-center justify-center w-full p-12"><p className="text-destructive">{error}</p></div>;
  }

  return (
    <div 
      ref={contentRef}
      className="w-full p-8 bg-white dark:bg-slate-900 text-black dark:text-white prose dark:prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface DeckFile {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  toc?: TocEntry[];
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
  const { user, isTrainer } = useAuth();
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0); // Reasonable default scale that fits within content area
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [hasMarkedComplete, setHasMarkedComplete] = useState<boolean>(false);
  const [quizDialogOpen, setQuizDialogOpen] = useState<boolean>(false);
  const [fileQuizDialogOpen, setFileQuizDialogOpen] = useState<boolean>(false);
  const [selectedQuizFileId, setSelectedQuizFileId] = useState<string | null>(null);
  const [pageInputValue, setPageInputValue] = useState<string>('');
  
  // Mobile sidebar drawer state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  
  // Track which file's ToC is expanded
  const [expandedTocFileId, setExpandedTocFileId] = useState<string | null>(null);
  
  // Track intended page when switching files via ToC navigation
  const [intendedPage, setIntendedPage] = useState<number | null>(null);
  
  // Track previous file ID to detect actual file changes
  const prevFileIdRef = useRef<string | null>(null);
  
  // Responsive breakpoint detection
  const { isMobile, isTablet } = useBreakpoint();

  // Screenshot protection
  const { showWarning, dismissWarning } = useScreenshotProtection(weekId);

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

  // Fetch quiz status
  const { data: quizStatus } = useQuery<{ passed: boolean }>({
    queryKey: ['/api/training-weeks', weekId, 'quiz-passed'],
    enabled: !!weekId,
  });

  // Fetch file quiz progress
  const { data: fileQuizProgress = [] } = useQuery<{ fileId: string; passed: boolean }[]>({
    queryKey: ['/api/training-weeks', weekId, 'file-quiz-progress'],
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
        const isDocx = selectedFile.fileName.toLowerCase().endsWith('.docx') || 
                       selectedFile.fileName.toLowerCase().endsWith('.doc');
        
        if (isPptx) {
          // For PowerPoint files, convert to PDF for HD viewing
          const convertUrl = `/api/files/convert-to-pdf?url=${encodeURIComponent(selectedFile.fileUrl)}`;
          setViewUrl(convertUrl);
        } else if (isDocx) {
          // For Word documents, convert to HTML using mammoth
          const convertUrl = `/api/files/convert-to-html?url=${encodeURIComponent(selectedFile.fileUrl)}`;
          setViewUrl(convertUrl);
        } else {
          // For all other files (videos, documents, etc.), use the proxy endpoint
          // This ensures files are served with inline disposition headers
          const proxyUrl = `/api/files/proxy?url=${encodeURIComponent(selectedFile.fileUrl)}`;
          setViewUrl(proxyUrl);
        }
      } catch (error) {
        console.error('Error fetching view URL:', error);
        // Fallback to proxy endpoint
        setViewUrl(`/api/files/proxy?url=${encodeURIComponent(selectedFile.fileUrl)}`);
      }
    };

    fetchViewUrl();
    
    // Only reset page number if the file actually changed
    const currentFileId = selectedFile?.id || null;
    if (currentFileId !== prevFileIdRef.current) {
      // File changed - use intended page if available, otherwise reset to 1
      if (intendedPage !== null) {
        setPageNumber(intendedPage);
        setIntendedPage(null);
      } else {
        setPageNumber(1);
      }
      prevFileIdRef.current = currentFileId;
    }
  }, [selectedFile, intendedPage]);

  // Handle file click - reset completion flag
  const handleFileClick = (file: DeckFile) => {
    setSelectedFileId(file.id);
    setHasMarkedComplete(file.progress?.status === 'completed');
  };

  // Track completion when user reaches the last page
  useEffect(() => {
    if (!selectedFile || hasMarkedComplete || selectedFile.progress?.status === 'completed') {
      return;
    }

    // Mark as complete when user reaches the last page
    if (numPages > 0 && pageNumber === numPages) {
      saveProgressMutation.mutate({
        deckFileId: selectedFile.id,
        status: 'completed',
        completedAt: new Date(),
      });
      setHasMarkedComplete(true);
    }
  }, [selectedFile, pageNumber, numPages, hasMarkedComplete, saveProgressMutation]);

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-primary" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground/40" />;
    }
  };

  // Handle direct page input
  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow numbers
    if (value === '' || /^\d+$/.test(value)) {
      setPageInputValue(value);
    }
  };

  const handlePageInputSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const targetPage = parseInt(pageInputValue);
    if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= numPages) {
      setPageNumber(targetPage);
      setPageInputValue(''); // Clear input after successful jump
    } else if (pageInputValue !== '') {
      // Invalid page - shake or show feedback
      setPageInputValue('');
    }
  };

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handlePageInputSubmit();
    } else if (e.key === 'Escape') {
      setPageInputValue('');
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
          <div className="h-full border-r bg-card flex flex-col shadow-lg">
            {/* Fixed Header: Back Button and Week Title */}
            <div className="p-6 border-b flex-shrink-0">
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
              <h2 className="text-3xl font-bold mb-2">
                Week {currentWeek?.weekNumber}
              </h2>
            </div>

            {/* Scrollable Content: Competency Focus, Objectives, Progress, and File List */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6 pb-32 space-y-6">
                {/* Competency Focus */}
                <div>
                  <h3 className="text-base font-semibold uppercase tracking-wider text-[#666] mb-3">
                    Competency Focus
                  </h3>
                  <p className="text-sm text-foreground leading-relaxed font-normal">
                    {currentWeek?.competencyFocus || 'Training Content'}
                  </p>
                </div>

                {/* Learning Objectives */}
                {currentWeek?.objective && (
                  <div>
                    <h3 className="text-base font-semibold uppercase tracking-wider text-[#666] mb-3">
                      Learning Objectives
                    </h3>
                    <div className="text-sm text-foreground leading-loose space-y-2">
                      {currentWeek.objective.split(/(?=\d+\.)/).map((line: string, idx: number) => {
                        const trimmed = line.trim();
                        if (!trimmed) return null;
                        return (
                          <p key={idx} className="pl-2 font-normal">
                            {trimmed}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Course Progress */}
                {weekProgress && weekProgress.total > 0 && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-muted-foreground">
                        Course Progress
                      </span>
                      <span className="text-sm font-bold text-primary">
                        {weekProgress.percentage}%
                      </span>
                    </div>
                    <Progress value={weekProgress.percentage} className="h-2" />
                    <p className="text-sm text-muted-foreground mt-1">
                      {weekProgress.completed} of {weekProgress.total} completed
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-2 italic">
                      Tip: Navigate to the last page of each file to mark it as complete
                    </p>
                  </div>
                )}

                {/* Lesson List */}
                <div>
                  <h3 className="text-base font-semibold text-foreground mb-3">
                    Lesson Files
                  </h3>
                  <div className="space-y-2">
                    {isLoading ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        Loading content...
                      </div>
                    ) : deckFiles.length === 0 ? (
                      <div className="text-center py-8">
                        <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                        <p className="text-sm font-medium text-muted-foreground mb-1">
                          No content available yet
                        </p>
                        <p className="text-xs text-muted-foreground/70">
                          An administrator needs to add files to this training week.
                        </p>
                      </div>
                    ) : (
                      deckFiles.map((file) => {
                        const hasPassedQuiz = fileQuizProgress.some(p => p.fileId === file.id && p.passed);
                        const hasToc = file.toc && file.toc.length > 0;
                        const isTocExpanded = expandedTocFileId === file.id;
                        
                        return (
                          <div key={file.id} className="space-y-2">
                            <div className="relative">
                              <button
                                onClick={() => handleFileClick(file)}
                                className={`w-full text-left p-3 rounded-lg transition-colors ${
                                  selectedFileId === file.id
                                    ? 'bg-primary/10 border-2 border-primary'
                                    : 'hover:bg-muted/50 border-2 border-transparent'
                                } ${hasToc ? 'pr-12' : ''}`}
                                data-testid={`button-file-${file.id}`}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="flex-shrink-0 mt-0.5">
                                    {getStatusIcon(file.progress?.status)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                                      <span className="font-semibold text-base truncate">{file.fileName}</span>
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      {(file.fileSize / 1024 / 1024).toFixed(2)} MB
                                    </div>
                                  </div>
                                </div>
                              </button>
                              
                              {/* ToC Toggle Button - Only show if file has ToC */}
                              {hasToc && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedTocFileId(isTocExpanded ? null : file.id);
                                  }}
                                  className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-muted/80 transition-colors"
                                  data-testid={`button-toggle-toc-${file.id}`}
                                  aria-label={isTocExpanded ? "Hide contents" : "View contents"}
                                >
                                  <ChevronDown 
                                    className={`h-5 w-5 text-muted-foreground transition-transform ${
                                      isTocExpanded ? 'rotate-180' : ''
                                    }`}
                                  />
                                </button>
                              )}
                            </div>
                            
                            {/* Expanded ToC - Show beneath the file when expanded */}
                            {hasToc && isTocExpanded && (
                              <div className="ml-3 pl-3 border-l-2 border-primary/20">
                                <div className="bg-muted/30 rounded-lg overflow-hidden">
                                  <TableOfContents
                                    toc={file.toc}
                                    currentPage={selectedFileId === file.id ? pageNumber : 1}
                                    onPageSelect={(page) => {
                                      // If selecting a ToC entry for a different file, set the intended page first
                                      if (selectedFileId !== file.id) {
                                        setIntendedPage(page);
                                        handleFileClick(file);
                                      } else {
                                        // Same file, just navigate to the page
                                        setPageNumber(page);
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                            )}
                            
                            {/* Only show quiz buttons to teachers, not trainers */}
                            {!isTrainer && (
                              <Button
                                size="sm"
                                variant={hasPassedQuiz ? "outline" : "secondary"}
                                className="w-full"
                                onClick={() => {
                                  console.log('[COURSE-VIEW] 🎯 Take Quiz button clicked for file:', file.id, file.fileName);
                                  setSelectedQuizFileId(file.id);
                                  setFileQuizDialogOpen(true);
                                  console.log('[COURSE-VIEW] 📝 State updated, dialog should open');
                                }}
                                data-testid={`button-file-quiz-${file.id}`}
                              >
                                {hasPassedQuiz ? (
                                  <>
                                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                                    Quiz Passed
                                  </>
                                ) : (
                                  <>
                                    <Award className="mr-2 h-4 w-4" />
                                    Take Quiz
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Checkpoint Quiz Button - Only for teachers */}
                {!isLoading && deckFiles.length > 0 && !isTrainer && (
                  <div className="pt-4">
                    <Button
                      onClick={() => setQuizDialogOpen(true)}
                      className="w-full"
                      variant={quizStatus?.passed ? "outline" : "default"}
                      data-testid="button-take-quiz"
                    >
                      {quizStatus?.passed ? (
                        <CheckCircle2 className="mr-2 h-5 w-5 text-green-600" />
                      ) : (
                        <Award className="mr-2 h-5 w-5" />
                      )}
                      {quizStatus?.passed ? "Quiz Passed" : "Take Checkpoint Quiz"}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      {quizStatus?.passed 
                        ? "You've completed this checkpoint quiz" 
                        : "Test your knowledge on this week's content"}
                    </p>
                  </div>
                )}
              </div>
            </div>
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
                    <div className="h-full flex flex-col items-center p-8 pb-32">
                      {/* Slides Viewer */}
                      <div className="w-full max-w-5xl flex flex-col items-center">
                        {viewUrl && (
                          <Document
                            file={viewUrl}
                            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                            onLoadError={(error) => console.error('PDF load error:', error)}
                            className="shadow-2xl rounded-xl overflow-hidden"
                          >
                            <Page
                              pageNumber={pageNumber}
                              scale={scale}
                              renderTextLayer={true}
                              renderAnnotationLayer={true}
                            />
                          </Document>
                        )}
                      </div>
                    </div>
                  ) : (selectedFile.fileName.toLowerCase().endsWith('.mp4') ||
                    selectedFile.fileName.toLowerCase().endsWith('.webm') ||
                    selectedFile.fileName.toLowerCase().endsWith('.mov')) ? (
                    <div className="h-full flex flex-col items-center justify-center p-8">
                      {/* Video Player */}
                      {viewUrl && (
                        <div className="w-full max-w-5xl">
                          <video
                            src={viewUrl}
                            controls
                            controlsList="nodownload"
                            className="w-full h-auto rounded-xl shadow-2xl bg-black"
                            data-testid="video-viewer"
                          >
                            Your browser does not support the video tag.
                          </video>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col bg-muted/20">
                      <div className="flex-1 overflow-auto flex items-start justify-center py-8 px-6">
                        {viewUrl ? (
                          <div className="w-full max-w-4xl flex flex-col gap-6">
                            {selectedFile.fileName.toLowerCase().endsWith('.txt') ? (
                              <textarea
                                readOnly
                                className="w-full flex-1 min-h-[600px] rounded-lg shadow-md border-0 p-6 bg-white dark:bg-slate-900 text-black dark:text-white font-mono resize-none"
                                data-testid="text-viewer"
                                style={{ lineHeight: '1.5' }}
                                onContextMenu={(e) => e.preventDefault()}
                              />
                            ) : (selectedFile.fileName.toLowerCase().endsWith('.docx') || 
                                 selectedFile.fileName.toLowerCase().endsWith('.doc')) ? (
                              <div className="rounded-lg shadow-md overflow-y-auto max-h-[600px] bg-white dark:bg-slate-900">
                                <DocumentViewer url={viewUrl} />
                              </div>
                            ) : (
                              <div className="rounded-lg shadow-md overflow-hidden">
                                <iframe
                                  src={viewUrl}
                                  className="w-full min-h-[600px] border-0 select-none pointer-events-auto"
                                  title={selectedFile.fileName}
                                  data-testid="file-viewer"
                                  style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                                  sandbox="allow-same-origin allow-scripts"
                                  onContextMenu={(e) => e.preventDefault()}
                                />
                              </div>
                            )}
                            <div className="flex gap-3 justify-center pb-4">
                              <Button
                                onClick={() => setIsFullscreen(true)}
                                variant="default"
                                size="lg"
                                data-testid="button-fullscreen"
                              >
                                <Maximize2 className="h-5 w-5 mr-2" />
                                Fullscreen View
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <p className="text-muted-foreground">Loading file...</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Persistent Control Bar - PDF/PPTX Files Only */}
                {(selectedFile.fileName.toLowerCase().endsWith('.pdf') || 
                  selectedFile.fileName.toLowerCase().endsWith('.pptx') || 
                  selectedFile.fileName.toLowerCase().endsWith('.ppt')) && viewUrl && (
                  <div className="flex-shrink-0 bg-card/95 backdrop-blur-sm border-t shadow-2xl">
                    <div className="max-w-7xl mx-auto px-4 py-4">
                      <div className="flex items-center gap-4 flex-wrap justify-center">
                        {/* Zoom Controls */}
                        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg">
                          <Button
                            onClick={() => setScale(s => Math.max(0.5, s - 0.2))}
                            variant="outline"
                            size="sm"
                            data-testid="button-zoom-out"
                          >
                            <ZoomOut className="h-4 w-4" />
                          </Button>
                          <span className="text-sm text-muted-foreground min-w-16 text-center font-medium">
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
                        
                        {/* Page Navigation Controls */}
                        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg">
                          <Button
                            onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                            disabled={pageNumber <= 1}
                            variant="outline"
                            size="sm"
                          >
                            Previous
                          </Button>
                          
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground whitespace-nowrap">
                              Page
                            </span>
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={pageInputValue}
                              onChange={handlePageInputChange}
                              onKeyDown={handlePageInputKeyDown}
                              onBlur={handlePageInputSubmit}
                              placeholder={pageNumber.toString()}
                              className="w-16 h-8 text-center text-sm"
                              data-testid="input-page-number"
                            />
                            <span className="text-sm text-muted-foreground whitespace-nowrap">
                              of {numPages}
                            </span>
                          </div>
                          
                          <Button
                            onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
                            disabled={pageNumber >= numPages}
                            variant="outline"
                            size="sm"
                          >
                            Next
                          </Button>
                        </div>
                        
                        {/* Completion Indicator */}
                        {pageNumber === numPages && numPages > 0 && (
                          <div className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 rounded-lg">
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                            <span className="text-sm font-semibold text-primary">Last page reached!</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
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
            <div className="flex-1 overflow-auto bg-muted/20 relative">
              {selectedFile && viewUrl && (
                (selectedFile.fileName.toLowerCase().endsWith('.pdf') || 
                 selectedFile.fileName.toLowerCase().endsWith('.pptx') || 
                 selectedFile.fileName.toLowerCase().endsWith('.ppt')) ? (
                  <div className="h-full flex flex-col items-center pb-24 p-6">
                    <div className="select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
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
                    </div>
                    
                    {/* Floating Persistent Controls in Fullscreen */}
                    <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t shadow-2xl z-50">
                      <div className="max-w-7xl mx-auto px-4 py-4">
                        <div className="flex items-center gap-4 flex-wrap justify-center">
                          {/* Page Navigation Controls */}
                          <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg">
                            <Button
                              onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                              disabled={pageNumber <= 1}
                              variant="outline"
                              size="sm"
                            >
                              Previous
                            </Button>
                            
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground whitespace-nowrap">
                                Page
                              </span>
                              <Input
                                type="text"
                                inputMode="numeric"
                                value={pageInputValue}
                                onChange={handlePageInputChange}
                                onKeyDown={handlePageInputKeyDown}
                                onBlur={handlePageInputSubmit}
                                placeholder={pageNumber.toString()}
                                className="w-16 h-8 text-center text-sm"
                                data-testid="input-page-number-fullscreen"
                              />
                              <span className="text-sm text-muted-foreground whitespace-nowrap">
                                of {numPages}
                              </span>
                            </div>
                            
                            <Button
                              onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
                              disabled={pageNumber >= numPages}
                              variant="outline"
                              size="sm"
                            >
                              Next
                            </Button>
                          </div>
                          
                          {/* Completion Indicator */}
                          {pageNumber === numPages && numPages > 0 && (
                            <div className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 rounded-lg">
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                              <span className="text-sm font-semibold text-primary">Last page reached!</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (selectedFile.fileName.toLowerCase().endsWith('.docx') || 
                     selectedFile.fileName.toLowerCase().endsWith('.doc')) ? (
                  <div className="h-full flex items-start justify-center p-6 overflow-auto">
                    <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-lg shadow-2xl overflow-y-auto max-h-[calc(100vh-180px)]">
                      <DocumentViewer url={viewUrl} />
                    </div>
                  </div>
                ) : (selectedFile.fileName.toLowerCase().endsWith('.mp4') ||
                 selectedFile.fileName.toLowerCase().endsWith('.webm') ||
                 selectedFile.fileName.toLowerCase().endsWith('.mov')) ? (
                  <div className="h-full flex flex-col items-center justify-center">
                    <video
                      src={viewUrl}
                      controls
                      controlsList="nodownload"
                      className="w-full h-full object-contain bg-black"
                      data-testid="video-viewer-fullscreen"
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>
                ) : (
                  <iframe
                    src={viewUrl}
                    className="w-full h-full border-0 select-none"
                    title={selectedFile.fileName}
                    style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                    sandbox="allow-same-origin allow-scripts"
                    onContextMenu={(e) => e.preventDefault()}
                  />
                )
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quiz Dialog */}
      <QuizDialog
        weekId={weekId || ''}
        open={quizDialogOpen}
        onOpenChange={setQuizDialogOpen}
      />

      {/* File Quiz Dialog */}
      {selectedQuizFileId && (
        <FileQuizDialog
          weekId={weekId || ''}
          fileId={selectedQuizFileId}
          fileName={deckFiles.find(f => f.id === selectedQuizFileId)?.fileName || ''}
          open={fileQuizDialogOpen}
          onOpenChange={setFileQuizDialogOpen}
        />
      )}

      {/* Screenshot Warning Overlay */}
      <ScreenshotWarning visible={showWarning} onDismiss={dismissWarning} />
    </div>
  );
}
