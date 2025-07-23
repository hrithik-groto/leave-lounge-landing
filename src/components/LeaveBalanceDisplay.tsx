
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, AlertTriangle } from 'lucide-react';
import { useLeaveBalance } from '@/hooks/useLeaveBalance';

interface LeaveBalanceDisplayProps {
  leaveTypeId: string;
  leaveTypeName: string;
  refreshTrigger?: number;
}

export const LeaveBalanceDisplay: React.FC<LeaveBalanceDisplayProps> = ({
  leaveTypeId,
  leaveTypeName,
  refreshTrigger
}) => {
  const { balance, loading, error } = useLeaveBalance(leaveTypeId, refreshTrigger);

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

  if (error || !balance) {
    return (
      <Card className="w-full border-red-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">Error loading balance</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (): "destructive" | "default" | "secondary" | "outline" => {
    const remaining = balance.remaining_this_month;
    if (remaining <= 0) return 'destructive';
    if (remaining <= balance.monthly_allowance * 0.3) return 'secondary';
    return 'default';
  };

  const getIcon = () => {
    return balance.duration_type === 'hours' ? Clock : Calendar;
  };

  const Icon = getIcon();

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {leaveTypeName}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="grid grid-cols-1 gap-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              {balance.leave_type === 'Annual Leave' ? 'Annual Allowance' : 'Monthly Allowance'}:
            </span>
            <span className="font-medium text-sm">
              {balance.leave_type === 'Annual Leave' ? balance.annual_allowance : balance.monthly_allowance} {balance.duration_type}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              {balance.leave_type === 'Annual Leave' ? 'Used This Year' : 'Used This Month'}:
            </span>
            <span className="font-medium text-sm">{balance.used_this_month} {balance.duration_type}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Remaining:</span>
            <Badge variant={getStatusColor()} className="text-xs">
              {balance.remaining_this_month} {balance.duration_type}
            </Badge>
          </div>

          {balance.carried_forward && balance.carried_forward > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Carried Forward:</span>
              <span className="text-sm font-medium text-blue-600">
                +{balance.carried_forward} {balance.duration_type}
              </span>
            </div>
          )}
        </div>

        {balance.remaining_this_month <= 0 && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
            {balance.leave_type === 'Short Leave' 
              ? 'Monthly short leave quota exhausted. Wait for next month to get 4 new short leaves.'
              : balance.leave_type === 'Paid Leave' 
                ? 'Monthly limit reached. Wait for next month to apply for paid leave.'
                : balance.leave_type === 'Work From Home'
                  ? 'Work From Home quota exhausted for this month. Wait for next month.'
                  : 'Leave quota exhausted.'
            }
          </div>
        )}

        {balance.leave_type === 'Paid Leave' && balance.remaining_this_month > 0 && balance.remaining_this_month < 1 && (
          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
            You have {balance.remaining_this_month} day{balance.remaining_this_month !== 1 ? 's' : ''} remaining. You can only apply for half-day leave.
          </div>
        )}

        {balance.leave_type === 'Short Leave' && balance.remaining_this_month > 0 && (
          <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-600">
            You have {balance.remaining_this_month} hour{balance.remaining_this_month !== 1 ? 's' : ''} of short leave remaining this month.
          </div>
        )}

        {balance.leave_type === 'Paid Leave' && balance.carried_forward && balance.carried_forward > 0 && (
          <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-600">
            Unused leave from last month has been carried forward.
          </div>
        )}
        
        {balance.leave_type === 'Work From Home' && balance.remaining_this_month > 0 && (
          <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-600">
            You have {balance.remaining_this_month} day{balance.remaining_this_month !== 1 ? 's' : ''} of work from home remaining this month.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
