
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@clerk/clerk-react';
import { useToast } from '@/hooks/use-toast';

interface LeaveBalance {
  id: string;
  leave_type_id: string;
  allocated_days: number;
  used_days: number;
  carried_forward_days: number;
  year: number;
  leave_types?: {
    label: string;
    color: string;
    accrual_rule: string;
  };
}

const LeaveBalances: React.FC = () => {
  const { user } = useUser();
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (user?.id) {
      fetchLeaveBalances();
    }
  }, [user?.id]);

  const fetchLeaveBalances = async () => {
    if (!user?.id) return;

    try {
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
        .eq('user_id', user.id)
        .eq('year', new Date().getFullYear())
        .order('leave_types(label)');

      if (error) {
        console.error('Error fetching leave balances:', error);
        toast({
          title: "Error",
          description: "Failed to fetch leave balances",
          variant: "destructive"
        });
        return;
      }

      setBalances(data || []);
    } catch (error) {
      console.error('Error fetching leave balances:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAvailableDays = (balance: LeaveBalance) => {
    return balance.allocated_days - balance.used_days + balance.carried_forward_days;
  };

  const getUsagePercentage = (balance: LeaveBalance) => {
    const total = balance.allocated_days + balance.carried_forward_days;
    if (total === 0) return 0;
    return (balance.used_days / total) * 100;
  };

  const getStatusColor = (percentage: number) => {
    if (percentage >= 80) return 'destructive';
    if (percentage >= 60) return 'default';
    return 'secondary';
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">Loading leave balances...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Leave Balances</h1>
        <div className="text-sm text-gray-500">
          Year: {new Date().getFullYear()}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {balances.map((balance) => {
          const availableDays = getAvailableDays(balance);
          const usagePercentage = getUsagePercentage(balance);
          const totalDays = balance.allocated_days + balance.carried_forward_days;

          return (
            <Card key={balance.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  <div className="flex items-center">
                    <div 
                      className="w-4 h-4 rounded-full mr-2"
                      style={{ backgroundColor: balance.leave_types?.color || '#3B82F6' }}
                    />
                    {balance.leave_types?.label || 'Unknown'}
                  </div>
                  <Badge variant={getStatusColor(usagePercentage)}>
                    {Math.round(usagePercentage)}% used
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Available</span>
                      <span className="font-medium">{availableDays} days</span>
                    </div>
                    <Progress value={100 - usagePercentage} className="h-2" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Allocated</p>
                      <p className="font-medium">{balance.allocated_days} days</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Used</p>
                      <p className="font-medium">{balance.used_days} days</p>
                    </div>
                  </div>
                  
                  {balance.carried_forward_days > 0 && (
                    <div className="text-sm">
                      <p className="text-gray-500">Carried Forward</p>
                      <p className="font-medium text-green-600">+{balance.carried_forward_days} days</p>
                    </div>
                  )}
                  
                  <div className="text-xs text-gray-400 bg-gray-50 p-2 rounded">
                    Accrual: {balance.leave_types?.accrual_rule || 'annual'}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {balances.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No leave balances found for this year.</p>
          <p className="text-sm text-gray-400">
            Leave balances will be automatically created when you apply for leave.
          </p>
        </div>
      )}
    </div>
  );
};

export default LeaveBalances;
