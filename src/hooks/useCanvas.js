import { useEffect, useRef, useContext } from "react";
import DataContext from "../components/Context";
import { canvasClickHandler } from "../utils";

export const useCanvas = (Animation, animationParameters) => {
  const canvasRef = useRef(null);
  const { webWorker } = useContext(DataContext)

  useEffect(() => {
    if (canvasRef.current) {
      try {
        const worker = new Worker(
          new URL("../shared/webAPI/web-workers/canvasWorker.js", import.meta.url),
        );

        webWorker.current = worker;

        const offscreen = canvasRef.current.transferControlToOffscreen();

        worker.postMessage(
          {
            msg: "init",
            canvas: offscreen,
            animationName: Animation.name,
            animationParameters: animationParameters,
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
              pos: { x: e.clientX, y: e.clientY },
            });
          };

      } catch {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d", { alpha: false });

        canvas.width = animationParameters.innerWidth;
        canvas.height = animationParameters.innerHeight;

        const animation = new Animation(ctx, animationParameters);

        if (
          animationParameters.properties.addByClick ||
          animationParameters.properties.switchByClick
        )
          canvas.onclick = (e) => {
            canvasClickHandler(animation, e);
          };

        animation?.init();

        return () => {
          animation.clear()
        }
      }
    }


  }, [Animation, animationParameters]);

  return canvasRef
};
