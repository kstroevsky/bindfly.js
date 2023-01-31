import { useCallback, useContext, useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';

import CanvasAnimation from '../shared/abstract/canvas';
import useForceUpdate from './useForceUpdate';
import DataContext, { IDataContext } from '../components/Context';
import { animationParamChangerFactory } from '../shared/HOF';
import {
	canvasClickHandler,
	canvasParticlesCountChange,
	canvasReload,
	getVelocity,
} from '../shared/utils';
import type {
	ConstructorOf,
	ICanvasWorkerProps,
	TAnimationProperties,
	TCallable,
} from '../shared/types';
import {TSomeAbstractClass} from "../shared/types";

const useCanvas = <A extends object>(
	Animation: TSomeAbstractClass<CanvasAnimation & Omit<A, 'prototype'>>,
	animationParameters: TAnimationProperties
): [
	MutableRefObject<HTMLCanvasElement | null>,
	TCallable<void, number>,
	TCallable<void, number>,
	TCallable<void, number>,
	TCallable<void, number>
] => {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const animationRef = useRef<InstanceType<typeof Animation> | null>(null);

	const { keyToggle, webWorker } = useContext<IDataContext>(DataContext);
	const reload = useForceUpdate();

	const changeParticlesCount = useCallback(
		animationParamChangerFactory<A, number>(
			webWorker,
			animationRef.current,
			'count',
			canvasParticlesCountChange
		),
		[animationRef.current, webWorker.current]
	);

	const changeRadius = useCallback(
		animationParamChangerFactory<A, number>(
			webWorker,
			animationRef.current,
			'radius',
			(radius) =>
				Object.assign({}, animationRef.current, { spiralRadius: radius || 0 })
		),
		[animationRef.current, webWorker.current]
	);

	const changeVelocity = useCallback(
		animationParamChangerFactory<A, number>(
			webWorker,
			animationRef.current,
			'velocity',
			(velocity) => {
				Object.assign({}, animationRef.current?.properties, {
					...animationRef.current?.properties,
					particleMaxVelocity: velocity || 0,
				});

				if (animationRef.current?.particles) {
					animationRef.current.particles = animationRef.current?.particles?.map(
						(item) => {
							const newVelocity = getVelocity(velocity || 0);
							return {
								...item,
								velocityX: newVelocity,
								velocityY: newVelocity,
							};
						}
					);
				}
			}
		),
		[animationRef.current, webWorker.current]
	);

	const changeLineLength = useCallback(
		animationParamChangerFactory<A, number>(
			webWorker,
			animationRef.current,
			'lineLength',
			(lineLength) => {
				Object.assign({}, animationRef.current?.properties, {
					...animationRef.current?.properties,
					lineLength: lineLength || 0,
				});
			}
		),
		[animationRef.current, webWorker.current]
	);

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
									animationRef.current as any,
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

	return [
		canvasRef,
		changeParticlesCount,
		changeRadius,
		changeVelocity,
		changeLineLength,
	];
};

export default useCanvas;
