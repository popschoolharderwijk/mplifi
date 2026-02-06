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
}

export function ColorPicker({ value, onChange, placeholder = 'Selecteer kleur', className }: ColorPickerProps) {
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
		<Popover open={open} onOpenChange={setOpen} modal>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
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
