
import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, CalendarDays, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, startOfWeek, endOfWeek } from 'date-fns';

interface LeaveApplication {
  id: string;
  start_date: string;
  end_date: string;
  status: string;
  reason: string;
  holiday_name: string;
  hours_requested: number;
  leave_types: {
    label: string;
    color: string;
  };
}

const EnhancedCalendar = () => {
  const { user } = useUser();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [leaveApplications, setLeaveApplications] = useState<LeaveApplication[]>([]);
  const [companyHolidays, setCompanyHolidays] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      fetchLeaveApplications();
      fetchCompanyHolidays();
    }
  }, [user, currentDate]);

  const fetchLeaveApplications = async () => {
    try {
      const startOfMonthDate = startOfMonth(currentDate);
      const endOfMonthDate = endOfMonth(currentDate);

      const { data, error } = await supabase
        .from('leave_applied_users')
        .select(`
          *,
          leave_types (
            label,
            color
          )
        `)
        .eq('user_id', user?.id)
        .gte('start_date', format(startOfMonthDate, 'yyyy-MM-dd'))
        .lte('end_date', format(endOfMonthDate, 'yyyy-MM-dd'));

      if (error) throw error;
      setLeaveApplications(data || []);
    } catch (error) {
      console.error('Error fetching leave applications:', error);
    }
  };

  const fetchCompanyHolidays = async () => {
    try {
      const startOfMonthDate = startOfMonth(currentDate);
      const endOfMonthDate = endOfMonth(currentDate);

      const { data, error } = await supabase
        .from('company_holidays')
        .select('*')
        .eq('is_active', true)
        .gte('date', format(startOfMonthDate, 'yyyy-MM-dd'))
        .lte('date', format(endOfMonthDate, 'yyyy-MM-dd'));

      if (error) throw error;
      setCompanyHolidays(data || []);
    } catch (error) {
      console.error('Error fetching company holidays:', error);
    }
  };

  const getLeaveForDate = (date: Date) => {
    return leaveApplications.filter(leave => {
      const startDate = new Date(leave.start_date);
      const endDate = new Date(leave.end_date);
      return date >= startDate && date <= endDate;
    });
  };

  const getHolidayForDate = (date: Date) => {
    return companyHolidays.find(holiday => 
      isSameDay(new Date(holiday.date), date)
    );
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  
  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd
  });

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="w-5 h-5" />
            <span>Leave Calendar</span>
          </CardTitle>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigateMonth('prev')}
              className="p-2 hover:bg-gray-100 rounded-md"
            >
              ←
            </button>
            <span className="font-medium text-lg px-4">
              {format(currentDate, 'MMMM yyyy')}
            </span>
            <button
              onClick={() => navigateMonth('next')}
              className="p-2 hover:bg-gray-100 rounded-md"
            >
              →
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 mb-4">
          {weekdays.map(day => (
            <div key={day} className="p-2 text-center font-medium text-gray-600 text-sm">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => {
            const leaves = getLeaveForDate(day);
            const holiday = getHolidayForDate(day);
            const isCurrentMonth = day.getMonth() === currentDate.getMonth();
            const isDayToday = isToday(day);

            return (
              <div
                key={index}
                className={`
                  min-h-[80px] p-1 border border-gray-200 rounded-md
                  ${!isCurrentMonth ? 'bg-gray-50 text-gray-400' : 'bg-white'}
                  ${isDayToday ? 'ring-2 ring-blue-500' : ''}
                  ${holiday ? 'bg-red-50' : ''}
                `}
              >
                <div className={`text-sm font-medium ${isDayToday ? 'text-blue-600' : ''}`}>
                  {format(day, 'd')}
                </div>
                
                {holiday && (
                  <Badge variant="destructive" className="text-xs mb-1 w-full">
                    {holiday.name}
                  </Badge>
                )}

                {leaves.map(leave => (
                  <div key={leave.id} className="mb-1">
                    {leave.leave_types?.label === 'Short Leave' ? (
                      <Badge 
                        variant="secondary" 
                        className="text-xs w-full flex items-center"
                        style={{ backgroundColor: leave.leave_types?.color + '20' }}
                      >
                        <Clock className="w-3 h-3 mr-1" />
                        {leave.hours_requested}h
                      </Badge>
                    ) : (
                      <Badge 
                        variant={leave.status === 'approved' ? 'default' : leave.status === 'rejected' ? 'destructive' : 'secondary'}
                        className="text-xs w-full"
                        style={{ 
                          backgroundColor: leave.status === 'approved' ? leave.leave_types?.color : undefined 
                        }}
                      >
                        {leave.leave_types?.label}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>Approved Leave</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-gray-400 rounded"></div>
            <span>Pending Leave</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span>Company Holiday</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded border-2 border-blue-600"></div>
            <span>Today</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EnhancedCalendar;
