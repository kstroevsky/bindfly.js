import { useContext, useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'

import useForceUpdate from './useForceUpdate'
import useGetParamsHandlers from './useGetParamsHandlers'
import DataContext, { IDataContext } from '../components/Context'
import { getThrottle } from '../shared/HOF'
import {
	canvasClickHandler,
	canvasReload,
	canvasResizeHandlerFactory,
} from '../shared/utils/canvas-helpers'

import type CanvasAnimation from '../shared/abstract/canvas'
import type {
	TConstructorOf,
	ICanvasWorkerProps,
	TAnimationProperties,
	TParamsHandlers,
	TAsyncImportedClass,
	ImportType,
} from '../shared/types'
import type { TAnimationClass } from '../components/Animation'

const getAnimationModule = async (animationClass: TAnimationClass) => {
	const animation = await animationClass()
	return animation.default
}

// <A extends TConstructorOf<CanvasAnimation & Omit<A, 'prototype'>>>
const useCanvas = (
	Animation: TAnimationClass,
	animationParameters: TAnimationProperties
): [MutableRefObject<HTMLCanvasElement | null>, TParamsHandlers] => {
	const canvasRef = useRef<HTMLCanvasElement | null>(null)
	const animationRef = useRef<CanvasAnimation & Omit<typeof Animation, 'prototype'> | null>(null)

	const { keyToggle, webWorker } = useContext<IDataContext>(DataContext)
	const reload = useForceUpdate()

	canvasReload<TAsyncImportedClass<typeof Animation>>(keyToggle, webWorker, canvasRef, animationRef)

	useEffect(() => {
		if (canvasRef.current) {
			try {
				try {
					const worker: Worker = new Worker(
						new URL(
							'../shared/WebApi/web-workers/canvas-worker.ts',
							import.meta.url
						),
						{ type: 'module' }
					)

					webWorker.current = worker

					const offscreen: OffscreenCanvas =
						canvasRef.current.transferControlToOffscreen()

					webWorker.current.postMessage(
						{
							msg: 'init',
							canvas: offscreen,
							animationName: Animation.name,
							animationParameters,
						},
						[offscreen]
					)

					window.onresize = getThrottle(500, (_) => {
						(canvasRef.current as HTMLCanvasElement).style.width = `${window.innerWidth}px`;
						(canvasRef.current as HTMLCanvasElement).style.height = `${window.innerHeight}px`
						webWorker.current?.postMessage({
							msg: 'resize',
							e: { target: { innerWidth: window.innerWidth - animationParameters.offset || 0, innerHeight: window.innerHeight, devicePixelRatio: window.devicePixelRatio } },
						})
					})

					if (
						animationParameters.properties.addByClick ||
						animationParameters.properties.switchByClick ||
						animationParameters.properties.moveByClick
					) {
						canvasRef.current.onclick = (e) => {
							webWorker.current?.postMessage({
								msg: 'click',
								pos: {
									x: e.clientX - animationParameters.offset,
									y: e.clientY,
								},
							})
						}
					}

					return () => {
						window.onresize = null
					}
				} catch {
					const canvas: HTMLCanvasElement = canvasRef.current

					canvas.width = (canvas.height !== window.innerWidth ? canvas.width : window.innerWidth) *
						window.devicePixelRatio
					canvas.height = (canvas.height !== window.innerHeight ? canvas.height : window.innerHeight) *
						window.devicePixelRatio

					const ctx: CanvasRenderingContext2D | null = canvas.getContext('2d', {
						alpha: false,
					})

					// async function loadAnimation() {
					// 	const Module = new Animation();
					// 	animationRef.current = new Module(ctx, animationParameters)
					// }

					// loadAnimation()

					const resizer = canvasResizeHandlerFactory(canvas, animationRef.current, ctx, animationParameters.offset)
					animationRef.current = new Animation(ctx, animationParameters)

					window.onresize = getThrottle(500, (e: UIEvent) => {
						(canvas).style.width = `${window.innerWidth}px`;
						(canvas).style.height = `${window.innerHeight}px`
						resizer(e)
					})

					if (
						animationParameters.properties.addByClick ||
						animationParameters.properties.switchByClick ||
						animationParameters.properties.moveByClick
					) {
						canvas.onclick = (e) => {
							if (animationRef.current) {
								canvasClickHandler(
									animationRef.current,
									{
										pos: {
											x: e.clientX - animationParameters.offset,
											y: e.clientY,
										},
									},
									animationParameters.offset
								)
							}
						}
					}

					animationRef.current?.init()

					return () => {
						// if (animationRef.current) {
						// keyToggle.current = !keyToggle.current
						// if (animationRef.current && canvasRef.current) {
						// 	canvasRef.current.width = 0
						// 	canvasRef.current.height = 0
						// }
						// canvas.width = 0
						// canvas.height = 0
						// ctx = null
						// // canvasRef.current = null
						// // canvas.toDataURL()
						// animationRef.current?.clear();
						// // }
						// animationRef.current = null

						window.onresize = null
					}
				}
			} catch {
				reload()
			}
		}
	}, [Animation, animationParameters])

	const handlers = useGetParamsHandlers(webWorker, animationRef)

	return [canvasRef, handlers]
}

export default useCanvas
