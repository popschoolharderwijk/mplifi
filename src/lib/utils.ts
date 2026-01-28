import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export function isDevelopmentDatabase() {
	return SUPABASE_URL === 'https://zdvscmogkfyddnnxzkdu.supabase.co';
}

export function getDatabaseURL() {
	return SUPABASE_URL;
}
