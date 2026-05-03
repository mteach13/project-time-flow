import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { TimerProvider } from "@/hooks/useTimer";
import { Protected } from "@/components/Protected";
import Layout from "@/components/Layout";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import TimerPage from "@/pages/TimerPage";
import Timesheet from "@/pages/Timesheet";
import Planner from "@/pages/Planner";
import Projects from "@/pages/Projects";
import Team from "@/pages/Team";
import Import from "@/pages/Import";
import Export from "@/pages/Export";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <TimerProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route element={<Protected><Layout /></Protected>}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/timer" element={<TimerPage />} />
                <Route path="/timesheet" element={<Timesheet />} />
                <Route path="/planner" element={<Planner />} />
                <Route path="/projects" element={<Protected adminOnly><Projects /></Protected>} />
                <Route path="/team" element={<Protected adminOnly><Team /></Protected>} />
                <Route path="/import" element={<Protected adminOnly><Import /></Protected>} />
                <Route path="/export" element={<Protected adminOnly><Export /></Protected>} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </TimerProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
