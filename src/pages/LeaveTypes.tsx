
import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar, Clock, Users, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface LeaveType {
  id: string;
  label: string;
  color: string;
  accrual_rule: string;
  requires_approval: boolean;
  is_active: boolean;
  leave_policies: Array<{
    annual_allowance: number;
    carry_forward_limit: number;
  }>;
}

const LeaveTypes = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);

  // Check if current user is admin
  const isAdmin = user?.id === 'user_2xwywE2Bl76vs7l68dhj6nIcCPV';

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

      if (error) throw error;
      setLeaveTypes(data || []);
    } catch (error) {
      console.error('Error fetching leave types:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLeaveTypeDescription = (leaveType: LeaveType) => {
    switch (leaveType.label) {
      case 'Paid Leave':
        return '1.5 days per month. Carried forward monthly. Fill your detailed reason if applying (important)';
      case 'Bereavement Leave':
        return '5 days per year. Applicable for the demise of 1st-degree relatives. Does not carry forward annually.';
      case 'Restricted Holiday':
        return '2 days per year to be used for festive leaves not on the company holiday calendar. Does not carry forward annually. Fill the holiday name if applying (important)';
      case 'Short Leave':
        return '4 hours per month to be used for late-ins or early outs. Does not carry forward monthly.';
      case 'Work From Home':
        return '2 days per month. Carries forward monthly. Fill your detailed reason if applying (important)';
      default:
        return '';
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
        <div className="flex items-center mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/dashboard')}
            className="mr-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">
            Leave Types & Policies
          </h1>
        </div>

        <div className="grid gap-6">
          {leaveTypes.map((leaveType) => (
            <Card key={leaveType.id} className="hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: leaveType.color }}
                    />
                    <span>{leaveType.label}</span>
                    <Badge variant={leaveType.is_active ? 'default' : 'secondary'}>
                      {leaveType.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    {leaveType.label === 'Short Leave' ? (
                      <div className="flex items-center space-x-1">
                        <Clock className="w-4 h-4" />
                        <span>{leaveType.leave_policies[0]?.annual_allowance || 0} hours/year</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>{leaveType.leave_policies[0]?.annual_allowance || 0} days/year</span>
                      </div>
                    )}
                    <Badge variant="outline">
                      {leaveType.accrual_rule}
                    </Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-gray-700">
                    {getLeaveTypeDescription(leaveType)}
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {leaveType.leave_policies[0]?.annual_allowance || 0}
                      </div>
                      <div className="text-sm text-gray-600">
                        {leaveType.label === 'Short Leave' ? 'Hours' : 'Days'} Allocated
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {leaveType.leave_policies[0]?.carry_forward_limit || 0}
                      </div>
                      <div className="text-sm text-gray-600">
                        Carry Forward Limit
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {leaveType.requires_approval ? 'Yes' : 'No'}
                      </div>
                      <div className="text-sm text-gray-600">
                        Requires Approval
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {isAdmin && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="w-5 h-5" />
                <span>Admin Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                As an admin, you can view all leave types and their configurations. 
                Navigate to the Admin Dashboard to manage user leave applications and balances.
              </p>
              <Button 
                onClick={() => navigate('/admin')}
                className="mt-4 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600"
              >
                Go to Admin Dashboard
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default LeaveTypes;
