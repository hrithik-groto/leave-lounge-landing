import { useState } from 'react';

export const useLeaveApplication = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  const openLeaveDialog = (date?: Date) => {
    if (date) {
      setSelectedDate(date);
      setEndDate(date);
    }
    setIsDialogOpen(true);
  };

  const closeLeaveDialog = () => {
    setIsDialogOpen(false);
    setSelectedDate(undefined);
    setEndDate(undefined);
  };

  return {
    isDialogOpen,
    selectedDate,
    endDate,
    setSelectedDate,
    setEndDate,
    openLeaveDialog,
    closeLeaveDialog,
  };
};