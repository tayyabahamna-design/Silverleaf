import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Textarea } from "@/components/ui/textarea";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ObjectUploader } from "@/components/ObjectUploader";
import { PresentationViewer } from "@/components/PresentationViewer";
import { Plus, Trash2, Upload, ExternalLink, LogOut, ChevronRight, ChevronDown, GripVertical, CheckCircle, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Users } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
import type { TrainingWeek, Course } from "@shared/schema";
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isSavingRef = useRef(false); // Track if we're intentionally saving

  // Focus input/textarea when entering edit mode
  useEffect(() => {
    if (editingCell) {
      const isTextarea = editingCell.field === "competencyFocus" || editingCell.field === "objective";
      if (isTextarea && textareaRef.current) {
        textareaRef.current.focus();
      } else if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }, [editingCell]);

  const { data: courses = [], isLoading: isLoadingCourses } = useQuery<Course[]>({
    queryKey: ["/api/courses"],
    refetchOnWindowFocus: false,
    refetchInterval: false,
    staleTime: Infinity,
  });

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
      // Show success message
      toast({ 
        title: "Changes Saved Successfully!", 
        description: "Your updates have been saved to the database."
      });
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = weeks.findIndex((w) => w.id === active.id);
      const newIndex = weeks.findIndex((w) => w.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const weekId = active.id as string;
        const newPosition = newIndex + 1; // Convert to 1-based position
        reorderWeekMutation.mutate({ weekId, newPosition });
      }
    }
    
    setActiveId(null);
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

  // Sortable Week Item Component for Drag and Drop
  interface SortableWeekItemProps {
    week: TrainingWeek;
  }

  function SortableWeekItem({ week }: SortableWeekItemProps) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: week.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.3 : 1,
      zIndex: isDragging ? 50 : undefined,
    };

    return (
      <AccordionItem
        ref={setNodeRef}
        style={style}
        value={week.id}
        className={`mb-6 border-0 rounded-xl bg-card transition-all duration-200 overflow-visible ${
          isDragging 
            ? 'shadow-2xl scale-105 ring-2 ring-primary/50' 
            : 'shadow-lg hover:shadow-xl'
        }`}
        data-testid={`card-week-${week.id}`}
      >
        <div className="flex items-stretch rounded-xl overflow-hidden border border-border/50">
          {/* Drag Handle */}
          <button
            className="flex items-center px-4 sm:px-5 md:px-6 cursor-grab active:cursor-grabbing hover-elevate active-elevate-2 bg-muted/30 dark:bg-muted/20 border-r border-border/50 transition-all touch-none select-none min-w-[48px] sm:min-w-[56px]"
            {...attributes}
            {...listeners}
            data-testid={`drag-handle-${week.id}`}
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-6 w-6 sm:h-7 sm:w-7 text-muted-foreground" />
          </button>

          {/* Card Content */}
          <div className="flex-1 min-w-0">
            <AccordionTrigger className="w-full px-5 sm:px-7 py-5 sm:py-6 hover:no-underline hover-elevate group [&>svg]:data-[state=open]:rotate-180">
              <div className="flex flex-col gap-2.5 w-full min-w-0 pr-2">
                {/* Week Label - Styled as Primary Visual Anchor */}
                <div className="inline-flex items-center gap-2">
                  <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-primary/10 dark:bg-primary/15 border border-primary/30 shadow-sm">
                    <span className="text-primary font-bold text-base sm:text-lg">Week {week.weekNumber}</span>
                  </span>
                </div>

                {/* Competency Focus */}
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm sm:text-base text-muted-foreground truncate leading-relaxed">
                    {week.competencyFocus || "No competency focus set"}
                  </p>
                </div>
              </div>
            </AccordionTrigger>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center px-3 sm:px-4 border-l border-border/50 bg-muted/10 dark:bg-muted/5">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteId(week.id);
              }}
              className="h-11 w-11 hover:bg-destructive/10 hover:text-destructive transition-colors"
              data-testid={`button-delete-${week.id}`}
              aria-label="Delete week"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          </div>
        </div>
        <AccordionContent className="px-4 sm:px-6 pb-6 pt-4 border-t bg-muted/10 dark:bg-muted/5">
          <div className="space-y-6">
            {/* Competency Focus Section */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 mb-3 block">
                Competency Focus
              </label>
              {editingCell?.id === week.id && editingCell?.field === "competencyFocus" ? (
                <div className="space-y-3">
                  <Textarea
                    ref={textareaRef}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.preventDefault();
                        handleCellCancel();
                      }
                    }}
                    autoFocus
                    disabled={updateWeekMutation.isPending}
                    data-testid={`textarea-competency-${week.id}`}
                    className="min-h-[100px] resize-none"
                    placeholder="Develop effective classroom control strategies..."
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleCellSave}
                      disabled={updateWeekMutation.isPending || !editValue.trim()}
                      data-testid={`button-save-competency-${week.id}`}
                      className="flex-1"
                    >
                      {updateWeekMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleCellCancel}
                      disabled={updateWeekMutation.isPending}
                      data-testid={`button-cancel-competency-${week.id}`}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => handleCellEdit(week.id, "competencyFocus", week.competencyFocus)}
                  className="p-4 rounded-lg border bg-muted/30 cursor-text hover:bg-muted/50 transition-colors min-h-[100px]"
                  data-testid={`text-competency-${week.id}`}
                >
                  {week.competencyFocus ? (
                    <p className="text-base leading-relaxed">{week.competencyFocus}</p>
                  ) : (
                    <span className="text-muted-foreground text-sm">Click to edit competency focus</span>
                  )}
                </div>
              )}
            </div>

            {/* Objective Section */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 mb-3 block">
                Objective
              </label>
              {editingCell?.id === week.id && editingCell?.field === "objective" ? (
                <div className="space-y-3">
                  <Textarea
                    ref={textareaRef}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.preventDefault();
                        handleCellCancel();
                      }
                    }}
                    autoFocus
                    disabled={updateWeekMutation.isPending}
                    data-testid={`textarea-objective-${week.id}`}
                    className="min-h-[100px] resize-none"
                    placeholder="Enter the learning objectives for this week..."
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleCellSave}
                      disabled={updateWeekMutation.isPending || !editValue.trim()}
                      data-testid={`button-save-objective-${week.id}`}
                      className="flex-1"
                    >
                      {updateWeekMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleCellCancel}
                      disabled={updateWeekMutation.isPending}
                      data-testid={`button-cancel-objective-${week.id}`}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => handleCellEdit(week.id, "objective", week.objective)}
                  className="p-4 rounded-lg border bg-muted/30 cursor-text hover:bg-muted/50 transition-colors min-h-[100px]"
                  data-testid={`text-objective-${week.id}`}
                >
                  {week.objective ? (
                    <p className="text-base leading-relaxed">{week.objective}</p>
                  ) : (
                    <span className="text-muted-foreground text-sm">Click to edit objective</span>
                  )}
                </div>
              )}
            </div>

            {/* Presentation Deck Section */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 mb-3 block">
                Presentation Deck
              </label>
              <div className="mb-4">
                <ObjectUploader
                  onGetUploadParameters={handleGetUploadParams}
                  onComplete={handleUploadComplete(week.id)}
                  maxNumberOfFiles={10}
                  key={`uploader-${week.id}`}
                />
              </div>
              {week.deckFiles && week.deckFiles.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Uploaded Files:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {week.deckFiles.map((file) => (
                      <div
                        key={file.id}
                        className="border rounded-lg p-4 bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <FilePreview 
                              fileName={file.fileName}
                              fileUrl={file.fileUrl}
                            />
                            <p className="text-sm font-medium truncate mt-2" title={file.fileName}>
                              {file.fileName}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatFileSize(file.fileSize)}
                            </p>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setViewingFile({ url: file.fileUrl, name: file.fileName })}
                              className="h-8 w-8"
                              data-testid={`button-view-${file.id}`}
                              aria-label="View file"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteDeckFileMutation.mutate({ weekId: week.id, fileId: file.id })}
                              className="h-8 w-8 hover:bg-amber-500/10"
                              data-testid={`button-delete-file-${file.id}`}
                              aria-label="Delete file"
                            >
                              <Trash2 className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                  No files uploaded yet
                </p>
              )}
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  }

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
            {user?.role === "admin" && (
              <Link href="/admin">
                <Button
                  variant="secondary"
                  size="sm"
                  data-testid="button-admin-dashboard"
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20"
                >
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Admin Dashboard
                </Button>
              </Link>
            )}
            {(user?.role === "admin" || user?.role === "trainer") && (
              <>
                <Link href="/approvals">
                  <Button
                    variant="secondary"
                    size="sm"
                    data-testid="button-approvals"
                    className="bg-white/10 hover:bg-white/20 text-white border-white/20"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approvals
                  </Button>
                </Link>
                {user?.role === "trainer" && (
                  <Link href="/trainer/batches">
                    <Button
                      variant="secondary"
                      size="sm"
                      data-testid="button-manage-batches"
                      className="bg-white/10 hover:bg-white/20 text-white border-white/20"
                    >
                      <Users className="mr-2 h-4 w-4" />
                      Manage Batches
                    </Button>
                  </Link>
                )}
              </>
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
          <h2 className="text-xl sm:text-2xl font-semibold">Courses</h2>
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
                      Enter the username, email, teacher ID, or teacher name to reset their password.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="userIdentifier">Username, Email, Teacher ID, or Name</Label>
                      <Input
                        id="userIdentifier"
                        placeholder="e.g., admin, teacher@email.com, 7100, or Tayyaba"
                        value={resetUserIdentifier}
                        onChange={(e) => setResetUserIdentifier(e.target.value)}
                        data-testid="input-user-identifier"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <div className="relative">
                        <PasswordInput
                          id="newPassword"
                          placeholder="Enter new password (min 6 characters)"
                          value={resetNewPassword}
                          onChange={(e) => setResetNewPassword(e.target.value)}
                          data-testid="input-new-password"
                        />
                      </div>
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
                            description: "Please enter a valid identifier and password (min 6 characters)",
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

        {isLoadingUser || isLoadingCourses ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : courses.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No courses yet. {isAdmin && 'Go to Admin Dashboard to create courses!'}
          </div>
        ) : (
          // Display courses with their weeks
          <div className="space-y-6">
            {courses.map((course) => {
              const courseWeeks = weeks.filter(w => w.courseId === course.id).sort((a, b) => a.weekNumber - b.weekNumber);
              
              return (
                <div key={course.id} className="border rounded-lg bg-card shadow-sm overflow-hidden" data-testid={`card-course-${course.id}`}>
                  {/* Course Header */}
                  <div className="px-4 sm:px-6 py-4 sm:py-5 bg-gradient-to-r from-primary/5 to-primary/10 border-b">
                    <h3 className="text-lg sm:text-xl font-bold text-foreground">{course.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {courseWeeks.length} week{courseWeeks.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Weeks List */}
                  {courseWeeks.length > 0 ? (
                    <div className="divide-y">
                      {courseWeeks.map((week) => (
                        <button
                          key={week.id}
                          onClick={() => navigate(`/course/${week.id}`)}
                          className="w-full px-4 sm:px-6 py-4 sm:py-5 hover:bg-muted/50 transition-colors text-left hover-elevate group"
                          data-testid={`card-week-${week.id}`}
                        >
                          <div className="flex items-start gap-4">
                            {/* Week Number Badge */}
                            <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 text-sm font-bold text-primary">
                              {week.weekNumber}
                            </div>

                            {/* Week Info */}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-foreground">Week {week.weekNumber}</p>
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                {week.competencyFocus || "No competency focus set"}
                              </p>
                            </div>

                            {/* Arrow Icon */}
                            <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 flex-shrink-0 mt-1" />
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 sm:px-6 py-8 text-center text-muted-foreground text-sm">
                      No weeks in this course yet.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Training Week</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this training week? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) {
                  deleteWeekMutation.mutate(deleteId);
                }
              }}
              className="bg-amber-600 hover:bg-amber-700"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* File Viewer Dialog */}
      {viewingFile && (
        <PresentationViewer
          isOpen={!!viewingFile}
          fileUrl={viewingFile.url}
          fileName={viewingFile.name}
          onClose={() => setViewingFile(null)}
        />
      )}
    </div>
  );
}