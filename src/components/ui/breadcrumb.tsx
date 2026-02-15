import * as React from 'react';
import { LuChevronRight, LuLayoutDashboard } from 'react-icons/lu';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
	label: string;
	href?: string;
}

interface BreadcrumbProps {
	items: BreadcrumbItem[];
	className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
	return (
		<nav
			aria-label="Breadcrumb"
			className={cn('flex items-center space-x-2 text-sm text-muted-foreground', className)}
		>
			<Link to="/" className="flex items-center hover:text-foreground transition-colors" aria-label="Home">
				<LuLayoutDashboard className="h-4 w-4" />
			</Link>
			{items.map((item, index) => {
				const isLast = index === items.length - 1;
				const currentPageClass = 'text-foreground font-medium';
				return (
					<React.Fragment key={item.href ?? item.label}>
						<LuChevronRight className="h-4 w-4" />
						{isLast ? (
							<span className={currentPageClass}>{item.label}</span>
						) : item.href ? (
							<Link to={item.href} className="hover:text-foreground transition-colors">
								{item.label}
							</Link>
						) : (
							<span className={currentPageClass}>{item.label}</span>
						)}
					</React.Fragment>
				);
			})}
		</nav>
	);
}
