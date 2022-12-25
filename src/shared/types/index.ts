export type TypeByKeyExist<
	T,
	K1 extends string | number,
	K2 extends string | number
> = T extends { [key in K1]: unknown }
	? T[K1]
	: T extends { [key in K2]: unknown }
	? T[K2]
	: never;

export type GetKeyByExist<
	T,
	K1 extends string | number,
	K2 extends string | number
> = T extends { [key in K1]: unknown }
	? K1
	: T extends { [key in K2]: unknown }
	? K2
	: never;

export interface IProperty {
	[key: string]: IProperty[keyof IProperty];
	name: string;
	for?: string | string[];
	bgColor?: string;
	particleColors?: string[];
	generativeColorsCounts: number;
	particleCount: number;
	particleMaxVelocity: number;
	lineLength: number;
	particleLife: number;
	margin: number;
	radius?: number;
	reverse?: boolean;
	isPulsatile?: boolean;
	isMonochrome: boolean;
	isCountStable: boolean;
	isImmortal: boolean;
	addByClick: boolean;
	switchByClick: boolean;
	moveByClick?: boolean;
	isStatic: boolean;
}

export type TProperties = IProperty[];

export interface IOutletContext {
	width: number;
	isMobile: boolean;
}

export interface ILongPressInitialTouch {
	start: number;
	end: number;
}

export type TPropertiesValues = IProperty[keyof IProperty];

export interface TAnimationProperties {
	properties: IProperty;
	innerWidth: number;
	innerHeight: number;
	devicePixelRatio: number;
	offset: number;
}

export interface I2DAnimationBaseType<T extends object> {
	properties: T;
	ctx: CanvasRenderingContext2D;
	colorOffset: string;
	sizes: {
		width: number;
		height: number;
	};
	boundAnimate: () => void;
	loop: () => void;
	reInit?: (x: number, y: number) => void
	clear: () => void;
	isStarted: boolean;
}

export type ISingleParticle = {
	isStart: boolean;
	life: number;
	position: () => void;
	reCalculateLife: () => void;
	start: number;
	velocityX: number;
	velocityY: number;
	x: number;
	y: number;
};

export type IAnimationWithParticles<A extends object> = I2DAnimationBaseType<A> & {
	particles: ISingleParticle[];
};

export interface IunknownInterface {
	[otherOptions: string]: unknown;
}

export type TSomeAbstractClass<T> = new (...args: unknown[]) => T;

export type TSomeClass<T> = new (...args: unknown[]) => T;

export type ConstructorOf<T> = { new (...args: unknown[]): T };

export interface WorkerClickData {
	x: number;
	y: number;
}

export type TKeys<O extends object> = keyof O;

export interface ICanvasWorkerProps {
	msg: 'init' | 'click' | 'stop';
	canvas: OffscreenCanvas;
	animationName: string;
	animationParameters: TAnimationProperties;
}

export interface IVectorsForIntersect {
	[key: string]: number
}
