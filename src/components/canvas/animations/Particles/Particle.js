export class Particle {
    constructor(w, h, properties, ctx) {
        this.ctx = ctx;
        this.properties = properties;
        this.rect = {
            w,
            h,
            x: Math.random()*w,
            y: Math.random()*h
        }
        this.velocityX = this.velocity;
        this.velocityY = this.velocity;
        this.life = Math.random()*properties.particleLife*60;
    }
    get velocity() {
        return Math.random()*(this.properties.particleMaxVelocity*2)-this.properties.particleMaxVelocity;
    }
    position(){
        this.rect.x+=this.velocityX;
        this.rect.y+=this.velocityY;
    }
    reDraw(){
        this.ctx.beginPath();
        this.ctx.closePath();
        this.ctx.fillStyle = this.properties.particleColor;
        this.ctx.fill();
    }
    reCalculateLife() {
        if(this.life < 1){
            this.rect.x = Math.random()*this.rect.w;
            this.rect.y = Math.random()*this.rect.h;
            this.velocityX = this.velocity;
            this.velocityY = this.velocity;
            this.life = Math.random()*this.properties.particleLife*60
        }
        this.life--;
    }
}