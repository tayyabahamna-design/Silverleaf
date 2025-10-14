import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ObjectUploader } from "@/components/ObjectUploader";
import { PresentationViewer } from "@/components/PresentationViewer";
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
import logoImage from "@assets/image_1760460046116.png";
import { FilePreview } from "@/components/FilePreview";

export default function Home() {
  const { toast } = useToast();
  const { user, isAdmin, logoutMutation } = useAuth();
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewingFile, setViewingFile] = useState<{ url: string; name: string } | null>(null);
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
      console.log("[UPLOAD DEBUG] Requesting presigned URL from backend");
      const response = await apiRequest("POST", "/api/objects/upload", {});
      const data = await response.json();
      console.log("[UPLOAD DEBUG] Received presigned URL:", data.uploadURL);
      return {
        method: "PUT" as const,
        url: data.uploadURL,
      };
    } catch (error) {
      console.error("[UPLOAD ERROR] Error getting upload parameters:", error);
      toast({
        title: "Upload error",
        description: "Failed to get upload URL. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleUploadComplete = (weekId: string) => (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    console.log("[UPLOAD DEBUG] Upload complete, result:", result);
    
    if (result.successful && result.successful.length > 0) {
      console.log(`[UPLOAD DEBUG] ${result.successful.length} files uploaded successfully`);
      
      const files = result.successful
        .filter(file => file.uploadURL && file.name)
        .map(file => ({
          fileUrl: file.uploadURL!,
          fileName: file.name!,
          fileSize: file.size || 0,
        }));
      
      console.log("[UPLOAD DEBUG] Sending files to backend:", files);
      
      if (files.length > 0) {
        uploadDeckMutation.mutate({ weekId, files });
      } else {
        console.log("[UPLOAD DEBUG] No valid files to upload");
      }
    } else {
      console.log("[UPLOAD DEBUG] No successful uploads");
    }
    
    if (result.failed && result.failed.length > 0) {
      console.error("[UPLOAD ERROR] Failed uploads:", result.failed);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-primary shadow-md">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 p-1.5">
              <img src={logoImage} alt="Silverleaf Academy Logo" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-white truncate" data-testid="text-app-title">
                Silverleaf Academy
              </h1>
              <p className="text-xs text-white/80 hidden sm:block">
                Training Program Planner
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
            {user && (
              <div className="text-xs sm:text-sm text-white/90 hidden md:block truncate max-w-[200px]" data-testid="text-user-info">
                {user.email} ({user.role})
              </div>
            )}
            <div className="text-white">
              <ThemeToggle />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
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
              disabled={logoutMutation.isPending}
              data-testid="button-logout-mobile"
              className="sm:hidden h-8 w-8 bg-white/10 hover:bg-white/20 text-white border-white/20"
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
                className="border-l-4 border-l-primary border rounded-lg bg-card shadow-sm hover:shadow-md transition-shadow"
                data-testid={`card-week-${week.id}`}
              >
                <div className="flex items-center pr-1 sm:pr-2">
                  <AccordionTrigger className="flex-1 px-3 sm:px-6 py-4 sm:py-5 hover:no-underline">
                    <div className="flex items-center gap-3 sm:gap-4 w-full min-w-0">
                      <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-base sm:text-lg">{week.weekNumber}</span>
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <h3 className="font-semibold text-base sm:text-lg">Week {week.weekNumber}</h3>
                        <p className="text-sm sm:text-base text-muted-foreground truncate mt-0.5">
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
                      className="mr-1 sm:mr-2 h-9 w-9 flex-shrink-0 hover:bg-destructive/10"
                      data-testid={`button-delete-${week.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
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
                          week.deckFiles.map((file) => {
                            // Determine if file should open in Office Online viewer
                            const isPowerPoint = file.fileName.toLowerCase().endsWith('.pptx') || file.fileName.toLowerCase().endsWith('.ppt');
                            const isWord = file.fileName.toLowerCase().endsWith('.docx') || file.fileName.toLowerCase().endsWith('.doc');
                            const isExcel = file.fileName.toLowerCase().endsWith('.xlsx') || file.fileName.toLowerCase().endsWith('.xls');
                            const shouldUseOfficeViewer = isPowerPoint || isWord || isExcel;
                            
                            // Create Office Online viewer URL
                            const fileUrl = `${window.location.origin}${file.fileUrl}`;
                            const viewerUrl = shouldUseOfficeViewer 
                              ? `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(fileUrl)}`
                              : file.fileUrl;
                            
                            return (
                              <div key={file.id} className="rounded-md border overflow-hidden">
                                <div className="flex items-center gap-3">
                                  <div className="flex-shrink-0 w-20 h-20 border-r">
                                    <FilePreview 
                                      fileName={file.fileName} 
                                      fileUrl={file.fileUrl} 
                                      className="w-full h-full"
                                    />
                                  </div>
                                  <button
                                    onClick={() => setViewingFile({ url: file.fileUrl, name: file.fileName })}
                                    className="flex-1 min-w-0 text-left p-3 hover:bg-muted/50 transition-colors"
                                    data-testid={`link-deck-${week.id}-${file.id}`}
                                  >
                                    <div className="flex items-start gap-2">
                                      <ExternalLink className="h-4 w-4 flex-shrink-0 mt-0.5 text-primary" />
                                      <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm truncate">{file.fileName}</div>
                                        <div className="text-xs text-muted-foreground mt-0.5">
                                          {formatFileSize(file.fileSize)}
                                          {shouldUseOfficeViewer && <span className="ml-1">• Click to view</span>}
                                        </div>
                                      </div>
                                    </div>
                                  </button>
                                  {isAdmin && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 mr-2 flex-shrink-0"
                                      onClick={() => deleteDeckFileMutation.mutate({ weekId: week.id, fileId: file.id })}
                                      disabled={deleteDeckFileMutation.isPending}
                                      data-testid={`button-delete-deck-${week.id}-${file.id}`}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        ) : !isAdmin ? (
                          <div className="p-3 rounded-md border">
                            <span className="text-muted-foreground text-sm">No deck uploaded</span>
                          </div>
                        ) : null}
                        {isAdmin && (
                          <ObjectUploader
                            key={`uploader-${week.id}`}
                            maxNumberOfFiles={10}
                            onGetUploadParameters={handleGetUploadParams}
                            onComplete={handleUploadComplete(week.id)}
                          />
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

      {viewingFile && (
        <PresentationViewer
          isOpen={!!viewingFile}
          onClose={() => setViewingFile(null)}
          fileUrl={viewingFile.url}
          fileName={viewingFile.name}
        />
      )}
    </div>
  );
}
