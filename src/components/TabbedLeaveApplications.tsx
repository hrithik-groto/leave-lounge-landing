
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@clerk/clerk-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, User, AlertCircle } from 'lucide-react';
import LeaveApplicationsList from './LeaveApplicationsList';

interface LeaveApplication {
  id: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  applied_at: string;
  user_id: string;
  leave_types?: {
    label: string;
    color: string;
  } | null;
  profiles?: {
    name: string;
  } | null;
  hours_requested?: number;
  leave_duration_type?: string;
  actual_days_used?: number;
  approved_at?: string;
  approved_by?: string;
  is_half_day?: boolean;
  leave_time_start?: string;
  leave_time_end?: string;
  meeting_details?: string;
  holiday_name?: string;
}

interface TabbedLeaveApplicationsProps {
  onRevert?: (id: string) => void;
  onApprove?: (id: string, userId: string) => void;
  onReject?: (id: string, userId: string) => void;
  refreshTrigger?: number;
}

const TabbedLeaveApplications: React.FC<TabbedLeaveApplicationsProps> = ({ 
  onRevert, 
  onApprove, 
  onReject,
  refreshTrigger 
}) => {
  const { user } = useUser();
  const [processingApplications, setProcessingApplications] = useState<Set<string>>(new Set());

  const { data: userApplications, isLoading, isError, error } = useQuery({
    queryKey: ['leave-applications', user?.id, refreshTrigger],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('leave_applied_users')
        .select(`
          *,
          leave_types (
            label,
            color
          ),
          profiles (
            name
          )
        `)
        .eq('user_id', user.id)
        .order('applied_at', { ascending: false });

      if (error) {
        console.error('Error fetching leave applications:', error);
        throw error;
      }

      return (data || []) as LeaveApplication[];
    },
    enabled: !!user?.id,
  });

  const pendingApplications = userApplications?.filter(app => app.status === 'pending') || [];
  const approvedApplications = userApplications?.filter(app => app.status === 'approved') || [];
  const rejectedApplications = userApplications?.filter(app => app.status === 'rejected') || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Calendar className="h-5 w-5" />
          <span>Leave Applications</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending" className="flex items-center space-x-2">
              <Clock className="h-4 w-4" />
              <span>Pending</span>
              {pendingApplications.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {pendingApplications.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved" className="flex items-center space-x-2">
              <span>Approved</span>
              {approvedApplications.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {approvedApplications.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="rejected" className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4" />
              <span>Rejected</span>
              {rejectedApplications.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {rejectedApplications.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            <LeaveApplicationsList
              applications={pendingApplications}
              onRevert={onRevert}
              title="Pending Applications"
              showUserName={false}
              isAdmin={false}
              processingApplications={processingApplications}
            />
          </TabsContent>

          <TabsContent value="approved" className="mt-4">
            <LeaveApplicationsList
              applications={approvedApplications}
              title="Approved Applications"
              showUserName={false}
              isAdmin={false}
            />
          </TabsContent>

          <TabsContent value="rejected" className="mt-4">
            <LeaveApplicationsList
              applications={rejectedApplications}
              title="Rejected Applications"
              showUserName={false}
              isAdmin={false}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default TabbedLeaveApplications;
