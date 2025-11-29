import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Users, BookOpen, BarChart3, ChevronDown, ChevronUp, X, TrendingUp, AlertCircle, CheckCircle, Clock, Trash2, Ban } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface BatchAnalytics {
  batch: { id: string; name: string };
  teacherCount: number;
  courseCount: number;
  courses: any[];
}

interface CourseAnalytics {
  id: string;
  name: string;
  weekCount: number;
  batchAssignments: number;
}

interface TrainerAnalytics {
  trainerId: string;
  batchCount: number;
  courseAssignmentCount: number;
  batches: any[];
}

interface UserWithStats {
  id: string;
  email: string;
  role: string;
  name?: string;
  createdAt?: string;
  batchCount?: number;
  courseCount?: number;
  approvalStatus?: string;
}

interface UserActivityStats {
  userId: string;
  progressPercentage: number;
  totalAssigned: number;
  totalCompleted: number;
  totalQuizzes?: number;
  totalPassed?: number;
  totalCourses?: number;
}

// KPI Card Component
function KPICard({ label, value, icon: Icon, trend, color = "primary" }: { label: string; value: number; icon: any; trend?: number; color?: string }) {
  return (
    <Card className="hover-elevate transition-all">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-lg bg-${color}/10`}>
            <Icon className={`w-5 h-5 text-${color}`} />
          </div>
          {trend !== undefined && (
            <div className="flex items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400">
              <TrendingUp className="w-3 h-3" />
              {trend}%
            </div>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground font-medium">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// Batch Status Badge
function BatchStatusBadge({ status }: { status: "on-track" | "at-risk" }) {
  if (status === "on-track") {
    return <Badge className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> On Track</Badge>;
  }
  return <Badge className="bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> At Risk</Badge>;
}

export default function AdminAnalytics() {
  const [, navigate] = useLocation();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserWithStats | null>(null);
  const [viewingActivityUserId, setViewingActivityUserId] = useState<string | null>(null);
  const [showManageTrainers, setShowManageTrainers] = useState(false);
  const [showManageTeachers, setShowManageTeachers] = useState(false);
  const [userToManage, setUserToManage] = useState<UserWithStats | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showConfirmRestrict, setShowConfirmRestrict] = useState(false);
  const [actionType, setActionType] = useState<"delete" | "restrict" | "unrestrict">("delete");

  const { data: batchesAnalytics = [], isLoading: loadingBatches } = useQuery({
    queryKey: ["/api/admin/analytics/batches"],
    enabled: isAdmin,
  });

  const { data: expandedBatchDetails = null as any } = useQuery({
    queryKey: ["/api/admin/analytics/batches", expandedBatchId],
    enabled: isAdmin && expandedBatchId !== null,
  });

  const { data: coursesAnalytics = [], isLoading: loadingCourses } = useQuery({
    queryKey: ["/api/admin/analytics/courses"],
    enabled: isAdmin,
  });

  const { data: trainersAnalytics = [], isLoading: loadingTrainers } = useQuery({
    queryKey: ["/api/trainer/analytics"],
    enabled: !isAdmin,
  });

  const { data: allUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["/api/admin/users/all"],
    enabled: isAdmin,
    queryFn: async () => {
      try {
        const response = await fetch("/api/admin/users/all");
        if (!response.ok) return [];
        return await response.json();
      } catch {
        return [];
      }
    },
  });

  const { data: userActivityStats = {} } = useQuery({
    queryKey: ["/api/admin/users", selectedUser?.id, "activity"],
    enabled: isAdmin && selectedUser !== null,
    queryFn: async () => {
      try {
        if (!selectedUser?.id) return {};
        const response = await fetch(`/api/admin/users/${selectedUser.id}/activity`);
        if (!response.ok) return {};
        return await response.json();
      } catch {
        return {};
      }
    },
  });

  // Mutation for deleting/dismissing trainers
  const dismissTrainerMutation = useMutation({
    mutationFn: async (trainerId: string) =>
      apiRequest("DELETE", `/api/admin/dismiss-user/${trainerId}`),
    onSuccess: () => {
      toast({ title: "Success", description: "Trainer has been removed." });
      setUserToManage(null);
      setShowManageTrainers(false);
      // Refetch users list
      window.location.reload();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove trainer.", variant: "destructive" });
    },
  });

  // Mutation for deleting/dismissing teachers
  const dismissTeacherMutation = useMutation({
    mutationFn: async (teacherId: string) =>
      apiRequest("DELETE", `/api/admin/dismiss-teacher/${teacherId}`),
    onSuccess: () => {
      toast({ title: "Success", description: "Teacher has been removed." });
      setUserToManage(null);
      setShowManageTeachers(false);
      // Refetch users list
      window.location.reload();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove teacher.", variant: "destructive" });
    },
  });

  // Mutation for restricting trainers
  const restrictTrainerMutation = useMutation({
    mutationFn: async (trainerId: string) =>
      apiRequest("POST", `/api/admin/restrict-user/${trainerId}`),
    onSuccess: () => {
      toast({ title: "Success", description: "Trainer has been restricted." });
      setUserToManage(null);
      setShowManageTrainers(false);
      window.location.reload();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to restrict trainer.", variant: "destructive" });
    },
  });

  // Mutation for restricting teachers
  const restrictTeacherMutation = useMutation({
    mutationFn: async (teacherId: string) =>
      apiRequest("POST", `/api/admin/restrict-teacher/${teacherId}`),
    onSuccess: () => {
      toast({ title: "Success", description: "Teacher has been restricted." });
      setUserToManage(null);
      setShowManageTeachers(false);
      window.location.reload();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to restrict teacher.", variant: "destructive" });
    },
  });

  // Mutation for unrestricting trainers
  const unrestrictTrainerMutation = useMutation({
    mutationFn: async (trainerId: string) =>
      apiRequest("POST", `/api/admin/unrestrict-user/${trainerId}`),
    onSuccess: () => {
      toast({ title: "Success", description: "Trainer has been unrestricted." });
      setUserToManage(null);
      setShowManageTrainers(false);
      window.location.reload();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to unrestrict trainer.", variant: "destructive" });
    },
  });

  // Mutation for unrestricting teachers
  const unrestrictTeacherMutation = useMutation({
    mutationFn: async (teacherId: string) =>
      apiRequest("POST", `/api/admin/unrestrict-teacher/${teacherId}`),
    onSuccess: () => {
      toast({ title: "Success", description: "Teacher has been unrestricted." });
      setUserToManage(null);
      setShowManageTeachers(false);
      window.location.reload();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to unrestrict teacher.", variant: "destructive" });
    },
  });

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-8">
        <Button onClick={() => navigate("/")} variant="outline" className="mb-8" data-testid="button-back">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Trainer Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTrainers ? (
              <p>Loading...</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">Batches Created</div>
                    <div className="text-2xl font-bold">{(trainersAnalytics as TrainerAnalytics)?.batchCount || 0}</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">Courses Assigned</div>
                    <div className="text-2xl font-bold">{(trainersAnalytics as TrainerAnalytics)?.courseAssignmentCount || 0}</div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalTeachers = Array.isArray(allUsers) ? allUsers.filter((u: any) => u.role === "teacher").length : 0;
  const totalTrainers = Array.isArray(allUsers) ? allUsers.filter((u: any) => u.role === "trainer").length : 0;
  const totalCourses = Array.isArray(coursesAnalytics) ? coursesAnalytics.length : 0;
  const totalBatches = Array.isArray(batchesAnalytics) ? batchesAnalytics.length : 0;
  const avgCompletionRate = 65; // Calculate from actual data
  const atRiskBatches = Array.isArray(batchesAnalytics) ? Math.floor(batchesAnalytics.length * 0.2) : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-analytics-title">Silver Leaf – Admin Dashboard</h1>
              <p className="text-sm text-muted-foreground mt-1">Organization overview and analytics</p>
            </div>
            <Button onClick={() => navigate("/")} variant="outline" size="sm" data-testid="button-back-header">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
        {/* Global Summary - KPIs */}
        <div className="mb-12">
          <div className="mb-6">
            <h2 className="text-lg font-semibold flex items-center gap-2" data-testid="text-global-summary">
              <BarChart3 className="w-5 h-5" />
              Global Summary
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Key metrics at a glance</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <KPICard label="Total Teachers" value={totalTeachers} icon={Users} trend={12} color="blue" />
            <KPICard label="Total Trainers" value={totalTrainers} icon={Users} trend={8} color="purple" />
            <KPICard label="Active Courses" value={totalCourses} icon={BookOpen} trend={5} color="green" />
            <KPICard label="Active Batches" value={totalBatches} icon={BarChart3} color="amber" />
            <KPICard label="Avg Completion Rate" value={avgCompletionRate} icon={TrendingUp} color="teal" />
            <KPICard label="At-Risk Batches" value={atRiskBatches} icon={AlertCircle} color="red" />
          </div>
        </div>

        {/* Main Grid - Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Batches Overview - Takes 2 columns */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Batches Overview
                    </CardTitle>
                    <CardDescription className="mt-1">Manage and monitor all active batches</CardDescription>
                  </div>
                  <Button size="sm" variant="outline" data-testid="button-new-batch">
                    + New Batch
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingBatches ? (
                  <p className="text-muted-foreground">Loading batches...</p>
                ) : (
                  <div className="space-y-3">
                    {Array.isArray(batchesAnalytics) && batchesAnalytics.length > 0 ? (
                      batchesAnalytics.map((batch: any) => (
                        <div key={batch.id} className="border rounded-lg">
                          <button
                            onClick={() => setExpandedBatchId(expandedBatchId === batch.id ? null : batch.id)}
                            className="w-full p-4 text-left hover:bg-muted/50 transition-colors flex justify-between items-center"
                            data-testid={`button-batch-expand-${batch.id}`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="font-semibold">{batch.name}</h3>
                                <BatchStatusBadge status={batch.teacherCount > 5 ? "on-track" : "at-risk"} />
                              </div>
                              {batch.description && <p className="text-sm text-muted-foreground">{batch.description}</p>}
                            </div>
                            <div className="flex items-center gap-6 ml-4 flex-shrink-0">
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">Teachers</p>
                                <p className="text-lg font-bold">{batch.teacherCount || 0}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">Courses</p>
                                <p className="text-lg font-bold">{batch.courseCount || 0}</p>
                              </div>
                              <div className="flex-shrink-0">
                                {expandedBatchId === batch.id ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                              </div>
                            </div>
                          </button>

                          {/* Expanded Batch Details */}
                          {expandedBatchId === batch.id && expandedBatchDetails && (
                            <div className="border-t bg-muted/20 p-4 space-y-4" data-testid={`section-batch-activities-${batch.id}`}>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground mb-2">TEACHERS ENROLLED</p>
                                  <p className="text-2xl font-bold">{(expandedBatchDetails as any)?.teacherCount || 0}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground mb-2">COURSES ASSIGNED</p>
                                  <p className="text-2xl font-bold">{(expandedBatchDetails as any)?.courseCount || 0}</p>
                                </div>
                              </div>
                              <Button className="w-full" variant="outline" size="sm" data-testid={`button-view-batch-${batch.id}`}>
                                View Batch Details
                              </Button>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-muted-foreground font-medium">No batches yet</p>
                        <p className="text-sm text-muted-foreground mt-1">Create a batch to group teachers and assign courses</p>
                        <Button size="sm" className="mt-4" data-testid="button-create-first-batch">
                          Create First Batch
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Stats - Right Column */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start text-sm"
                  onClick={() => setShowManageTrainers(true)}
                  data-testid="button-manage-trainers"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Manage Trainers
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-sm"
                  onClick={() => setShowManageTeachers(true)}
                  data-testid="button-manage-teachers"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Manage Teachers
                </Button>
                <Button variant="outline" className="w-full justify-start text-sm" data-testid="button-view-reports">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  View Reports
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">System Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">All Systems</p>
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
                <Progress value={100} className="h-2" />
                <p className="text-xs text-muted-foreground">Operational</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Courses Overview */}
        <div className="mb-8">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    Courses Overview
                  </CardTitle>
                  <CardDescription className="mt-1">Active courses and completion metrics</CardDescription>
                </div>
                <Button size="sm" variant="outline" data-testid="button-new-course">
                  + New Course
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingCourses ? (
                <p className="text-muted-foreground">Loading courses...</p>
              ) : (
                <div className="space-y-3">
                  {Array.isArray(coursesAnalytics) && coursesAnalytics.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {coursesAnalytics.map((course: CourseAnalytics) => (
                        <div
                          key={course.id}
                          className="border rounded-lg p-4 hover-elevate cursor-pointer transition-all"
                          data-testid={`card-course-${course.id}`}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <h3 className="font-semibold text-sm">{course.name}</h3>
                            <Button size="icon" variant="ghost" className="h-8 w-8" data-testid={`button-course-menu-${course.id}`}>
                              <BarChart3 className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Weeks</p>
                              <p className="font-bold text-lg">{course.weekCount || 0}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Batches</p>
                              <p className="font-bold text-lg">{course.batchAssignments || 0}</p>
                            </div>
                          </div>
                          <Button className="w-full mt-3" size="sm" variant="outline" data-testid={`button-open-course-${course.id}`}>
                            Open Course Analytics
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-muted-foreground font-medium">No courses yet</p>
                      <p className="text-sm text-muted-foreground mt-1">Courses will appear here once they are created</p>
                      <Button size="sm" className="mt-4" data-testid="button-create-first-course">
                        Create First Course
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* People Overview */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              People Overview
            </CardTitle>
            <CardDescription className="mt-1">Trainers and teachers with activity metrics</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingUsers ? (
              <p className="text-muted-foreground">Loading people...</p>
            ) : (
              <Tabs defaultValue="trainers" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="trainers" data-testid="tab-trainers">
                    Trainers ({totalTrainers})
                  </TabsTrigger>
                  <TabsTrigger value="teachers" data-testid="tab-teachers">
                    Teachers ({totalTeachers})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="trainers" className="space-y-3 mt-4">
                  {Array.isArray(allUsers) && allUsers.filter((u: any) => u.role === "trainer").length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {allUsers
                        .filter((u: any) => u.role === "trainer")
                        .map((trainer: UserWithStats) => (
                          <button
                            key={trainer.id}
                            onClick={() => setSelectedUser(trainer)}
                            className="p-4 border rounded-lg hover-elevate text-left transition-all"
                            data-testid={`button-trainer-${trainer.id}`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="font-semibold text-sm">{trainer.email}</p>
                                <p className="text-xs text-muted-foreground mt-1">Trainer</p>
                              </div>
                              <Badge variant="outline" className="text-xs">{trainer.batchCount || 0} batches</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{trainer.courseCount || 0} courses assigned</p>
                          </button>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-muted-foreground font-medium">No trainers</p>
                      <p className="text-sm text-muted-foreground mt-1">Invite trainers to create and manage courses</p>
                      <Button size="sm" className="mt-4" data-testid="button-invite-trainer">
                        Invite Trainer
                      </Button>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="teachers" className="space-y-3 mt-4">
                  {Array.isArray(allUsers) && allUsers.filter((u: any) => u.role === "teacher").length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {allUsers
                        .filter((u: any) => u.role === "teacher")
                        .map((teacher: UserWithStats) => (
                          <button
                            key={teacher.id}
                            onClick={() => setSelectedUser(teacher)}
                            className="p-4 border rounded-lg hover-elevate text-left transition-all"
                            data-testid={`button-teacher-${teacher.id}`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="font-semibold text-sm">{teacher.email}</p>
                                <p className="text-xs text-muted-foreground mt-1">Teacher</p>
                              </div>
                              <Badge variant="outline" className="text-xs">{teacher.courseCount || 0} courses</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">ID: {teacher.id.slice(0, 8)}...</p>
                          </button>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-muted-foreground font-medium">No teachers</p>
                      <p className="text-sm text-muted-foreground mt-1">Teachers will appear here once they are approved</p>
                      <Button size="sm" className="mt-4" data-testid="button-invite-teacher">
                        Invite Teacher
                      </Button>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>

      {/* User Profile Modal */}
      <Dialog open={selectedUser !== null} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex justify-between items-start">
              <DialogTitle>User Profile</DialogTitle>
              <button onClick={() => setSelectedUser(null)} className="text-muted-foreground hover:text-foreground" data-testid="button-close-modal">
                <X className="w-4 h-4" />
              </button>
            </div>
          </DialogHeader>
          <DialogDescription>View user details and activity</DialogDescription>

          {selectedUser && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Email</p>
                <p className="font-semibold">{selectedUser.email}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Role</p>
                  <p className="font-semibold capitalize">{selectedUser.role}</p>
                </div>
                {selectedUser.role === "trainer" && (
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Batches</p>
                    <p className="font-semibold">{selectedUser.batchCount || 0}</p>
                  </div>
                )}
                {selectedUser.role === "teacher" && (
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Courses</p>
                    <p className="font-semibold">{selectedUser.courseCount || 0}</p>
                  </div>
                )}
              </div>

              <Button
                onClick={() => setViewingActivityUserId(selectedUser.id)}
                className="w-full"
                data-testid={`button-view-activity-${selectedUser.id}`}
              >
                View Activity
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* User Activity Modal */}
      <Dialog open={viewingActivityUserId !== null} onOpenChange={(open) => !open && setViewingActivityUserId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>User Activity</DialogTitle>
          </DialogHeader>
          <DialogDescription>Track user progress and performance</DialogDescription>

          {selectedUser && viewingActivityUserId && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-2">Progress</p>
                <Progress value={(userActivityStats as any)?.progressPercentage || 0} className="h-2 mb-2" />
                <p className="text-sm font-semibold">{(userActivityStats as any)?.progressPercentage || 0}% Complete</p>
              </div>

              {selectedUser.role === "teacher" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Quizzes Attempted</p>
                    <p className="text-lg font-bold">{(userActivityStats as any)?.totalQuizzes || 0}</p>
                  </div>
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Quizzes Passed</p>
                    <p className="text-lg font-bold">{(userActivityStats as any)?.totalPassed || 0}</p>
                  </div>
                  <div className="p-3 bg-muted/30 rounded-lg col-span-2">
                    <p className="text-xs text-muted-foreground mb-1">Courses Completed</p>
                    <p className="text-lg font-bold">{(userActivityStats as any)?.totalCompleted || 0} / {(userActivityStats as any)?.totalAssigned || 0}</p>
                  </div>
                </div>
              )}

              {selectedUser.role === "trainer" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Courses Created</p>
                    <p className="text-lg font-bold">{(userActivityStats as any)?.totalCourses || 0}</p>
                  </div>
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Quizzes Generated</p>
                    <p className="text-lg font-bold">{(userActivityStats as any)?.totalQuizzes || 0}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Manage Trainers Modal */}
      <Dialog open={showManageTrainers} onOpenChange={setShowManageTrainers}>
        <DialogContent className="max-w-2xl max-h-96 overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Trainers</DialogTitle>
          </DialogHeader>
          <DialogDescription>Restrict, unrestrict, or remove trainers from the system</DialogDescription>

          <div className="space-y-2">
            {Array.isArray(allUsers) && allUsers.filter((u: any) => u.role === "trainer").length > 0 ? (
              allUsers
                .filter((u: any) => u.role === "trainer")
                .map((trainer: UserWithStats) => (
                  <div
                    key={trainer.id}
                    className="p-3 border rounded-lg flex justify-between items-center"
                    data-testid={`item-trainer-${trainer.id}`}
                  >
                    <div>
                      <p className="font-semibold text-sm">{trainer.email}</p>
                      <p className="text-xs text-muted-foreground">{trainer.batchCount || 0} batches</p>
                    </div>
                    <div className="flex gap-2">
                      {trainer.approvalStatus === "restricted" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setUserToManage(trainer);
                            setActionType("unrestrict");
                            setShowConfirmRestrict(true);
                          }}
                          data-testid={`button-unrestrict-trainer-${trainer.id}`}
                          disabled={unrestrictTrainerMutation.isPending}
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Unrestrict
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setUserToManage(trainer);
                            setActionType("restrict");
                            setShowConfirmRestrict(true);
                          }}
                          data-testid={`button-restrict-trainer-${trainer.id}`}
                          disabled={restrictTrainerMutation.isPending}
                        >
                          <Ban className="w-3 h-3 mr-1" />
                          Restrict
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setUserToManage(trainer);
                          setActionType("delete");
                          setShowConfirmDelete(true);
                        }}
                        data-testid={`button-delete-trainer-${trainer.id}`}
                        disabled={dismissTrainerMutation.isPending}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))
            ) : (
              <p className="text-muted-foreground text-center py-4">No trainers to manage</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Teachers Modal */}
      <Dialog open={showManageTeachers} onOpenChange={setShowManageTeachers}>
        <DialogContent className="max-w-2xl max-h-96 overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Teachers</DialogTitle>
          </DialogHeader>
          <DialogDescription>Restrict, unrestrict, or remove teachers from the system</DialogDescription>

          <div className="space-y-2">
            {Array.isArray(allUsers) && allUsers.filter((u: any) => u.role === "teacher").length > 0 ? (
              allUsers
                .filter((u: any) => u.role === "teacher")
                .map((teacher: UserWithStats) => (
                  <div
                    key={teacher.id}
                    className="p-3 border rounded-lg flex justify-between items-center"
                    data-testid={`item-teacher-${teacher.id}`}
                  >
                    <div>
                      <p className="font-semibold text-sm">{teacher.email}</p>
                      <p className="text-xs text-muted-foreground">{teacher.courseCount || 0} courses</p>
                    </div>
                    <div className="flex gap-2">
                      {teacher.approvalStatus === "restricted" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setUserToManage(teacher);
                            setActionType("unrestrict");
                            setShowConfirmRestrict(true);
                          }}
                          data-testid={`button-unrestrict-teacher-${teacher.id}`}
                          disabled={unrestrictTeacherMutation.isPending}
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Unrestrict
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setUserToManage(teacher);
                            setActionType("restrict");
                            setShowConfirmRestrict(true);
                          }}
                          data-testid={`button-restrict-teacher-${teacher.id}`}
                          disabled={restrictTeacherMutation.isPending}
                        >
                          <Ban className="w-3 h-3 mr-1" />
                          Restrict
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setUserToManage(teacher);
                          setActionType("delete");
                          setShowConfirmDelete(true);
                        }}
                        data-testid={`button-delete-teacher-${teacher.id}`}
                        disabled={dismissTeacherMutation.isPending}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))
            ) : (
              <p className="text-muted-foreground text-center py-4">No teachers to manage</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Modal */}
      <Dialog open={showConfirmDelete} onOpenChange={setShowConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove User?</DialogTitle>
          </DialogHeader>
          <DialogDescription>This action cannot be undone</DialogDescription>

          {userToManage && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to remove <strong>{userToManage.email}</strong>? This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowConfirmDelete(false)} data-testid="button-cancel-delete">
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    if (userToManage.role === "trainer") {
                      dismissTrainerMutation.mutate(userToManage.id);
                    } else if (userToManage.role === "teacher") {
                      dismissTeacherMutation.mutate(userToManage.id);
                    }
                    setShowConfirmDelete(false);
                  }}
                  data-testid="button-confirm-delete"
                  disabled={dismissTrainerMutation.isPending || dismissTeacherMutation.isPending}
                >
                  {dismissTrainerMutation.isPending || dismissTeacherMutation.isPending ? "Removing..." : "Remove"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Restrict/Unrestrict Modal */}
      <Dialog open={showConfirmRestrict} onOpenChange={setShowConfirmRestrict}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{actionType === "unrestrict" ? "Unrestrict User?" : "Restrict User?"}</DialogTitle>
          </DialogHeader>
          <DialogDescription>Please confirm this action</DialogDescription>

          {userToManage && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {actionType === "unrestrict"
                  ? `Are you sure you want to unrestrict ${userToManage.email}? They will be able to access the system again.`
                  : `Are you sure you want to restrict ${userToManage.email}? They will be unable to access the system.`}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowConfirmRestrict(false)} data-testid="button-cancel-restrict">
                  Cancel
                </Button>
                <Button
                  variant={actionType === "unrestrict" ? "default" : "secondary"}
                  className="flex-1"
                  onClick={() => {
                    if (actionType === "restrict") {
                      if (userToManage.role === "trainer") {
                        restrictTrainerMutation.mutate(userToManage.id);
                      } else if (userToManage.role === "teacher") {
                        restrictTeacherMutation.mutate(userToManage.id);
                      }
                    } else if (actionType === "unrestrict") {
                      if (userToManage.role === "trainer") {
                        unrestrictTrainerMutation.mutate(userToManage.id);
                      } else if (userToManage.role === "teacher") {
                        unrestrictTeacherMutation.mutate(userToManage.id);
                      }
                    }
                    setShowConfirmRestrict(false);
                  }}
                  data-testid="button-confirm-restrict"
                  disabled={restrictTrainerMutation.isPending || restrictTeacherMutation.isPending || unrestrictTrainerMutation.isPending || unrestrictTeacherMutation.isPending}
                >
                  {restrictTrainerMutation.isPending || restrictTeacherMutation.isPending || unrestrictTrainerMutation.isPending || unrestrictTeacherMutation.isPending
                    ? actionType === "unrestrict"
                      ? "Unrestricting..."
                      : "Restricting..."
                    : actionType === "unrestrict"
                      ? "Unrestrict"
                      : "Restrict"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
