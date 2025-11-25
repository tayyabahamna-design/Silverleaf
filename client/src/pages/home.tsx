import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogOut, ChevronRight, BarChart3, Users } from "lucide-react";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import type { Course } from "@shared/schema";
import logoImage from "@assets/image_1760460046116.png";

export default function Home() {
  const [, navigate] = useLocation();
  const { user, logoutMutation, isLoading: isLoadingUser } = useAuth();

  const { data: courses = [], isLoading: coursesLoading } = useQuery<Course[]>({
    queryKey: ["/api/courses"],
  });

  const isLoading = coursesLoading || isLoadingUser;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-gradient-to-r from-primary to-primary/80 shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Logo & Title */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <img 
                src={logoImage}
                alt="Silverleaf Logo"
                className="h-10 w-10 flex-shrink-0 rounded-md object-cover"
              />
              <div className="flex-1 min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-white">SILVERLEAF</h1>
                <p className="text-xs sm:text-sm text-white/80">{user?.username}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {user?.role === "admin" && (
                <>
                  <Link href="/admin" asChild>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      title="Admin Dashboard"
                      data-testid="button-admin-dashboard"
                      className="hover-elevate text-white hover:bg-white/20"
                    >
                      <BarChart3 className="h-5 w-5" />
                    </Button>
                  </Link>
                  <Link href="/admin/courses" asChild>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      title="Manage Courses"
                      data-testid="button-manage-courses"
                      className="hover-elevate text-white hover:bg-white/20"
                    >
                      <Users className="h-5 w-5" />
                    </Button>
                  </Link>
                </>
              )}
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
                title="Logout"
                data-testid="button-logout"
                className="hover-elevate text-white hover:bg-white/20"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page Title */}
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold mb-2">Courses</h2>
          <p className="text-muted-foreground">
            {user?.role === "admin" ? "Manage all courses and view trainee progress" : "Browse and complete available courses"}
          </p>
        </div>

        {/* Courses Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="p-6 animate-pulse bg-muted h-48 rounded-2xl" />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <Card className="p-12 text-center shadow-lg rounded-2xl border-dashed">
            <p className="text-lg font-medium text-muted-foreground">
              {user?.role === "admin" ? "No courses yet. Create one from the Admin Dashboard." : "No courses available yet."}
            </p>
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
                      {course.createdAt 
                        ? new Date(course.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                        : "Just now"}
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
      </main>
    </div>
  );
}
