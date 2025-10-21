import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { Users, Plus, Trash2 } from "lucide-react";

export default function TrainerBatches() {
  const { toast } = useToast();
  const [createBatchOpen, setCreateBatchOpen] = useState(false);
  const [addTeacherOpen, setAddTeacherOpen] = useState(false);
  const [assignQuizOpen, setAssignQuizOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);

  const [batchName, setBatchName] = useState("");
  const [batchDescription, setBatchDescription] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [quizTitle, setQuizTitle] = useState("");
  const [quizDescription, setQuizDescription] = useState("");
  const [selectedWeek, setSelectedWeek] = useState("");
  const [numQuestions, setNumQuestions] = useState("5");

  const { data: batches = [] } = useQuery({
    queryKey: ["/api/batches"],
  });

  const { data: weeks = [] } = useQuery({
    queryKey: ["/api/training-weeks"],
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
      toast({ title: "Success", description: "Quiz assigned successfully" });
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Batch Management</h1>
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
              <DialogDescription>Create a batch to group teachers and assign quizzes</DialogDescription>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {batches.map((batch: any) => (
          <Card key={batch.id} data-testid={`card-batch-${batch.id}`}>
            <CardHeader>
              <CardTitle>{batch.name}</CardTitle>
              {batch.description && <CardDescription>{batch.description}</CardDescription>}
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSelectedBatch(batch);
                  setAddTeacherOpen(true);
                }}
                data-testid={`button-add-teacher-${batch.id}`}
              >
                <Users className="mr-2 h-4 w-4" />
                Add Teacher
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSelectedBatch(batch);
                  setAssignQuizOpen(true);
                }}
                data-testid={`button-assign-quiz-${batch.id}`}
              >
                <Plus className="mr-2 h-4 w-4" />
                Assign Quiz
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

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

      <Dialog open={assignQuizOpen} onOpenChange={setAssignQuizOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Quiz to {selectedBatch?.name}</DialogTitle>
            <DialogDescription>Generate and assign a quiz from a training week</DialogDescription>
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
              {assignQuizMutation.isPending ? "Assigning..." : "Assign Quiz"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
