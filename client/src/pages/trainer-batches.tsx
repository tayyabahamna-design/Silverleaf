import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import posthog from "posthog-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Users, Plus, Trash2, LogOut, Award, BookOpen, CheckCircle, TrendingUp, Home, ChevronDown, ChevronRight, AlertCircle, FileText, X } from "lucide-react";
import logoImage from "@assets/Screenshot 2025-10-14 214034_1761029433045.png";

export default function TrainerBatches() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, logoutMutation } = useAuth();
  const [addTeacherOpen, setAddTeacherOpen] = useState(false);
  const [assignCheckpointQuizOpen, setAssignCheckpointQuizOpen] = useState(false);
  const [assignFileQuizOpen, setAssignFileQuizOpen] = useState(false);
  const [viewQuizDetailsOpen, setViewQuizDetailsOpen] = useState(false);
  const [viewTeacherAttemptsOpen, setViewTeacherAttemptsOpen] = useState(false);
  const [expandedTeacherId, setExpandedTeacherId] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [selectedAttempt, setSelectedAttempt] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("teachers");

  const [teacherId, setTeacherId] = useState("");
  const [quizTitle, setQuizTitle] = useState("");
  const [quizDescription, setQuizDescription] = useState("");
  const [selectedWeek, setSelectedWeek] = useState("");
  const [selectedFileId, setSelectedFileId] = useState("");
  const [numQuestions, setNumQuestions] = useState("5");
  const [appreciationText, setAppreciationText] = useState("");
  const [adminName1, setAdminName1] = useState("");
  const [adminName2, setAdminName2] = useState("");

  const { data: batches = [] } = useQuery<any[]>({
    queryKey: ["/api/batches"],
  });

  const { data: weeks = [] } = useQuery<any[]>({
    queryKey: ["/api/training-weeks"],
  });

  // Fetch batch details including teachers
  const { data: batchDetails } = useQuery<any>({
    queryKey: ["/api/batches", selectedBatch?.id],
    enabled: !!selectedBatch?.id,
  });

  // Fetch assigned quizzes for selected batch
  const { data: assignedQuizzes = [] } = useQuery<any[]>({
    queryKey: ["/api/batches", selectedBatch?.id, "quizzes"],
    enabled: !!selectedBatch?.id,
  });

  // Fetch progress for selected batch - auto-loads and refreshes every 30 seconds
  const { data: batchProgress = [], isLoading: isLoadingProgress } = useQuery<any[]>({
    queryKey: ["/api/batches", selectedBatch?.id, "progress"],
    enabled: !!selectedBatch?.id,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    refetchOnWindowFocus: true, // Refresh when window regains focus
  });

  // Fetch files for selected week (for file quiz generation)
  const { data: weekFiles = [] } = useQuery<any[]>({
    queryKey: ["/api/training-weeks", selectedWeek, "deck-files"],
    enabled: !!selectedWeek && assignFileQuizOpen,
  });

  // Fetch quiz details for viewing
  const { data: quizDetails } = useQuery<any>({
    queryKey: ["/api/trainer/quizzes", selectedQuizId],
    enabled: !!selectedQuizId && viewQuizDetailsOpen,
  });

  // Fetch teacher quiz attempts
  const { data: teacherAttempts = [] } = useQuery<any[]>({
    queryKey: ["/api/batches", selectedBatch?.id, "teachers", selectedTeacher?.id, "quiz-attempts"],
    enabled: !!selectedBatch?.id && !!selectedTeacher?.id && viewTeacherAttemptsOpen,
  });

  // Fetch batch certificate template
  const { data: template } = useQuery<any>({
    queryKey: [`/api/batches/${selectedBatch?.id}/certificate-template`],
    enabled: !!selectedBatch?.id && activeTab === "certificates",
  });

  const addTeacherMutation = useMutation({
    mutationFn: async ({ batchId, teacherId }: { batchId: string; teacherId: number }) => {
      const response = await apiRequest("POST", `/api/batches/${batchId}/teachers`, {
        teacherId,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/batches", selectedBatch?.id] });
      toast({ title: "Success", description: "Teacher added to batch" });
      posthog.capture("teacher_added_to_batch", { batchId: selectedBatch?.id, teacherId });
      setAddTeacherOpen(false);
      setTeacherId("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeTeacherMutation = useMutation({
    mutationFn: async ({ batchId, teacherId }: { batchId: string; teacherId: string }) => {
      await apiRequest("DELETE", `/api/batches/${batchId}/teachers/${teacherId}`);
    },
    onSuccess: (_, { batchId, teacherId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/batches", selectedBatch?.id] });
      toast({ title: "Success", description: "Teacher removed from batch" });
      posthog.capture("teacher_removed_from_batch", { batchId, teacherId });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const assignQuizMutation = useMutation({
    mutationFn: async (data: {
      batchId: string;
      weekId: string;
      title: string;
      description: string;
      numQuestions: number;
    }) => {
      const response = await apiRequest("POST", `/api/batches/${data.batchId}/assign-quiz`, {
        weekId: data.weekId,
        title: data.title,
        description: data.description,
        numQuestions: data.numQuestions,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/batches", selectedBatch?.id, "quizzes"] });
      toast({ title: "Success", description: "Checkpoint quiz generated and assigned successfully" });
      posthog.capture("quiz_assigned", { batchId: selectedBatch?.id, quizTitle, weekId: selectedWeek, type: "checkpoint_quiz" });
      setAssignCheckpointQuizOpen(false);
      setQuizTitle("");
      setQuizDescription("");
      setSelectedWeek("");
      setNumQuestions("5");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const assignFileQuizMutation = useMutation({
    mutationFn: async (data: {
      batchId: string;
      weekId: string;
      fileId: string;
      title: string;
      description: string;
      numQuestions: number;
    }) => {
      const response = await apiRequest("POST", `/api/batches/${data.batchId}/assign-file-quiz`, {
        weekId: data.weekId,
        fileId: data.fileId,
        title: data.title,
        description: data.description,
        numQuestions: data.numQuestions,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/batches", selectedBatch?.id, "quizzes"] });
      toast({ title: "Success", description: "File quiz generated and assigned successfully" });
      posthog.capture("quiz_assigned", { batchId: selectedBatch?.id, quizTitle, weekId: selectedWeek, type: "file_quiz" });
      setAssignFileQuizOpen(false);
      setQuizTitle("");
      setQuizDescription("");
      setSelectedWeek("");
      setSelectedFileId("");
      setNumQuestions("5");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteQuizMutation = useMutation({
    mutationFn: async (quizId: string) => {
      await apiRequest("DELETE", `/api/assigned-quizzes/${quizId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/batches", selectedBatch?.id, "quizzes"] });
      toast({ title: "Success", description: "Quiz deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteBatchMutation = useMutation({
    mutationFn: async (batchId: string) => {
      await apiRequest("DELETE", `/api/batches/${batchId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/batches"] });
      toast({ title: "Success", description: "Batch deleted successfully" });
      setSelectedBatch(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const saveCertificateTemplateMutation = useMutation({
    mutationFn: async () => {
      const batchCourses = await apiRequest("GET", `/api/batches/${selectedBatch.id}/courses`);
      const courseId = batchCourses[0]?.id;
      
      return apiRequest("POST", `/api/batches/${selectedBatch.id}/certificate-template`, {
        courseId,
        appreciationText,
        adminName1,
        adminName2,
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/batches/${selectedBatch?.id}/certificate-template`] });
      setAppreciationText(data.appreciationText);
      setAdminName1(data.adminName1 || "");
      setAdminName2(data.adminName2 || "");
      toast({ title: "Template saved successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleAddTeacher = () => {
    if (selectedBatch && teacherId) {
      addTeacherMutation.mutate({
        batchId: selectedBatch.id,
        teacherId: parseInt(teacherId),
      });
    }
  };

  const handleAssignCheckpointQuiz = () => {
    if (selectedBatch && selectedWeek && quizTitle) {
      assignQuizMutation.mutate({
        batchId: selectedBatch.id,
        weekId: selectedWeek,
        title: quizTitle,
        description: quizDescription,
        numQuestions: parseInt(numQuestions),
      });
    }
  };

  const handleAssignFileQuiz = () => {
    if (selectedBatch && selectedWeek && selectedFileId && quizTitle) {
      assignFileQuizMutation.mutate({
        batchId: selectedBatch.id,
        weekId: selectedWeek,
        fileId: selectedFileId,
        title: quizTitle,
        description: quizDescription,
        numQuestions: parseInt(numQuestions),
      });
    }
  };

  const getLevelBadgeVariant = (level: string) => {
    if (level === "Advanced") return "default";
    if (level === "Intermediate") return "secondary";
    return "outline";
  };

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
                Trainer Portal
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
            <div className="text-xs sm:text-sm text-white/90 hidden md:block truncate max-w-[200px]" data-testid="text-user-info">
              {user?.username}
            </div>
            <Button
              variant="secondary"
              size="sm"
              asChild
              data-testid="button-home"
              className="hidden sm:flex bg-white/10 hover:bg-white/20 text-white border-white/20"
            >
              <Link href="/">
                <Home className="mr-2 h-4 w-4" />
                Home
              </Link>
            </Button>
            <Button
              variant="secondary"
              size="icon"
              asChild
              data-testid="button-home-mobile"
              className="sm:hidden h-8 w-8 bg-white/10 hover:bg-white/20 text-white border-white/20"
              aria-label="Home"
            >
              <Link href="/">
                <Home className="h-4 w-4" />
              </Link>
            </Button>
            <div className="text-white">
              <ThemeToggle />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => logoutMutation.mutate()}
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
              data-testid="button-logout-mobile"
              className="sm:hidden h-8 w-8 bg-white/10 hover:bg-white/20 text-white border-white/20"
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-bold">Training Batches</h2>
              <p className="text-muted-foreground mt-1">Manage your assigned batches, quizzes, and track progress</p>
            </div>
          </div>
        </div>

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-300px)]">
          {/* Left Sidebar - Batch List */}
          <div className="lg:col-span-1 border rounded-lg bg-card overflow-hidden flex flex-col">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Your Batches</h3>
              <p className="text-xs text-muted-foreground mt-1">{batches.length} total</p>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-2">
                {batches.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <Users className="mx-auto h-8 w-8 mb-2 opacity-50" />
                    No batches assigned to you yet
                  </div>
                ) : (
                  batches.map((batch: any) => (
                    <button
                      key={batch.id}
                      onClick={() => {
                        setSelectedBatch(batch);
                        setActiveTab("teachers");
                      }}
                      className={`w-full text-left p-3 rounded-lg transition-colors border ${
                        selectedBatch?.id === batch.id
                          ? "bg-primary/10 border-primary text-foreground"
                          : "bg-muted/30 border-transparent hover:bg-muted/50 text-foreground"
                      }`}
                      data-testid={`button-batch-${batch.id}`}
                    >
                      <p className="font-semibold text-sm truncate">{batch.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {batch.teacherCount || 0} teachers
                      </p>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Right Panel - Batch Details */}
          {selectedBatch ? (
            <div className="lg:col-span-3 border rounded-lg bg-card overflow-hidden flex flex-col">
              {/* Header */}
              <div className="p-4 border-b flex justify-between items-start">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold">{selectedBatch.name}</h2>
                  {selectedBatch.description && (
                    <p className="text-sm text-muted-foreground mt-1">{selectedBatch.description}</p>
                  )}
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirm(`Are you sure you want to delete the batch "${selectedBatch.name}"? This will remove all teachers and quizzes.`)) {
                      deleteBatchMutation.mutate(selectedBatch.id);
                    }
                  }}
                  data-testid={`button-delete-batch-${selectedBatch.id}`}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col flex-1 overflow-hidden">
                <TabsList className="grid w-full grid-cols-4 flex-shrink-0 rounded-none border-b">
                  <TabsTrigger value="teachers" data-testid="tab-teachers">
                    <Users className="mr-2 h-4 w-4" />
                    Teachers
                  </TabsTrigger>
                  <TabsTrigger value="quizzes" data-testid="tab-quizzes">
                    <Award className="mr-2 h-4 w-4" />
                    Quizzes
                  </TabsTrigger>
                  <TabsTrigger value="progress" data-testid="tab-progress">
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Progress
                  </TabsTrigger>
                  <TabsTrigger value="certificates" data-testid="tab-certificates">
                    <FileText className="mr-2 h-4 w-4" />
                    Certificates
                  </TabsTrigger>
                </TabsList>

                {/* Teachers Tab */}
                <TabsContent value="teachers" className="space-y-4 flex-1 overflow-y-auto p-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Enrolled Teachers</h3>
                    <Dialog open={addTeacherOpen} onOpenChange={setAddTeacherOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" data-testid="button-add-teacher">
                          <Plus className="mr-2 h-4 w-4" />
                          Add
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Teacher to {selectedBatch?.name}</DialogTitle>
                          <DialogDescription>Enter the teacher ID to add them to this batch</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="teacher-id">Teacher ID</Label>
                            <Input
                              id="teacher-id"
                              data-testid="input-teacher-id"
                              type="number"
                              placeholder="e.g., 101"
                              value={teacherId}
                              onChange={(e) => setTeacherId(e.target.value)}
                            />
                          </div>
                          <Button
                            onClick={handleAddTeacher}
                            disabled={!teacherId || addTeacherMutation.isPending}
                            data-testid="button-submit-teacher"
                          >
                            {addTeacherMutation.isPending ? "Adding..." : "Add Teacher"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  {batchDetails?.teachers?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No teachers enrolled in this batch yet
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {batchDetails?.teachers?.map((teacher: any) => (
                        <Card key={teacher.id}>
                          <CardContent className="flex items-center justify-between py-4">
                            <div>
                              <p className="font-semibold">{teacher.name}</p>
                              <p className="text-sm text-muted-foreground">
                                Teacher ID: {teacher.teacherId} • {teacher.email}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm(`Remove ${teacher.name} from this batch?`)) {
                                  removeTeacherMutation.mutate({
                                    batchId: selectedBatch.id,
                                    teacherId: teacher.id,
                                  });
                                }
                              }}
                              data-testid={`button-remove-teacher-${teacher.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Quizzes Tab */}
                <TabsContent value="quizzes" className="space-y-4 flex-1 overflow-y-auto p-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Assigned Quizzes</h3>
                    <div className="flex gap-2">
                      <Dialog open={assignCheckpointQuizOpen} onOpenChange={setAssignCheckpointQuizOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" data-testid="button-assign-checkpoint-quiz">
                            <Plus className="mr-2 h-4 w-4" />
                            Checkpoint
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Assign Checkpoint Quiz</DialogTitle>
                            <DialogDescription>Generate and assign a new checkpoint quiz</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="quiz-title">Quiz Title</Label>
                              <Input
                                id="quiz-title"
                                data-testid="input-quiz-title"
                                placeholder="e.g., Week 1 Checkpoint"
                                value={quizTitle}
                                onChange={(e) => setQuizTitle(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="quiz-description">Description (Optional)</Label>
                              <Textarea
                                id="quiz-description"
                                data-testid="input-quiz-description"
                                placeholder="Quiz description..."
                                value={quizDescription}
                                onChange={(e) => setQuizDescription(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="week-select">Select Week</Label>
                              <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                                <SelectTrigger id="week-select" data-testid="select-week">
                                  <SelectValue placeholder="Choose a week..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {weeks.map((week: any) => (
                                    <SelectItem key={week.id} value={week.id}>
                                      Week {week.weekNumber} - {week.competencyFocus}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="num-questions">Number of Questions</Label>
                              <Input
                                id="num-questions"
                                data-testid="input-num-questions"
                                type="number"
                                min="1"
                                max="20"
                                value={numQuestions}
                                onChange={(e) => setNumQuestions(e.target.value)}
                              />
                            </div>
                            <Button
                              onClick={handleAssignCheckpointQuiz}
                              disabled={!selectedWeek || !quizTitle || assignQuizMutation.isPending}
                              data-testid="button-submit-checkpoint-quiz"
                            >
                              {assignQuizMutation.isPending ? "Assigning..." : "Assign Quiz"}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Dialog open={assignFileQuizOpen} onOpenChange={setAssignFileQuizOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" data-testid="button-assign-file-quiz">
                            <Plus className="mr-2 h-4 w-4" />
                            File Quiz
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Assign File Quiz</DialogTitle>
                            <DialogDescription>Generate a quiz from presentation files</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="file-quiz-title">Quiz Title</Label>
                              <Input
                                id="file-quiz-title"
                                data-testid="input-file-quiz-title"
                                placeholder="e.g., File Quiz 1"
                                value={quizTitle}
                                onChange={(e) => setQuizTitle(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="file-quiz-description">Description (Optional)</Label>
                              <Textarea
                                id="file-quiz-description"
                                data-testid="input-file-quiz-description"
                                placeholder="Quiz description..."
                                value={quizDescription}
                                onChange={(e) => setQuizDescription(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="file-week-select">Select Week</Label>
                              <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                                <SelectTrigger id="file-week-select" data-testid="select-file-week">
                                  <SelectValue placeholder="Choose a week..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {weeks.map((week: any) => (
                                    <SelectItem key={week.id} value={week.id}>
                                      Week {week.weekNumber} - {week.competencyFocus}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="file-select">Select File</Label>
                              <Select value={selectedFileId} onValueChange={setSelectedFileId}>
                                <SelectTrigger id="file-select" data-testid="select-file">
                                  <SelectValue placeholder="Choose a file..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {weekFiles.map((file: any) => (
                                    <SelectItem key={file.id} value={file.id}>
                                      {file.fileName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="file-num-questions">Number of Questions</Label>
                              <Input
                                id="file-num-questions"
                                data-testid="input-file-num-questions"
                                type="number"
                                min="1"
                                max="20"
                                value={numQuestions}
                                onChange={(e) => setNumQuestions(e.target.value)}
                              />
                            </div>
                            <Button
                              onClick={handleAssignFileQuiz}
                              disabled={!selectedWeek || !selectedFileId || !quizTitle || assignFileQuizMutation.isPending}
                              data-testid="button-submit-file-quiz"
                            >
                              {assignFileQuizMutation.isPending ? "Assigning..." : "Assign Quiz"}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                  {assignedQuizzes.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No quizzes assigned yet
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {assignedQuizzes.map((quiz: any) => (
                        <Card
                          key={quiz.id}
                          className="cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => {
                            setSelectedQuizId(quiz.id);
                            setViewQuizDetailsOpen(true);
                          }}
                          data-testid={`card-quiz-${quiz.id}`}
                        >
                          <CardContent className="py-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold truncate">{quiz.title}</p>
                                  <Badge variant="outline" className="text-xs flex-shrink-0">
                                    {quiz.type === "checkpoint" ? "Checkpoint" : "File"}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {quiz.description || "No description"}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteQuizMutation.mutate(quiz.id);
                                }}
                                data-testid={`button-delete-quiz-${quiz.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Progress Tab */}
                <TabsContent value="progress" className="space-y-4 flex-1 overflow-y-auto p-4">
                  <h3 className="text-lg font-semibold">Teacher Progress</h3>
                  {isLoadingProgress ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Loading progress...
                    </div>
                  ) : batchProgress.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No progress data available
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {batchProgress.map((teacherProgress: any) => (
                        <Card key={teacherProgress.teacherId}>
                          <CardHeader>
                            <div className="flex justify-between items-start">
                              <div>
                                <CardTitle className="text-base">{teacherProgress.teacherName}</CardTitle>
                                <CardDescription>{teacherProgress.teacherEmail}</CardDescription>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedTeacher(teacherProgress);
                                  setViewTeacherAttemptsOpen(true);
                                }}
                                data-testid={`button-view-attempts-${teacherProgress.teacherId}`}
                              >
                                View Details
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Overall Progress</span>
                                <span className="font-semibold">{teacherProgress.overallPercentage}%</span>
                              </div>
                              <Progress value={teacherProgress.overallPercentage} className="h-2" />
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-sm">
                              <div className="text-center">
                                <p className="text-muted-foreground text-xs">Completed</p>
                                <p className="font-semibold">{teacherProgress.completedCount}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-muted-foreground text-xs">In Progress</p>
                                <p className="font-semibold">{teacherProgress.inProgressCount}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-muted-foreground text-xs">Not Started</p>
                                <p className="font-semibold">{teacherProgress.notStartedCount}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Certificates Tab */}
                <TabsContent value="certificates" className="overflow-y-auto flex-1 p-4">
                  <div className="space-y-4 pr-4">
                    <div className="bg-muted/30 p-4 rounded-lg border">
                      <p className="text-sm text-muted-foreground mb-3">
                        Configure the certificate template for this batch. After setup, contact admin to approve.
                      </p>
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium">Appreciation Text</label>
                          <Textarea
                            value={appreciationText || (template?.appreciationText ?? "")}
                            onChange={(e) => setAppreciationText(e.target.value)}
                            placeholder="In recognition of successfully completing the training program"
                            className="mt-2"
                            data-testid="input-cert-appreciation-text"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium">Admin Name 1</label>
                            <Input
                              value={adminName1 || (template?.adminName1 ?? "")}
                              onChange={(e) => setAdminName1(e.target.value)}
                              placeholder="First admin name"
                              className="mt-2"
                              data-testid="input-cert-admin-name-1"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium">Admin Name 2</label>
                            <Input
                              value={adminName2 || (template?.adminName2 ?? "")}
                              onChange={(e) => setAdminName2(e.target.value)}
                              placeholder="Second admin name (optional)"
                              className="mt-2"
                              data-testid="input-cert-admin-name-2"
                            />
                          </div>
                        </div>

                        <Button
                          onClick={() => saveCertificateTemplateMutation.mutate()}
                          disabled={saveCertificateTemplateMutation.isPending}
                          data-testid="button-save-cert-template"
                        >
                          {saveCertificateTemplateMutation.isPending ? "Saving..." : "Save Template"}
                        </Button>

                        {template?.status && (
                          <div className="text-sm p-3 rounded-lg bg-muted/50">
                            <p className="font-medium">
                              Status: <span className="capitalize">{template.status}</span>
                            </p>
                            {template.status === "approved" && (
                              <p className="text-green-600 flex items-center gap-1 mt-1">
                                <CheckCircle className="w-4 h-4" /> Approved by admin
                              </p>
                            )}
                            {template.status === "draft" && (
                              <p className="text-muted-foreground text-xs mt-1">
                                Save your template and request approval from admin
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-900 rounded-lg border">
                      <p className="text-sm font-medium mb-4 text-foreground">Certificate Preview</p>
                      <div className="border-2 border-primary rounded-lg p-8 space-y-6 text-center bg-white dark:bg-slate-900">
                        {/* Certificate Header */}
                        <div className="space-y-2">
                          <h1 className="text-3xl font-bold text-primary">Certificate of Completion</h1>
                          <p className="text-sm text-muted-foreground">Silverleaf Academy</p>
                        </div>

                        {/* Divider */}
                        <div className="flex justify-center">
                          <div className="w-16 h-1 bg-primary rounded-full" />
                        </div>

                        {/* Content */}
                        <div className="space-y-4">
                          <p className="text-sm text-foreground">This certificate is proudly presented to</p>
                          <p className="text-2xl font-bold text-primary">Teacher Name</p>
                          <p className="text-xs text-muted-foreground border-t-2 border-primary pt-4">
                            For successfully completing the course
                          </p>
                          <p className="text-lg font-bold text-primary">{selectedBatch?.name || "Course Name"}</p>
                        </div>

                        {/* Appreciation Text */}
                        <div className="bg-primary/5 p-4 rounded-lg">
                          <p className="text-xs leading-relaxed text-foreground italic">
                            {appreciationText || template?.appreciationText || "In recognition of successfully completing the training program"}
                          </p>
                        </div>

                        {/* Signatures */}
                        <div className="grid grid-cols-2 gap-6 pt-6">
                          <div className="space-y-8 text-center">
                            <div className="h-12" />
                            <div>
                              <p className="text-xs font-semibold text-foreground">{adminName1 || template?.adminName1 || "Administrator"}</p>
                              <p className="text-xs text-muted-foreground">Authorized Signatory</p>
                            </div>
                          </div>
                          <div className="space-y-8 text-center">
                            <div className="h-12" />
                            <div>
                              <p className="text-xs font-semibold text-foreground">{adminName2 || template?.adminName2 || "Director"}</p>
                              <p className="text-xs text-muted-foreground">Program Director</p>
                            </div>
                          </div>
                        </div>

                        {/* Date */}
                        <p className="text-xs text-muted-foreground pt-4">
                          Issued on {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                        </p>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="lg:col-span-3 border rounded-lg bg-card flex items-center justify-center">
              <div className="text-center">
                <Users className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Select a batch to view details</p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* View Quiz Details Dialog */}
      <Dialog open={viewQuizDetailsOpen} onOpenChange={setViewQuizDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{quizDetails?.title || "Quiz Details"}</DialogTitle>
            <DialogDescription>
              {quizDetails?.description || ""} • {quizDetails?.questions?.length || 0} questions
            </DialogDescription>
          </DialogHeader>
          {!quizDetails ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading quiz details...
            </div>
          ) : (
            <div className="space-y-4">
              {quizDetails.questions?.map((question: any, index: number) => (
                <Card key={question.id || index}>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div>
                        <p className="font-semibold text-base">
                          Question {index + 1}: {question.question}
                        </p>
                        <Badge variant="outline" className="mt-2">
                          {question.type === "true_false" ? "True/False" : "Multiple Choice"}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Options:</p>
                        <div className="space-y-2">
                          {question.options?.map((option: string, optionIndex: number) => (
                            <div
                              key={optionIndex}
                              className={`p-3 rounded-lg border ${
                                option === question.correctAnswer
                                  ? "bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-700"
                                  : "bg-muted/50 border-border"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {option === question.correctAnswer && (
                                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                                )}
                                <span className={option === question.correctAnswer ? "font-semibold text-green-700 dark:text-green-300" : ""}>
                                  {option}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2 border-t">
                        <p className="text-sm">
                          <span className="font-semibold text-muted-foreground">Correct Answer: </span>
                          <span className="text-green-600 dark:text-green-400 font-semibold">{question.correctAnswer}</span>
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Teacher Attempts Dialog */}
      <Dialog open={viewTeacherAttemptsOpen} onOpenChange={setViewTeacherAttemptsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTeacher?.teacherName} - Quiz Attempts</DialogTitle>
            <DialogDescription>{selectedTeacher?.teacherEmail}</DialogDescription>
          </DialogHeader>
          {teacherAttempts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No quiz attempts yet
            </div>
          ) : (
            <div className="space-y-4">
              {teacherAttempts.map((attempt: any) => {
                const percentage = Math.round((attempt.score / attempt.totalQuestions) * 100);
                const passed = attempt.passed === "yes";
                return (
                  <Card key={attempt.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-base">{attempt.quizTitle}</CardTitle>
                          <CardDescription>
                            {new Date(attempt.completedAt).toLocaleString()}
                          </CardDescription>
                        </div>
                        <Badge variant={passed ? "default" : "destructive"}>
                          {percentage}% - {passed ? "Passed" : "Failed"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Score:</span>
                          <span className="ml-2 font-semibold">{attempt.score}/{attempt.totalQuestions}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Attempt:</span>
                          <span className="ml-2 font-semibold">{attempt.attemptNumber}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
