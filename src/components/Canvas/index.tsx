import React, { forwardRef } from 'react';



export const Canvas = forwardRef(({ style, width, height, ...props }, ref) => (
    <canvas
        ref={ref}
        style={style}
        width={width}
        height={height}
        {...props}
    />
));