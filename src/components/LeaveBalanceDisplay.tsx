
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
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {leaveTypeName}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              {balance.leave_type === 'Annual Leave' ? 'Annual Allowance' : 'Monthly Allowance'}:
            </span>
            <span className="font-medium">
              {balance.leave_type === 'Annual Leave' ? balance.annual_allowance : balance.monthly_allowance} {balance.duration_type}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              {balance.leave_type === 'Annual Leave' ? 'Used This Year' : 'Used This Month'}:
            </span>
            <span className="font-medium">{balance.used_this_month} {balance.duration_type}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Remaining:</span>
            <Badge variant={getStatusColor()}>
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

          {balance.remaining_this_month <= 0 && balance.leave_type === 'Paid Leave' && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
              Monthly limit reached. Wait for next month to apply for paid leave.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
