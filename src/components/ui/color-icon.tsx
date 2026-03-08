import type { IconType } from 'react-icons';
import { isLightColor } from '@/lib/color/color-utils';
import { cn } from '@/lib/utils';

type ColorIconSize = 'sm' | 'md' | 'lg';

const sizeConfig: Record<ColorIconSize, { container: string; icon: string }> = {
	sm: { container: 'h-5 w-5', icon: 'h-3 w-3' },
	md: { container: 'h-7 w-7', icon: 'h-4 w-4' },
	lg: { container: 'h-9 w-9', icon: 'h-5 w-5' },
};

interface ColorIconProps {
	/** Icon component to render */
	icon?: IconType;
	/** Background color (hex, e.g. "#FF5733") */
	color?: string | null;
	/** Size variant */
	size?: ColorIconSize;
	/** Additional className for the outer container */
	className?: string;
}

/**
 * Displays an icon inside a colored circle. Automatically picks
 * dark or light icon color for readability based on background luminance.
 *
 * Handles all combinations:
 * - color + icon → colored circle with icon
 * - color only  → colored circle (no icon)
 * - icon only   → icon in muted foreground
 * - neither     → nothing rendered (returns null)
 */
export function ColorIcon({ icon: Icon, color, size = 'md', className }: ColorIconProps) {
	const { container, icon: iconSize } = sizeConfig[size];

	if (color && Icon) {
		const light = isLightColor(color);
		return (
			<div
				className={cn('flex items-center justify-center rounded-md shrink-0', container, className)}
				style={{ backgroundColor: color }}
			>
				<Icon className={cn(iconSize, light ? 'text-gray-900' : 'text-white')} />
			</div>
		);
	}

	if (color) {
		return (
			<div
				className={cn(
					'rounded-full shrink-0',
					size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4',
					className,
				)}
				style={{ backgroundColor: color }}
			/>
		);
	}

	if (Icon) {
		return <Icon className={cn(iconSize, 'shrink-0 text-muted-foreground', className)} />;
	}

	return null;
}
