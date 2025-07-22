
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Home, AlertTriangle } from 'lucide-react';
import { useLeaveBalance } from '@/hooks/useLeaveBalance';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@clerk/clerk-react';
import { useState, useEffect } from 'react';

interface LeaveTypeConfig {
  id: string;
  label: string;
  icon: React.ElementType;
  monthlyAllowance: number;
  unit: string;
  color: string;
  carryForward: boolean;
}

interface ComprehensiveLeaveBalanceProps {
  refreshTrigger?: number;
}

// Create an interface for the RPC response
interface MonthlyLeaveBalanceResponse {
  used_this_month: number;
  remaining_this_month: number;
  carried_forward: number;
  allocated_balance?: number;
  monthly_allocation?: number;
}

export const ComprehensiveLeaveBalance: React.FC<ComprehensiveLeaveBalanceProps> = ({
  refreshTrigger
}) => {
  const { user } = useUser();
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaveTypes = async () => {
      try {
        const { data, error } = await supabase
          .from('leave_types')
          .select('id, label, color')
          .eq('is_active', true)
          .in('label', ['Paid Leave', 'Short Leave', 'Work From Home'])
          .order('label');

        if (error) throw error;

        const leaveTypeConfigs: LeaveTypeConfig[] = data?.map(type => ({
          id: type.id,
          label: type.label,
          icon: type.label === 'Short Leave' ? Clock : type.label === 'Work From Home' ? Home : Calendar,
          monthlyAllowance: type.label === 'Paid Leave' ? 1.5 : type.label === 'Short Leave' ? 4 : 2,
          unit: type.label === 'Short Leave' ? 'hours' : 'days',
          color: type.color || '#3B82F6',
          carryForward: type.label === 'Paid Leave' // Only Paid Leave gets carried forward
        })) || [];

        setLeaveTypes(leaveTypeConfigs);
      } catch (error) {
        console.error('Error fetching leave types:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaveTypes();
  }, []);

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-6 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Leave Balance Overview</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {leaveTypes.map((leaveType) => (
          <LeaveBalanceCard
            key={leaveType.id}
            leaveType={leaveType}
            refreshTrigger={refreshTrigger}
          />
        ))}
      </div>
    </div>
  );
};

interface LeaveBalanceCardProps {
  leaveType: LeaveTypeConfig;
  refreshTrigger?: number;
}

