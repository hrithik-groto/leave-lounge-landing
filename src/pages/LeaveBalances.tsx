
import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, ArrowLeft, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

interface LeaveBalance {
  id: string;
  user_id: string;
  leave_type_id: string;
  year: number;
  allocated_days: number;
  used_days: number;
  carried_forward_days: number;
  leave_types: {
    label: string;
    color: string;
    accrual_rule: string;
  };
}

const LeaveBalances = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      initializeAndFetchBalances();
    }
  }, [user]);

  const initializeAndFetchBalances = async () => {
    try {
      // Initialize user leave balances
      await supabase.rpc('initialize_user_leave_balances', {
        user_uuid: user?.id
      });

      // Fetch balances
      await fetchLeaveBalances();
    } catch (error) {
      console.error('Error initializing balances:', error);
      toast({
        title: "Error",
        description: "Failed to load leave balances",
        variant: "destructive"
      });
    }
  };

  const fetchLeaveBalances = async () => {
    try {
      const currentYear = new Date().getFullYear();
      
      const { data, error } = await supabase
        .from('user_leave_balances')
        .select(`
          *,
          leave_types (
            label,
            color,
            accrual_rule
          )
        `)
        .eq('user_id', user?.id)
        .eq('year', currentYear)
        .order('leave_types(label)');

      if (error) throw error;
      setLeaveBalances(data || []);
    } catch (error) {
      console.error('Error fetching leave balances:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAvailableBalance = (balance: LeaveBalance) => {
    return (balance.allocated_days + balance.carried_forward_days) - balance.used_days;
  };

  const getUsagePercentage = (balance: LeaveBalance) => {
    const total = balance.allocated_days + balance.carried_forward_days;
    if (total === 0) return 0;
    return (balance.used_days / total) * 100;
  };

  const getBalanceStatus = (balance: LeaveBalance) => {
    const available = getAvailableBalance(balance);
    const total = balance.allocated_days + balance.carried_forward_days;
    
    if (available <= 0) return 'exhausted';
    if (available / total <= 0.2) return 'low';
    if (available / total <= 0.5) return 'moderate';
    return 'good';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'exhausted': return 'text-red-600 bg-red-50';
      case 'low': return 'text-orange-600 bg-orange-50';
      case 'moderate': return 'text-yellow-600 bg-yellow-50';
      case 'good': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen">Please sign in to access this page.</div>;
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/dashboard')}
              className="mr-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">
              My Leave Balances
            </h1>
          </div>
          <Button 
            onClick={initializeAndFetchBalances} 
            variant="outline"
            className="flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {leaveBalances.map((balance) => {
            const available = getAvailableBalance(balance);
            const usagePercentage = getUsagePercentage(balance);
            const status = getBalanceStatus(balance);
            const isShortLeave = balance.leave_types.label === 'Short Leave';

            return (
              <Card key={balance.id} className="hover:shadow-lg transition-shadow duration-300">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: balance.leave_types.color }}
                      />
                      <span className="text-lg">{balance.leave_types.label}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {balance.leave_types.accrual_rule}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-800">
                      {available}
                    </div>
                    <div className="text-sm text-gray-600">
                      {isShortLeave ? 'Hours' : 'Days'} Available
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Usage</span>
                      <span>{Math.round(usagePercentage)}%</span>
                    </div>
                    <Progress value={usagePercentage} className="h-2" />
                  </div>

                  <div className={`text-center p-2 rounded-md text-sm font-medium ${getStatusColor(status)}`}>
                    {status.charAt(0).toUpperCase() + status.slice(1)} Balance
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div>
                      <div className="font-semibold text-blue-600">
                        {balance.allocated_days}
                      </div>
                      <div className="text-gray-500">Allocated</div>
                    </div>
                    <div>
                      <div className="font-semibold text-red-600">
                        {balance.used_days}
                      </div>
                      <div className="text-gray-500">Used</div>
                    </div>
                    <div>
                      <div className="font-semibold text-green-600">
                        {balance.carried_forward_days}
                      </div>
                      <div className="text-gray-500">Carried</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center text-xs text-gray-500">
                    {isShortLeave ? (
                      <Clock className="w-3 h-3 mr-1" />
                    ) : (
                      <Calendar className="w-3 h-3 mr-1" />
                    )}
                    Year: {balance.year}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {leaveBalances.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Calendar className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">No Leave Balances Found</h3>
              <p className="text-gray-500 mb-4">
                Your leave balances will be automatically initialized when you apply for leave.
              </p>
              <Button 
                onClick={() => navigate('/dashboard')}
                className="bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600"
              >
                Apply for Leave
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default LeaveBalances;
