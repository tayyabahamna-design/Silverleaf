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
import { queryClient } from "@/lib/queryClient";
import { Award, BookOpen, CheckCircle, XCircle, LogOut } from "lucide-react";

export default function TeacherDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedQuiz, setSelectedQuiz] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [quizDialogOpen, setQuizDialogOpen] = useState(false);

  const { data: teacher } = useQuery({
    queryKey: ["/api/teacher/me"],
  });

  const { data: quizzes = [] } = useQuery({
    queryKey: ["/api/teacher/quizzes"],
  });

  const { data: reportCard } = useQuery({
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
      setLocation("/teacher/auth");
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
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-welcome">
              Welcome, {teacher?.name}
            </h1>
            <p className="text-muted-foreground">
              Teacher ID: {teacher?.teacherId}
            </p>
          </div>
          <Button variant="outline" onClick={() => logoutMutation.mutate()} data-testid="button-logout">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
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
