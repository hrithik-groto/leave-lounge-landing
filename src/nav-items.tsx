
import { Home, Shield, TestTube } from "lucide-react";
import Index from "./pages/Index";
import AdminDashboard from "./pages/AdminDashboard";
import Dashboard from "./pages/Dashboard";
import TestNotifications from "./pages/TestNotifications";
import NotFound from "./pages/NotFound";

export const navItems = [
  {
    title: "Home",
    to: "/",
    icon: <Home className="h-4 w-4" />,
    page: <Index />,
  },
  {
    title: "Dashboard",
    to: "/dashboard",
    icon: <Shield className="h-4 w-4" />,
    page: <Dashboard />,
  },
  {
    title: "Admin Dashboard",
    to: "/admin",
    icon: <Shield className="h-4 w-4" />,
    page: <AdminDashboard />,
  },
  {
    title: "Test Notifications",
    to: "/test-notifications",
    icon: <TestTube className="h-4 w-4" />,
    page: <TestNotifications />,
  },
  {
    title: "404",
    to: "*",
    icon: <Home className="h-4 w-4" />,
    page: <NotFound />,
  },
];
