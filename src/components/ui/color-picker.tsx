import { useEffect, useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { LuPipette } from 'react-icons/lu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface ColorPickerProps {
	/** Current hex color value (e.g. "#FF5733") */
	value?: string;
	/** Callback when the color changes, returns hex string */
	onChange: (hex: string) => void;
	/** Placeholder text when no color is selected */
	placeholder?: string;
	className?: string;
	/** If true, renders as a small color dot instead of a full button */
	compact?: boolean;
	/** If true, disables the color picker */
	disabled?: boolean;
}

export function ColorPicker({
	value,
	onChange,
	placeholder = 'Selecteer kleur',
	className,
	compact = false,
	disabled = false,
}: ColorPickerProps) {
	const [open, setOpen] = useState(false);
	const [hexInput, setHexInput] = useState(value || '');

	// Sync external value changes into local hex input
	useEffect(() => {
		if (value && /^#[0-9A-Fa-f]{6}$/.test(value)) {
			setHexInput(value);
		}
	}, [value]);

	const handlePickerChange = (hex: string) => {
		setHexInput(hex);
		onChange(hex);
	};

	const handleHexInputChange = (input: string) => {
		setHexInput(input);
		if (/^#[0-9A-Fa-f]{6}$/.test(input)) {
			onChange(input);
		}
	};

	const displayColor = value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : undefined;

	return (
		<Popover open={disabled ? false : open} onOpenChange={disabled ? undefined : setOpen} modal>
			<PopoverTrigger asChild>
				{compact ? (
					<button
						type="button"
						disabled={disabled}
						className={cn(
							'h-6 w-6 rounded-full border-2 border-border hover:border-primary transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
							disabled && 'opacity-50 cursor-not-allowed hover:border-border',
							className,
						)}
						style={{ backgroundColor: displayColor || '#3b82f6' }}
						aria-label="Kies kleur"
					/>
				) : (
					<Button
						variant="outline"
						role="combobox"
						aria-expanded={open}
						disabled={disabled}
						className={cn('w-full justify-between', className)}
					>
						<div className="flex items-center gap-2">
							{displayColor ? (
								<div
									className="h-4 w-4 rounded-full border shrink-0"
									style={{ backgroundColor: displayColor }}
								/>
							) : (
								<div className="h-4 w-4 shrink-0" />
							)}
							<span className="truncate">{displayColor || placeholder}</span>
						</div>
						<LuPipette className="ml-2 h-4 w-4 shrink-0 opacity-50" />
					</Button>
				)}
			</PopoverTrigger>
			<PopoverContent className="w-[280px] p-3" align="start">
				<div className="space-y-3">
					<HexColorPicker
						color={displayColor || '#3b82f6'}
						onChange={handlePickerChange}
						style={{ width: '100%' }}
					/>
					<div className="flex items-center gap-2">
						<div
							className="h-8 w-8 rounded-md border shrink-0"
							style={{ backgroundColor: displayColor || '#ffffff' }}
						/>
						<Input
							value={hexInput}
							onChange={(e) => handleHexInputChange(e.target.value)}
							placeholder="#000000"
							className="h-8 font-mono text-sm"
						/>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
