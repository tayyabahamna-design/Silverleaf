import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { queryClient } from "@/lib/queryClient";
import { Award, BookOpen, CheckCircle, XCircle, LogOut, AlertCircle, RotateCcw, GraduationCap, ArrowRight } from "lucide-react";
import logoImage from "@assets/Screenshot 2025-10-14 214034_1761029433045.png";

export default function TeacherDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedQuiz, setSelectedQuiz] = useState<any>(null);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [quizDialogOpen, setQuizDialogOpen] = useState(false);
  const [selectedAttempt, setSelectedAttempt] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>("quiz");

  const { data: teacher } = useQuery<any>({
    queryKey: ["/api/teacher/me"],
  });

  const { data: quizzes = [] } = useQuery<any[]>({
    queryKey: ["/api/teacher/quizzes"],
  });

  const { data: reportCard } = useQuery<any>({
    queryKey: ["/api/teacher/report-card"],
  });

  const { data: quizAttempts = [] } = useQuery<any[]>({
    queryKey: ["/api/teacher/quiz-attempts"],
  });

  const { data: assignedWeeks = [] } = useQuery<any[]>({
    queryKey: ["/api/teacher/assigned-weeks"],
  });

  const { data: quizAttemptsData, refetch: refetchQuizAttempts } = useQuery<any>({
    queryKey: [`/api/assigned-quizzes/${selectedQuizId}/attempts`],
    enabled: !!selectedQuizId,
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
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/quiz-attempts"] });
      queryClient.invalidateQueries({ queryKey: [`/api/assigned-quizzes/${selectedQuizId}/attempts`] });
      
      refetchQuizAttempts();
      
      const passMessage = data.passed 
        ? `You passed on attempt ${data.attemptNumber}!` 
        : data.attemptNumber >= 3 
          ? `All attempts used. View your results below.`
          : `${data.remainingAttempts} attempt(s) remaining`;

      toast({
        title: data.passed ? "Quiz Passed!" : "Quiz Completed",
        description: `Score: ${data.score}/${data.totalQuestions} (${data.percentage}%) - ${passMessage}`,
        variant: data.passed ? "default" : "destructive",
      });

      setAnswers({});
      setActiveTab("history");
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
    setSelectedQuizId(quiz.id);
    setSelectedQuiz(quiz);
    setAnswers({});
    
    const response = await fetch(`/api/assigned-quizzes/${quiz.id}/attempts`);
    const attemptsData = await response.json();
    
    if (attemptsData.hasPassed || !attemptsData.canRetake) {
      setActiveTab("history");
    } else {
      setActiveTab("quiz");
    }
    
    setQuizDialogOpen(true);
  };

  const handleRetake = () => {
    setAnswers({});
    setActiveTab("quiz");
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-border/50 rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Level</CardTitle>
              <Award className="h-5 w-5 text-primary/60" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-level">
                <Badge variant={getLevelBadgeVariant(reportCard?.level || "Beginner")}>
                  {reportCard?.level || "Beginner"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-border/50 rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Quizzes Taken</CardTitle>
              <BookOpen className="h-5 w-5 text-primary/60" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-quizzes-taken">
                {reportCard?.totalQuizzesTaken || 0}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-border/50 rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Score</CardTitle>
              <CheckCircle className="h-5 w-5 text-primary/60" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-average-score">
                {reportCard?.averageScore || 0}%
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-border/50 rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Training Content
            </CardTitle>
            <CardDescription>View course materials and complete quizzes to progress</CardDescription>
          </CardHeader>
          <CardContent>
            {assignedWeeks.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No training weeks assigned yet
              </p>
            ) : (
              <div className="space-y-4">
                {assignedWeeks.map((week: any) => (
                  <Card key={week.id} data-testid={`card-week-${week.id}`} className="shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 border-border/50 rounded-lg">
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <CardTitle className="text-lg">{week.title}</CardTitle>
                          <CardDescription>{week.batchName}</CardDescription>
                        </div>
                        {week.progress && (
                          <Badge variant={week.progress.percentage === 100 ? "default" : "secondary"}>
                            {week.progress.completed}/{week.progress.total} Completed
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {week.progress && week.progress.total > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium">{week.progress.percentage}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div 
                              className="bg-primary rounded-full h-2 transition-all duration-300"
                              style={{ width: `${week.progress.percentage}%` }}
                            />
                          </div>
                        </div>
                      )}
                      <Button 
                        onClick={() => setLocation(`/teacher/week/${week.id}/content`)} 
                        data-testid={`button-view-content-${week.id}`}
                        className="w-full"
                      >
                        View Content
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-border/50 rounded-xl">
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
                  <Card key={quiz.id} data-testid={`card-quiz-${quiz.id}`} className="shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 border-border/50 rounded-lg">
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <CardTitle className="text-lg">{quiz.title}</CardTitle>
                        <Badge variant="outline" className="flex-shrink-0">{quiz.numQuestions} Questions</Badge>
                      </div>
                      {quiz.description && (
                        <CardDescription>{quiz.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <Button onClick={() => openQuiz(quiz)} data-testid={`button-take-quiz-${quiz.id}`} className="min-h-11">
                        Take Quiz
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-border/50 rounded-xl">
          <CardHeader>
            <CardTitle>Quiz History</CardTitle>
            <CardDescription>View your past quiz attempts and results</CardDescription>
          </CardHeader>
          <CardContent>
            {quizAttempts.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No quiz attempts yet
              </p>
            ) : (
              <div className="space-y-4">
                {[...quizAttempts].sort((a: any, b: any) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()).map((attempt: any) => {
                  const percentage = Math.round((attempt.score / attempt.totalQuestions) * 100);
                  const isPassed = attempt.passed === 'yes';
                  
                  return (
                    <Card key={attempt.id} data-testid={`card-attempt-${attempt.id}`} className="shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 border-border/50 rounded-lg">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-base">{attempt.quiz?.title}</CardTitle>
                            <CardDescription>
                              {new Date(attempt.completedAt).toLocaleString()}
                            </CardDescription>
                          </div>
                          <Badge variant={isPassed ? "default" : "destructive"}>
                            {percentage}% - {isPassed ? "Passed" : "Failed"}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Score</p>
                            <p className="text-lg font-bold">{attempt.score}/{attempt.totalQuestions}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Status</p>
                            <p className="text-lg font-bold">{isPassed ? "✓ Passed" : "✗ Failed"}</p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => setSelectedAttempt(attempt)}
                          data-testid={`button-view-attempt-${attempt.id}`}
                        >
                          <BookOpen className="mr-2 h-4 w-4" />
                          Review My Answers
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={quizDialogOpen} onOpenChange={setQuizDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedQuiz?.title}</DialogTitle>
            <DialogDescription>
              {selectedQuiz?.numQuestions} questions - 80% required to pass
            </DialogDescription>
          </DialogHeader>
          
          {selectedQuiz && quizAttemptsData && (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger 
                  value="quiz" 
                  disabled={quizAttemptsData.hasPassed || !quizAttemptsData.canRetake}
                  data-testid="tab-quiz"
                >
                  Take Quiz
                </TabsTrigger>
                <TabsTrigger value="history" data-testid="tab-history">
                  Attempts ({quizAttemptsData.attemptsUsed})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="quiz" className="space-y-6">
                {quizAttemptsData.hasPassed ? (
                  <div className="flex flex-col items-center justify-center py-8 space-y-4">
                    <CheckCircle className="h-16 w-16 text-green-600" />
                    <h3 className="text-xl font-semibold text-green-700">Quiz Already Passed!</h3>
                    <p className="text-muted-foreground text-center">
                      You have already passed this quiz. No further attempts are allowed.
                    </p>
                  </div>
                ) : !quizAttemptsData.canRetake ? (
                  <div className="flex flex-col items-center justify-center py-8 space-y-4">
                    <AlertCircle className="h-16 w-16 text-orange-600" />
                    <h3 className="text-xl font-semibold text-orange-700">Maximum Attempts Reached</h3>
                    <p className="text-muted-foreground text-center">
                      You have used all 3 attempts for this quiz. View your attempt history below.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Attempt Status:</span>
                        <Badge variant="outline">
                          Attempt {quizAttemptsData.attemptsUsed + 1} of 3
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Remaining Attempts:</span>
                        <span className="text-sm font-semibold">{quizAttemptsData.remainingAttempts}</span>
                      </div>
                    </div>

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
                  </>
                )}
              </TabsContent>

              <TabsContent value="history" className="space-y-6">
                {quizAttemptsData.attempts.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No attempts yet. Take the quiz to get started!
                  </p>
                ) : (
                  <>
                    <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Status:</span>
                        <Badge variant={quizAttemptsData.hasPassed ? "default" : "destructive"}>
                          {quizAttemptsData.hasPassed ? "Passed" : "Not Passed"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Attempts Used:</span>
                        <span className="text-sm font-semibold">{quizAttemptsData.attemptsUsed} of 3</span>
                      </div>
                      {quizAttemptsData.canRetake && (
                        <Button 
                          onClick={handleRetake} 
                          variant="outline" 
                          className="w-full mt-2"
                          data-testid="button-retake"
                        >
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Retake Quiz ({quizAttemptsData.remainingAttempts} attempt{quizAttemptsData.remainingAttempts !== 1 ? 's' : ''} remaining)
                        </Button>
                      )}
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Your Attempts</h3>
                      {quizAttemptsData.attempts.map((attempt: any) => {
                        const percentage = Math.round((attempt.score / attempt.totalQuestions) * 100);
                        const isPassed = percentage >= 80;
                        
                        return (
                          <Card key={attempt.id} className={`border-l-4 ${isPassed ? 'border-l-green-500' : 'border-l-red-500'}`}>
                            <CardHeader>
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-base">
                                  Attempt {attempt.attemptNumber}
                                </CardTitle>
                                <Badge variant={isPassed ? "default" : "destructive"}>
                                  {percentage}% - {isPassed ? "Passed" : "Failed"}
                                </Badge>
                              </div>
                              <CardDescription>
                                {new Date(attempt.completedAt).toLocaleString()}
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Score:</span>
                                <span className="font-semibold">{attempt.score}/{attempt.totalQuestions}</span>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>

                    {quizAttemptsData.shouldShowAnswers && (
                      <div className="space-y-4 pt-4 border-t">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <h3 className="text-lg font-semibold">Answer Key</h3>
                        </div>
                        
                        {selectedQuiz.questions.map((question: any, index: number) => {
                          const latestAttempt = quizAttemptsData.attempts[quizAttemptsData.attempts.length - 1];
                          const userAnswer = latestAttempt?.answers[question.id];
                          const isCorrect = userAnswer === question.correctAnswer;
                          
                          return (
                            <Card key={question.id} className={`border-l-4 ${isCorrect ? 'border-l-green-500' : 'border-l-red-500'}`}>
                              <CardHeader>
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1">
                                    <CardTitle className="text-base">
                                      Question {index + 1}
                                    </CardTitle>
                                    <CardDescription className="text-base font-medium text-foreground mt-2">
                                      {question.question}
                                    </CardDescription>
                                  </div>
                                  <Badge variant={isCorrect ? "default" : "destructive"}>
                                    {isCorrect ? "✓ Correct" : "✗ Wrong"}
                                  </Badge>
                                </div>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                <div className="space-y-2">
                                  <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                                    Correct Answer: {question.correctAnswer}
                                  </p>
                                  {!isCorrect && userAnswer && (
                                    <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                                      Your Answer: {userAnswer}
                                    </p>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* View Attempt Details Dialog */}
      {selectedAttempt && (
        <Dialog open={!!selectedAttempt} onOpenChange={() => setSelectedAttempt(null)}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Quiz Review - {selectedAttempt.quiz?.title}</DialogTitle>
              <DialogDescription>
                Your score: {selectedAttempt.score}/{selectedAttempt.totalQuestions} ({Math.round((selectedAttempt.score / selectedAttempt.totalQuestions) * 100)}%) - {selectedAttempt.passed === 'yes' ? 'Passed' : 'Failed'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {selectedAttempt.quiz?.questions?.map((question: any, index: number) => {
                const myAnswer = selectedAttempt.answers[question.id];
                const isCorrect = myAnswer === question.correctAnswer;
                
                return (
                  <Card key={question.id} className={`border-l-4 ${isCorrect ? 'border-l-green-500' : 'border-l-red-500'}`}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-base">
                            Question {index + 1}
                          </CardTitle>
                          <CardDescription className="text-base font-medium text-foreground mt-2">
                            {question.question}
                          </CardDescription>
                        </div>
                        <Badge variant={isCorrect ? "default" : "destructive"}>
                          {isCorrect ? "✓ Correct" : "✗ Wrong"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {question.type === "multiple_choice" && (
                        <div className="space-y-2">
                          {question.options?.map((option: string, optIndex: number) => {
                            const isMyChoice = option === myAnswer;
                            const isCorrectAnswer = option === question.correctAnswer;
                            
                            return (
                              <div
                                key={optIndex}
                                className={`flex items-center gap-3 p-3 rounded-md border ${
                                  isCorrectAnswer
                                    ? 'bg-green-50 dark:bg-green-950 border-green-500 dark:border-green-700'
                                    : isMyChoice
                                    ? 'bg-red-50 dark:bg-red-950 border-red-500 dark:border-red-700'
                                    : 'bg-muted/50'
                                }`}
                                data-testid={`attempt-option-${index}-${optIndex}`}
                              >
                                {isCorrectAnswer && (
                                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                                )}
                                {isMyChoice && !isCorrectAnswer && (
                                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                                )}
                                <span className={isCorrectAnswer ? 'font-semibold text-green-900 dark:text-green-100' : isMyChoice ? 'font-semibold text-red-900 dark:text-red-100' : ''}>
                                  {String.fromCharCode(65 + optIndex)}. {option}
                                  {isMyChoice && <span className="ml-2 text-sm">(Your Answer)</span>}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {question.type === "true_false" && (
                        <div className="space-y-2">
                          {['True', 'False'].map((option: string, optIndex: number) => {
                            const isMyChoice = option === myAnswer;
                            const isCorrectAnswer = option === question.correctAnswer;
                            
                            return (
                              <div
                                key={optIndex}
                                className={`flex items-center gap-3 p-3 rounded-md border ${
                                  isCorrectAnswer
                                    ? 'bg-green-50 dark:bg-green-950 border-green-500 dark:border-green-700'
                                    : isMyChoice
                                    ? 'bg-red-50 dark:bg-red-950 border-red-500 dark:border-red-700'
                                    : 'bg-muted/50'
                                }`}
                                data-testid={`attempt-option-${index}-${optIndex}`}
                              >
                                {isCorrectAnswer && (
                                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                                )}
                                {isMyChoice && !isCorrectAnswer && (
                                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                                )}
                                <span className={isCorrectAnswer ? 'font-semibold text-green-900 dark:text-green-100' : isMyChoice ? 'font-semibold text-red-900 dark:text-red-100' : ''}>
                                  {option}
                                  {isMyChoice && <span className="ml-2 text-sm">(Your Answer)</span>}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div className="pt-2 border-t">
                        <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                          Correct Answer: {question.correctAnswer}
                        </p>
                        {!isCorrect && (
                          <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                            Your Answer: {myAnswer || 'Not answered'}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
