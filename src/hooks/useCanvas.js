import { useEffect, useRef, useContext } from "react";
import { DataContext } from "../components/Context";
import { canvasClickHandler, canvasReload } from "../shared/utils";
import useForceUpdate from "./useForceUpdate";

const useCanvas = (Animation, animationParameters) => {
  const canvasRef = useRef(null);
  const { keyToggle, webWorker } = useContext(DataContext)
  const reload = useForceUpdate()

  canvasReload(keyToggle, webWorker, canvasRef)

  useEffect(() => {
    if (canvasRef.current) {
      try {
        try {
          const worker = new Worker(
            new URL(
              "../shared/webAPI/web-workers/canvasWorker.js",
              import.meta.url
            )
          );

          webWorker.current = worker;

          const offscreen = canvasRef.current.transferControlToOffscreen();

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
          const ctx = canvas.getContext("2d", { alpha: false });
          const animation = new Animation(ctx, animationParameters);

          if (
            animationParameters.properties.addByClick ||
            animationParameters.properties.switchByClick
          )
            canvas.onclick = (e) => {
              canvasClickHandler(animation, e, animationParameters.offset);
            };

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