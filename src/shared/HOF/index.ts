import type CanvasAnimation from '../abstract/canvas';
import type { MutableRefObject, EventHandler, UIEvent } from 'react';
import type { ICanvasWorkerProps, TCallable } from '../types';

export const getThrottle = <R = void, A = any>(
	time: number,
	callback: TCallable<R, A>
): TCallable<void, A> => {
	let throttlePause: boolean;

	const throttle = (...args: A[]): void => {
		if (throttlePause) return;
		throttlePause = true;

		setTimeout(() => {
			callback(...args);
			throttlePause = false;
		}, time);
	};

	return throttle;
};

export const animationParamChangerFactory = <A extends object, V>(
	webWorker: MutableRefObject<Worker | null> | null,
	animationRef: (CanvasAnimation & Omit<A, 'prototype'>) | null,
	paramName: ICanvasWorkerProps['msg'],
	paramCallback: (...args: [V, ...any[]]) => void
) => {
	const handleAnimationParamChange = (value: V) => {
		if (webWorker?.current) {
			webWorker?.current.postMessage({
				msg: paramName,
				[paramName]: value,
			});
		} else if (animationRef) {
			paramCallback(value, animationRef);
		}
	};

	return handleAnimationParamChange;
};

export const withPrevents = <E extends Element, V extends UIEvent<E>>(
	func: EventHandler<V>,
	callCondition = true,
	preventCondition = true
) => {
	return (e: V) => {
		preventCondition && e?.preventDefault();
		callCondition && func(e);
	};
};
