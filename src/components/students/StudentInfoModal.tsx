import { useCallback, useEffect, useState } from 'react';
import { LuMail, LuPhone, LuUser, LuUsers, LuWallet } from 'react-icons/lu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { FullStudentData, StudentInfoModalData } from '@/types/students';

export type { StudentInfoModalData };

interface StudentInfoModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Initial student data (name/email/avatar) - modal will load full details */
	student: StudentInfoModalData | null;
}

function getDisplayName(profile: StudentInfoModalData['profile']): string {
	if (profile.first_name && profile.last_name) {
		return `${profile.first_name} ${profile.last_name}`;
	}
	if (profile.first_name) {
		return profile.first_name;
	}
	return profile.email;
}

function getInitials(profile: StudentInfoModalData['profile']): string {
	if (profile.first_name && profile.last_name) {
		return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
	}
	if (profile.first_name) {
		return profile.first_name.slice(0, 2).toUpperCase();
	}
	return profile.email.slice(0, 2).toUpperCase();
}

function formatPhoneNumber(phone: string | null): string {
	if (!phone) return '-';
	// Format as 06 1234 5678 for Dutch numbers
	if (phone.length === 10) {
		return `${phone.slice(0, 2)} ${phone.slice(2, 6)} ${phone.slice(6)}`;
	}
	return phone;
}

interface InfoRowProps {
	label: string;
	value: string | null | undefined;
	icon?: React.ReactNode;
}

function InfoRow({ label, value, icon }: InfoRowProps) {
	return (
		<div className="flex items-start gap-3">
			{icon && <div className="text-muted-foreground mt-0.5">{icon}</div>}
			<div className="min-w-0 flex-1">
				<p className="text-xs text-muted-foreground">{label}</p>
				<p className="text-sm font-medium">{value || '-'}</p>
			</div>
		</div>
	);
}

interface InfoSectionProps {
	title: string;
	icon: React.ReactNode;
	children: React.ReactNode;
	className?: string;
}

function InfoSection({ title, icon, children, className }: InfoSectionProps) {
	return (
		<div className={cn('space-y-3', className)}>
			<div className="flex items-center gap-2 text-muted-foreground">
				{icon}
				<h3 className="text-sm font-semibold">{title}</h3>
			</div>
			<div className="space-y-2 pl-6">{children}</div>
		</div>
	);
}

