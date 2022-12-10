import { MutableRefObject } from "react";
import { IDataContext } from "../../components/Context";

import { TOUCH_EXPIRATION } from "../constants";
import { IAnimationWithParticles, IProperty, ISingleParticle, TPropertiesValues, WorkerClickData } from "../types";

export const getPosition = (
    position: number,
    size: number,
    velocity: number,
    margin: number
): number =>
    velocity * (((position + velocity > size - margin && velocity > 0)
        || (position + velocity < margin && velocity < margin)) ? -1 : 1);

export const canvasClickHandler = <A extends IAnimationWithParticles<IProperty>>(
    animation: A,
    e: { pos: WorkerClickData },
    offset: number = 0
) => {
    if (animation.properties.addByClick) {
        animation.particles.push(
            Object.assign({}, {
                ...animation.particles[0],
                x: e.pos.x - offset,
                y: e.pos.y,
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
            if (animation.colorOffset) animation.colorOffset += 1
        }
    }

    animation.properties.switchByClick && animation.particles.push(animation.particles.shift() as ISingleParticle)
}

export const canvasReload = (
    toggle: IDataContext['keyToggle'],
    webWorker: IDataContext['webWorker'],
    canvasRef: MutableRefObject<HTMLCanvasElement | null>
): void => {
    if (webWorker) {
        webWorker?.current?.postMessage({ msg: "stop" })
        webWorker?.current?.terminate()
        webWorker.current = null
    }
    if (canvasRef) canvasRef.current = null
    if (toggle) toggle.current = !toggle?.current
}

export const isLayoutActive = (start: number, end: number): boolean => !!end && (end - start >= TOUCH_EXPIRATION)

export const getMediaMatches = (query: string): boolean => typeof window !== 'undefined' && window.matchMedia(query).matches

export const RGBAToHexA = (rgbaString: string, forceRemoveAlpha: boolean = false): string =>
    "#" + rgbaString.replace(/^rgba?\(|\s+|\)$/g, '')
        .split(',').slice(0, 3 + +forceRemoveAlpha)
        .map((string, index) => {
            const number = parseFloat(string)

            return (
                index === 3
                    ? Math.round(number * 255)
                    : number
            ).toString(16)
        })
        .reduce((acc, item) => acc + (item.length === 1 ? `0${item}` : item), "")

export const parametersToString = (value: TPropertiesValues | TPropertiesValues[]): string => {
    switch (true) {
        case Array.isArray(value):
            return (value as TPropertiesValues[]).map(parametersToString).join(", ")
        case /rgb/g.test(value as string):
            return RGBAToHexA(value as string)
        case typeof value == "boolean":
        default:
            return value!.toString()
    }
}