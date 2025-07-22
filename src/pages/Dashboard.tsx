import React, { useState, useEffect, useRef } from 'react';
import { useUser } from "@clerk/clerk-react";
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, differenceInDays, isWeekend, addDays } from "date-fns";
import { Calendar, Clock, Users, Search, Plus, AlertCircle, User, LogOut } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/components/ui/use-toast";
import { EnhancedLeaveApplicationForm } from '@/components/EnhancedLeaveApplicationForm';
import { LeaveBalanceDisplay } from '@/components/LeaveBalanceDisplay';
import TabbedLeaveApplications from '@/components/TabbedLeaveApplications';
import SlackOAuthButton from '@/components/SlackOAuthButton';
import TimelooMascot from '@/components/TimelooMascot';
import { ComprehensiveLeaveBalance } from '@/components/ComprehensiveLeaveBalance';

import confetti from 'canvas-confetti';

const Dashboard: React.FC = () => {
  const { user, isLoaded } = useUser();
  const [leaveApplications, setLeaveApplications] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isApplyDialogOpen, setIsApplyDialogOpen] = useState(false);
  const [shouldMascotWave, setShouldMascotWave] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { toast } = useToast();
  const navigate = useNavigate();
  const calendarRef = useRef<{ openApplyDialog: () => void } | null>(null);

  const [leaveBalance, setLeaveBalance] = useState<{ [key: string]: number }>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredApplications, setFilteredApplications] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && isLoaded) {
      fetchLeaveApplications();
      fetchLeaveTypes();
      calculateLeaveBalance();
      setShouldMascotWave(true);
    }
  }, [user, isLoaded]);

  useEffect(() => {
    if (searchQuery) {
      const filtered = leaveApplications.filter(app =>
        app.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.status.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredApplications(filtered);
    } else {
      setFilteredApplications(leaveApplications);
    }
  }, [searchQuery, leaveApplications]);

  const fetchLeaveApplications = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('leave_applied_users')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date', { ascending: false });

      if (error) {
        console.error('Error fetching leave applications:', error);
        setError(error.message);
      } else {
        setLeaveApplications(data || []);
        setError(null);
      }
    } catch (err) {
      console.error('Unexpected error fetching leave applications:', err);
      setError('Failed to fetch leave applications');
    }
  };

  const fetchLeaveTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_types')
        .select('*');

      if (error) {
        console.error('Error fetching leave types:', error);
        setError(error.message);
      } else {
        setLeaveTypes(data || []);
        setError(null);
      }
    } catch (err) {
      console.error('Unexpected error fetching leave types:', err);
      setError('Failed to fetch leave types');
    }
  };

  const calculateLeaveBalance = async () => {
    if (!user?.id) return;

    try {
      const balance: { [key: string]: number } = {};
      for (const type of leaveTypes) {
        // Placeholder logic - replace with actual calculation
        balance[type.id] = 10;
      }
      setLeaveBalance(balance);
    } catch (err) {
      console.error('Error calculating leave balance:', err);
      setError('Failed to calculate leave balance');
    }
  };

  const handleApplyLeave = () => {
    setIsApplyDialogOpen(true);
  };

  const handleCloseApplyDialog = () => {
    setIsApplyDialogOpen(false);
  };

  const handleLeaveApplied = () => {
    fetchLeaveApplications();
    calculateLeaveBalance();
    setIsApplyDialogOpen(false);
    setRefreshTrigger(prev => prev + 1);

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  const handleRevertLeave = async (applicationId: string) => {
    if (!user?.id) return;

    try {
      console.log('Reverting leave application:', applicationId);

      const { error } = await supabase
        .from('leave_applied_users')
        .update({ status: 'pending' })
        .eq('id', applicationId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error reverting leave:', error);
        toast({
          title: "Error",
          description: "Failed to revert leave application",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Leave application reverted to pending successfully",
      });

      fetchLeaveApplications();
    } catch (error) {
      console.error('Error reverting leave:', error);
      toast({
        title: "Error",
        description: "Failed to revert leave application",
        variant: "destructive",
      });
    }
  };

  const handleCancelLeave = async (applicationId: string) => {
    if (!user?.id) return;

    try {
      console.log('Cancelling leave application:', applicationId);
      
      // Delete the leave application
      const { error } = await supabase
        .from('leave_applied_users')
        .delete()
        .eq('id', applicationId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error cancelling leave:', error);
        toast({
          title: "Error",
          description: "Failed to cancel leave application",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Leave application cancelled successfully",
      });

      // Refresh the data to reflect the cancellation
      fetchLeaveApplications();
      calculateLeaveBalance();
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error cancelling leave:', error);
      toast({
        title: "Error",
        description: "Failed to cancel leave application",
        variant: "destructive",
      });
    }
  };

  const handleLogout = () => {
    navigate('/sign-in');
  };

  const renderDashboard = () => (
    <div className="space-y-6 px-4 sm:px-0">
      <div className="flex justify-between items-center">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Welcome to Timeloo, {user?.firstName}!</h2>
        <Button variant="outline" size="sm" onClick={handleLogout} className="flex items-center gap-2">
          <LogOut className="w-4 h-4" />
          Log Out
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {leaveTypes.map(type => (
          <LeaveBalanceDisplay
            key={type.id}
            leaveTypeId={type.id}
            leaveTypeName={type.label}
            refreshTrigger={refreshTrigger}
          />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Apply for Leave</CardTitle>
        </CardHeader>
        <CardContent>
          <EnhancedLeaveApplicationForm
            leaveTypes={leaveTypes}
            onLeaveApplied={handleLeaveApplied}
            onCancel={handleCloseApplyDialog}
          />
        </CardContent>
      </Card>
    </div>
  );

  const renderApplications = () => (
    <div className="space-y-6 px-4 sm:px-0">
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Your Leave Applications</h2>
        <div className="flex items-center space-x-2">
          <Input
            type="text"
            placeholder="Search applications..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="max-w-xs"
          />
          <Button onClick={handleApplyLeave} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Apply Leave
          </Button>
        </div>
      </div>

      <TabbedLeaveApplications
        applications={filteredApplications}
        onRevert={handleRevertLeave}
      />
    </div>
  );

  const renderLeavesRemaining = () => (
    <div className="space-y-6 px-4 sm:px-0">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Leave Balance Overview</h2>
      <ComprehensiveLeaveBalance refreshTrigger={refreshTrigger} />
    </div>
  );

  return (
    <div className="container py-8">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      )}

      {currentPage === 'dashboard' && renderDashboard()}
      {currentPage === 'applications' && renderApplications()}
      {currentPage === 'leaves-remaining' && renderLeavesRemaining()}

      {isApplyDialogOpen && (
        <EnhancedLeaveApplicationForm
          open={isApplyDialogOpen}
          leaveTypes={leaveTypes}
          onLeaveApplied={handleLeaveApplied}
          onCancel={handleCloseApplyDialog}
        />
      )}
    </div>
  );
};

export default Dashboard;
