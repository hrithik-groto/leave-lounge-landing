import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Users } from 'lucide-react';
import LeaveApplicationsList from './LeaveApplicationsList';
import AllUsersOnLeave from './AllUsersOnLeave';

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
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="my-leaves" className="flex items-center gap-2">
          <User className="w-4 h-4" />
          My Leaves
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
      
      <TabsContent value="all-users">
        <AllUsersOnLeave />
      </TabsContent>
    </Tabs>
  );
};

export default TabbedLeaveApplications;