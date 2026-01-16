const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export function isDevelopmentDatabase() {
	return SUPABASE_URL === 'https://zdvscmogkfyddnnxzkdu.supabase.co';
}

export function getDatabaseURL() {
	return SUPABASE_URL;
}
