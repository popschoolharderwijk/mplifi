import { createClient } from '@supabase/supabase-js';

const EXPECTED_PROJECT_REF = 'zdvscmogkfyddnnxzkdu';
const EXPECTED_SUPABASE_URL = `https://${EXPECTED_PROJECT_REF}.supabase.co`;

const getProjectRefFromUrl = (url: string) => {
	try {
		return new URL(url).hostname.split('.')[0] ?? null;
	} catch {
		return null;
	}
};

const envSupabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const envProjectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;
const projectBasedUrl = envProjectId ? `https://${envProjectId}.supabase.co` : null;

const isExpectedUrl = (url: string) => getProjectRefFromUrl(url) === EXPECTED_PROJECT_REF;

if (envSupabaseUrl && !isExpectedUrl(envSupabaseUrl)) {
	console.warn(
		`Ignoring mismatched VITE_SUPABASE_URL (${envSupabaseUrl}) and using connected project ${EXPECTED_PROJECT_REF}.`,
	);
}

const SUPABASE_URL =
	envSupabaseUrl && isExpectedUrl(envSupabaseUrl)
		? envSupabaseUrl
		: projectBasedUrl && isExpectedUrl(projectBasedUrl)
			? projectBasedUrl
			: EXPECTED_SUPABASE_URL;

const SUPABASE_KEY =
	(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
	(import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY as string | undefined);

if (!SUPABASE_KEY) {
	throw new Error(
		'Missing Supabase publishable key. Ensure VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY is configured.',
	);
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
	auth: {
		autoRefreshToken: true,
		persistSession: true,
		detectSessionInUrl: true,
	},
});
