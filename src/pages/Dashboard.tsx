import React, { useState, useEffect } from 'react';
import { useUser, UserButton } from '@clerk/clerk-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Users, Clock, FileText, Home, Bell, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays } from 'date-fns';
import EnhancedCalendar from '@/components/EnhancedCalendar';
import NotificationCenter from '@/components/NotificationCenter';
import LeaveApplicationForm from '@/components/LeaveApplicationForm';

interface LeaveType {
  id: string;
  label: string;
  color: string;
  requires_approval: boolean;
  leave_policies?: {
    annual_allowance: number;
    carry_forward_limit: number;
  }[];
}

interface UserLeave {
  id: string;
  start_date: string;
  end_date: string;
  status: string;
  reason: string;
  leave_types?: {
    label: string;
    color: string;
  };
}

const leaveTypeDescriptions: Record<string, string> = {
  'Paid Leave': '1.5 days/month, carried forward monthly, up to 6 days annually',
  'Bereavement Leave': '5 days/year for 1st-degree relatives, no carry forward',
  'Restricted Holiday': '2 days/year for festive leaves, no carry forward',
  'Short Leave': '4 hours/month for late-ins/early outs, no carry forward',
  'Work From Home': '2 days/month, carries forward monthly',
  'Additional Work From Home': 'WFH + AWFH ≤ 24 days/year, no carry forward',
  'Comp-offs': 'For client meetings beyond work hours, unlimited',
  'Special Leave': 'Sabbaticals only, requires special approval'
};

