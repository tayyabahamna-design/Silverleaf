import { useState, useRef, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { ObjectUploader } from "@/components/ObjectUploader";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogOut } from "lucide-react";
import logoImage from "@assets/image_1760460046116.png";
import type { Course, TrainingWeek } from "@shared/schema";
import type { UploadResult } from "@uppy/core";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function CourseWeeks() {
  const { courseId } = useParams<{ courseId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user, isAdmin, isTrainer, logoutMutation } = useAuth();
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleteWeekId, setDeleteWeekId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Fetch course
  const { data: courseData, isLoading: isLoadingCourse } = useQuery<Course>({
    queryKey: ["/api/courses", courseId],
    enabled: !!courseId,
  });
  const course = courseData;

  // Fetch weeks for this course
  const { data: weeks = [], isLoading: isLoadingWeeks } = useQuery<TrainingWeek[]>({
    queryKey: ["/api/courses", courseId, "weeks"],
    enabled: !!courseId,
  });

  // Create week mutation
  const createWeekMutation = useMutation({
    mutationFn: async () => {
      const maxWeek = weeks.length > 0 ? Math.max(...weeks.map(w => w.weekNumber)) : 0;
      return apiRequest("POST", "/api/training-weeks", {
        weekNumber: maxWeek + 1,
        competencyFocus: "",
        objective: "",
        courseId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses", courseId, "weeks"] });
      toast({ title: "Week added" });
    },
  });

  // Update week mutation
  const updateWeekMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TrainingWeek> }) => {
      return apiRequest("PATCH", `/api/training-weeks/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses", courseId, "weeks"] });
      setEditingCell(null);
      setEditValue("");
      toast({ title: "Week updated" });
    },
  });

  // Delete week mutation
  const deleteWeekMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/training-weeks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses", courseId, "weeks"] });
      setDeleteWeekId(null);
      toast({ title: "Week deleted" });
    },
  });

  // Upload deck mutation
  const uploadDeckMutation = useMutation({
    mutationFn: async ({ weekId, files }: {
      weekId: string;
      files: Array<{ fileUrl: string; fileName: string; fileSize: number }>;
    }) => {
      return apiRequest("POST", `/api/training-weeks/${weekId}/deck`, { files });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses", courseId, "weeks"] });
      toast({ title: "File uploaded" });
    },
  });

  // Delete deck file mutation
  const deleteDeckFileMutation = useMutation({
    mutationFn: async ({ weekId, fileId }: { weekId: string; fileId: string }) => {
      return apiRequest("DELETE", `/api/training-weeks/${weekId}/deck/${fileId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses", courseId, "weeks"] });
      toast({ title: "File deleted" });
    },
  });

  const handleGetUploadParams = async () => {
    try {
      const response = await apiRequest("POST", "/api/objects/upload", {});
      const data = await response.json();
      return {
        method: "PUT" as const,
        url: data.uploadURL,
      };
    } catch (error) {
      toast({
        title: "Upload error",
        description: "Failed to get upload URL",
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

  const handleCellEdit = (id: string, field: string, currentValue: string) => {
    setEditingCell({ id, field });
    setEditValue(currentValue);
  };

  const handleCellSave = () => {
    if (editingCell && editValue !== "") {
      updateWeekMutation.mutate({
        id: editingCell.id,
        data: { [editingCell.field]: editValue },
      });
    } else if (editingCell) {
      setEditingCell(null);
      setEditValue("");
    }
  };

  const handleCellCancel = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const sortedWeeks = [...weeks].sort((a, b) => a.weekNumber - b.weekNumber);

  if (isLoadingCourse) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-primary shadow-md">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="h-12 w-12 sm:h-14 sm:w-14 flex items-center justify-center flex-shrink-0 bg-primary rounded-sm p-1">
              <img src={logoImage} alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-white truncate">
                {course?.name || "Course"}
              </h1>
              <p className="text-xs sm:text-sm text-white/80 hidden sm:block">
                Weeks & Content
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
            <div className="text-white">
              <ThemeToggle />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
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
              className="sm:hidden h-8 w-8 bg-white/10 hover:bg-white/20 text-white border-white/20"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            data-testid="button-back-to-courses"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Courses
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-6 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold">Training Weeks</h2>
          {isAdmin && (
            <Button
              onClick={() => createWeekMutation.mutate()}
              disabled={createWeekMutation.isPending}
              data-testid="button-add-week"
              className="bg-green-600 hover:bg-green-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Week
            </Button>
          )}
        </div>

        {isLoadingWeeks ? (
          <div className="text-center py-12 text-muted-foreground">Loading weeks...</div>
        ) : sortedWeeks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {isAdmin ? "No weeks yet. Click 'Add Week' to get started!" : "No weeks in this course yet."}
          </div>
        ) : (
          <Accordion type="multiple" className="space-y-4">
            {sortedWeeks.map((week) => (
              <AccordionItem
                key={week.id}
                value={week.id}
                className="border rounded-lg overflow-hidden"
                data-testid={`card-week-${week.id}`}
              >
                <AccordionTrigger className="px-4 py-3 hover:bg-muted/50">
                  <div className="flex items-center gap-3 text-left">
                    <div className="px-3 py-1 rounded-full bg-primary/10 border border-primary/30">
                      <span className="text-sm font-bold text-primary">Week {week.weekNumber}</span>
                    </div>
                    <p className="text-muted-foreground truncate text-sm">
                      {week.competencyFocus || "No competency focus set"}
                    </p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 py-4 bg-muted/5 space-y-4">
                  {/* Competency Focus */}
                  <div>
                    <label className="text-xs font-bold uppercase text-muted-foreground/60 mb-2 block">
                      Competency Focus
                    </label>
                    {editingCell?.id === week.id && editingCell?.field === "competencyFocus" && isAdmin ? (
                      <div className="space-y-2">
                        <Textarea
                          ref={textareaRef}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          data-testid={`textarea-competency-${week.id}`}
                          className="min-h-[80px]"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleCellSave} disabled={updateWeekMutation.isPending}>
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleCellCancel}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm" onClick={() => isAdmin && handleCellEdit(week.id, "competencyFocus", week.competencyFocus || "")} role={isAdmin ? "button" : undefined}>
                        {week.competencyFocus || "Click to add..."}
                      </p>
                    )}
                  </div>

                  {/* Objective */}
                  <div>
                    <label className="text-xs font-bold uppercase text-muted-foreground/60 mb-2 block">
                      Learning Objective
                    </label>
                    {editingCell?.id === week.id && editingCell?.field === "objective" && isAdmin ? (
                      <div className="space-y-2">
                        <Textarea
                          ref={textareaRef}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          data-testid={`textarea-objective-${week.id}`}
                          className="min-h-[80px]"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleCellSave} disabled={updateWeekMutation.isPending}>
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleCellCancel}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm" onClick={() => isAdmin && handleCellEdit(week.id, "objective", week.objective || "")} role={isAdmin ? "button" : undefined}>
                        {week.objective || "Click to add..."}
                      </p>
                    )}
                  </div>

                  {/* Deck Files */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-bold uppercase text-muted-foreground/60">
                        Files ({week.deckFiles?.length || 0})
                      </label>
                      {isAdmin && (
                        <ObjectUploader
                          onComplete={handleUploadComplete(week.id)}
                          onGetUploadParameters={handleGetUploadParams}
                          maxNumberOfFiles={10}
                        />
                      )}
                    </div>
                    {week.deckFiles && week.deckFiles.length > 0 ? (
                      <div className="space-y-2">
                        {week.deckFiles.map((file) => (
                          <div key={file.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                            <div>
                              <p className="text-sm font-medium">{file.fileName}</p>
                              <p className="text-xs text-muted-foreground">{formatFileSize(file.fileSize)}</p>
                            </div>
                            {isAdmin && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => deleteDeckFileMutation.mutate({ weekId: week.id, fileId: file.id })}
                                disabled={deleteDeckFileMutation.isPending}
                                className="h-8 w-8"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No files uploaded yet</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={() => navigate(`/courses/${courseId}/weeks/${week.id}`)}
                      data-testid={`button-view-week-${week.id}`}
                    >
                      <ChevronRight className="mr-1 h-4 w-4" />
                      View Week
                    </Button>
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleteWeekId(week.id)}
                        data-testid={`button-delete-week-${week.id}`}
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        Delete
                      </Button>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </main>

      {deleteWeekId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-background p-6 rounded-lg max-w-sm">
            <h3 className="text-lg font-bold mb-2">Delete Week?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This action cannot be undone. All content in this week will be deleted.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDeleteWeekId(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteWeekMutation.mutate(deleteWeekId)}
                disabled={deleteWeekMutation.isPending}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
