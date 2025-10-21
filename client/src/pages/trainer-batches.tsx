import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Users, Plus, Trash2, LogOut, Award, BookOpen, CheckCircle, TrendingUp, Home } from "lucide-react";
import logoImage from "@assets/Screenshot 2025-10-14 214034_1761029433045.png";

export default function TrainerBatches() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, logoutMutation } = useAuth();
  const [createBatchOpen, setCreateBatchOpen] = useState(false);
  const [addTeacherOpen, setAddTeacherOpen] = useState(false);
  const [assignCheckpointQuizOpen, setAssignCheckpointQuizOpen] = useState(false);
  const [assignFileQuizOpen, setAssignFileQuizOpen] = useState(false);
  const [viewProgressOpen, setViewProgressOpen] = useState(false);
  const [viewBatchDetailsOpen, setViewBatchDetailsOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);

  const [batchName, setBatchName] = useState("");
  const [batchDescription, setBatchDescription] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [quizTitle, setQuizTitle] = useState("");
  const [quizDescription, setQuizDescription] = useState("");
  const [selectedWeek, setSelectedWeek] = useState("");
  const [selectedFileId, setSelectedFileId] = useState("");
  const [numQuestions, setNumQuestions] = useState("5");

  const { data: batches = [] } = useQuery<any[]>({
    queryKey: ["/api/batches"],
  });

  const { data: weeks = [] } = useQuery<any[]>({
    queryKey: ["/api/training-weeks"],
  });

  // Fetch batch details including teachers
  const { data: batchDetails } = useQuery<any>({
    queryKey: ["/api/batches", selectedBatch?.id],
    enabled: !!selectedBatch?.id && viewBatchDetailsOpen,
  });

  // Fetch assigned quizzes for selected batch
  const { data: assignedQuizzes = [] } = useQuery<any[]>({
    queryKey: ["/api/batches", selectedBatch?.id, "quizzes"],
    enabled: !!selectedBatch?.id && viewBatchDetailsOpen,
  });

  // Fetch progress for selected batch
  const { data: batchProgress = [] } = useQuery<any[]>({
    queryKey: ["/api/batches", selectedBatch?.id, "progress"],
    enabled: !!selectedBatch?.id && viewProgressOpen,
  });

  // Fetch files for selected week (for file quiz generation)
  const { data: weekFiles = [] } = useQuery<any[]>({
    queryKey: ["/api/training-weeks", selectedWeek, "deck-files"],
    enabled: !!selectedWeek && assignFileQuizOpen,
  });

  const createBatchMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const response = await apiRequest("POST", "/api/batches", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/batches"] });
      toast({ title: "Success", description: "Batch created successfully" });
      setCreateBatchOpen(false);
      setBatchName("");
      setBatchDescription("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/batches", selectedBatch?.id] });
      toast({ title: "Success", description: "Teacher removed from batch" });
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
      setViewBatchDetailsOpen(false);
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

  const handleCreateBatch = () => {
    createBatchMutation.mutate({ name: batchName, description: batchDescription });
  };

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
      <header className="border-b sticky top-0 bg-background z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src={logoImage} alt="Silverleaf Academy Logo" className="h-10" />
            <div>
              <h1 className="text-xl font-bold">Silverleaf Academy - Trainer Portal</h1>
              <p className="text-sm text-muted-foreground">Manage Training Batches</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              asChild
              data-testid="button-home"
            >
              <Link href="/">
                <Home className="mr-2 h-4 w-4" />
                Home
              </Link>
            </Button>
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              data-testid="button-logout"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-bold">Training Batches</h2>
            <p className="text-muted-foreground mt-1">Create and manage training batches, assign quizzes, and track progress</p>
          </div>
          <Dialog open={createBatchOpen} onOpenChange={setCreateBatchOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-batch">
                <Plus className="mr-2 h-4 w-4" />
                Create Batch
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Batch</DialogTitle>
                <DialogDescription>Create a new training batch to organize teachers</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="batch-name">Batch Name</Label>
                  <Input
                    id="batch-name"
                    data-testid="input-batch-name"
                    placeholder="e.g., Fall 2024 - Cohort A"
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="batch-description">Description (Optional)</Label>
                  <Textarea
                    id="batch-description"
                    data-testid="input-batch-description"
                    placeholder="Batch description..."
                    value={batchDescription}
                    onChange={(e) => setBatchDescription(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleCreateBatch}
                  disabled={!batchName || createBatchMutation.isPending}
                  data-testid="button-submit-batch"
                >
                  {createBatchMutation.isPending ? "Creating..." : "Create Batch"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {batches.map((batch: any) => (
            <Card key={batch.id} className="hover-elevate active-elevate-2 cursor-pointer" onClick={() => {
              setSelectedBatch(batch);
              setViewBatchDetailsOpen(true);
            }}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle data-testid={`text-batch-name-${batch.id}`}>{batch.name}</CardTitle>
                    {batch.description && (
                      <CardDescription className="mt-1">{batch.description}</CardDescription>
                    )}
                  </div>
                  <Badge variant="outline" data-testid={`badge-teacher-count-${batch.id}`}>
                    {batch.teacherCount || 0} Teachers
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{batch.teacherCount || 0} enrolled</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {batches.length === 0 && (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No batches yet</h3>
            <p className="text-muted-foreground mt-2">Create your first training batch to get started</p>
          </div>
        )}
      </main>

      {/* View Batch Details Dialog */}
      <Dialog open={viewBatchDetailsOpen} onOpenChange={setViewBatchDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex justify-between items-start">
              <div>
                <DialogTitle>{selectedBatch?.name}</DialogTitle>
                <DialogDescription>{selectedBatch?.description || "No description"}</DialogDescription>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (confirm(`Are you sure you want to delete the batch "${selectedBatch?.name}"? This will remove all teachers and quizzes.`)) {
                    deleteBatchMutation.mutate(selectedBatch.id);
                  }
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Batch
              </Button>
            </div>
          </DialogHeader>

          <Tabs defaultValue="teachers" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
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
            </TabsList>

            {/* Teachers Tab */}
            <TabsContent value="teachers" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Enrolled Teachers</h3>
                <Dialog open={addTeacherOpen} onOpenChange={setAddTeacherOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-add-teacher">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Teacher
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
            <TabsContent value="quizzes" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Generated Quizzes</h3>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => setAssignCheckpointQuizOpen(true)}
                    data-testid="button-generate-checkpoint-quiz"
                  >
                    <Award className="mr-2 h-4 w-4" />
                    Generate Checkpoint Quiz
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAssignFileQuizOpen(true)}
                    data-testid="button-generate-file-quiz"
                  >
                    <BookOpen className="mr-2 h-4 w-4" />
                    Generate File Quiz
                  </Button>
                </div>
              </div>
              {assignedQuizzes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No quizzes generated for this batch yet
                </div>
              ) : (
                <div className="space-y-2">
                  {assignedQuizzes.map((quiz: any) => (
                    <Card key={quiz.id}>
                      <CardContent className="flex items-center justify-between py-4">
                        <div className="flex-1">
                          <p className="font-semibold">{quiz.title}</p>
                          {quiz.description && (
                            <p className="text-sm text-muted-foreground">{quiz.description}</p>
                          )}
                          <Badge variant="outline" className="mt-2">
                            {quiz.numQuestions} Questions
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Delete quiz "${quiz.title}"?`)) {
                              deleteQuizMutation.mutate(quiz.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Progress Tab */}
            <TabsContent value="progress" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Teacher Progress</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setViewProgressOpen(true);
                    queryClient.invalidateQueries({ queryKey: ["/api/batches", selectedBatch?.id, "progress"] });
                  }}
                >
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Refresh Progress
                </Button>
              </div>
              {batchProgress.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No teachers in this batch to track progress
                </div>
              ) : (
                <div className="space-y-4">
                  {batchProgress.map((item: any) => (
                    <Card key={item.teacher.id}>
                      <CardHeader>
                        <CardTitle className="text-base">{item.teacher.name}</CardTitle>
                        <CardDescription>Teacher ID: {item.teacher.teacherId}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Weeks Completed</p>
                            <p className="text-2xl font-bold">{item.weeksCompleted}/{item.totalWeeks}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Quizzes Taken</p>
                            <p className="text-2xl font-bold">{item.quizzesTaken}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Avg Quiz Score</p>
                            <p className="text-2xl font-bold">{item.avgQuizScore ? `${item.avgQuizScore.toFixed(1)}%` : "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Current Level</p>
                            <Badge variant={getLevelBadgeVariant(item.currentLevel)}>
                              {item.currentLevel || "Not Started"}
                            </Badge>
                          </div>
                        </div>
                        {item.recentQuizzes && item.recentQuizzes.length > 0 && (
                          <div className="pt-3 border-t">
                            <p className="text-sm font-semibold mb-2">Recent Quiz Scores</p>
                            <div className="flex gap-2 flex-wrap">
                              {item.recentQuizzes.map((quiz: any, idx: number) => (
                                <Badge key={idx} variant="outline">
                                  {quiz.title}: {quiz.score}%
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Assign Checkpoint Quiz Dialog */}
      <Dialog open={assignCheckpointQuizOpen} onOpenChange={setAssignCheckpointQuizOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Checkpoint Quiz for {selectedBatch?.name}</DialogTitle>
            <DialogDescription>Create an AI-generated quiz from ALL files in a training week and assign it to this batch</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quiz-title">Quiz Title</Label>
              <Input
                id="quiz-title"
                data-testid="input-quiz-title"
                placeholder="e.g., Week 1 Assessment"
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
              <Label htmlFor="training-week">Training Week</Label>
              <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                <SelectTrigger data-testid="select-week">
                  <SelectValue placeholder="Select a week" />
                </SelectTrigger>
                <SelectContent>
                  {weeks.map((week: any) => (
                    <SelectItem key={week.id} value={week.id}>
                      Week {week.weekNumber}: {week.competencyFocus}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="num-questions">Number of Questions</Label>
              <Input
                id="num-questions"
                type="number"
                data-testid="input-num-questions"
                min="5"
                max="15"
                value={numQuestions}
                onChange={(e) => setNumQuestions(e.target.value)}
              />
            </div>
            <Button
              onClick={handleAssignCheckpointQuiz}
              disabled={!quizTitle || !selectedWeek || assignQuizMutation.isPending}
              data-testid="button-submit-checkpoint-quiz"
            >
              {assignQuizMutation.isPending ? "Generating & Assigning..." : "Generate & Assign Checkpoint Quiz"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign File Quiz Dialog */}
      <Dialog open={assignFileQuizOpen} onOpenChange={setAssignFileQuizOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate File Quiz for {selectedBatch?.name}</DialogTitle>
            <DialogDescription>Create an AI-generated quiz from a SPECIFIC file in a training week and assign it to this batch</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file-quiz-title">Quiz Title</Label>
              <Input
                id="file-quiz-title"
                data-testid="input-file-quiz-title"
                placeholder="e.g., Week 1 - Lesson 1 Quiz"
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
              <Label htmlFor="file-training-week">Training Week</Label>
              <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                <SelectTrigger data-testid="select-file-week">
                  <SelectValue placeholder="Select a week" />
                </SelectTrigger>
                <SelectContent>
                  {weeks.map((week: any) => (
                    <SelectItem key={week.id} value={week.id}>
                      Week {week.weekNumber}: {week.competencyFocus}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedWeek && (
              <div className="space-y-2">
                <Label htmlFor="file-select">Select File</Label>
                <Select value={selectedFileId} onValueChange={setSelectedFileId}>
                  <SelectTrigger data-testid="select-file">
                    <SelectValue placeholder="Select a file" />
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
            )}
            <div className="space-y-2">
              <Label htmlFor="file-num-questions">Number of Questions</Label>
              <Input
                id="file-num-questions"
                type="number"
                data-testid="input-file-num-questions"
                min="5"
                max="15"
                value={numQuestions}
                onChange={(e) => setNumQuestions(e.target.value)}
              />
            </div>
            <Button
              onClick={handleAssignFileQuiz}
              disabled={!quizTitle || !selectedWeek || !selectedFileId || assignFileQuizMutation.isPending}
              data-testid="button-submit-file-quiz"
            >
              {assignFileQuizMutation.isPending ? "Generating & Assigning..." : "Generate & Assign File Quiz"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
