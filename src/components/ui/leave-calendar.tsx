import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Columns3, Grid, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay, addMonths, subMonths, isAfter, isBefore, startOfDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import LeaveTooltip from './leave-tooltip';

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
  onHover: (day: string | null, leaveCount: number, leaves: LeaveInfo[], date: Date | null) => void;
  onClick: (date: Date) => void;
  userHasLeaveOnDate?: boolean;
  isDisabled?: boolean;
}

const Day: React.FC<DayProps> = ({ classNames, day, onHover, onClick, userHasLeaveOnDate, isDisabled }) => {
  const [isHovered, setIsHovered] = useState(false);
  const approvedLeaveCount = day.leaveInfo?.filter(leave => leave.status === 'approved').length || 0;
  const totalLeaveCount = day.leaveInfo?.length || 0;
  const isPastDate = isBefore(day.date, startOfDay(new Date()));
  const canClick = day.isCurrentMonth && !isPastDate && !userHasLeaveOnDate && !isDisabled;
  
  return (
    <div
      className={`relative flex items-center justify-center py-1 transition-all duration-200 ${classNames} ${
        canClick ? 'cursor-pointer hover:bg-accent/50' : isPastDate ? 'cursor-not-allowed opacity-50 bg-muted/50' : 'cursor-default'
      } ${userHasLeaveOnDate ? 'ring-2 ring-orange-400 bg-orange-50 dark:bg-orange-950/20' : ''}`}
      style={{ height: '4rem', borderRadius: 16 }}
      onMouseEnter={() => {
        setIsHovered(true);
        onHover(day.day, totalLeaveCount, day.leaveInfo || [], day.date);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        onHover(null, 0, [], null);
      }}
      onClick={() => canClick && onClick(day.date)}
      id={`day-${day.day}`}
    >
      <div className="flex flex-col items-center justify-center">
        <span className={`text-sm font-medium ${
          day.isCurrentMonth 
            ? isPastDate 
              ? 'text-muted-foreground line-through' 
              : 'text-foreground' 
            : 'text-muted-foreground opacity-60'
        }`}>
          {day.day}
        </span>
        {userHasLeaveOnDate && (
          <span className="text-xs text-orange-600 font-medium">Applied</span>
        )}
      </div>
      
      {totalLeaveCount > 0 && (
        <div
          className={`absolute bottom-1 right-1 flex size-5 items-center justify-center rounded-full bg-primary p-1 text-[10px] font-bold text-primary-foreground shadow-sm transition-transform hover:scale-110 ${
            isHovered ? 'scale-125' : ''
          }`}
          style={{ borderRadius: 999 }}
        >
          {totalLeaveCount}
        </div>
      )}

      {totalLeaveCount > 0 && isHovered && (
        <div className="absolute inset-0 flex size-full items-center justify-center">
          <div
            className="flex size-10 items-center justify-center bg-primary p-1 text-xs font-bold text-primary-foreground shadow-md animate-scale-in"
            style={{ borderRadius: 999 }}
          >
            {totalLeaveCount}
          </div>
        </div>
      )}
    </div>
  );
};

const CalendarGrid: React.FC<{ 
  days: DayType[];
  onHover: (day: string | null, leaveCount: number, leaves: LeaveInfo[], date: Date | null) => void;
  onDayClick: (date: Date) => void;
  userLeaves: LeaveInfo[];
  currentUserId: string | undefined;
}> = ({ days, onHover, onDayClick, userLeaves, currentUserId }) => {
  // Check if user has leave on specific dates
  const userHasLeaveOnDate = (date: Date) => {
    return userLeaves.some(leave => {
      const leaveStart = new Date(leave.start_date);
      const leaveEnd = new Date(leave.end_date);
      return date >= leaveStart && date <= leaveEnd;
    });
  };

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day, index) => (
        <Day
          key={`${day.day}-${index}`}
          classNames={day.classNames}
          day={day}
          onHover={onHover}
          onClick={onDayClick}
          userHasLeaveOnDate={userHasLeaveOnDate(day.date)}
          isDisabled={false}
        />
      ))}
    </div>
  );
};

interface LeaveCalendarProps {
  onDayClick?: (date: Date) => void;
  className?: string;
  currentUserId?: string;
}

