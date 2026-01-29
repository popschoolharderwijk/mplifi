// Edge Function to delete user accounts
// Supports two modes:
// 1. Self-deletion: User deletes their own account (no userId in body)
// 2. Admin deletion: Admin/site_admin deletes another user's account (userId in body)
//
// Uses admin API to delete from auth.users, which CASCADE deletes profile and roles
// The database trigger `protect_last_site_admin` prevents deleting the last site_admin

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
	// Handle CORS preflight
	if (req.method === 'OPTIONS') {
		return new Response(null, { status: 204, headers: corsHeaders });
	}

	try {
		// Get the authorization header
		const authHeader = req.headers.get('Authorization');
		if (!authHeader) {
			return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
				status: 401,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		// Create admin client with service role key
		const supabaseAdmin = createClient(
			Deno.env.get('SUPABASE_URL') ?? '',
			Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
			{
				auth: {
					autoRefreshToken: false,
					persistSession: false,
				},
			},
		);

		// Get requesting user from JWT
		const token = authHeader.replace('Bearer ', '');
		const {
			data: { user: requestingUser },
			error: userError,
		} = await supabaseAdmin.auth.getUser(token);

		if (userError || !requestingUser) {
			return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
				status: 401,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		// Parse request body to check if a specific userId is provided
		let targetUserId = requestingUser.id; // Default: delete self
		let body: { userId?: string } = {};

		try {
			const text = await req.text();
			if (text) {
				body = JSON.parse(text);
			}
		} catch {
			// Empty body is fine - means self-deletion
		}

		// If userId is provided, check if requester has permission to delete others
		if (body.userId && body.userId !== requestingUser.id) {
			// Check if requesting user is admin or site_admin
			const { data: roleData, error: roleError } = await supabaseAdmin
				.from('user_roles')
				.select('role')
				.eq('user_id', requestingUser.id)
				.single();

			if (roleError || !roleData) {
				return new Response(JSON.stringify({ error: 'Could not verify permissions' }), {
					status: 403,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				});
			}

			const allowedRoles = ['admin', 'site_admin'];
			if (!allowedRoles.includes(roleData.role)) {
				return new Response(
					JSON.stringify({ error: 'Je hebt geen rechten om andere accounts te verwijderen.' }),
					{
						status: 403,
						headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					},
				);
			}

			targetUserId = body.userId;
		}

		// Delete the target user (CASCADE will remove profile, user_roles, etc.)
		// The database trigger `protect_last_site_admin` will block if this is the last site_admin
		const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);

		if (deleteError) {
			// Check if it's the "last site_admin" error from our trigger
			const errorMessage = deleteError.message || 'Failed to delete account';

			// The trigger raises: "Cannot remove the last site_admin. Promote another user to site_admin first."
			if (errorMessage.includes('last site_admin')) {
				return new Response(
					JSON.stringify({
						error: 'Dit is de laatste site administrator. Maak eerst een andere gebruiker site_admin voordat dit account verwijderd kan worden.',
						code: 'last_site_admin',
					}),
					{
						status: 400,
						headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					},
				);
			}

			return new Response(JSON.stringify({ error: errorMessage }), {
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		return new Response(JSON.stringify({ message: 'Account successfully deleted' }), {
			status: 200,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	} catch (error) {
		console.error('Error in delete-account:', error);
		return new Response(JSON.stringify({ error: 'Internal server error' }), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}
});
