import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";

interface Teacher {
  id: string;
  teacherId: number;
  name: string;
  email: string;
  role: string;
  approvalStatus: string;
  createdAt: string;
  lastLogin?: string;
  progress?: number;
  filesViewed?: number;
  courseCompletion?: number;
}

export default function AdminTeachers() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // Fetch teachers list
  const { data: teachers, isLoading } = useQuery<Teacher[]>({
    queryKey: ["/api/admin/teachers"],
  });

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 text-center max-w-md">
          <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
          <p className="text-muted-foreground">
            Only administrators can access this page.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header with Back Button */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/admin")}
            data-testid="button-back-dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Teachers</h1>
            <p className="text-muted-foreground">
              Manage all teachers and view their progress
            </p>
          </div>
        </div>

        {/* Teachers List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-6 animate-pulse bg-muted h-24" />
            ))}
          </div>
        ) : teachers && teachers.length > 0 ? (
          <div className="space-y-4">
            {teachers.map((teacher) => (
              <Card
                key={teacher.id}
                className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/admin/teachers/${teacher.id}`)}
                data-testid={`card-teacher-${teacher.id}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Teacher Info */}
                    <div className="flex items-center gap-4 mb-4">
                      <div>
                        <h3 className="text-lg font-bold">{teacher.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          ID: {teacher.teacherId} | {teacher.email}
                        </p>
                      </div>
                      <Badge
                        variant={
                          teacher.approvalStatus === "approved"
                            ? "default"
                            : teacher.approvalStatus === "pending"
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {teacher.approvalStatus}
                      </Badge>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">
                          Progress
                        </p>
                        <p className="text-sm font-semibold">
                          {teacher.progress || 0}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">
                          Course Completion
                        </p>
                        <p className="text-sm font-semibold">
                          {teacher.courseCompletion || 0}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">
                          Files Viewed
                        </p>
                        <p className="text-sm font-semibold">
                          {teacher.filesViewed || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">
                          Last Active
                        </p>
                        <p className="text-sm font-semibold">
                          {teacher.lastLogin
                            ? format(new Date(teacher.lastLogin), "MMM d")
                            : "Never"}
                        </p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <Progress value={teacher.progress || 0} className="h-2" />
                  </div>

                  <ChevronRight className="h-5 w-5 text-muted-foreground ml-4 flex-shrink-0 mt-1" />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No teachers found</p>
          </Card>
        )}
      </div>
    </div>
  );
}
