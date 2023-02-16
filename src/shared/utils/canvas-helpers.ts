import { FlyingPoints } from '../2d/templates';
import { RGBAToNegative } from './color-helpers';
import type CanvasAnimation from '../abstract/canvas';
import type { IDataContext } from '../../components/Context';
import type {
	IAnimationWithParticles,
	IProperty,
	WorkerClickData,
	ISingleParticle,
	TConstructorOf,
} from '../types';
import type { MutableRefObject } from 'react';

export const getPosition = (
	position: number,
	size: number,
	velocity: number,
	margin: number
): number =>
	velocity *
	((position + velocity > size - margin && velocity > 0) ||
	(position + velocity < margin && velocity < margin)
		? -1
		: 1);

export const getPositionGL = (
	position: number,
	size: number,
	velocity: number,
	margin: number
): number => {
	const isVelocityPositive = velocity > 0;

	return (
		velocity *
		((
			position > 0
				? position + velocity > size - margin && isVelocityPositive
				: position + velocity < -size + margin && !isVelocityPositive
		)
			? -1
			: 1)
	);
};

// velocity *
// 		((position - velocity < -size - margin && velocity > 0) ||
// 		(position + velocity > margin && velocity < margin)
// 			? -1
// 			: 1)

export const getVelocity = (maxVelocity: number) =>
	Math.random() * (maxVelocity * 2) - maxVelocity;

export const canvasReload = <A extends object>(
	toggle: IDataContext['keyToggle'],
	webWorker: IDataContext['webWorker'],
	canvasRef: MutableRefObject<HTMLCanvasElement | null>,
	animationRef: MutableRefObject<
		(CanvasAnimation & Omit<A, 'prototype'>) | null
	>
): void => {
	if (animationRef) animationRef.current = null;
	if (webWorker) {
		webWorker?.current?.postMessage({ msg: 'stop' });
		webWorker?.current?.terminate();
		webWorker.current = null;
	}
	if (canvasRef) canvasRef.current = null;
	if (toggle) toggle.current = !toggle?.current;
};

export const canvasClickHandler = <
	A extends IAnimationWithParticles<IProperty>
>(
	animation: A,
	e: { pos: WorkerClickData },
	offset = 0
) => {
	if (animation.properties.moveByClick) animation.reInit?.(e.pos.x, e.pos.y);
	if (animation.properties.addByClick) {
		animation.particles.push(
			Object.assign(
				{},
				{
					...animation.particles[0],
					life: Math.random() * animation.properties.particleLife * 60,
					x: e.pos.x - offset,
					y: e.pos.y,
					isStart: true,
					start: 0,
				}
			)
		);
		if (animation.properties.isStatic) {
			if (!animation.isStarted) {
				animation.isStarted = true;
				animation.loop();
			}
		}
		if (animation.properties.isCountStable) {
			animation.particles.shift();
			if (animation.colorOffset) animation.colorOffset += 1;
		}
	}

	animation.properties.switchByClick && animation.properties.isMonochrome
		? (animation.properties.bgColor = RGBAToNegative(
				animation.properties.bgColor || 'rgba(255, 255, 255, 1)'
		  ))
		: animation.particles.push(animation.particles.shift() as ISingleParticle);
};

export const canvasParticlesCountChange = (
	count: number,
	animation: CanvasAnimation,
	Template: TConstructorOf<any> = FlyingPoints
) => {
	const particlesCount = animation?.particles?.length || 0;

	if (count < particlesCount) {
		animation?.particles?.splice(0, particlesCount - count);
	} else {
		animation?.particles?.push(
			...new Template(animation?.sizes?.width, animation?.sizes?.height, {
				...animation?.properties,
				particlesCount: count - particlesCount,
			}).particles
		);
	}
};
