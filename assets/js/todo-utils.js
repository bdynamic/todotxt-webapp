'use strict';

// LocalStorage Keys
export const SHOW_COMPLETED_KEY = 'todoWebAppShowCompleted';
export const SHOW_FUTURE_THRESHOLD_KEY = 'todoWebAppShowFutureThreshold';

// Helper function to get today's date as YYYY-MM-DD
export function getTodayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper function to format date from DD.MM.YYYY to YYYY-MM-DD (UI to Storage)
export function formatDateForTodoTxt(dateString) {
  if (!dateString) return null;
  const parts = dateString.split('.');
  if (parts.length === 3) {
    // Assuming DD.MM.YYYY
    const [day, month, year] = parts;
    // Ensure two digits for month and day
    const formattedMonth = month.padStart(2, '0');
    const formattedDay = day.padStart(2, '0');
    return `${year}-${formattedMonth}-${formattedDay}`;
  }
  return null; // Return null if format is invalid
}
