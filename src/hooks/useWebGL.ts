import { useRef, useEffect, useCallback } from 'react';
import type { MutableRefObject } from 'react';
import * as THREE from 'three';

import FlyingPointsGL from '../shared/2d/templates/FlyingPointsGL';
import { canvasParticlesCountChange, getVelocity } from '../shared/utils';
import type CanvasAnimation from '../shared/abstract/canvas';
import type {
	ConstructorOf,
	TAnimationProperties,
	TCallable,
} from './../shared/types/index';

const useWebGL = <A extends ConstructorOf<CanvasAnimation>>(
	Animation: ConstructorOf<CanvasAnimation>,
	animationParameters: TAnimationProperties
): [
	MutableRefObject<HTMLCanvasElement | null>,
	TCallable<void, number>,
	TCallable<void, number>
] => {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const animationRef = useRef<CanvasAnimation | null>();

	const changeParticlesCount = useCallback(
		(count: number) => {
			animationRef.current &&
				canvasParticlesCountChange(count, animationRef.current, FlyingPointsGL);
		},
		[animationRef.current]
	);

	const changeVelocity = useCallback(
		(velocity: number) => {
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
		},
		[animationRef.current]
	);

	useEffect(() => {
		if (canvasRef.current) {
			const { devicePixelRatio } = animationParameters;

			const camera = new THREE.PerspectiveCamera(
				75,
				canvasRef.current.width / canvasRef.current.height,
				0.1,
				1000
			);
			camera.position.z = 5;

			const renderer = new THREE.WebGLRenderer({
				canvas: canvasRef.current,
				alpha: true,
				antialias: true,
			});

			renderer.setSize(
				canvasRef.current.width,
				canvasRef.current.height,
				false
			);
			renderer.setPixelRatio(window.devicePixelRatio);
			renderer.setClearColor(0x666666, 1);

			const scene = new THREE.Scene();
			scene.fog = new THREE.Fog(0xffffff, 0, 750);
			scene.scale.set(2, 2, 2);

			animationRef.current = new Animation(
				renderer,
				camera,
				scene,
				animationParameters
			);

			animationRef.current.init();

			return () => {
				animationRef.current?.clear();
			};
		}
	}, [animationParameters, canvasRef.current]);

	return [canvasRef, changeParticlesCount, changeVelocity];
};

export default useWebGL;
