import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export type RecurrenceScope = 'single' | 'thisAndFuture' | 'all';

interface RecurrenceChoiceDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** 'change' for drag/resize, 'cancel' for cancelling a lesson, 'delete' for deleting, 'edit' for form edits */
	action: 'change' | 'cancel' | 'delete' | 'edit';
	onChoose: (scope: RecurrenceScope) => void;
	/** Hide the "this and future" option (e.g., for lesson cancellations) */
	hideFutureOption?: boolean;
}

export function RecurrenceChoiceDialog({
	open,
	onOpenChange,
	action,
	onChoose,
	hideFutureOption = false,
}: RecurrenceChoiceDialogProps) {
	const isDelete = action === 'delete';
	const isCancel = action === 'cancel';
	const isEdit = action === 'edit';
	const showSingleOption = true;
	const showFutureOption = !hideFutureOption;
	/** Show "all appointments" option for change (drag/resize), delete, and edit — applies to past and future. */
	const showAllOption = true;

	const defaultScope: RecurrenceScope = 'single';
	const [selected, setSelected] = useState<RecurrenceScope>(defaultScope);

	useEffect(() => {
		if (open) {
			setSelected(defaultScope);
		}
	}, [open]);

	const getTitle = () => {
		if (isDelete) return 'Terugkerende afspraak verwijderen';
		if (isCancel) return 'Terugkerende les annuleren';
		if (isEdit) return 'Terugkerende afspraak bewerken';
		return 'Terugkerende afspraak wijzigen';
	};

	const handleConfirm = () => {
		onOpenChange(false);
		onChoose(selected);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[400px]">
				<DialogHeader>
					<DialogTitle>{getTitle()}</DialogTitle>
				</DialogHeader>

				<RadioGroup value={selected} onValueChange={(v) => setSelected(v as RecurrenceScope)} className="gap-3">
					{showSingleOption && (
						<div className="flex items-center space-x-3">
							<RadioGroupItem value="single" id="scope-single" />
							<Label htmlFor="scope-single" className="font-normal cursor-pointer">
								Alleen deze afspraak
							</Label>
						</div>
					)}
					{showFutureOption && (
						<div className="flex items-center space-x-3">
							<RadioGroupItem value="thisAndFuture" id="scope-future" />
							<Label htmlFor="scope-future" className="font-normal cursor-pointer">
								Deze en alle volgende afspraken
							</Label>
						</div>
					)}
					{showAllOption && (
						<div className="flex items-center space-x-3">
							<RadioGroupItem value="all" id="scope-all" />
							<Label htmlFor="scope-all" className="font-normal cursor-pointer">
								Alle afspraken
							</Label>
						</div>
					)}
				</RadioGroup>

				<DialogFooter className="gap-2 sm:gap-0">
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						Annuleren
					</Button>
					<Button onClick={handleConfirm}>OK</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
