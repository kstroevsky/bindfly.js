import { useCallback, useEffect } from 'react'
import { TCallable, TypeByKeyExist } from '../shared/types'

export type TLegacyListener<T extends object> = TypeByKeyExist<
	T,
	['removeListener',
	'removeEventListener']
>;

const useListenersEffect = <D extends object>(
	domNode: D,
	eventHandlerConfig: Record<string, TCallable>,
	deps?: unknown[],
	additionalCalls: (() => unknown) | null = null,
	condition = true,
	isInverse = false,
	inverseCondition: boolean = deps?.every((x) => x) || false
): void => {
	const addListenerMethod =
		useCallback(
			(
				domNode: D,
				eName: string,
				handler: TCallable,
				isLegacy: boolean
			) =>
				isLegacy
					? (domNode as MediaQueryList)?.addListener(
							...([handler] as Parameters<MediaQueryList['addListener']>)
						)
					: (domNode as Element)?.addEventListener(
							...([
								eName,
							handler as EventListenerOrEventListenerObject,
							false
							] as Parameters<Element['addEventListener']>)
						),
			[]
		)

	const removeListenerMethod =
		useCallback(
			(
				domNode: D,
				eName: string,
				handler: TCallable,
				isLegacy: boolean
			) =>
				isLegacy
					? (domNode as MediaQueryList)?.removeListener(
							...([handler] as Parameters<MediaQueryList['removeListener']>)
						)
					: (domNode as Element)?.removeEventListener(
							...([
								eName,
							handler as EventListenerOrEventListenerObject,
							false
							] as Parameters<Element['removeEventListener']>)
						),
			[]
		)

	useEffect(() => {
		additionalCalls && additionalCalls()

		if (condition) {
			const isLegacy: boolean = Object.hasOwn(domNode, 'addListener')
			const isInverseFalse: boolean = isInverse && !inverseCondition

			Object.keys(eventHandlerConfig).forEach((eventName) =>
				isInverseFalse || !isInverse
					? addListenerMethod(
						domNode,
						eventName,
						eventHandlerConfig[eventName],
						isLegacy
					)
					: removeListenerMethod(
						domNode,
						eventName,
						eventHandlerConfig[eventName],
						isLegacy
					)
			)

			return () =>
				Object.keys(eventHandlerConfig).forEach((eventName) => {
					removeListenerMethod(
						domNode,
						eventName,
						eventHandlerConfig[eventName],
						isLegacy
					)
				})
		}
	}, [domNode, ...Object.values(eventHandlerConfig)])
}

export default useListenersEffect
