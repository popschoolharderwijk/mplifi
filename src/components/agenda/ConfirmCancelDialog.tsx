import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface ConfirmCancelDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
	disabled?: boolean;
}

export function ConfirmCancelDialog({ open, onOpenChange, onConfirm, disabled = false }: ConfirmCancelDialogProps) {
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Les annuleren?</AlertDialogTitle>
					<AlertDialogDescription>
						Weet je zeker dat je deze les wilt annuleren? De afspraak blijft zichtbaar in de agenda als
						geannuleerd.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel asChild>
						<Button variant="outline" disabled={disabled}>
							Nee
						</Button>
					</AlertDialogCancel>
					<Button
						variant="destructive"
						onClick={() => {
							onOpenChange(false);
							onConfirm();
						}}
						disabled={disabled}
					>
						{disabled ? <LoadingSpinner size="md" label="Bezig..." /> : 'Ja, les annuleren'}
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
