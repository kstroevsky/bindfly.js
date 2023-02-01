import { useRef, useEffect, useCallback } from 'react';
import type { MutableRefObject } from 'react';
import * as THREE from 'three';

import FlyingPointsGL from '../shared/2d/templates/FlyingPointsGL';
import { canvasParticlesCountChange } from '../shared/utils';
import type CanvasAnimation from '../shared/abstract/canvas';
import type {
	ConstructorOf,
	TAnimationProperties,
	TCallable,
} from './../shared/types/index';

const useWebGL = (
	Animation: ConstructorOf<CanvasAnimation>,
	animationParameters: TAnimationProperties
): [
	MutableRefObject<HTMLCanvasElement | null>,
	TCallable<void, number>,
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
			if (animationRef.current?.particles) {
				Object.assign({}, animationRef.current?.properties, {
					...animationRef.current?.properties,
					particleMaxVelocity: velocity,
				});

				animationRef.current.particles = animationRef.current?.particles?.map(
					(item) => {
						const newVelocity = (
							Math.random() * (velocity * 1.5) -
							velocity
						).toFixed(2);
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

	const changeLineLength = useCallback(
		(lineLength: number) => {
			if (animationRef.current) {
				animationRef.current.properties.lineLength = lineLength || 0;
			}
		},
		[animationRef.current]
	);

	useEffect(() => {
		if (canvasRef.current) {
			const camera = new THREE.PerspectiveCamera(
				75,
				canvasRef.current.width / canvasRef.current.height,
				0.1,
				1000
			);
			camera.position.z = 5;

			const rendererParams = {
				canvas: canvasRef.current,
				alpha: false,
				antialias: false,
			};

			const renderer = THREE.WebGL1Renderer
				? new THREE.WebGL1Renderer(rendererParams)
				: new THREE.WebGLRenderer(rendererParams);

			renderer.setSize(
				canvasRef.current.width,
				canvasRef.current.height,
				false
			);
			renderer.setPixelRatio(window.devicePixelRatio);
			renderer.setClearColor(0x000, 1);

			const scene = new THREE.Scene();
			scene.fog = new THREE.Fog(0x000, 0.015, 2);
			scene.scale.set(2, 2, 2);

			animationRef.current = new Animation(
				renderer,
				camera,
				scene,
				animationParameters
			);

			animationRef.current.init();

			if (animationParameters.properties.addByClick) {
				canvasRef.current.onclick = (e) =>
					animationRef.current?.particles?.push({
						...animationRef.current?.particles[1],
						x:
							-animationParameters.innerWidth / 2 +
							animationParameters.offset / 2 +
							e.offsetX,
						y: animationParameters.innerHeight / 2 - e.offsetY,
					});
			}

			return () => {
				animationRef.current?.clear();
				animationRef.current = null;
			};
		}
	}, [animationParameters, canvasRef.current]);

	return [canvasRef, changeParticlesCount, changeVelocity, changeLineLength];
};

export default useWebGL;
