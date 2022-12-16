import { useContext, useEffect, useRef } from 'react';
import DataContext, { IDataContext } from '../components/Context';
import { ConstructorOf, TAnimationProperties } from '../shared/types/index';
import { canvasClickHandler, canvasReload } from '../shared/utils';
import useForceUpdate from './useForceUpdate';
// import Worker from 'web-worker';

const useCanvas = <A extends ConstructorOf<any>>(
	Animation: A,
	animationParameters: TAnimationProperties
) => {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const { keyToggle, webWorker } = useContext<IDataContext>(DataContext);
	const reload = useForceUpdate();

	canvasReload(keyToggle, webWorker, canvasRef);

	useEffect(() => {
		// console.log(new URL(`${window.location.origin}/WebApi/workers/canvasWorker.js`));

		if (canvasRef.current) {
			try {
				try {
					const worker: Worker = new Worker(
						new URL(`${window.location.origin}/WebApi/workers/canvasWorker.js`),
						{
							type: 'module'
						}
					);

					// console.log({ worker });

					webWorker.current = worker;

					const offscreen: OffscreenCanvas =
						canvasRef.current.transferControlToOffscreen();

					worker.postMessage(
						{
							msg: 'init',
							canvas: offscreen,
							animationName: Animation.name,
							animationParameters,
							canvasClickHandler
						},
						[offscreen]
					);

					if (
						animationParameters.properties.addByClick ||
						animationParameters.properties.switchByClick
					)
						canvasRef.current.onclick = (e) => {
							worker.postMessage({
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

					const animation: InstanceType<A> = new Animation(ctx, animationParameters);

					if (
						animationParameters.properties.addByClick ||
						animationParameters.properties.switchByClick
					)
						canvas.onclick = (e: any): void => {
							canvasClickHandler(animation, e, animationParameters.offset);
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
