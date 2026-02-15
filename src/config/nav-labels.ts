/**
 * Central source for navigation labels (sidebar, breadcrumbs, page titles, command palette).
 * Use these constants everywhere to stay DRY and avoid typos like "Lestypen" vs "Lessoorten".
 */
export const NAV_LABELS = {
	dashboard: 'Dashboard',
	users: 'Gebruikers',
	lessonTypes: 'Lessoorten',
	settings: 'Instellingen',
	teachers: 'Docenten',
	availability: 'Beschikbaarheid',
	myProfile: 'Mijn profiel',
	myAvailability: 'Mijn beschikbaarheid',
	myStatistics: 'Mijn statistieken',
	students: 'Leerlingen',
	myStudents: 'Mijn leerlingen',
} as const;

export type NavLabelKey = keyof typeof NAV_LABELS;
