import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@clerk/clerk-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, User, FileText, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface LeaveApplication {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  applied_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  is_half_day: boolean | null;
  actual_days_used: number | null;
  hours_requested: number | null;
  leave_duration_type: string | null;
  leave_time_start: string | null;
  leave_time_end: string | null;
  holiday_name: string | null;
  meeting_details: string | null;
  leave_type_id: string | null;
  leave_types: {
    label: string;
    color: string;
  } | null;
  profiles: {
    name: string;
    email: string;
  } | null;
}

interface TabbedLeaveApplicationsProps {
  onRevert: (applicationId: string) => void;
  onApprove: (id: string, userId: string) => void;
  onReject: (id: string, userId: string) => void;
  refreshTrigger?: number;
}

export const TabbedLeaveApplications: React.FC<TabbedLeaveApplicationsProps> = ({
  onRevert,
  onApprove,
  onReject,
  refreshTrigger
}) => {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState('my-applications');

  const { data: applications = [], isLoading, error, refetch } = useQuery({
    queryKey: ['leave-applications', user?.id, refreshTrigger],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_applied_users')
        .select(`
          *,
          leave_types (
            label,
            color
          ),
          profiles (
            name,
            email
          )
        `)
        .order('applied_at', { ascending: false });

      if (error) throw error;
      return data as LeaveApplication[];
    },
    enabled: !!user?.id,
  });

  React.useEffect(() => {
    refetch();
  }, [refreshTrigger, refetch]);

  if (isLoading) return <div>Loading applications...</div>;
  if (error) return <div>Error loading applications</div>;

  const isAdmin = user?.id === 'user_2xwywE2Bl76vs7l68dhj6nIcCPV';
  const myApplications = applications?.filter(app => app.user_id === user?.id) || [];
  const pendingApplications = applications?.filter(app => app.status === 'pending') || [];
  const allApplications = applications || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'text-green-600 bg-green-50';
      case 'rejected': return 'text-red-600 bg-red-50';
      case 'pending': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="h-4 w-4" />;
      case 'rejected': return <XCircle className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const renderApplicationCard = (application: LeaveApplication, showUserInfo = false, showActions = false) => (
    <Card key={application.id} className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: application.leave_types?.color || '#3B82F6' }}
            />
            <div>
              <CardTitle className="text-lg">{application.leave_types?.label || 'Unknown Leave Type'}</CardTitle>
              {showUserInfo && application.profiles && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                  <User className="h-3 w-3" />
                  <span>{application.profiles.name} ({application.profiles.email})</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={`${getStatusColor(application.status)} flex items-center gap-1`}>
              {getStatusIcon(application.status)}
              {application.status.charAt(0).toUpperCase() + application.status.slice(1)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              {format(new Date(application.start_date), 'MMM dd, yyyy')} - {format(new Date(application.end_date), 'MMM dd, yyyy')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              {application.is_half_day ? '0.5 day' : 
               application.leave_duration_type === 'hours' ? `${application.hours_requested || 1} hours` :
               `${application.actual_days_used || 1} days`}
            </span>
          </div>
        </div>
        
        {application.reason && (
          <div className="flex items-start gap-2">
            <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
            <span className="text-sm">{application.reason}</span>
          </div>
        )}

        {application.is_half_day && application.leave_time_start && application.leave_time_end && (
          <div className="text-xs text-muted-foreground">
            Half day: {application.leave_time_start} - {application.leave_time_end}
          </div>
        )}

        {application.applied_at && (
          <div className="text-xs text-muted-foreground">
            Applied: {format(new Date(application.applied_at), 'MMM dd, yyyy HH:mm')}
          </div>
        )}

        {application.approved_at && (
          <div className="text-xs text-muted-foreground">
            {application.status === 'approved' ? 'Approved' : 'Processed'}: {format(new Date(application.approved_at), 'MMM dd, yyyy HH:mm')}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {application.status === 'pending' && application.user_id === user?.id && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRevert(application.id)}
              className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Cancel
            </Button>
          )}
          
          {showActions && application.status === 'pending' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onApprove(application.id, application.user_id)}
                className="text-green-600 hover:text-green-700 border-green-200 hover:border-green-300"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Approve
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onReject(application.id, application.user_id)}
                className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
              >
                <XCircle className="h-3 w-3 mr-1" />
                Reject
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Leave Applications</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="my-applications">My Applications</TabsTrigger>
            {isAdmin && <TabsTrigger value="pending-approvals">Pending Approvals</TabsTrigger>}
            <TabsTrigger value="all-applications">All Applications</TabsTrigger>
          </TabsList>

          <TabsContent value="my-applications" className="mt-4">
            <div className="space-y-4">
              {myApplications.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No applications found</p>
              ) : (
                myApplications.map(app => renderApplicationCard(app))
              )}
            </div>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="pending-approvals" className="mt-4">
              <div className="space-y-4">
                {pendingApplications.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No pending applications</p>
                ) : (
                  pendingApplications.map(app => renderApplicationCard(app, true, true))
                )}
              </div>
            </TabsContent>
          )}

          <TabsContent value="all-applications" className="mt-4">
            <div className="space-y-4">
              {allApplications.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No applications found</p>
              ) : (
                allApplications.map(app => renderApplicationCard(app, true, isAdmin))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
