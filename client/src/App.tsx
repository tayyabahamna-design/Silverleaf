// Based on blueprint:javascript_auth_all_persistance
// UPDATED: Added unified authentication page for Admin and Teacher roles
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import CoursesList from "@/pages/courses-list";
import CourseWeeks from "@/pages/course-weeks";
import CourseView from "@/pages/course-view";
import Home from "@/pages/home";
import UnifiedAuth from "@/pages/unified-auth";
import TeacherDashboard from "@/pages/teacher-dashboard";
import TeacherContentView from "@/pages/teacher-content-view";
import Approvals from "@/pages/approvals";
import AdminHome from "@/pages/admin-home";
import AdminUsers from "@/pages/admin-trainers";
import AdminUserDetail from "@/pages/admin-trainer-detail";
import AdminTeachers from "@/pages/admin-teachers";
import AdminTeacherDetail from "@/pages/admin-teacher-detail";
import AdminAnalytics from "@/pages/admin-analytics";
import AdminCertificateApproval from "@/pages/admin-certificate-approval";
import AdminCertificateView from "@/pages/admin-certificate-view";
import TeacherCertificates from "@/pages/teacher-certificates";
import TeacherCertificateView from "@/pages/teacher-certificate-view";
import EmergencyReset from "@/pages/emergency-reset";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      {/* New course hierarchy */}
      <ProtectedRoute path="/" component={CoursesList} />
      <ProtectedRoute path="/courses/:courseId" component={CourseWeeks} />
      <ProtectedRoute path="/courses/:courseId/weeks/:weekId" component={CourseView} />
      
      {/* Legacy routes for backward compatibility */}
      <ProtectedRoute path="/course/:weekId" component={CourseView} />

      {/* Admin routes */}
      <ProtectedRoute path="/approvals" component={Approvals} />
      <ProtectedRoute path="/admin" component={AdminHome} />
      <ProtectedRoute path="/admin/users" component={AdminUsers} />
      <ProtectedRoute path="/admin/users/:id" component={AdminUserDetail} />
      <ProtectedRoute path="/admin/teachers" component={AdminTeachers} />
      <ProtectedRoute path="/admin/teachers/:id" component={AdminTeacherDetail} />
      <ProtectedRoute path="/admin/analytics" component={AdminAnalytics} />
      <ProtectedRoute path="/admin/certificates/:batchId/approve" component={AdminCertificateApproval} />
      <ProtectedRoute path="/admin/certificates/batch/:batchId/view" component={AdminCertificateView} />
      <Route path="/auth" component={UnifiedAuth} />
      <Route path="/login" component={UnifiedAuth} />
      <Route path="/emergency-reset" component={EmergencyReset} />
      <Route path="/teacher/dashboard" component={TeacherDashboard} />
      <Route path="/teacher/certificates" component={TeacherCertificates} />
      <Route path="/teacher/certificates/:certId" component={TeacherCertificateView} />
      <Route path="/teacher/week/:weekId/content" component={TeacherContentView} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
