import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Columns3, Grid, Calendar as CalendarIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay } from 'date-fns';

export type LeaveInfo = {
  id: string;
  user_name: string;
  user_email: string;
  leave_type: string;
  reason: string;
  start_date: string;
  end_date: string;
  status: string;
  is_half_day: boolean;
  leave_time_start: string | null;
  leave_time_end: string | null;
};

export type DayType = {
  day: string;
  date: Date;
  classNames: string;
  isCurrentMonth: boolean;
  leaveInfo?: LeaveInfo[];
  onClick?: () => void;
};

interface DayProps {
  classNames: string;
  day: DayType;
  onHover: (day: string | null, leaveCount: number) => void;
  onClick: (date: Date) => void;
}

const Day: React.FC<DayProps> = ({ classNames, day, onHover, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  const leaveCount = day.leaveInfo?.length || 0;
  
  return (
    <motion.div
      className={`relative flex items-center justify-center py-1 cursor-pointer transition-all duration-200 ${classNames} hover:bg-accent/50`}
      style={{ height: '4rem', borderRadius: 16 }}
      onMouseEnter={() => {
        setIsHovered(true);
        onHover(day.day, leaveCount);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        onHover(null, 0);
      }}
      onClick={() => onClick(day.date)}
      id={`day-${day.day}`}
    >
      <motion.div className="flex flex-col items-center justify-center">
        <span className={`text-sm ${day.isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'}`}>
          {day.day}
        </span>
      </motion.div>
      
      {leaveCount > 0 && (
        <motion.div
          className="absolute bottom-1 right-1 flex size-5 items-center justify-center rounded-full bg-primary p-1 text-[10px] font-bold text-primary-foreground"
          layoutId={`day-${day.day}-leave-count`}
          style={{ borderRadius: 999 }}
        >
          {leaveCount}
        </motion.div>
      )}

      <AnimatePresence>
        {leaveCount > 0 && isHovered && (
          <div className="absolute inset-0 flex size-full items-center justify-center">
            <motion.div
              className="flex size-10 items-center justify-center bg-primary p-1 text-xs font-bold text-primary-foreground"
              layoutId={`day-${day.day}-leave-count`}
              style={{ borderRadius: 999 }}
            >
              {leaveCount}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const CalendarGrid: React.FC<{ 
  days: DayType[];
  onHover: (day: string | null, leaveCount: number) => void;
  onDayClick: (date: Date) => void;
}> = ({ days, onHover, onDayClick }) => {
  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day, index) => (
        <Day
          key={`${day.day}-${index}`}
          classNames={day.classNames}
          day={day}
          onHover={onHover}
          onClick={onDayClick}
        />
      ))}
    </div>
  );
};

interface LeaveCalendarProps {
  onDayClick?: (date: Date) => void;
  className?: string;
}

const LeaveCalendar = React.forwardRef<HTMLDivElement, LeaveCalendarProps>(
  ({ className, onDayClick, ...props }, ref) => {
    const [moreView, setMoreView] = useState(false);
    const [hoveredDay, setHoveredDay] = useState<string | null>(null);
    const [hoveredLeaveCount, setHoveredLeaveCount] = useState(0);
    const [currentDate] = useState(new Date());
    const [leaveData, setLeaveData] = useState<LeaveInfo[]>([]);
    const [loading, setLoading] = useState(true);

    const handleDayHover = (day: string | null, leaveCount: number) => {
      setHoveredDay(day);
      setHoveredLeaveCount(leaveCount);
    };

    const handleDayClick = (date: Date) => {
      if (onDayClick) {
        onDayClick(date);
      }
    };

    // Fetch leave data
    useEffect(() => {
      const fetchLeaveData = async () => {
        try {
          // First, get the leave applications
          const { data: leaves, error: leavesError } = await supabase
            .from('leave_applied_users')
            .select(`
              id,
              user_id,
              start_date,
              end_date,
              reason,
              status,
              is_half_day,
              leave_time_start,
              leave_time_end,
              leave_type_id
            `)
            .gte('end_date', format(startOfMonth(currentDate), 'yyyy-MM-dd'))
            .lte('start_date', format(endOfMonth(currentDate), 'yyyy-MM-dd'))
            .in('status', ['approved', 'pending']);

          if (leavesError) {
            console.error('Error fetching leave data:', leavesError);
            return;
          }

          if (!leaves || leaves.length === 0) {
            setLeaveData([]);
            return;
          }

          // Get user profiles
          const userIds = [...new Set(leaves.map(leave => leave.user_id))];
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, name, email')
            .in('id', userIds);

          if (profilesError) {
            console.error('Error fetching profiles:', profilesError);
          }

          // Get leave types
          const leaveTypeIds = [...new Set(leaves.map(leave => leave.leave_type_id).filter(Boolean))];
          const { data: leaveTypes, error: leaveTypesError } = await supabase
            .from('leave_types')
            .select('id, label')
            .in('id', leaveTypeIds);

          if (leaveTypesError) {
            console.error('Error fetching leave types:', leaveTypesError);
          }

          // Transform the data
          const transformedLeaves: LeaveInfo[] = leaves.map(leave => {
            const profile = profiles?.find(p => p.id === leave.user_id);
            const leaveType = leaveTypes?.find(lt => lt.id === leave.leave_type_id);
            
            return {
              id: leave.id,
              user_name: profile?.name || 'Unknown User',
              user_email: profile?.email || '',
              leave_type: leaveType?.label || 'Unknown',
              reason: leave.reason || '',
              start_date: leave.start_date,
              end_date: leave.end_date,
              status: leave.status || 'pending',
              is_half_day: leave.is_half_day || false,
              leave_time_start: leave.leave_time_start,
              leave_time_end: leave.leave_time_end,
            };
          });

          setLeaveData(transformedLeaves);
        } catch (error) {
          console.error('Error in fetchLeaveData:', error);
        } finally {
          setLoading(false);
        }
      };

      fetchLeaveData();
    }, [currentDate]);

    // Generate calendar days
    const days = useMemo(() => {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      const daysInMonth = eachDayOfInterval({ start, end });
      
      // Add previous month days to fill the grid
      const startDay = getDay(start);
      const prevMonthDays = [];
      for (let i = startDay - 1; i >= 0; i--) {
        const prevDay = new Date(start);
        prevDay.setDate(prevDay.getDate() - (i + 1));
        prevMonthDays.push(prevDay);
      }
      
      // Add next month days to fill the grid
      const endDay = getDay(end);
      const nextMonthDays = [];
      for (let i = 1; i <= (6 - endDay); i++) {
        const nextDay = new Date(end);
        nextDay.setDate(nextDay.getDate() + i);
        nextMonthDays.push(nextDay);
      }
      
      const allDays = [...prevMonthDays, ...daysInMonth, ...nextMonthDays];
      
      return allDays.map(date => {
        const dayNumber = date.getDate().toString().padStart(2, '0');
        const isCurrentMonth = date.getMonth() === currentDate.getMonth();
        const isWeekend = getDay(date) === 0 || getDay(date) === 6;
        
        // Find leaves for this date
        const dayLeaves = leaveData.filter(leave => {
          const leaveStart = new Date(leave.start_date);
          const leaveEnd = new Date(leave.end_date);
          return date >= leaveStart && date <= leaveEnd;
        });
        
        return {
          day: dayNumber,
          date,
          isCurrentMonth,
          classNames: isCurrentMonth 
            ? (isWeekend ? 'bg-muted/50' : 'bg-card') 
            : 'bg-muted/20',
          leaveInfo: dayLeaves.length > 0 ? dayLeaves : undefined,
        };
      });
    }, [currentDate, leaveData]);

    const sortedLeaves = useMemo(() => {
      if (!hoveredDay) return leaveData;
      
      const hoveredDate = days.find(d => d.day === hoveredDay)?.date;
      if (!hoveredDate) return leaveData;
      
      // Get leaves for the hovered day first
      const hoveredDayLeaves = leaveData.filter(leave => {
        const leaveStart = new Date(leave.start_date);
        const leaveEnd = new Date(leave.end_date);
        return hoveredDate >= leaveStart && hoveredDate <= leaveEnd;
      });
      
      const otherLeaves = leaveData.filter(leave => {
        const leaveStart = new Date(leave.start_date);
        const leaveEnd = new Date(leave.end_date);
        return !(hoveredDate >= leaveStart && hoveredDate <= leaveEnd);
      });
      
      return [...hoveredDayLeaves, ...otherLeaves];
    }, [hoveredDay, leaveData, days]);

    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      );
    }

    return (
      <AnimatePresence mode="wait">
        <motion.div
          ref={ref}
          className={`relative mx-auto my-10 flex w-full flex-col items-center justify-center gap-8 lg:flex-row ${className}`}
          {...props}
        >
          <motion.div layout className="w-full max-w-lg">
            <motion.div key="calendar-view" className="flex w-full flex-col gap-4">
              <div className="flex w-full items-center justify-between">
                <motion.h2 className="mb-2 text-4xl font-bold tracking-wider text-foreground">
                  {format(currentDate, 'MMM')} <span className="opacity-50">{format(currentDate, 'yyyy')}</span>
                </motion.h2>
                <motion.button
                  className="relative flex items-center gap-3 rounded-lg border border-border px-1.5 py-1 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setMoreView(!moreView)}
                >
                  <Columns3 className="z-[2] w-4 h-4" />
                  <Grid className="z-[2] w-4 h-4" />
                  <div
                    className="absolute left-0 top-0 h-[85%] w-7 rounded-md bg-primary transition-transform duration-300"
                    style={{
                      top: '50%',
                      transform: moreView
                        ? 'translateY(-50%) translateX(40px)'
                        : 'translateY(-50%) translateX(4px)',
                    }}
                  />
                </motion.button>
              </div>
              
              <div className="grid grid-cols-7 gap-2">
                {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day) => (
                  <div
                    key={day}
                    className="rounded-xl bg-muted py-1 text-center text-xs text-muted-foreground font-medium"
                  >
                    {day}
                  </div>
                ))}
              </div>
              
              <CalendarGrid days={days} onHover={handleDayHover} onDayClick={handleDayClick} />
              
              {hoveredDay && hoveredLeaveCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="text-sm text-muted-foreground text-center"
                >
                  {hoveredLeaveCount} user{hoveredLeaveCount > 1 ? 's' : ''} on leave on {hoveredDay}
                </motion.div>
              )}
            </motion.div>
          </motion.div>
          
          {moreView && (
            <motion.div
              className="w-full max-w-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div key="more-view" className="mt-4 flex w-full flex-col gap-4">
                <div className="flex w-full flex-col items-start justify-between">
                  <motion.h2 className="mb-2 text-4xl font-bold tracking-wider text-foreground">
                    Leave Applications
                  </motion.h2>
                  <p className="font-medium text-muted-foreground">
                    See all leave applications for {format(currentDate, 'MMMM yyyy')}
                  </p>
                </div>
                
                <motion.div
                  className="flex h-[620px] flex-col items-start justify-start overflow-hidden overflow-y-scroll rounded-xl border-2 border-border shadow-md bg-card"
                  layout
                >
                  <AnimatePresence>
                    {sortedLeaves.length === 0 ? (
                      <div className="flex items-center justify-center w-full h-full text-muted-foreground">
                        No leave applications found
                      </div>
                    ) : (
                      sortedLeaves.map((leave, index) => (
                        <motion.div
                          key={leave.id}
                          className="w-full border-b border-border py-0 last:border-b-0"
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{
                            duration: 0.2,
                            delay: index * 0.05,
                          }}
                        >
                          <div className="p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-sm text-foreground font-medium">
                                {format(new Date(leave.start_date), 'MMM dd')} - {format(new Date(leave.end_date), 'MMM dd')}
                              </span>
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                leave.status === 'approved' ? 'bg-green-100 text-green-800' :
                                leave.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {leave.status}
                              </span>
                            </div>
                            <h3 className="mb-1 text-lg font-semibold text-foreground">
                              {leave.user_name}
                            </h3>
                            <p className="mb-1 text-sm text-muted-foreground">
                              {leave.leave_type} • {leave.user_email}
                            </p>
                            {leave.reason && (
                              <p className="text-sm text-muted-foreground italic">
                                "{leave.reason}"
                              </p>
                            )}
                            {leave.is_half_day && (
                              <div className="flex items-center mt-2 text-primary">
                                <CalendarIcon className="mr-1 h-4 w-4" />
                                <span className="text-sm">
                                  Half day {leave.leave_time_start && leave.leave_time_end 
                                    ? `(${leave.leave_time_start} - ${leave.leave_time_end})`
                                    : ''
                                  }
                                </span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    );
  }
);

LeaveCalendar.displayName = 'LeaveCalendar';

export default LeaveCalendar;