export function StudentInfoModal({ open, onOpenChange, student }: StudentInfoModalProps) {
	const { isAdmin, isSiteAdmin, isStaff } = useAuth();
	const [fullData, setFullData] = useState<FullStudentData | null>(null);
	const [loading, setLoading] = useState(false);

	// Only privileged users can see full student data
	const canViewFullData = isAdmin || isSiteAdmin || isStaff;

	const loadFullStudentData = useCallback(async () => {
		if (!student || !canViewFullData) return;

		setLoading(true);

		try {
			// Load full student data including parent/debtor info
			// Note: We query by user_id because the modal receives user_id from calendar events
			const { data: studentData, error: studentError } = await supabase
				.from('students')
				.select(
					'id, user_id, parent_name, parent_email, parent_phone_number, debtor_info_same_as_student, debtor_name, debtor_address, debtor_postal_code, debtor_city, created_at, updated_at',
				)
				.eq('user_id', student.user_id)
				.single();

			if (studentError) {
				console.error('Error loading student data:', studentError);
				setLoading(false);
				return;
			}

			// Load profile data (phone might not have been passed in initial data)
			const { data: profileData, error: profileError } = await supabase
				.from('profiles')
				.select('email, first_name, last_name, avatar_url, phone_number')
				.eq('user_id', student.user_id)
				.single();

			if (profileError) {
				console.error('Error loading profile data:', profileError);
				setLoading(false);
				return;
			}

			setFullData({
				...studentData,
				profile: profileData,
			});
		} catch (error) {
			console.error('Error loading student data:', error);
		} finally {
			setLoading(false);
		}
	}, [student, canViewFullData]);

	// Load full data when modal opens
	useEffect(() => {
		if (open && student) {
			loadFullStudentData();
		} else {
			setFullData(null);
		}
	}, [open, student, loadFullStudentData]);

	if (!student) return null;

	const displayName = getDisplayName(student.profile);
	const initials = getInitials(student.profile);

	// Use full data if available, otherwise use initial data
	const profile = fullData?.profile ?? student.profile;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader className="pb-2">
					<div className="flex items-center gap-4">
						<Avatar className="h-16 w-16">
							<AvatarImage src={profile.avatar_url ?? undefined} alt={displayName} />
							<AvatarFallback className="bg-primary/10 text-primary text-xl font-medium">
								{initials}
							</AvatarFallback>
						</Avatar>
						<div className="flex-1 min-w-0">
							<DialogTitle className="text-xl">{displayName}</DialogTitle>
							<DialogDescription className="text-sm">{profile.email}</DialogDescription>
						</div>
					</div>
				</DialogHeader>

				<Separator />

				{loading ? (
					<div className="space-y-5 py-2">
						{/* Contact Information Skeleton */}
						<div className="space-y-3">
							<div className="flex items-center gap-2">
								<Skeleton className="h-4 w-4" />
								<Skeleton className="h-4 w-28" />
							</div>
							<div className="space-y-2 pl-6">
								<div className="flex items-start gap-3">
									<Skeleton className="h-4 w-4 mt-0.5" />
									<div className="space-y-1 flex-1">
										<Skeleton className="h-3 w-12" />
										<Skeleton className="h-4 w-40" />
									</div>
								</div>
								<div className="flex items-start gap-3">
									<Skeleton className="h-4 w-4 mt-0.5" />
									<div className="space-y-1 flex-1">
										<Skeleton className="h-3 w-24" />
										<Skeleton className="h-4 w-28" />
									</div>
								</div>
							</div>
						</div>

						{/* Additional sections skeleton for privileged users */}
						{canViewFullData && (
							<>
								<Separator />
								{/* Parent/Guardian Skeleton */}
								<div className="space-y-3">
									<div className="flex items-center gap-2">
										<Skeleton className="h-4 w-4" />
										<Skeleton className="h-4 w-24" />
									</div>
									<div className="space-y-2 pl-6">
										<div className="space-y-1">
											<Skeleton className="h-3 w-12" />
											<Skeleton className="h-4 w-32" />
										</div>
										<div className="space-y-1">
											<Skeleton className="h-3 w-12" />
											<Skeleton className="h-4 w-36" />
										</div>
									</div>
								</div>

								<Separator />

								{/* Debtor Skeleton */}
								<div className="space-y-3">
									<div className="flex items-center gap-2">
										<Skeleton className="h-4 w-4" />
										<Skeleton className="h-4 w-32" />
									</div>
									<div className="pl-6">
										<Skeleton className="h-5 w-44" />
									</div>
								</div>

								<Separator />

								{/* Metadata Skeleton */}
								<div className="space-y-1">
									<Skeleton className="h-3 w-48" />
									<Skeleton className="h-3 w-52" />
								</div>
							</>
						)}
					</div>
				) : (
					<div className="space-y-5 py-2">
						{/* Contact Information */}
						<InfoSection title="Contactgegevens" icon={<LuUser className="h-4 w-4" />}>
							<InfoRow label="Email" value={profile.email} icon={<LuMail className="h-4 w-4" />} />
							<InfoRow
								label="Telefoonnummer"
								value={formatPhoneNumber(profile.phone_number)}
								icon={<LuPhone className="h-4 w-4" />}
							/>
						</InfoSection>

						{/* Parent/Guardian Information - only visible for privileged users */}
						{canViewFullData && fullData && (
							<>
								<Separator />
								<InfoSection title="Ouder/voogd" icon={<LuUsers className="h-4 w-4" />}>
									{fullData.parent_name || fullData.parent_email || fullData.parent_phone_number ? (
										<>
											<InfoRow label="Naam" value={fullData.parent_name} />
											<InfoRow
												label="Email"
												value={fullData.parent_email}
												icon={<LuMail className="h-4 w-4" />}
											/>
											<InfoRow
												label="Telefoonnummer"
												value={formatPhoneNumber(fullData.parent_phone_number)}
												icon={<LuPhone className="h-4 w-4" />}
											/>
										</>
									) : (
										<p className="text-sm text-muted-foreground italic">
											Geen ouder/voogd gegevens bekend
										</p>
									)}
								</InfoSection>

								<Separator />

								{/* Debtor Information */}
								<InfoSection title="Debiteurgegevens" icon={<LuWallet className="h-4 w-4" />}>
									{fullData.debtor_info_same_as_student ? (
										<Badge variant="secondary" className="text-xs">
											Gelijk aan leerlinggegevens
										</Badge>
									) : (
										<>
											<InfoRow label="Naam" value={fullData.debtor_name} />
											<InfoRow label="Adres" value={fullData.debtor_address} />
											<InfoRow
												label="Postcode en plaats"
												value={
													fullData.debtor_postal_code || fullData.debtor_city
														? `${fullData.debtor_postal_code ?? ''} ${fullData.debtor_city ?? ''}`.trim()
														: null
												}
											/>
										</>
									)}
								</InfoSection>
							</>
						)}

						{/* Show limited message for non-privileged users */}
						{!canViewFullData && (
							<p className="text-xs text-muted-foreground italic text-center py-2">
								Je hebt alleen toegang tot beperkte leerlinginformatie.
							</p>
						)}

						{/* Metadata */}
						{canViewFullData && fullData && (
							<>
								<Separator />
								<div className="text-xs text-muted-foreground space-y-1">
									<p>Aangemaakt: {new Date(fullData.created_at).toLocaleString('nl-NL')}</p>
									<p>Laatst bijgewerkt: {new Date(fullData.updated_at).toLocaleString('nl-NL')}</p>
								</div>
							</>
						)}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
