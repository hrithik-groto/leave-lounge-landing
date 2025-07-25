
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { navItems } from '@/nav-items';
import { useUserRoles } from '@/hooks/useUserRoles';
import { Button } from '@/components/ui/button';

export const Navigation = () => {
  const location = useLocation();
  const { isAdmin, isLoadingCurrentRole } = useUserRoles();

  // Don't render navigation items until we know the user's role
  if (isLoadingCurrentRole) {
    return (
      <nav className="bg-background border-b">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link to="/" className="text-xl font-bold">
                Timeloo
              </Link>
              <div className="flex space-x-2">
                <div className="animate-pulse h-8 w-20 bg-gray-200 rounded"></div>
                <div className="animate-pulse h-8 w-20 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  const filteredNavItems = navItems.filter(item => {
    if (item.adminOnly && !isAdmin) {
      console.log(`Filtering out ${item.title} - adminOnly: ${item.adminOnly}, isAdmin: ${isAdmin}`);
      return false;
    }
    if (item.to === "*") return false; // Hide not found route
    return true;
  });

  console.log('Filtered nav items:', filteredNavItems.map(item => item.title));
  console.log('Current admin status:', isAdmin);

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
