import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

// Pages
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import CreateActivity from "./pages/teacher/CreateActivity";
import EmailLogs from "./pages/teacher/EmailLogs";
import EmailSetup from "./pages/teacher/EmailSetup";
import ActivityDetails from "./pages/teacher/ActivityDetails";
import ActivitySubmissions from "./pages/teacher/ActivitySubmissions";
import StudentDashboard from "./pages/student/StudentDashboard";
import StudentActivity from "./pages/student/StudentActivity";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Protected Route Component
const ProtectedRoute = ({ children, allowedRole }: { children: React.ReactNode; allowedRole?: string }) => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRole && role !== allowedRole) {
    return <Navigate to={role === 'teacher' ? '/teacher' : '/student'} replace />;
  }

  return <>{children}</>;
};

// Auth Redirect Component
const AuthRedirect = ({ children }: { children: React.ReactNode }) => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (user) {
    return <Navigate to={role === 'teacher' ? '/teacher' : '/student'} replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<AuthRedirect><Landing /></AuthRedirect>} />
      <Route path="/login" element={<AuthRedirect><Login /></AuthRedirect>} />
      <Route path="/signup" element={<AuthRedirect><Signup /></AuthRedirect>} />

      {/* Teacher Routes */}
      <Route
        path="/teacher"
        element={
          <ProtectedRoute allowedRole="teacher">
            <TeacherDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/create"
        element={
          <ProtectedRoute allowedRole="teacher">
            <CreateActivity />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/edit/:activityId"
        element={
          <ProtectedRoute allowedRole="teacher">
            <CreateActivity />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/email-logs"
        element={
          <ProtectedRoute allowedRole="teacher">
            <EmailLogs />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/email-setup"
        element={
          <ProtectedRoute allowedRole="teacher">
            <EmailSetup />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/activity/:activityId"
        element={
          <ProtectedRoute allowedRole="teacher">
            <ActivityDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/activity/:activityId/submissions"
        element={
          <ProtectedRoute allowedRole="teacher">
            <ActivitySubmissions />
          </ProtectedRoute>
        }
      />

      {/* Student Routes */}
      <Route
        path="/student"
        element={
          <ProtectedRoute allowedRole="student">
            <StudentDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/activity/:activityId"
        element={
          <ProtectedRoute allowedRole="student">
            <StudentActivity />
          </ProtectedRoute>
        }
      />

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes >
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
