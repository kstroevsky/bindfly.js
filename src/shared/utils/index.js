import { TOUCH_EXPIRATION } from "../constants";

export const getPosition = (position, size, velocity, margin) => {
    return velocity * (((position + velocity > size - margin && velocity > 0) || (position + velocity < margin && velocity < margin)) ? -1 : 1);
}

export const canvasClickHandler = (animation, e, offset = 0) => {
    if (animation.properties.addByClick) {
        animation.particles.push(
            Object.assign({}, {
                ...animation.particles[0],
                x: e.data?.pos.x || e.clientX - offset,
                y: e.data?.pos.y || e.clientY,
                isStart: true,
                start: 0,
            })
        )
        if (animation.properties.isStatic) {
            if (!animation.isStarted) {
                animation.isStarted = true;
                animation.loop()
            }
        }
        if (animation.properties.isCountStable) {
            animation.particles.shift()
            animation.colorOffset++
        }
    }
    animation.properties.switchByClick && animation.particles.push(animation.particles.shift())
}

export const canvasReload = (toggle, webWorker) => {
    webWorker?.postMessage({ msg: "stop" })
    toggle.current = !toggle.current
}

export const resizeCanvasToDisplaySize = (canvas, w, h) => {
    const { clientWidth, clientHeight } = canvas;

    if (canvas.width !== clientWidth || canvas.height !== clientHeight) {
        if (w) canvas.width = clientWidth;
        if (h) canvas.height = clientHeight;
        return true;
    }

    return false;
}

export const isLayoutActive = (start, end) => !!end && (end - start >= TOUCH_EXPIRATION)

export const getMediaMatches = (query) => typeof window !== 'undefined' && window.matchMedia(query).matches

export const RGBAToHexA = (rgba, forceRemoveAlpha = false) =>
    "#" + rgba.replace(/^rgba?\(|\s+|\)$/g, '')
        .split(',')
        .slice(0, 3 + forceRemoveAlpha)
        .map((string, index) => {
            const number = parseFloat(string)

            return (
                index === 3
                    ? Math.round(number * 255)
                    : number
            ).toString(16)
        })
        .reduce((acc, item) => acc + (item.length === 1 ? `0${item}` : item), "")

export const parametersToString = (value) => {
    switch (true) {
        case Array.isArray(value):
            return value.map(parametersToString).join(", ")
        case /rgb/g.test(value):
            return RGBAToHexA(value)
        case typeof value == "boolean":
            return value.toString()
        default:
            return value
    }
}