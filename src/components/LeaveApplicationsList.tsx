import React, { useState } from 'react';
import { format, differenceInDays } from 'date-fns';
import { ChevronLeft, ChevronRight, X, Clock, Calendar, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface LeaveApplication {
  id: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  applied_at: string;
  user_id: string;
  leave_types?: {
    label: string;
    color: string;
  };
  profiles?: {
    name: string;
  };
  hours_requested?: number;
  leave_duration_type?: string;
}

interface LeaveApplicationsListProps {
  applications: LeaveApplication[];
  onRevert?: (id: string) => void;
  title: string;
  showUserName?: boolean;
  isAdmin?: boolean;
  onApprove?: (id: string, userId: string) => void;
  onReject?: (id: string, userId: string) => void;
  processingApplications?: Set<string>;
}

const ITEMS_PER_PAGE = 5;

const LeaveApplicationsList: React.FC<LeaveApplicationsListProps> = ({
  applications,
  onRevert,
  title,
  showUserName = false,
  isAdmin = false,
  onApprove,
  onReject,
  processingApplications = new Set()
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  
  const totalPages = Math.ceil(applications.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentApplications = applications.slice(startIndex, endIndex);

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDuration = (application: LeaveApplication) => {
    if (application.leave_duration_type === 'hours' && application.hours_requested) {
      return `${application.hours_requested} hour(s)`;
    }
    
    const days = differenceInDays(new Date(application.end_date), new Date(application.start_date)) + 1;
    return `${days} day(s)`;
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>{title}</span>
          </span>
          {applications.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {applications.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 px-6">
          <div className="space-y-4 pb-4">
            {currentApplications.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No leave applications yet</p>
              </div>
            ) : (
              currentApplications.map((application) => (
                <div 
                  key={application.id} 
                  className="border rounded-lg p-4 space-y-3 hover:shadow-md transition-shadow duration-200 bg-white"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        {showUserName && application.profiles?.name && (
                          <div className="flex items-center space-x-1">
                            <User className="h-4 w-4 text-gray-500" />
                            <span className="font-medium text-gray-700">
                              {application.profiles.name}
                            </span>
                          </div>
                        )}
                        {application.leave_types && (
                          <Badge
                            variant="outline"
                            className="text-xs"
                            style={{
                              borderColor: application.leave_types.color,
                              color: application.leave_types.color
                            }}
                          >
                            {application.leave_types.label}
                          </Badge>
                        )}
                      </div>
                      
                      <p className="font-medium text-gray-900">
                        {format(new Date(application.start_date), 'MMM dd')} - {format(new Date(application.end_date), 'MMM dd, yyyy')}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">{application.reason}</p>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      <Badge className={getStatusBadgeColor(application.status)}>
                        {application.status}
                      </Badge>
                      
                      {application.status === 'pending' && onRevert && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onRevert(application.id)}
                          className="p-1 h-6 w-6 hover:bg-red-50 hover:border-red-300"
                          title="Cancel application"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>Applied: {format(new Date(application.applied_at), 'MMM dd, yyyy')}</span>
                    </div>
                    <span className="text-blue-600 font-medium">
                      Duration: {formatDuration(application)}
                    </span>
                  </div>

                  {/* Admin Actions */}
                  {isAdmin && application.status === 'pending' && onApprove && onReject && (
                    <div className="flex space-x-2 pt-2 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onApprove(application.id, application.user_id)}
                        disabled={processingApplications.has(application.id)}
                        className="flex-1 text-green-700 border-green-300 hover:bg-green-50"
                      >
                        {processingApplications.has(application.id) ? 'Processing...' : 'Approve'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onReject(application.id, application.user_id)}
                        disabled={processingApplications.has(application.id)}
                        className="flex-1 text-red-700 border-red-300 hover:bg-red-50"
                      >
                        {processingApplications.has(application.id) ? 'Processing...' : 'Reject'}
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
            <div className="text-sm text-gray-600">
              Showing {startIndex + 1}-{Math.min(endIndex, applications.length)} of {applications.length}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handlePrevPage}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium">
                {currentPage} of {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LeaveApplicationsList;