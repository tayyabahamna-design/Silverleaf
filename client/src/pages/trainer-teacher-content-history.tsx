import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  CheckCircle, 
  XCircle,
  FileText,
  RotateCcw,
  AlertCircle
} from "lucide-react";

export default function TrainerTeacherContentHistory() {
  const { teacherId, weekId } = useParams();
  const [, setLocation] = useLocation();

  const { data: historyData = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/trainers/teachers", teacherId, "weeks", weekId, "content-history"],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium">Loading history...</div>
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
            onClick={() => setLocation("/trainer/batches")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-page-title">
              Teacher Content History
            </h1>
            <p className="text-muted-foreground">
              View all attempts, regenerations, and progress
            </p>
          </div>
        </div>

        {historyData.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-muted-foreground text-center">
                No content progress found for this teacher and week
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {historyData.map((item: any, index: number) => {
              const hasAttempts = item.attempts && item.attempts.length > 0;
              const hasRegenerations = item.regenerations && item.regenerations.length > 0;
              const status = item.progress?.status || "not started";
              const isCompleted = status === "completed";
              
              return (
                <Card key={index} data-testid={`card-content-${index}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          {item.file?.title || "Unknown Content"}
                        </CardTitle>
                        <CardDescription className="capitalize">
                          {item.file?.type || "file"} - Status: {status}
                        </CardDescription>
                      </div>
                      {isCompleted && (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Completed
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Progress Information */}
                    {item.progress && (
                      <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Status:</span>
                          <Badge variant="outline" className="capitalize">{item.progress.status}</Badge>
                        </div>
                        {item.progress.viewedAt && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Viewed At:</span>
                            <span className="text-sm">{new Date(item.progress.viewedAt).toLocaleString()}</span>
                          </div>
                        )}
                        {item.progress.completedAt && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Completed At:</span>
                            <span className="text-sm">{new Date(item.progress.completedAt).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Quiz Attempts */}
                    {hasAttempts && (
                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          Quiz Attempts ({item.attempts.length})
                        </h3>
                        <div className="space-y-3">
                          {item.attempts.map((attempt: any) => {
                            const percentage = Math.round((attempt.score / attempt.totalQuestions) * 100);
                            const passed = attempt.passed === "yes";
                            
                            return (
                              <Card 
                                key={attempt.id} 
                                className={`border-l-4 ${passed ? 'border-l-green-500' : 'border-l-red-500'}`}
                                data-testid={`card-attempt-${attempt.id}`}
                              >
                                <CardHeader>
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <CardTitle className="text-base">
                                        Attempt {attempt.attemptNumber}
                                      </CardTitle>
                                      <CardDescription>
                                        {new Date(attempt.completedAt).toLocaleString()}
                                      </CardDescription>
                                    </div>
                                    <Badge variant={passed ? "default" : "destructive"} className="gap-1">
                                      {passed ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                      {percentage}% - {passed ? "Passed" : "Failed"}
                                    </Badge>
                                  </div>
                                </CardHeader>
                                <CardContent>
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <span className="text-muted-foreground">Score:</span>
                                      <span className="ml-2 font-semibold">{attempt.score}/{attempt.totalQuestions}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Quiz Generation:</span>
                                      <span className="ml-2 font-mono text-xs">{attempt.quizGenerationId?.slice(0, 8)}...</span>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Quiz Regenerations */}
                    {hasRegenerations && (
                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <RotateCcw className="h-5 w-5" />
                          Quiz Regenerations ({item.regenerations.length})
                        </h3>
                        <div className="space-y-3">
                          {item.regenerations.map((regen: any) => (
                            <Card key={regen.id} className="border-l-4 border-l-orange-500" data-testid={`card-regen-${regen.id}`}>
                              <CardHeader>
                                <div className="flex items-center justify-between">
                                  <div>
                                    <CardTitle className="text-base flex items-center gap-2">
                                      <RotateCcw className="h-4 w-4" />
                                      Quiz Regenerated
                                    </CardTitle>
                                    <CardDescription>
                                      {new Date(regen.regeneratedAt).toLocaleString()}
                                    </CardDescription>
                                  </div>
                                  <Badge variant="outline">
                                    After {regen.failedAttempts || 3} Failed Attempts
                                  </Badge>
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Previous Quiz:</span>
                                    <span className="ml-2 font-mono text-xs">{regen.previousQuizGenerationId?.slice(0, 8)}...</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">New Quiz:</span>
                                    <span className="ml-2 font-mono text-xs">{regen.newQuizGenerationId?.slice(0, 8)}...</span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {!hasAttempts && !hasRegenerations && (
                      <div className="bg-muted/30 p-6 rounded-lg text-center">
                        <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-muted-foreground">
                          No quiz attempts or regenerations yet
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
