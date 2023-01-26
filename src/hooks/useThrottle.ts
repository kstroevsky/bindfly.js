import { useRef, useEffect, useCallback } from 'react';
import { getThrottle } from '../shared/HOF';
import type { TCallable } from '../shared/types';

const useThrottle = <R = void, A = any>(
	time: number,
	callback: TCallable<R, A>
) => {
	const callbackRef = useRef(callback);

	useEffect(() => {
		callbackRef.current = callback;
	});

	return useCallback(
		getThrottle(time, (...args: A[]) => callbackRef.current(...args)),
		[time]
	);
};

export default useThrottle;
