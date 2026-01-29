/**
 * Shared CORS headers for all Edge Functions.
 * Based on Supabase's recommended CORS setup for browser invocations.
 * @see https://supabase.com/docs/guides/functions/cors
 */
export const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
