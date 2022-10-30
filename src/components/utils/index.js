export const getPosition = (position, size, velocity, margin) => {
    const nextMove = position + velocity
    return velocity * (((velocity < 0 ? nextMove < margin : nextMove > size) && -1) || 1)
}