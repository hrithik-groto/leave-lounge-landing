
import { Shield, Users, Bell, Calendar, FileText, Clock, Settings } from "lucide-react";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import AllUsers from "./pages/AllUsers";
import TestNotifications from "./pages/TestNotifications";
import NotFound from "./pages/NotFound";

/**
 * Central place for defining the navigation items. Used for navigation components and routing.
 */
export const navItems = [
  {
    title: "Dashboard",
    to: "/dashboard",
    icon: <Calendar className="h-4 w-4" />,
    page: <Dashboard />,
  },
  {
    title: "All Users",
    to: "/all-users",
    icon: <Users className="h-4 w-4" />,
    page: <AllUsers />,
    adminOnly: true,
  },
  {
    title: "Admin Dashboard",
    to: "/admin",
    icon: <Shield className="h-4 w-4" />,
    page: <AdminDashboard />,
    adminOnly: true,
    showInNav: false, // Don't show in main nav, access through other means
  },
  {
    title: "Test Notifications",
    to: "/test-notifications",
    icon: <Bell className="h-4 w-4" />,
    page: <TestNotifications />,
    adminOnly: true,
    showInNav: false, // Don't show in main nav
  },
  {
    title: "Home",
    to: "/",
    icon: <Calendar className="h-4 w-4" />,
    page: <Index />,
    showInNav: false, // Don't show in navigation, only used for routing
  },
  {
    title: "Not Found",
    to: "*",
    icon: <Calendar className="h-4 w-4" />,
    page: <NotFound />,
    showInNav: false, // Don't show in navigation, only used for routing
  },
];
