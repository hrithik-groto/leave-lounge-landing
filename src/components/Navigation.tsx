
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { navItems } from '@/nav-items';
import { useUserRoles } from '@/hooks/useUserRoles';
import { Button } from '@/components/ui/button';

export const Navigation = () => {
  const location = useLocation();
  const { isAdmin, isLoadingCurrentRole } = useUserRoles();

  console.log('Navigation render - isAdmin:', isAdmin, 'isLoading:', isLoadingCurrentRole);

  // Show loading state while checking user role
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

  // Filter navigation items based on admin status
  const filteredNavItems = navItems.filter(item => {
    // Hide the "Not Found" route from navigation
    if (item.to === "*") return false;
    
    // If item requires admin access, only show to admins
    if (item.adminOnly) {
      console.log(`Checking admin-only item ${item.title} - isAdmin: ${isAdmin}`);
      return isAdmin;
    }
    
    return true;
  });

  console.log('Filtered nav items:', filteredNavItems.map(item => ({ title: item.title, adminOnly: item.adminOnly })));

  return (
    <nav className="bg-background border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <Link to="/" className="text-xl font-bold">
              Timeloo
            </Link>
            <div className="flex space-x-2">
              {filteredNavItems.map((item) => {
                const isActive = location.pathname === item.to;
                console.log(`Nav item ${item.title} - isActive: ${isActive}, path: ${item.to}`);
                
                return (
                  <Button
                    key={item.to}
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    asChild
                  >
                    <Link to={item.to} className="flex items-center gap-2">
                      {item.icon}
                      {item.title}
                      {item.adminOnly && (
                        <span className="text-xs bg-red-100 text-red-600 px-1 rounded">Admin</span>
                      )}
                    </Link>
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};
