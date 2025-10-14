import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ObjectUploader } from "@/components/ObjectUploader";
import { Plus, Pencil, Trash2, Upload, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { TrainingWeek } from "@shared/schema";
import type { UploadResult } from "@uppy/core";

export default function Home() {
  const { toast } = useToast();
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSavingRef = useRef(false); // Track if we're intentionally saving

  // Focus input when entering edit mode
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingCell]);

  // Handle blur: only refocus if NOT intentionally saving
  const handleInputBlur = () => {
    // Don't refocus if we're intentionally saving (Enter/Escape pressed)
    if (isSavingRef.current) return;
    
    // If we're still in edit mode and blur happened unintentionally, refocus
    if (editingCell && inputRef.current) {
      requestAnimationFrame(() => {
        if (editingCell && inputRef.current && !isSavingRef.current) {
          inputRef.current.focus();
        }
      });
    }
  };

  const { data: weeks = [], isLoading } = useQuery<TrainingWeek[]>({
    queryKey: ["/api/training-weeks"],
    refetchOnWindowFocus: false,
    refetchInterval: false,
    staleTime: Infinity,
  });

  const createWeekMutation = useMutation({
    mutationFn: async () => {
      const maxWeek = weeks.length > 0 ? Math.max(...weeks.map(w => w.weekNumber)) : 0;
      return apiRequest("POST", "/api/training-weeks", {
        weekNumber: maxWeek + 1,
        competencyFocus: "",
        objective: "",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-weeks"] });
      toast({ title: "Week added successfully" });
    },
  });

  const updateWeekMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TrainingWeek> }) => {
      return apiRequest("PATCH", `/api/training-weeks/${id}`, data);
    },
    onSuccess: (updatedWeek, variables) => {
      // Update the cache directly instead of invalidating to prevent re-render
      queryClient.setQueryData<TrainingWeek[]>(["/api/training-weeks"], (old) => {
        if (!old) return old;
        return old.map(week => 
          week.id === variables.id ? { ...week, ...variables.data } : week
        );
      });
      setEditingCell(null);
      setEditValue("");
      // Reset the saving flag after save completes
      setTimeout(() => { isSavingRef.current = false; }, 0);
    },
    onError: () => {
      // Reset the saving flag on error to allow refocus if needed
      isSavingRef.current = false;
      toast({ 
        title: "Save failed", 
        description: "Failed to save changes. Please try again.",
        variant: "destructive" 
      });
    },
  });

  const deleteWeekMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/training-weeks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-weeks"] });
      toast({ title: "Week deleted successfully" });
      setDeleteId(null);
    },
  });

  const uploadDeckMutation = useMutation({
    mutationFn: async ({ weekId, fileUrl, fileName, fileSize, year }: {
      weekId: string;
      fileUrl: string;
      fileName: string;
      fileSize: number;
      year: string;
    }) => {
      return apiRequest("POST", `/api/training-weeks/${weekId}/deck`, { fileUrl, fileName, fileSize, year });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-weeks"] });
      toast({ title: "File uploaded successfully" });
    },
  });

  const handleCellEdit = (id: string, field: string, currentValue: string) => {
    setEditingCell({ id, field });
    setEditValue(currentValue);
  };

  const handleCellSave = () => {
    isSavingRef.current = true; // Mark that we're intentionally saving
    if (editingCell && editValue !== "") {
      updateWeekMutation.mutate({
        id: editingCell.id,
        data: { [editingCell.field]: editValue },
      });
    } else if (editingCell) {
      // Cancel editing if no value
      setEditingCell(null);
      setEditValue("");
      setTimeout(() => { isSavingRef.current = false; }, 0);
    }
  };

  const handleCellCancel = () => {
    isSavingRef.current = true; // Mark that we're intentionally canceling
    setEditingCell(null);
    setEditValue("");
    setTimeout(() => { isSavingRef.current = false; }, 0);
  };

  const handleGetUploadParams = async () => {
    try {
      const response = await apiRequest("POST", "/api/objects/upload", {});
      const data = await response.json();
      return {
        method: "PUT" as const,
        url: data.uploadURL,
      };
    } catch (error) {
      console.error("Error getting upload parameters:", error);
      toast({
        title: "Upload error",
        description: "Failed to get upload URL. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleUploadComplete = (weekId: string, year: string) => (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful.length > 0) {
      const file = result.successful[0];
      if (!file.uploadURL || !file.name) return;
      
      uploadDeckMutation.mutate({
        weekId,
        fileUrl: file.uploadURL,
        fileName: file.name,
        fileSize: file.size || 0,
        year,
      });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-bold text-lg">SL</span>
            </div>
            <div>
              <h1 className="text-xl font-bold" data-testid="text-app-title">
                Silver Leaf
              </h1>
              <p className="text-xs text-muted-foreground">
                Training Program Planner
              </p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">Training Weeks</h2>
          <Button
            onClick={() => createWeekMutation.mutate()}
            disabled={createWeekMutation.isPending}
            data-testid="button-add-week"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add New Week
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : weeks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No training weeks yet. Click "Add New Week" to get started!
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="table-training-weeks">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-semibold border-b">Week</th>
                    <th className="text-left p-4 font-semibold border-b min-w-[200px]">Competency Focus</th>
                    <th className="text-left p-4 font-semibold border-b min-w-[200px]">Objective</th>
                    <th className="text-left p-4 font-semibold border-b min-w-[180px]">2024 Deck</th>
                    <th className="text-left p-4 font-semibold border-b min-w-[180px]">2025 Deck</th>
                    <th className="text-left p-4 font-semibold border-b">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((week) => (
                    <tr key={week.id} className="border-b last:border-b-0 hover-elevate" data-testid={`row-week-${week.id}`}>
                      <td className="p-4 font-medium">{week.weekNumber}</td>
                      
                      <td className="p-4">
                        {editingCell?.id === week.id && editingCell?.field === "competencyFocus" ? (
                          <Input
                            ref={inputRef}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleInputBlur}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleCellSave();
                              }
                              if (e.key === "Escape") {
                                e.preventDefault();
                                handleCellCancel();
                              }
                            }}
                            autoFocus
                            disabled={updateWeekMutation.isPending}
                            data-testid={`input-competency-${week.id}`}
                          />
                        ) : (
                          <div
                            onClick={() => handleCellEdit(week.id, "competencyFocus", week.competencyFocus)}
                            className="cursor-text p-2 rounded hover:bg-muted/50 min-h-[2.5rem] flex items-center"
                            data-testid={`text-competency-${week.id}`}
                          >
                            {week.competencyFocus || <span className="text-muted-foreground">Click to edit</span>}
                          </div>
                        )}
                      </td>

                      <td className="p-4">
                        {editingCell?.id === week.id && editingCell?.field === "objective" ? (
                          <Input
                            ref={inputRef}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleInputBlur}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleCellSave();
                              }
                              if (e.key === "Escape") {
                                e.preventDefault();
                                handleCellCancel();
                              }
                            }}
                            autoFocus
                            disabled={updateWeekMutation.isPending}
                            data-testid={`input-objective-${week.id}`}
                          />
                        ) : (
                          <div
                            onClick={() => handleCellEdit(week.id, "objective", week.objective)}
                            className="cursor-text p-2 rounded hover:bg-muted/50 min-h-[2.5rem] flex items-center"
                            data-testid={`text-objective-${week.id}`}
                          >
                            {week.objective || <span className="text-muted-foreground">Click to edit</span>}
                          </div>
                        )}
                      </td>

                      <td className="p-4">
                        {week.deck2024FileName ? (
                          <div className="flex items-center gap-2">
                            <a
                              href={week.deck2024FileUrl || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline flex items-center gap-1 flex-1 truncate"
                              data-testid={`link-deck2024-${week.id}`}
                            >
                              <ExternalLink className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{week.deck2024FileName}</span>
                            </a>
                            <span className="text-xs text-muted-foreground">
                              ({formatFileSize(week.deck2024FileSize || 0)})
                            </span>
                          </div>
                        ) : (
                          <ObjectUploader
                            maxNumberOfFiles={1}
                            onGetUploadParameters={handleGetUploadParams}
                            onComplete={handleUploadComplete(week.id, "2024")}
                            buttonSize="sm"
                            buttonVariant="outline"
                          >
                            <Upload className="mr-2 h-3 w-3" />
                            Upload
                          </ObjectUploader>
                        )}
                      </td>

                      <td className="p-4">
                        {week.deck2025FileName ? (
                          <div className="flex items-center gap-2">
                            <a
                              href={week.deck2025FileUrl || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline flex items-center gap-1 flex-1 truncate"
                              data-testid={`link-deck2025-${week.id}`}
                            >
                              <ExternalLink className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{week.deck2025FileName}</span>
                            </a>
                            <span className="text-xs text-muted-foreground">
                              ({formatFileSize(week.deck2025FileSize || 0)})
                            </span>
                          </div>
                        ) : (
                          <ObjectUploader
                            maxNumberOfFiles={1}
                            onGetUploadParameters={handleGetUploadParams}
                            onComplete={handleUploadComplete(week.id, "2025")}
                            buttonSize="sm"
                            buttonVariant="outline"
                          >
                            <Upload className="mr-2 h-3 w-3" />
                            Upload
                          </ObjectUploader>
                        )}
                      </td>

                      <td className="p-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(week.id)}
                          data-testid={`button-delete-${week.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Training Week</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this training week? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteWeekMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
