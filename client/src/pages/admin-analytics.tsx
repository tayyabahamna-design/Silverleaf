import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Users, BookOpen, BarChart3, ChevronDown, ChevronUp } from "lucide-react";

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

export default function AdminAnalytics() {
  const [, navigate] = useLocation();
  const { user, isAdmin } = useAuth();
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);

  const { data: batchesAnalytics = [], isLoading: loadingBatches } = useQuery({
    queryKey: ["/api/admin/analytics/batches"],
    enabled: isAdmin,
  });

  // Query for expanded batch details with teacher/trainer activities
  const { data: expandedBatchDetails } = useQuery({
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
                    <div className="text-2xl font-bold">{trainersAnalytics.batchCount || 0}</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">Courses Assigned</div>
                    <div className="text-2xl font-bold">{trainersAnalytics.courseAssignmentCount || 0}</div>
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
                                  Teachers ({expandedBatchDetails.teacherCount || 0})
                                </h4>
                                {expandedBatchDetails.teacherCount > 0 ? (
                                  <div className="space-y-1 pl-6">
                                    {Array.isArray(expandedBatchDetails.courses) && expandedBatchDetails.courses.length > 0 ? (
                                      expandedBatchDetails.courses.map((course: any, idx: number) => (
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
                                  Courses ({expandedBatchDetails.courseCount || 0})
                                </h4>
                                {expandedBatchDetails.courseCount > 0 && Array.isArray(expandedBatchDetails.courses) ? (
                                  <div className="space-y-1 pl-6">
                                    {expandedBatchDetails.courses.map((course: any, idx: number) => (
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
        </div>
      </div>
    </div>
  );
}
