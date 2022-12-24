import { useContext, useEffect, useRef } from 'react';
import DataContext, { IDataContext } from '../components/Context';
import CanvasAnimation from '../shared/2d/animations/abstract/canvas';
import {
	ConstructorOf,
	ICanvasWorkerProps,
	TAnimationProperties
} from '../shared/types/index';
import { canvasClickHandler, canvasReload } from '../shared/utils';
import useForceUpdate from './useForceUpdate';

const useCanvas = <A extends object>(
	Animation: ConstructorOf<CanvasAnimation & Omit<A, 'prototype'>>,
	animationParameters: TAnimationProperties
) => {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const { keyToggle, webWorker } = useContext<IDataContext>(DataContext);
	const reload = useForceUpdate();

	console.log(1);

	canvasReload(keyToggle, webWorker, canvasRef);

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
							animationParameters
						} as ICanvasWorkerProps,
						[offscreen]
					);

					if (
						animationParameters.properties.addByClick ||
						animationParameters.properties.switchByClick
					)
						canvasRef.current.onclick = (e) => {
							webWorker.current?.postMessage({
								msg: 'click',
								pos: { x: e.clientX - animationParameters.offset, y: e.clientY }
							});
						};
				} catch {
					const { innerWidth, innerHeight, devicePixelRatio } = animationParameters;
					const canvas: HTMLCanvasElement = canvasRef.current;

					canvas.width =
						(canvas.width !== innerWidth ? canvas.width : innerWidth) *
						devicePixelRatio;
					canvas.height =
						(canvas.height !== innerHeight ? canvas.height : innerHeight) *
						devicePixelRatio;

					const ctx: CanvasRenderingContext2D | null = canvas.getContext('2d', {
						alpha: false
					});
					ctx?.scale(devicePixelRatio, devicePixelRatio);

					const animation: InstanceType<typeof Animation> = new Animation(
						ctx,
						animationParameters
					);

					if (
						animationParameters.properties.addByClick ||
						animationParameters.properties.switchByClick
					)
						canvas.onclick = (e) => {
							canvasClickHandler(
								// eslint-disable-next-line @typescript-eslint/no-explicit-any
								animation as any,
								{ pos: { x: e.clientX, y: e.clientY } },
								animationParameters.offset
							);
						};

					animation?.init();

					return () => {
						animation.clear();
					};
				}
			} catch {
				reload();
			}
		}
	}, [Animation, animationParameters]);

	return canvasRef;
};

export default useCanvas;
