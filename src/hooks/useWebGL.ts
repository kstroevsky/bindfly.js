import { useRef, useEffect } from 'react';
import * as THREE from 'three';

import { ConstructorOf, TAnimationProperties } from './../shared/types/index';
import CanvasAnimation from '../shared/abstract/canvas';

const useWebGL = <A extends object>(
	Animation: A extends ConstructorOf<CanvasAnimation & Omit<A, 'prototype'>>
		? A
		: A,
	animationParameters: TAnimationProperties
) => {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);

	useEffect(() => {
		if (canvasRef.current) {
			const camera = new THREE.PerspectiveCamera(
				75,
				animationParameters.innerWidth / animationParameters.innerHeight,
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
				animationParameters.innerWidth,
				animationParameters.innerHeight
			);
			renderer.setPixelRatio(window.devicePixelRatio);
			renderer.setClearColor(0x666666, 1);

			const scene = new THREE.Scene();
			scene.fog = new THREE.Fog(0xffffff, 0, 750);
			scene.scale.set(
				animationParameters.devicePixelRatio,
				animationParameters.devicePixelRatio,
				animationParameters.devicePixelRatio
			);

			const flyingLines = new Animation(
				renderer,
				camera,
				scene,
				animationParameters
			);
			flyingLines.init();
		}
	}, [animationParameters, canvasRef.current]);

	return canvasRef;
};

export default useWebGL;
