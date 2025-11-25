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
import { Plus, Trash2, ChevronLeft, GripVertical } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { Course, TrainingWeek } from "@shared/schema";
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
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableWeekItem({ week, courseId }: { week: TrainingWeek; courseId: string }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: week.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-2">
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>
      <Card className="flex-1 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold">Week {week.weekNumber}</h4>
            <p className="text-sm text-muted-foreground">{week.competencyFocus}</p>
          </div>
        </div>
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

  const { data: course } = useQuery<Course & { weeks: TrainingWeek[] }>({
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

  if (user?.role !== "admin" || !course) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 text-center max-w-md">
          <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
          <Button onClick={() => navigate("/admin/courses")} variant="outline">
            Back to Courses
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button onClick={() => navigate("/admin/courses")} variant="ghost" size="icon">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-4xl font-bold">{course.name}</h1>
              <p className="text-muted-foreground">Manage weeks in this course</p>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <Button onClick={() => setIsDialogOpen(true)} data-testid="button-add-week">
              <Plus className="mr-2 h-4 w-4" />
              Add Week
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
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => createWeekMutation.mutate()}
                    disabled={createWeekMutation.isPending}
                    data-testid="button-submit-week"
                  >
                    Create
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {course.weeks && course.weeks.length > 0 ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={course.weeks.map(w => w.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-4">
                {course.weeks.map((week) => (
                  <div key={week.id} className="flex gap-2 items-center">
                    <SortableWeekItem week={week} courseId={courseId!} />
                    <Button
                      onClick={() => deleteWeekMutation.mutate(week.id)}
                      variant="destructive"
                      size="sm"
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
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-4">No weeks yet. Create one to get started.</p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create First Week
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
