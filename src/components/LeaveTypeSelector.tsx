
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface LeaveType {
  id: string;
  label: string;
  color: string;
  requires_approval: boolean;
  annual_allowance: number;
  carry_forward_limit: number;
  description: string;
}

interface LeaveTypeSelectorProps {
  leaveTypes: LeaveType[];
  selectedType: string;
  onTypeChange: (typeId: string) => void;
  userBalances: Record<string, { allocated: number; used: number; available: number }>;
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

const LeaveTypeSelector: React.FC<LeaveTypeSelectorProps> = ({
  leaveTypes,
  selectedType,
  onTypeChange,
  userBalances
}) => {
  return (
    <div className="space-y-4">
      <Select value={selectedType} onValueChange={onTypeChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select leave type" />
        </SelectTrigger>
        <SelectContent>
          {leaveTypes.map((type) => {
            const balance = userBalances[type.id] || { allocated: 0, used: 0, available: 0 };
            const isAvailable = balance.available > 0 || type.annual_allowance === 999;
            
            return (
              <SelectItem 
                key={type.id} 
                value={type.id}
                disabled={!isAvailable}
                className="flex flex-col items-start py-3"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-medium">{type.label}</span>
                  <div className="flex items-center space-x-2">
                    <Badge 
                      variant={isAvailable ? "default" : "secondary"}
                      style={{ backgroundColor: type.color }}
                    >
                      {type.annual_allowance === 999 ? 'Unlimited' : `${balance.available}/${balance.allocated}`}
                    </Badge>
                    {type.requires_approval && (
                      <Badge variant="outline" className="text-xs">
                        Approval Required
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {leaveTypeDescriptions[type.label]}
                </p>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
};

export default LeaveTypeSelector;
