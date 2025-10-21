// Based on blueprint:javascript_auth_all_persistance
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import Home from "@/pages/home";
import CourseView from "@/pages/course-view";
import AuthPage from "@/pages/auth-page";
import TeacherAuth from "@/pages/teacher-auth";
import TeacherDashboard from "@/pages/teacher-dashboard";
import TrainerBatches from "@/pages/trainer-batches";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={Home} />
      <ProtectedRoute path="/course/:weekId" component={CourseView} />
      <ProtectedRoute path="/trainer/batches" component={TrainerBatches} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/teacher/auth" component={TeacherAuth} />
      <Route path="/teacher/dashboard" component={TeacherDashboard} />
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
