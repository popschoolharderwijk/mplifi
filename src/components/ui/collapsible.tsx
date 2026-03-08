'use client';

import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import * as React from 'react';

import { cn } from '@/lib/utils';

const Collapsible = CollapsiblePrimitive.Root;

const CollapsibleTrigger = React.forwardRef<
	React.ElementRef<typeof CollapsiblePrimitive.CollapsibleTrigger>,
	React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.CollapsibleTrigger>
>(({ className, ...props }, ref) => (
	<CollapsiblePrimitive.CollapsibleTrigger
		ref={ref}
		className={cn(
			'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
			className,
		)}
		{...props}
	/>
));
CollapsibleTrigger.displayName = CollapsiblePrimitive.CollapsibleTrigger.displayName;

const CollapsibleContent = React.forwardRef<
	React.ElementRef<typeof CollapsiblePrimitive.CollapsibleContent>,
	React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.CollapsibleContent>
>(({ className, ...props }, ref) => (
	<CollapsiblePrimitive.CollapsibleContent ref={ref} className={cn('overflow-hidden', className)} {...props} />
));
CollapsibleContent.displayName = CollapsiblePrimitive.CollapsibleContent.displayName;

export { Collapsible, CollapsibleContent, CollapsibleTrigger };
