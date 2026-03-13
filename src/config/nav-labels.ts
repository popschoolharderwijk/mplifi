import type { IconType } from 'react-icons';
import {
	LuBookOpen,
	LuCalendar,
	LuChartBar,
	LuClipboardList,
	LuFolderOpen,
	LuGraduationCap,
	LuLayoutDashboard,
	LuMusic2,
	LuSettings,
	LuUser,
	LuUserCog,
	LuUsers,
} from 'react-icons/lu';

/**
 * Central source for navigation labels (sidebar, breadcrumbs, page titles, command palette).
 * Use these constants everywhere to stay DRY and avoid typos like "Lestypen" vs "Lessoorten".
 */
export const NAV_LABELS = {
	agenda: 'Agenda',
	dashboard: 'Dashboard',
	users: 'Gebruikers',
	lessonTypes: 'Lessoorten',
	projects: 'Projecten',
	settings: 'Instellingen',
	teachers: 'Docenten',
	availability: 'Beschikbaarheid',
	myProfile: 'Mijn profiel',
	myAvailability: 'Mijn beschikbaarheid',
	myStatistics: 'Mijn statistieken',
	students: 'Leerlingen',
	myStudents: 'Mijn leerlingen',
	agreements: 'Overeenkomsten',
	reports: 'Rapportage',
	manual: 'Handleiding',
} as const;

export type NavLabelKey = keyof typeof NAV_LABELS;

/**
 * Icon per nav item (sidebar, PageHeader, etc.). Single source of truth for nav icons.
 */
export const NAV_ICONS: Record<NavLabelKey, IconType> = {
	agenda: LuCalendar,
	dashboard: LuLayoutDashboard,
	users: LuUserCog,
	lessonTypes: LuMusic2,
	projects: LuFolderOpen,
	settings: LuSettings,
	teachers: LuGraduationCap,
	availability: LuCalendar,
	myProfile: LuUser,
	myAvailability: LuCalendar,
	myStatistics: LuChartBar,
	students: LuUsers,
	myStudents: LuUsers,
	agreements: LuClipboardList,
	reports: LuChartBar,
	manual: LuBookOpen,
};
