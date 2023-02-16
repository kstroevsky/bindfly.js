import { useContext, useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';

import useForceUpdate from './useForceUpdate';
import useGetParamsHandlers from './useGetParamsHandlers';
import DataContext, { IDataContext } from '../components/Context';
import {
	canvasClickHandler,
	canvasReload,
} from '../shared/utils/canvas-helpers';

import type CanvasAnimation from '../shared/abstract/canvas';
import type {
	TConstructorOf,
	ICanvasWorkerProps,
	TAnimationProperties,
	TParamsHandlers,
} from '../shared/types';

const useCanvas = <A extends object>(
	Animation: TConstructorOf<CanvasAnimation & Omit<A, 'prototype'>>,
	animationParameters: TAnimationProperties
): [MutableRefObject<HTMLCanvasElement | null>, TParamsHandlers] => {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const animationRef = useRef<InstanceType<typeof Animation> | null>(null);

	const { keyToggle, webWorker } = useContext<IDataContext>(DataContext);
	const reload = useForceUpdate();

	canvasReload<A>(keyToggle, webWorker, canvasRef, animationRef);

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
					);

					webWorker.current = worker;

					const offscreen: OffscreenCanvas =
						canvasRef.current.transferControlToOffscreen();

					webWorker.current.postMessage(
						{
							msg: 'init',
							canvas: offscreen,
							animationName: Animation.name,
							animationParameters,
						} as ICanvasWorkerProps,
						[offscreen]
					);

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
							});
						};
					}
				} catch {
					const { innerWidth, innerHeight, devicePixelRatio } =
						animationParameters;
					const canvas: HTMLCanvasElement = canvasRef.current;

					canvas.width =
						(canvas.width !== innerWidth ? canvas.width : innerWidth) *
						devicePixelRatio;
					canvas.height =
						(canvas.height !== innerHeight ? canvas.height : innerHeight) *
						devicePixelRatio;

					const ctx: CanvasRenderingContext2D | null = canvas.getContext('2d', {
						alpha: false,
					});
					ctx?.scale(devicePixelRatio, devicePixelRatio);

					animationRef.current = new Animation(ctx, animationParameters);

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
								);
							}
						};
					}

					animationRef.current?.init();

					return () => {
						animationRef.current?.clear();
					};
				}
			} catch {
				reload();
			}
		}
	}, [Animation, animationParameters]);

	const handlers = useGetParamsHandlers(webWorker, animationRef);

	return [canvasRef, handlers];
};

export default useCanvas;
