
import { HomeIcon, Users, Calendar, Settings, MessageSquare, TestTube, Key } from "lucide-react";

export const navItems = [
  {
    title: "Home",
    to: "/",
    icon: <HomeIcon className="h-4 w-4" />,
  },
  {
    title: "Dashboard",
    to: "/dashboard",
    icon: <Calendar className="h-4 w-4" />,
  },
  {
    title: "Admin",
    to: "/admin",
    icon: <Users className="h-4 w-4" />,
  },
  {
    title: "Test Notifications",
    to: "/test-notifications",
    icon: <TestTube className="h-4 w-4" />,
  },
  {
    title: "Slack Token Update",
    to: "/slack-token-update",
    icon: <Key className="h-4 w-4" />,
  },
];
