
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, User, Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { format, isToday, isTomorrow, isWithinInterval, startOfDay, endOfDay, addDays } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

interface LeaveApplication {
  id: string;
  start_date: string;
  end_date: string;
  status: string;
  reason?: string;
  leave_type_id?: string;
  user_id: string;
  profiles: {
    name: string | null;
    email: string | null;
  } | null;
  leave_types: {
    label: string | null;
    color: string | null;
  } | null;
}

const AllUsersOnLeave = () => {
  const [allLeaveApplications, setAllLeaveApplications] = useState<LeaveApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeUpcoming, setIncludeUpcoming] = useState(true);

  useEffect(() => {
    fetchAllLeaveApplications();
  }, [includeUpcoming]);

  const fetchAllLeaveApplications = async () => {
    try {
      setLoading(true);
      console.log('Fetching users on leave...');
      
      const today = new Date();
      const todayString = format(today, 'yyyy-MM-dd');
      const nextWeekString = format(addDays(today, includeUpcoming ? 7 : 0), 'yyyy-MM-dd');

      const { data: leaveData, error } = await supabase
        .from('leave_applied_users')
        .select(`
          id,
          start_date,
          end_date,
          status,
          reason,
          leave_type_id,
          user_id,
          profiles:user_id (
            name,
            email
          ),
          leave_types:leave_type_id (
            label,
            color
          )
        `)
        .eq('status', 'approved')
        .lte('start_date', nextWeekString)
        .gte('end_date', todayString)
        .order('start_date', { ascending: true });

      if (error) {
        console.error('Error fetching leave applications:', error);
        toast.error('Failed to load users on leave');
      } else {
        console.log('Leaves fetched:', leaveData);
        setAllLeaveApplications(leaveData as LeaveApplication[]);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (application: LeaveApplication) => {
    const startDate = new Date(application.start_date);
    const endDate = new Date(application.end_date);
    const today = new Date();
    
    if (isWithinInterval(today, { start: startOfDay(startDate), end: endOfDay(endDate) })) {
      return 'bg-green-100 text-green-800 border-green-200';
    } else if (startDate > today) {
      return 'bg-blue-100 text-blue-800 border-blue-200';
    } else {
      return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (application: LeaveApplication) => {
    const startDate = new Date(application.start_date);
    const endDate = new Date(application.end_date);
    const today = new Date();
    
    if (isWithinInterval(today, { start: startOfDay(startDate), end: endOfDay(endDate) })) {
      return 'On Leave Today';
    } else if (isToday(startDate)) {
      return 'Starting Today';
    } else if (isTomorrow(startDate)) {
      return 'Starting Tomorrow';
    } else if (startDate > today) {
      return 'Upcoming';
    } else {
      return 'Completed';
    }
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start.toDateString() === end.toDateString()) {
      return format(start, 'MMM dd, yyyy');
    }
    
    return `${format(start, 'MMM dd')} - ${format(end, 'MMM dd, yyyy')}`;
  };

  const handleRefresh = () => {
    fetchAllLeaveApplications();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Users on Leave
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <User className="w-5 h-5" />
          Users on Leave
          <Badge variant="secondary" className="ml-2">
            {allLeaveApplications.length}
          </Badge>
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIncludeUpcoming(!includeUpcoming)}
          >
            {includeUpcoming ? 'Show Today Only' : 'Include Upcoming'}
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleRefresh} 
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-96">
          {allLeaveApplications.length === 0 ? (
            <div className="text-center py-8">
              <CalendarDays className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No users on leave {includeUpcoming ? 'or upcoming leaves' : 'today'}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {allLeaveApplications.map((application) => (
                <div
                  key={application.id}
                  className="p-4 rounded-lg border bg-white hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-gray-900">
                        {application.profiles?.name || 'Unknown User'}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {application.profiles?.email}
                      </p>
                    </div>
                    <Badge className={getStatusColor(application)}>
                      {getStatusText(application)}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <CalendarDays className="w-4 h-4" />
                      {formatDateRange(application.start_date, application.end_date)}
                    </div>
                    {application.leave_types && (
                      <div className="flex items-center gap-1">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: application.leave_types.color || '#3B82F6' }}
                        ></div>
                        {application.leave_types.label}
                      </div>
                    )}
                  </div>
                  
                  {application.reason && (
                    <p className="text-sm text-gray-500 mt-2 italic">
                      "{application.reason}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default AllUsersOnLeave;
