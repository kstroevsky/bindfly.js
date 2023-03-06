import { ECanvasWorkerMessage } from '../constants';

/* =================================== */
/* CUSTOM UTILITY TYPES */
/* =================================== */

export type TFirstExistKey<T, K extends (string | number)[]> = {
	[I in keyof K]: K[I] extends keyof T ? K[I] : never;
}[keyof K];

export type TypeByKeyExist<
	O extends object,
	K extends (string | number)[]
> = O[TFirstExistKey<O, K>];

export type TKeys<O extends object> = keyof O;

export type TValues<O extends object> = O[TKeys<O>];

export type TCallable<R = void, A = unknown> = (...args: A[]) => R;

export type TAbstractClass<T> = abstract new (...args: unknown[]) => T;

export type TConstructorOf<T = unknown> = new (...args: unknown[]) => T;

export type TNamespace<C> = C extends { [key: string]: infer T }
	? T
	: Partial<C>;

export type TClassesNamespace<N extends TNamespace<object>> = N extends object
	? {
		[K in keyof N]: N[K] extends TConstructorOf ? K : never;
	}
	: never;

export type TClassesNames<N extends TNamespace<object>> = N extends object
	? Array<keyof TClassesNamespace<N>>[number]
	: never;

/* =================================== */
/* APPLICATION TYPES */
/* =================================== */

export interface IProperty {
	[key: string]: IProperty[keyof IProperty];
	name: string;
	for?: string | string[];
	bgColor: string;
	particleColors?: string[];
	generativeColorsCounts: number;
	particlesCount: number;
	particleMaxVelocity: number;
	lineLength: number;
	particleLife: number;
	margin: number;
	radius?: number;
	reverse?: boolean;
	isPulsative?: boolean;
	isMonochrome: boolean;
	isCountStable: boolean;
	isImmortal: boolean;
	addByClick: boolean;
	switchByClick: boolean;
	moveByClick?: boolean;
	isStatic: boolean;
	weight?: number;
}

export type TProperties = IProperty[];

export type TParamsHandlersNames = Partial<
	keyof Pick<
		IProperty,
		| 'particlesCount'
		| 'lineLength'
		| 'particleMaxVelocity'
		| 'radius'
		| 'bgColor'
		| 'weight'
	>
>;

export type TParamHandleChangeName<N extends string> = `change${Capitalize<N>}`;

export type TParamsHandlers = Record<
	TParamHandleChangeName<TParamsHandlersNames>,
	TCallable<void, number>
>;

export interface IAnimationHandlerConfig<T extends string, I = any> {
	name: TParamsHandlersNames;
	visibility: T[];
	step: number;
	min: number;
	getMax: (initialValue: number) => number;
	visibilityChecking?: (properties: IProperty) => boolean;
	valueEncoder?: (value: I) => number;
}

export interface IOutletContext {
	width: number;
	isMobile: boolean;
}

export interface ILongPressInitialTouch {
	start: number;
	end: number;
}

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
	reInit?: (x: number, y: number) => void;
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

export type IAnimationWithParticles<A extends object> =
	I2DAnimationBaseType<A> & {
		particles: ISingleParticle[];
	};

export interface WorkerClickData {
	x: number;
	y: number;
}

export interface ICanvasWorkerProps {
	msg: ECanvasWorkerMessage;
	canvas: OffscreenCanvas;
	animationName: string;
	animationParameters: TAnimationProperties;
	[ECanvasWorkerMessage.COUNT]?: number;
	[ECanvasWorkerMessage.RADIUS]?: number;
	[ECanvasWorkerMessage.VELOCITY]?: number;
	[ECanvasWorkerMessage.LENGTH]?: number;
	[ECanvasWorkerMessage.ALPHA]?: number;
	[ECanvasWorkerMessage.WEIGHT]?: number;
}

export interface IVectorsForIntersect {
	[key: string]: number;
}
