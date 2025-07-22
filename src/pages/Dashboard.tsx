
import { useUser } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, Users, FileText, Calendar, BarChart3 } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import EnhancedLeaveApplicationForm from "@/components/EnhancedLeaveApplicationForm";
import TabbedLeaveApplications from "@/components/TabbedLeaveApplications";
import EnhancedCalendar from "@/components/EnhancedCalendar";
import AllUsersOnLeave from "@/components/AllUsersOnLeave";
import NotificationBell from "@/components/NotificationBell";
import QuickActions from "@/components/QuickActions";

interface LeaveBalance {
  leave_type: string;
  duration_type: string;
  monthly_allowance: number;
  used_this_month: number;
  remaining_this_month: number;
  annual_allowance?: number;
  carried_forward?: number;
}

const Dashboard = () => {
  const { user } = useUser();
  const [isLeaveFormOpen, setIsLeaveFormOpen] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      return data;
    },
    enabled: !!user?.id,
  });

  const { data: leaveBalances, isLoading: balancesLoading } = useQuery({
    queryKey: ['leave-balances', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // Fetch all leave types
      const { data: leaveTypes, error: typesError } = await supabase
        .from('leave_types')
        .select('*')
        .eq('is_active', true);

      if (typesError) throw typesError;

      // Fetch balances for each leave type
      const balancePromises = leaveTypes.map(async (type) => {
        const { data, error } = await supabase.rpc('get_monthly_leave_balance', {
          p_user_id: user.id,
          p_leave_type_id: type.id,
        });
        
        if (error) {
          console.error(`Error fetching balance for ${type.label}:`, error);
          return null;
        }
        
        return {
          leave_type: type,
          balance: data as LeaveBalance
        };
      });

      const results = await Promise.all(balancePromises);
      return results.filter(result => result !== null);
    },
    enabled: !!user?.id,
  });

  const { data: applications } = useQuery({
    queryKey: ['leave-applications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('leave_applied_users')
        .select(`
          *,
          leave_types!leave_applied_users_leave_type_id_fkey(label, color)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching leave applications:', error);
        return [];
      }

      return data;
    },
    enabled: !!user?.id,
  });

  const handleLeaveFormSuccess = () => {
    setIsLeaveFormOpen(false);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Please sign in to access the dashboard</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome back, {profile?.name || user.firstName || 'User'}! 👋
            </h1>
            <p className="text-gray-600 mt-1">Here's your leave management overview</p>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <Dialog open={isLeaveFormOpen} onOpenChange={setIsLeaveFormOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
                  <CalendarDays className="w-4 h-4 mr-2" />
                  Apply Leave
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[95vh] overflow-hidden p-0">
                <EnhancedLeaveApplicationForm onSuccess={handleLeaveFormSuccess} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Quick Actions */}
        <QuickActions />

        {/* Leave Balances */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {balancesLoading ? (
            // Loading skeletons
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-2">
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-8 bg-gray-200 rounded w-12 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-20"></div>
                </CardContent>
              </Card>
            ))
          ) : (
            leaveBalances?.map((item) => {
              const balance = item.balance;
              const isAnnualLeave = balance?.leave_type === 'Annual Leave';
              const remaining = balance?.remaining_this_month || 0;
              const total = isAnnualLeave 
                ? (balance?.annual_allowance || balance?.monthly_allowance || 0)
                : (balance?.monthly_allowance || 0);
              const used = balance?.used_this_month || 0;
              
              return (
                <Card key={item.leave_type.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.leave_type.color }}
                      />
                      {item.leave_type.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600 mb-1">
                      {remaining}
                    </div>
                    <div className="text-xs text-gray-600">
                      {isAnnualLeave ? 'remaining this year' : 'remaining this month'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Used: {used} / {total} {balance?.duration_type || 'days'}
                    </div>
                    {balance?.carried_forward !== undefined && balance.carried_forward > 0 && (
                      <div className="text-xs text-blue-600 mt-1">
                        Carried: {balance.carried_forward} days
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2">
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Leave Calendar
                </CardTitle>
                <CardDescription>View and manage your leave schedule</CardDescription>
              </CardHeader>
              <CardContent>
                <EnhancedCalendar />
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Users on Leave Today */}
            <AllUsersOnLeave />

            {/* Recent Applications */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Recent Applications
                </CardTitle>
              </CardHeader>
              <CardContent>
                {applications?.slice(0, 3).map((app) => (
                  <div key={app.id} className="flex justify-between items-center py-2 border-b last:border-b-0">
                    <div>
                      <div className="font-medium text-sm">{app.leave_types?.label}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(app.start_date).toLocaleDateString()}
                      </div>
                    </div>
                    <Badge variant={
                      app.status === 'approved' ? 'default' : 
                      app.status === 'rejected' ? 'destructive' : 'secondary'
                    }>
                      {app.status}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Applications Table */}
        <TabbedLeaveApplications />
      </div>
    </div>
  );
};

export default Dashboard;
