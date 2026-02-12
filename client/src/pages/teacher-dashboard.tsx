import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import posthog from "posthog-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProfileSettingsDialog } from "@/components/ProfileSettingsDialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Award, CheckCircle, LogOut, GraduationCap, ArrowRight, FileText, Star } from "lucide-react";
import logoImage from "@assets/Screenshot 2025-10-14 214034_1761029433045.png";

export default function TeacherDashboard() {
  const [, setLocation] = useLocation();

  // Track dashboard view
  useEffect(() => {
    posthog.capture("teacher_dashboard_viewed");
  }, []);

  const { data: teacher } = useQuery<any>({
    queryKey: ["/api/teacher/me"],
  });

  const { data: reportCard } = useQuery<any>({
    queryKey: ["/api/teacher/report-card"],
  });

  const { data: assignedWeeks = [] } = useQuery<any[]>({
    queryKey: ["/api/teacher/assigned-weeks"],
  });

  const { toast } = useToast();
  const [reflectionWeekId, setReflectionWeekId] = useState("");
  const [reflectionBatchId, setReflectionBatchId] = useState("");
  const [reflectionContent, setReflectionContent] = useState("");
  const [reflectionRating, setReflectionRating] = useState(0);
  const [satisfactionScore, setSatisfactionScore] = useState(0);
  const [satisfactionCourseId, setSatisfactionCourseId] = useState("");

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

  // Fetch own reflections
  const { data: reflections = [] } = useQuery<any[]>({
    queryKey: ["/api/teacher/reflections"],
    queryFn: async () => {
      const response = await fetch("/api/teacher/reflections");
      if (!response.ok) return [];
      return await response.json();
    },
  });

  // Submit reflection mutation
  const submitReflectionMutation = useMutation({
    mutationFn: async (data: { weekId: string; batchId: string; content: string; rating: number | null }) => {
      await apiRequest("POST", "/api/teacher/reflections", data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Reflection submitted successfully" });
      setReflectionContent("");
      setReflectionRating(0);
      setReflectionWeekId("");
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/reflections"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Submit satisfaction score mutation
  const submitSatisfactionMutation = useMutation({
    mutationFn: async (data: { type: string; raterId: string; raterRole: string; targetId: string; targetType: string; score: number }) => {
      await apiRequest("POST", "/api/satisfaction-scores", data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Rating submitted successfully" });
      setSatisfactionScore(0);
      setSatisfactionCourseId("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getLevelBadgeVariant = (level: string) => {
    if (level === "Advanced") return "default";
    if (level === "Intermediate") return "secondary";
    return "outline";
  };

  // Group weeks by course name and aggregate progress
  const groupedCourses = assignedWeeks.reduce((acc: any, week: any) => {
    const courseName = week.courseName || week.title;
    if (!acc[courseName]) {
      acc[courseName] = {
        courseName,
        weeks: [],
        totalCompleted: 0,
        totalFiles: 0,
      };
    }
    acc[courseName].weeks.push(week);
    acc[courseName].totalCompleted += week.progress?.completed || 0;
    acc[courseName].totalFiles += week.progress?.total || 0;
    return acc;
  }, {});

  const uniqueCourses = Object.values(groupedCourses).map((course: any) => ({
    ...course,
    aggregateProgress: {
      completed: course.totalCompleted,
      total: course.totalFiles,
      percentage: course.totalFiles > 0 
        ? Math.round((course.totalCompleted / course.totalFiles) * 100) 
        : 0,
    },
  }));

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
            <ProfileSettingsDialog
              userType="teacher"
              currentEmail={teacher?.email}
            />
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
              <CheckCircle className="h-5 w-5 text-primary/60" />
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
            {uniqueCourses.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No training weeks assigned yet
              </p>
            ) : (
              <div className="space-y-4">
                {uniqueCourses.map((course: any) => (
                  <Card key={course.courseName} data-testid={`card-course-${course.courseName}`} className="shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 border-border/50 rounded-lg">
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <CardTitle className="text-lg">{course.courseName}</CardTitle>
                          <CardDescription>{course.weeks.length} week{course.weeks.length !== 1 ? 's' : ''} assigned</CardDescription>
                        </div>
                        <Badge variant={course.aggregateProgress.percentage === 100 ? "default" : "secondary"}>
                          {course.aggregateProgress.completed}/{course.aggregateProgress.total} Completed
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {course.aggregateProgress.total > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium">{course.aggregateProgress.percentage}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div 
                              className="bg-primary rounded-full h-2 transition-all duration-300"
                              style={{ width: `${course.aggregateProgress.percentage}%` }}
                            />
                          </div>
                        </div>
                      )}
                      <Button 
                        onClick={() => setLocation(`/teacher/week/${course.weeks[0].id}/content`)} 
                        data-testid={`button-view-content-${course.courseName}`}
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

        {/* Weekly Reflection Submission */}
        <Card className="shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-border/50 rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Weekly Reflection
            </CardTitle>
            <CardDescription>Share your learning reflections after completing a week</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {assignedWeeks.length > 0 && (
                <div>
                  <Label>Select Week</Label>
                  <Select value={reflectionWeekId} onValueChange={(val) => {
                    setReflectionWeekId(val);
                    const week = assignedWeeks.find((w: any) => w.id === val);
                    if (week?.batchId) setReflectionBatchId(week.batchId);
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a week to reflect on..." />
                    </SelectTrigger>
                    <SelectContent>
                      {assignedWeeks.map((week: any) => (
                        <SelectItem key={week.id} value={week.id}>
                          {week.courseName || week.title} - Week {week.weekNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Your Reflection</Label>
                <Textarea
                  value={reflectionContent}
                  onChange={(e) => setReflectionContent(e.target.value)}
                  placeholder="What did you learn this week? What challenges did you face? What would you do differently?"
                  rows={4}
                />
              </div>
              <div>
                <Label>Self-Rating (1-5)</Label>
                <div className="flex gap-2 mt-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Button
                      key={n}
                      variant={reflectionRating === n ? "default" : "outline"}
                      size="sm"
                      onClick={() => setReflectionRating(n)}
                      className="w-10 h-10"
                    >
                      {n}
                    </Button>
                  ))}
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  if (!reflectionWeekId || !reflectionContent.trim()) {
                    toast({ title: "Error", description: "Please select a week and write your reflection", variant: "destructive" });
                    return;
                  }
                  submitReflectionMutation.mutate({
                    weekId: reflectionWeekId,
                    batchId: reflectionBatchId,
                    content: reflectionContent,
                    rating: reflectionRating || null,
                  });
                }}
                disabled={submitReflectionMutation.isPending}
              >
                {submitReflectionMutation.isPending ? "Submitting..." : "Submit Reflection"}
              </Button>
            </div>

            {/* Previous Reflections */}
            {reflections.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Previous Reflections</h3>
                <div className="space-y-2">
                  {reflections.slice(0, 5).map((r: any) => (
                    <div key={r.id} className="p-3 bg-muted rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        {r.rating && <Badge variant="outline">{r.rating}/5</Badge>}
                        <span className="text-xs text-muted-foreground">
                          {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : ""}
                        </span>
                      </div>
                      <p className="text-sm">{r.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Course Satisfaction Rating */}
        {uniqueCourses.length > 0 && (
          <Card className="shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-border/50 rounded-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5" />
                Rate Your Courses
              </CardTitle>
              <CardDescription>Help us improve by rating your learning experience</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label>Select Course</Label>
                  <Select value={satisfactionCourseId} onValueChange={setSatisfactionCourseId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a course to rate..." />
                    </SelectTrigger>
                    <SelectContent>
                      {uniqueCourses.map((course: any) => (
                        <SelectItem key={course.courseName} value={course.courseName}>
                          {course.courseName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Your Rating</Label>
                  <div className="flex gap-2 mt-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Button
                        key={n}
                        variant={satisfactionScore === n ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSatisfactionScore(n)}
                        className="w-10 h-10"
                      >
                        <Star className={`h-4 w-4 ${satisfactionScore >= n ? "fill-current" : ""}`} />
                      </Button>
                    ))}
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    if (!satisfactionCourseId || !satisfactionScore) {
                      toast({ title: "Error", description: "Please select a course and give a rating", variant: "destructive" });
                      return;
                    }
                    submitSatisfactionMutation.mutate({
                      type: "fellow_rates_course",
                      raterId: teacher?.id,
                      raterRole: "teacher",
                      targetId: satisfactionCourseId,
                      targetType: "course",
                      score: satisfactionScore,
                    });
                  }}
                  disabled={submitSatisfactionMutation.isPending}
                >
                  {submitSatisfactionMutation.isPending ? "Submitting..." : "Submit Rating"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
