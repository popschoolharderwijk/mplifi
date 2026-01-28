import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeProviderContextType {
	theme: Theme;
	setTheme: (theme: Theme) => void;
	resolvedTheme: 'light' | 'dark';
}

const ThemeProviderContext = createContext<ThemeProviderContextType | undefined>(undefined);

const STORAGE_KEY = 'popschool-theme';

function getSystemTheme(): 'light' | 'dark' {
	if (typeof window === 'undefined') return 'dark';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children, defaultTheme = 'system' }: { children: ReactNode; defaultTheme?: Theme }) {
	const [theme, setThemeState] = useState<Theme>(() => {
		if (typeof window === 'undefined') return defaultTheme;
		return (localStorage.getItem(STORAGE_KEY) as Theme) || defaultTheme;
	});

	const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => {
		if (theme === 'system') return getSystemTheme();
		return theme;
	});

	useEffect(() => {
		const root = window.document.documentElement;
		root.classList.remove('light', 'dark');

		const resolved = theme === 'system' ? getSystemTheme() : theme;
		root.classList.add(resolved);
		setResolvedTheme(resolved);
	}, [theme]);

	// Listen for system theme changes
	useEffect(() => {
		if (theme !== 'system') return;

		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		const handleChange = () => {
			const resolved = getSystemTheme();
			setResolvedTheme(resolved);
			document.documentElement.classList.remove('light', 'dark');
			document.documentElement.classList.add(resolved);
		};

		mediaQuery.addEventListener('change', handleChange);
		return () => mediaQuery.removeEventListener('change', handleChange);
	}, [theme]);

	const setTheme = (newTheme: Theme) => {
		localStorage.setItem(STORAGE_KEY, newTheme);
		setThemeState(newTheme);
	};

	return (
		<ThemeProviderContext.Provider value={{ theme, setTheme, resolvedTheme }}>
			{children}
		</ThemeProviderContext.Provider>
	);
}

export function useTheme() {
	const context = useContext(ThemeProviderContext);
	if (!context) {
		throw new Error('useTheme must be used within a ThemeProvider');
	}
	return context;
}
