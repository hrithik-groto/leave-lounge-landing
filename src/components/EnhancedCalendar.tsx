import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Clock, Users, User } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@clerk/clerk-react';
import { EnhancedLeaveApplicationForm } from './EnhancedLeaveApplicationForm';

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

interface EnhancedCalendarRef {
  openApplyDialog: () => void;
}

const EnhancedCalendar = forwardRef<EnhancedCalendarRef, EnhancedCalendarProps>(({ onRefresh }, ref) => {
  const { user } = useUser();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isApplyDialogOpen, setIsApplyDialogOpen] = useState(false);
  const [leaveApplications, setLeaveApplications] = useState<LeaveApplication[]>([]);
  const [monthlyLeaves, setMonthlyLeaves] = useState<{ [key: string]: LeaveApplication[] }>({});

  useImperativeHandle(ref, () => ({
    openApplyDialog: () => {
      setSelectedDate(new Date());
      setIsApplyDialogOpen(true);
    }
  }));

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
      <TooltipProvider key={date.toISOString()}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => handleDateClick(date)}
              className={cn(
                'h-28 p-2 text-left border border-gray-200 hover:bg-purple-50 transition-all duration-300 relative group hover:shadow-md hover:scale-105',
                isCurrentMonth ? 'bg-white' : 'bg-gray-50 text-gray-400',
                isCurrentDay && 'ring-2 ring-purple-500 bg-gradient-to-br from-purple-100 to-pink-100 shadow-lg',
                leaveCount > 0 && 'border-purple-300 bg-gradient-to-br from-purple-25 to-purple-50'
              )}
            >
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between mb-1">
                  <span className={cn(
                    'text-sm font-bold',
                    isCurrentDay && 'text-purple-700'
                  )}>
                    {format(date, 'd')}
                  </span>
                  {leaveCount > 0 && (
                    <Badge 
                      variant="secondary" 
                      className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 font-semibold"
                    >
                      {leaveCount}
                    </Badge>
                  )}
                </div>
                
                <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                  {leaveTypes.slice(0, 2).map((leave, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded-md shadow-sm border border-white/50"
                      style={{ 
                        backgroundColor: leave.leave_types?.color || '#3B82F6',
                        color: 'white'
                      }}
                    >
                      <User className="w-3 h-3" />
                      <span className="truncate font-medium">
                        {leave.profiles?.name?.split(' ')[0] || 'User'}
                      </span>
                    </div>
                  ))}
                  {leaveCount > 2 && (
                    <div className="text-xs text-gray-600 px-2 py-1 bg-gray-100 rounded-md border border-gray-200 font-medium">
                      +{leaveCount - 2} more people
                    </div>
                  )}
                </div>
                
                {/* Hover effect for adding leave */}
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center rounded-lg">
                  <div className="bg-white/90 rounded-full p-2 shadow-lg">
                    <Plus className="h-4 w-4 text-purple-600" />
                  </div>
                </div>
              </div>
            </button>
          </TooltipTrigger>
          {leaveCount > 0 && (
            <TooltipContent>
              <div className="max-w-48">
                <p className="font-semibold mb-1">People on leave:</p>
                {leaveTypes.map((leave, index) => (
                  <div key={index} className="text-sm">
                    <span className="font-medium">{leave.profiles?.name || 'Unknown'}</span>
                    {' - '}
                    <span className="text-gray-600">{leave.leave_types?.label || 'Leave'}</span>
                  </div>
                ))}
              </div>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
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
          <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] p-0 flex flex-col overflow-hidden">
            <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
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
            
            <div className="flex-1 overflow-hidden">
              <EnhancedLeaveApplicationForm
                onSuccess={() => {
                  setIsApplyDialogOpen(false);
                  fetchLeaveApplications();
                  onRefresh?.();
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
});

EnhancedCalendar.displayName = 'EnhancedCalendar';

export default EnhancedCalendar;
