import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { queryClient } from "@/lib/queryClient";
import { Award, BookOpen, CheckCircle, XCircle, LogOut } from "lucide-react";
import logoImage from "@assets/Screenshot 2025-10-14 214034_1761029433045.png";

export default function TeacherDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedQuiz, setSelectedQuiz] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [quizDialogOpen, setQuizDialogOpen] = useState(false);

  const { data: teacher } = useQuery<any>({
    queryKey: ["/api/teacher/me"],
  });

  const { data: quizzes = [] } = useQuery<any[]>({
    queryKey: ["/api/teacher/quizzes"],
  });

  const { data: reportCard } = useQuery<any>({
    queryKey: ["/api/teacher/report-card"],
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/teacher/logout", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Logout failed");
      }
    },
    onSuccess: () => {
      setLocation("/auth");
    },
  });

  const submitQuizMutation = useMutation({
    mutationFn: async ({ quizId, answers }: { quizId: string; answers: Record<string, string> }) => {
      const response = await fetch(`/api/assigned-quizzes/${quizId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit quiz");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/quizzes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/report-card"] });
      toast({
        title: data.passed ? "Quiz Passed!" : "Quiz Completed",
        description: `Score: ${data.score}/${data.totalQuestions} (${data.percentage}%)`,
        variant: data.passed ? "default" : "destructive",
      });
      setQuizDialogOpen(false);
      setSelectedQuiz(null);
      setAnswers({});
    },
    onError: (error: Error) => {
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const openQuiz = async (quiz: any) => {
    const response = await fetch(`/api/assigned-quizzes/${quiz.id}/attempt`);
    const attempt = await response.json();
    
    if (attempt) {
      toast({
        title: "Quiz Already Attempted",
        description: "You can only attempt each quiz once.",
        variant: "destructive",
      });
      return;
    }

    setSelectedQuiz(quiz);
    setAnswers({});
    setQuizDialogOpen(true);
  };

  const handleSubmitQuiz = () => {
    if (!selectedQuiz) return;
    
    const allAnswered = selectedQuiz.questions.every((q: any) => answers[q.id]);
    if (!allAnswered) {
      toast({
        title: "Incomplete Quiz",
        description: "Please answer all questions before submitting.",
        variant: "destructive",
      });
      return;
    }

    submitQuizMutation.mutate({ quizId: selectedQuiz.id, answers });
  };

  const getLevelBadgeVariant = (level: string) => {
    if (level === "Advanced") return "default";
    if (level === "Intermediate") return "secondary";
    return "outline";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header matching Admin dashboard */}
      <header className="sticky top-0 z-50 bg-primary shadow-md">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="h-12 w-12 sm:h-14 sm:w-14 flex items-center justify-center flex-shrink-0 bg-primary rounded-sm p-1">
              <img src={logoImage} alt="Silverleaf Academy Logo" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-white truncate" data-testid="text-app-title">
                Silverleaf Academy
              </h1>
              <p className="text-xs sm:text-sm text-white/80 hidden sm:block">
                Training Program Planner
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
            <div className="text-xs sm:text-sm text-white/90 hidden md:block truncate max-w-[200px]" data-testid="text-user-info">
              {teacher?.name} (Teacher ID: {teacher?.teacherId})
            </div>
            <div className="text-white">
              <ThemeToggle />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              data-testid="button-logout"
              className="hidden sm:flex bg-white/10 hover:bg-white/20 text-white border-white/20"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={() => logoutMutation.mutate()}
              data-testid="button-logout-mobile"
              className="sm:hidden h-8 w-8 bg-white/10 hover:bg-white/20 text-white border-white/20"
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold" data-testid="text-welcome">
            Welcome, {teacher?.name}
          </h2>
          <p className="text-muted-foreground">
            Your personalized learning dashboard
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Level</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-level">
                <Badge variant={getLevelBadgeVariant(reportCard?.level || "Beginner")}>
                  {reportCard?.level || "Beginner"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Quizzes Taken</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-quizzes-taken">
                {reportCard?.totalQuizzesTaken || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Score</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-average-score">
                {reportCard?.averageScore || 0}%
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Assigned Quizzes</CardTitle>
            <CardDescription>Complete quizzes to improve your level</CardDescription>
          </CardHeader>
          <CardContent>
            {quizzes.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No quizzes assigned yet
              </p>
            ) : (
              <div className="space-y-4">
                {quizzes.map((quiz: any) => (
                  <Card key={quiz.id} data-testid={`card-quiz-${quiz.id}`}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{quiz.title}</CardTitle>
                        <Badge variant="outline">{quiz.numQuestions} Questions</Badge>
                      </div>
                      {quiz.description && (
                        <CardDescription>{quiz.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <Button onClick={() => openQuiz(quiz)} data-testid={`button-take-quiz-${quiz.id}`}>
                        Take Quiz
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={quizDialogOpen} onOpenChange={setQuizDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedQuiz?.title}</DialogTitle>
            <DialogDescription>
              {selectedQuiz?.numQuestions} questions - 70% required to pass
            </DialogDescription>
          </DialogHeader>
          {selectedQuiz && (
            <div className="space-y-6">
              {selectedQuiz.questions.map((question: any, index: number) => (
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
              <Button
                onClick={handleSubmitQuiz}
                disabled={submitQuizMutation.isPending}
                className="w-full"
                data-testid="button-submit-quiz"
              >
                {submitQuizMutation.isPending ? "Submitting..." : "Submit Quiz"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
