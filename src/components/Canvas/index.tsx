import React, { CSSProperties, forwardRef } from 'react';

export interface ICanvasProps {
	width: number;
	height: number;
	style?: CSSProperties;
	props?: unknown[];
}

export const Canvas = forwardRef<HTMLCanvasElement, ICanvasProps>(
	({ style, width, height, ...props }, ref) => (
		<canvas
			ref={ref}
			id={'canvas'}
			style={style}
			width={width}
			height={height}
			{...props}
		/>
	)
);
