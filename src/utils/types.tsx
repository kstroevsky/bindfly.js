export interface IProperty {
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

export interface IDataContext {
    keyToggle?: React.MutableRefObject<boolean>,
    webWorker?: Worker | null
}

export interface IAnimation{
    properties: IProperty
}

