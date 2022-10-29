export class Particle {
    constructor(w, h, properties, ctx) {
        this.particles = Array.from(new Array(properties.particleCount)).map(_ => {
            const velocity = Math.random()*(properties.particleMaxVelocity*2)-properties.particleMaxVelocity;

            return {
                ctx: ctx,
                x: Math.random()*w,
                y: Math.random()*h,
                velocityX: velocity,
                velocityY: velocity,
                life: Math.random()*properties.particleLife*60,
                position () {
                    this.x+=this.velocityX;
                    this.y+=this.velocityY;
                },
                reCalculateLife() {
                    if(this.life < 1){
                        this.x = Math.random() * w;
                        this.y = Math.random() * h;
                        this.velocityX = velocity;
                        this.velocityY = velocity;
                        this.life = Math.random() * properties.particleLife*60
                    }
                    this.life--;
                }
            }
        })

    }
}