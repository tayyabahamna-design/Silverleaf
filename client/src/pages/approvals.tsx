import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Clock, User, GraduationCap } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type User = {
  id: string;
  username: string;
  email?: string;
  role: string;
  approvalStatus: string;
  createdAt: string;
};

type Teacher = {
  id: string;
  teacherId: number;
  name: string;
  email: string;
  approvalStatus: string;
  createdAt: string;
};

type CurrentUser = {
  id: string;
  role: string;
  username?: string;
};

export default function ApprovalsPage() {
  const { toast } = useToast();

  const { data: currentUser } = useQuery<CurrentUser>({
    queryKey: ["/api/user"],
  });

  const { data: pendingTrainers = [], isLoading: trainersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/pending-trainers"],
    enabled: currentUser?.role === "admin",
  });

  const { data: pendingTeachers = [], isLoading: teachersLoading } = useQuery<Teacher[]>({
    queryKey: currentUser?.role === "admin" 
      ? ["/api/admin/pending-teachers"]
      : ["/api/trainer/pending-teachers"],
  });

  const approveTrainer = useMutation({
    mutationFn: async (trainerId: string) => {
      const response = await apiRequest("POST", `/api/admin/approve-trainer/${trainerId}`);
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Trainer approved",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-trainers"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to approve trainer",
        description: error.message || "An error occurred",
      });
    },
  });

  const approveTeacher = useMutation({
    mutationFn: async (teacherId: string) => {
      const endpoint = currentUser?.role === "admin"
        ? `/api/admin/approve-teacher/${teacherId}`
        : `/api/trainer/approve-teacher/${teacherId}`;
      
      const response = await apiRequest("POST", endpoint);
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Teacher approved",
        description: data.message,
      });
      
      if (currentUser?.role === "admin") {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-teachers"] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/trainer/pending-teachers"] });
      }
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to approve teacher",
        description: error.message || "An error occurred",
      });
    },
  });

  const isAdmin = currentUser?.role === "admin";

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Pending Approvals</h1>
        <p className="text-muted-foreground">
          Review and approve pending account requests
        </p>
      </div>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Pending Trainers
            </CardTitle>
            <CardDescription>
              Trainer accounts waiting for admin approval
            </CardDescription>
          </CardHeader>
          <CardContent>
            {trainersLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading pending trainers...
              </div>
            ) : pendingTrainers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No pending trainer approvals
              </div>
            ) : (
              <div className="space-y-4">
                {pendingTrainers.map((trainer) => (
                  <div
                    key={trainer.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                    data-testid={`trainer-${trainer.id}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">{trainer.username}</h3>
                        <Badge variant="secondary" className="gap-1">
                          <Clock className="w-3 h-3" />
                          Pending
                        </Badge>
                      </div>
                      {trainer.email && (
                        <p className="text-sm text-muted-foreground">{trainer.email}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Requested {formatDistanceToNow(new Date(trainer.createdAt))} ago
                      </p>
                    </div>
                    <Button
                      onClick={() => approveTrainer.mutate(trainer.id)}
                      disabled={approveTrainer.isPending}
                      className="gap-2"
                      data-testid={`button-approve-trainer-${trainer.id}`}
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5" />
            Pending Teachers
          </CardTitle>
          <CardDescription>
            Teacher accounts waiting for {isAdmin ? "admin" : "trainer"} approval
          </CardDescription>
        </CardHeader>
        <CardContent>
          {teachersLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading pending teachers...
            </div>
          ) : pendingTeachers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No pending teacher approvals
            </div>
          ) : (
            <div className="space-y-4">
              {pendingTeachers.map((teacher) => (
                <div
                  key={teacher.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                  data-testid={`teacher-${teacher.id}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{teacher.name}</h3>
                      <Badge variant="outline" className="font-mono">
                        ID: {teacher.teacherId}
                      </Badge>
                      <Badge variant="secondary" className="gap-1">
                        <Clock className="w-3 h-3" />
                        Pending
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{teacher.email}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Requested {formatDistanceToNow(new Date(teacher.createdAt))} ago
                    </p>
                  </div>
                  <Button
                    onClick={() => approveTeacher.mutate(teacher.id)}
                    disabled={approveTeacher.isPending}
                    className="gap-2"
                    data-testid={`button-approve-teacher-${teacher.id}`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
