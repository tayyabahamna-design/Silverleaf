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
import { Plus, Trash2, ChevronLeft, GripVertical, Upload, FileText, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
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

function SortableWeekItem({ week, onFilesUploaded }: { week: TrainingWeek; onFilesUploaded?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: week.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleUploadSuccess = (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful.length > 0) {
      onFilesUploaded?.();
      toast({ title: `${result.successful.length} file(s) uploaded successfully` });
    }
  };

  const handleGetUploadParameters = async () => {
    const response = await apiRequest("POST", `/api/training-weeks/${week.id}/upload-url`, {});
    return {
      method: "PUT" as const,
      url: response.url,
    };
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
              <p className="text-sm font-semibold text-primary mb-2">{week.competencyFocus}</p>
              <p className="text-sm text-muted-foreground line-clamp-2">{week.objective}</p>
            </div>
          </div>
        </div>

        {/* Expanded Files Section */}
        {isExpanded && (
          <div className="border-t px-6 py-4 bg-muted/30">
            <div className="space-y-4">
              {/* File Upload */}
              <div>
                <Label className="text-sm font-semibold mb-3 block">Upload Files (PPT, PDF, DOCX, etc.)</Label>
                <ObjectUploader
                  onGetUploadParameters={handleGetUploadParameters}
                  onComplete={handleUploadSuccess}
                />
              </div>

              {/* Files List */}
              {week.deckFiles && week.deckFiles.length > 0 && (
                <div className="pt-4 border-t">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">FILES ({week.deckFiles.length})</p>
                  <div className="space-y-2">
                    {week.deckFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center gap-2 p-2 rounded bg-background text-sm"
                        data-testid={`file-item-${file.id}`}
                      >
                        <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="truncate flex-1">{file.fileName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function AdminCourseWeeks() {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newWeekFocus, setNewWeekFocus] = useState("");
  const [newWeekObjective, setNewWeekObjective] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor)
  );

  const { data: course, isLoading } = useQuery<Course & { weeks: TrainingWeek[] }>({
    queryKey: ["/api/courses", courseId],
    enabled: !!courseId,
  });

  const createWeekMutation = useMutation({
    mutationFn: async () => {
      if (!course) return;
      const maxWeek = course.weeks?.length ?? 0;
      return apiRequest("POST", "/api/training-weeks", {
        courseId,
        weekNumber: maxWeek + 1,
        competencyFocus: newWeekFocus,
        objective: newWeekObjective,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses", courseId] });
      setNewWeekFocus("");
      setNewWeekObjective("");
      setIsDialogOpen(false);
      toast({ title: "Week added successfully" });
    },
  });

  const deleteWeekMutation = useMutation({
    mutationFn: async (weekId: string) => {
      return apiRequest("DELETE", `/api/training-weeks/${weekId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses", courseId] });
      toast({ title: "Week deleted successfully" });
    },
  });

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !course) return;

    const oldIndex = course.weeks.findIndex(w => w.id === active.id);
    const newIndex = course.weeks.findIndex(w => w.id === over.id);

    if (oldIndex !== newIndex) {
      const newWeeks = arrayMove(course.weeks, oldIndex, newIndex);
      
      const updatePromises = newWeeks.map((week, index) =>
        apiRequest("PATCH", `/api/training-weeks/${week.id}`, {
          ...week,
          weekNumber: index + 1,
        })
      );

      await Promise.all(updatePromises);
      queryClient.invalidateQueries({ queryKey: ["/api/courses", courseId] });
    }
  };

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="p-8 text-center max-w-md shadow-lg">
          <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
          <Button onClick={() => navigate("/admin/courses")} variant="outline">
            Back to Courses
          </Button>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-8">
        <div className="max-w-5xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-muted rounded-lg"></div>
            <div className="h-32 bg-muted rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!course) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card shadow-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Button onClick={() => navigate("/admin/courses")} variant="ghost" size="icon">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl sm:text-4xl font-bold truncate">{course.name}</h1>
              <p className="text-muted-foreground text-sm sm:text-base">Manage weeks in this course</p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <Button onClick={() => setIsDialogOpen(true)} data-testid="button-add-week" className="gap-2">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add Week</span>
              </Button>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Week</DialogTitle>
                  <DialogDescription>Create a new week for this course</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="week-focus">Competency Focus</Label>
                    <Input
                      id="week-focus"
                      data-testid="input-week-focus"
                      value={newWeekFocus}
                      onChange={(e) => setNewWeekFocus(e.target.value)}
                      placeholder="Enter competency focus"
                      autoFocus
                    />
                  </div>
                  <div>
                    <Label htmlFor="week-objective">Objective</Label>
                    <Textarea
                      id="week-objective"
                      data-testid="textarea-week-objective"
                      value={newWeekObjective}
                      onChange={(e) => setNewWeekObjective(e.target.value)}
                      placeholder="Enter learning objective"
                      className="min-h-24"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => createWeekMutation.mutate()}
                      disabled={createWeekMutation.isPending || !newWeekFocus.trim()}
                      data-testid="button-submit-week"
                    >
                      Create
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {course.weeks && course.weeks.length > 0 ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={course.weeks.map(w => w.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-4">
                {course.weeks.map((week) => (
                  <div key={week.id} className="flex gap-3 items-start group">
                    <SortableWeekItem 
                      week={week}
                      onFilesUploaded={() => queryClient.invalidateQueries({ queryKey: ["/api/courses", courseId] })}
                    />
                    <Button
                      onClick={() => deleteWeekMutation.mutate(week.id)}
                      variant="destructive"
                      size="sm"
                      className="rounded-lg opacity-0 group-hover:opacity-100 transition-opacity mt-2"
                      data-testid={`button-delete-week-${week.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <Card className="p-12 text-center shadow-lg rounded-2xl border-dashed">
            <Plus className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-lg font-medium mb-2">No weeks yet</p>
            <p className="text-muted-foreground mb-6">Create weeks to organize your course content.</p>
            <Button onClick={() => setIsDialogOpen(true)} size="lg">
              <Plus className="mr-2 h-4 w-4" />
              Create First Week
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
