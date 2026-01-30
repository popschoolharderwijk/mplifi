// Edge Function to create user accounts
// Only admins and site_admins can create users
// Admins cannot assign site_admin roles
// Site_admins can assign any role

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface CreateUserRequest {
	email: string;
	first_name?: string;
	last_name?: string;
	role?: 'site_admin' | 'admin' | 'staff' | 'teacher';
}

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

		// Parse request body first
		const body: CreateUserRequest = await req.json();

		if (!body.email) {
			return new Response(JSON.stringify({ error: 'Email is verplicht' }), {
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		// Create authenticated client FIRST to check authorization via RLS
		// This ensures we verify permissions before doing anything else
		const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
		const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
		const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
			global: {
				headers: {
					Authorization: authHeader,
				},
			},
			auth: {
				autoRefreshToken: false,
				persistSession: false,
			},
		});

		// Get requesting user from JWT using authenticated client
		const {
			data: { user: requestingUser },
			error: userError,
		} = await supabaseUser.auth.getUser();

		if (userError || !requestingUser) {
			return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
				status: 401,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		// Check if user has permission to create users by trying to view their role
		// RLS will only allow admins and site_admins to view roles
		// This acts as an authorization check BEFORE we do anything else
		const { data: rolesCheck, error: rolesCheckError } = await supabaseUser
			.from('user_roles')
			.select('role')
			.eq('user_id', requestingUser.id)
			.single();

		// If user can't view their own role or doesn't have admin/site_admin role, deny access
		if (rolesCheckError || !rolesCheck) {
			return new Response(JSON.stringify({ error: 'Je hebt geen rechten om gebruikers aan te maken.' }), {
				status: 403,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		const requesterRole = rolesCheck.role;
		if (requesterRole !== 'admin' && requesterRole !== 'site_admin') {
			return new Response(JSON.stringify({ error: 'Je hebt geen rechten om gebruikers aan te maken.' }), {
				status: 403,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		// Only NOW create admin client for user creation (after authorization is verified)
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

		// Create user via Admin API
		// The handle_new_user trigger will automatically create the profile
		const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
			email: body.email,
			email_confirm: true, // Auto-confirm email
			user_metadata: {
				first_name: body.first_name || null,
				last_name: body.last_name || null,
			},
		});

		if (createError) {
			return new Response(JSON.stringify({ error: createError.message }), {
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		if (!newUser.user) {
			return new Response(JSON.stringify({ error: 'Gebruiker kon niet worden aangemaakt' }), {
				status: 500,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		// Assign role if provided
		// Use authenticated client so RLS policies enforce permissions
		// RLS will automatically block admins from assigning site_admin roles
		if (body.role) {
			const { error: roleInsertError } = await supabaseUser.from('user_roles').insert({
				user_id: newUser.user.id,
				role: body.role,
			});

			if (roleInsertError) {
				// If role assignment fails, we should still return success for user creation
				// but log the error. The user can be created without a role.
				console.error('Error assigning role:', roleInsertError);
				// Don't fail the request, but return a warning
				return new Response(
					JSON.stringify({
						message: 'Gebruiker aangemaakt, maar rol kon niet worden toegewezen.',
						user_id: newUser.user.id,
						warning: roleInsertError.message,
					}),
					{
						status: 200,
						headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					},
				);
			}
		}

		return new Response(
			JSON.stringify({
				message: 'Gebruiker succesvol aangemaakt',
				user_id: newUser.user.id,
				email: newUser.user.email,
			}),
			{
				status: 200,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			},
		);
	} catch (error) {
		console.error('Error in create-user:', error);
		return new Response(JSON.stringify({ error: 'Internal server error' }), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}
});
