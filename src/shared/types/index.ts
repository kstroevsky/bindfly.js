export type TypeByKeyExist<T, K1 extends string | number, K2 extends string | number> =
    T extends { [key in K1]: any }
    ? T[K1]
    : T extends { [key in K2]: any }
    ? T[K2]
    : never

export type GetKeyByExist<T, K1 extends string | number, K2 extends string | number> =
    T extends { [key in K1]: any }
    ? K1
    : T extends { [key in K2]: any }
    ? K2
    : never

export interface IProperty {
    [key: string]: IProperty[keyof IProperty]
    bgColor?: string,
    particleColors?: string[],
    generativeColorsCounts: number,
    particleCount: number,
    particleMaxVelocity: number,
    lineLength: number,
    particleLife: number,
    margin: number,
    isMonochrome: boolean,
    isCountStable: boolean,
    isImmortal: boolean,
    addByClick: boolean,
    switchByClick: boolean,
    isStatic: boolean
};

export type TProperties = IProperty[];

export interface IOutletContext {
    width: number
    isMobile: boolean
}

export interface ILongPressInitialTouch {
    start: number
    end: number
}

export type TPropertiesValues = IProperty[keyof IProperty]

export interface TAnimationProperties {
    properties: IProperty
    innerWidth: number
    innerHeight: number
    offset: number
}

export interface I2DAnimationBaseType<T extends object> {
    properties: T
    ctx: CanvasRenderingContext2D
    colorOffset: string
    sizes: {
        width: number
        height: number
    }
    boundAnimate: () => void
    loop: () => void
    isStarted: boolean
}

export type ISingleParticle = {
    isStart: boolean
    life: number
    position: ()=> void
    reCalculateLife: ()=> void
    start: number
    velocityX: number
    velocityY: number
    x: number
    y: number
}

export type IAnimationWithParticles<A extends object> = I2DAnimationBaseType<A> & {
    particles: ISingleParticle[]
}

export type TSomeAbstractClass<T> = new (...args: any[]) => T;

export type TSomeClass<T> = new (...args: any[]) => T;

export type ConstructorOf<T> = { new(...args: any[]): T };

export interface WorkerClickData {
    x: number
    y: number
}

export type TKeys<O extends object> = keyof O