import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Trash2, Plus, CheckCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { QuizQuestion } from "@shared/schema";

interface FileQuizEditDialogProps {
  open: boolean;
  onClose: () => void;
  weekId: string;
  fileId: string;
  fileName: string;
  initialQuestions: QuizQuestion[];
  approved: boolean;
  onQuizStatusChange: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  multiple_choice: "MCQ",
  true_false: "True/False",
  open_ended: "Open-ended",
};

export function FileQuizEditDialog({
  open,
  onClose,
  weekId,
  fileId,
  fileName,
  initialQuestions,
  approved,
  onQuizStatusChange,
}: FileQuizEditDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [questions, setQuestions] = useState<QuizQuestion[]>(initialQuestions);

  useEffect(() => {
    if (open) setQuestions(initialQuestions);
  }, [open, initialQuestions]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/training-weeks/${weekId}/quiz-status`] });
    onQuizStatusChange();
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/training-weeks/${weekId}/files/${fileId}/quiz`, { questions });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Quiz saved" });
      invalidate();
    },
    onError: () => toast({ title: "Failed to save quiz", variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/training-weeks/${weekId}/files/${fileId}/quiz/approve`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Quiz approved — teachers can now take it" });
      invalidate();
      onClose();
    },
    onError: () => toast({ title: "Failed to approve quiz", variant: "destructive" }),
  });

  const updateQuestion = (idx: number, patch: Partial<QuizQuestion>) => {
    setQuestions(qs => qs.map((q, i) => i === idx ? { ...q, ...patch } : q));
  };

  const updateOption = (qIdx: number, optIdx: number, value: string) => {
    setQuestions(qs =>
      qs.map((q, i) => {
        if (i !== qIdx) return q;
        const newOpts = [...(q.options ?? [])];
        newOpts[optIdx] = value;
        return { ...q, options: newOpts, correctAnswer: q.correctAnswer === (q.options ?? [])[optIdx] ? "" : q.correctAnswer };
      })
    );
  };

  const deleteQuestion = (idx: number) => setQuestions(qs => qs.filter((_, i) => i !== idx));

  const addQuestion = () => {
    setQuestions(qs => [...qs, {
      id: `q${Date.now()}`,
      question: "",
      type: "multiple_choice",
      options: ["", "", "", ""],
      correctAnswer: "",
      timeLimit: 30,
    }]);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Edit Quiz — {fileName}
            {approved
              ? <Badge className="bg-green-500 text-white text-xs">Approved</Badge>
              : <Badge variant="secondary" className="text-xs">Pending Approval</Badge>
            }
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {questions.map((q, idx) => (
            <div key={q.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">#{idx + 1}</span>
                  <Badge variant="outline" className="text-xs">{TYPE_LABELS[q.type] ?? q.type}</Badge>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteQuestion(idx)}
                  className="text-destructive hover:text-destructive h-7 w-7 p-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div>
                <Label className="text-xs">Question</Label>
                <Textarea
                  value={q.question}
                  onChange={e => updateQuestion(idx, { question: e.target.value })}
                  rows={2}
                  className="mt-1 text-sm resize-none"
                  placeholder="Enter question text…"
                />
              </div>

              {q.type === "multiple_choice" && (
                <div className="space-y-2">
                  <Label className="text-xs">Options (click circle to mark correct)</Label>
                  {(q.options ?? ["", "", "", ""]).map((opt, optIdx) => (
                    <div key={optIdx} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateQuestion(idx, { correctAnswer: opt })}
                        className="shrink-0"
                      >
                        <CheckCircle
                          className={`h-4 w-4 ${opt && q.correctAnswer === opt ? "text-green-500" : "text-muted-foreground/30"}`}
                        />
                      </button>
                      <Input
                        value={opt}
                        onChange={e => updateOption(idx, optIdx, e.target.value)}
                        placeholder={`Option ${optIdx + 1}`}
                        className="text-sm h-8"
                      />
                    </div>
                  ))}
                </div>
              )}

              {q.type === "true_false" && (
                <p className="text-xs text-muted-foreground">Correct: <strong>{q.correctAnswer || "True"}</strong></p>
              )}

              {q.type === "open_ended" && (
                <p className="text-xs text-muted-foreground italic">Open-ended — graded manually.</p>
              )}
            </div>
          ))}

          <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
            <Plus className="h-4 w-4 mr-1" /> Add Question
          </Button>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving…" : "Save Changes"}
          </Button>
          {!approved && (
            <Button
              type="button"
              onClick={() => {
                // Save first, then approve
                saveMutation.mutateAsync().then(() => approveMutation.mutate());
              }}
              disabled={saveMutation.isPending || approveMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              {approveMutation.isPending ? "Approving…" : "Save & Approve"}
            </Button>
          )}
          {approved && (
            <Button
              type="button"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Re-approve
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
