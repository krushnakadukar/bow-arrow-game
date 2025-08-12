class ArcheryGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 800;
        this.canvas.height = 600;
        
        // Game state
        this.shots = 3;
        this.totalScore = 0;
        this.shotHistory = [];
        this.gameOver = false;
        this.isAiming = false;
        this.isDragging = false;
        
        // Bow and arrow properties
        this.bowX = 80;
        this.bowY = 300;
        this.aimStartX = 0;
        this.aimStartY = 0;
        this.aimEndX = 0;
        this.aimEndY = 0;
        this.power = 0;
        this.angle = 0;
        
        // Target properties
        this.targetX = 650;
        this.targetY = 300;
        this.targetRadius = 100;
        
        // Wind properties
        this.windDirection = Math.random() * 360;
        this.windStrength = Math.random() * 3 + 1; // 1-4 strength
        
        // Arrow flight animation
        this.arrow = null;
        this.arrowTrail = [];
        
        // Bow modes
        this.bowModes = {
            standard: { power: 1.0, accuracy: 1.0, name: 'Standard' },
            power: { power: 1.5, accuracy: 0.6, name: 'Power' },
            precision: { power: 0.7, accuracy: 1.4, name: 'Precision' }
        };
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.generateWind();
        this.gameLoop();
        this.updateUI();
    }
    
    setupEventListeners() {
        // Mouse events for aiming and shooting
        this.canvas.addEventListener('mousedown', (e) => this.startAiming(e));
        this.canvas.addEventListener('mousemove', (e) => this.updateAim(e));
        this.canvas.addEventListener('mouseup', (e) => this.shoot(e));
        
        // Prevent context menu
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Restart button
        document.getElementById('restartBtn').addEventListener('click', () => this.restart());
    }
    
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }
    
    startAiming(e) {
        if (this.gameOver || this.arrow) return;
        
        const pos = this.getMousePos(e);
        this.isAiming = true;
        this.isDragging = true;
        this.aimStartX = pos.x;
        this.aimStartY = pos.y;
        this.aimEndX = pos.x;
        this.aimEndY = pos.y;
    }
    
    updateAim(e) {
        if (!this.isDragging || this.gameOver || this.arrow) return;
        
        const pos = this.getMousePos(e);
        this.aimEndX = pos.x;
        this.aimEndY = pos.y;
        
        // Calculate power and angle
        const deltaX = this.aimEndX - this.aimStartX;
        const deltaY = this.aimEndY - this.aimStartY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        this.power = Math.min(distance / 100, 1.0);
        this.angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
        
        this.updateAimGuide();
    }
    
    shoot(e) {
        if (!this.isDragging || this.gameOver || this.arrow) return;
        
        this.isDragging = false;
        this.isAiming = false;
        
        if (this.power > 0.1) {
            this.fireArrow();
        }
        
        this.power = 0;
        this.updateAimGuide();
    }
    
    fireArrow() {
        const bowMode = this.getBowMode();
        const deltaX = this.aimEndX - this.aimStartX;
        const deltaY = this.aimEndY - this.aimStartY;
        
        // Apply bow mode modifiers
        let adjustedPower = this.power * bowMode.power;
        let accuracy = bowMode.accuracy;
        
        // Add accuracy variation (less accurate = more random)
        const accuracyVariation = (2 - accuracy) * 20; // degrees
        const angleVariation = (Math.random() - 0.5) * accuracyVariation;
        
        // Wind effect (stronger on power bow)
        let windEffect = this.windStrength * (bowMode.name === 'Power' ? 1.5 : 1.0);
        const windAngleRad = this.windDirection * Math.PI / 180;
        const windX = Math.cos(windAngleRad) * windEffect;
        const windY = Math.sin(windAngleRad) * windEffect;
        
        // Calculate arrow trajectory
        const baseAngle = Math.atan2(deltaY, deltaX) + (angleVariation * Math.PI / 180);
        const speed = adjustedPower * 8;
        
        this.arrow = {
            x: this.bowX,
            y: this.bowY,
            vx: Math.cos(baseAngle) * speed + windX * 0.1,
            vy: Math.sin(baseAngle) * speed + windY * 0.1,
            angle: baseAngle,
            gravity: 0.15,
            life: 100
        };
        
        this.arrowTrail = [];
        this.playBowSound();
    }
    
    updateArrow() {
        if (!this.arrow) return;
        
        // Add current position to trail
        this.arrowTrail.push({ x: this.arrow.x, y: this.arrow.y, alpha: 1.0 });
        
        // Limit trail length
        if (this.arrowTrail.length > 10) {
            this.arrowTrail.shift();
        }
        
        // Update trail alpha
        this.arrowTrail.forEach((point, index) => {
            point.alpha = (index + 1) / this.arrowTrail.length * 0.5;
        });
        
        // Update arrow physics
        this.arrow.x += this.arrow.vx;
        this.arrow.y += this.arrow.vy;
        this.arrow.vy += this.arrow.gravity;
        this.arrow.angle = Math.atan2(this.arrow.vy, this.arrow.vx);
        this.arrow.life--;
        
        // Check for target hit
        const distanceToTarget = Math.sqrt(
            Math.pow(this.arrow.x - this.targetX, 2) + 
            Math.pow(this.arrow.y - this.targetY, 2)
        );
        
        if (distanceToTarget <= this.targetRadius) {
            this.hitTarget(distanceToTarget);
            return;
        }
        
        // Check if arrow is off screen or life expired
        if (this.arrow.x > this.canvas.width || 
            this.arrow.y > this.canvas.height || 
            this.arrow.x < 0 || 
            this.arrow.life <= 0) {
            this.missTarget();
        }
    }
    
    hitTarget(distance) {
        let score = 0;
        let hitType = 'miss';
        
        // Scoring rings (from center outward)
        if (distance <= 20) {
            score = 10;
            hitType = 'bullseye';
        } else if (distance <= 40) {
            score = 7;
            hitType = 'inner';
        } else if (distance <= 65) {
            score = 5;
            hitType = 'middle';
        } else if (distance <= this.targetRadius) {
            score = 2;
            hitType = 'outer';
        }
        
        this.recordShot(score, hitType);
        this.playHitSound(hitType);
        this.arrow = null;
        this.arrowTrail = [];
    }
    
    missTarget() {
        this.recordShot(0, 'miss');
        this.arrow = null;
        this.arrowTrail = [];
    }
    
    recordShot(score, hitType) {
        this.totalScore += score;
        this.shots--;
        
        const bowMode = this.getBowMode();
        this.shotHistory.push({
            score,
            hitType,
            bowMode: bowMode.name,
            shot: 4 - this.shots
        });
        
        this.updateUI();
        this.updateShotHistory();
        
        if (this.shots <= 0) {
            this.endGame();
        }
    }
    
    getBowMode() {
        const selectedMode = document.getElementById('bowMode').value;
        return this.bowModes[selectedMode];
    }
    
    generateWind() {
        this.windDirection = Math.random() * 360;
        this.windStrength = Math.random() * 3 + 1;
        
        // Update wind display
        const directions = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
        const directionIndex = Math.floor(this.windDirection / 45) % 8;
        const strengthNames = ['Calm', 'Light', 'Medium', 'Strong', 'Very Strong'];
        const strengthIndex = Math.floor(this.windStrength);
        
        document.getElementById('windDirection').textContent = directions[directionIndex];
        document.getElementById('windStrength').textContent = strengthNames[strengthIndex];
    }
    
    updateAimGuide() {
        const powerBar = document.getElementById('powerBar');
        const angleIndicator = document.getElementById('angleIndicator');
        
        powerBar.style.height = (this.power * 100) + '%';
        
        if (angleIndicator) {
            angleIndicator.style.setProperty('--angle', this.angle + 'deg');
        }
    }
    
    updateUI() {
        document.getElementById('totalScore').textContent = this.totalScore;
        document.getElementById('shotsRemaining').textContent = this.shots;
    }
    
    updateShotHistory() {
        const historyDiv = document.getElementById('shotResults');
        const lastShot = this.shotHistory[this.shotHistory.length - 1];
        
        if (lastShot) {
            const shotElement = document.createElement('div');
            shotElement.className = `shot-result ${lastShot.hitType}`;
            shotElement.textContent = `Shot ${lastShot.shot}: ${lastShot.score} pts (${lastShot.hitType.toUpperCase()}) - ${lastShot.bowMode} Bow`;
            historyDiv.appendChild(shotElement);
        }
    }
    
    endGame() {
        this.gameOver = true;
        document.getElementById('restartBtn').style.display = 'block';
        
        // Show final score message
        setTimeout(() => {
            let message = `Game Over!\n\nFinal Score: ${this.totalScore} points\n\n`;
            
            if (this.totalScore >= 25) {
                message += "🏆 Excellent! Master Archer!";
            } else if (this.totalScore >= 15) {
                message += "🎯 Great shooting!";
            } else if (this.totalScore >= 5) {
                message += "🏹 Not bad, keep practicing!";
            } else {
                message += "🎪 Better luck next time!";
            }
            
            alert(message);
        }, 500);
    }
    
    restart() {
        this.shots = 3;
        this.totalScore = 0;
        this.shotHistory = [];
        this.gameOver = false;
        this.arrow = null;
        this.arrowTrail = [];
        this.power = 0;
        
        document.getElementById('restartBtn').style.display = 'none';
        document.getElementById('shotResults').innerHTML = '';
        
        this.generateWind();
        this.updateUI();
        this.updateAimGuide();
    }
    
    // Rendering methods
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawBackground();
        this.drawTarget();
        this.drawBow();
        this.drawAimLine();
        this.drawArrow();
        this.drawArrowTrail();
        this.drawUI();
    }
    
    drawBackground() {
        // Sky gradient
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(0.7, '#98FB98');
        gradient.addColorStop(1, '#90EE90');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Ground
        this.ctx.fillStyle = '#8FBC8F';
        this.ctx.fillRect(0, this.canvas.height - 50, this.canvas.width, 50);
        
        // Clouds
        this.drawCloud(150, 80, 40);
        this.drawCloud(350, 60, 30);
        this.drawCloud(550, 90, 35);
    }
    
    drawCloud(x, y, radius) {
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const cloudX = x + Math.cos(angle) * radius * (0.7 + Math.random() * 0.3);
            const cloudY = y + Math.sin(angle) * radius * 0.5;
            const cloudRadius = radius * (0.3 + Math.random() * 0.4);
            
            this.ctx.arc(cloudX, cloudY, cloudRadius, 0, Math.PI * 2);
        }
        this.ctx.fill();
    }
    
    drawTarget() {
        // Target stand
        this.ctx.fillStyle = '#8B4513';
        this.ctx.fillRect(this.targetX - 5, this.targetY + this.targetRadius, 10, 100);
        
        // Target rings
        const rings = [
            { radius: this.targetRadius, color: '#FFFFFF' },
            { radius: 80, color: '#000000' },
            { radius: 65, color: '#0066CC' },
            { radius: 40, color: '#FF0000' },
            { radius: 20, color: '#FFD700' }
        ];
        
        rings.forEach(ring => {
            this.ctx.fillStyle = ring.color;
            this.ctx.beginPath();
            this.ctx.arc(this.targetX, this.targetY, ring.radius, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.strokeStyle = '#333';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        });
        
        // Score indicators
        this.ctx.fillStyle = '#333';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('10', this.targetX, this.targetY + 5);
        this.ctx.fillText('7', this.targetX + 30, this.targetY + 5);
        this.ctx.fillText('5', this.targetX + 50, this.targetY + 5);
        this.ctx.fillText('2', this.targetX + 75, this.targetY + 5);
    }
    
    drawBow() {
        // Bow body
        this.ctx.strokeStyle = '#8B4513';
        this.ctx.lineWidth = 8;
        this.ctx.beginPath();
        this.ctx.arc(this.bowX, this.bowY, 40, -Math.PI/3, Math.PI/3);
        this.ctx.stroke();
        
        // Bow string
        this.ctx.strokeStyle = '#654321';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(this.bowX - 20, this.bowY - 35);
        this.ctx.lineTo(this.bowX - 20, this.bowY + 35);
        this.ctx.stroke();
        
        // Archer (simple stick figure)
        this.ctx.strokeStyle = '#8B4513';
        this.ctx.lineWidth = 4;
        
        // Body
        this.ctx.beginPath();
        this.ctx.moveTo(this.bowX - 40, this.bowY);
        this.ctx.lineTo(this.bowX - 40, this.bowY + 60);
        this.ctx.stroke();
        
        // Head
        this.ctx.beginPath();
        this.ctx.arc(this.bowX - 40, this.bowY - 20, 10, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Arms
        this.ctx.beginPath();
        this.ctx.moveTo(this.bowX - 40, this.bowY + 10);
        this.ctx.lineTo(this.bowX - 10, this.bowY);
        this.ctx.stroke();
        
        // Legs
        this.ctx.beginPath();
        this.ctx.moveTo(this.bowX - 40, this.bowY + 60);
        this.ctx.lineTo(this.bowX - 50, this.bowY + 90);
        this.ctx.moveTo(this.bowX - 40, this.bowY + 60);
        this.ctx.lineTo(this.bowX - 30, this.bowY + 90);
        this.ctx.stroke();
    }
    
    drawAimLine() {
        if (this.isDragging) {
            this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
            this.ctx.lineWidth = 3;
            this.ctx.setLineDash([5, 5]);
            
            this.ctx.beginPath();
            this.ctx.moveTo(this.aimStartX, this.aimStartY);
            this.ctx.lineTo(this.aimEndX, this.aimEndY);
            this.ctx.stroke();
            
            // Power indicator circle
            const radius = this.power * 30 + 5;
            this.ctx.beginPath();
            this.ctx.arc(this.aimStartX, this.aimStartY, radius, 0, Math.PI * 2);
            this.ctx.stroke();
            
            this.ctx.setLineDash([]);
        }
    }
    
    drawArrowTrail() {
        if (this.arrowTrail.length > 1) {
            for (let i = 1; i < this.arrowTrail.length; i++) {
                const point = this.arrowTrail[i];
                const prevPoint = this.arrowTrail[i - 1];
                
                this.ctx.strokeStyle = `rgba(139, 69, 19, ${point.alpha})`;
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.moveTo(prevPoint.x, prevPoint.y);
                this.ctx.lineTo(point.x, point.y);
                this.ctx.stroke();
            }
        }
    }
    
    drawArrow() {
        if (this.arrow) {
            this.ctx.save();
            this.ctx.translate(this.arrow.x, this.arrow.y);
            this.ctx.rotate(this.arrow.angle);
            
            // Arrow shaft
            this.ctx.fillStyle = '#8B4513';
            this.ctx.fillRect(-15, -1, 30, 2);
            
            // Arrow head
            this.ctx.fillStyle = '#C0C0C0';
            this.ctx.beginPath();
            this.ctx.moveTo(15, 0);
            this.ctx.lineTo(10, -3);
            this.ctx.lineTo(10, 3);
            this.ctx.closePath();
            this.ctx.fill();
            
            // Arrow feathers
            this.ctx.fillStyle = '#FF6347';
            this.ctx.beginPath();
            this.ctx.moveTo(-15, 0);
            this.ctx.lineTo(-10, -3);
            this.ctx.lineTo(-8, 0);
            this.ctx.lineTo(-10, 3);
            this.ctx.closePath();
            this.ctx.fill();
            
            this.ctx.restore();
        }
    }
    
    drawUI() {
        // Current bow mode indicator
        const bowMode = this.getBowMode();
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        this.ctx.fillRect(10, this.canvas.height - 40, 200, 30);
        this.ctx.strokeStyle = '#8B4513';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(10, this.canvas.height - 40, 200, 30);
        
        this.ctx.fillStyle = '#8B4513';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`${bowMode.name} Bow`, 15, this.canvas.height - 20);
    }
    
    // Sound effects (simple audio feedback)
    playBowSound() {
        // Create a simple sound effect using Web Audio API
        if (window.AudioContext) {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.1);
            
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
        }
    }
    
    playHitSound(hitType) {
        if (window.AudioContext) {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Different sounds for different hit types
            const frequencies = {
                bullseye: [440, 550, 660],
                inner: [330, 440],
                middle: [220, 330],
                outer: [165],
                miss: [100]
            };
            
            const freq = frequencies[hitType] || [100];
            oscillator.frequency.setValueAtTime(freq[0], audioContext.currentTime);
            
            freq.forEach((f, i) => {
                if (i > 0) {
                    oscillator.frequency.setValueAtTime(f, audioContext.currentTime + i * 0.1);
                }
            });
            
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + freq.length * 0.1);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + freq.length * 0.1);
        }
    }
    
    gameLoop() {
        this.updateArrow();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const game = new ArcheryGame();
});
