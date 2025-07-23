
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Home, AlertTriangle } from 'lucide-react';
import { useAdditionalWFHValidation } from '@/hooks/useAdditionalWFHValidation';

interface AdditionalWFHLeaveBalanceProps {
  leaveTypeId: string;
  refreshTrigger?: number;
}

export const AdditionalWFHLeaveBalance: React.FC<AdditionalWFHLeaveBalanceProps> = ({
  leaveTypeId,
  refreshTrigger
}) => {
  const { canApply, wfhRemaining, loading, additionalWfhUsed } = useAdditionalWFHValidation(leaveTypeId);

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

  // Only show if Additional WFH can be applied (regular WFH is exhausted)
  if (!canApply) {
    return (
      <Card className="w-full border-orange-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Home className="h-4 w-4" />
            Additional Work From Home
            <Badge variant="secondary" className="text-xs">
              Not Available
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="p-3 rounded-md text-sm bg-orange-50 border border-orange-200 text-orange-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>
                Use your regular Work From Home quota first. You have {wfhRemaining} days remaining this month.
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Home className="h-4 w-4" />
          Additional Work From Home
          <Badge variant="default" className="text-xs bg-green-600">
            Available
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="p-3 rounded-md text-sm bg-green-50 border border-green-200 text-green-800">
          <div className="flex items-center gap-2">
            <span>
              ✓ Now available! Your regular Work From Home quota has been exhausted. You can apply for unlimited additional WFH days.
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Monthly Limit:</span>
            <span className="font-medium text-sm">Unlimited</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Used This Month:</span>
            <span className="font-medium text-sm">{additionalWfhUsed} days</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Status:</span>
            <Badge variant="default" className="text-xs bg-green-600">
              Active
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
