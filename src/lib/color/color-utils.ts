/**
 * Determine whether a hex color is "light" by computing its relative luminance.
 * Uses the W3C formula: https://www.w3.org/TR/WCAG20/#relativeluminancedef
 *
 * @param hex - Hex color string (e.g. "#FF5733" or "FF5733")
 * @returns true if the color is light (should use dark text), false if dark (should use light text)
 */
export function isLightColor(hex: string): boolean {
	const cleaned = hex.replace('#', '');
	if (cleaned.length !== 6) return false;

	const r = Number.parseInt(cleaned.substring(0, 2), 16) / 255;
	const g = Number.parseInt(cleaned.substring(2, 4), 16) / 255;
	const b = Number.parseInt(cleaned.substring(4, 6), 16) / 255;

	const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
	const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

	return luminance > 0.5;
}

/**
 * Get the appropriate text color (white or dark) for a given background color.
 *
 * @param backgroundColor - Hex color string (e.g. "#FF5733")
 * @returns "#000" for light backgrounds, "#fff" for dark backgrounds
 */
export function getContrastTextColor(backgroundColor: string): string {
	return isLightColor(backgroundColor) ? '#000' : '#fff';
}

/**
 * Darken a hex color by a given factor.
 *
 * @param hex - Hex color string (e.g. "#FF5733" or "FF5733")
 * @param factor - Amount to darken (0-1, where 0.2 = 20% darker). Default 0.2
 * @returns Darkened hex color string
 */
export function darkenColor(hex: string, factor = 0.2): string {
	const cleaned = hex.replace('#', '');
	if (cleaned.length !== 6) return hex;

	const r = Math.max(0, Math.round(Number.parseInt(cleaned.substring(0, 2), 16) * (1 - factor)));
	const g = Math.max(0, Math.round(Number.parseInt(cleaned.substring(2, 4), 16) * (1 - factor)));
	const b = Math.max(0, Math.round(Number.parseInt(cleaned.substring(4, 6), 16) * (1 - factor)));

	return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
