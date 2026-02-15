import { LuLoaderCircle } from 'react-icons/lu';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';

interface ConfirmCancelDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
	disabled?: boolean;
}

export function ConfirmCancelDialog({ open, onOpenChange, onConfirm, disabled = false }: ConfirmCancelDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Les annuleren?</DialogTitle>
					<DialogDescription>
						Weet je zeker dat je deze les wilt annuleren? De afspraak blijft zichtbaar in de agenda als
						geannuleerd.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)} disabled={disabled}>
						Nee
					</Button>
					<Button
						variant="destructive"
						onClick={() => {
							onOpenChange(false);
							onConfirm();
						}}
						disabled={disabled}
					>
						{disabled ? (
							<span className="inline-flex items-center gap-2">
								<LuLoaderCircle className="h-4 w-4 animate-spin" />
								Bezig...
							</span>
						) : (
							'Ja, les annuleren'
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
