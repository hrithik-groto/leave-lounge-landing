
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const AnnualLeaveInitializer: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(false);

  const initializeAnnualLeaves = async () => {
    setIsInitializing(true);
    
    try {
      // Get all users from profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id');

      if (profilesError) throw profilesError;

      // Get Annual Leave type ID
      const { data: annualLeaveType, error: leaveTypeError } = await supabase
        .from('leave_types')
        .select('id')
        .eq('label', 'Annual Leave')
        .single();

      if (leaveTypeError) throw leaveTypeError;

      const currentYear = new Date().getFullYear();
      
      // Initialize annual leave balances for all users with 18 leaves
      const balances = profiles?.map(profile => ({
        user_id: profile.id,
        leave_type_id: annualLeaveType.id,
        year: currentYear,
        allocated_balance: 18,
        used_balance: 0
      })) || [];

      if (balances.length > 0) {
        const { error: insertError } = await supabase
          .from('user_annual_leave_balances')
          .upsert(balances, { 
            onConflict: 'user_id,leave_type_id,year',
            ignoreDuplicates: false 
          });

        if (insertError) throw insertError;

        toast.success(`Successfully initialized 18 annual leave balances for ${balances.length} users!`);
      } else {
        toast.info('No users found to initialize.');
      }
    } catch (error) {
      console.error('Error initializing annual leaves:', error);
      toast.error('Failed to initialize annual leave balances. Please try again.');
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Initialize Annual Leaves</CardTitle>
        <CardDescription>
          Add 18 annual leaves to all users for the current year
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={initializeAnnualLeaves} 
          disabled={isInitializing}
          className="w-full"
        >
          {isInitializing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Initializing...
            </>
          ) : (
            'Initialize 18 Annual Leaves for All Users'
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default AnnualLeaveInitializer;
