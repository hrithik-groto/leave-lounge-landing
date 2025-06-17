
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface LeaveType {
  id: string;
  label: string;
  color: string;
  requires_approval: boolean;
  accrual_rule: string;
  is_active: boolean;
  leave_policies?: {
    annual_allowance: number;
    carry_forward_limit: number;
  }[];
}

const LeaveTypes: React.FC = () => {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchLeaveTypes();
  }, []);

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
        .order('label');

      if (error) {
        console.error('Error fetching leave types:', error);
        toast({
          title: "Error",
          description: "Failed to fetch leave types",
          variant: "destructive"
        });
        return;
      }

      setLeaveTypes(data || []);
    } catch (error) {
      console.error('Error fetching leave types:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLeaveTypeDescription = (label: string): string => {
    const descriptions: Record<string, string> = {
      'Paid Leave': '1.5 days/month, carried forward monthly, up to 6 days annually',
      'Bereavement Leave': '5 days/year for 1st-degree relatives, no carry forward',
      'Restricted Holiday': '2 days/year for festive leaves, no carry forward',
      'Short Leave': '4 hours/month for late-ins/early outs, no carry forward',
      'Work From Home': '2 days/month, carries forward monthly',
      'Additional Work From Home': 'WFH + AWFH ≤ 24 days/year, no carry forward',
      'Comp-offs': 'For client meetings beyond work hours, unlimited',
      'Special Leave': 'Sabbaticals only, requires special approval'
    };
    return descriptions[label] || 'Standard leave policy applies';
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">Loading leave types...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Leave Types</h1>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Leave Type
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {leaveTypes.map((leaveType) => {
          const policy = leaveType.leave_policies?.[0];
          
          return (
            <Card key={leaveType.id} className="h-fit">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center">
                    <div 
                      className="w-4 h-4 rounded-full mr-2"
                      style={{ backgroundColor: leaveType.color }}
                    />
                    {leaveType.label}
                  </CardTitle>
                  <div className="flex space-x-1">
                    <Button variant="ghost" size="sm">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge 
                      variant={leaveType.is_active ? "default" : "secondary"}
                    >
                      {leaveType.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <Badge 
                      variant={leaveType.requires_approval ? "destructive" : "secondary"}
                    >
                      {leaveType.requires_approval ? "Requires Approval" : "Auto Approved"}
                    </Badge>
                  </div>
                  
                  <div className="text-sm text-gray-600">
                    <p><strong>Accrual:</strong> {leaveType.accrual_rule}</p>
                    {policy && (
                      <>
                        <p><strong>Annual Allowance:</strong> {policy.annual_allowance === 999 ? 'Unlimited' : `${policy.annual_allowance} days`}</p>
                        <p><strong>Carry Forward:</strong> {policy.carry_forward_limit || 0} days</p>
                      </>
                    )}
                  </div>
                  
                  <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                    {getLeaveTypeDescription(leaveType.label)}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {leaveTypes.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No leave types configured yet.</p>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Leave Type
          </Button>
        </div>
      )}
    </div>
  );
};

export default LeaveTypes;
