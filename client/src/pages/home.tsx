import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ObjectUploader } from "@/components/ObjectUploader";
import { PresentationViewer } from "@/components/PresentationViewer";
import { Plus, Pencil, Trash2, Upload, ExternalLink, LogOut, ChevronDown, ChevronRight, ChevronUp, MoveUp, MoveDown } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { TrainingWeek } from "@shared/schema";
import type { UploadResult } from "@uppy/core";
import logoImage from "@assets/image_1760460046116.png";
import { FilePreview } from "@/components/FilePreview";

export default function Home() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user, isAdmin, logoutMutation, isLoading: isLoadingUser } = useAuth();
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewingFile, setViewingFile] = useState<{ url: string; name: string } | null>(null);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [resetUserIdentifier, setResetUserIdentifier] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
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

  const { data: weeks = [], isLoading: isLoadingWeeks } = useQuery<TrainingWeek[]>({
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

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userIdentifier, newPassword }: { userIdentifier: string; newPassword: string }) => {
      return apiRequest("POST", "/api/admin/reset-user-password", { userIdentifier, newPassword });
    },
    onSuccess: (data: any) => {
      toast({ 
        title: "Password Reset Successful", 
        description: data.message 
      });
      setResetPasswordOpen(false);
      setResetUserIdentifier("");
      setResetNewPassword("");
    },
    onError: (error: any) => {
      toast({
        title: "Password Reset Failed",
        description: error.message || "Could not reset password",
        variant: "destructive",
      });
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

  const reorderWeekMutation = useMutation({
    mutationFn: async ({ weekId, newPosition }: { weekId: string; newPosition: number }) => {
      return apiRequest("POST", "/api/training-weeks/reorder", { weekId, newPosition });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-weeks"] });
      toast({ title: "Week reordered successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Reorder failed",
        description: error.message || "Failed to reorder week. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleMoveWeek = (weekId: string, currentPosition: number, direction: 'up' | 'down') => {
    const newPosition = direction === 'up' ? currentPosition - 1 : currentPosition + 1;
    reorderWeekMutation.mutate({ weekId, newPosition });
  };

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
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Dialog open={resetPasswordOpen} onOpenChange={setResetPasswordOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    data-testid="button-reset-password"
                  >
                    Reset User Password
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Reset User Password</DialogTitle>
                    <DialogDescription>
                      Enter the username or email of the user whose password you want to reset.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="userIdentifier">Username or Email</Label>
                      <Input
                        id="userIdentifier"
                        placeholder="Enter username or email"
                        value={resetUserIdentifier}
                        onChange={(e) => setResetUserIdentifier(e.target.value)}
                        data-testid="input-user-identifier"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        placeholder="Enter new password (min 6 characters)"
                        value={resetNewPassword}
                        onChange={(e) => setResetNewPassword(e.target.value)}
                        data-testid="input-new-password"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setResetPasswordOpen(false)}
                      data-testid="button-cancel-reset"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        const trimmedIdentifier = resetUserIdentifier.trim();
                        const trimmedPassword = resetNewPassword.trim();
                        
                        if (trimmedIdentifier && trimmedPassword.length >= 6) {
                          resetPasswordMutation.mutate({
                            userIdentifier: trimmedIdentifier,
                            newPassword: trimmedPassword,
                          });
                        } else {
                          toast({
                            title: "Validation Error",
                            description: "Please enter a valid username/email and password (min 6 characters)",
                            variant: "destructive",
                          });
                        }
                      }}
                      disabled={
                        !resetUserIdentifier.trim() || 
                        resetNewPassword.trim().length < 6 || 
                        resetPasswordMutation.isPending
                      }
                      data-testid="button-confirm-reset"
                    >
                      {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button
                onClick={() => createWeekMutation.mutate()}
                disabled={createWeekMutation.isPending}
                data-testid="button-add-week"
                className="w-full sm:w-auto"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add New Week
              </Button>
            </div>
          )}
        </div>

        {isLoadingUser || isLoadingWeeks ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : weeks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No training weeks yet. {isAdmin && 'Click "Add New Week" to get started!'}
          </div>
        ) : !isAdmin ? (
          // Teacher view: Clickable cards that navigate to course view
          <div className="space-y-5 sm:space-y-6">
            {weeks.map((week) => (
              <button
                key={week.id}
                onClick={() => navigate(`/course/${week.id}`)}
                className="w-full border-l-4 border-l-primary border-0 rounded-2xl bg-card shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 text-left"
                data-testid={`card-week-${week.id}`}
              >
                <div className="flex items-center justify-between px-5 sm:px-10 py-6 sm:py-8">
                  <div className="flex items-center gap-5 sm:gap-6 flex-1 min-w-0">
                    <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-primary flex items-center justify-center flex-shrink-0 shadow-md">
                      <span className="text-white font-bold text-xl sm:text-2xl">{week.weekNumber}</span>
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <h3 className="font-extrabold text-xl sm:text-2xl mb-2">Week {week.weekNumber}</h3>
                      <p className="text-sm sm:text-base text-muted-foreground/80 truncate leading-relaxed">
                        {week.competencyFocus || "No competency focus set"}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-6 w-6 text-muted-foreground flex-shrink-0" />
                </div>
              </button>
            ))}
          </div>
        ) : (
          // Admin view: Accordion for editing
          <Accordion type="multiple" className="space-y-5 sm:space-y-6" data-testid="accordion-training-weeks">
            {weeks.map((week) => (
              <AccordionItem
                key={week.id}
                value={week.id}
                className="border-l-4 border-l-primary border-0 rounded-2xl bg-card shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
                data-testid={`card-week-${week.id}`}
              >
                <div className="flex items-center pr-3 sm:pr-4 gap-1">
                  <AccordionTrigger className="flex-1 px-5 sm:px-10 py-6 sm:py-8 hover:no-underline">
                    <div className="flex items-center gap-5 sm:gap-6 w-full min-w-0">
                      <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-primary flex items-center justify-center flex-shrink-0 shadow-md">
                        <span className="text-white font-bold text-xl sm:text-2xl">{week.weekNumber}</span>
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <h3 className="font-extrabold text-xl sm:text-2xl mb-2">Week {week.weekNumber}</h3>
                        <p className="text-sm sm:text-base text-muted-foreground/80 truncate leading-relaxed">
                          {week.competencyFocus || "No competency focus set"}
                        </p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleMoveWeek(week.id, week.weekNumber, 'up')}
                      disabled={week.weekNumber === 1 || reorderWeekMutation.isPending}
                      className="h-10 w-10 rounded-xl hover:bg-primary/10 transition-colors disabled:opacity-50"
                      data-testid={`button-move-up-${week.id}`}
                      aria-label="Move week up"
                    >
                      <MoveUp className="h-4 w-4 text-primary" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleMoveWeek(week.id, week.weekNumber, 'down')}
                      disabled={week.weekNumber === weeks.length || reorderWeekMutation.isPending}
                      className="h-10 w-10 rounded-xl hover:bg-primary/10 transition-colors disabled:opacity-50"
                      data-testid={`button-move-down-${week.id}`}
                      aria-label="Move week down"
                    >
                      <MoveDown className="h-4 w-4 text-primary" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(week.id)}
                      className="h-10 w-10 rounded-xl hover:bg-amber-500/10 transition-colors"
                      data-testid={`button-delete-${week.id}`}
                      aria-label="Delete week"
                    >
                      <Trash2 className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                    </Button>
                  </div>
                </div>
                <AccordionContent className="pt-6 sm:pt-8 pb-6 sm:pb-8 px-5 sm:px-10">
                  <div className="space-y-6 sm:space-y-8">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 mb-3 block">
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
                          className="text-base"
                        />
                      ) : (
                        <div
                          onClick={isAdmin ? () => handleCellEdit(week.id, "competencyFocus", week.competencyFocus) : undefined}
                          className={`p-4 rounded-lg border bg-muted/30 ${isAdmin ? "cursor-text hover:bg-muted/50 transition-colors" : ""}`}
                          data-testid={`text-competency-${week.id}`}
                        >
                          {week.competencyFocus ? (
                            <p className="text-base leading-relaxed">{week.competencyFocus}</p>
                          ) : (
                            <span className="text-muted-foreground text-sm">{isAdmin ? "Click to edit" : "Not set"}</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 mb-3 block">
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
                          className="text-base"
                        />
                      ) : (
                        <div
                          onClick={isAdmin ? () => handleCellEdit(week.id, "objective", week.objective) : undefined}
                          className={`p-4 rounded-lg border bg-muted/30 ${isAdmin ? "cursor-text hover:bg-muted/50 transition-colors" : ""}`}
                          data-testid={`text-objective-${week.id}`}
                        >
                          {week.objective ? (
                            <p className="text-base leading-relaxed">{week.objective}</p>
                          ) : (
                            <span className="text-muted-foreground text-sm">{isAdmin ? "Click to edit" : "Not set"}</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 mb-3 block">
                        Presentation Deck
                      </label>
                      <div className="space-y-3">
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
                              <div key={file.id} className="rounded-xl border-0 overflow-hidden shadow-md hover:shadow-lg transition-all duration-200 bg-muted/20 hover:bg-muted/30">
                                <div className="flex items-center gap-4">
                                  <div className="flex-shrink-0 w-20 h-20 border-r border-border/50">
                                    <FilePreview 
                                      fileName={file.fileName} 
                                      fileUrl={file.fileUrl} 
                                      className="w-full h-full"
                                    />
                                  </div>
                                  <button
                                    onClick={() => setViewingFile({ url: file.fileUrl, name: file.fileName })}
                                    className="flex-1 min-w-0 text-left py-4 pr-2 transition-colors"
                                    data-testid={`link-deck-${week.id}-${file.id}`}
                                  >
                                    <div className="flex items-start gap-3">
                                      <ExternalLink className="h-5 w-5 flex-shrink-0 mt-0.5 text-primary" />
                                      <div className="flex-1 min-w-0">
                                        <div className="font-bold text-base truncate">{file.fileName}</div>
                                        <div className="text-xs text-muted-foreground/70 mt-1.5">
                                          {formatFileSize(file.fileSize)}
                                          {shouldUseOfficeViewer && <span className="ml-2">• Click to view</span>}
                                        </div>
                                      </div>
                                    </div>
                                  </button>
                                  {isAdmin && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-10 w-10 mr-3 flex-shrink-0 rounded-xl hover:bg-amber-500/10 transition-colors"
                                      onClick={() => deleteDeckFileMutation.mutate({ weekId: week.id, fileId: file.id })}
                                      disabled={deleteDeckFileMutation.isPending}
                                      data-testid={`button-delete-deck-${week.id}-${file.id}`}
                                    >
                                      <Trash2 className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        ) : !isAdmin ? (
                          <div className="p-4 rounded-lg border bg-muted/30">
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
