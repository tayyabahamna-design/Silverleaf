import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronLeft, FileText, CheckCircle2, Circle } from "lucide-react";

interface DeckFile {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  progress?: {
    status: 'pending' | 'completed';
    completedAt: Date | null;
  };
}

interface WeekProgress {
  total: number;
  completed: number;
  percentage: number;
}

export default function CourseView() {
  const { weekId } = useParams<{ weekId: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  // Fetch deck files with progress
  const { data: deckFiles = [], isLoading } = useQuery<DeckFile[]>({
    queryKey: ['/api/training-weeks', weekId, 'deck-files'],
    enabled: !!weekId,
  });

  // Fetch week progress
  const { data: weekProgress } = useQuery<WeekProgress>({
    queryKey: ['/api/training-weeks', weekId, 'deck-progress'],
    enabled: !!weekId,
  });

  // Fetch week details
  const { data: weeks = [] } = useQuery<any[]>({
    queryKey: ['/api/training-weeks'],
  });
  const currentWeek = weeks.find((w) => w.id === weekId);

  // Save progress mutation
  const saveProgressMutation = useMutation({
    mutationFn: async (data: {
      deckFileId: string;
      status: string;
      completedAt?: Date;
    }) => {
      return apiRequest('POST', '/api/deck-progress', {
        weekId,
        ...data
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/training-weeks', weekId, 'deck-files'] });
      queryClient.invalidateQueries({ queryKey: ['/api/training-weeks', weekId, 'deck-progress'] });
    },
  });

  // Auto-select first file
  useEffect(() => {
    if (deckFiles.length > 0 && !selectedFileId) {
      setSelectedFileId(deckFiles[0].id);
    }
  }, [deckFiles, selectedFileId]);

  // Handle file click - mark as completed
  const handleFileClick = (file: DeckFile) => {
    setSelectedFileId(file.id);
    
    // Mark as completed if not already
    if (file.progress?.status !== 'completed') {
      saveProgressMutation.mutate({
        deckFileId: file.id,
        status: 'completed',
        completedAt: new Date(),
      });
    }
  };

  const selectedFile = deckFiles.find(file => file.id === selectedFileId);

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground/40" />;
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-80 border-r bg-card flex flex-col">
        <div className="p-6 border-b">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="mb-4 -ml-2"
            data-testid="button-back-to-weeks"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Weeks
          </Button>
          <h2 className="text-xl font-bold mb-1">
            Week {currentWeek?.weekNumber}
          </h2>
          <p className="text-sm text-muted-foreground">
            {currentWeek?.competencyFocus || 'Training Content'}
          </p>

          {/* Progress Bar */}
          {weekProgress && weekProgress.total > 0 && (
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  Course Progress
                </span>
                <span className="text-xs font-bold text-primary">
                  {weekProgress.percentage}%
                </span>
              </div>
              <Progress value={weekProgress.percentage} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {weekProgress.completed} of {weekProgress.total} completed
              </p>
            </div>
          )}
        </div>

        {/* Content List */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-2">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Loading content...
              </div>
            ) : deckFiles.length === 0 ? (
              <div className="text-center py-8 px-4">
                <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  No content available yet
                </p>
                <p className="text-xs text-muted-foreground/70">
                  An administrator needs to add files to this training week.
                </p>
              </div>
            ) : (
              deckFiles.map((file) => (
                <button
                  key={file.id}
                  onClick={() => handleFileClick(file)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedFileId === file.id
                      ? 'bg-primary/10 border-2 border-primary'
                      : 'hover:bg-muted/50 border-2 border-transparent'
                  }`}
                  data-testid={`button-file-${file.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getStatusIcon(file.progress?.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="font-semibold text-sm truncate">{file.fileName}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {(file.fileSize / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {selectedFile ? (
          <div className="flex-1 flex flex-col">
            {/* Content Header */}
            <div className="p-6 border-b bg-card">
              <h1 className="text-2xl font-bold mb-1">{selectedFile.fileName}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Presentation File</span>
                {selectedFile.progress?.status && (
                  <>
                    <span>•</span>
                    <span className="capitalize">{selectedFile.progress.status}</span>
                  </>
                )}
              </div>
            </div>

            {/* Content Display */}
            <div className="flex-1 flex items-center justify-center p-6 bg-muted/20">
              <div className="w-full max-w-6xl">
                <iframe
                  src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(selectedFile.fileUrl)}`}
                  className="w-full h-[calc(100vh-280px)] rounded-xl shadow-2xl border-0 bg-white"
                  title={selectedFile.fileName}
                  data-testid="file-viewer"
                />
                <div className="mt-4 flex gap-3">
                  <Button
                    onClick={() => window.open(selectedFile.fileUrl, '_blank')}
                    variant="default"
                    data-testid="button-download-file"
                  >
                    Download File
                  </Button>
                  <Button
                    onClick={() => window.open(`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(selectedFile.fileUrl)}`, '_blank')}
                    variant="outline"
                    data-testid="button-fullscreen"
                  >
                    Open Fullscreen
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : deckFiles.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center max-w-md">
              <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground/40" />
              <h3 className="text-xl font-semibold mb-2">No Content Available</h3>
              <p className="text-muted-foreground">
                This training week doesn't have any files yet. Please check back later or contact an administrator.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground">Select a file from the sidebar to begin</p>
          </div>
        )}
      </div>
    </div>
  );
}
