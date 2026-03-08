import { createContext, useContext } from 'react';
import type { View } from 'react-big-calendar';

const CalendarViewContext = createContext<View | null>(null);

export function useCalendarView(): View | null {
	return useContext(CalendarViewContext);
}

export const CalendarViewProvider = CalendarViewContext.Provider;
