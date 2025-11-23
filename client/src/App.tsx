// Based on blueprint:javascript_auth_all_persistance
// UPDATED: Added unified authentication page for Admin, Teacher, and Trainer roles
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import Home from "@/pages/home";
import CourseView from "@/pages/course-view";
import UnifiedAuth from "@/pages/unified-auth";
import TeacherDashboard from "@/pages/teacher-dashboard";
import TeacherContentView from "@/pages/teacher-content-view";
import TrainerBatches from "@/pages/trainer-batches";
import TrainerTeacherContentHistory from "@/pages/trainer-teacher-content-history";
import Approvals from "@/pages/approvals";
import NotFound from "@/pages/not-found";

// UPDATED: Router now uses unified authentication
function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={Home} />
      <ProtectedRoute path="/course/:weekId" component={CourseView} />
      <ProtectedRoute path="/trainer/batches" component={TrainerBatches} />
      <ProtectedRoute path="/trainer/teachers/:teacherId/weeks/:weekId/content-history" component={TrainerTeacherContentHistory} />
      <ProtectedRoute path="/approvals" component={Approvals} />
      {/* UPDATED: New unified auth page for all roles (Admin, Teacher, Trainer) */}
      <Route path="/auth" component={UnifiedAuth} />
      <Route path="/login" component={UnifiedAuth} />
      <Route path="/teacher/dashboard" component={TeacherDashboard} />
      <Route path="/teacher/week/:weekId/content" component={TeacherContentView} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
