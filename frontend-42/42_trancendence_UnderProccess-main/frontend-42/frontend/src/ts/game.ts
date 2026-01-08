import Paddle from './paddle';
import Ball from './ball';

class Game {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    leftPaddle: Paddle | null = null;
    rightPaddle: Paddle | null = null;
    ball: Ball | null = null;
    leftScore: number = 0;
    rightScore: number = 0;
    gameRunning: boolean = true;
    keys: { [key: string]: boolean } = {};
    aiDifficulty: 'easy' | 'medium' | 'hard' | null = null;
    isAIGame: boolean = false;
    animationId: number | null = null;
    maxScore: number = 11; // First to 11 wins
    winnerName: string | null = null;
    isPaused: boolean = false;


    private handleResize = () => {
        this.resizeCanvas();
    };

    constructor (canvasId: string, isAI: boolean = false, difficulty: 'easy' | 'medium' | 'hard' = 'medium') {
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!canvas) {
            throw new Error(`Canvas with id "${canvasId}" not found`);
        }
        this.isAIGame = isAI;
        this.aiDifficulty = difficulty;
        this.canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get 2D context');
        }
        this.ctx = ctx;
        
        // Responsive canvas sizing
        this.resizeCanvas();
        window.addEventListener('resize', this.handleResize);
        this.setupControls();
    }
    
    resizeCanvas(): void {
        const maxWidth = Math.min(800, window.innerWidth - 40);
        const aspectRatio = 800 / 400;
        this.canvas.width = maxWidth;
        this.canvas.height = maxWidth / aspectRatio;
    }

    

    handleAI(): void {
        if (!this.isAIGame || !this.rightPaddle || !this.ball) return;
    
        const paddleCenter = this.rightPaddle.y + this.rightPaddle.height / 2;
        const ballY = this.ball.y;
        const diff = ballY - paddleCenter;
    
        // AI speed based on difficulty
        let aiSpeed = this.rightPaddle.speed;
        if (this.aiDifficulty === 'easy') {
            aiSpeed = 2;
            // Add randomness - 30% chance to not move
            if (Math.random() < 0.3) return;
        } else if (this.aiDifficulty === 'medium') {
            aiSpeed = 4;
        } else if (this.aiDifficulty === 'hard') {
            aiSpeed = 6;
        }
    
        const originalSpeed = this.rightPaddle.speed;
        this.rightPaddle.speed = aiSpeed;
    
        if (Math.abs(diff) > 10) {
            if (diff > 0) {
                this.rightPaddle.move(false, this.canvas.height);
            } else {
                this.rightPaddle.move(true, this.canvas.height);
            }
        }
        
        // Restore original speed
        this.rightPaddle.speed = originalSpeed;
    }

    setup(): void {
        const paddleHeight = 80;
        const paddleWidth = 10;
        const paddleOffset = 10;
        
        this.leftPaddle = new Paddle(
            paddleOffset, 
            this.canvas.height / 2 - paddleHeight / 2, 
            paddleWidth, 
            paddleHeight
        );
        
        this.rightPaddle = new Paddle(
            this.canvas.width - paddleOffset - paddleWidth, 
            this.canvas.height / 2 - paddleHeight / 2, 
            paddleWidth, 
            paddleHeight
        );
        
        this.ball = new Ball(
            this.canvas.width / 2, 
            this.canvas.height / 2, 
            10
        );
    }

    handlePaddleMovement(): void {
        if (!this.leftPaddle || !this.rightPaddle) return;
    
        // Left paddle controls (W/S)
        if (this.keys['w'] || this.keys['W']) {
            this.leftPaddle.move(true, this.canvas.height);
        }
        if (this.keys['s'] || this.keys['S']) {
            this.leftPaddle.move(false, this.canvas.height);
        }
    
        // Right paddle controls (Arrow Up/Down) - only in non-AI mode
        if (!this.isAIGame) {
            if (this.keys['ArrowUp']) {
                this.rightPaddle.move(true, this.canvas.height);
            }
            if (this.keys['ArrowDown']) {
                this.rightPaddle.move(false, this.canvas.height);
            }
        }
    }

    draw(): void {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw center line
        this.ctx.strokeStyle = 'white';
        this.ctx.setLineDash([5, 15]);
        this.ctx.beginPath();
        this.ctx.moveTo(this.canvas.width / 2, 0);
        this.ctx.lineTo(this.canvas.width / 2, this.canvas.height);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        
        if (this.leftPaddle) this.leftPaddle.render(this.ctx);
        if (this.rightPaddle) this.rightPaddle.render(this.ctx);
        if (this.ball) this.ball.draw(this.ctx);
        
        // Update scores on screen (with null checks)
        this.updateScoreDisplay();
    }
    
    private updateScoreDisplay(): void {
        const player1ScoreElement = document.getElementById('player1Score');
        const player2ScoreElement = document.getElementById('player2Score');
        if (player1ScoreElement) player1ScoreElement.textContent = this.leftScore.toString();
        if (player2ScoreElement) player2ScoreElement.textContent = this.rightScore.toString();
    }

    update(): void {
        if (!this.gameRunning || !this.ball || !this.leftPaddle || !this.rightPaddle) return;
        
        // Check pause BEFORE any updates
        if (this.isPaused) return;
        
        this.handlePaddleMovement();
        this.ball.move();
        this.ball.detectCollision(this.leftPaddle);
        this.ball.detectCollision(this.rightPaddle);
    
        if (this.isAIGame) {
            this.handleAI();
        }
        
        // Ball collision with top/bottom walls
        if (this.ball.y - this.ball.radius < 0 || this.ball.y + this.ball.radius > this.canvas.height) {
            this.ball.speedY = -this.ball.speedY;
        }
        
        // Scoring
        if (this.ball.x < 0) {
            this.rightScore++;
            this.checkWinner();
            if (!this.gameRunning) return;
            this.resetBall();
        } else if (this.ball.x > this.canvas.width) {
            this.leftScore++;
            this.checkWinner();
            if (!this.gameRunning) return;
            this.resetBall();
        }
    }

    checkWinner(): void {
        if (!this.gameRunning) return; // Prevent multiple winner checks
        
        if (this.leftScore >= this.maxScore) {
            this.winnerName = 'Player 1';
            this.endGame();
        } else if (this.rightScore >= this.maxScore) {
            this.winnerName = this.isAIGame ? 'AI' : 'Player 2';
            this.endGame();
        }
    }

    endGame(): void {
        this.gameRunning = false;
        
        // Clean up any existing game over modal first
        const existingModal = document.querySelector('#actualGameCanvas > .absolute.inset-0');
        existingModal?.remove();
        
        // Show game over modal
        const gameOverDiv = document.createElement('div');
        gameOverDiv.className = 'game-over-modal absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 z-50';
        gameOverDiv.innerHTML = `
            <div class="bg-gray-800 rounded-lg p-8 text-center">
                <h2 class="text-4xl font-bold text-white mb-4">Game Over!</h2>
                <p class="text-2xl text-purple-400 mb-6">${this.winnerName} Wins! 🎉</p>
                <p class="text-white text-xl mb-8">Final Score: ${this.leftScore} - ${this.rightScore}</p>
                <button id="playAgainBtn" class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-lg transition duration-300 mr-4">
                    Play Again
                </button>
                <button id="exitGameBtn" class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-8 rounded-lg transition duration-300">
                    Exit to Menu
                </button>
            </div>
        `;
        
        document.getElementById('actualGameCanvas')?.appendChild(gameOverDiv);
        
        // Use one-time event listeners to prevent memory leaks
        const playAgainBtn = document.getElementById('playAgainBtn');
        const exitGameBtn = document.getElementById('exitGameBtn');
        
        if (playAgainBtn) {
            playAgainBtn.addEventListener('click', () => {
                gameOverDiv.remove();
                this.restart();
            }, { once: true });
        }
        
        if (exitGameBtn) {
            exitGameBtn.addEventListener('click', () => {
                gameOverDiv.remove();
                document.getElementById('quitGame')?.click();
            }, { once: true });
        }
    }

    restart(): void {
        this.leftScore = 0;
        this.rightScore = 0;
        this.gameRunning = true;
        this.winnerName = null;
        this.isPaused = false;
        this.keys = {}; // Clear key states
        document.getElementById('pauseOverlay')?.remove();
        this.updateScoreDisplay(); // Update UI immediately
        this.setup();
        this.gameLoop(); // CRITICAL: Must restart animation loop
    }

    resetBall(): void {
        if (this.ball) {
            this.ball.resetPosition(this.canvas.width, this.canvas.height);
        }
    }

    gameLoop = (): void => {
        this.draw();
        this.update();
        if (this.gameRunning) {
            this.animationId = requestAnimationFrame(this.gameLoop);
        }
    }

    start(): void {
        this.setup();
        this.gameRunning = true;
        this.gameLoop();
    }

    stop(): void {
        this.gameRunning = false;
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;    
        }
        
        // Clean up ALL overlays
        document.getElementById('pauseOverlay')?.remove();
        // Remove game over modal (uses class selector since it doesn't have an ID)
        const gameOverModal = document.querySelector('#actualGameCanvas > .absolute.inset-0.flex.items-center.justify-center.bg-black.bg-opacity-75.z-50');
        gameOverModal?.remove();
        
        this.isPaused = false;
        
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        window.removeEventListener('resize', this.handleResize);
    }

    private handleKeyUp = (e: KeyboardEvent) => {
        this.keys[e.key] = false;
    };

    setupControls(): void {
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
    }
    
        // Add pause on ESC key
    private handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            this.togglePause();
        }
        this.keys[e.key] = true;
    };

    togglePause(): void {
        if (!this.gameRunning) return; // Don't allow pause if game is over
        
        this.isPaused = !this.isPaused;
        
        if (this.isPaused) {
            // Remove existing overlay first (safety check)
            document.getElementById('pauseOverlay')?.remove();
            
            // Show pause overlay
            const pauseOverlay = document.createElement('div');
            pauseOverlay.id = 'pauseOverlay';
            pauseOverlay.className = 'absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 z-40';
            pauseOverlay.innerHTML = `
                <div class="text-center">
                    <h2 class="text-4xl font-bold text-white mb-4">PAUSED</h2>
                    <p class="text-gray-400">Press ESC to resume</p>
                </div>
            `;
            document.getElementById('actualGameCanvas')?.appendChild(pauseOverlay);
        } else {
            // Remove pause overlay
            document.getElementById('pauseOverlay')?.remove();
        }
    }
}

export default Game;