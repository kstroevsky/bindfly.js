import { IDataContext } from "./types";



export const getPosition = (position: number, size: number, velocity: number, margin: number):number => {
  return (
    velocity *
    ((position + velocity > size - margin && velocity > 0) ||
    (position + velocity < margin && velocity < margin)
      ? -1
      : 1)
  );
};

export const canvasClickHandler = <A>(animation:A, e) => {
  if (animation.properties.addByClick) {
    animation.particles.push(
      Object.assign(
        {},
        {
          ...animation.particles[0],
          x: e.data?.pos.x || e.clientX,
          y: e.data?.pos.y || e.clientY,
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
      animation.colorOffset++;
    }
  }
  animation.properties.switchByClick &&
    animation.particles.push(animation.particles.shift());
};



export const canvasReload = (...args) => {
  webWorker?.postMessage({ msg: "stop" });
  toggle.current = !toggle.current;
};
