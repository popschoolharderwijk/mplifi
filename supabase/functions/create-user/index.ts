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
	phone_number?: string;
	role?: 'site_admin' | 'admin' | 'staff' | 'teacher';
}

Deno.serve(async (req) => {
	// Handle CORS preflight
	if (req.method === 'OPTIONS') {
		return new Response(null, { status: 204, headers: corsHeaders });
	}

	try {
		// Get authorization header
		const authHeader = req.headers.get('Authorization');
		if (!authHeader) {
			return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
				status: 401,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		// Parse request body
		const body: CreateUserRequest = await req.json();

		if (!body.email) {
			return new Response(JSON.stringify({ error: 'Email is verplicht' }), {
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		// Validate email format
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(body.email)) {
			return new Response(JSON.stringify({ error: 'Ongeldig e-mailadres' }), {
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		// Authenticated client for RLS-based checks
		const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
		const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
		const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
			global: { headers: { Authorization: authHeader } },
			auth: { autoRefreshToken: false, persistSession: false },
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

		// Check requester's role via RLS
		const { data: rolesCheck, error: rolesCheckError } = await supabaseUser
			.from('user_roles')
			.select('role')
			.eq('user_id', requestingUser.id)
			.single();

		if (rolesCheckError || !rolesCheck?.role) {
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

		// Defense-in-depth: prevent admins from assigning site_admin
		if (requesterRole === 'admin' && body.role === 'site_admin') {
			return new Response(JSON.stringify({ error: 'Admins kunnen geen site_admin rollen toewijzen' }), {
				status: 403,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		// Admin client to create user
		const supabaseAdmin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
			auth: { autoRefreshToken: false, persistSession: false },
		});

		// Create user
		const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
			email: body.email,
			email_confirm: true,
			user_metadata: {
				first_name: body.first_name ?? null,
				last_name: body.last_name ?? null,
			},
		});

		if (createError) {
			// Friendly message for duplicate users
			if (createError.message.includes('already') || createError.message.includes('duplicate')) {
				return new Response(JSON.stringify({ error: 'Een gebruiker met dit e-mailadres bestaat al.' }), {
					status: 409,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				});
			}
			return new Response(JSON.stringify({ error: createError.message }), {
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		const createdUser = newUser.user;
		if (!createdUser) {
			return new Response(JSON.stringify({ error: 'Gebruiker kon niet worden aangemaakt' }), {
				status: 500,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		// Update profile with phone_number if provided
		// The profile is created by handle_new_user trigger, so we update it here
		if (body.phone_number) {
			const { error: profileUpdateError } = await supabaseAdmin
				.from('profiles')
				.update({ phone_number: body.phone_number })
				.eq('user_id', createdUser.id);

			if (profileUpdateError) {
				console.error('Error updating phone_number:', profileUpdateError);
				// Don't fail the request, just log the error
			}
		}

		// Assign role if provided
		if (body.role) {
			const { error: roleInsertError } = await supabaseUser.from('user_roles').insert({
				user_id: createdUser.id,
				role: body.role,
			});

			if (roleInsertError) {
				console.error('Error assigning role:', roleInsertError);
				return new Response(
					JSON.stringify({
						message: 'Gebruiker aangemaakt, maar rol kon niet worden toegewezen.',
						user_id: createdUser.id,
						warning: roleInsertError.message,
					}),
					{ status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
				);
			}
		}

		return new Response(
			JSON.stringify({
				message: 'Gebruiker succesvol aangemaakt',
				user_id: createdUser.id,
				email: createdUser.email,
			}),
			{ status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
		);
	} catch (error) {
		console.error('Error in create-user:', error);
		return new Response(JSON.stringify({ error: 'Internal server error' }), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}
});
