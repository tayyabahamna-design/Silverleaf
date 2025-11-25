import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Course, TrainingWeek } from "@shared/schema";

export default function CoursesView({ mode = "courses" }: { mode?: "courses" | "weeks" }) {
  const { courseId } = useParams<{ courseId?: string }>();
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: courses = [], isLoading: coursesLoading } = useQuery<Course[]>({
    queryKey: ["/api/courses"],
  });

  const { data: course, isLoading: courseLoading } = useQuery<Course & { weeks: TrainingWeek[] }>({
    queryKey: ["/api/courses", courseId],
    enabled: !!courseId && mode === "weeks",
  });

  const isLoading = mode === "courses" ? coursesLoading : courseLoading;

  if (mode === "weeks" && !course && !courseLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="p-8 text-center max-w-md">
          <h2 className="text-2xl font-bold mb-4">Course not found</h2>
          <Button onClick={() => navigate("/")} variant="outline">
            Go Back
          </Button>
        </Card>
      </div>
    );
  }

  // Weeks view
  if (mode === "weeks" && course) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b bg-card shadow-sm sticky top-0 z-40">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center gap-4">
              <Button onClick={() => navigate("/")} variant="ghost" size="icon">
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <h1 className="text-3xl sm:text-4xl font-bold truncate">{course.name}</h1>
                <p className="text-muted-foreground text-sm sm:text-base">
                  {course.weeks?.length || 0} weeks • Read-only view
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-6 animate-pulse bg-muted h-32 rounded-2xl" />
              ))}
            </div>
          ) : course.weeks && course.weeks.length > 0 ? (
            <div className="space-y-4">
              {course.weeks.map((week) => (
                <Card 
                  key={week.id}
                  className="p-6 rounded-2xl hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
                  data-testid={`card-week-${week.id}`}
                >
                  <div className="mb-4 pb-4 border-b">
                    <h3 className="text-lg font-bold mb-2">Week {week.weekNumber}</h3>
                    <p className="text-sm font-semibold text-primary">{week.competencyFocus}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{week.objective}</p>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center rounded-2xl border-dashed">
              <p className="text-lg font-medium text-muted-foreground">No weeks available yet</p>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // Courses view
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Button onClick={() => navigate("/")} variant="ghost" size="icon">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-3xl sm:text-4xl font-bold">Courses</h1>
              <p className="text-muted-foreground text-sm sm:text-base">Browse available courses (Read-only)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="p-6 animate-pulse bg-muted h-48 rounded-2xl" />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <Card className="p-12 text-center shadow-lg rounded-2xl border-dashed">
            <p className="text-lg font-medium text-muted-foreground">No courses available</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
            {courses.map((course) => (
              <Card 
                key={course.id}
                className="p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 rounded-2xl overflow-hidden group cursor-pointer"
                data-testid={`card-course-${course.id}`}
              >
                {/* Card Header */}
                <div className="mb-4 pb-4 border-b">
                  <h3 className="text-xl font-bold line-clamp-2 group-hover:text-primary transition-colors">{course.name}</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    {course.createdAt ? new Date(course.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : "Just now"}
                  </p>
                </div>

                {/* Card Actions */}
                <Button
                  onClick={() => navigate(`/courses/${course.id}`)}
                  variant="default"
                  className="w-full gap-2 rounded-lg"
                  data-testid={`button-view-weeks-${course.id}`}
                >
                  View Weeks
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
