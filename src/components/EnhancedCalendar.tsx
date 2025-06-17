
import React, { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Eye } from 'lucide-react';
import { format, isSameDay, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@clerk/clerk-react';
import LeaveApplicationForm from './LeaveApplicationForm';

interface Leave {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  status: string;
  reason: string;
  leave_type_id: string;
  holiday_name?: string;
  meeting_details?: string;
  hours_requested?: number;
  is_half_day?: boolean;
  leave_types?: {
    label: string;
    color: string;
  } | null;
  profiles?: {
    name: string;
  } | null;
}

interface Holiday {
  id: string;
  date: string;
  name: string;
  description: string;
}

interface EnhancedCalendarProps {
  onRefresh?: () => void;
}

const EnhancedCalendar: React.FC<EnhancedCalendarProps> = ({ onRefresh }) => {
  const { user } = useUser();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [selectedDateForLeave, setSelectedDateForLeave] = useState<Date | undefined>();

  useEffect(() => {
    fetchLeaves();
    fetchHolidays();
  }, []);

  const fetchLeaves = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_applied_users')
        .select(`
          *,
          leave_types (label, color),
          profiles (name)
        `)
        .order('start_date', { ascending: true });

      if (error) {
        console.error('Error fetching leaves:', error);
        return;
      }

      console.log('Fetched leaves data:', data);
      
      // Transform the data to ensure proper typing
      const transformedLeaves: Leave[] = (data || []).map(leave => ({
        ...leave,
        leave_types: leave.leave_types || null,
        profiles: leave.profiles || null
      }));
      
      setLeaves(transformedLeaves);
    } catch (error) {
      console.error('Error fetching leaves:', error);
    }
  };

  const fetchHolidays = async () => {
    try {
      const { data, error } = await supabase
        .from('company_holidays')
        .select('*')
        .eq('is_active', true)
        .order('date', { ascending: true });

      if (error) {
        console.error('Error fetching holidays:', error);
        return;
      }

      console.log('Fetched holidays data:', data);
      setHolidays(data || []);
    } catch (error) {
      console.error('Error fetching holidays:', error);
    }
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setSelectedDateForLeave(date);
    setShowLeaveForm(true);
  };

  const getEventsForDate = (date: Date) => {
    const events = [];

    // Add holidays
    holidays.forEach(holiday => {
      if (isSameDay(parseISO(holiday.date), date)) {
        events.push({
          type: 'holiday',
          title: holiday.name,
          color: '#EF4444',
          description: holiday.description
        });
      }
    });

    // Add leaves
    leaves.forEach(leave => {
      const startDate = parseISO(leave.start_date);
      const endDate = parseISO(leave.end_date);
      
      if (date >= startDate && date <= endDate) {
        events.push({
          type: 'leave',
          title: `${leave.profiles?.name || 'Unknown'} - ${leave.leave_types?.label || 'Leave'}`,
          color: leave.leave_types?.color || '#3B82F6',
          status: leave.status,
          reason: leave.reason,
          isOwn: leave.user_id === user?.id
        });
      }
    });

    return events;
  };

  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Leave Calendar</CardTitle>
          <Button onClick={() => setShowLeaveForm(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Apply Leave
          </Button>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            className="w-full"
            modifiers={{
              hasEvents: (date) => getEventsForDate(date).length > 0,
              holiday: (date) => holidays.some(h => isSameDay(parseISO(h.date), date)),
              leave: (date) => leaves.some(l => {
                const start = parseISO(l.start_date);
                const end = parseISO(l.end_date);
                return date >= start && date <= end;
              })
            }}
            modifiersStyles={{
              hasEvents: { 
                backgroundColor: '#EFF6FF',
                border: '1px solid #3B82F6',
                borderRadius: '6px'
              },
              holiday: {
                backgroundColor: '#FEF2F2',
                color: '#DC2626',
                fontWeight: 'bold'
              },
              leave: {
                backgroundColor: '#F0FDF4',
                color: '#059669'
              }
            }}
            onDayClick={handleDateClick}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Eye className="w-4 h-4 mr-2" />
            {selectedDate ? format(selectedDate, 'MMM dd, yyyy') : 'Select a date'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {selectedDateEvents.length === 0 ? (
            <p className="text-gray-500 text-sm">No events on this date</p>
          ) : (
            selectedDateEvents.map((event, index) => (
              <div key={index} className="p-3 rounded-lg border-l-4 bg-gray-50" 
                   style={{ borderLeftColor: event.color }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-sm">{event.title}</p>
                  {event.type === 'leave' && (
                    <div className="flex space-x-1">
                      <Badge 
                        variant={event.status === 'approved' ? 'default' : 
                                event.status === 'rejected' ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {event.status}
                      </Badge>
                      {event.isOwn && (
                        <Badge variant="outline" className="text-xs">
                          Your Leave
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                {(event.description || event.reason) && (
                  <p className="text-xs text-gray-600">
                    {event.description || event.reason}
                  </p>
                )}
              </div>
            ))
          )}
          
          {selectedDate && (
            <Button 
              onClick={() => handleDateClick(selectedDate)} 
              className="w-full mt-4"
              size="sm"
            >
              Apply Leave for this Date
            </Button>
          )}
        </CardContent>
      </Card>

      <LeaveApplicationForm
        isOpen={showLeaveForm}
        onClose={() => setShowLeaveForm(false)}
        selectedDate={selectedDateForLeave}
        onSuccess={() => {
          fetchLeaves();
          onRefresh?.();
        }}
      />
    </div>
  );
};

export default EnhancedCalendar;
