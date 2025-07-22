
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Users, Calendar } from 'lucide-react';
import { useUser } from "@clerk/clerk-react";
import LeaveApplicationsList from './LeaveApplicationsList';
import AllUsersOnLeave from './AllUsersOnLeave';
import { ComprehensiveLeaveBalance } from './ComprehensiveLeaveBalance';

interface TabbedLeaveApplicationsProps {
  applications: any[];
  onRevert: (applicationId: string) => void;
}

const TabbedLeaveApplications: React.FC<TabbedLeaveApplicationsProps> = ({
  applications,
  onRevert
}) => {
  return (
    <Tabs defaultValue="my-leaves" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="my-leaves" className="flex items-center gap-2">
          <User className="w-4 h-4" />
          My Leaves
        </TabsTrigger>
        <TabsTrigger value="leaves-remaining" className="flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Leaves Remaining
        </TabsTrigger>
        <TabsTrigger value="all-users" className="flex items-center gap-2">
          <Users className="w-4 h-4" />
          All Users on Leave
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="my-leaves">
        <LeaveApplicationsList
          applications={applications}
          onRevert={onRevert}
          title="Your Leave Applications"
        />
      </TabsContent>

      <TabsContent value="leaves-remaining">
        <div className="space-y-6 p-6">
          <h2 className="text-2xl font-bold text-gray-900">Leave Balance Overview</h2>
          <ComprehensiveLeaveBalance />
        </div>
      </TabsContent>
      
      <TabsContent value="all-users">
        <AllUsersOnLeave />
      </TabsContent>
    </Tabs>
  );
};

export default TabbedLeaveApplications;
