import { Toaster } from 'sonner';
import { useTheme } from '@/components/ThemeProvider';

export function ThemedToaster() {
	const { resolvedTheme } = useTheme();
	return <Toaster theme={resolvedTheme} />;
}
