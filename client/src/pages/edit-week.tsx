import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ObjectUploader } from "@/components/ObjectUploader";
import type { TrainingWeek } from "@shared/schema";

interface DeckFile {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
}

export default function EditWeek() {
  const [, params] = useRoute("/edit-week/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const weekId = params?.id;

  const [competencyFocus, setCompetencyFocus] = useState("");
  const [objective, setObjective] = useState("");

  const { data: week, isLoading } = useQuery<TrainingWeek>({
    queryKey: ['/api/training-weeks', weekId],
    enabled: !!weekId,
  });

  // Initialize form fields when data loads
  useEffect(() => {
    if (week) {
      setCompetencyFocus(week.competencyFocus || "");
      setObjective(week.objective || "");
    }
  }, [week]);

  const updateWeekMutation = useMutation({
    mutationFn: async (updates: Partial<TrainingWeek>) => {
      return apiRequest("PATCH", `/api/training-weeks/${weekId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/training-weeks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/training-weeks', weekId] });
      toast({
        title: "Success",
        description: "Training week updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update training week",
        variant: "destructive",
      });
    },
  });

  const handleSaveCompetency = () => {
    if (competencyFocus !== week?.competencyFocus) {
      updateWeekMutation.mutate({ competencyFocus });
    }
  };

  const handleSaveObjective = () => {
    if (objective !== week?.objective) {
      updateWeekMutation.mutate({ objective });
    }
  };

  const handleGetUploadParameters = async () => {
    const response = await fetch("/api/upload-url");
    const data = await response.json();
    return {
      method: "PUT" as const,
      url: data.url,
    };
  };

  const handleUploadComplete = async (result: any) => {
    const fileInfo = {
      fileName: result.name,
      fileUrl: result.uploadURL.split("?")[0],
      fileSize: result.size,
    };

    const currentFiles = week?.deckFiles || [];
    const updatedFiles = [...currentFiles, fileInfo];

    await updateWeekMutation.mutateAsync({
      deckFiles: updatedFiles as DeckFile[],
    });
  };

  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const currentFiles = week?.deckFiles || [];
      const updatedFiles = currentFiles.filter((f: DeckFile) => f.id !== fileId);
      return apiRequest("PATCH", `/api/training-weeks/${weekId}`, { deckFiles: updatedFiles });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/training-weeks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/training-weeks', weekId] });
      toast({
        title: "Success",
        description: "File deleted successfully",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!week) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-lg text-muted-foreground">Training week not found</p>
        <Button onClick={() => setLocation("/")} data-testid="button-back-home">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Week {week.weekNumber}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Edit training week details
            </p>
          </div>
        </div>

        {/* Competency Focus Section */}
        <Card>
          <CardHeader>
            <CardTitle>Competency Focus</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={competencyFocus}
              onChange={(e) => setCompetencyFocus(e.target.value)}
              placeholder="Develop effective classroom control strategies..."
              className="min-h-[120px] resize-none"
              data-testid="textarea-competency-focus"
            />
            <div className="flex justify-end">
              <Button
                onClick={handleSaveCompetency}
                disabled={competencyFocus === week.competencyFocus || updateWeekMutation.isPending}
                data-testid="button-save-competency"
              >
                {updateWeekMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Objective Section */}
        <Card>
          <CardHeader>
            <CardTitle>Objective</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Enter the learning objectives for this week..."
              className="min-h-[120px] resize-none"
              data-testid="textarea-objective"
            />
            <div className="flex justify-end">
              <Button
                onClick={handleSaveObjective}
                disabled={objective === week.objective || updateWeekMutation.isPending}
                data-testid="button-save-objective"
              >
                {updateWeekMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Training Materials Section */}
        <Card>
          <CardHeader>
            <CardTitle>Training Materials</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Upload Area */}
            <div className="border-2 border-dashed rounded-lg p-8 text-center bg-muted/30">
              <p className="text-lg font-medium mb-4">Drop your files here</p>
              <ObjectUploader
                onGetUploadParameters={handleGetUploadParameters}
                onComplete={handleUploadComplete}
                maxNumberOfFiles={10}
                key={`uploader-${weekId}`}
              />
              <p className="text-sm text-muted-foreground mt-4">
                Select up to 10 files. Review your selections below, then click Upload.
              </p>
            </div>

            {/* Uploaded Files List */}
            {week.deckFiles && week.deckFiles.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Uploaded Files ({week.deckFiles.length})
                </h3>
                <div className="space-y-2">
                  {week.deckFiles.map((file: DeckFile) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-4 border rounded-lg bg-card hover-elevate"
                      data-testid={`file-item-${file.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate" title={file.fileName}>
                          {file.fileName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {(file.fileSize / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(file.fileUrl, "_blank")}
                          data-testid={`button-view-${file.id}`}
                        >
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteFileMutation.mutate(file.id)}
                          disabled={deleteFileMutation.isPending}
                          data-testid={`button-delete-${file.id}`}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