const Dashboard = () => {
  const { user, isLoaded } = useUser();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [userLeaves, setUserLeaves] = useState<UserLeave[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [userBalances, setUserBalances] = useState<Record<string, { allocated: number; used: number; available: number }>>({});
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [totalUsedDays, setTotalUsedDays] = useState(0);

  useEffect(() => {
    if (isLoaded && user?.id) {
      createUserProfile();
      fetchUserLeaves();
      fetchLeaveTypes();
      fetchUserBalances();
    }
  }, [isLoaded, user?.id]);

  const createUserProfile = async () => {
    if (!user?.id) return;

    try {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (!existingProfile) {
        await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.emailAddresses[0]?.emailAddress || '',
            name: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'User'
          });
      }
    } catch (error) {
      console.error('Error creating user profile:', error);
    }
  };

  const fetchUserLeaves = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('leave_applied_users')
        .select(`
          *,
          leave_types (label, color)
        `)
        .eq('user_id', user.id)
        .order('applied_at', { ascending: false });

      if (error) {
        console.error('Error fetching user leaves:', error);
        return;
      }

      console.log('User leaves data:', data);
      setUserLeaves(data || []);

      // Calculate total used days
      const usedDays = data?.reduce((total, leave) => {
        if (leave.status === 'approved') {
          return total + differenceInDays(new Date(leave.end_date), new Date(leave.start_date)) + 1;
        }
        return total;
      }, 0) || 0;
      setTotalUsedDays(usedDays);
    } catch (error) {
      console.error('Error fetching user leaves:', error);
    }
  };

  const fetchLeaveTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_types')
        .select(`
          *,
          leave_policies (
            annual_allowance,
            carry_forward_limit
          )
        `)
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching leave types:', error);
        return;
      }

      console.log('Leave types data:', data);
      setLeaveTypes(data || []);
    } catch (error) {
      console.error('Error fetching leave types:', error);
    }
  };

  const fetchUserBalances = async () => {
    if (!user?.id) return;

    try {
      // First check if balances exist for the user
      const { data: existingBalances } = await supabase
        .from('user_leave_balances')
        .select('*')
        .eq('user_id', user.id)
        .eq('year', new Date().getFullYear());

      console.log('Existing balances:', existingBalances);

      // Initialize balances for all leave types if they don't exist
      if (!existingBalances || existingBalances.length === 0) {
        // Get all leave types first
        const { data: allLeaveTypes } = await supabase
          .from('leave_types')
          .select(`
            *,
            leave_policies (annual_allowance, carry_forward_limit)
          `)
          .eq('is_active', true);

        if (allLeaveTypes) {
          for (const leaveType of allLeaveTypes) {
            const policy = leaveType.leave_policies?.[0];
            if (policy) {
              await supabase
                .from('user_leave_balances')
                .insert({
                  user_id: user.id,
                  leave_type_id: leaveType.id,
                  allocated_days: policy.annual_allowance,
                  used_days: 0,
                  carried_forward_days: 0,
                  year: new Date().getFullYear()
                });
            }
          }

          // Fetch the newly created balances
          const { data: newBalances } = await supabase
            .from('user_leave_balances')
            .select('*')
            .eq('user_id', user.id)
            .eq('year', new Date().getFullYear());

          const balances: Record<string, { allocated: number; used: number; available: number }> = {};
          newBalances?.forEach(balance => {
            balances[balance.leave_type_id || ''] = {
              allocated: balance.allocated_days || 0,
              used: balance.used_days || 0,
              available: (balance.allocated_days || 0) - (balance.used_days || 0) + (balance.carried_forward_days || 0)
            };
          });

          setUserBalances(balances);
        }
      } else {
        const balances: Record<string, { allocated: number; used: number; available: number }> = {};
        existingBalances.forEach(balance => {
          balances[balance.leave_type_id || ''] = {
            allocated: balance.allocated_days || 0,
            used: balance.used_days || 0,
            available: (balance.allocated_days || 0) - (balance.used_days || 0) + (balance.carried_forward_days || 0)
          };
        });

        setUserBalances(balances);
      }
    } catch (error) {
      console.error('Error fetching user balances:', error);
    }
  };

  const handleCancelLeave = async (leaveId: string) => {
    try {
      const { error } = await supabase
        .from('leave_applied_users')
        .update({ status: 'cancelled' })
        .eq('id', leaveId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Leave application cancelled successfully!"
      });

      fetchUserLeaves();
      fetchUserBalances();
    } catch (error) {
      console.error('Error cancelling leave:', error);
      toast({
        title: "Error",
        description: "Failed to cancel leave application",
        variant: "destructive"
      });
    }
  };

  if (!isLoaded) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen">Please sign in to access your dashboard.</div>;
  }

  const getWelcomeMessage = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Top Navigation */}
      <div className="bg-white/80 backdrop-blur-xl shadow-sm border-b border-gray-200/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-8">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">
                Timeloo
              </h1>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
                <TabsList className="grid w-full grid-cols-4 bg-gray-100/50">
                  <TabsTrigger value="dashboard" className="flex items-center space-x-2">
                    <Home className="w-4 h-4" />
                    <span>Dashboard</span>
                  </TabsTrigger>
                  <TabsTrigger value="leave-types" className="flex items-center space-x-2">
                    <FileText className="w-4 h-4" />
                    <span>Leave Types</span>
                  </TabsTrigger>
                  <TabsTrigger value="balances" className="flex items-center space-x-2">
                    <Clock className="w-4 h-4" />
                    <span>Balances</span>
                  </TabsTrigger>
                  <TabsTrigger value="policies" className="flex items-center space-x-2">
                    <Users className="w-4 h-4" />
                    <span>Policies</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="flex items-center space-x-4">
              <div className="p-1 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 rounded-full">
                <UserButton 
                  afterSignOutUrl="/" 
                  appearance={{
                    elements: {
                      avatarBox: "w-10 h-10 rounded-full border-2 border-white shadow-lg"
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent value="dashboard" className="space-y-6">
            {/* Welcome Section */}
            <div className="text-center py-8">
              <div className="inline-flex items-center space-x-2 mb-4">
                <Sparkles className="w-6 h-6 text-yellow-500 animate-pulse" />
                <h2 className="text-3xl font-bold text-gray-900">
                  {getWelcomeMessage()}, {user.firstName || 'there'}!
                </h2>
                <Sparkles className="w-6 h-6 text-yellow-500 animate-pulse" />
              </div>
              <p className="text-gray-600">Ready to manage your time efficiently?</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Quick Stats */}
              <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-green-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Total Applications</p>
                        <p className="text-2xl font-bold text-green-600">{userLeaves.length}</p>
                      </div>
                      <Calendar className="w-8 h-8 text-green-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-blue-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Pending Approvals</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {userLeaves.filter(leave => leave.status === 'pending').length}
                        </p>
                      </div>
                      <Clock className="w-8 h-8 text-blue-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-purple-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Days Used</p>
                        <p className="text-2xl font-bold text-purple-600">{totalUsedDays}</p>
                      </div>
                      <Users className="w-8 h-8 text-purple-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Notification Center */}
              <div className="lg:col-span-1">
                <NotificationCenter />
              </div>
            </div>

            {/* Enhanced Calendar */}
            <EnhancedCalendar onRefresh={fetchUserLeaves} />

            {/* Recent Leave Applications */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Leave Applications</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {userLeaves.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No leave applications yet</p>
                  ) : (
                    userLeaves.slice(0, 5).map((leave) => (
                      <div key={leave.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-medium">{leave.leave_types?.label}</span>
                            <Badge 
                              variant={leave.status === 'approved' ? 'default' : 
                                      leave.status === 'rejected' ? 'destructive' : 'secondary'}
                            >
                              {leave.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">
                            {format(new Date(leave.start_date), 'MMM dd')} - {format(new Date(leave.end_date), 'MMM dd, yyyy')}
                          </p>
                        </div>
                        {leave.status === 'pending' && (
                          <Button
                            onClick={() => handleCancelLeave(leave.id)}
                            variant="destructive"
                            size="sm"
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leave-types" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Available Leave Types</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {leaveTypes.length === 0 ? (
                    <div className="col-span-full text-center py-8">
                      <p className="text-gray-500">Loading leave types...</p>
                    </div>
                  ) : (
                    leaveTypes.map((type) => {
                      const balance = userBalances[type.id];
                      const policy = type.leave_policies?.[0];
                      
                      return (
                        <Card key={type.id} className="hover:shadow-lg transition-all duration-300">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="font-semibold">{type.label}</h3>
                              <div 
                                className="w-4 h-4 rounded-full" 
                                style={{ backgroundColor: type.color }}
                              />
                            </div>
                            
                            <p className="text-sm text-gray-600 mb-3">
                              {leaveTypeDescriptions[type.label]}
                            </p>
                            
                            {balance && policy && (
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span>Available:</span>
                                  <span className="font-medium">
                                    {policy.annual_allowance === 999 ? 'Unlimited' : 
                                     `${balance.available}/${balance.allocated}`}
                                  </span>
                                </div>
                                {policy.annual_allowance !== 999 && (
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div 
                                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                                      style={{ 
                                        width: `${Math.min(100, (balance.used / balance.allocated) * 100)}%` 
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                            
                            <div className="mt-3 flex items-center justify-between">
                              <Badge variant={type.requires_approval ? "secondary" : "default"}>
                                {type.requires_approval ? 'Needs Approval' : 'Auto Approved'}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="balances" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Leave Balances Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {leaveTypes.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">Loading balances...</p>
                    </div>
                  ) : (
                    leaveTypes.map((type) => {
                      const balance = userBalances[type.id];
                      const policy = type.leave_policies?.[0];
                      
                      if (!balance || !policy) return null;
                      
                      return (
                        <div key={type.id} className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-3">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: type.color }}
                              />
                              <span className="font-medium">{type.label}</span>
                            </div>
                            <Badge variant="outline">
                              {policy.annual_allowance === 999 ? 'Unlimited' : 
                               `${balance.available} / ${balance.allocated} days`}
                            </Badge>
                          </div>
                          
                          {policy.annual_allowance !== 999 && (
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <p className="text-gray-600">Allocated</p>
                                <p className="font-semibold">{balance.allocated} days</p>
                              </div>
                              <div>
                                <p className="text-gray-600">Used</p>
                                <p className="font-semibold">{balance.used} days</p>
                              </div>
                              <div>
                                <p className="text-gray-600">Available</p>
                                <p className="font-semibold text-green-600">{balance.available} days</p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="policies" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Leave Policies & Guidelines</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3">Deductible Leaves</h3>
                  <div className="space-y-3">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <h4 className="font-medium">Paid Leave</h4>
                      <p className="text-sm text-gray-600">1.5 days/month. Carried forward monthly. Up to 6 days carried forward annually.</p>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg">
                      <h4 className="font-medium">Bereavement Leave</h4>
                      <p className="text-sm text-gray-600">5 days per year for 1st-degree relatives. Does not carry forward.</p>
                    </div>
                    <div className="p-3 bg-yellow-50 rounded-lg">
                      <h4 className="font-medium">Restricted Holiday</h4>
                      <p className="text-sm text-gray-600">2 days per year for festive leaves not on company calendar. Does not carry forward.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Non-Deductible Leaves</h3>
                  <div className="space-y-3">
                    <div className="p-3 bg-green-50 rounded-lg">
                      <h4 className="font-medium">Additional Work from Home</h4>
                      <p className="text-sm text-gray-600">WFH + AWFH should not exceed 24 days per year. Use efficiently.</p>
                    </div>
                    <div className="p-3 bg-purple-50 rounded-lg">
                      <h4 className="font-medium">Comp-offs</h4>
                      <p className="text-sm text-gray-600">Awarded for client meetings beyond work hours. Limited approval.</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <LeaveApplicationForm
        isOpen={showLeaveForm}
        onClose={() => setShowLeaveForm(false)}
        onSuccess={() => {
          fetchUserLeaves();
          fetchUserBalances();
        }}
      />
    </div>
  );
};

export default Dashboard;
