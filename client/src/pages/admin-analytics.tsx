import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Users, BookOpen, BarChart3, ChevronDown, ChevronUp, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

interface ExpandedBatchDetails {
  batch?: { id: string; name: string };
  teacherCount: number;
  courseCount: number;
  courses: any[];
}

interface UserWithStats {
  id: string;
  email: string;
  role: string;
  name?: string;
  createdAt?: string;
  batchCount?: number;
  courseCount?: number;
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

export default function AdminAnalytics() {
  const [, navigate] = useLocation();
  const { user, isAdmin } = useAuth();
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserWithStats | null>(null);
  const [viewingActivityUserId, setViewingActivityUserId] = useState<string | null>(null);

  const { data: batchesAnalytics = [], isLoading: loadingBatches } = useQuery({
    queryKey: ["/api/admin/analytics/batches"],
    enabled: isAdmin,
  });

  // Query for expanded batch details with teacher/trainer activities
  const { data: expandedBatchDetails = null } = useQuery<ExpandedBatchDetails | null>({
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

  // Fetch all users for people overview (simple mock - extend with real endpoint)
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

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Button onClick={() => navigate("/")} variant="outline" className="mb-8">
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

  return (
    <div className="min-h-screen bg-background p-8">
      <Button onClick={() => navigate("/")} variant="outline" className="mb-8">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back
      </Button>

      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8" data-testid="text-analytics-title">Admin Analytics Dashboard</h1>

        <div className="grid grid-cols-1 gap-6">
          {/* Batches Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Batches Overview
              </CardTitle>
              <CardDescription>All batches with teacher and course counts</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingBatches ? (
                <p>Loading...</p>
              ) : (
                <div className="space-y-4">
                  {Array.isArray(batchesAnalytics) && batchesAnalytics.length > 0 ? (
                    batchesAnalytics.map((batch: any) => (
                      <div key={batch.id}>
                        <button
                          onClick={() => setExpandedBatchId(expandedBatchId === batch.id ? null : batch.id)}
                          className="w-full p-4 border rounded-lg hover-elevate text-left"
                          data-testid={`button-batch-expand-${batch.id}`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex items-start gap-2 flex-1">
                              {expandedBatchId === batch.id ? (
                                <ChevronUp className="w-5 h-5 mt-0.5 flex-shrink-0" />
                              ) : (
                                <ChevronDown className="w-5 h-5 mt-0.5 flex-shrink-0" />
                              )}
                              <div>
                                <h3 className="font-semibold">{batch.name}</h3>
                                <p className="text-sm text-muted-foreground">{batch.description}</p>
                              </div>
                            </div>
                            <div className="flex gap-8 flex-shrink-0">
                              <div className="text-right">
                                <div className="text-sm text-muted-foreground">Teachers</div>
                                <div className="text-xl font-bold">{batch.teacherCount || 0}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm text-muted-foreground">Courses</div>
                                <div className="text-xl font-bold">{batch.courseCount || 0}</div>
                              </div>
                            </div>
                          </div>
                        </button>
                        
                        {/* Expanded content showing individual activities */}
                        {expandedBatchId === batch.id && expandedBatchDetails && (
                          <div className="mt-3 ml-6 p-4 bg-muted/30 rounded-lg border-l-2 border-accent" data-testid={`section-batch-activities-${batch.id}`}>
                            <div className="space-y-4">
                              {/* Teachers in batch */}
                              <div>
                                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                                  <Users className="w-4 h-4" />
                                  Teachers ({(expandedBatchDetails as ExpandedBatchDetails)?.teacherCount || 0})
                                </h4>
                                {(expandedBatchDetails as ExpandedBatchDetails)?.teacherCount > 0 ? (
                                  <div className="space-y-1 pl-6">
                                    {Array.isArray((expandedBatchDetails as ExpandedBatchDetails)?.courses) && (expandedBatchDetails as ExpandedBatchDetails)?.courses.length > 0 ? (
                                      (expandedBatchDetails as ExpandedBatchDetails)?.courses.map((course: any, idx: number) => (
                                        <p key={idx} className="text-xs text-muted-foreground">
                                          • {course.name}
                                        </p>
                                      ))
                                    ) : (
                                      <p className="text-xs text-muted-foreground">No teacher activities</p>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted-foreground pl-6">No teachers assigned</p>
                                )}
                              </div>

                              {/* Courses in batch */}
                              <div>
                                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                                  <BookOpen className="w-4 h-4" />
                                  Courses ({(expandedBatchDetails as ExpandedBatchDetails)?.courseCount || 0})
                                </h4>
                                {(expandedBatchDetails as ExpandedBatchDetails)?.courseCount > 0 && Array.isArray((expandedBatchDetails as ExpandedBatchDetails)?.courses) ? (
                                  <div className="space-y-1 pl-6">
                                    {(expandedBatchDetails as ExpandedBatchDetails)?.courses.map((course: any, idx: number) => (
                                      <p key={idx} className="text-xs text-muted-foreground">
                                        • {course.name}
                                      </p>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted-foreground pl-6">No courses assigned</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">No batches yet</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Courses Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Courses Overview
              </CardTitle>
              <CardDescription>All courses with week and assignment counts</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingCourses ? (
                <p>Loading...</p>
              ) : (
                <div className="space-y-4">
                  {Array.isArray(coursesAnalytics) && coursesAnalytics.length > 0 ? (
                    coursesAnalytics.map((course: CourseAnalytics) => (
                      <div key={course.id} className="p-4 border rounded-lg hover-elevate">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold">{course.name}</h3>
                          </div>
                          <div className="flex gap-8">
                            <div className="text-right">
                              <div className="text-sm text-muted-foreground">Weeks</div>
                              <div className="text-xl font-bold">{course.weekCount || 0}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-muted-foreground">Batch Assignments</div>
                              <div className="text-xl font-bold">{course.batchAssignments || 0}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">No courses yet</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* People Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                People Overview
              </CardTitle>
              <CardDescription>Trainers and Teachers with activity stats</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingUsers ? (
                <p>Loading...</p>
              ) : (
                <Tabs defaultValue="trainers" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="trainers">Trainers</TabsTrigger>
                    <TabsTrigger value="teachers">Teachers</TabsTrigger>
                  </TabsList>

                  <TabsContent value="trainers" className="space-y-3 mt-4">
                    {Array.isArray(allUsers) && allUsers.filter((u: any) => u.role === "trainer").length > 0 ? (
                      allUsers
                        .filter((u: any) => u.role === "trainer")
                        .map((trainer: UserWithStats) => (
                          <button
                            key={trainer.id}
                            onClick={() => setSelectedUser(trainer)}
                            className="w-full p-4 border rounded-lg hover-elevate text-left flex justify-between items-center"
                            data-testid={`button-trainer-${trainer.id}`}
                          >
                            <div>
                              <p className="font-semibold">{trainer.email}</p>
                              <p className="text-xs text-muted-foreground">Trainer</p>
                            </div>
                            <div className="text-right text-sm">
                              <p className="text-muted-foreground">{trainer.batchCount || 0} batches</p>
                            </div>
                          </button>
                        ))
                    ) : (
                      <p className="text-muted-foreground">No trainers</p>
                    )}
                  </TabsContent>

                  <TabsContent value="teachers" className="space-y-3 mt-4">
                    {Array.isArray(allUsers) && allUsers.filter((u: any) => u.role === "teacher").length > 0 ? (
                      allUsers
                        .filter((u: any) => u.role === "teacher")
                        .map((teacher: UserWithStats) => (
                          <button
                            key={teacher.id}
                            onClick={() => setSelectedUser(teacher)}
                            className="w-full p-4 border rounded-lg hover-elevate text-left flex justify-between items-center"
                            data-testid={`button-teacher-${teacher.id}`}
                          >
                            <div>
                              <p className="font-semibold">{teacher.email}</p>
                              <p className="text-xs text-muted-foreground">Teacher</p>
                            </div>
                            <div className="text-right text-sm">
                              <p className="text-muted-foreground">{teacher.courseCount || 0} courses</p>
                            </div>
                          </button>
                        ))
                    ) : (
                      <p className="text-muted-foreground">No teachers</p>
                    )}
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* User Profile Modal */}
      <Dialog open={selectedUser !== null} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex justify-between items-start">
              <DialogTitle>User Profile</DialogTitle>
              <button onClick={() => setSelectedUser(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-semibold">{selectedUser.email}</p>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Role</p>
                <p className="font-semibold capitalize">{selectedUser.role}</p>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">ID</p>
                <p className="text-xs font-mono text-muted-foreground break-all">{selectedUser.id}</p>
              </div>

              {selectedUser.role === "trainer" && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Batches Created</p>
                  <p className="font-semibold">{selectedUser.batchCount || 0}</p>
                </div>
              )}

              {selectedUser.role === "teacher" && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Courses Assigned</p>
                  <p className="font-semibold">{selectedUser.courseCount || 0}</p>
                </div>
              )}

              <Button
                onClick={() => setViewingActivityUserId(selectedUser.id)}
                className="w-full mt-4"
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

          {selectedUser && viewingActivityUserId && (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Progress</p>
                <Progress value={(userActivityStats as any)?.progressPercentage || 0} className="h-2" />
                <p className="text-sm font-semibold">{(userActivityStats as any)?.progressPercentage || 0}% Complete</p>
              </div>

              {selectedUser.role === "teacher" && (
                <div className="space-y-3">
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Quizzes Attempted</p>
                    <p className="text-lg font-bold">{(userActivityStats as any)?.totalQuizzes || 0}</p>
                  </div>
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Quizzes Passed</p>
                    <p className="text-lg font-bold">{(userActivityStats as any)?.totalPassed || 0}</p>
                  </div>
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Courses Completed</p>
                    <p className="text-lg font-bold">{(userActivityStats as any)?.totalCompleted || 0} / {(userActivityStats as any)?.totalAssigned || 0}</p>
                  </div>
                </div>
              )}

              {selectedUser.role === "trainer" && (
                <div className="space-y-3">
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
    </div>
  );
}
