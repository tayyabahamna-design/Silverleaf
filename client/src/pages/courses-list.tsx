import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Trash2, Pencil, ChevronRight, LogOut, BarChart3, FileText, CheckCircle, Users, Layers } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import logoImage from "@assets/image_1760460046116.png";
import type { Course, Batch } from "@shared/schema";

interface CourseWithAssignment extends Course {
  assignedAt?: Date;
}

export default function CoursesList() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user, isAdmin, isTrainer, logoutMutation } = useAuth();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseDescription, setNewCourseDescription] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [assigningCourseId, setAssigningCourseId] = useState<string | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [resetUserIdentifier, setResetUserIdentifier] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");

  // Fetch courses - show all for admin/trainer, only assigned for teacher
  const { data: courses = [], isLoading } = useQuery<CourseWithAssignment[]>({
    queryKey: user?.role === 'teacher' ? ["/api/teacher", user?.id, "courses"] : ["/api/courses"],
    refetchOnWindowFocus: false,
  });

  // Fetch batches for trainers
  const { data: batches = [] } = useQuery<Batch[]>({
    queryKey: ["/api/batches"],
    enabled: isTrainer,
  });

  // Fetch assigned batches for each course (trainer/admin only)
  const courseIds = courses.map(c => c.id);
  const { data: courseAssignments = {} } = useQuery<Record<string, Batch[]>>({
    queryKey: ["/api/courses", "assignments", courseIds],
    queryFn: async () => {
      const assignments: Record<string, Batch[]> = {};
      for (const courseId of courseIds) {
        try {
          const response = await apiRequest("GET", `/api/courses/${courseId}/batches`);
          const batches = await response.json();
          assignments[courseId] = Array.isArray(batches) ? batches : [];
        } catch {
          assignments[courseId] = [];
        }
      }
      return assignments;
    },
    enabled: (isTrainer || isAdmin) && courseIds.length > 0,
  });

  // Create course mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/courses", {
        name: newCourseName,
        description: newCourseDescription,
        orderIndex: courses.length,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      if (user?.role === 'teacher') {
        queryClient.invalidateQueries({ queryKey: ["/api/teacher", user?.id, "courses"] });
      }
      setNewCourseName("");
      setNewCourseDescription("");
      setCreateOpen(false);
      toast({ title: "Course created" });
    },
  });

  // Update course mutation
  const updateMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/courses/${id}`, {
        name: editName,
        description: editDescription,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      if (user?.role === 'teacher') {
        queryClient.invalidateQueries({ queryKey: ["/api/teacher", user?.id, "courses"] });
      }
      setEditingId(null);
      toast({ title: "Course updated" });
    },
  });

  // Delete course mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/courses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      if (user?.role === 'teacher') {
        queryClient.invalidateQueries({ queryKey: ["/api/teacher", user?.id, "courses"] });
      }
      setDeleteId(null);
      toast({ title: "Course deleted" });
    },
  });

  // Assign course mutation (trainer)
  const assignMutation = useMutation({
    mutationFn: async ({ courseId, targetId, targetType }: { courseId: string; targetId: string; targetType: 'batch' | 'teacher' }) => {
      return apiRequest("POST", `/api/courses/${courseId}/assign`, { targetId, targetType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/courses", "assignments"] });
      if (user?.role === 'teacher') {
        queryClient.invalidateQueries({ queryKey: ["/api/teacher", user?.id, "courses"] });
      }
      setAssignOpen(false);
      setAssigningCourseId(null);
      setSelectedBatchId("");
      toast({ title: "Course assigned successfully" });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to assign course",
        description: error.message || "An error occurred",
      });
    },
  });

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userIdentifier, newPassword }: { userIdentifier: string; newPassword: string }) => {
      return apiRequest("POST", "/api/admin/reset-user-password", { userIdentifier, newPassword });
    },
    onSuccess: () => {
      toast({ title: "Password reset successfully" });
      setResetPasswordOpen(false);
      setResetUserIdentifier("");
      setResetNewPassword("");
    },
  });

  const handleEdit = (course: Course) => {
    setEditingId(course.id);
    setEditName(course.name);
    setEditDescription(course.description || "");
  };

  const sortedCourses = [...courses].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="min-h-screen bg-background">
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
          <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0 flex-wrap justify-end">
            {user && (
              <div className="text-xs sm:text-sm text-white/90 hidden md:block truncate max-w-[200px]" data-testid="text-user-info">
                {user.email} ({user.role})
              </div>
            )}
            {isAdmin && (
              <>
                <Dialog open={resetPasswordOpen} onOpenChange={setResetPasswordOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="secondary"
                      size="sm"
                      data-testid="button-reset-password"
                      className="bg-white/10 hover:bg-white/20 text-white border-white/20 hidden sm:flex"
                    >
                      Reset Password
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Reset User Password</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="userIdentifier">Username or Email</Label>
                        <Input
                          id="userIdentifier"
                          placeholder="admin or admin@example.com"
                          value={resetUserIdentifier}
                          onChange={(e) => setResetUserIdentifier(e.target.value)}
                          data-testid="input-user-identifier"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="newPassword">New Password</Label>
                        <PasswordInput
                          id="newPassword"
                          placeholder="Enter new password (min 6 characters)"
                          value={resetNewPassword}
                          onChange={(e) => setResetNewPassword(e.target.value)}
                          data-testid="input-new-password"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setResetPasswordOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={() => {
                          resetPasswordMutation.mutate({
                            userIdentifier: resetUserIdentifier,
                            newPassword: resetNewPassword,
                          });
                        }}
                        disabled={resetPasswordMutation.isPending}
                      >
                        Reset
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate("/admin/analytics")}
                  data-testid="button-nav-analytics"
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20 hidden sm:flex"
                >
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Analytics
                </Button>
              </>
            )}
            {(isAdmin || isTrainer) && (
              <>
                <Link href="/approvals">
                  <Button
                    variant="secondary"
                    size="sm"
                    data-testid="button-approvals"
                    className="bg-white/10 hover:bg-white/20 text-white border-white/20"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approvals
                  </Button>
                </Link>
                {isTrainer && (
                  <Link href="/trainer/batches">
                    <Button
                      variant="secondary"
                      size="sm"
                      data-testid="button-manage-batches"
                      className="bg-white/10 hover:bg-white/20 text-white border-white/20"
                    >
                      <Users className="mr-2 h-4 w-4" />
                      Manage Batches
                    </Button>
                  </Link>
                )}
              </>
            )}
            <div className="text-white">
              <ThemeToggle />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
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
              disabled={logoutMutation.isPending}
              data-testid="button-logout-mobile"
              className="sm:hidden h-8 w-8 bg-white/10 hover:bg-white/20 text-white border-white/20"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-6 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold">Training Courses</h2>
          {isAdmin && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-course" className="bg-green-600 hover:bg-green-700">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Course
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Course</DialogTitle>
                  <DialogDescription>Add a new training course</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="courseName">Course Name</Label>
                    <Input
                      id="courseName"
                      placeholder="e.g., Leadership Fundamentals"
                      value={newCourseName}
                      onChange={(e) => setNewCourseName(e.target.value)}
                      data-testid="input-course-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="courseDescription">Description (Optional)</Label>
                    <Textarea
                      id="courseDescription"
                      placeholder="Brief description of the course"
                      value={newCourseDescription}
                      onChange={(e) => setNewCourseDescription(e.target.value)}
                      data-testid="textarea-course-description"
                      className="min-h-24"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => createMutation.mutate()}
                    disabled={createMutation.isPending || !newCourseName.trim()}
                    data-testid="button-create-course"
                  >
                    Create
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading courses...</div>
        ) : sortedCourses.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {isAdmin ? "No courses yet. Click 'Add Course' to get started!" : "No courses assigned to you yet."}
          </div>
        ) : (
          <div className="grid gap-4">
            {sortedCourses.map((course) => (
              <Card key={course.id} className="p-4 sm:p-6 hover-elevate cursor-pointer transition-all" data-testid={`card-course-${course.id}`}>
                <div className="flex items-start justify-between gap-4">
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => navigate(`/courses/${course.id}`)}
                  >
                    {editingId === course.id ? (
                      <div className="space-y-3">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          data-testid={`input-edit-name-${course.id}`}
                        />
                        <Textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          data-testid={`textarea-edit-desc-${course.id}`}
                          className="min-h-20"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => updateMutation.mutate(course.id)}
                            disabled={updateMutation.isPending}
                            data-testid={`button-save-course-${course.id}`}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingId(null)}
                            data-testid={`button-cancel-edit-${course.id}`}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <h3 className="text-lg sm:text-xl font-bold" data-testid={`text-course-name-${course.id}`}>
                          {course.name}
                        </h3>
                        {course.description && (
                          <p className="text-sm text-muted-foreground mt-2">{course.description}</p>
                        )}
                        {(isTrainer || isAdmin) && courseAssignments[course.id]?.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mr-2">
                              <Layers className="h-3 w-3" />
                              Assigned to:
                            </div>
                            {courseAssignments[course.id].map((batch) => (
                              <Badge key={batch.id} variant="secondary" data-testid={`badge-batch-${batch.id}`}>
                                {batch.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                    {editingId !== course.id && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => navigate(`/courses/${course.id}`)}
                          data-testid={`button-view-course-${course.id}`}
                          className="h-9 w-9"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </Button>

                        {isAdmin && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEdit(course)}
                              data-testid={`button-edit-course-${course.id}`}
                              className="h-9 w-9"
                            >
                              <Pencil className="h-5 w-5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setDeleteId(course.id)}
                              data-testid={`button-delete-course-${course.id}`}
                              className="h-9 w-9 hover:text-destructive"
                            >
                              <Trash2 className="h-5 w-5" />
                            </Button>
                          </>
                        )}

                        {isTrainer && (
                          <Dialog open={assignOpen && assigningCourseId === course.id} onOpenChange={(open) => {
                            if (!open) {
                              setAssignOpen(false);
                              setAssigningCourseId(null);
                            }
                          }}>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setAssigningCourseId(course.id);
                                  setAssignOpen(true);
                                }}
                                data-testid={`button-assign-course-${course.id}`}
                              >
                                Assign
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Assign Course</DialogTitle>
                                <DialogDescription>
                                  Assign "{course.name}" to a batch
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                {/* Show already assigned batches */}
                                {courseAssignments[course.id] && courseAssignments[course.id].length > 0 && (
                                  <div className="p-3 bg-muted/50 rounded-lg border">
                                    <p className="text-xs font-semibold text-muted-foreground mb-2">Already Assigned To:</p>
                                    <div className="space-y-1">
                                      {courseAssignments[course.id].map((batch) => (
                                        <div key={batch.id} className="text-sm flex items-center gap-2">
                                          <CheckCircle className="h-3 w-3 text-green-600" />
                                          {batch.name}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <div className="space-y-2">
                                  <Label htmlFor="batch-select">
                                    {courseAssignments[course.id]?.length > 0 ? "Assign to Another Batch" : "Select Batch"}
                                  </Label>
                                  <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
                                    <SelectTrigger id="batch-select" data-testid="select-batch">
                                      <SelectValue placeholder="Choose a batch..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {batches.length === 0 ? (
                                        <div className="p-2 text-sm text-muted-foreground text-center">
                                          No batches available. Create a batch first.
                                        </div>
                                      ) : (
                                        batches.map((batch) => {
                                          const isAlreadyAssigned = courseAssignments[course.id]?.some((b) => b.id === batch.id);
                                          return (
                                            <SelectItem key={batch.id} value={batch.id} disabled={isAlreadyAssigned}>
                                              {batch.name}
                                              {isAlreadyAssigned && " (Already assigned)"}
                                            </SelectItem>
                                          );
                                        })
                                      )}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <DialogFooter>
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setAssignOpen(false);
                                    setAssigningCourseId(null);
                                    setSelectedBatchId("");
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  onClick={() => {
                                    if (assigningCourseId && selectedBatchId) {
                                      assignMutation.mutate({
                                        courseId: assigningCourseId,
                                        targetId: selectedBatchId,
                                        targetType: "batch",
                                      });
                                    }
                                  }}
                                  disabled={!selectedBatchId || assignMutation.isPending}
                                  data-testid="button-assign-course-submit"
                                >
                                  Assign Course
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="p-6 max-w-sm">
            <h3 className="text-lg font-bold mb-2">Delete Course?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This action cannot be undone. All weeks and content in this course will be deleted.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDeleteId(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
                data-testid={`button-confirm-delete-${deleteId}`}
              >
                Delete
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
