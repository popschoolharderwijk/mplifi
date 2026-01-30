import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface PhoneInputProps
	extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
	value: string;
	onChange: (value: string) => void;
	label?: string;
	error?: string;
}

/**
 * Phone number input component that validates 10 digits
 * Only allows numeric input and enforces exactly 10 digits
 */
export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
	({ value, onChange, label, error, className, id, ...props }, ref) => {
		const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
			// Only allow digits
			const digitsOnly = e.target.value.replace(/\D/g, '');
			// Limit to 10 digits
			const limited = digitsOnly.slice(0, 10);
			onChange(limited);
		};

		const isValid = value === '' || value.length === 10;
		const displayValue = value;

		return (
			<div className="space-y-2">
				{label && <Label htmlFor={id}>{label}</Label>}
				<Input
					ref={ref}
					id={id}
					type="tel"
					value={displayValue}
					onChange={handleChange}
					placeholder="0612345678"
					maxLength={10}
					className={cn(
						error || (!isValid && value !== '') ? 'border-destructive focus-visible:ring-destructive' : '',
						className,
					)}
					{...props}
				/>
				{error && <p className="text-sm text-destructive">{error}</p>}
				{!error && !isValid && value !== '' && (
					<p className="text-sm text-destructive">Telefoonnummer moet precies 10 cijfers zijn</p>
				)}
			</div>
		);
	},
);
PhoneInput.displayName = 'PhoneInput';
