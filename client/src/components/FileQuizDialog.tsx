import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { QuizQuestion } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FileQuizDialogProps {
  weekId: string;
  fileId: string;
  fileName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FileQuizDialog({ weekId, fileId, fileName, open, onOpenChange }: FileQuizDialogProps) {
  const { toast } = useToast();
  const [quizState, setQuizState] = useState<'loading' | 'quiz' | 'results'>('loading');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<{
    score: number;
    totalQuestions: number;
    passed: boolean;
    percentage: number;
  } | null>(null);

  const generateQuizMutation = useMutation({
    mutationFn: async () => {
      console.log('[FILE-QUIZ-DIALOG] Generating quiz for file:', fileId, fileName);
      const url = `/api/training-weeks/${weekId}/files/${fileId}/generate-quiz`;
      const response = await apiRequest('POST', url, {});
      const data = await response.json();
      return data.questions;
    },
    onSuccess: (generatedQuestions: QuizQuestion[]) => {
      console.log('[FILE-QUIZ-DIALOG] Got', generatedQuestions.length, 'questions');
      setQuestions(generatedQuestions);
      setAnswers({});
      setQuizState('quiz');
    },
    onError: (error: Error) => {
      console.error('[FILE-QUIZ-DIALOG] Error:', error);
      toast({
        title: "Quiz Generation Failed",
        description: error.message || "Unable to generate quiz. Please try again.",
        variant: "destructive",
      });
      onOpenChange(false);
    },
  });

  const submitQuizMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/training-weeks/${weekId}/files/${fileId}/submit-quiz`, {
        questions,
        answers,
      });
      return await response.json();
    },
    onSuccess: (data) => {
      setResults(data);
      setQuizState('results');
      queryClient.invalidateQueries({ queryKey: ['/api/training-weeks', weekId, 'deck-progress'] });
      queryClient.invalidateQueries({ queryKey: ['/api/training-weeks', weekId, 'file-quiz-progress'] });
      queryClient.invalidateQueries({ queryKey: ['/api/training-weeks', weekId, 'files', fileId, 'quiz-passed'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit quiz. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setQuizState('loading');
      setAnswers({});
      setResults(null);
      
      setTimeout(() => {
        generateQuizMutation.mutate();
      }, 100);
    }
    
    if (!newOpen) {
      setQuizState('loading');
      setQuestions([]);
      setAnswers({});
      setResults(null);
    }
    
    onOpenChange(newOpen);
  };

  const handleSubmit = () => {
    if (Object.keys(answers).length < questions.length) {
      toast({
        title: "Incomplete Quiz",
        description: "Please answer all questions before submitting.",
        variant: "destructive",
      });
      return;
    }
    submitQuizMutation.mutate();
  };

  const handleRetake = () => {
    setQuizState('loading');
    setAnswers({});
    setResults(null);
    generateQuizMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Quiz: {fileName}</DialogTitle>
          <DialogDescription>
            {quizState === 'quiz' && "Answer all 5 questions to complete this file's checkpoint."}
            {quizState === 'results' && "Review your quiz results below."}
            {quizState === 'loading' && "Generating quiz questions from this presentation..."}
          </DialogDescription>
        </DialogHeader>

        {quizState === 'loading' && (
          <div className="flex flex-col items-center justify-center py-12" data-testid="loading-state">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">Analyzing presentation content...</p>
            <p className="text-xs text-muted-foreground mt-1">This may take 10-15 seconds</p>
          </div>
        )}

        {quizState === 'quiz' && (
          <div className="space-y-6 py-4">
            {questions.map((question, index) => (
              <div key={question.id} className="space-y-3" data-testid={`question-${question.id}`}>
                <h3 className="font-semibold">
                  {index + 1}. {question.question}
                </h3>
                <RadioGroup
                  value={answers[question.id] || ""}
                  onValueChange={(value) => setAnswers({ ...answers, [question.id]: value })}
                >
                  {question.options.map((option, optionIndex) => (
                    <div key={optionIndex} className="flex items-center space-x-2">
                      <RadioGroupItem
                        value={option}
                        id={`${question.id}-${optionIndex}`}
                        data-testid={`radio-${question.id}-${optionIndex}`}
                      />
                      <Label
                        htmlFor={`${question.id}-${optionIndex}`}
                        className="cursor-pointer flex-1"
                      >
                        {option}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            ))}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-quiz"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitQuizMutation.isPending}
                data-testid="button-submit-quiz"
              >
                {submitQuizMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Quiz"
                )}
              </Button>
            </div>
          </div>
        )}

        {quizState === 'results' && results && (
          <div className="space-y-6 py-4">
            <div className="text-center p-6 bg-muted/30 rounded-lg">
              <div className="text-5xl font-bold mb-2" data-testid="text-score">
                {results.percentage}%
              </div>
              <p className="text-muted-foreground mb-4">
                {results.score} out of {results.totalQuestions} correct
              </p>
              {results.passed ? (
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <CheckCircle2 className="h-6 w-6" />
                  <span className="font-semibold">Passed!</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-destructive">
                  <XCircle className="h-6 w-6" />
                  <span className="font-semibold">Not Passed (70% required)</span>
                </div>
              )}
            </div>

            {/* Show correct answers */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Review Answers</h3>
              {questions.map((question, index) => {
                const userAnswer = answers[question.id];
                const isCorrect = userAnswer === question.correctAnswer;
                return (
                  <div
                    key={question.id}
                    className={`p-4 rounded-lg border-2 ${
                      isCorrect ? 'border-green-500/30 bg-green-50/50 dark:bg-green-950/20' : 'border-red-500/30 bg-red-50/50 dark:bg-red-950/20'
                    }`}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      {isCorrect ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className="font-medium mb-2">
                          {index + 1}. {question.question}
                        </p>
                        <p className="text-sm text-muted-foreground mb-1">
                          <span className="font-medium">Your answer:</span> {userAnswer || "Not answered"}
                        </p>
                        {!isCorrect && (
                          <p className="text-sm text-green-700 dark:text-green-400">
                            <span className="font-medium">Correct answer:</span> {question.correctAnswer}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              {results.passed ? (
                <Button onClick={() => onOpenChange(false)} data-testid="button-close">
                  Close
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-close">
                    Close
                  </Button>
                  <Button onClick={handleRetake} data-testid="button-retake">
                    Retake Quiz
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
