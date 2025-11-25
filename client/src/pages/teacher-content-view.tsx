import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { 
  ArrowLeft, 
  Lock, 
  CheckCircle, 
  FileText, 
  Video, 
  Eye,
  Play,
  RotateCcw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2
} from "lucide-react";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// DocumentViewer component for displaying DOCX files converted to HTML
function DocumentViewer({ url }: { url: string }) {
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        const response = await fetch(url);
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
      className="w-full p-8 bg-white dark:bg-slate-900 text-black dark:text-white prose dark:prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}

type ContentStatus = "locked" | "available" | "viewed" | "completed";

interface ContentFile {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  title?: string;
  type?: "slide" | "video" | "file";
  url?: string;
  storageUrl?: string;
}

interface ContentProgress {
  deckFileId: string;
  status: ContentStatus;
  viewedAt?: string;
  completedAt?: string;
}

export default function TeacherContentView() {
  const { weekId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<ContentFile | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [quizDialogOpen, setQuizDialogOpen] = useState(false);
  const [currentQuiz, setCurrentQuiz] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [viewUrl, setViewUrl] = useState<string | null>(null);

  const { data: contentData, isLoading } = useQuery<{
    week: any;
    content: Array<ContentFile & { status: ContentStatus; progress?: ContentProgress }>;
  }>({
    queryKey: ["/api/teachers/weeks", weekId, "content"],
  });

  const markViewedMutation = useMutation({
    mutationFn: async (deckFileId: string) => {
      const res = await apiRequest("POST", `/api/teachers/weeks/${weekId}/content/${deckFileId}/viewed`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teachers/weeks", weekId, "content"] });
    },
  });

  const generateQuizMutation = useMutation({
    mutationFn: async (deckFileId: string) => {
      const res = await apiRequest("POST", `/api/teachers/weeks/${weekId}/content/${deckFileId}/generate-quiz`, { numQuestions: 5 });
      return res.json();
    },
    onSuccess: (data) => {
      setCurrentQuiz(data);
      setQuizDialogOpen(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Quiz Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const submitQuizMutation = useMutation({
    mutationFn: async ({ deckFileId, quizGenerationId, questions, answers }: { 
      deckFileId: string; 
      quizGenerationId: string;
      questions: any[]; 
      answers: Record<string, string> 
    }) => {
      const res = await apiRequest("POST", `/api/teachers/weeks/${weekId}/content/${deckFileId}/submit-quiz`, { quizGenerationId, questions, answers });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/teachers/weeks", weekId, "content"] });
      
      const passMessage = data.passed 
        ? "Great job! Next content unlocked." 
        : data.canRegenerate
          ? "All attempts used. You can request a new quiz."
          : `${data.remainingAttempts} attempt(s) remaining`;

      toast({
        title: data.passed ? "Quiz Passed!" : "Quiz Completed",
        description: `Score: ${data.score}/${data.totalQuestions} (${data.percentage}%) - ${passMessage}`,
        variant: data.passed ? "default" : "destructive",
      });

      setAnswers({});
      
      if (data.passed || data.remainingAttempts === 0) {
        setQuizDialogOpen(false);
        setCurrentQuiz(null);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const regenerateQuizMutation = useMutation({
    mutationFn: async ({ deckFileId, previousQuizGenerationId }: { 
      deckFileId: string; 
      previousQuizGenerationId: string;
    }) => {
      const res = await apiRequest("POST", `/api/teachers/weeks/${weekId}/content/${deckFileId}/regenerate-quiz`, { previousQuizGenerationId, numQuestions: 5 });
      return res.json();
    },
    onSuccess: (data) => {
      setCurrentQuiz(data);
      setAnswers({});
      toast({
        title: "New Quiz Generated",
        description: "You have 3 new attempts with this quiz.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Regeneration Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleViewContent = (file: ContentFile & { status: ContentStatus }) => {
    setSelectedFile(file);
    setViewDialogOpen(true);
    
    if (file.status === "available") {
      markViewedMutation.mutate(file.id);
    }
  };

  const handleStartQuiz = (file: ContentFile) => {
    setSelectedFile(file);
    generateQuizMutation.mutate(file.id);
  };

  const handleSubmitQuiz = () => {
    if (!selectedFile || !currentQuiz) return;
    
    const allAnswered = currentQuiz.questions.every((q: any) => answers[q.id]);
    if (!allAnswered) {
      toast({
        title: "Incomplete Quiz",
        description: "Please answer all questions before submitting.",
        variant: "destructive",
      });
      return;
    }

    submitQuizMutation.mutate({
      deckFileId: selectedFile.id,
      quizGenerationId: currentQuiz.quizGenerationId,
      questions: currentQuiz.questions,
      answers,
    });
  };

  const handleRegenerateQuiz = () => {
    if (!selectedFile || !currentQuiz) return;
    
    regenerateQuizMutation.mutate({
      deckFileId: selectedFile.id,
      previousQuizGenerationId: currentQuiz.quizGenerationId,
    });
  };

  // Fetch presigned URL when file is selected
  useEffect(() => {
    const fetchViewUrl = async () => {
      if (!selectedFile || !selectedFile.fileUrl) {
        setViewUrl(null);
        return;
      }

      try {
        const fileName = selectedFile.fileName.toLowerCase();
        const isPptx = fileName.endsWith('.pptx') || fileName.endsWith('.ppt');
        const isDocx = fileName.endsWith('.docx') || fileName.endsWith('.doc');
        
        if (isPptx) {
          const convertUrl = `/api/files/convert-to-pdf?url=${encodeURIComponent(selectedFile.fileUrl)}`;
          setViewUrl(convertUrl);
        } else if (isDocx) {
          const convertUrl = `/api/files/convert-to-html?url=${encodeURIComponent(selectedFile.fileUrl)}`;
          setViewUrl(convertUrl);
        } else {
          const proxyUrl = `/api/files/proxy?url=${encodeURIComponent(selectedFile.fileUrl)}`;
          setViewUrl(proxyUrl);
        }
      } catch (error) {
        console.error('Error fetching view URL:', error);
        setViewUrl(`/api/files/proxy?url=${encodeURIComponent(selectedFile.fileUrl)}`);
      }
    };

    fetchViewUrl();
    setPageNumber(1);
  }, [selectedFile]);

  const getFileIcon = (type: string) => {
    if (type === "video") return Video;
    if (type === "slide") return FileText;
    return FileText;
  };

  const getStatusBadge = (status: ContentStatus) => {
    switch (status) {
      case "locked":
        return <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" />Locked</Badge>;
      case "available":
        return <Badge variant="secondary">Available</Badge>;
      case "viewed":
        return <Badge variant="secondary" className="gap-1"><Eye className="h-3 w-3" />Viewed</Badge>;
      case "completed":
        return <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" />Completed</Badge>;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium">Loading content...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header with back button */}
      <div className="border-b">
        <div className="container mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/teacher/dashboard")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: Week Details & Content List */}
        <div className="w-full lg:w-80 border-r bg-card flex flex-col overflow-hidden">
          {/* Fixed Header */}
          <div className="p-6 border-b flex-shrink-0">
            <h2 className="text-2xl font-bold">
              {contentData?.week?.title || "Course Content"}
            </h2>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 pb-32 space-y-6">
              {/* Competency Focus */}
              {contentData?.week?.competencyFocus && (
                <div>
                  <h3 className="text-base font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Competency Focus
                  </h3>
                  <p className="text-sm text-foreground leading-relaxed">
                    {contentData.week.competencyFocus}
                  </p>
                </div>
              )}

              {/* Learning Objectives */}
              {contentData?.week?.objective && (
                <div>
                  <h3 className="text-base font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Learning Objectives
                  </h3>
                  <div className="text-sm text-foreground leading-loose space-y-2">
                    {contentData.week.objective.split(/(?=\d+\.)/).map((line: string, idx: number) => {
                      const trimmed = line.trim();
                      if (!trimmed) return null;
                      return (
                        <p key={idx} className="pl-2">
                          {trimmed}
                        </p>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Content Files */}
              <div>
                <h3 className="text-base font-semibold text-foreground mb-3">
                  Content Files
                </h3>
                <div className="space-y-2">
                  {contentData?.content && contentData.content.length > 0 ? (
                    contentData.content.map((file) => {
                      const status = file.status || "locked";
                      const isLocked = status === "locked";
                      const isCompleted = status === "completed";
                      const canTakeQuiz = status === "viewed" || status === "completed";
                      const Icon = getFileIcon(file.type);

                      return (
                        <div
                          key={file.id}
                          className="p-3 rounded-lg border border-border hover:bg-accent/50 cursor-pointer transition-colors"
                          onClick={() => !isLocked && handleViewContent(file)}
                          data-testid={`card-content-${file.id}`}
                        >
                          <div className="flex items-start gap-3 mb-2">
                            <Icon className="h-4 w-4 text-primary/60 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium leading-tight">{file.fileName}</p>
                              <p className="text-xs text-muted-foreground">{(file.fileSize / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                            <div className="flex-shrink-0">
                              {getStatusBadge(status)}
                            </div>
                          </div>
                          <div className="flex gap-1 flex-wrap ml-7">
                            {isLocked && (
                              <div className="text-xs text-muted-foreground">
                                <Lock className="h-3 w-3 inline mr-1" />
                                Locked
                              </div>
                            )}
                            {canTakeQuiz && !isCompleted && (
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartQuiz(file);
                                }}
                                variant="secondary"
                                size="sm"
                                data-testid={`button-quiz-${file.id}`}
                                className="h-7 text-xs"
                              >
                                <FileText className="mr-1 h-3 w-3" />
                                Quiz
                              </Button>
                            )}
                            {isCompleted && (
                              <div className="text-xs text-primary flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Done
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      No content available
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Content Preview */}
        <div className="flex-1 hidden lg:flex flex-col items-center justify-center bg-muted/30">
          {selectedFile ? (
            <div className="flex flex-col items-center gap-4 text-center p-8">
              <FileText className="h-12 w-12 text-muted-foreground/40" />
              <div>
                <h3 className="font-semibold">{selectedFile.fileName}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Click on the file to open this content
                </p>
              </div>
              <Button
                onClick={() => handleViewContent(selectedFile)}
                disabled={selectedFile.status === "locked"}
              >
                <Play className="mr-2 h-4 w-4" />
                View Content
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-center">
              <FileText className="h-16 w-16 text-muted-foreground/20" />
              <p className="text-muted-foreground">Select a file to view</p>
            </div>
          )}
        </div>
      </div>

      {/* View Content Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedFile?.fileName}</DialogTitle>
            <DialogDescription className="capitalize">
              {selectedFile?.type} Content
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden flex flex-col">
            {viewUrl && (
              <>
                {selectedFile?.fileName.toLowerCase().endsWith('.pdf') ? (
                  <div className="flex-1 overflow-auto bg-muted">
                    <Document
                      file={viewUrl}
                      onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                      loading={<div className="flex items-center justify-center p-8">Loading PDF...</div>}
                      error={<div className="flex items-center justify-center p-8 text-destructive">Failed to load PDF</div>}
                    >
                      <Page pageNumber={pageNumber} scale={scale} />
                    </Document>
                    <div className="flex gap-2 justify-center p-4 bg-card border-t flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
                        disabled={pageNumber <= 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm flex items-center px-2">
                        Page {pageNumber} of {numPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))}
                        disabled={pageNumber >= numPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setScale(Math.max(0.5, scale - 0.2))}
                      >
                        <ZoomOut className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setScale(Math.min(2, scale + 0.2))}
                      >
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                      <span className="text-sm flex items-center px-2">
                        {Math.round(scale * 100)}%
                      </span>
                    </div>
                  </div>
                ) : selectedFile?.fileName.toLowerCase().endsWith('.docx') || selectedFile?.fileName.toLowerCase().endsWith('.doc') ? (
                  <div className="flex-1 overflow-auto">
                    <DocumentViewer url={viewUrl} />
                  </div>
                ) : (
                  <div className="flex-1 overflow-auto bg-muted">
                    <Document
                      file={viewUrl}
                      onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                      loading={<div className="flex items-center justify-center p-8">Loading document...</div>}
                      error={<div className="flex items-center justify-center p-8 text-destructive">Failed to load document</div>}
                    >
                      <Page pageNumber={pageNumber} scale={scale} />
                    </Document>
                    <div className="flex gap-2 justify-center p-4 bg-card border-t flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
                        disabled={pageNumber <= 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm flex items-center px-2">
                        Page {pageNumber} of {numPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))}
                        disabled={pageNumber >= numPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setScale(Math.max(0.5, scale - 0.2))}
                      >
                        <ZoomOut className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setScale(Math.min(2, scale + 0.2))}
                      >
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                      <span className="text-sm flex items-center px-2">
                        {Math.round(scale * 100)}%
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
            {!viewUrl && (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-muted-foreground">Loading content...</p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button
              variant="outline"
              onClick={() => setViewDialogOpen(false)}
              data-testid="button-close-view"
            >
              Close
            </Button>
            {selectedFile && (
              <Button
                onClick={() => {
                  setViewDialogOpen(false);
                  handleStartQuiz(selectedFile);
                }}
                data-testid="button-start-quiz-from-view"
              >
                Start Quiz
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Quiz Dialog */}
      <Dialog open={quizDialogOpen} onOpenChange={setQuizDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quiz: {selectedFile?.title}</DialogTitle>
            <DialogDescription>
              {currentQuiz?.questions?.length || 0} questions - 70% required to pass
            </DialogDescription>
          </DialogHeader>
          
          {currentQuiz && (
            <div className="space-y-6">
              {currentQuiz.questions.map((question: any, index: number) => (
                <div key={question.id} className="space-y-3" data-testid={`question-${index}`}>
                  <h3 className="font-medium">
                    {index + 1}. {question.question}
                  </h3>
                  <RadioGroup
                    value={answers[question.id] || ""}
                    onValueChange={(value) =>
                      setAnswers({ ...answers, [question.id]: value })
                    }
                  >
                    {question.options.map((option: string, optIndex: number) => (
                      <div key={optIndex} className="flex items-center space-x-2">
                        <RadioGroupItem
                          value={option}
                          id={`${question.id}-${optIndex}`}
                          data-testid={`radio-${question.id}-${optIndex}`}
                        />
                        <Label htmlFor={`${question.id}-${optIndex}`}>{option}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              ))}
              
              <div className="flex gap-2 flex-wrap justify-end">
                {/* Show regenerate button if quiz has attempts used and all failed */}
                {currentQuiz.attemptsUsed >= 3 && !currentQuiz.hasPassed && (
                  <Button
                    onClick={handleRegenerateQuiz}
                    variant="outline"
                    disabled={regenerateQuizMutation.isPending}
                    data-testid="button-regenerate"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    {regenerateQuizMutation.isPending ? "Generating..." : "Request New Quiz"}
                  </Button>
                )}
                
                <Button
                  onClick={handleSubmitQuiz}
                  disabled={submitQuizMutation.isPending}
                  data-testid="button-submit-quiz"
                >
                  {submitQuizMutation.isPending ? "Submitting..." : "Submit Quiz"}
                </Button>
              </div>
              
              {currentQuiz.attemptsUsed > 0 && (
                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      You have used {currentQuiz.attemptsUsed} of 3 attempts for this quiz
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
