
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { navItems } from '@/nav-items';
import { useUserRoles } from '@/hooks/useUserRoles';
import { Button } from '@/components/ui/button';

export const Navigation = () => {
  const location = useLocation();
  const { isAdmin, isLoadingCurrentRole, currentUser, isHardcodedAdmin } = useUserRoles();

  console.log('Navigation render - currentUser:', currentUser?.id, 'isAdmin:', isAdmin, 'isHardcodedAdmin:', isHardcodedAdmin, 'isLoading:', isLoadingCurrentRole);

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

  // Check if user has admin access (either role-based admin or hardcoded admin)
  const hasAdminAccess = isAdmin || isHardcodedAdmin;

  // Filter navigation items based on admin status and showInNav flag
  const filteredNavItems = navItems.filter(item => {
    // Don't show items marked as not for navigation
    if (item.showInNav === false) return false;
    
    // If item requires admin access, only show to admins
    if (item.adminOnly === true) {
      console.log(`Checking admin-only item ${item.title} - hasAdminAccess: ${hasAdminAccess}, currentUser: ${currentUser?.id}`);
      return hasAdminAccess;
    }
    
    return true;
  });

  console.log('Filtered nav items:', filteredNavItems.map(item => ({ 
    title: item.title, 
    adminOnly: item.adminOnly,
    to: item.to 
  })));

  return (
    <nav className="bg-background border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <Link to="/dashboard" className="text-xl font-bold">
              Timeloo
            </Link>
            <div className="flex space-x-2">
              {filteredNavItems.map((item) => {
                const isActive = location.pathname === item.to;
                console.log(`Nav item ${item.title} - isActive: ${isActive}, path: ${item.to}, adminOnly: ${item.adminOnly}`);
                
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
                        <span className="text-xs bg-red-100 text-red-600 px-1 rounded ml-1">Admin</span>
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
