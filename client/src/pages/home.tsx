import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ObjectUploader } from "@/components/ObjectUploader";
import { Plus, Pencil, Trash2, Upload, ExternalLink, LogOut, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  const { user, isAdmin, logoutMutation } = useAuth();
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
    mutationFn: async ({ weekId, files }: {
      weekId: string;
      files: Array<{ fileUrl: string; fileName: string; fileSize: number }>;
    }) => {
      return apiRequest("POST", `/api/training-weeks/${weekId}/deck`, { files });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-weeks"] });
      const count = variables.files.length;
      toast({ title: `${count} file${count > 1 ? 's' : ''} uploaded successfully` });
    },
  });

  const deleteDeckFileMutation = useMutation({
    mutationFn: async ({ weekId, fileId }: { weekId: string; fileId: string }) => {
      return apiRequest("DELETE", `/api/training-weeks/${weekId}/deck/${fileId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-weeks"] });
      toast({ title: "File deleted successfully" });
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

  const handleUploadComplete = (weekId: string) => (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful.length > 0) {
      const files = result.successful
        .filter(file => file.uploadURL && file.name)
        .map(file => ({
          fileUrl: file.uploadURL!,
          fileName: file.name!,
          fileSize: file.size || 0,
        }));
      
      if (files.length > 0) {
        uploadDeckMutation.mutate({ weekId, files });
      }
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-primary font-bold text-base sm:text-lg">SL</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold truncate" data-testid="text-app-title">
                Silver Leaf
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Training Program Planner
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
            {user && (
              <div className="text-xs sm:text-sm text-muted-foreground hidden md:block truncate max-w-[200px]" data-testid="text-user-info">
                {user.email} ({user.role})
              </div>
            )}
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              data-testid="button-logout"
              className="hidden sm:flex"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              data-testid="button-logout-mobile"
              className="sm:hidden h-8 w-8"
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-semibold">Training Weeks</h2>
          {isAdmin && (
            <Button
              onClick={() => createWeekMutation.mutate()}
              disabled={createWeekMutation.isPending}
              data-testid="button-add-week"
              className="w-full sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add New Week
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : weeks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No training weeks yet. {isAdmin && 'Click "Add New Week" to get started!'}
          </div>
        ) : (
          <Accordion type="multiple" className="space-y-3 sm:space-y-4" data-testid="accordion-training-weeks">
            {weeks.map((week) => (
              <AccordionItem
                key={week.id}
                value={week.id}
                className="border rounded-lg"
                data-testid={`card-week-${week.id}`}
              >
                <div className="flex items-center pr-1 sm:pr-2">
                  <AccordionTrigger className="flex-1 px-3 sm:px-6 py-3 sm:py-4 hover:no-underline">
                    <div className="flex items-center gap-2 sm:gap-4 w-full min-w-0">
                      <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-primary font-bold text-sm sm:text-base">{week.weekNumber}</span>
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <h3 className="font-semibold text-sm sm:text-base">Week {week.weekNumber}</h3>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">
                          {week.competencyFocus || "No competency focus set"}
                        </p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(week.id)}
                      className="mr-1 sm:mr-2 h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0"
                      data-testid={`button-delete-${week.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-destructive" />
                    </Button>
                  )}
                </div>
                <AccordionContent className="pt-3 sm:pt-4 pb-4 px-3 sm:px-6">
                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-2 block">
                        Competency Focus
                      </label>
                      {isAdmin && editingCell?.id === week.id && editingCell?.field === "competencyFocus" ? (
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
                          onClick={isAdmin ? () => handleCellEdit(week.id, "competencyFocus", week.competencyFocus) : undefined}
                          className={`p-3 rounded-md border ${isAdmin ? "cursor-text hover:bg-muted/50" : ""}`}
                          data-testid={`text-competency-${week.id}`}
                        >
                          {week.competencyFocus || <span className="text-muted-foreground text-sm">{isAdmin ? "Click to edit" : "Not set"}</span>}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-2 block">
                        Objective
                      </label>
                      {isAdmin && editingCell?.id === week.id && editingCell?.field === "objective" ? (
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
                          onClick={isAdmin ? () => handleCellEdit(week.id, "objective", week.objective) : undefined}
                          className={`p-3 rounded-md border ${isAdmin ? "cursor-text hover:bg-muted/50" : ""}`}
                          data-testid={`text-objective-${week.id}`}
                        >
                          {week.objective || <span className="text-muted-foreground text-sm">{isAdmin ? "Click to edit" : "Not set"}</span>}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-2 block">
                        Presentation Deck
                      </label>
                      <div className="space-y-2">
                        {week.deckFiles && week.deckFiles.length > 0 ? (
                          week.deckFiles.map((file) => (
                            <div key={file.id} className="p-3 rounded-md border flex items-center justify-between gap-2">
                              <a
                                href={file.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline flex items-center gap-2 flex-1 min-w-0"
                                data-testid={`link-deck-${week.id}-${file.id}`}
                              >
                                <ExternalLink className="h-4 w-4 flex-shrink-0" />
                                <span className="truncate">{file.fileName}</span>
                              </a>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-sm text-muted-foreground">
                                  ({formatFileSize(file.fileSize)})
                                </span>
                                {isAdmin && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => deleteDeckFileMutation.mutate({ weekId: week.id, fileId: file.id })}
                                    disabled={deleteDeckFileMutation.isPending}
                                    data-testid={`button-delete-deck-${week.id}-${file.id}`}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))
                        ) : !isAdmin ? (
                          <div className="p-3 rounded-md border">
                            <span className="text-muted-foreground text-sm">No deck uploaded</span>
                          </div>
                        ) : null}
                        {isAdmin && (
                          <ObjectUploader
                            maxNumberOfFiles={10}
                            onGetUploadParameters={handleGetUploadParams}
                            onComplete={handleUploadComplete(week.id)}
                            buttonSize="default"
                            buttonVariant="outline"
                            data-testid={`uploader-deck-${week.id}`}
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            Upload Deck Files
                          </ObjectUploader>
                        )}
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
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
