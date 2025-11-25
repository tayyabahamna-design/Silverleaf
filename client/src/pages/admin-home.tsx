import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Users, Award, BarChart3, ArrowRight, BookOpen } from "lucide-react";

interface DashboardStats {
  totalTrainers: number;
  totalTeachers: number;
  totalCourses: number;
  activeUsers: number;
}

export default function AdminHome() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // Fetch dashboard stats
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/dashboard-stats"],
  });

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 text-center max-w-md">
          <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
          <p className="text-muted-foreground mb-6">
            Only administrators can access this page.
          </p>
          <Button onClick={() => navigate("/")} variant="outline">
            Go Home
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Manage trainers, teachers, and view system statistics
          </p>
        </div>

        {/* Stats Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="p-6 animate-pulse bg-muted h-32" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Total Trainers
                  </p>
                  <p className="text-3xl font-bold">
                    {stats?.totalTrainers || 0}
                  </p>
                </div>
                <Award className="h-10 w-10 text-primary/30" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Total Teachers
                  </p>
                  <p className="text-3xl font-bold">
                    {stats?.totalTeachers || 0}
                  </p>
                </div>
                <Users className="h-10 w-10 text-primary/30" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Total Courses
                  </p>
                  <p className="text-3xl font-bold">
                    {stats?.totalCourses || 0}
                  </p>
                </div>
                <BarChart3 className="h-10 w-10 text-primary/30" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Active Users
                  </p>
                  <p className="text-3xl font-bold">
                    {stats?.activeUsers || 0}
                  </p>
                </div>
                <Users className="h-10 w-10 text-primary/30" />
              </div>
            </Card>
          </div>
        )}

        {/* Quick Navigation */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {user?.role === "admin" && (
            <Card className="p-8 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate("/admin/courses")}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-2xl font-bold mb-2">Manage Courses</h3>
                  <p className="text-muted-foreground">
                    Create and manage courses
                  </p>
                </div>
                <BarChart3 className="h-12 w-12 text-primary/20" />
              </div>
              <Button 
                variant="outline" 
                className="mt-4 w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate("/admin/courses");
                }}
                data-testid="button-go-manage-courses"
              >
                Manage
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Card>
          )}

          <Card className="p-8 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate("/courses")}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-2xl font-bold mb-2">Courses</h3>
                <p className="text-muted-foreground">
                  Browse all courses
                </p>
              </div>
              <BookOpen className="h-12 w-12 text-primary/20" />
            </div>
            <Button 
              variant="outline" 
              className="mt-4 w-full"
              onClick={(e) => {
                e.stopPropagation();
                navigate("/courses");
              }}
              data-testid="button-go-courses"
            >
              View Courses
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Card>

          {user?.role === "admin" && (
            <>
              <Card className="p-8 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate("/admin/trainers")}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-2xl font-bold mb-2">Trainers</h3>
                    <p className="text-muted-foreground">
                      Manage all trainers and their approvals
                    </p>
                  </div>
                  <Award className="h-12 w-12 text-primary/20" />
                </div>
                <Button 
                  variant="outline" 
                  className="mt-4 w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate("/admin/trainers");
                  }}
                  data-testid="button-go-trainers"
                >
                  View Trainers
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Card>

              <Card className="p-8 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate("/admin/teachers")}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-2xl font-bold mb-2">Teachers</h3>
                    <p className="text-muted-foreground">
                      Manage all teachers and view their progress
                    </p>
                  </div>
                  <Users className="h-12 w-12 text-primary/20" />
                </div>
                <Button 
                  variant="outline" 
                  className="mt-4 w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate("/admin/teachers");
                  }}
                  data-testid="button-go-teachers"
                >
                  View Teachers
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
