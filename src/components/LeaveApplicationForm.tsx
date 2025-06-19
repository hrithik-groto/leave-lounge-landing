
import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Send, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      initializeComponent();
    }
  }, [user]);

  const initializeComponent = async () => {
    try {
      await ensureUserProfile();
      await fetchLeaveTypes();
    } catch (error) {
      console.error('Initialization error:', error);
      toast({
        title: "Initialization Error",
        description: "Failed to load component data. Please refresh the page.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const ensureUserProfile = async () => {
    if (!user) return;

    try {
      console.log('Ensuring user profile exists for:', user.id);
      
      // Check if profile exists
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error checking profile:', fetchError);
        throw fetchError;
      }

      if (!existingProfile) {
        console.log('Creating new profile for user:', user.id);
        
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

        console.log('Profile created successfully');
      } else {
        console.log('Profile already exists');
      }
    } catch (error) {
      console.error('Profile creation error:', error);
      throw error;
    }
  };

  const fetchLeaveTypes = async () => {
    try {
      console.log('Fetching leave types...');
      
      const { data, error } = await supabase
        .from('leave_types')
        .select('*')
        .eq('is_active', true)
        .order('label');

      if (error) {
        console.error('Error fetching leave types:', error);
        throw error;
      }

      console.log('Leave types fetched:', data);
      setLeaveTypes(data || []);

      if (!data || data.length === 0) {
        toast({
          title: "No Leave Types",
          description: "No leave types are available. Please contact your administrator.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Fetch leave types error:', error);
      toast({
        title: "Error",
        description: "Failed to load leave types. Please try again.",
        variant: "destructive"
      });
    }
  };

  const validateForm = () => {
    if (!formData.leave_type_id) {
      toast({
        title: "Validation Error",
        description: "Please select a leave type.",
        variant: "destructive"
      });
      return false;
    }

    if (!formData.start_date) {
      toast({
        title: "Validation Error",
        description: "Please select a start date.",
        variant: "destructive"
      });
      return false;
    }

    if (!formData.end_date) {
      toast({
        title: "Validation Error",
        description: "Please select an end date.",
        variant: "destructive"
      });
      return false;
    }

    if (new Date(formData.start_date) > new Date(formData.end_date)) {
      toast({
        title: "Validation Error",
        description: "End date must be after or equal to start date.",
        variant: "destructive"
      });
      return false;
    }

    if (!formData.reason.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide a reason for your leave application.",
        variant: "destructive"
      });
      return false;
    }

    if (formData.reason.trim().length < 10) {
      toast({
        title: "Validation Error",
        description: "Please provide a more detailed reason (at least 10 characters).",
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to apply for leave.",
        variant: "destructive"
      });
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('Submitting leave application...');
      console.log('Form data:', formData);
      console.log('User ID:', user.id);

      // Double-check that user profile exists before submitting
      await ensureUserProfile();

      const leaveApplication = {
        user_id: user.id,
        leave_type_id: formData.leave_type_id,
        start_date: formData.start_date,
        end_date: formData.end_date,
        reason: formData.reason.trim(),
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
        description: "Your leave application has been submitted successfully and is pending approval."
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
      
      let errorMessage = "Failed to submit leave application. Please try again.";
      
      if (error.message?.includes('violates foreign key constraint')) {
        errorMessage = "There was an issue with your user profile. Please contact support.";
      } else if (error.message?.includes('violates row-level security')) {
        errorMessage = "You don't have permission to submit leave applications. Please contact your administrator.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Submission Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field, value) => {
    console.log(`Updating ${field} to:`, value);
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (isLoading) {
    return (
      <Card className="hover:shadow-lg transition-shadow duration-300">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card className="hover:shadow-lg transition-shadow duration-300">
        <CardContent className="p-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please sign in to apply for leave.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (leaveTypes.length === 0) {
    return (
      <Card className="hover:shadow-lg transition-shadow duration-300">
        <CardContent className="p-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No leave types are available. Please contact your administrator.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

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
              <Select 
                value={formData.leave_type_id} 
                onValueChange={(value) => handleChange('leave_type_id', value)}
              >
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
              <Label htmlFor="is-half-day">Leave Duration</Label>
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
              placeholder="Please provide a detailed reason for your leave application (minimum 10 characters)..."
              value={formData.reason}
              onChange={(e) => handleChange('reason', e.target.value)}
              className="mt-1 min-h-[100px]"
              required
              minLength={10}
            />
            <div className="text-xs text-gray-500 mt-1">
              {formData.reason.length}/10 minimum characters
            </div>
          </div>

          <Button 
            type="submit" 
            disabled={isSubmitting || leaveTypes.length === 0}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Submitting Application...
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
