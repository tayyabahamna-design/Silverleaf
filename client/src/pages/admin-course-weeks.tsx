import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ChevronLeft, GripVertical, Upload, FileText, ChevronDown, ChevronRight, Edit2, Check, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { Course, TrainingWeek } from "@shared/schema";
import { ObjectUploader } from "@/components/ObjectUploader";
import type { UploadResult } from "@uppy/core";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableWeekItem({ week, onFilesUploaded, onWeekUpdated }: { week: TrainingWeek; onFilesUploaded?: () => void; onWeekUpdated?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: week.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingField, setEditingField] = useState<"focus" | "objective" | null>(null);
  const [editValue, setEditValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isSavingRef = useRef(false);
  const lastUploadUrlRef = useRef<string>("");

  useEffect(() => {
    if (editingField === "objective" && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [editingField]);

  const updateWeekMutation = useMutation({
    mutationFn: async (data: Partial<TrainingWeek>) => {
      return apiRequest("PATCH", `/api/training-weeks/${week.id}`, data);
    },
    onSuccess: () => {
      onWeekUpdated?.();
      toast({ title: "Week updated successfully" });
      setEditingField(null);
    },
    onError: () => {
      toast({ title: "Failed to update week", variant: "destructive" });
    },
  });

  const handleUploadSuccess = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful.length > 0) {
      try {
        // Extract the base URL from the presigned URL (remove query parameters)
        const baseUrl = lastUploadUrlRef.current.split('?')[0];
        
        // Register files with the week
        const files = result.successful.map((file: any) => ({
          fileUrl: baseUrl,
          fileName: file.name,
          fileSize: file.size,
        }));
        
        await apiRequest("POST", `/api/training-weeks/${week.id}/deck`, { files });
        onFilesUploaded?.();
        toast({ title: `${result.successful.length} file(s) uploaded successfully` });
      } catch (error) {
        console.error("Error registering files:", error);
        toast({ title: "Files uploaded but failed to register", variant: "destructive" });
      }
    }
  };

  const handleGetUploadParameters = async () => {
    try {
      // Use fetch directly to ensure we get proper JSON response
      const response = await fetch("/api/objects/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      
      if (!response.ok) {
        throw new Error(`Upload URL request failed: ${response.status}`);
      }
      
      const data = await response.json() as { uploadURL: string };
      console.log("[Admin] Received uploadURL:", data.uploadURL);
      lastUploadUrlRef.current = data.uploadURL;
      
      return {
        method: "PUT" as const,
        url: data.uploadURL,
      };
    } catch (error) {
      console.error("[Admin] Error getting upload URL:", error);
      throw error;
    }
  };

  const handleStartEdit = (field: "focus" | "objective") => {
    isSavingRef.current = false;
    setEditingField(field);
    setEditValue(field === "focus" ? week.competencyFocus : week.objective);
  };

  const handleSaveEdit = async () => {
    if (!editValue.trim()) return;
    isSavingRef.current = true;
    const fieldName = editingField === "focus" ? "competencyFocus" : "objective";
    await updateWeekMutation.mutateAsync({ [fieldName]: editValue });
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue("");
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-50" : ""}>
      <Card className="rounded-2xl hover:shadow-lg transition-all duration-300 overflow-hidden">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-2 -m-2 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
              <GripVertical className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4 mb-2">
                <h4 className="font-bold text-lg">Week {week.weekNumber}</h4>
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex-shrink-0 p-1 hover:bg-muted rounded transition-colors"
                  data-testid={`button-expand-week-${week.id}`}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
              </div>
              
              {/* Competency Focus - Editable */}
              <div className="mb-2 group">
                {editingField === "focus" ? (
                  <div className="flex gap-2 items-start">
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveEdit();
                        if (e.key === "Escape") handleCancelEdit();
                      }}
                      onBlur={handleSaveEdit}
                      className="text-sm font-semibold"
                      data-testid={`input-edit-focus-${week.id}`}
                      autoFocus
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleSaveEdit}
                      disabled={updateWeekMutation.isPending}
                      className="h-8 w-8 p-0"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCancelEdit}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleStartEdit("focus")}
                    className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors text-left w-full py-1 px-2 rounded hover:bg-muted/50 flex items-center justify-between"
                    data-testid={`button-edit-focus-${week.id}`}
                  >
                    <span>{week.competencyFocus}</span>
                    <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2" />
                  </button>
                )}
              </div>

              {/* Objective - Editable */}
              <div className="group">
                {editingField === "objective" ? (
                  <div className="flex gap-2 items-start">
                    <Textarea
                      ref={textareaRef}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && e.ctrlKey) handleSaveEdit();
                        if (e.key === "Escape") handleCancelEdit();
                      }}
                      onBlur={handleSaveEdit}
                      className="text-sm min-h-20"
                      data-testid={`textarea-edit-objective-${week.id}`}
                    />
                    <div className="flex flex-col gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleSaveEdit}
                        disabled={updateWeekMutation.isPending}
                        className="h-8 w-8 p-0"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelEdit}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => handleStartEdit("objective")}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left w-full py-1 px-2 rounded hover:bg-muted/50 flex items-center justify-between"
                    data-testid={`button-edit-objective-${week.id}`}
                  >
                    <span>{week.objective || "Add objective..."}</span>
                    <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Expanded Section */}
          {isExpanded && (
            <div className="mt-4 pt-4 border-t space-y-4">
              {/* Files Section */}
              <div>
                <h5 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Files ({week.deckFiles?.length || 0})
                </h5>
                
                {week.deckFiles && week.deckFiles.length > 0 ? (
                  <div className="space-y-2 mb-4">
                    {week.deckFiles.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                        <span className="truncate" data-testid={`text-file-${file.id}`}>{file.fileName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {(file.fileSize / (1024 * 1024)).toFixed(2)} MB
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mb-4">No files uploaded yet</p>
                )}

                {/* File Upload */}
                <details className="group">
                  <summary className="cursor-pointer flex items-center gap-2 text-sm text-primary hover:text-primary/80 mb-3 user-select-none">
                    <Upload className="h-4 w-4" />
                    <span>Upload Files</span>
                  </summary>
                  <div className="bg-muted/30 rounded p-3">
                    <ObjectUploader
                      maxNumberOfFiles={10}
                      maxFileSize={52428800}
                      onGetUploadParameters={handleGetUploadParameters}
                      onComplete={handleUploadSuccess}
                    />
                  </div>
                </details>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

export default function AdminCourseWeeks() {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const navigate = useLocation()[1];
  const { toast } = useToast();
  const [newWeekDialog, setNewWeekDialog] = useState(false);
  const [newWeekData, setNewWeekData] = useState({ competencyFocus: "", objective: "" });

  // Fetch course details
  const courseQuery = useQuery({
    queryKey: ["/api/courses", courseId],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/courses", {});
      const courses = await response.json() as Course[];
      return courses.find((c: Course) => c.id === courseId);
    },
  });

  // Fetch weeks for this course
  const weeksQuery = useQuery({
    queryKey: ["/api/training-weeks", courseId],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/training-weeks", {});
      const weeks = await response.json() as TrainingWeek[];
      return weeks.filter((w: TrainingWeek) => w.courseId === courseId).sort((a: TrainingWeek, b: TrainingWeek) => a.weekNumber - b.weekNumber);
    },
  });

  const [weeks, setWeeks] = useState<TrainingWeek[]>([]);

  useEffect(() => {
    if (weeksQuery.data) {
      setWeeks(weeksQuery.data);
    }
  }, [weeksQuery.data]);

  // Create new week
  const createWeekMutation = useMutation({
    mutationFn: async (data: { competencyFocus: string; objective: string }) => {
      return apiRequest("POST", "/api/training-weeks", {
        courseId,
        weekNumber: (weeks.length || 0) + 1,
        ...data,
      });
    },
    onSuccess: () => {
      setNewWeekDialog(false);
      setNewWeekData({ competencyFocus: "", objective: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/training-weeks"] });
      toast({ title: "Week created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create week", variant: "destructive" });
    },
  });

  // Reorder weeks
  const reorderMutation = useMutation({
    mutationFn: async (orderedWeeks: TrainingWeek[]) => {
      return apiRequest("POST", "/api/training-weeks/reorder", {
        weekIds: orderedWeeks.map(w => w.id),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-weeks"] });
    },
    onError: () => {
      toast({ title: "Failed to reorder weeks", variant: "destructive" });
    },
  });

  // Delete week
  const deleteWeekMutation = useMutation({
    mutationFn: async (weekId: string) => {
      return apiRequest("DELETE", `/api/training-weeks/${weekId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-weeks"] });
      toast({ title: "Week deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete week", variant: "destructive" });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = weeks.findIndex(w => w.id === active.id);
    const newIndex = weeks.findIndex(w => w.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newWeeks = arrayMove(weeks, oldIndex, newIndex);
    setWeeks(newWeeks);
    reorderMutation.mutate(newWeeks);
  };

  if (weeksQuery.isLoading || courseQuery.isLoading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  const course = courseQuery.data;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate("/courses")}
            className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 mb-4"
            data-testid="button-back-to-courses"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Courses
          </button>
          <h1 className="text-3xl font-bold">{course?.name} - Manage Weeks</h1>
        </div>

        {/* Add Week Dialog */}
        <Dialog open={newWeekDialog} onOpenChange={setNewWeekDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Week</DialogTitle>
              <DialogDescription>Add a new training week to this course</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="focus">Competency Focus</Label>
                <Input
                  id="focus"
                  placeholder="e.g., Advanced React Patterns"
                  value={newWeekData.competencyFocus}
                  onChange={(e) => setNewWeekData(prev => ({ ...prev, competencyFocus: e.target.value }))}
                  data-testid="input-new-week-focus"
                />
              </div>
              <div>
                <Label htmlFor="objective">Objective</Label>
                <Textarea
                  id="objective"
                  placeholder="What will participants learn?"
                  value={newWeekData.objective}
                  onChange={(e) => setNewWeekData(prev => ({ ...prev, objective: e.target.value }))}
                  data-testid="textarea-new-week-objective"
                />
              </div>
              <Button
                onClick={() => createWeekMutation.mutate(newWeekData)}
                disabled={!newWeekData.competencyFocus || !newWeekData.objective || createWeekMutation.isPending}
                data-testid="button-create-week"
              >
                Create Week
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Weeks List */}
        <div className="space-y-4">
          {weeks.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={weeks.map(w => w.id)} strategy={verticalListSortingStrategy}>
                {weeks.map((week) => (
                  <div key={week.id} className="flex gap-2">
                    <div className="flex-1">
                      <SortableWeekItem
                        week={week}
                        onFilesUploaded={() => queryClient.invalidateQueries({ queryKey: ["/api/training-weeks"] })}
                        onWeekUpdated={() => queryClient.invalidateQueries({ queryKey: ["/api/training-weeks"] })}
                      />
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteWeekMutation.mutate(week.id)}
                      disabled={deleteWeekMutation.isPending}
                      data-testid={`button-delete-week-${week.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            <Card className="p-8 text-center text-muted-foreground">
              No weeks created yet
            </Card>
          )}
        </div>

        {/* Add Week Button */}
        <Button
          onClick={() => setNewWeekDialog(true)}
          className="mt-6 gap-2"
          data-testid="button-add-week"
        >
          <Plus className="h-4 w-4" />
          Add Week
        </Button>
      </div>
    </div>
  );
}
