export const getPosition = (position, size, velocity, margin) => {
    return velocity*(((position + velocity > size - margin && velocity > 0) || (position + velocity < margin && velocity < margin)) ? -1 : 1);
}

export const canvasClickHandler = (animation, e) => {
    if (animation.properties.addByClick) {
        animation.particles.push(
            Object.assign({}, {
                ...animation.particles[0],
                x: e.data.pos.x,
                y: e.data.pos.y,
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