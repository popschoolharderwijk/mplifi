import { useEffect, useRef } from 'react';

/**
 * Hook that automatically focuses an element when the component mounts.
 * @param condition - Optional condition to check before focusing (default: true)
 * @returns A ref that should be attached to the element to focus
 */
export function useAutofocus<T extends HTMLElement = HTMLInputElement>(condition: boolean = true) {
	const ref = useRef<T>(null);

	useEffect(() => {
		if (condition && ref.current) {
			ref.current.focus();
		}
	}, [condition]);

	return ref;
}
