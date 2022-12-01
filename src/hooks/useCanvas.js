import React, { useEffect, useRef, createRef } from "react";
import { canvasClickHandler } from "../utils";

export const useCanvas = (Animation, animationParameters) => {
  const workerRef = useRef(null);
  const offscreenRef = useRef(null);
  const canvasRef1 = useRef(null);
  const canvasRef2 = useRef(null);

  const getRef = () => {
    if (canvasRef1.current) {
      canvasRef1 = createRef(null)
      return canvasRef2;
    }

    canvasRef2 = createRef(null)
    return canvasRef1;
  }

  useEffect(() => {
    console.log([canvasRef1, canvasRef2])
    workerRef.current?.postMessage(
      {
        msg: "stop"
      },
      []
    );
    workerRef.current ??= new Worker(
      new URL("../webAPI/workers/canvasWorker.js", import.meta.url),
    );


    if (canvasRef1.current) {
      // console.log(canvasRef)
      try {
        const canvasRef = canvasRef1.current ? canvasRef2 : canvasRef1
        offscreenRef.current ??= canvasRef.current.transferControlToOffscreen();

        workerRef.current.postMessage(
          {
            msg: "init",
            canvas: offscreenRef.current,
            animationName: Animation.name,
            animationParameters: animationParameters,
          },
          [offscreenRef]
        );

        if (
          animationParameters.properties.addByClick ||
          animationParameters.properties.switchByClick
        )
          document.onclick = (e) => {
            workerRef.current.postMessage({
              msg: "click",
              pos: { x: e.clientX, y: e.clientY },
            });
          };


      } catch {
        const canvas = canvasRef1.current;
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
      }
    }


  }, [Animation, animationParameters]);

  return [canvasRef1, canvasRef2]
};
