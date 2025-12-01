import Paddle from './paddle';

class Ball {
    x: number;
    y: number;
    radius: number;
    speedX: number;
    speedY: number;
    maxSpeed: number = 8;

    
    constructor(x: number, y: number, radius: number, speedX: number = 3, speedY: number = 3) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.speedX = speedX;
        this.speedY = speedY;
    }

    move(): void {
        this.x += this.speedX;
        this.y += this.speedY;
    }

    resetPosition(canvasWidth: number, canvasHeight: number): void {
        this.x = canvasWidth / 2;
        this.y = canvasHeight / 2;
        this.speedX = -this.speedX;
    }

    detectCollision(paddle: Paddle): void {
        // Check if ball is within paddle's x range
        const ballLeft = this.x - this.radius;
        const ballRight = this.x + this.radius;
        const ballTop = this.y - this.radius;
        const ballBottom = this.y + this.radius;
        
        const paddleLeft = paddle.x;
        const paddleRight = paddle.x + paddle.width;
        const paddleTop = paddle.y;
        const paddleBottom = paddle.y + paddle.height;
        
        // Check for collision
        if (ballRight > paddleLeft && 
            ballLeft < paddleRight && 
            ballBottom > paddleTop && 
            ballTop < paddleBottom) {
            
            // Calculate where on the paddle the ball hit (0 = top, 1 = bottom)
            const hitPosition = (this.y - paddleTop) / paddle.height;
            
            // Calculate angle based on hit position (-1 to 1, where 0 is center)
            const relativeIntersectY = (hitPosition - 0.5) * 2;
            
            // Maximum bounce angle (in radians, ~60 degrees)
            const maxBounceAngle = Math.PI / 3;
            
            // Calculate bounce angle
            const bounceAngle = relativeIntersectY * maxBounceAngle;
            
            // Calculate speed magnitude
            const speed = Math.sqrt(this.speedX * this.speedX + this.speedY * this.speedY);
            
            // Set new velocities based on angle
            const direction = paddle.x < this.x ? 1 : -1; // Right paddle: positive, left paddle: negative
            this.speedX = direction * speed * Math.cos(bounceAngle);
            this.speedY = speed * Math.sin(bounceAngle);
            
            // Prevent ball from getting stuck in paddle
            if (direction > 0) {
                this.x = paddleRight + this.radius;
            } else {
                this.x = paddleLeft - this.radius;
            }
            
            // Optional: Increase speed slightly with each hit (up to a maximum)
            const maxSpeed = 12;
            const speedIncrease = 1.05;
            const newSpeed = Math.min(speed * speedIncrease, maxSpeed);
            const currentSpeed = Math.sqrt(this.speedX * this.speedX + this.speedY * this.speedY);
            this.speedX = (this.speedX / currentSpeed) * newSpeed;
            this.speedY = (this.speedY / currentSpeed) * newSpeed;
        }
    }

    draw(context: CanvasRenderingContext2D): void {
        context.fillStyle = 'white';
        context.beginPath();
        context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        context.fill();
        context.closePath();
    }
}

export default Ball;