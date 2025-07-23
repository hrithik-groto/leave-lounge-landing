
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLeaveBalance } from '@/hooks/useLeaveBalance';
import { useAdditionalWFHValidation } from '@/hooks/useAdditionalWFHValidation';

const leaveApplicationSchema = z.object({
  leave_type_id: z.string().min(1, 'Please select a leave type'),
  start_date: z.date({
    required_error: 'Start date is required',
  }),
  end_date: z.date({
    required_error: 'End date is required',
  }),
  reason: z.string().min(1, 'Reason is required'),
  is_half_day: z.boolean().default(false),
  hours_requested: z.number().min(0.5).max(8).optional(),
});

type LeaveApplicationFormData = z.infer<typeof leaveApplicationSchema>;

interface LeaveType {
  id: string;
  label: string;
  color: string;
}

interface EnhancedLeaveApplicationFormProps {
  onSuccess?: () => void;
}

export const EnhancedLeaveApplicationForm: React.FC<EnhancedLeaveApplicationFormProps> = ({ onSuccess }) => {
  const { user } = useUser();
  const { toast } = useToast();
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [selectedLeaveType, setSelectedLeaveType] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const { balance, loading: balanceLoading, error: balanceError } = useLeaveBalance(selectedLeaveType, refreshTrigger);
  const { canApply: canApplyAdditionalWFH, wfhRemaining } = useAdditionalWFHValidation(selectedLeaveType);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<LeaveApplicationFormData>({
    resolver: zodResolver(leaveApplicationSchema),
    defaultValues: {
      is_half_day: false,
    },
  });

  const watchedValues = watch();
  const isHalfDay = watchedValues.is_half_day;
  const selectedLeaveTypeData = leaveTypes.find(lt => lt.id === selectedLeaveType);

  useEffect(() => {
    const fetchLeaveTypes = async () => {
      try {
        const { data, error } = await supabase
          .from('leave_types')
          .select('id, label, color')
          .eq('is_active', true);

        if (error) {
          console.error('Error fetching leave types:', error);
          toast({
            title: "Error",
            description: "Failed to load leave types.",
            variant: "destructive",
          });
          return;
        }

        setLeaveTypes(data || []);
      } catch (err) {
        console.error('Error in fetchLeaveTypes:', err);
        toast({
          title: "Error",
          description: "Failed to load leave types.",
          variant: "destructive",
        });
      }
    };

    fetchLeaveTypes();
  }, [toast]);

  const onSubmit = async (data: LeaveApplicationFormData) => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to apply for leave.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('Submitting leave application:', data);

      // Validate Additional WFH availability
      if (selectedLeaveTypeData?.label === 'Additional work from home' && !canApplyAdditionalWFH) {
        toast({
          title: "Cannot Apply",
          description: `You still have ${wfhRemaining} regular Work From Home days remaining this month. Use those first.`,
          variant: "destructive",
        });
        return;
      }

      // Calculate actual days used
      let actualDaysUsed = 1;
      if (data.is_half_day) {
        actualDaysUsed = 0.5;
      } else if (data.start_date && data.end_date) {
        const timeDiff = data.end_date.getTime() - data.start_date.getTime();
        actualDaysUsed = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
      }

      const leaveApplication = {
        user_id: user.id,
        leave_type_id: data.leave_type_id,
        start_date: data.start_date.toISOString().split('T')[0],
        end_date: data.end_date.toISOString().split('T')[0],
        reason: data.reason,
        status: 'pending',
        is_half_day: data.is_half_day,
        hours_requested: data.hours_requested || (selectedLeaveTypeData?.label === 'Short Leave' ? 1 : 0),
        actual_days_used: actualDaysUsed,
        applied_at: new Date().toISOString(),
      };

      console.log('Prepared leave application:', leaveApplication);

      const { error } = await supabase
        .from('leave_applied_users')
        .insert([leaveApplication]);

      if (error) {
        console.error('Supabase error:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to submit leave application.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Leave application submitted successfully!",
        variant: "default",
      });

      reset();
      setSelectedLeaveType('');
      setRefreshTrigger(prev => prev + 1);
      
      if (onSuccess) {
        onSuccess();
      }

    } catch (err) {
      console.error('Error submitting leave application:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to submit leave application.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Apply for Leave</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="leave_type_id">Leave Type</Label>
            <Select
              value={selectedLeaveType}
              onValueChange={(value) => {
                setSelectedLeaveType(value);
                setValue('leave_type_id', value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a leave type" />
              </SelectTrigger>
              <SelectContent>
                {leaveTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: type.color }}
                      />
                      {type.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.leave_type_id && (
              <p className="text-sm text-red-500">{errors.leave_type_id.message}</p>
            )}
          </div>

          {selectedLeaveType && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium mb-2">Leave Balance</h3>
              {balanceLoading && (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading balance...</span>
                </div>
              )}
              {balanceError && (
                <p className="text-sm text-red-500">{balanceError}</p>
              )}
              {balance && (
                <div className="text-sm space-y-1">
                  <p><strong>Monthly Allowance:</strong> {balance.monthly_allowance} {balance.duration_type}</p>
                  <p><strong>Used This Month:</strong> {balance.used_this_month} {balance.duration_type}</p>
                  <p><strong>Remaining:</strong> {balance.remaining_this_month} {balance.duration_type}</p>
                  {balance.carried_forward && balance.carried_forward > 0 && (
                    <p><strong>Carried Forward:</strong> {balance.carried_forward} {balance.duration_type}</p>
                  )}
                  {balance.can_apply === false && (
                    <p className="text-red-500 font-medium">
                      Additional WFH is only available when regular WFH is exhausted. 
                      You have {balance.wfh_remaining} regular WFH days remaining.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !watchedValues.start_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {watchedValues.start_date ? format(watchedValues.start_date, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={watchedValues.start_date}
                    onSelect={(date) => setValue('start_date', date!)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {errors.start_date && (
                <p className="text-sm text-red-500">{errors.start_date.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date">End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !watchedValues.end_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {watchedValues.end_date ? format(watchedValues.end_date, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={watchedValues.end_date}
                    onSelect={(date) => setValue('end_date', date!)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {errors.end_date && (
                <p className="text-sm text-red-500">{errors.end_date.message}</p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_half_day"
              checked={isHalfDay}
              onCheckedChange={(checked) => setValue('is_half_day', checked)}
            />
            <Label htmlFor="is_half_day">Half Day</Label>
          </div>

          {selectedLeaveTypeData?.label === 'Short Leave' && (
            <div className="space-y-2">
              <Label htmlFor="hours_requested">Hours Requested</Label>
              <Input
                id="hours_requested"
                type="number"
                step="0.5"
                min="0.5"
                max="8"
                {...register('hours_requested', { valueAsNumber: true })}
                placeholder="Enter hours (0.5 - 8)"
              />
              {errors.hours_requested && (
                <p className="text-sm text-red-500">{errors.hours_requested.message}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              {...register('reason')}
              placeholder="Enter reason for leave..."
              rows={3}
            />
            {errors.reason && (
              <p className="text-sm text-red-500">{errors.reason.message}</p>
            )}
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isSubmitting || (selectedLeaveTypeData?.label === 'Additional work from home' && !canApplyAdditionalWFH)}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Application'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
