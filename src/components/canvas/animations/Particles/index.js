import {Particle} from './Particle'

class Particles {
    constructor(ctx, parameters) {
        this.ctx = ctx;
        this.properties = parameters.properties;
        this.particles = [];
        this.sizes={
            w: parameters.innerWidth,
            h: parameters.innerHeight
        }
        this.boundAnimate = this.loop.bind(this);
    }

    reDrawBackground() {
         this.ctx.fillStyle = this.properties.bgColor;
         this.ctx.fillRect(0, 0, this.sizes.w, this.sizes.h);
    }

     drawLines() {
        let x1, y1,x2, y2, length, opacity;
        for (let i in this.particles) {
            for (let j in this.particles){
                x1 = this.particles[i].rect.x;
                y1 = this.particles[i].rect.y;
                x2 = this.particles[j].rect.x;
                y2 = this.particles[j].rect.y;
                length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
                if(length < this.properties.lineLength) {
                    opacity = 1-length/this.properties.lineLength;
                    this.ctx.lineWidth = 0.5;
                    this.ctx.strokeStyle = 'rgba(255, 40, 40, '+opacity+')';
                    this.ctx.beginPath();
                    this.ctx.moveTo(x1, y1);
                    this.ctx.lineTo(x2, y2);
                    this.ctx.closePath();
                    this.ctx.stroke()
                }
            }
        }
    }

    reDrawParticles() {
        for(let i in this.particles){
            this.particles[i].reCalculateLife();
            this.particles[i].position();
            this.particles[i].reDraw();
        }
    }

    loop() {
        this.reDrawBackground();
        this.reDrawParticles();
        this.drawLines();
        requestAnimationFrame(this.boundAnimate);
    }

     init() {
        for (let i = 0; i<this.properties.particleCount; i++){
            this.particles.push(new Particle(this.sizes.w, this.sizes.h, this.properties, this.ctx));
        }
    }

    clear() {this.particles = []}
}

export {Particles}