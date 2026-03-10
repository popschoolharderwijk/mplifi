import type { CalendarEvent } from '@/components/agenda/types';
import { formatDbDateLong } from '@/lib/date/date-format';
import { formatTime } from '@/lib/time/time-format';

export function buildTooltipText(event: CalendarEvent): string {
	const {
		hasTimeOrDateChange,
		isCancelled,
		originalDate,
		originalStartTime,
		reason,
		lessonTypeName,
		studentName,
		isGroupLesson,
		studentCount,
		sourceType,
		participantCount,
		participantNames,
		isLesson,
		teacherName,
		viewerIsTeacher,
	} = event.resource;

	const lines: string[] = [lessonTypeName];

	if (isLesson && !isGroupLesson) {
		const otherPartyName = viewerIsTeacher ? studentName : (teacherName ?? studentName);
		lines.push(otherPartyName);
	} else if (isGroupLesson) {
		lines.push(`${studentCount} deelnemers:`);
		const students = studentName.split(', ');
		for (const student of students) {
			lines.push(`  • ${student}`);
		}
	} else if ((participantCount ?? 0) > 1 && participantNames?.length) {
		lines.push(`${participantCount} deelnemers:`);
		for (const name of participantNames) {
			lines.push(`  • ${name}`);
		}
	} else {
		lines.push(studentName);
	}

	if (isCancelled) {
		lines.push('');
		const cancelledLabel = sourceType === 'lesson_agreement' ? '❌ Les vervallen' : '❌ Afspraak vervallen';
		lines.push(cancelledLabel);
		if (reason) {
			lines.push(`Reden: ${reason}`);
		}
	} else if (hasTimeOrDateChange) {
		lines.push('');
		lines.push('⚠ Gewijzigde afspraak');
		if (originalDate && originalStartTime) {
			lines.push(`Origineel: ${formatDbDateLong(originalDate)} om ${formatTime(originalStartTime)}`);
		}
		if (reason) {
			lines.push(`Reden: ${reason}`);
		}
	}

	return lines.join('\n');
}
