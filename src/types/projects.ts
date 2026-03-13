import type { Tables } from '@/integrations/supabase/types';

export type ProjectDomain = Tables<'project_domains'>;
export type ProjectLabel = Tables<'project_labels'>;
export type Project = Tables<'projects'>;

/** Project row for the projects data table (with joined label, domain and owner display data) */
export type ProjectRow = Project & {
	label_name: string;
	domain_name: string;
	owner_first_name: string | null;
	owner_last_name: string | null;
	owner_email: string | null;
	owner_avatar_url: string | null;
};
