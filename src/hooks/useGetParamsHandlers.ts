import { useCallback } from 'react';
import type { MutableRefObject } from 'react';

import { animationParamChangerFactory } from '../shared/HOF';
import { ECanvasWorkerMessage } from '../shared/constants';
import { changeAlpha } from '../shared/utils/color-helpers';
import {
	canvasParticlesCountChange,
	getVelocity,
} from '../shared/utils/canvas-helpers';

import type CanvasAnimation from '../shared/abstract/canvas';
import type { TParamsHandlers } from '../shared/types';

const useGetParamsHandlers = <A extends object>(
	webWorker: MutableRefObject<Worker | null>,
	animationRef: MutableRefObject<
		(CanvasAnimation & Omit<A, 'prototype'>) | null
	>
): TParamsHandlers => {
	const changeParticlesCount = useCallback(
		animationParamChangerFactory<A, number>(
			webWorker,
			animationRef.current,
			ECanvasWorkerMessage.COUNT,
			canvasParticlesCountChange
		),
		[animationRef.current, webWorker.current]
	);

	const changeRadius = useCallback(
		animationParamChangerFactory<A, number>(
			webWorker,
			animationRef.current,
			ECanvasWorkerMessage.RADIUS,
			(radius) => {
				if (animationRef.current) {
					animationRef.current.spiralRadius = radius || 0;
				}
			}
		),
		[animationRef.current, webWorker.current]
	);

	const changeBgColor = useCallback(
		animationParamChangerFactory<A, number>(
			webWorker,
			animationRef.current,
			ECanvasWorkerMessage.ALPHA,
			(bgColor) => {
				if (animationRef.current) {
					animationRef.current.properties.bgColor = changeAlpha(
						animationRef.current.properties.bgColor,
						bgColor || 0
					);
				}
			}
		),
		[animationRef.current, webWorker.current]
	);

	const changeParticleMaxVelocity = useCallback(
		animationParamChangerFactory<A, number>(
			webWorker,
			animationRef.current,
			ECanvasWorkerMessage.VELOCITY,
			(velocity) => {
				if (animationRef.current) {
					animationRef.current.properties.particleMaxVelocity = velocity || 0;
				}

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
			ECanvasWorkerMessage.LENGTH,
			(lineLength) => {
				if (animationRef.current) {
					animationRef.current.properties.lineLength = lineLength || 0;
				}
			}
		),
		[animationRef.current, webWorker.current]
	);

	const changeWeight = useCallback(
		animationParamChangerFactory<A, number>(
			webWorker,
			animationRef.current,
			ECanvasWorkerMessage.WEIGHT,
			(weight) => {
				if (animationRef.current) {
					animationRef.current.properties.weight = weight || 0;
				}
			}
		),
		[animationRef.current, webWorker.current]
	);

	return {
		changeParticlesCount,
		changeRadius,
		changeParticleMaxVelocity,
		changeLineLength,
		changeBgColor,
		changeWeight
	};
};

export default useGetParamsHandlers;
