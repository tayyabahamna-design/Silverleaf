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
  const [assignQuizOpen, setAssignQuizOpen] = useState(false);
  const [viewProgressOpen, setViewProgressOpen] = useState(false);
  const [viewBatchDetailsOpen, setViewBatchDetailsOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);

  const [batchName, setBatchName] = useState("");
  const [batchDescription, setBatchDescription] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [quizTitle, setQuizTitle] = useState("");
  const [quizDescription, setQuizDescription] = useState("");
  const [selectedWeek, setSelectedWeek] = useState("");
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
      toast({ title: "Success", description: "Quiz generated and assigned successfully" });
      setAssignQuizOpen(false);
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

  const handleAssignQuiz = () => {
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

  const getLevelBadgeVariant = (level: string) => {
    if (level === "Advanced") return "default";
    if (level === "Intermediate") return "secondary";
    return "outline";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header matching Admin dashboard */}
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
          <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
            <div className="text-xs sm:text-sm text-white/90 hidden md:block truncate max-w-[200px]" data-testid="text-user-info">
              {user?.username} (Trainer)
            </div>
            <Link href="/">
              <Button
                variant="secondary"
                size="sm"
                data-testid="button-home"
                className="bg-white/10 hover:bg-white/20 text-white border-white/20"
              >
                <Home className="mr-2 h-4 w-4" />
                Home
              </Button>
            </Link>
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

      {/* Main Content */}
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Batch Management</h2>
            <p className="text-muted-foreground">Manage teacher batches, generate quizzes, and track progress</p>
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
                <DialogDescription>Create a batch to group teachers and generate quizzes for them</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="batch-name">Batch Name</Label>
                  <Input
                    id="batch-name"
                    data-testid="input-batch-name"
                    placeholder="e.g., Batch 2024-A"
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
                <Button onClick={handleCreateBatch} disabled={!batchName || createBatchMutation.isPending} data-testid="button-submit-batch">
                  {createBatchMutation.isPending ? "Creating..." : "Create Batch"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {batches.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Batches Yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Create your first batch to start managing teachers and generating quizzes
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {batches.map((batch: any) => (
              <Card key={batch.id} data-testid={`card-batch-${batch.id}`} className="hover-elevate cursor-pointer" onClick={() => {
                setSelectedBatch(batch);
                setViewBatchDetailsOpen(true);
              }}>
                <CardHeader>
                  <CardTitle>{batch.name}</CardTitle>
                  {batch.description && <CardDescription>{batch.description}</CardDescription>}
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    Click to view details
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Batch Details Dialog */}
      <Dialog open={viewBatchDetailsOpen} onOpenChange={(open) => {
        setViewBatchDetailsOpen(open);
        if (!open) setSelectedBatch(null);
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{selectedBatch?.name}</span>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (confirm("Are you sure you want to delete this batch?")) {
                    deleteBatchMutation.mutate(selectedBatch.id);
                  }
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Batch
              </Button>
            </DialogTitle>
            {selectedBatch?.description && (
              <DialogDescription>{selectedBatch.description}</DialogDescription>
            )}
          </DialogHeader>

          <Tabs defaultValue="teachers" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="teachers">Teachers</TabsTrigger>
              <TabsTrigger value="quizzes">Assigned Quizzes</TabsTrigger>
              <TabsTrigger value="progress">Progress</TabsTrigger>
            </TabsList>

            {/* Teachers Tab */}
            <TabsContent value="teachers" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Teachers in Batch</h3>
                <Button
                  size="sm"
                  onClick={() => setAddTeacherOpen(true)}
                  data-testid="button-add-teacher"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Teacher
                </Button>
              </div>
              {batchDetails?.teachers?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No teachers in this batch yet
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
                <Button
                  size="sm"
                  onClick={() => setAssignQuizOpen(true)}
                  data-testid="button-generate-quiz"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Generate Quiz
                </Button>
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
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">{item.teacher.name}</CardTitle>
                            <CardDescription>
                              Teacher ID: {item.teacher.teacherId} • {item.teacher.email}
                            </CardDescription>
                          </div>
                          <Badge variant={getLevelBadgeVariant(item.reportCard.level)}>
                            {item.reportCard.level}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center">
                            <div className="flex items-center justify-center mb-1">
                              <BookOpen className="h-4 w-4 text-muted-foreground mr-1" />
                            </div>
                            <p className="text-2xl font-bold">{item.reportCard.totalQuizzesTaken}</p>
                            <p className="text-xs text-muted-foreground">Quizzes Taken</p>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center justify-center mb-1">
                              <CheckCircle className="h-4 w-4 text-muted-foreground mr-1" />
                            </div>
                            <p className="text-2xl font-bold">{item.reportCard.totalQuizzesPassed}</p>
                            <p className="text-xs text-muted-foreground">Passed</p>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center justify-center mb-1">
                              <Award className="h-4 w-4 text-muted-foreground mr-1" />
                            </div>
                            <p className="text-2xl font-bold">{item.reportCard.averageScore}%</p>
                            <p className="text-xs text-muted-foreground">Average Score</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Add Teacher Dialog */}
      <Dialog open={addTeacherOpen} onOpenChange={setAddTeacherOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Teacher to {selectedBatch?.name}</DialogTitle>
            <DialogDescription>Enter the teacher's numeric ID</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="teacher-id">Teacher ID</Label>
              <Input
                id="teacher-id"
                type="number"
                data-testid="input-teacher-id"
                placeholder="e.g., 7100"
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
              />
            </div>
            <Button onClick={handleAddTeacher} disabled={!teacherId || addTeacherMutation.isPending} data-testid="button-submit-teacher">
              {addTeacherMutation.isPending ? "Adding..." : "Add Teacher"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Quiz Dialog */}
      <Dialog open={assignQuizOpen} onOpenChange={setAssignQuizOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Quiz for {selectedBatch?.name}</DialogTitle>
            <DialogDescription>Create an AI-generated quiz from training materials and assign it to this batch</DialogDescription>
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
              onClick={handleAssignQuiz}
              disabled={!quizTitle || !selectedWeek || assignQuizMutation.isPending}
              data-testid="button-submit-quiz"
            >
              {assignQuizMutation.isPending ? "Generating & Assigning..." : "Generate & Assign Quiz"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
