import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";

interface Trainer {
  id: string;
  username: string;
  email?: string;
  role: string;
  approvalStatus: string;
  createdAt: string;
  lastLogin?: string;
  progress?: number;
  filesCompleted?: number;
}

export default function AdminTrainers() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // Fetch trainers list
  const { data: trainers, isLoading } = useQuery<Trainer[]>({
    queryKey: ["/api/admin/trainers"],
  });

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 text-center max-w-md">
          <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
          <p className="text-muted-foreground">
            Only administrators can access this page.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header with Back Button */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/admin")}
            data-testid="button-back-dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Trainers</h1>
            <p className="text-muted-foreground">
              Manage all trainers in the system
            </p>
          </div>
        </div>

        {/* Trainers List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-6 animate-pulse bg-muted h-24" />
            ))}
          </div>
        ) : trainers && trainers.length > 0 ? (
          <div className="space-y-4">
            {trainers.map((trainer) => (
              <Card
                key={trainer.id}
                className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/admin/trainers/${trainer.id}`)}
                data-testid={`card-trainer-${trainer.id}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Trainer Info */}
                    <div className="flex items-center gap-4 mb-4">
                      <div>
                        <h3 className="text-lg font-bold">{trainer.username}</h3>
                        <p className="text-sm text-muted-foreground">
                          {trainer.email || "No email"}
                        </p>
                      </div>
                      <Badge
                        variant={
                          trainer.approvalStatus === "approved"
                            ? "default"
                            : trainer.approvalStatus === "pending"
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {trainer.approvalStatus}
                      </Badge>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">
                          Progress
                        </p>
                        <p className="text-sm font-semibold">
                          {trainer.progress || 0}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">
                          Files Completed
                        </p>
                        <p className="text-sm font-semibold">
                          {trainer.filesCompleted || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">
                          Last Active
                        </p>
                        <p className="text-sm font-semibold">
                          {trainer.lastLogin
                            ? format(new Date(trainer.lastLogin), "MMM d")
                            : "Never"}
                        </p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <Progress value={trainer.progress || 0} className="h-2" />
                  </div>

                  <ChevronRight className="h-5 w-5 text-muted-foreground ml-4 flex-shrink-0 mt-1" />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No trainers found</p>
          </Card>
        )}
      </div>
    </div>
  );
}
