
import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const LeaveApplicationForm = () => {
  const { user } = useUser();
  const { toast } = useToast();
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [formData, setFormData] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
    is_half_day: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchLeaveTypes();
  }, []);

  const fetchLeaveTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_types')
        .select('*')
        .eq('is_active', true)
        .order('label');

      if (error) {
        console.error('Error fetching leave types:', error);
        toast({
          title: "Error",
          description: "Failed to load leave types",
          variant: "destructive"
        });
      } else {
        console.log('Leave types fetched:', data);
        setLeaveTypes(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to apply for leave",
        variant: "destructive"
      });
      return;
    }

    if (!formData.leave_type_id || !formData.start_date || !formData.end_date || !formData.reason.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields including leave type and reason",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Ensure user profile exists
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (profileError && profileError.code === 'PGRST116') {
        // Profile doesn't exist, create it
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.emailAddresses[0]?.emailAddress || '',
            name: user.fullName || user.firstName || 'Unknown User'
          });

        if (insertError) {
          console.error('Error creating profile:', insertError);
          throw insertError;
        }
      }

      // Submit leave application
      const leaveApplication = {
        user_id: user.id,
        leave_type_id: formData.leave_type_id,
        start_date: formData.start_date,
        end_date: formData.end_date,
        reason: formData.reason,
        is_half_day: formData.is_half_day,
        status: 'pending',
        applied_at: new Date().toISOString()
      };

      console.log('Submitting leave application:', leaveApplication);

      const { data, error } = await supabase
        .from('leave_applied_users')
        .insert([leaveApplication])
        .select();

      if (error) {
        console.error('Error submitting leave application:', error);
        throw error;
      }

      console.log('Leave application submitted successfully:', data);

      toast({
        title: "Success! ✅",
        description: "Your leave application has been submitted successfully!"
      });

      // Reset form
      setFormData({
        leave_type_id: '',
        start_date: '',
        end_date: '',
        reason: '',
        is_half_day: false
      });

    } catch (error) {
      console.error('Error submitting leave application:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit leave application. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Card className="hover:shadow-lg transition-shadow duration-300">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Calendar className="w-5 h-5 mr-2 text-blue-600" />
          Apply for Leave
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="leave-type">Leave Type *</Label>
              <Select value={formData.leave_type_id} onValueChange={(value) => handleChange('leave_type_id', value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select leave type..." />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center">
                        <div 
                          className="w-3 h-3 rounded-full mr-2" 
                          style={{ backgroundColor: type.color }}
                        ></div>
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="is-half-day">Half Day Leave</Label>
              <Select 
                value={formData.is_half_day.toString()} 
                onValueChange={(value) => handleChange('is_half_day', value === 'true')}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">Full Day</SelectItem>
                  <SelectItem value="true">Half Day</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start-date">Start Date *</Label>
              <Input
                id="start-date"
                type="date"
                value={formData.start_date}
                onChange={(e) => handleChange('start_date', e.target.value)}
                className="mt-1"
                min={format(new Date(), 'yyyy-MM-dd')}
                required
              />
            </div>

            <div>
              <Label htmlFor="end-date">End Date *</Label>
              <Input
                id="end-date"
                type="date"
                value={formData.end_date}
                onChange={(e) => handleChange('end_date', e.target.value)}
                className="mt-1"
                min={formData.start_date || format(new Date(), 'yyyy-MM-dd')}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="reason">Reason for Leave *</Label>
            <Textarea
              id="reason"
              placeholder="Please provide a reason for your leave application..."
              value={formData.reason}
              onChange={(e) => handleChange('reason', e.target.value)}
              className="mt-1 min-h-[100px]"
              required
            />
          </div>

          <Button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Submit Leave Application
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default LeaveApplicationForm;
