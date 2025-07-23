
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Home, AlertTriangle } from 'lucide-react';
import { useLeaveBalance } from '@/hooks/useLeaveBalance';

interface AdditionalWFHLeaveBalanceProps {
  leaveTypeId: string;
  refreshTrigger?: number;
}

export const AdditionalWFHLeaveBalance: React.FC<AdditionalWFHLeaveBalanceProps> = ({
  leaveTypeId,
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

  const canApply = balance.can_apply;
  const wfhRemaining = balance.wfh_remaining || 0;

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Home className="h-4 w-4" />
          Additional Work From Home
          {canApply && (
            <Badge variant="default" className="text-xs bg-green-600">
              Active
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="grid grid-cols-1 gap-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Monthly Limit:</span>
            <span className="font-medium text-sm text-green-600">Unlimited</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Applied This Month:</span>
            <span className="font-medium text-sm">{balance.used_this_month || 0} days</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Status:</span>
            <Badge variant={canApply ? "default" : "destructive"} className="text-xs">
              {canApply ? "Available" : "Not Available"}
            </Badge>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Regular WFH Remaining:</span>
            <span className="text-sm font-medium">{wfhRemaining} days</span>
          </div>
        </div>

        {!canApply && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
            Additional Work From Home will be available once you exhaust your regular Work From Home quota (2 days/month). You still have {wfhRemaining} days of regular WFH remaining.
          </div>
        )}

        {canApply && (
          <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-600">
            ✓ Additional Work From Home is now available! Your regular WFH quota has been exhausted. You can apply for unlimited additional WFH days.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
