
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Users, Settings } from 'lucide-react';
import { useUser } from "@clerk/clerk-react";
import LeaveApplicationsList from './LeaveApplicationsList';
import AllUsersOnLeave from './AllUsersOnLeave';
import AnnualLeaveInitializer from './AnnualLeaveInitializer';

interface TabbedLeaveApplicationsProps {
  applications: any[];
  onRevert: (applicationId: string) => void;
}

const TabbedLeaveApplications: React.FC<TabbedLeaveApplicationsProps> = ({
  applications,
  onRevert
}) => {
  const { user } = useUser();
  const isAdmin = user?.id === 'user_2xwywE2Bl76vs7l68dhj6nIcCPV';

  return (
    <Tabs defaultValue="my-leaves" className="w-full">
      <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <TabsTrigger value="my-leaves" className="flex items-center gap-2">
          <User className="w-4 h-4" />
          My Leaves
        </TabsTrigger>
        <TabsTrigger value="all-users" className="flex items-center gap-2">
          <Users className="w-4 h-4" />
          All Users on Leave
        </TabsTrigger>
        {isAdmin && (
          <TabsTrigger value="admin-settings" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Admin Settings
          </TabsTrigger>
        )}
      </TabsList>
      
      <TabsContent value="my-leaves">
        <LeaveApplicationsList
          applications={applications}
          onRevert={onRevert}
          title="Your Leave Applications"
        />
      </TabsContent>
      
      <TabsContent value="all-users">
        <AllUsersOnLeave />
      </TabsContent>
      
      {isAdmin && (
        <TabsContent value="admin-settings">
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Administrative Settings</h3>
            <AnnualLeaveInitializer />
          </div>
        </TabsContent>
      )}
    </Tabs>
  );
};

export default TabbedLeaveApplications;
