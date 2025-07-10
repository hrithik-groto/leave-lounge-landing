import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, User, Tag, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { LeaveInfo } from './leave-calendar';

interface LeaveTooltipProps {
  isVisible: boolean;
  position: { x: number; y: number };
  leaves: LeaveInfo[];
  date: Date | null;
}

const LeaveTooltip: React.FC<LeaveTooltipProps> = ({ 
  isVisible, 
  position, 
  leaves, 
  date 
}) => {
  if (!isVisible || !date || leaves.length === 0) return null;

  const approvedLeaves = leaves.filter(leave => leave.status === 'approved');
  const pendingLeaves = leaves.filter(leave => leave.status === 'pending');

  const getLeaveTypeColor = (leaveType: string) => {
    switch (leaveType.toLowerCase()) {
      case 'sick leave':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'annual leave':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'personal leave':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'paid leave':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'work from home':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 10 }}
        transition={{ duration: 0.2 }}
        className="fixed z-50 bg-white border border-border rounded-lg shadow-lg p-4 max-w-sm w-80"
        style={{
          left: position.x,
          top: position.y - 10,
          transform: 'translateX(-50%)'
        }}
      >
        <div className="space-y-3">
          <div className="flex items-center space-x-2 text-sm font-medium text-foreground border-b pb-2">
            <Calendar className="w-4 h-4" />
            <span>{format(date, 'EEEE, MMMM d, yyyy')}</span>
          </div>

          {approvedLeaves.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-green-700 mb-2 flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                Approved Leaves ({approvedLeaves.length})
              </h4>
              <div className="space-y-2">
                {approvedLeaves.map((leave, index) => (
                  <motion.div
                    key={`approved-${leave.id}-${index}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-green-50 border border-green-200 rounded-md p-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2 min-w-0 flex-1">
                        <User className="w-3 h-3 text-green-600 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-green-800 truncate">
                            {leave.user_name}
                          </p>
                          <p className="text-xs text-green-600 truncate">
                            {leave.user_email}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end space-y-1 flex-shrink-0">
                        <span className={`text-xs px-2 py-1 rounded-full border ${getLeaveTypeColor(leave.leave_type)}`}>
                          {leave.leave_type}
                        </span>
                        {leave.is_half_day && (
                          <span className="text-xs text-green-600 flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {leave.leave_time_start && leave.leave_time_end
                              ? `${leave.leave_time_start} - ${leave.leave_time_end}`
                              : 'Half Day'
                            }
                          </span>
                        )}
                      </div>
                    </div>
                    {leave.reason && (
                      <div className="mt-2 flex items-start space-x-1">
                        <FileText className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-green-700 italic">
                          {leave.reason}
                        </p>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {pendingLeaves.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-orange-700 mb-2 flex items-center">
                <div className="w-2 h-2 bg-orange-500 rounded-full mr-2" />
                Pending Approval ({pendingLeaves.length})
              </h4>
              <div className="space-y-2">
                {pendingLeaves.map((leave, index) => (
                  <motion.div
                    key={`pending-${leave.id}-${index}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-orange-50 border border-orange-200 rounded-md p-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2 min-w-0 flex-1">
                        <User className="w-3 h-3 text-orange-600 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-orange-800 truncate">
                            {leave.user_name}
                          </p>
                          <p className="text-xs text-orange-600 truncate">
                            {leave.user_email}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end space-y-1 flex-shrink-0">
                        <span className={`text-xs px-2 py-1 rounded-full border ${getLeaveTypeColor(leave.leave_type)}`}>
                          {leave.leave_type}
                        </span>
                        {leave.is_half_day && (
                          <span className="text-xs text-orange-600 flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {leave.leave_time_start && leave.leave_time_end
                              ? `${leave.leave_time_start} - ${leave.leave_time_end}`
                              : 'Half Day'
                            }
                          </span>
                        )}
                      </div>
                    </div>
                    {leave.reason && (
                      <div className="mt-2 flex items-start space-x-1">
                        <FileText className="w-3 h-3 text-orange-600 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-orange-700 italic">
                          {leave.reason}
                        </p>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-muted-foreground text-center pt-2 border-t">
            {approvedLeaves.length + pendingLeaves.length} user{approvedLeaves.length + pendingLeaves.length !== 1 ? 's' : ''} on leave
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default LeaveTooltip;