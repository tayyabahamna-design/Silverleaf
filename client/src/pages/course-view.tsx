import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronLeft, PlayCircle, FileText, CheckCircle2, Circle, Clock } from "lucide-react";

interface ContentItem {
  id: string;
  weekId: string;
  type: 'video' | 'file';
  title: string;
  url: string;
  orderIndex: number;
  duration?: number;
  fileSize?: number;
  progress?: {
    status: 'pending' | 'in-progress' | 'completed';
    videoProgress: number;
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
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Fetch content items with progress
  const { data: contentItems = [], isLoading } = useQuery<ContentItem[]>({
    queryKey: ['/api/training-weeks', weekId, 'content'],
    enabled: !!weekId,
  });

  // Fetch week progress
  const { data: weekProgress } = useQuery<WeekProgress>({
    queryKey: ['/api/training-weeks', weekId, 'progress'],
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
      contentItemId: string;
      status: string;
      videoProgress?: number;
      completedAt?: Date;
    }) => {
      return apiRequest('/api/progress', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/training-weeks', weekId, 'content'] });
      queryClient.invalidateQueries({ queryKey: ['/api/training-weeks', weekId, 'progress'] });
    },
  });

  // Auto-select first item
  useEffect(() => {
    if (contentItems.length > 0 && !selectedItemId) {
      setSelectedItemId(contentItems[0].id);
    }
  }, [contentItems, selectedItemId]);

  // Handle video progress tracking
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !selectedItemId) return;

    const selectedItem = contentItems.find(item => item.id === selectedItemId);
    if (!selectedItem || selectedItem.type !== 'video') return;

    // Resume from saved progress
    if (selectedItem.progress && selectedItem.progress.videoProgress > 0) {
      video.currentTime = selectedItem.progress.videoProgress;
    }

    // Save progress periodically
    const saveProgress = () => {
      if (video.currentTime > 0) {
        saveProgressMutation.mutate({
          contentItemId: selectedItemId,
          status: 'in-progress',
          videoProgress: Math.floor(video.currentTime),
        });
      }
    };

    // Check for completion
    const checkCompletion = () => {
      if (video.currentTime >= video.duration - 1) {
        saveProgressMutation.mutate({
          contentItemId: selectedItemId,
          status: 'completed',
          videoProgress: Math.floor(video.duration),
          completedAt: new Date(),
        });
      }
    };

    const progressInterval = setInterval(saveProgress, 5000); // Save every 5 seconds
    video.addEventListener('timeupdate', checkCompletion);
    video.addEventListener('play', () => {
      saveProgressMutation.mutate({
        contentItemId: selectedItemId,
        status: 'in-progress',
        videoProgress: Math.floor(video.currentTime),
      });
    });

    return () => {
      clearInterval(progressInterval);
      video.removeEventListener('timeupdate', checkCompletion);
    };
  }, [selectedItemId, contentItems]);

  // Handle file viewing - mark as completed when clicked
  const handleFileClick = (item: ContentItem) => {
    setSelectedItemId(item.id);
    if (item.progress?.status !== 'completed') {
      saveProgressMutation.mutate({
        contentItemId: item.id,
        status: 'completed',
        completedAt: new Date(),
      });
    }
  };

  const selectedItem = contentItems.find(item => item.id === selectedItemId);

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500" />;
      case 'in-progress':
        return <Clock className="h-5 w-5 text-blue-600 dark:text-blue-500" />;
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
            {contentItems.map((item) => (
              <button
                key={item.id}
                onClick={() => item.type === 'file' ? handleFileClick(item) : setSelectedItemId(item.id)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  selectedItemId === item.id
                    ? 'bg-primary/10 border-2 border-primary'
                    : 'hover:bg-muted/50 border-2 border-transparent'
                }`}
                data-testid={`button-content-${item.id}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getStatusIcon(item.progress?.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {item.type === 'video' ? (
                        <PlayCircle className="h-4 w-4 text-primary flex-shrink-0" />
                      ) : (
                        <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                      )}
                      <span className="font-semibold text-sm truncate">{item.title}</span>
                    </div>
                    {item.progress?.status === 'in-progress' && item.duration && (
                      <div className="text-xs text-muted-foreground">
                        {Math.floor(item.progress.videoProgress / 60)}:{String(item.progress.videoProgress % 60).padStart(2, '0')} / {Math.floor(item.duration / 60)}:{String(item.duration % 60).padStart(2, '0')}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {selectedItem ? (
          <div className="flex-1 flex flex-col">
            {/* Content Header */}
            <div className="p-6 border-b bg-card">
              <h1 className="text-2xl font-bold mb-1">{selectedItem.title}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="capitalize">{selectedItem.type}</span>
                {selectedItem.progress?.status && (
                  <>
                    <span>•</span>
                    <span className="capitalize">{selectedItem.progress.status.replace('-', ' ')}</span>
                  </>
                )}
              </div>
            </div>

            {/* Content Display */}
            <div className="flex-1 flex items-center justify-center p-6 bg-muted/20">
              {selectedItem.type === 'video' ? (
                <div className="w-full max-w-5xl">
                  <video
                    ref={videoRef}
                    src={selectedItem.url}
                    controls
                    className="w-full rounded-xl shadow-2xl"
                    data-testid="video-player"
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              ) : (
                <div className="w-full max-w-5xl">
                  <iframe
                    src={selectedItem.url}
                    className="w-full h-[calc(100vh-300px)] rounded-xl shadow-2xl border-0"
                    title={selectedItem.title}
                    data-testid="file-viewer"
                  />
                  <Button
                    onClick={() => window.open(selectedItem.url, '_blank')}
                    className="mt-4"
                    data-testid="button-download-file"
                  >
                    Open in New Tab
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground">Select content from the sidebar to begin</p>
          </div>
        )}
      </div>
    </div>
  );
}
