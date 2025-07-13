import { format, parseISO } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

const IST_TIMEZONE = 'Asia/Kolkata';

export const formatToIST = (date: string | Date, formatStr: string = 'MMM dd, yyyy HH:mm') => {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatInTimeZone(dateObj, IST_TIMEZONE, formatStr);
};

export const getCurrentISTTime = () => {
  return toZonedTime(new Date(), IST_TIMEZONE);
};

export const formatISTTime = (formatStr: string = 'yyyy-MM-dd HH:mm:ss') => {
  return formatInTimeZone(new Date(), IST_TIMEZONE, formatStr);
};