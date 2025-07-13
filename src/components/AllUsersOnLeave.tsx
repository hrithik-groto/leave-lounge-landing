import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, User, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, isToday, isTomorrow, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { formatToIST } from '@/lib/timezone';

interface LeaveApplication {
  id: string;
  start_date: string;
  end_date: string;
  status: string;
  reason?: string;
  leave_type_id?: string;
  user_id: string;
  profiles?: {
    name: string;
    email: string;
  } | null;
  leave_types?: {
    label: string;
    color: string;
  } | null;
}

const AllUsersOnLeave = () => {
  const [allLeaveApplications, setAllLeaveApplications] = useState<LeaveApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllLeaveApplications();
  }, []);

  const fetchAllLeaveApplications = async () => {
    try {
      setLoading(true);
      
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7); // Last 7 days
      const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30); // Next 30 days

      const { data, error } = await supabase
        .from('leave_applied_users')
        .select(`
          *,
          profiles:user_id (name, email),
          leave_types:leave_type_id (label, color)
        `)
        .eq('status', 'approved')
        .gte('end_date', startDate.toISOString().split('T')[0])
        .lte('start_date', endDate.toISOString().split('T')[0])
        .order('start_date', { ascending: true });

      if (error) {
        console.error('Error fetching all leave applications:', error);
      } else {
        setAllLeaveApplications((data as any) || []);
      }
    } catch (error) {
      console.error('Error:', error);
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
      return 'On Leave';
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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            All Users on Leave
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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="w-5 h-5" />
          All Users on Leave
          <Badge variant="secondary" className="ml-2">
            {allLeaveApplications.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-96 overflow-y-auto">
        {allLeaveApplications.length === 0 ? (
          <div className="text-center py-8">
            <CalendarDays className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No users on leave</p>
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
      </CardContent>
    </Card>
  );
};

export default AllUsersOnLeave;