import { useState } from "react";
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
import { 
  ArrowLeft, 
  Lock, 
  CheckCircle, 
  FileText, 
  Video, 
  Eye,
  Play,
  RotateCcw,
  AlertCircle
} from "lucide-react";

type ContentStatus = "locked" | "available" | "viewed" | "completed";

interface ContentFile {
  id: string;
  title: string;
  type: "slide" | "video" | "file";
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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setLocation("/teacher/dashboard")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-week-title">
              {contentData?.week?.title || "Course Content"}
            </h1>
            <p className="text-muted-foreground">
              Complete quizzes to unlock next content
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {contentData?.content?.map((file) => {
            const status = file.status || "locked";
            const isLocked = status === "locked";
            const isCompleted = status === "completed";
            const canTakeQuiz = status === "viewed" || status === "completed";
            const Icon = getFileIcon(file.type);

            return (
              <Card key={file.id} data-testid={`card-content-${file.id}`}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1">
                      <Icon className="h-5 w-5 text-primary/60" />
                      <div>
                        <CardTitle className="text-lg">{file.title}</CardTitle>
                        <CardDescription className="capitalize">{file.type}</CardDescription>
                      </div>
                    </div>
                    {getStatusBadge(status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      onClick={() => handleViewContent(file)}
                      disabled={isLocked}
                      data-testid={`button-view-${file.id}`}
                      variant={isLocked ? "outline" : "default"}
                    >
                      {isLocked ? (
                        <>
                          <Lock className="mr-2 h-4 w-4" />
                          Locked
                        </>
                      ) : (
                        <>
                          <Play className="mr-2 h-4 w-4" />
                          View Content
                        </>
                      )}
                    </Button>
                    
                    {canTakeQuiz && !isCompleted && (
                      <Button
                        onClick={() => handleStartQuiz(file)}
                        variant="secondary"
                        data-testid={`button-quiz-${file.id}`}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Take Quiz
                      </Button>
                    )}
                    
                    {isCompleted && (
                      <Button
                        variant="outline"
                        disabled
                        data-testid={`button-completed-${file.id}`}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Completed
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* View Content Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{selectedFile?.title}</DialogTitle>
            <DialogDescription className="capitalize">
              {selectedFile?.type} Content
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedFile?.type === "video" ? (
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                <p className="text-muted-foreground">Video player placeholder</p>
                {selectedFile.url && (
                  <div className="text-sm text-muted-foreground mt-2">
                    URL: {selectedFile.url}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 bg-muted rounded-lg">
                <p className="text-muted-foreground">
                  Content for "{selectedFile?.title}" would be displayed here.
                </p>
                {selectedFile?.storageUrl && (
                  <div className="text-sm text-muted-foreground mt-2">
                    Storage URL: {selectedFile.storageUrl}
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2">
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
