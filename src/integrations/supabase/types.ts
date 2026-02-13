export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
	// Allows to automatically instantiate createClient with right options
	// instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
	__InternalSupabase: {
		PostgrestVersion: '14.1';
	};
	graphql_public: {
		Tables: {
			[_ in never]: never;
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			graphql: {
				Args: {
					extensions?: Json;
					operationName?: string;
					query?: string;
					variables?: Json;
				};
				Returns: Json;
			};
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
	public: {
		Tables: {
			lesson_agreements: {
				Row: {
					created_at: string;
					day_of_week: number;
					end_date: string | null;
					id: string;
					is_active: boolean;
					lesson_type_id: string;
					notes: string | null;
					start_date: string;
					start_time: string;
					student_user_id: string;
					teacher_id: string;
					updated_at: string;
				};
				Insert: {
					created_at?: string;
					day_of_week: number;
					end_date?: string | null;
					id?: string;
					is_active?: boolean;
					lesson_type_id: string;
					notes?: string | null;
					start_date: string;
					start_time: string;
					student_user_id: string;
					teacher_id: string;
					updated_at?: string;
				};
				Update: {
					created_at?: string;
					day_of_week?: number;
					end_date?: string | null;
					id?: string;
					is_active?: boolean;
					lesson_type_id?: string;
					notes?: string | null;
					start_date?: string;
					start_time?: string;
					student_user_id?: string;
					teacher_id?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'lesson_agreements_lesson_type_id_fkey';
						columns: ['lesson_type_id'];
						isOneToOne: false;
						referencedRelation: 'lesson_types';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'lesson_agreements_teacher_id_fkey';
						columns: ['teacher_id'];
						isOneToOne: false;
						referencedRelation: 'teachers';
						referencedColumns: ['id'];
					},
				];
			};
			lesson_appointment_deviations: {
				Row: {
					actual_date: string;
					actual_start_time: string;
					created_at: string;
					created_by_user_id: string;
					id: string;
					is_cancelled: boolean;
					last_updated_by_user_id: string;
					lesson_agreement_id: string;
					original_date: string;
					original_start_time: string;
					reason: string | null;
					recurring: boolean;
					recurring_end_date: string | null;
					updated_at: string;
				};
				Insert: {
					actual_date: string;
					actual_start_time: string;
					created_at?: string;
					created_by_user_id: string;
					id?: string;
					is_cancelled?: boolean;
					last_updated_by_user_id: string;
					lesson_agreement_id: string;
					original_date: string;
					original_start_time: string;
					reason?: string | null;
					recurring?: boolean;
					recurring_end_date?: string | null;
					updated_at?: string;
				};
				Update: {
					actual_date?: string;
					actual_start_time?: string;
					created_at?: string;
					created_by_user_id?: string;
					id?: string;
					is_cancelled?: boolean;
					last_updated_by_user_id?: string;
					lesson_agreement_id?: string;
					original_date?: string;
					original_start_time?: string;
					reason?: string | null;
					recurring?: boolean;
					recurring_end_date?: string | null;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'lesson_appointment_deviations_lesson_agreement_id_fkey';
						columns: ['lesson_agreement_id'];
						isOneToOne: false;
						referencedRelation: 'lesson_agreements';
						referencedColumns: ['id'];
					},
				];
			};
			lesson_types: {
				Row: {
					color: string;
					cost_center: string | null;
					created_at: string;
					description: string | null;
					duration_minutes: number;
					frequency: Database['public']['Enums']['lesson_frequency'];
					icon: string;
					id: string;
					is_active: boolean;
					is_group_lesson: boolean;
					name: string;
					price_per_lesson: number;
					updated_at: string;
				};
				Insert: {
					color: string;
					cost_center?: string | null;
					created_at?: string;
					description?: string | null;
					duration_minutes?: number;
					frequency?: Database['public']['Enums']['lesson_frequency'];
					icon: string;
					id?: string;
					is_active?: boolean;
					is_group_lesson?: boolean;
					name: string;
					price_per_lesson: number;
					updated_at?: string;
				};
				Update: {
					color?: string;
					cost_center?: string | null;
					created_at?: string;
					description?: string | null;
					duration_minutes?: number;
					frequency?: Database['public']['Enums']['lesson_frequency'];
					icon?: string;
					id?: string;
					is_active?: boolean;
					is_group_lesson?: boolean;
					name?: string;
					price_per_lesson?: number;
					updated_at?: string;
				};
				Relationships: [];
			};
			profiles: {
				Row: {
					avatar_url: string | null;
					created_at: string;
					email: string;
					first_name: string | null;
					id: string;
					last_name: string | null;
					phone_number: string | null;
					updated_at: string;
					user_id: string;
				};
				Insert: {
					avatar_url?: string | null;
					created_at?: string;
					email: string;
					first_name?: string | null;
					id?: string;
					last_name?: string | null;
					phone_number?: string | null;
					updated_at?: string;
					user_id: string;
				};
				Update: {
					avatar_url?: string | null;
					created_at?: string;
					email?: string;
					first_name?: string | null;
					id?: string;
					last_name?: string | null;
					phone_number?: string | null;
					updated_at?: string;
					user_id?: string;
				};
				Relationships: [];
			};
			students: {
				Row: {
					created_at: string;
					debtor_address: string | null;
					debtor_city: string | null;
					debtor_info_same_as_student: boolean;
					debtor_name: string | null;
					debtor_postal_code: string | null;
					id: string;
					parent_email: string | null;
					parent_name: string | null;
					parent_phone_number: string | null;
					updated_at: string;
					user_id: string;
				};
				Insert: {
					created_at?: string;
					debtor_address?: string | null;
					debtor_city?: string | null;
					debtor_info_same_as_student?: boolean;
					debtor_name?: string | null;
					debtor_postal_code?: string | null;
					id?: string;
					parent_email?: string | null;
					parent_name?: string | null;
					parent_phone_number?: string | null;
					updated_at?: string;
					user_id: string;
				};
				Update: {
					created_at?: string;
					debtor_address?: string | null;
					debtor_city?: string | null;
					debtor_info_same_as_student?: boolean;
					debtor_name?: string | null;
					debtor_postal_code?: string | null;
					id?: string;
					parent_email?: string | null;
					parent_name?: string | null;
					parent_phone_number?: string | null;
					updated_at?: string;
					user_id?: string;
				};
				Relationships: [];
			};
			teacher_availability: {
				Row: {
					created_at: string;
					day_of_week: number;
					end_time: string;
					id: string;
					start_time: string;
					teacher_id: string;
					updated_at: string;
				};
				Insert: {
					created_at?: string;
					day_of_week: number;
					end_time: string;
					id?: string;
					start_time: string;
					teacher_id: string;
					updated_at?: string;
				};
				Update: {
					created_at?: string;
					day_of_week?: number;
					end_time?: string;
					id?: string;
					start_time?: string;
					teacher_id?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'teacher_availability_teacher_id_fkey';
						columns: ['teacher_id'];
						isOneToOne: false;
						referencedRelation: 'teachers';
						referencedColumns: ['id'];
					},
				];
			};
			teacher_lesson_types: {
				Row: {
					created_at: string;
					lesson_type_id: string;
					teacher_id: string;
				};
				Insert: {
					created_at?: string;
					lesson_type_id: string;
					teacher_id: string;
				};
				Update: {
					created_at?: string;
					lesson_type_id?: string;
					teacher_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'teacher_lesson_types_lesson_type_id_fkey';
						columns: ['lesson_type_id'];
						isOneToOne: false;
						referencedRelation: 'lesson_types';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'teacher_lesson_types_teacher_id_fkey';
						columns: ['teacher_id'];
						isOneToOne: false;
						referencedRelation: 'teachers';
						referencedColumns: ['id'];
					},
				];
			};
			teachers: {
				Row: {
					bio: string | null;
					created_at: string;
					id: string;
					is_active: boolean;
					updated_at: string;
					user_id: string;
				};
				Insert: {
					bio?: string | null;
					created_at?: string;
					id?: string;
					is_active?: boolean;
					updated_at?: string;
					user_id: string;
				};
				Update: {
					bio?: string | null;
					created_at?: string;
					id?: string;
					is_active?: boolean;
					updated_at?: string;
					user_id?: string;
				};
				Relationships: [];
			};
			user_roles: {
				Row: {
					created_at: string;
					role: Database['public']['Enums']['app_role'];
					user_id: string;
				};
				Insert: {
					created_at?: string;
					role: Database['public']['Enums']['app_role'];
					user_id: string;
				};
				Update: {
					created_at?: string;
					role?: Database['public']['Enums']['app_role'];
					user_id?: string;
				};
				Relationships: [];
			};
		};
		Views: {
			teacher_viewed_by_student: {
				Row: {
					avatar_url: string | null;
					first_name: string | null;
					last_name: string | null;
					phone_number: string | null;
					teacher_id: string | null;
				};
				Relationships: [];
			};
			view_profiles_with_display_name: {
				Row: {
					avatar_url: string | null;
					created_at: string | null;
					display_name: string | null;
					email: string | null;
					first_name: string | null;
					last_name: string | null;
					phone_number: string | null;
					user_id: string | null;
				};
				Insert: {
					avatar_url?: string | null;
					created_at?: string | null;
					display_name?: never;
					email?: string | null;
					first_name?: string | null;
					last_name?: string | null;
					phone_number?: string | null;
					user_id?: string | null;
				};
				Update: {
					avatar_url?: string | null;
					created_at?: string | null;
					display_name?: never;
					email?: string | null;
					first_name?: string | null;
					last_name?: string | null;
					phone_number?: string | null;
					user_id?: string | null;
				};
				Relationships: [];
			};
		};
		Functions: {
			_has_role: {
				Args: {
					_role: Database['public']['Enums']['app_role'];
					_user_id: string;
				};
				Returns: boolean;
			};
			can_delete_user: {
				Args: { _requester_id: string; _target_id: string };
				Returns: boolean;
			};
			check_rls_enabled: { Args: { p_table_name: string }; Returns: boolean };
			cleanup_student_if_no_agreements: {
				Args: { _user_id: string };
				Returns: undefined;
			};
			ensure_student_exists: { Args: { _user_id: string }; Returns: undefined };
			function_exists: { Args: { p_fn_name: string }; Returns: boolean };
			get_lesson_agreements_paginated: {
				Args: {
					p_is_active?: boolean;
					p_lesson_type_id?: string;
					p_limit?: number;
					p_offset?: number;
					p_search?: string;
					p_sort_column?: string;
					p_sort_direction?: string;
					p_student_user_id?: string;
					p_teacher_id?: string;
				};
				Returns: Json;
			};
			get_public_table_names: {
				Args: never;
				Returns: {
					table_name: string;
				}[];
			};
			get_security_definer_views: {
				Args: never;
				Returns: {
					security_invoker: boolean;
					view_name: string;
					view_owner: string;
				}[];
			};
			get_student_id: { Args: { _user_id: string }; Returns: string };
			get_student_status: { Args: { _user_id: string }; Returns: string };
			get_students_paginated: {
				Args: {
					p_lesson_type_id?: string;
					p_limit?: number;
					p_offset?: number;
					p_search?: string;
					p_sort_column?: string;
					p_sort_direction?: string;
					p_status?: string;
				};
				Returns: Json;
			};
			get_table_policies: { Args: { p_table_name: string }; Returns: string[] };
			get_teacher_id: { Args: { _user_id: string }; Returns: string };
			get_teachers_paginated: {
				Args: {
					p_lesson_type_id?: string;
					p_limit?: number;
					p_offset?: number;
					p_search?: string;
					p_sort_column?: string;
					p_sort_direction?: string;
					p_status?: string;
				};
				Returns: Json;
			};
			get_teachers_viewed_by_student: {
				Args: never;
				Returns: {
					avatar_url: string;
					first_name: string;
					last_name: string;
					phone_number: string;
					teacher_id: string;
				}[];
			};
			get_users_paginated: {
				Args: {
					p_limit?: number;
					p_offset?: number;
					p_role?: string;
					p_search?: string;
					p_sort_column?: string;
					p_sort_direction?: string;
				};
				Returns: Json;
			};
			is_admin: { Args: { _user_id: string }; Returns: boolean };
			is_privileged: { Args: { _user_id: string }; Returns: boolean };
			is_site_admin: { Args: { _user_id: string }; Returns: boolean };
			is_staff: { Args: { _user_id: string }; Returns: boolean };
			is_student: { Args: { _user_id: string }; Returns: boolean };
			is_teacher: { Args: { _user_id: string }; Returns: boolean };
			policy_exists: {
				Args: { p_policy_name: string; p_table_name: string };
				Returns: boolean;
			};
		};
		Enums: {
			app_role: 'site_admin' | 'admin' | 'staff';
			lesson_frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
	DefaultSchemaTableNameOrOptions extends
		| keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
				DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
		: never = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
			DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
			Row: infer R;
		}
		? R
		: never
	: DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
				Row: infer R;
			}
			? R
			: never
		: never;

export type TablesInsert<
	DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Insert: infer I;
		}
		? I
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Insert: infer I;
			}
			? I
			: never
		: never;

export type TablesUpdate<
	DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Update: infer U;
		}
		? U
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Update: infer U;
			}
			? U
			: never
		: never;

export type Enums<
	DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
	EnumName extends DefaultSchemaEnumNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
		: never = never,
> = DefaultSchemaEnumNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
	: DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
		? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
		: never;

export type CompositeTypes<
	PublicCompositeTypeNameOrOptions extends
		| keyof DefaultSchema['CompositeTypes']
		| { schema: keyof DatabaseWithoutInternals },
	CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
		: never = never,
> = PublicCompositeTypeNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
	: PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
		? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
		: never;

export const Constants = {
	graphql_public: {
		Enums: {},
	},
	public: {
		Enums: {
			app_role: ['site_admin', 'admin', 'staff'],
			lesson_frequency: ['daily', 'weekly', 'biweekly', 'monthly'],
		},
	},
} as const;
