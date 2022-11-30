import React, { useEffect, useRef } from "react";
import { canvasClickHandler } from "../utils";

export const useCanvas = (Animation, animationParameters) => {
  const workerRef = useRef(null);
  const canvasRef = useRef(null);
  //   const path = window.location.pathname;

  //   useEffect(() => {
  //     console.log(window.location.pathname);
  //     workerRef.current.terminate();
  //   }, [path]);

  useEffect(() => {
    workerRef.current = new Worker(
      new URL("../webAPI/workers/canvasWorker.js", import.meta.url)
    );

    if (canvasRef) {
      try {
        const offscreen = canvasRef.current.transferControlToOffscreen();

        workerRef.current.postMessage(
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
          document.addEventListener("click", (e) => {
            workerRef.current.postMessage({
              msg: "click",
              pos: { x: e.clientX, y: e.clientY },
            });
          });
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
          canvas.addEventListener("click", (e) => {
            canvasClickHandler(animation, e);
          });

        animation?.init();
      }
    }
  }, [Animation, animationParameters]);
  return canvasRef;
};
