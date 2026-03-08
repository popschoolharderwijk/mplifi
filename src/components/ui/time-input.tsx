import * as React from 'react';
import { Input } from '@/components/ui/input';

/** Normalize to HH:mm (24h). Returns null if invalid. */
function parseTo24h(raw: string): string | null {
	const digits = raw.replace(/\D/g, '');
	if (digits.length === 0) return null;
	const h = Math.min(Number.parseInt(digits.slice(0, 2), 10) || 0, 23);
	const m = Math.min(Number.parseInt(digits.slice(2, 4), 10) || 0, 59);
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Format typing toward HH:mm (e.g. "14" -> "14:", "143" -> "14:3"). */
function formatTyping(raw: string): string {
	const digits = raw.replace(/\D/g, '').slice(0, 4);
	if (digits.length <= 2) return digits;
	return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export interface TimeInputProps extends Omit<React.ComponentProps<typeof Input>, 'type' | 'value' | 'onChange'> {
	value: string;
	onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const TimeInput = React.forwardRef<HTMLInputElement, TimeInputProps>(
	({ className, value, onChange, onBlur, onFocus, ...props }, ref) => {
		const [local, setLocal] = React.useState<string | null>(null);
		const isControlled = value !== undefined && value !== null;
		const normalizedValue = isControlled && value ? value.slice(0, 5) : '';
		const displayValue = local !== null ? local : normalizedValue;

		const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
			setLocal(normalizedValue || '');
			onFocus?.(e);
		};

		const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
			const raw = e.target.value;
			const formatted = formatTyping(raw);
			setLocal(formatted);
			const parsed = parseTo24h(formatted);
			if (parsed !== null) {
				onChange({ ...e, target: { ...e.target, value: parsed } });
			}
		};

		const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
			const raw = displayValue;
			const parsed = parseTo24h(raw);
			setLocal(null);
			if (parsed !== null) {
				onChange({ ...e, target: { ...e.target, value: parsed } } as React.ChangeEvent<HTMLInputElement>);
			}
			onBlur?.(e);
		};

		return (
			<Input
				ref={ref}
				type="text"
				inputMode="numeric"
				autoComplete="off"
				placeholder="00:00"
				aria-label="Tijd (24 uur)"
				value={displayValue}
				onFocus={handleFocus}
				onChange={handleChange}
				onBlur={handleBlur}
				className={className}
				maxLength={5}
				{...props}
			/>
		);
	},
);
TimeInput.displayName = 'TimeInput';

export { TimeInput };
