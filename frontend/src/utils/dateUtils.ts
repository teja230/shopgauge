/**
 * Date Utility Functions
 * 
 * Shared date formatting and manipulation utilities across the application.
 * Provides consistent date handling with proper error recovery.
 */

import { format } from 'date-fns';

/**
 * Format a date string with enhanced error handling and null safety
 * 
 * @param dateString - The date string to format (can be null/undefined)
 * @param formatPattern - The date-fns format pattern (default: 'MMM d, yyyy')
 * @param fallback - The fallback value for invalid dates (default: '--')
 * @returns Formatted date string or fallback value
 */
export const formatDate = (
  dateString: string | null | undefined, 
  formatPattern: string = 'MMM d, yyyy',
  fallback: string = '--'
): string => {
  try {
    if (!dateString) {
      return fallback;
    }
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      console.warn('Invalid date string:', dateString);
      return fallback;
    }
    
    return format(date, formatPattern);
  } catch (error) {
    console.warn('Error formatting date:', dateString, error);
    return fallback;
  }
};

/**
 * Format a date for display with time
 * 
 * @param dateString - The date string to format
 * @returns Formatted date and time string
 */
export const formatDateTime = (dateString: string | null | undefined): string => {
  return formatDate(dateString, 'MMM d, yyyy h:mm a', '--');
};

/**
 * Format a date for short display
 * 
 * @param dateString - The date string to format
 * @returns Short formatted date string
 */
export const formatDateShort = (dateString: string | null | undefined): string => {
  return formatDate(dateString, 'MMM d', '--');
};

/**
 * Check if a date string is valid
 * 
 * @param dateString - The date string to validate
 * @returns True if the date is valid, false otherwise
 */
export const isValidDate = (dateString: string | null | undefined): boolean => {
  if (!dateString) return false;
  
  try {
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  } catch {
    return false;
  }
};

/**
 * Get relative time string (e.g., "2 hours ago", "yesterday")
 * 
 * @param dateString - The date string to compare
 * @returns Relative time string
 */
export const getRelativeTime = (dateString: string | null | undefined): string => {
  if (!isValidDate(dateString)) {
    return '--';
  }
  
  try {
    const date = new Date(dateString!);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return formatDate(dateString);
  } catch (error) {
    console.warn('Error calculating relative time:', dateString, error);
    return '--';
  }
};