const LeaveBalanceCard: React.FC<LeaveBalanceCardProps> = ({ leaveType, refreshTrigger }) => {
  const { user } = useUser();
  const [usage, setUsage] = useState({ used: 0, remaining: 0, carryForward: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    const fetchUsage = async () => {
      try {
        setLoading(true);
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        if (leaveType.label === 'Short Leave') {
          // Calculate from actual records for short leave
          const { data: shortLeaves, error } = await supabase
            .from('leave_applied_users')
            .select('hours_requested, status')
            .eq('user_id', user.id)
            .eq('leave_type_id', leaveType.id)
            .gte('start_date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
            .lt('start_date', currentMonth === 12 
              ? `${currentYear + 1}-01-01` 
              : `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`)
            .in('status', ['approved', 'pending']);

          if (error) throw error;

          const totalHoursUsed = shortLeaves?.reduce((total, leave) => {
            return total + (leave.hours_requested || 1);
          }, 0) || 0;

          setUsage({
            used: totalHoursUsed,
            remaining: Math.max(0, leaveType.monthlyAllowance - totalHoursUsed),
            carryForward: 0 // No carry forward for Short Leave
          });
        } else if (leaveType.label === 'Paid Leave') {
          // For Paid Leave, use the monthly balance system with carryforward
          const { data, error } = await supabase
            .rpc('get_monthly_leave_balance', {
              p_user_id: user.id,
              p_leave_type_id: leaveType.id,
              p_month: currentMonth,
              p_year: currentYear
            });

          if (error) throw error;

          // Properly type and access the response data
          if (data && typeof data === 'object') {
            const balanceData = data as unknown as MonthlyLeaveBalanceResponse;
            
            setUsage({
              used: balanceData.used_this_month || 0,
              remaining: balanceData.remaining_this_month || 0,
              carryForward: balanceData.carried_forward || 0
            });
          } else {
            console.error('Invalid response format from get_monthly_leave_balance');
            setUsage({ used: 0, remaining: leaveType.monthlyAllowance, carryForward: 0 });
          }
        } else {
          // For other leave types, calculate from actual records
          const { data: leaves, error } = await supabase
            .from('leave_applied_users')
            .select('actual_days_used, is_half_day, start_date, end_date, status')
            .eq('user_id', user.id)
            .eq('leave_type_id', leaveType.id)
            .gte('start_date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
            .lt('start_date', currentMonth === 12 
              ? `${currentYear + 1}-01-01` 
              : `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`)
            .in('status', ['approved', 'pending']);

          if (error) throw error;

          const totalDaysUsed = leaves?.reduce((total, leave) => {
            if (leave.actual_days_used) {
              return total + leave.actual_days_used;
            }
            // Fallback calculation
            if (leave.is_half_day) {
              return total + 0.5;
            }
            const daysDiff = Math.ceil((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / (1000 * 3600 * 24)) + 1;
            return total + daysDiff;
          }, 0) || 0;

          setUsage({
            used: totalDaysUsed,
            remaining: Math.max(0, leaveType.monthlyAllowance - totalDaysUsed),
            carryForward: 0 // No carry forward for Work From Home
          });
        }
      } catch (error) {
        console.error(`Error fetching ${leaveType.label} usage:`, error);
        setUsage({ used: 0, remaining: leaveType.monthlyAllowance, carryForward: 0 });
      } finally {
        setLoading(false);
      }
    };

    fetchUsage();
  }, [user?.id, leaveType, refreshTrigger]);

  const getStatusColor = (): "destructive" | "default" | "secondary" | "outline" => {
    const remaining = usage.remaining;
    if (remaining <= 0) return 'destructive';
    if (remaining <= leaveType.monthlyAllowance * 0.3) return 'secondary';
    return 'default';
  };

  const Icon = leaveType.icon;

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-6 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {leaveType.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="grid grid-cols-1 gap-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Monthly Allowance:</span>
            <span className="font-medium text-sm">
              {leaveType.monthlyAllowance} {leaveType.unit}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Used This Month:</span>
            <span className="font-medium text-sm">{usage.used} {leaveType.unit}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Remaining:</span>
            <Badge variant={getStatusColor()} className="text-xs">
              {usage.remaining} {leaveType.unit}
            </Badge>
          </div>

          {leaveType.carryForward && usage.carryForward > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Carried Forward:</span>
              <span className="text-sm font-medium text-blue-600">
                +{usage.carryForward} {leaveType.unit}
              </span>
            </div>
          )}
        </div>

        {usage.remaining <= 0 && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
            {leaveType.label === 'Short Leave' 
              ? 'Monthly short leave quota exhausted. Wait for next month to get 4 new short leaves.'
              : leaveType.label === 'Paid Leave' 
                ? 'Monthly limit reached. Wait for next month to apply for paid leave.'
                : `${leaveType.label} quota exhausted for this month.`
            }
          </div>
        )}

        {leaveType.label === 'Short Leave' && usage.remaining > 0 && (
          <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-600">
            You have {usage.remaining} hour{usage.remaining !== 1 ? 's' : ''} of short leave remaining this month.
          </div>
        )}

        {leaveType.label === 'Paid Leave' && usage.carryForward > 0 && (
          <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-600">
            Unused leave from last month has been carried forward.
          </div>
        )}
        
        {leaveType.label === 'Work From Home' && usage.remaining > 0 && (
          <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-600">
            You have {usage.remaining} day{usage.remaining !== 1 ? 's' : ''} of work from home remaining this month.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
