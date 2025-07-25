
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { navItems } from '@/nav-items';
import { useUserRoles } from '@/hooks/useUserRoles';
import { Button } from '@/components/ui/button';

export const Navigation = () => {
  const location = useLocation();
  const { isAdmin } = useUserRoles();

  const filteredNavItems = navItems.filter(item => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.to === "*") return false; // Hide not found route
    return true;
  });

  return (
    <nav className="bg-background border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <Link to="/" className="text-xl font-bold">
              Timeloo
            </Link>
            <div className="flex space-x-2">
              {filteredNavItems.map((item) => (
                <Button
                  key={item.to}
                  variant={location.pathname === item.to ? "default" : "ghost"}
                  size="sm"
                  asChild
                >
                  <Link to={item.to} className="flex items-center gap-2">
                    {item.icon}
                    {item.title}
                  </Link>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};
