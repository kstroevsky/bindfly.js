import {getPosition} from '../../../utils'

export class Particle {
    constructor(w, h, properties) {
        this.particles = Array.from(new Array(properties.particleCount)).map(_ => {
            const velocity = Math.random()*(properties.particleMaxVelocity*2)-properties.particleMaxVelocity;

            return {
                x: Math.random()*w,
                y: Math.random()*h,
                velocityX: velocity,
                velocityY: velocity,
                life: Math.random()*properties.particleLife*60,
                isStart: false,
                start: 0,
                position () {
                    this.x += getPosition(this.x, w - properties.margin, this.velocityX, properties.margin)
                    this.y += getPosition(this.y, h - properties.margin, this.velocityY, properties.margin)
                },
                reCalculateLife() {
                    if (!properties.isImmortal) {
                        if (this.life < 1) {
                            this.x = Math.random() * w;
                            this.y = Math.random() * h;
                            this.velocityX = velocity;
                            this.velocityY = velocity;
                            this.life = Math.random() * properties.particleLife*60
                        }
                        if (this.start >= 1) this.isStart = false
                        this.life--;
                    }
                },
                reCalculcateLifeWithNew() {
                    if (!properties.isImmortal) {
                        if (this.life < 1) {
                            this.x = Math.random() * w;
                            this.y = Math.random() * h;
                            this.velocityX = velocity;
                            this.velocityY = velocity;
                            this.life = Math.random() * properties.particleLife*60
                        }
                        if (this.start >= 1) this.isStart = false
                        this.life--;
                    }
                    if (this.isStart) this.start = this.start + 0.0001
                },
                calcColor(opacity, min, max, val) {
                    const minHue = 240, maxHue = 0;
                    return `hsla(${(((val - min) / (max-min) * (maxHue-minHue) ) + minHue)}, 100%, 50%, ${opacity})`;
                },
                getColor(index, opacity, colorVar) {
                    return properties.isMonochrome
                        ? `rgba(${index % 2 === 0 ? '0, 0, 0' : '255, 255, 255'}, ${opacity})`
                        : (this.isParticleColors && properties.particleColors[index % properties.particleColors.length].replace(/(?<=rgba.*)\d+(?=\)$)/, opacity))
                            || this.calcColor(opacity, 0, 100, colorVar);
                }
            }
        })

    }
}