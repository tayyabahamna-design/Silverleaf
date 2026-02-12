import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Users, BookOpen, BarChart3, ChevronDown, ChevronUp, X, TrendingUp, AlertCircle, CheckCircle, Clock, Trash2, Ban, UserPlus, GraduationCap, MapPin, Briefcase, Activity } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer, Legend, Tooltip } from "recharts";

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

// Chart color palette
const CHART_COLORS = [
  "hsl(221, 83%, 53%)",  // blue
  "hsl(262, 83%, 58%)",  // purple
  "hsl(142, 71%, 45%)",  // green
  "hsl(38, 92%, 50%)",   // amber
  "hsl(0, 84%, 60%)",    // red
  "hsl(199, 89%, 48%)",  // cyan
  "hsl(330, 81%, 60%)",  // pink
  "hsl(25, 95%, 53%)",   // orange
];

// KPI Card Component
function KPICard({ label, value, icon: Icon, subtitle, color = "primary" }: { label: string; value: string | number; icon: any; subtitle?: string; color?: string }) {
  return (
    <Card className="hover-elevate transition-all">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-lg bg-${color}/10`}>
            <Icon className={`w-5 h-5 text-${color}`} />
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground font-medium">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// Traffic Light Badge
function TrafficLightBadge({ status }: { status: string }) {
  if (status === "green") {
    return <Badge className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> On Track</Badge>;
  }
  if (status === "yellow") {
    return <Badge className="bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Moderate</Badge>;
  }
  return <Badge className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> At Risk</Badge>;
}

// Batch Status Badge (existing)
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
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState<"admin" | "trainer" | "teacher">("teacher");
  const [showCreateBatch, setShowCreateBatch] = useState(false);
  const [newBatchName, setNewBatchName] = useState("");
  const [newBatchDescription, setNewBatchDescription] = useState("");
  const [batchToDelete, setBatchToDelete] = useState<string | null>(null);
  const [showDeleteBatchConfirm, setShowDeleteBatchConfirm] = useState(false);
  const [managingBatchTeachers, setManagingBatchTeachers] = useState<string | null>(null);
  const [teacherIdToAdd, setTeacherIdToAdd] = useState("");

  // Existing data queries
  const { data: batchesAnalytics = [], isLoading: loadingBatches } = useQuery({
    queryKey: ["/api/admin/analytics/batches"],
    enabled: isAdmin,
  });

  const { data: expandedBatchDetails = null as any } = useQuery({
    queryKey: ["/api/admin/analytics/batches", expandedBatchId],
    enabled: isAdmin && expandedBatchId !== null,
  });

  const { data: batchWithTeachers = null as any } = useQuery({
    queryKey: ["/api/batches", managingBatchTeachers],
    enabled: isAdmin && managingBatchTeachers !== null,
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

  // New analytics queries
  const { data: pipelineData, isLoading: loadingPipeline } = useQuery({
    queryKey: ["/api/admin/analytics/pipeline"],
    enabled: isAdmin,
    queryFn: async () => {
      const response = await fetch("/api/admin/analytics/pipeline");
      if (!response.ok) return null;
      return await response.json();
    },
  });

  const { data: demographicsData, isLoading: loadingDemographics } = useQuery({
    queryKey: ["/api/admin/analytics/demographics"],
    enabled: isAdmin,
    queryFn: async () => {
      const response = await fetch("/api/admin/analytics/demographics");
      if (!response.ok) return null;
      return await response.json();
    },
  });

  const { data: cohortsData, isLoading: loadingCohorts } = useQuery({
    queryKey: ["/api/admin/analytics/cohorts"],
    enabled: isAdmin,
    queryFn: async () => {
      const response = await fetch("/api/admin/analytics/cohorts");
      if (!response.ok) return [];
      return await response.json();
    },
  });

  const { data: performanceData, isLoading: loadingPerformance } = useQuery({
    queryKey: ["/api/admin/analytics/performance"],
    enabled: isAdmin,
    queryFn: async () => {
      const response = await fetch("/api/admin/analytics/performance");
      if (!response.ok) return null;
      return await response.json();
    },
  });

  const { data: completionTrends, isLoading: loadingTrends } = useQuery({
    queryKey: ["/api/admin/analytics/completion-trends"],
    enabled: isAdmin,
    queryFn: async () => {
      const response = await fetch("/api/admin/analytics/completion-trends");
      if (!response.ok) return [];
      return await response.json();
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

  // Mutation for creating new users
  const createUserMutation = useMutation({
    mutationFn: async (userData: { email: string; password: string; name: string; role: string }) =>
      apiRequest("POST", "/api/admin/users/create", userData),
    onSuccess: (data: any) => {
      toast({ title: "Success", description: data.message || "User created successfully." });
      setShowAddUser(false);
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserName("");
      setNewUserRole("teacher");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users/all"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create user.",
        variant: "destructive"
      });
    },
  });

  // Mutation for creating batches
  const createBatchMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const response = await apiRequest("POST", "/api/batches", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Batch created successfully." });
      setShowCreateBatch(false);
      setNewBatchName("");
      setNewBatchDescription("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics/batches"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create batch.", variant: "destructive" });
    },
  });

  // Mutation for deleting batches
  const deleteBatchMutation = useMutation({
    mutationFn: async (batchId: string) => {
      const response = await apiRequest("DELETE", `/api/batches/${batchId}`);
      return response;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Batch deleted successfully." });
      setShowDeleteBatchConfirm(false);
      setBatchToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics/batches"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete batch.", variant: "destructive" });
    },
  });

  // Mutation for adding teacher to batch
  const addTeacherToBatchMutation = useMutation({
    mutationFn: async ({ batchId, teacherId }: { batchId: string; teacherId: string }) => {
      const response = await apiRequest("POST", `/api/batches/${batchId}/teachers`, { teacherId });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Teacher added to batch successfully." });
      setTeacherIdToAdd("");
      queryClient.invalidateQueries({ queryKey: ["/api/batches", managingBatchTeachers] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics/batches"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add teacher to batch.", variant: "destructive" });
    },
  });

  // Mutation for removing teacher from batch
  const removeTeacherFromBatchMutation = useMutation({
    mutationFn: async ({ batchId, teacherId }: { batchId: string; teacherId: string }) => {
      const response = await apiRequest("DELETE", `/api/batches/${batchId}/teachers/${teacherId}`);
      return response;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Teacher removed from batch successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/batches", managingBatchTeachers] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics/batches"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to remove teacher from batch.", variant: "destructive" });
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

  // Chart configs
  const genderChartConfig: ChartConfig = {
    male: { label: "Male", color: CHART_COLORS[0] },
    female: { label: "Female", color: CHART_COLORS[2] },
    other: { label: "Other", color: CHART_COLORS[3] },
    prefer_not_to_say: { label: "Not Specified", color: CHART_COLORS[4] },
  };

  const completionChartConfig: ChartConfig = {
    completionRate: { label: "Completion Rate", color: CHART_COLORS[0] },
  };

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
        {/* Main Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-8">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <BarChart3 className="w-4 h-4 mr-2 hidden sm:inline" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="cohorts" data-testid="tab-cohorts">
              <Users className="w-4 h-4 mr-2 hidden sm:inline" />
              Cohorts
            </TabsTrigger>
            <TabsTrigger value="demographics" data-testid="tab-demographics">
              <MapPin className="w-4 h-4 mr-2 hidden sm:inline" />
              Demographics
            </TabsTrigger>
            <TabsTrigger value="performance" data-testid="tab-performance">
              <Activity className="w-4 h-4 mr-2 hidden sm:inline" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="people" data-testid="tab-people">
              <Users className="w-4 h-4 mr-2 hidden sm:inline" />
              People
            </TabsTrigger>
          </TabsList>

          {/* ===== TAB 1: OVERVIEW ===== */}
          <TabsContent value="overview">
            {/* Pipeline KPIs */}
            <div className="mb-8">
              <div className="mb-6">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Pipeline Overview
                </h2>
                <p className="text-sm text-muted-foreground mt-1">Key metrics at a glance</p>
              </div>

              {loadingPipeline ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {[...Array(5)].map((_, i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="pt-6 h-28" />
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <KPICard
                    label="Total Candidates"
                    value={pipelineData?.totalCandidates ?? 0}
                    icon={Users}
                    color="blue"
                    subtitle="Enrolled teachers"
                  />
                  <KPICard
                    label="Gender Split"
                    value={pipelineData?.genderDistribution
                      ? `${pipelineData.genderDistribution.female || 0}F / ${pipelineData.genderDistribution.male || 0}M`
                      : "N/A"
                    }
                    icon={Users}
                    color="purple"
                    subtitle="Female / Male"
                  />
                  <KPICard
                    label="Participation Rate"
                    value={`${pipelineData?.participationRate ?? 0}%`}
                    icon={TrendingUp}
                    color="green"
                    subtitle="Active in last 30 days"
                  />
                  <KPICard
                    label="Graduation Rate"
                    value={`${pipelineData?.graduationRate ?? 0}%`}
                    icon={GraduationCap}
                    color="amber"
                    subtitle="Completed all courses"
                  />
                  <KPICard
                    label="At Risk"
                    value={pipelineData?.atRiskCount ?? 0}
                    icon={AlertCircle}
                    color="red"
                    subtitle="Below 30% completion"
                  />
                </div>
              )}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Gender Distribution Bar Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Gender Distribution</CardTitle>
                  <CardDescription>Breakdown of candidates by gender</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingPipeline || !pipelineData?.genderDistribution ? (
                    <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                      {loadingPipeline ? "Loading..." : "No demographic data available yet"}
                    </div>
                  ) : (() => {
                    const genderArray = Object.entries(pipelineData.genderDistribution)
                      .filter(([key]) => key !== "notSpecified")
                      .map(([gender, count]) => ({ gender, count: Number(count) }));
                    return genderArray.length === 0 || genderArray.every(g => g.count === 0) ? (
                      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                        No demographic data available yet
                      </div>
                    ) : (
                      <ChartContainer config={genderChartConfig} className="h-[250px] w-full">
                        <BarChart data={genderArray.map((g) => ({
                          ...g,
                          fill: genderChartConfig[g.gender as keyof typeof genderChartConfig]?.color || CHART_COLORS[5],
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="gender" tickFormatter={(val) => {
                            const labels: Record<string, string> = { male: "Male", female: "Female", other: "Other" };
                            return labels[val] || val;
                          }} />
                          <YAxis allowDecimals={false} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                            {genderArray.map((entry, index) => (
                              <Cell key={index} fill={genderChartConfig[entry.gender as keyof typeof genderChartConfig]?.color || CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ChartContainer>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Completion Trend Line Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Completion Trends</CardTitle>
                  <CardDescription>Monthly completion rate over time</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingTrends || !Array.isArray(completionTrends) || !completionTrends.length ? (
                    <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                      {loadingTrends ? "Loading..." : "No trend data available yet"}
                    </div>
                  ) : (
                    <ChartContainer config={completionChartConfig} className="h-[250px] w-full">
                      <LineChart data={completionTrends}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Line
                          type="monotone"
                          dataKey="completionRate"
                          stroke={CHART_COLORS[0]}
                          strokeWidth={2}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Courses Overview (from original) */}
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
                </div>
              </CardHeader>
              <CardContent>
                {loadingCourses ? (
                  <p className="text-muted-foreground">Loading courses...</p>
                ) : (
                  <div className="space-y-3">
                    {Array.isArray(coursesAnalytics) && coursesAnalytics.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {coursesAnalytics.map((course: CourseAnalytics) => (
                          <div
                            key={course.id}
                            className="border rounded-lg p-4 hover-elevate cursor-pointer transition-all"
                            data-testid={`card-course-${course.id}`}
                          >
                            <h3 className="font-semibold text-sm mb-3">{course.name}</h3>
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
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-muted-foreground font-medium">No courses yet</p>
                        <p className="text-sm text-muted-foreground mt-1">Courses will appear here once they are created</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== TAB 2: COHORTS ===== */}
          <TabsContent value="cohorts">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Cohort Tracking
                </h2>
                <p className="text-sm text-muted-foreground mt-1">Batch-level enrollment, completion, and graduation metrics</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowCreateBatch(true)} data-testid="button-new-batch">
                + New Batch
              </Button>
            </div>

            {/* Cohort Analytics Table */}
            <Card className="mb-8">
              <CardContent className="pt-6">
                {loadingCohorts ? (
                  <p className="text-muted-foreground">Loading cohort data...</p>
                ) : Array.isArray(cohortsData) && cohortsData.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Batch</TableHead>
                          <TableHead className="text-center">Enrolled</TableHead>
                          <TableHead className="text-center">Completion %</TableHead>
                          <TableHead className="text-center">Graduation Rate</TableHead>
                          <TableHead className="text-center">Avg Quiz Score</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cohortsData.map((cohort: any) => (
                          <TableRow key={cohort.batchId}>
                            <TableCell className="font-medium">{cohort.batchName}</TableCell>
                            <TableCell className="text-center">{cohort.enrollment}</TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center gap-2 justify-center">
                                <Progress value={cohort.completionPercentage} className="h-2 w-16" />
                                <span className="text-sm">{cohort.completionPercentage}%</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">{cohort.graduationRate}%</TableCell>
                            <TableCell className="text-center">{cohort.avgQuizScore}%</TableCell>
                            <TableCell className="text-center">
                              <TrafficLightBadge status={cohort.status} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground font-medium">No cohort data available</p>
                    <p className="text-sm text-muted-foreground mt-1">Create batches and assign teachers to see cohort analytics</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Batch Management (from original) */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Batch Management
                    </CardTitle>
                    <CardDescription className="mt-1">Create, expand, and manage batches</CardDescription>
                  </div>
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
                              <div className="flex gap-2">
                                <Button
                                  className="flex-1"
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setManagingBatchTeachers(batch.id);
                                  }}
                                  data-testid={`button-manage-batch-teachers-${batch.id}`}
                                >
                                  <Users className="w-4 h-4 mr-2" />
                                  Manage Teachers
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setBatchToDelete(batch.id);
                                    setShowDeleteBatchConfirm(true);
                                  }}
                                  data-testid={`button-delete-batch-${batch.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-muted-foreground font-medium">No batches yet</p>
                        <p className="text-sm text-muted-foreground mt-1">Create a batch to group teachers and assign courses</p>
                        <Button size="sm" className="mt-4" onClick={() => setShowCreateBatch(true)} data-testid="button-create-first-batch">
                          Create First Batch
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== TAB 3: DEMOGRAPHICS ===== */}
          <TabsContent value="demographics">
            <div className="mb-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Demographics & Diversity
              </h2>
              <p className="text-sm text-muted-foreground mt-1">Candidate demographics and diversity breakdown</p>
            </div>

            {loadingDemographics ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[...Array(4)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="pt-6 h-72" />
                  </Card>
                ))}
              </div>
            ) : !demographicsData ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <MapPin className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground font-medium">No demographic data available</p>
                  <p className="text-sm text-muted-foreground mt-1">Demographics will appear as teachers fill in their profile information</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Gender Pie Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Gender Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {demographicsData.gender?.length > 0 ? (
                      <ChartContainer config={genderChartConfig} className="h-[250px] w-full">
                        <PieChart>
                          <Pie
                            data={demographicsData.gender.map((g: any) => ({
                              ...g,
                              name: g.gender || "Not Specified",
                            }))}
                            dataKey="count"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={({ name, count }: any) => `${name}: ${count}`}
                          >
                            {demographicsData.gender.map((_: any, index: number) => (
                              <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <ChartTooltip content={<ChartTooltipContent />} />
                        </PieChart>
                      </ChartContainer>
                    ) : (
                      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No data yet</div>
                    )}
                  </CardContent>
                </Card>

                {/* Geographic Bar Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Geographic Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {demographicsData.geographic?.length > 0 ? (
                      <ChartContainer config={{ count: { label: "Candidates", color: CHART_COLORS[1] } }} className="h-[250px] w-full">
                        <BarChart data={demographicsData.geographic} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" allowDecimals={false} />
                          <YAxis dataKey="location" type="category" width={100} tick={{ fontSize: 12 }} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="count" fill={CHART_COLORS[1]} radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ChartContainer>
                    ) : (
                      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No location data yet</div>
                    )}
                  </CardContent>
                </Card>

                {/* Qualification Pie Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Qualification Levels</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {demographicsData.qualification?.length > 0 ? (
                      <ChartContainer config={{ count: { label: "Candidates", color: CHART_COLORS[2] } }} className="h-[250px] w-full">
                        <PieChart>
                          <Pie
                            data={demographicsData.qualification.map((q: any) => ({
                              ...q,
                              name: q.qualification || "Not Specified",
                            }))}
                            dataKey="count"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={({ name, count }: any) => `${name}: ${count}`}
                          >
                            {demographicsData.qualification.map((_: any, index: number) => (
                              <Cell key={index} fill={CHART_COLORS[(index + 2) % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <ChartTooltip content={<ChartTooltipContent />} />
                        </PieChart>
                      </ChartContainer>
                    ) : (
                      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No qualification data yet</div>
                    )}
                  </CardContent>
                </Card>

                {/* Employment Bar Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Employment Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {demographicsData.employment?.length > 0 ? (
                      <ChartContainer config={{ count: { label: "Candidates", color: CHART_COLORS[3] } }} className="h-[250px] w-full">
                        <BarChart data={demographicsData.employment.map((e: any) => ({
                          ...e,
                          status: e.employmentStatus || "Not Specified",
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="status" tick={{ fontSize: 11 }} />
                          <YAxis allowDecimals={false} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="count" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ChartContainer>
                    ) : (
                      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No employment data yet</div>
                    )}
                  </CardContent>
                </Card>

                {/* Experience Breakdown */}
                {demographicsData.experience?.length > 0 && (
                  <Card className="md:col-span-2">
                    <CardHeader>
                      <CardTitle className="text-base">Years of Experience</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer config={{ count: { label: "Candidates", color: CHART_COLORS[5] } }} className="h-[250px] w-full">
                        <BarChart data={demographicsData.experience}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="range" />
                          <YAxis allowDecimals={false} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="count" fill={CHART_COLORS[5]} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          {/* ===== TAB 4: PERFORMANCE ===== */}
          <TabsContent value="performance">
            <div className="mb-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Performance Analytics
              </h2>
              <p className="text-sm text-muted-foreground mt-1">Completion trends, at-risk identification, and batch comparison</p>
            </div>

            {loadingPerformance ? (
              <div className="space-y-6">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="pt-6 h-48" />
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                {/* Completion Rate Trends */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Completion Rate Trends</CardTitle>
                    <CardDescription>Monthly completion rates across all batches</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {performanceData?.completionTrends?.length > 0 ? (
                      <ChartContainer config={completionChartConfig} className="h-[300px] w-full">
                        <LineChart data={performanceData.completionTrends}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Line
                            type="monotone"
                            dataKey="completionRate"
                            stroke={CHART_COLORS[0]}
                            strokeWidth={2}
                            dot={{ r: 4 }}
                            activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      </ChartContainer>
                    ) : (
                      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No completion trend data yet</div>
                    )}
                  </CardContent>
                </Card>

                {/* At-Risk Fellows */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      At-Risk Fellows
                    </CardTitle>
                    <CardDescription>Candidates with less than 30% completion rate</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {performanceData?.atRiskFellows?.length > 0 ? (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Batch</TableHead>
                              <TableHead className="text-center">Completion</TableHead>
                              <TableHead className="text-center">Last Active</TableHead>
                              <TableHead className="text-center">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {performanceData.atRiskFellows.map((fellow: any) => (
                              <TableRow key={fellow.teacherId}>
                                <TableCell className="font-medium">{fellow.name || fellow.email}</TableCell>
                                <TableCell>{fellow.batchName || "Unassigned"}</TableCell>
                                <TableCell className="text-center">
                                  <div className="flex items-center gap-2 justify-center">
                                    <Progress value={fellow.completionPercentage} className="h-2 w-16" />
                                    <span className="text-sm">{fellow.completionPercentage}%</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center text-sm text-muted-foreground">
                                  {fellow.lastActive ? new Date(fellow.lastActive).toLocaleDateString() : "Never"}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant={fellow.status === "inactive" ? "destructive" : "secondary"} className="text-xs">
                                    {fellow.status}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <CheckCircle className="w-12 h-12 text-green-500/30 mx-auto mb-3" />
                        <p className="text-muted-foreground font-medium">No at-risk fellows</p>
                        <p className="text-sm text-muted-foreground mt-1">All candidates are making good progress</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Batch Comparison */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Batch Comparison</CardTitle>
                    <CardDescription>Average completion rates across batches</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {performanceData?.batchComparison?.length > 0 ? (
                      <ChartContainer config={{ avgCompletion: { label: "Avg Completion %", color: CHART_COLORS[2] } }} className="h-[300px] w-full">
                        <BarChart data={performanceData.batchComparison}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="batchName" tick={{ fontSize: 11 }} />
                          <YAxis domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="avgCompletion" radius={[4, 4, 0, 0]}>
                            {performanceData.batchComparison.map((entry: any, index: number) => {
                              let color = CHART_COLORS[2]; // green
                              if (entry.avgCompletion < 30) color = CHART_COLORS[4]; // red
                              else if (entry.avgCompletion < 60) color = CHART_COLORS[3]; // amber
                              return <Cell key={index} fill={color} />;
                            })}
                          </Bar>
                        </BarChart>
                      </ChartContainer>
                    ) : (
                      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No batch comparison data yet</div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* ===== TAB 5: PEOPLE ===== */}
          <TabsContent value="people">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      People Overview
                    </CardTitle>
                    <CardDescription className="mt-1">Trainers and teachers with activity metrics</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowAddUser(true)} data-testid="button-add-user">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add User
                  </Button>
                </div>
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

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
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
          </TabsContent>
        </Tabs>
      </div>

      {/* ===== ALL MODALS (preserved exactly) ===== */}

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

      {/* Manage Batch Teachers Modal */}
      <Dialog open={managingBatchTeachers !== null} onOpenChange={(open) => !open && setManagingBatchTeachers(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Batch Teachers</DialogTitle>
            <DialogDescription>Add or remove teachers from this batch</DialogDescription>
          </DialogHeader>

          {/* Add Teacher Section */}
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter Teacher ID"
                value={teacherIdToAdd}
                onChange={(e) => setTeacherIdToAdd(e.target.value)}
                className="flex-1"
                data-testid="input-add-teacher-id"
              />
              <Button
                onClick={() => {
                  if (managingBatchTeachers && teacherIdToAdd.trim()) {
                    addTeacherToBatchMutation.mutate({
                      batchId: managingBatchTeachers,
                      teacherId: teacherIdToAdd.trim(),
                    });
                  }
                }}
                disabled={!teacherIdToAdd.trim() || addTeacherToBatchMutation.isPending}
                data-testid="button-add-teacher-to-batch"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                {addTeacherToBatchMutation.isPending ? "Adding..." : "Add Teacher"}
              </Button>
            </div>

            {/* Current Teachers List */}
            <div className="border-t pt-4">
              <p className="text-sm font-semibold mb-3">Current Teachers ({batchWithTeachers?.teachers?.length || 0})</p>
              <div className="space-y-2">
                {batchWithTeachers?.teachers && batchWithTeachers.teachers.length > 0 ? (
                  batchWithTeachers.teachers.map((teacher: any) => (
                    <div
                      key={teacher.id}
                      className="p-3 border rounded-lg flex justify-between items-center"
                      data-testid={`batch-teacher-${teacher.id}`}
                    >
                      <div>
                        <p className="font-semibold text-sm">{teacher.name || teacher.email}</p>
                        <p className="text-xs text-muted-foreground">ID: {teacher.teacherId || teacher.id}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (managingBatchTeachers) {
                            removeTeacherFromBatchMutation.mutate({
                              batchId: managingBatchTeachers,
                              teacherId: teacher.id,
                            });
                          }
                        }}
                        disabled={removeTeacherFromBatchMutation.isPending}
                        data-testid={`button-remove-teacher-${teacher.id}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6">
                    <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-muted-foreground text-sm">No teachers in this batch</p>
                    <p className="text-xs text-muted-foreground mt-1">Add teachers using their Teacher ID above</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => setManagingBatchTeachers(null)}
              data-testid="button-close-manage-teachers"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Batch Modal */}
      <Dialog open={showCreateBatch} onOpenChange={setShowCreateBatch}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Batch</DialogTitle>
            <DialogDescription>Create a batch to group teachers and assign courses</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="batchName">Batch Name</Label>
              <Input
                id="batchName"
                placeholder="Enter batch name"
                value={newBatchName}
                onChange={(e) => setNewBatchName(e.target.value)}
                data-testid="input-new-batch-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="batchDescription">Description (optional)</Label>
              <Input
                id="batchDescription"
                placeholder="Enter batch description"
                value={newBatchDescription}
                onChange={(e) => setNewBatchDescription(e.target.value)}
                data-testid="input-new-batch-description"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowCreateBatch(false);
                setNewBatchName("");
                setNewBatchDescription("");
              }}
              data-testid="button-cancel-create-batch"
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                if (!newBatchName.trim()) {
                  toast({
                    title: "Error",
                    description: "Please enter a batch name.",
                    variant: "destructive"
                  });
                  return;
                }
                createBatchMutation.mutate({
                  name: newBatchName.trim(),
                  description: newBatchDescription.trim(),
                });
              }}
              disabled={createBatchMutation.isPending}
              data-testid="button-confirm-create-batch"
            >
              {createBatchMutation.isPending ? "Creating..." : "Create Batch"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Batch Confirmation Modal */}
      <Dialog open={showDeleteBatchConfirm} onOpenChange={setShowDeleteBatchConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Batch</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this batch? This action cannot be undone and will remove all teacher assignments and course assignments for this batch.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowDeleteBatchConfirm(false);
                setBatchToDelete(null);
              }}
              data-testid="button-cancel-delete-batch"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => {
                if (batchToDelete) {
                  deleteBatchMutation.mutate(batchToDelete);
                }
              }}
              disabled={deleteBatchMutation.isPending}
              data-testid="button-confirm-delete-batch"
            >
              {deleteBatchMutation.isPending ? "Deleting..." : "Delete Batch"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add User Modal */}
      <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>Create a new admin, trainer, or teacher account</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="Enter full name"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                data-testid="input-new-user-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter email address"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                data-testid="input-new-user-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password (min 6 characters)"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                data-testid="input-new-user-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={newUserRole} onValueChange={(value: "admin" | "trainer" | "teacher") => setNewUserRole(value)}>
                <SelectTrigger data-testid="select-new-user-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="trainer">Trainer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowAddUser(false);
                setNewUserEmail("");
                setNewUserPassword("");
                setNewUserName("");
                setNewUserRole("teacher");
              }}
              data-testid="button-cancel-add-user"
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                if (!newUserEmail || !newUserPassword || !newUserName) {
                  toast({
                    title: "Error",
                    description: "Please fill in all fields.",
                    variant: "destructive"
                  });
                  return;
                }
                if (newUserPassword.length < 6) {
                  toast({
                    title: "Error",
                    description: "Password must be at least 6 characters.",
                    variant: "destructive"
                  });
                  return;
                }
                createUserMutation.mutate({
                  email: newUserEmail,
                  password: newUserPassword,
                  name: newUserName,
                  role: newUserRole,
                });
              }}
              disabled={createUserMutation.isPending}
              data-testid="button-confirm-add-user"
            >
              {createUserMutation.isPending ? "Creating..." : "Create User"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
