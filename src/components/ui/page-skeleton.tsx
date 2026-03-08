import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type PageSkeletonVariant = 'header-only' | 'header-and-cards' | 'header-and-tabs' | 'agenda';

interface PageSkeletonProps {
	/** Show header block (avatar + title + subtitle). Default true for most variants, false for 'agenda'. */
	showHeader?: boolean;
	/** Content layout variant. Default 'header-and-cards'. */
	variant?: PageSkeletonVariant;
	className?: string;
}

export function PageSkeleton({ showHeader, variant = 'header-and-cards', className }: PageSkeletonProps) {
	const showHeaderBlock = showHeader ?? variant !== 'agenda';

	return (
		<div className={cn('space-y-6', className)}>
			{showHeaderBlock && (
				<div className="flex items-center gap-4">
					<Skeleton className="h-16 w-16 shrink-0 rounded-full" />
					<div className="flex-1 space-y-2">
						<Skeleton className="h-8 w-48" />
						<Skeleton className="h-4 w-32" />
					</div>
				</div>
			)}
			{variant === 'agenda' && (
				<div className="flex h-[600px] flex-col rounded-lg border border-border bg-card overflow-hidden">
					{/* Toolbar: nav buttons, label, view selector */}
					<div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-3">
						<div className="flex gap-2">
							<Skeleton className="h-8 w-20 rounded" />
							<Skeleton className="h-8 w-16 rounded" />
							<Skeleton className="h-8 w-16 rounded" />
						</div>
						<Skeleton className="h-6 w-44" />
						<Skeleton className="h-8 w-20 rounded" />
					</div>
					{/* Day headers */}
					<div
						className="grid shrink-0 border-b border-border"
						style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}
					>
						<div className="border-r border-border" />
						{(['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'] as const).map((day) => (
							<div
								key={day}
								className="flex flex-col items-center justify-center border-r border-border py-3 last:border-r-0"
							>
								<Skeleton className="h-4 w-14" />
							</div>
						))}
					</div>
					{/* Time grid: 09:00–14:30 in half-hour slots, fills remaining height */}
					<div className="flex min-h-0 flex-1">
						<div className="flex w-[60px] shrink-0 flex-col border-r border-border py-2 pr-2 text-right">
							{[
								'09:00',
								'09:30',
								'10:00',
								'10:30',
								'11:00',
								'11:30',
								'12:00',
								'12:30',
								'13:00',
								'13:30',
								'14:00',
								'14:30',
							].map((time) => (
								<div key={time} className="flex flex-1 min-h-[32px] items-center justify-end">
									<Skeleton className="h-4 w-10" />
								</div>
							))}
						</div>
						<div
							className="grid min-w-0 flex-1 grid-cols-7 divide-x divide-border"
							style={{ gridTemplateRows: 'repeat(12, 1fr)' }}
						>
							{(
								['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11', 's12'] as const
							).flatMap((slot) =>
								(['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'] as const).map((day) => (
									<div
										key={`${slot}-${day}`}
										className={cn(slot !== 's12' && 'border-b border-border')}
									/>
								)),
							)}
						</div>
					</div>
				</div>
			)}
			{variant === 'header-and-tabs' && (
				<>
					<div className="flex gap-2 border-b pb-2">
						<Skeleton className="h-9 w-24" />
						<Skeleton className="h-9 w-28" />
						<Skeleton className="h-9 w-20" />
					</div>
					<div className="space-y-4">
						<Skeleton className="h-32 w-full rounded-lg" />
						<Skeleton className="h-24 w-full rounded-lg" />
					</div>
				</>
			)}
			{variant === 'header-and-cards' && (
				<div className="grid gap-6 md:grid-cols-2">
					<div className="space-y-3 rounded-lg border p-4">
						<Skeleton className="h-5 w-40" />
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-20 w-full" />
					</div>
					<div className="space-y-3 rounded-lg border p-4">
						<Skeleton className="h-5 w-32" />
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-16 w-full" />
					</div>
				</div>
			)}
		</div>
	);
}

/** Compact skeleton for a section (e.g. profile section, lesson types). */
export function SectionSkeleton({ className }: { className?: string }) {
	return (
		<div className={cn('space-y-3', className)}>
			<Skeleton className="h-6 w-32" />
			<Skeleton className="h-20 w-full rounded-lg" />
			<Skeleton className="h-10 w-full rounded-lg" />
		</div>
	);
}
