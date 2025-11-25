import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { useState } from "react";
import { PresentationViewer } from "@/components/PresentationViewer";
import type { Course, TrainingWeek, DeckFile } from "@shared/schema";

export default function CoursesView({ mode = "courses" }: { mode?: "courses" | "weeks" }) {
  const { courseId } = useParams<{ courseId?: string }>();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [viewingFile, setViewingFile] = useState<{ url: string; name: string } | null>(null);

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
          <Button onClick={() => navigate("/courses")} variant="outline">
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
              <Button onClick={() => navigate("/courses")} variant="ghost" size="icon">
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <h1 className="text-3xl sm:text-4xl font-bold truncate">{course.name}</h1>
                <p className="text-muted-foreground text-sm sm:text-base">
                  {course.weeks?.length || 0} weeks • {user?.role === "admin" ? "Admin View" : "View Only"}
                </p>
              </div>
              {user?.role === "admin" && (
                <Button 
                  onClick={() => navigate(`/admin/courses/${courseId}`)}
                  variant="default"
                  className="gap-2"
                  data-testid="button-manage-weeks"
                >
                  Manage
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
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
                  className="p-6 rounded-2xl hover:shadow-lg transition-all duration-300"
                  data-testid={`card-week-${week.id}`}
                >
                  <div className="mb-4 pb-4 border-b">
                    <h3 className="text-lg font-bold mb-2">Week {week.weekNumber}</h3>
                    <p className="text-sm font-semibold text-primary">{week.competencyFocus}</p>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">{week.objective}</p>
                  
                  {/* Files Section */}
                  {week.deckFiles && week.deckFiles.length > 0 && (
                    <div className="mt-6 pt-4 border-t">
                      <p className="text-xs font-semibold text-muted-foreground mb-3">FILES ({week.deckFiles.length})</p>
                      <div className="space-y-2">
                        {week.deckFiles.map((file: DeckFile) => (
                          <button
                            key={file.id}
                            onClick={() => setViewingFile({ url: file.fileUrl, name: file.fileName })}
                            className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors hover-elevate active-elevate-2 text-left group"
                            data-testid={`button-view-file-${file.id}`}
                          >
                            <FileText className="h-4 w-4 text-muted-foreground group-hover:text-primary flex-shrink-0" />
                            <span className="text-sm font-medium truncate flex-1 group-hover:text-primary transition-colors">
                              {file.fileName}
                            </span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center rounded-2xl border-dashed">
              <p className="text-lg font-medium text-muted-foreground">No weeks available yet</p>
            </Card>
          )}
        </div>

        {/* File Viewer Dialog */}
        {viewingFile && (
          <PresentationViewer
            isOpen={!!viewingFile}
            fileUrl={viewingFile.url}
            fileName={viewingFile.name}
            onClose={() => setViewingFile(null)}
          />
        )}
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
              <p className="text-muted-foreground text-sm sm:text-base">
                {user?.role === "admin" ? "Manage all courses and weeks" : "Browse available courses"}
              </p>
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
              <button
                key={course.id}
                onClick={() => navigate(`/courses/${course.id}`)}
                className="text-left hover-elevate active-elevate-2"
                data-testid={`card-course-${course.id}`}
              >
                <Card className="p-6 h-full rounded-2xl overflow-hidden group cursor-pointer border border-border hover:border-primary/50 transition-colors">
                  {/* Card Header */}
                  <div className="mb-4 pb-4 border-b">
                    <h3 className="text-xl font-bold line-clamp-2 group-hover:text-primary transition-colors">
                      {course.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-2">
                      {course.createdAt ? new Date(course.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : "Just now"}
                    </p>
                  </div>

                  {/* Card Actions */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-muted-foreground">View Course</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                  </div>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
