import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';

export type RecurrenceScope = 'single' | 'thisAndFuture';

interface RecurrenceChoiceDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** 'change' for drag/resize, 'cancel' for cancelling a lesson */
	action: 'change' | 'cancel';
	onChoose: (scope: RecurrenceScope) => void;
}

export function RecurrenceChoiceDialog({
	open,
	onOpenChange,
	action,
	onChoose,
}: RecurrenceChoiceDialogProps) {
	const isCancel = action === 'cancel';
	const verb = isCancel ? 'annuleren' : 'wijzigen';

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Alleen deze of alle volgende?</DialogTitle>
					<DialogDescription>
						{isCancel
							? 'Wil je alleen deze les annuleren of deze en alle volgende lessen in de reeks?'
							: `Wil je alleen deze afspraak ${verb} of deze en alle volgende afspraken ${verb}?`}
					</DialogDescription>
				</DialogHeader>
				<DialogFooter className="flex-col gap-2 sm:flex-col">
					<Button
						className="w-full sm:w-full"
						autoFocus
						onClick={() => {
							onOpenChange(false);
							onChoose('single');
						}}
					>
						Alleen deze afspraak {verb}
					</Button>
					<Button
						className="w-full sm:w-full"
						variant="outline"
						onClick={() => {
							onOpenChange(false);
							onChoose('thisAndFuture');
						}}
					>
						Deze en alle volgende afspraken {verb}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
