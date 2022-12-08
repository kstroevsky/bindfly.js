import { ConstructorOf, IProperty, TAnimationProperties, TSomeAbstractClass, TSomeClass } from '../shared/types/index';
import { useEffect, useRef, useContext, SyntheticEvent, EventHandler, MouseEvent } from "react";
import DataContext, { IDataContext } from "../components/Context";
import { canvasClickHandler, canvasReload } from "../shared/utils";
import useForceUpdate from "./useForceUpdate";
import FlyingPoints from '../shared/2d/templates/FlyingPoints';
import FlyingLines from '../shared/2d/animations/FlyingLines';
import { getEventListeners } from 'events';

const useCanvas = <A extends ConstructorOf<any>>(Animation: A, animationParameters: TAnimationProperties) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { keyToggle, webWorker } = useContext<IDataContext>(DataContext)
  const reload = useForceUpdate()

  canvasReload(keyToggle, webWorker, canvasRef)

  useEffect(() => {
    if (canvasRef.current) {
      try {
        try {
          const worker: Worker = new Worker(
            new URL(
              "../shared/webAPI/web-workers/canvasWorker.js",
              import.meta.url
            )
          );

          webWorker.current = worker;

          const offscreen: OffscreenCanvas = canvasRef.current.transferControlToOffscreen();

          worker.postMessage(
            {
              msg: "init",
              canvas: offscreen,
              animationName: Animation.name,
              animationParameters: animationParameters
            },
            [offscreen]
          );

          if (
            animationParameters.properties.addByClick ||
            animationParameters.properties.switchByClick
          )
            canvasRef.current.onclick = (e) => {
              worker.postMessage({
                msg: "click",
                pos: { x: e.clientX - animationParameters.offset, y: e.clientY },
              });
            };

        } catch {
          const canvas = canvasRef.current;
          const ctx: CanvasRenderingContext2D | null = canvas.getContext("2d", { alpha: false });
          const animation: InstanceType<A> = new Animation(ctx, animationParameters);

          if (animationParameters.properties.addByClick ||
            animationParameters.properties.switchByClick
          ) canvas.onclick = ((e: MouseEvent<HTMLCanvasElement, MouseEvent>) => canvasClickHandler(animation, e, animationParameters.offset)) as EventHandler<HTMLCanvasElement>;

          animation?.init();

          return () => {
            animation.clear();
          };
        }
      } catch {
        reload()
      }
    }
  }, [Animation, animationParameters]);

  return canvasRef;
};

export default useCanvas;