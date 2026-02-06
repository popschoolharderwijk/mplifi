import type { IconType } from 'react-icons';
import { cn } from '@/lib/utils';

/**
 * Determine whether a hex color is "light" by computing its relative luminance.
 * Uses the W3C formula: https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
function isLightColor(hex: string): boolean {
	const cleaned = hex.replace('#', '');
	if (cleaned.length !== 6) return false;

	const r = Number.parseInt(cleaned.substring(0, 2), 16) / 255;
	const g = Number.parseInt(cleaned.substring(2, 4), 16) / 255;
	const b = Number.parseInt(cleaned.substring(4, 6), 16) / 255;

	// Convert to linear RGB
	const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
	const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

	// Threshold at 0.45 — a bit above midpoint to ensure dark text kicks in early enough
	return luminance > 0.45;
}

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