const LeaveCalendar = React.forwardRef<HTMLDivElement, LeaveCalendarProps>(
  ({ className, onDayClick, currentUserId, ...props }, ref) => {
    const [moreView, setMoreView] = useState(false);
    const [hoveredDay, setHoveredDay] = useState<string | null>(null);
    const [hoveredLeaveCount, setHoveredLeaveCount] = useState(0);
    const [hoveredLeaves, setHoveredLeaves] = useState<LeaveInfo[]>([]);
    const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
    const [showTooltip, setShowTooltip] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [leaveData, setLeaveData] = useState<LeaveInfo[]>([]);
    const [userLeaves, setUserLeaves] = useState<LeaveInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleDayHover = (day: string | null, leaveCount: number, leaves: LeaveInfo[], date: Date | null) => {
      setHoveredDay(day);
      setHoveredLeaveCount(leaveCount);
      setHoveredLeaves(leaves);
      setHoveredDate(date);
      
      if (day && leaveCount > 0 && date) {
        // Calculate tooltip position
        const dayElement = document.getElementById(`day-${day}`);
        if (dayElement) {
          const rect = dayElement.getBoundingClientRect();
          setTooltipPosition({
            x: rect.left + rect.width / 2,
            y: rect.top - 10
          });
          
          // Clear any existing timeout
          if (tooltipTimeoutRef.current) {
            clearTimeout(tooltipTimeoutRef.current);
          }
          
          // Show tooltip after a brief delay
          tooltipTimeoutRef.current = setTimeout(() => {
            setShowTooltip(true);
          }, 300);
        }
      } else {
        // Hide tooltip immediately
        if (tooltipTimeoutRef.current) {
          clearTimeout(tooltipTimeoutRef.current);
        }
        setShowTooltip(false);
      }
    };

    const handleDayClick = (date: Date) => {
      // Check if it's a past date
      if (isBefore(date, startOfDay(new Date()))) {
        toast({
          title: "Invalid Date",
          description: "Cannot apply for leave on past dates",
          variant: "destructive"
        });
        return;
      }

      // Check if user already has leave on this date
      const hasLeave = userLeaves.some(leave => {
        const leaveStart = new Date(leave.start_date);
        const leaveEnd = new Date(leave.end_date);
        return date >= leaveStart && date <= leaveEnd;
      });

      if (hasLeave) {
        toast({
          title: "Leave Already Applied",
          description: "You have already applied for leave on this date",
          variant: "destructive"
        });
        return;
      }

      if (onDayClick) {
        onDayClick(date);
      }
    };

    const goToPreviousMonth = () => {
      setCurrentDate(prev => subMonths(prev, 1));
    };

    const goToNextMonth = () => {
      setCurrentDate(prev => addMonths(prev, 1));
    };

    // Fetch leave data
    useEffect(() => {
      const fetchLeaveData = async () => {
        try {
          // Get all leaves for the current month (for calendar display)
          const { data: allLeaves, error: allLeavesError } = await supabase
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
            .lte('start_date', format(endOfMonth(currentDate), 'yyyy-MM-dd'));

          // Get user's own leaves (including pending)
          let userLeavesQuery = null;
          if (currentUserId) {
            userLeavesQuery = await supabase
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
              .eq('user_id', currentUserId)
              .gte('end_date', format(startOfMonth(currentDate), 'yyyy-MM-dd'))
              .lte('start_date', format(endOfMonth(currentDate), 'yyyy-MM-dd'))
              .in('status', ['approved', 'pending']);
          }

          if (allLeavesError) {
            console.error('Error fetching leave data:', allLeavesError);
            return;
          }

          if (userLeavesQuery?.error) {
            console.error('Error fetching user leaves:', userLeavesQuery.error);
          }

          const allLeavesData = allLeaves || [];
          const userLeavesData = userLeavesQuery?.data || [];

          // Get user profiles for all users in the data
          const userIds = [...new Set(allLeavesData.map(leave => leave.user_id))];
          let profiles = [];
          if (userIds.length > 0) {
            const { data: profilesData, error: profilesError } = await supabase
              .from('profiles')
              .select('id, name, email')
              .in('id', userIds);

            if (profilesError) {
              console.error('Error fetching profiles:', profilesError);
            } else {
              profiles = profilesData || [];
            }
          }

          // Get leave types
          const leaveTypeIds = [...new Set(allLeavesData.map(leave => leave.leave_type_id).filter(Boolean))];
          let leaveTypes = [];
          if (leaveTypeIds.length > 0) {
            const { data: leaveTypesData, error: leaveTypesError } = await supabase
              .from('leave_types')
              .select('id, label')
              .in('id', leaveTypeIds);

            if (leaveTypesError) {
              console.error('Error fetching leave types:', leaveTypesError);
            } else {
              leaveTypes = leaveTypesData || [];
            }
          }

          // Transform all leaves data
          const transformedAllLeaves: LeaveInfo[] = allLeavesData.map(leave => {
            const profile = profiles?.find(p => p.id === leave.user_id);
            const leaveType = leaveTypes?.find(lt => lt.id === leave.leave_type_id);
            
            return {
              id: leave.id,
              user_name: profile?.name || 'Unknown User',
              user_email: profile?.email || '',
              leave_type: leaveType?.label || 'Leave',
              reason: leave.reason || '',
              start_date: leave.start_date,
              end_date: leave.end_date,
              status: leave.status || 'pending',
              is_half_day: leave.is_half_day || false,
              leave_time_start: leave.leave_time_start,
              leave_time_end: leave.leave_time_end,
            };
          });

          // Transform user leaves data
          const transformedUserLeaves: LeaveInfo[] = userLeavesData.map(leave => {
            const profile = profiles?.find(p => p.id === leave.user_id);
            const leaveType = leaveTypes?.find(lt => lt.id === leave.leave_type_id);
            
            return {
              id: leave.id,
              user_name: profile?.name || 'Unknown User',
              user_email: profile?.email || '',
              leave_type: leaveType?.label || 'Leave',
              reason: leave.reason || '',
              start_date: leave.start_date,
              end_date: leave.end_date,
              status: leave.status || 'pending',
              is_half_day: leave.is_half_day || false,
              leave_time_start: leave.leave_time_start,
              leave_time_end: leave.leave_time_end,
            };
          });

          setLeaveData(transformedAllLeaves);
          setUserLeaves(transformedUserLeaves);
        } catch (error) {
          console.error('Error in fetchLeaveData:', error);
        } finally {
          setLoading(false);
        }
      };

      fetchLeaveData();
    }, [currentDate, currentUserId]);

    // Real-time updates
    useEffect(() => {
      const channel = supabase
        .channel('leave_updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'leave_applied_users'
          },
          (payload) => {
            console.log('Real-time leave update:', payload);
            // Debounce the updates to prevent UI thrashing
            setTimeout(() => {
              // Re-fetch data when there's a change
              const refetchData = async () => {
                try {
                  const { data: allLeaves, error: allLeavesError } = await supabase
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
                    .lte('start_date', format(endOfMonth(currentDate), 'yyyy-MM-dd'));

                  if (!allLeavesError && allLeaves) {
                    // Get profiles and leave types for the updated data
                    const userIds = [...new Set(allLeaves.map(leave => leave.user_id))];
                    const leaveTypeIds = [...new Set(allLeaves.map(leave => leave.leave_type_id).filter(Boolean))];

                    const [profilesResult, leaveTypesResult] = await Promise.all([
                      userIds.length > 0 ? supabase.from('profiles').select('id, name, email').in('id', userIds) : { data: [], error: null },
                      leaveTypeIds.length > 0 ? supabase.from('leave_types').select('id, label').in('id', leaveTypeIds) : { data: [], error: null }
                    ]);

                    const profiles = profilesResult.data || [];
                    const leaveTypes = leaveTypesResult.data || [];

                    const transformedLeaves: LeaveInfo[] = allLeaves.map(leave => {
                      const profile = profiles?.find(p => p.id === leave.user_id);
                      const leaveType = leaveTypes?.find(lt => lt.id === leave.leave_type_id);
                      
                      return {
                        id: leave.id,
                        user_name: profile?.name || 'Unknown User',
                        user_email: profile?.email || '',
                        leave_type: leaveType?.label || 'Leave',
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

                    // Update user leaves if current user is involved
                    if (currentUserId) {
                      const userSpecificLeaves = transformedLeaves.filter(leave => 
                        leave.user_name && ['approved', 'pending'].includes(leave.status)
                      );
                      setUserLeaves(userSpecificLeaves.filter(leave => leave.user_email && leave.user_email.includes(currentUserId)));
                    }
                  }
                } catch (error) {
                  console.error('Error in real-time refetch:', error);
                }
              };

              refetchData();
            }, 500); // 500ms debounce
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, [currentDate, currentUserId]);

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
        
        // Find all leaves for this date (approved and pending)
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
      <div
        ref={ref}
        className={`relative mx-auto my-10 flex w-full flex-col items-center justify-center gap-8 lg:flex-row ${className}`}
        {...props}
      >
        <div className="w-full max-w-lg">
          <div className="flex w-full flex-col gap-4">
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <button
                    className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors hover:scale-105 active:scale-95"
                    onClick={goToPreviousMonth}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <h2 className="text-4xl font-bold tracking-wider text-foreground min-w-[200px] text-center">
                    {format(currentDate, 'MMM')} <span className="opacity-50">{format(currentDate, 'yyyy')}</span>
                  </h2>
                  <button
                    className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors hover:scale-105 active:scale-95"
                    onClick={goToNextMonth}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <button
                className="relative flex items-center gap-3 rounded-lg border border-border px-1.5 py-1 text-muted-foreground hover:text-foreground transition-colors hover:scale-102 active:scale-98"
                onClick={() => setMoreView(!moreView)}
              >
                <Columns3 className={`z-[2] w-4 h-4 transition-opacity ${!moreView ? 'opacity-100' : 'opacity-50'}`} />
                <Grid className={`z-[2] w-4 h-4 transition-opacity ${moreView ? 'opacity-100' : 'opacity-50'}`} />
                <div
                  className="absolute left-0 top-0 h-[85%] w-7 rounded-md bg-primary transition-transform duration-300"
                  style={{
                    top: '50%',
                    transform: moreView
                      ? 'translateY(-50%) translateX(40px)'
                      : 'translateY(-50%) translateX(4px)',
                  }}
                />
              </button>
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
            
            <CalendarGrid 
              days={days} 
              onHover={handleDayHover} 
              onDayClick={handleDayClick}
              userLeaves={userLeaves}
              currentUserId={currentUserId}
            />
            
            {hoveredDay && hoveredLeaveCount > 0 && (
              <div className="text-sm text-muted-foreground text-center animate-fade-in">
                {hoveredLeaveCount} user{hoveredLeaveCount > 1 ? 's' : ''} on approved leave on {hoveredDay}
              </div>
            )}
            
            <div className="text-xs text-muted-foreground text-center">
              <p>• Gray dates are past days (cannot apply)</p>
              <p>• Orange bordered dates have your existing leaves</p>
              <p>• Click on available dates to apply for leave</p>
            </div>
          </div>
        </div>
        
        {moreView && (
          <div className="w-full max-w-lg animate-fade-in">
            <div className="mt-4 flex w-full flex-col gap-4">
              <div className="flex w-full flex-col items-start justify-between">
                <h2 className="mb-2 text-4xl font-bold tracking-wider text-foreground">
                  Leave Applications
                </h2>
                <p className="font-medium text-muted-foreground">
                  See all leave applications for {format(currentDate, 'MMMM yyyy')}
                </p>
              </div>
              
              <div className="flex h-[620px] flex-col items-start justify-start overflow-hidden overflow-y-scroll rounded-xl border-2 border-border shadow-md bg-card">
                {sortedLeaves.length === 0 ? (
                  <div className="flex items-center justify-center w-full h-full text-muted-foreground">
                    No leave applications found
                  </div>
                ) : (
                  sortedLeaves.map((leave, index) => (
                    <div
                      key={leave.id}
                      className="w-full border-b border-border py-0 last:border-b-0 animate-fade-in"
                      style={{ animationDelay: `${index * 50}ms` }}
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
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Tooltip */}
        <LeaveTooltip
          isVisible={showTooltip}
          position={tooltipPosition}
          leaves={hoveredLeaves}
          date={hoveredDate}
        />
      </div>
    );
  }
);

LeaveCalendar.displayName = 'LeaveCalendar';

export default LeaveCalendar;