/**
 * Central breadcrumb configuration per route.
 * Uses NAV_LABELS for all labels (DRY with sidebar etc.).
 * For routes with dynamic segments (e.g. /teachers/:id) only the base items
 * are defined here; the page adds the last item via setBreadcrumbSuffix().
 */

import { NAV_LABELS } from './nav-labels';

export interface BreadcrumbItem {
	label: string;
	href?: string;
}

type PathPattern = string | RegExp;

interface RouteBreadcrumb {
	pattern: PathPattern;
	items: BreadcrumbItem[];
}

/** Order matters: more specific routes first (e.g. /teachers/my-profile before /teachers/:id). */
const ROUTE_BREADCRUMBS: RouteBreadcrumb[] = [
	{ pattern: '/', items: [] },
	{ pattern: '/users', items: [{ label: NAV_LABELS.users, href: '/users' }] },
	{ pattern: '/lesson-types', items: [{ label: NAV_LABELS.lessonTypes, href: '/lesson-types' }] },
	{ pattern: '/settings', items: [{ label: NAV_LABELS.settings, href: '/settings' }] },
	{ pattern: '/teachers', items: [{ label: NAV_LABELS.teachers, href: '/teachers' }] },
	{
		pattern: '/teachers/availability',
		items: [
			{ label: NAV_LABELS.teachers, href: '/teachers' },
			{ label: NAV_LABELS.availability, href: '/teachers/availability' },
		],
	},
	{
		pattern: '/teachers/my-profile',
		items: [
			{ label: NAV_LABELS.teachers, href: '/teachers' },
			{ label: NAV_LABELS.myProfile, href: '/teachers/my-profile' },
		],
	},
	{
		pattern: '/teachers/my-availability',
		items: [
			{ label: NAV_LABELS.teachers, href: '/teachers' },
			{ label: NAV_LABELS.myAvailability, href: '/teachers/my-availability' },
		],
	},
	{
		pattern: '/teachers/my-statistics',
		items: [
			{ label: NAV_LABELS.teachers, href: '/teachers' },
			{ label: NAV_LABELS.myStatistics, href: '/teachers/my-statistics' },
		],
	},
	// /teachers/:id – base only; page adds teacher name via suffix
	{
		pattern: /^\/teachers\/[^/]+$/,
		items: [{ label: NAV_LABELS.teachers, href: '/teachers' }],
	},
	{ pattern: '/students', items: [{ label: NAV_LABELS.students, href: '/students' }] },
	{
		pattern: '/students/my-students',
		items: [
			{ label: NAV_LABELS.students, href: '/students' },
			{ label: NAV_LABELS.myStudents, href: '/students/my-students' },
		],
	},
	{
		pattern: '/students/my-profile',
		items: [
			{ label: NAV_LABELS.students, href: '/students' },
			{ label: NAV_LABELS.myProfile, href: '/students/my-profile' },
		],
	},
];

function matchesPattern(pathname: string, pattern: PathPattern): boolean {
	if (typeof pattern === 'string') {
		return pathname === pattern;
	}
	return pattern.test(pathname);
}

/**
 * Returns the base breadcrumb items for the given path.
 * For routes with a dynamic title (e.g. teacher name) the page adds
 * extra items via useBreadcrumb().setBreadcrumbSuffix().
 */
export function getBaseBreadcrumb(pathname: string): BreadcrumbItem[] {
	for (const { pattern, items } of ROUTE_BREADCRUMBS) {
		if (matchesPattern(pathname, pattern)) {
			return [...items];
		}
	}
	return [];
}
