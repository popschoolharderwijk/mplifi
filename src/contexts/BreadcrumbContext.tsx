import { createContext, useCallback, useContext, useState } from 'react';

export interface BreadcrumbItem {
	label: string;
	href?: string;
}

interface BreadcrumbContextValue {
	/** Extra items after the route base (e.g. teacher name on /teachers/:id). */
	suffix: BreadcrumbItem[];
	setBreadcrumbSuffix: (items: BreadcrumbItem[]) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
	const [suffix, setSuffix] = useState<BreadcrumbItem[]>([]);

	const setBreadcrumbSuffix = useCallback((items: BreadcrumbItem[]) => {
		setSuffix(items);
	}, []);

	return <BreadcrumbContext.Provider value={{ suffix, setBreadcrumbSuffix }}>{children}</BreadcrumbContext.Provider>;
}

export function useBreadcrumb() {
	const ctx = useContext(BreadcrumbContext);
	if (!ctx) {
		return {
			suffix: [] as BreadcrumbItem[],
			setBreadcrumbSuffix: (_: BreadcrumbItem[]) => {},
		};
	}
	return ctx;
}
