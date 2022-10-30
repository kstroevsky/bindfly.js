import {Particle} from './Particle'

class Particles {
    constructor(ctx, parameters) {
        this.ctx = ctx;
        this.properties = parameters.properties;
        this.isParticleColors = parameters.properties.particleColors && parameters.properties.particleColors.length;
        this.particles = [];     
        this.sizes={
            w: parameters.innerWidth,
            h: parameters.innerHeight
        }
        this.color = this.properties.switchByClick
            ? this.properties.isMonochrome
                ? this.monochrome
                : this.isParticleColors
                    ? this.propsColors
                    : this.defaultColors
            : this.defaultSwitchableColors   
        this.drawLines = this.properties.addByClick ? this.drawLinesWithAdding : this.drawLinesWithoutAdding
        this.boundAnimate = this.loop.bind(this);
    }

    monochrome(i, opacity) {
        return `rgba(${i % 2 === 0 ? '0, 0, 0' : '255, 255, 255'}, ${opacity})` 
    }

    propsColors(i, opacity) {
        return this.properties.particleColors[i % this.properties.particleColors.length].replace(/(?<=rgba.*)\d+(?=\)$)/, opacity)
    }

    defaultSwitchableColors(i, opacity, x1) {
        return this.particles[i].getColor(i, opacity, x1)
    }

    defaultColors(i, opacity, x1) {
        return this.particles[i].calcColor(opacity, 0, 100, x1)
    }

    reDrawBackground() {
         this.ctx.fillStyle = this.properties.bgColor;
         this.ctx.fillRect(0, 0, this.sizes.w, this.sizes.h);
    }

    drawLinesWithoutAdding() {
        let x1, y1,x2, y2, length;

        for (let i in this.particles) {
            this.particles[i].reCalculateLife();
            this.particles[i].position();
            x1 = this.particles[i].x;
            y1 = this.particles[i].y;
            
            for (let j in this.particles){
                x2 = this.particles[j].x;
                y2 = this.particles[j].y;
                length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)).toFixed(3)

                if (length < this.properties.lineLength) {
                    this.ctx.lineWidth = 0.5;
                    this.ctx.strokeStyle = this.color(i, 1 - length/this.properties.lineLength, x1)
                    this.ctx.beginPath();
                    this.ctx.moveTo(x1, y1);
                    this.ctx.lineTo(x2, y2);
                    this.ctx.stroke()
                }
            }
        }
    }

    drawLinesWithAdding() {
        let x1, y1,x2, y2, length, opacity;

        for (let i in this.particles) {
            this.particles[i].reCalculateLife();
            this.particles[i].position();
            x1 = this.particles[i].x;
            y1 = this.particles[i].y;
            
            for (let j in this.particles){
                x2 = this.particles[j].x;
                y2 = this.particles[j].y;
                length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)).toFixed(3)

                if (length < this.properties.lineLength) {
                    opacity = 1 - length/this.properties.lineLength
                    if (this.particles[i].isStart) {
                        if (this.particles[i].start > opacity) this.particles[i].isStart = false
                        opacity = this.particles[i].start
                    }
                    this.ctx.lineWidth = 0.5;
                    this.ctx.strokeStyle = this.color(i, opacity, x1)
                    this.ctx.beginPath();
                    this.ctx.moveTo(x1, y1);
                    this.ctx.lineTo(x2, y2);
                    this.ctx.stroke()
                }
            }
        }
    }

    loop() {
        this.reDrawBackground();
        this.drawLines();
        requestAnimationFrame(this.boundAnimate);
    }

     init() {
        this.particles = new Particle(this.sizes.w, this.sizes.h, this.properties).particles;
        this.loop();
    }

    clear() {this.particles = []}
}

export {Particles}