import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Clock, Users } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@clerk/clerk-react';
import EnhancedLeaveApplicationForm from './EnhancedLeaveApplicationForm';

interface LeaveApplication {
  id: string;
  start_date: string;
  end_date: string;
  status: string;
  leave_types?: {
    label: string;
    color: string;
  } | null;
  profiles?: {
    name: string;
  } | null;
  user_id: string;
}

interface EnhancedCalendarProps {
  onRefresh?: () => void;
}

const EnhancedCalendar: React.FC<EnhancedCalendarProps> = ({ onRefresh }) => {
  const { user } = useUser();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isApplyDialogOpen, setIsApplyDialogOpen] = useState(false);
  const [leaveApplications, setLeaveApplications] = useState<LeaveApplication[]>([]);
  const [monthlyLeaves, setMonthlyLeaves] = useState<{ [key: string]: LeaveApplication[] }>({});

  useEffect(() => {
    fetchLeaveApplications();
  }, [currentDate]);

  const fetchLeaveApplications = async () => {
    try {
      const startDate = startOfMonth(currentDate);
      const endDate = endOfMonth(currentDate);

      const { data, error } = await supabase
        .from('leave_applied_users')
        .select(`
          *,
          profiles!fk_leave_applied_users_user_id (name),
          leave_types (label, color)
        `)
        .gte('start_date', format(startDate, 'yyyy-MM-dd'))
        .lte('end_date', format(endDate, 'yyyy-MM-dd'))
        .in('status', ['approved', 'pending']);

      if (error) {
        console.error('Error fetching leave applications:', error);
        return;
      }

      setLeaveApplications((data || []) as unknown as LeaveApplication[]);

      // Group leaves by date
      const grouped: { [key: string]: LeaveApplication[] } = {};
      (data || []).forEach((leave: any) => {
        const startDate = new Date(leave.start_date);
        const endDate = new Date(leave.end_date);
        const dates = eachDayOfInterval({ start: startDate, end: endDate });
        
        dates.forEach((date) => {
          const dateKey = format(date, 'yyyy-MM-dd');
          if (!grouped[dateKey]) {
            grouped[dateKey] = [];
          }
          grouped[dateKey].push(leave as LeaveApplication);
        });
      });
      
      setMonthlyLeaves(grouped);
    } catch (error) {
      console.error('Error fetching leave applications:', error);
    }
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setIsApplyDialogOpen(true);
  };

  const handlePrevMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const getLeaveCountForDate = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return monthlyLeaves[dateKey]?.length || 0;
  };

  const getLeaveTypesForDate = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const leaves = monthlyLeaves[dateKey] || [];
    return leaves.slice(0, 3); // Show max 3 leave types
  };

  const renderCalendarHeader = () => (
    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-t-lg">
      <Button
        variant="ghost"
        size="sm"
        onClick={handlePrevMonth}
        className="hover:bg-white/60"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      <div className="flex items-center space-x-2">
        <CalendarIcon className="h-5 w-5 text-purple-600" />
        <h2 className="text-lg font-semibold text-gray-800">
          {format(currentDate, 'MMMM yyyy')}
        </h2>
      </div>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={handleNextMonth}
        className="hover:bg-white/60"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );

  const renderCalendarDays = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return (
      <div className="grid grid-cols-7 gap-1 p-4 bg-gray-50">
        {days.map((day) => (
          <div
            key={day}
            className="text-center text-sm font-medium text-gray-500 py-2"
          >
            {day}
          </div>
        ))}
      </div>
    );
  };

  const renderCalendarDate = (date: Date) => {
    const isCurrentMonth = isSameMonth(date, currentDate);
    const isCurrentDay = isToday(date);
    const leaveCount = getLeaveCountForDate(date);
    const leaveTypes = getLeaveTypesForDate(date);
    
    return (
      <button
        key={date.toISOString()}
        onClick={() => handleDateClick(date)}
        className={cn(
          'h-24 p-1 text-left border border-gray-200 hover:bg-purple-50 transition-all duration-200 relative group',
          isCurrentMonth ? 'bg-white' : 'bg-gray-50 text-gray-400',
          isCurrentDay && 'ring-2 ring-purple-500 bg-purple-100',
          leaveCount > 0 && 'border-purple-300'
        )}
      >
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between">
            <span className={cn(
              'text-sm font-medium',
              isCurrentDay && 'text-purple-700'
            )}>
              {format(date, 'd')}
            </span>
            {leaveCount > 0 && (
              <Badge 
                variant="secondary" 
                className="text-xs px-1 bg-purple-100 text-purple-700"
              >
                {leaveCount}
              </Badge>
            )}
          </div>
          
          <div className="flex-1 flex flex-col gap-0.5 mt-1">
            {leaveTypes.map((leave, index) => (
              <div
                key={index}
                className="text-xs px-1 py-0.5 rounded truncate"
                style={{ 
                  backgroundColor: leave.leave_types?.color || '#3B82F6',
                  color: 'white'
                }}
                title={`${leave.profiles?.name || 'Unknown'} - ${leave.leave_types?.label || 'Leave'}`}
              >
                {leave.profiles?.name?.split(' ')[0] || 'User'}
              </div>
            ))}
            {leaveCount > 3 && (
              <div className="text-xs text-gray-500 px-1">
                +{leaveCount - 3} more
              </div>
            )}
          </div>
          
          {/* Hover effect for adding leave */}
          <div className="absolute inset-0 bg-purple-500 bg-opacity-0 group-hover:bg-opacity-5 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
            <Plus className="h-4 w-4 text-purple-600" />
          </div>
        </div>
      </button>
    );
  };

  const renderCalendarGrid = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDate = new Date(monthStart);
    startDate.setDate(startDate.getDate() - monthStart.getDay());
    
    const endDate = new Date(monthEnd);
    endDate.setDate(endDate.getDate() + (6 - monthEnd.getDay()));
    
    const dates = eachDayOfInterval({ start: startDate, end: endDate });
    
    return (
      <div className="grid grid-cols-7 gap-1 p-4">
        {dates.map(renderCalendarDate)}
      </div>
    );
  };

  return (
    <Card className="w-full shadow-lg border-0 bg-white">
      <CardHeader className="p-0">
        {renderCalendarHeader()}
      </CardHeader>
      <CardContent className="p-0">
        {renderCalendarDays()}
        {renderCalendarGrid()}
        
        {/* Leave Application Dialog */}
        <Dialog open={isApplyDialogOpen} onOpenChange={setIsApplyDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-purple-600" />
                <span>Apply for Leave</span>
              </DialogTitle>
              {selectedDate && (
                <p className="text-sm text-gray-600">
                  Selected date: {format(selectedDate, 'MMMM dd, yyyy')}
                </p>
              )}
            </DialogHeader>
            
            <EnhancedLeaveApplicationForm
              preselectedDate={selectedDate}
              onSuccess={() => {
                setIsApplyDialogOpen(false);
                fetchLeaveApplications();
                onRefresh?.();
              }}
            />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default EnhancedCalendar;