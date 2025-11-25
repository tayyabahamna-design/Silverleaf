import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Plus, Trash2, Edit, ChevronRight } from "lucide-react";
import type { Course } from "@shared/schema";

export default function AdminCourses() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const { data: courses = [], isLoading } = useQuery<Course[]>({
    queryKey: ["/api/courses"],
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest("POST", "/api/courses", { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      setNewCourseName("");
      setIsDialogOpen(false);
      toast({ title: "Course created successfully" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      return apiRequest("PATCH", `/api/courses/${id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      setEditingCourse(null);
      setNewCourseName("");
      setIsDialogOpen(false);
      toast({ title: "Course updated successfully" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/courses/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      toast({ title: "Course deleted successfully" });
    },
  });

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 text-center max-w-md">
          <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
          <p className="text-muted-foreground mb-6">Only admins can manage courses.</p>
          <Button onClick={() => navigate("/")} variant="outline">
            Go Home
          </Button>
        </Card>
      </div>
    );
  }

  const handleAddClick = () => {
    setEditingCourse(null);
    setNewCourseName("");
    setIsDialogOpen(true);
  };

  const handleEditClick = (course: Course) => {
    setEditingCourse(course);
    setNewCourseName(course.name);
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!newCourseName.trim()) return;
    
    if (editingCourse) {
      updateMutation.mutate({ id: editingCourse.id, name: newCourseName });
    } else {
      createMutation.mutate(newCourseName);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Courses</h1>
            <p className="text-muted-foreground">Manage all courses and their weeks</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleAddClick} data-testid="button-add-course">
                <Plus className="mr-2 h-4 w-4" />
                Add Course
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCourse ? "Edit Course" : "Add New Course"}</DialogTitle>
                <DialogDescription>
                  {editingCourse ? "Update the course name" : "Enter the name for the new course"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="course-name">Course Name</Label>
                  <Input
                    id="course-name"
                    data-testid="input-course-name"
                    value={newCourseName}
                    onChange={(e) => setNewCourseName(e.target.value)}
                    placeholder="Enter course name"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSubmit}
                    disabled={!newCourseName.trim() || createMutation.isPending || updateMutation.isPending}
                    data-testid="button-submit-course"
                  >
                    {editingCourse ? "Update" : "Create"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-6 animate-pulse bg-muted h-32" />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-4">No courses yet. Create one to get started.</p>
            <Button onClick={handleAddClick}>
              <Plus className="mr-2 h-4 w-4" />
              Create First Course
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <Card 
                key={course.id}
                className="p-6 hover:shadow-lg transition-shadow"
                data-testid={`card-course-${course.id}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold mb-1">{course.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {course.createdAt ? new Date(course.createdAt).toLocaleDateString() : "Just now"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => navigate(`/admin/courses/${course.id}`)}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    data-testid={`button-manage-weeks-${course.id}`}
                  >
                    Manage Weeks
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() => handleEditClick(course)}
                    variant="outline"
                    size="sm"
                    data-testid={`button-edit-course-${course.id}`}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() => deleteMutation.mutate(course.id)}
                    variant="destructive"
                    size="sm"
                    data-testid={`button-delete-course-${course.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
