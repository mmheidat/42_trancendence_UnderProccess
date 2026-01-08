class Paddle {
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    speed: number;

    constructor(x: number, y: number, width: number, height: number, color: string = 'white') {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        this.speed = 5;
    }

    move(up: boolean, canvasHeight: number): void {
        if (up) {
            this.y -= this.speed;
        } else {
            this.y += this.speed;
        }

        // Prevent paddle from going out of bounds
        if (this.y < 0) {
            this.y = 0;
        } else if (this.y + this.height > canvasHeight) {
            this.y = canvasHeight - this.height;
        }
    }

    render(context: CanvasRenderingContext2D): void {
        context.fillStyle = this.color;
        context.fillRect(this.x, this.y, this.width, this.height);
    }
}

export default Paddle;