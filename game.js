// Biomechanical Skeletal Simulation Portfolio Engine
// Powered by Phaser.js + Verlet Integration + Leg Inverse Kinematics (IK)

class PortfolioScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PortfolioScene' });
    }

    preload() {
        // Procedural vector graphics - no heavy loading required!
    }

    create() {
        this.scrollWorldEl = document.getElementById('scrollable-world');
        this.hudZoneEl = document.getElementById('hud-zone');
        this.hudProgressEl = document.getElementById('hud-progress');

        // Physics constants for scroll navigation
        this.MAX_WORLD_X = 5200;
        this.worldX = 0;
        this.targetWorldX = 0;
        this.scrollSpeed = 0;
        this.scrollFriction = 0.86;
        
        // Jump state
        this.playerY = 500 - 80;
        this.playerVy = 0;
        this.playerGravity = 0.65;
        this.playerJumpForce = -13.5;
        this.playerGrounded = true;
        this.facingRight = true;

        // Setup custom Phaser rendering graphics context first
        this.gfx = this.add.graphics();

        // Create the custom Biomechanical Skeletal Rig
        this.human = new BiomechanicalHuman(this, 500); // 500 is groundY

        // Skyline Generation
        this.generateSkyline();

        // Stars Generation
        this.generateStars();

        // Audio controls binding
        this.audioCtx = null;
        this.audioEnabled = false;

        // Setup sound buttons
        const soundBtn = document.getElementById('sound-btn');
        if (soundBtn) {
            // Remove existing listener to be clean, and add new one
            soundBtn.replaceWith(soundBtn.cloneNode(true));
            const newSoundBtn = document.getElementById('sound-btn');
            newSoundBtn.addEventListener('click', () => {
                this.audioEnabled = !this.audioEnabled;
                if (this.audioEnabled) {
                    this.initAudio();
                    newSoundBtn.innerText = '🔊';
                    this.playSound('select');
                } else {
                    newSoundBtn.innerText = '🔇';
                }
            });
        }

        // Replay Button binding
        const replayBtn = document.getElementById('replay-btn');
        if (replayBtn) {
            replayBtn.replaceWith(replayBtn.cloneNode(true));
            const newReplayBtn = document.getElementById('replay-btn');
            newReplayBtn.addEventListener('click', () => {
                this.playSound('win');
                this.targetWorldX = 0;
                this.scrollSpeed = 0;
                this.replayTriggered = false;
            });
        }

        // Start button binding
        const startBtn = document.getElementById('start-game-btn');
        if (startBtn) {
            startBtn.replaceWith(startBtn.cloneNode(true));
            const newStartBtn = document.getElementById('start-game-btn');
            newStartBtn.addEventListener('click', () => {
                this.initAudio();
                this.audioEnabled = true;
                this.playSound('win');
                
                document.getElementById('start-screen').classList.add('hidden');
                document.getElementById('hud').classList.remove('hidden');
                this.gameStarted = true;
                this.handleResize();
            });
        }

        // Interactive GUI keys mapping
        this.keys = this.input.keyboard.addKeys({
            left: Phaser.Input.Keyboard.KeyCodes.LEFT,
            right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
            a: Phaser.Input.Keyboard.KeyCodes.A,
            d: Phaser.Input.Keyboard.KeyCodes.D,
            space: Phaser.Input.Keyboard.KeyCodes.SPACE
        });

        // Mouse Wheel Scroll Listener
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
            if (!this.gameStarted) return;
            this.scrollSpeed += deltaY * 0.055;
        });

        // Resizing
        this.scale.on('resize', this.handleResize, this);
        this.handleResize();

        this.gameStarted = false;
        this.replayTriggered = false;
    }

    initAudio() {
        if (this.audioCtx) return;
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    playSound(type) {
        if (!this.audioEnabled) return;
        this.initAudio();
        if (!this.audioCtx) return;
        
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        
        const osc = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);
        const now = this.audioCtx.currentTime;
        
        if (type === 'jump') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(140, now);
            osc.frequency.exponentialRampToValueAtTime(580, now + 0.15);
            gainNode.gain.setValueAtTime(0.06, now);
            gainNode.gain.linearRampToValueAtTime(0.001, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
        } else if (type === 'land') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, now);
            osc.frequency.linearRampToValueAtTime(45, now + 0.08);
            gainNode.gain.setValueAtTime(0.08, now);
            gainNode.gain.linearRampToValueAtTime(0.001, now + 0.08);
            osc.start(now);
            osc.stop(now + 0.08);
        } else if (type === 'win') {
            const notes = [261.63, 329.63, 392.00, 523.25, 659.25];
            osc.type = 'sine';
            notes.forEach((freq, idx) => {
                osc.frequency.setValueAtTime(freq, now + idx * 0.08);
            });
            gainNode.gain.setValueAtTime(0.05, now);
            gainNode.gain.linearRampToValueAtTime(0.05, now + 0.32);
            gainNode.gain.linearRampToValueAtTime(0.001, now + 0.45);
            osc.start(now);
            osc.stop(now + 0.45);
        } else if (type === 'select') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(380, now);
            gainNode.gain.setValueAtTime(0.04, now);
            gainNode.gain.linearRampToValueAtTime(0.001, now + 0.06);
            osc.start(now);
            osc.stop(now + 0.06);
        }
    }

    handleResize() {
        const w = window.innerWidth;
        const h = window.innerHeight;

        this.scaleRatio = h / 576;
        this.virtualHeight = 576;
        this.virtualWidth = w / this.scaleRatio;

        this.cameras.main.setSize(w, h);

        if (this.gfx) {
            this.gfx.setScale(this.scaleRatio);
        }

        if (this.scrollWorldEl) {
            this.scrollWorldEl.style.transform = `scale(${this.scaleRatio}) translateX(${-this.worldX}px)`;
            this.scrollWorldEl.style.transformOrigin = 'left center';
            const startingPadding = (w / 2) / this.scaleRatio;
            this.scrollWorldEl.style.paddingLeft = `${startingPadding - 100}px`;
        }
    }

    generateSkyline() {
        this.skyline = [];
        const colors = ['#131121', '#191332', '#221946'];
        for (let layer = 0; layer < 3; layer++) {
            const speed = 0.08 + layer * 0.12;
            const color = colors[layer];
            const buildings = [];
            let bx = 0;
            
            while (bx < 6500) {
                let width = 80 + Math.random() * 110;
                let height = 100 + Math.random() * 200 - (layer * 30);
                buildings.push({ x: bx, width, height });
                bx += width + 15 + Math.random() * 30;
            }
            this.skyline.push({ speed, color, buildings });
        }
    }

    generateStars() {
        this.stars = [];
        for (let i = 0; i < 80; i++) {
            this.stars.push({
                x: Math.random() * 1400,
                y: Math.random() * 320,
                size: 1 + Math.random() * 2,
                brightness: Math.random()
            });
        }
    }

    update() {
        if (!this.gameStarted) {
            // Idle float simulation before game start
            this.human.gaitPhase += 0.015;
            this.playerY = 500 - 80 - 15 + Math.sin(this.human.gaitPhase * 1.5) * 8;
            this.human.update(this.virtualWidth / 2, this.playerY, 0, 0, this.playerGrounded, this.facingRight);
            this.renderScene();
            return;
        }

        // 1. Process keyboard inputs and apply acceleration
        if (this.keys.left.isDown || this.keys.a.isDown) {
            this.scrollSpeed -= 0.65;
        } else if (this.keys.right.isDown || this.keys.d.isDown) {
            this.scrollSpeed += 0.65;
        }

        // Apply friction
        this.scrollSpeed *= this.scrollFriction;
        if (Math.abs(this.scrollSpeed) < 0.05) this.scrollSpeed = 0;

        // Apply speed to scroll target
        this.targetWorldX += this.scrollSpeed;

        // Constrain scroll boundaries
        if (this.targetWorldX < 0) {
            this.targetWorldX = 0;
            this.scrollSpeed = 0;
        }
        if (this.targetWorldX > this.MAX_WORLD_X) {
            this.targetWorldX = this.MAX_WORLD_X;
            this.scrollSpeed = 0;
        }

        // Smooth camera lerp
        let prevWorldX = this.worldX;
        this.worldX += (this.targetWorldX - this.worldX) * 0.12;
        if (Math.abs(this.targetWorldX - this.worldX) < 0.05) this.worldX = this.targetWorldX;

        // Speed check for animation and directions
        let scrollDelta = this.worldX - prevWorldX;
        let isRunning = Math.abs(scrollDelta) > 0.08;
        if (isRunning) {
            this.facingRight = scrollDelta > 0;
        }

        // 2. Jump Handler
        if (this.keys.space.isDown && this.playerGrounded) {
            this.playerVy = this.playerJumpForce;
            this.playerGrounded = false;
            this.playSound('jump');
        }

        if (!this.playerGrounded) {
            this.playerVy += this.playerGravity;
            this.playerY += this.playerVy;

            // Ground collision
            const groundY = 500 - 80;
            if (this.playerY >= groundY) {
                this.playerY = groundY;
                this.playerVy = 0;
                this.playerGrounded = true;
                this.playSound('land');
            }
        }

        // 3. Update Skeletal Joints simulation
        const centerX = this.virtualWidth / 2;
        this.human.update(centerX, this.playerY, this.scrollSpeed, scrollDelta, this.playerGrounded, this.facingRight);

        // 4. Update HUD and translate DOM Overlay
        this.updateDOM();

        // 5. Render canvas backgrounds and skeletal segments
        this.renderScene();
    }

    updateDOM() {
        if (this.scrollWorldEl) {
            this.scrollWorldEl.style.transform = `scale(${this.scaleRatio}) translateX(${-this.worldX}px)`;
        }

        let activeZone = 'INTRO';
        if (this.worldX > 4500) {
            activeZone = 'VICTORY';
        } else if (this.worldX > 3200) {
            activeZone = 'EXPERIENCE';
        } else if (this.worldX > 1400) {
            activeZone = 'SKILLS';
        }
        
        if (this.hudZoneEl) this.hudZoneEl.innerText = activeZone;
        
        let pct = Math.floor((this.worldX / this.MAX_WORLD_X) * 100);
        if (pct > 100) pct = 100;
        if (this.hudProgressEl) this.hudProgressEl.innerText = pct + '%';

        // Check victory music trigger
        if (this.worldX >= this.MAX_WORLD_X - 100 && !this.replayTriggered) {
            this.replayTriggered = true;
            this.playSound('win');
        }
        if (this.worldX < this.MAX_WORLD_X - 200) {
            this.replayTriggered = false;
        }
    }

    renderScene() {
        this.gfx.clear();

        // 1. Draw Starscape
        this.drawStars();

        // 2. Draw Sun
        this.drawSynthwaveSun();

        // 3. Draw Parallax Skyline
        this.drawSkyline();

        // 4. Draw Synthwave perspective grid
        this.drawSynthwaveGround();

        // 5. Draw Biomechanical Human Rig
        this.human.draw(this.gfx);
    }

    drawStars() {
        for (let star of this.stars) {
            let x = (star.x - this.worldX * 0.03) % this.virtualWidth;
            if (x < 0) x += this.virtualWidth;
            
            let alpha = star.brightness * (0.6 + Math.sin(Date.now() * 0.003 + star.x) * 0.4);
            this.gfx.fillStyle(0xffffff, alpha);
            this.gfx.fillRect(x, star.y, star.size, star.size);
        }
    }

    drawSynthwaveSun() {
        const sunX = this.virtualWidth - 180;
        const sunY = 160;
        const r = 68;

        // Draw gradient sun using Phaser's built-in gradient fill properties
        this.gfx.fillGradientStyle(0xff007f, 0xff007f, 0xffc800, 0xffc800, 1, 1, 1, 1);
        this.gfx.fillCircle(sunX, sunY, r);

        // Cut sun slices
        this.gfx.fillStyle(0x0f101a, 1);
        let sliceY = sunY - 32;
        while (sliceY < sunY + r) {
            let pct = (sliceY - (sunY - r)) / (2 * r);
            let thickness = 1 + pct * 6.5;
            this.gfx.fillRect(sunX - r - 10, sliceY, r * 2 + 20, thickness);
            sliceY += thickness + 7.5;
        }
    }

    drawSkyline() {
        this.skyline.forEach(layer => {
            this.gfx.fillStyle(Phaser.Display.Color.HexStringToColor(layer.color).color, 1);
            layer.buildings.forEach(b => {
                let x = b.x - this.worldX * layer.speed;
                if (x + b.width > 0 && x < this.virtualWidth) {
                    this.gfx.fillRect(x, 500 - b.height, b.width, b.height);
                }
            });
        });
    }

    drawSynthwaveGround() {
        const groundY = 500;
        const bottomY = 576;

        this.gfx.fillStyle(0x050209, 1);
        this.gfx.fillRect(0, groundY, this.virtualWidth, bottomY - groundY);

        // Green horizon bar
        this.gfx.lineStyle(3.5, 0x39ff14, 1);
        this.gfx.strokeLineShape(new Phaser.Geom.Line(0, groundY, this.virtualWidth, groundY));

        // Horizontal perspective dividers
        this.gfx.lineStyle(1, 0x39ff14, 0.35);
        let gridCount = 9;
        for (let i = 0; i <= gridCount; i++) {
            let t = Math.pow(i / gridCount, 2.2);
            let y = groundY + t * (bottomY - groundY);
            this.gfx.strokeLineShape(new Phaser.Geom.Line(0, y, this.virtualWidth, y));
        }

        // Longitudinal radiating lines
        const vpX = this.virtualWidth / 2;
        const vpY = groundY - 60;
        
        this.gfx.lineStyle(1, 0x39ff14, 0.22);
        let spacing = 65;
        let offset = (this.worldX * 0.7) % spacing;
        let startX = -this.virtualWidth - offset;
        let endX = this.virtualWidth * 2;

        for (let gx = startX; gx < endX; gx += spacing) {
            let dx = gx - vpX;
            let tHorizon = (groundY - vpY) / (bottomY - vpY);
            let xHorizon = vpX + dx * tHorizon;
            this.gfx.strokeLineShape(new Phaser.Geom.Line(xHorizon, groundY, gx, bottomY));
        }
    }
}

// Biomechanical Human Rig with Verlet skeletal integration & Analytical IK Solver
class BiomechanicalHuman {
    constructor(scene, groundY) {
        this.scene = scene;
        this.groundY = groundY;
        
        // Skeletal Nodes (Masses)
        this.nodes = {
            pelvis: { x: 0, y: 0, px: 0, py: 0, isStatic: true },
            torso:  { x: 0, y: -42, px: 0, py: -42 },
            head:   { x: 0, y: -72, px: 0, py: -72 },
            
            lShoulder: { x: -10, y: -40, px: -10, py: -40 },
            lElbow:    { x: -20, y: -22, px: -20, py: -22 },
            lHand:     { x: -26, y: -4, px: -26, py: -4 },
            
            rShoulder: { x: 10, y: -40, px: 10, py: -40 },
            rElbow:    { x: 20, y: -22, px: 20, py: -22 },
            rHand:     { x: 26, y: -4, px: 26, py: -4 },
            
            lHip: { x: -8, y: 5, px: -8, py: 5, isStatic: true },
            rHip: { x: 8, y: 5, px: 8, py: 5, isStatic: true }
        };

        // Rigid Constraints (Sticks)
        this.lengths = {
            pelvisToTorso: 42,
            torsoToHead: 30,
            shoulderToElbow: 22,
            elbowToHand: 18
        };
        
        // Kinematic leg segment lengths for IK
        this.L1 = 28; // Hip to Knee
        this.L2 = 28; // Knee to Foot
        
        // Walk cycle parameters
        this.gaitPhase = 0;
        this.runBlend = 0; // 0 (Stand) to 1 (Run)
        
        // Active solved positions for legs/feet
        this.leftFoot = { x: 0, y: 0 };
        this.rightFoot = { x: 0, y: 0 };
        this.leftKnee = { x: 0, y: 0 };
        this.rightKnee = { x: 0, y: 0 };
        
        this.facingRight = true;
    }

    update(pelvisX, pelvisY, speed, scrollDelta, playerGrounded, facingRight) {
        this.facingRight = facingRight;
        
        // 1. Anchoring pelvic skeleton relative to target coordinates
        const prevPelvisX = this.nodes.pelvis.x;
        const prevPelvisY = this.nodes.pelvis.y;
        
        this.nodes.pelvis.x = pelvisX;
        this.nodes.pelvis.y = pelvisY;
        this.nodes.pelvis.px = prevPelvisX;
        this.nodes.pelvis.py = prevPelvisY;
        
        this.nodes.lHip.x = pelvisX - 8;
        this.nodes.lHip.y = pelvisY + 4;
        this.nodes.rHip.x = pelvisX + 8;
        this.nodes.rHip.y = pelvisY + 4;

        // 2. Physical Activity Physics (Verlet weight shift lean)
        // Force applied to chest to shift Virtual Center of Mass
        let targetLeanX = speed * 12.5; // weight shift distance proportional to velocity
        let leanForce = (pelvisX + targetLeanX - this.nodes.torso.x) * 0.12;
        this.nodes.torso.x += leanForce;

        // Perform Verlet Integration step on secondary bone points
        const gravity = 0.18;
        for (let key in this.nodes) {
            let n = this.nodes[key];
            if (!n.isStatic) {
                let vx = (n.x - n.px) * 0.94; // dampening velocity
                let vy = (n.y - n.py) * 0.94;
                
                n.px = n.x;
                n.py = n.y;
                
                n.x += vx;
                n.y += vy + gravity; // pull limbs downwards
            }
        }

        // 3. Solve Bone Constraints (Sticks)
        const sticks = [
            { n1: 'pelvis', n2: 'torso', len: this.lengths.pelvisToTorso },
            { n1: 'torso', n2: 'head', len: this.lengths.torsoToHead },
            { n1: 'torso', n2: 'lShoulder', len: 12 },
            { n1: 'torso', n2: 'rShoulder', len: 12 },
            { n1: 'lShoulder', n2: 'lElbow', len: this.lengths.shoulderToElbow },
            { n1: 'lElbow', n2: 'lHand', len: this.lengths.elbowToHand },
            { n1: 'rShoulder', n2: 'rElbow', len: this.lengths.shoulderToElbow },
            { n1: 'rElbow', n2: 'rHand', len: this.lengths.elbowToHand }
        ];

        for (let iter = 0; iter < 4; iter++) {
            sticks.forEach(s => {
                let node1 = this.nodes[s.n1];
                let node2 = this.nodes[s.n2];
                let dx = node2.x - node1.x;
                let dy = node2.y - node1.y;
                let dist = Math.sqrt(dx*dx + dy*dy);
                if (dist === 0) return;
                
                let diff = s.len - dist;
                let percent = (diff / dist) * 0.5;
                let offsetX = dx * percent;
                let offsetY = dy * percent;
                
                if (!node1.isStatic) {
                    node1.x -= offsetX;
                    node1.y -= offsetY;
                }
                if (!node2.isStatic) {
                    node2.x += offsetX;
                    node2.y += offsetY;
                }
            });
        }

        // 4. Arm swings (Inverse Kinematic targets)
        // Arms swing out-of-phase with run speeds
        this.runBlend += (Math.min(Math.abs(speed) * 0.25, 1) - this.runBlend) * 0.12;
        
        let swingPhase = this.gaitPhase;
        let leftArmTargetX = this.nodes.lShoulder.x - Math.sin(swingPhase) * 14 * this.runBlend;
        let leftArmTargetY = this.nodes.lShoulder.y + 22 + Math.max(0, Math.cos(swingPhase)) * 8 * this.runBlend;
        let rightArmTargetX = this.nodes.rShoulder.x + Math.sin(swingPhase) * 14 * this.runBlend;
        let rightArmTargetY = this.nodes.rShoulder.y + 22 + Math.max(0, -Math.cos(swingPhase)) * 8 * this.runBlend;

        if (this.runBlend < 0.15) {
            // Standing pose arm positions
            leftArmTargetX = this.nodes.lShoulder.x - 4;
            leftArmTargetY = this.nodes.lShoulder.y + 36;
            rightArmTargetX = this.nodes.rShoulder.x + 4;
            rightArmTargetY = this.nodes.rShoulder.y + 36;
        }

        // Pull Verlet hand nodes to kinematics targets
        this.nodes.lHand.x += (leftArmTargetX - this.nodes.lHand.x) * 0.22;
        this.nodes.lHand.y += (leftArmTargetY - this.nodes.lHand.y) * 0.22;
        this.nodes.rHand.x += (rightArmTargetX - this.nodes.rHand.x) * 0.22;
        this.nodes.rHand.y += (rightArmTargetY - this.nodes.rHand.y) * 0.22;

        // 5. Leg Kinematics Solver (Inverse Kinematics with dynamic gait speed sync)
        if (playerGrounded) {
            // Perfect foot-speed sync: advance gait using actual displacement
            this.gaitPhase += scrollDelta * 0.088 * (this.facingRight ? 1 : -1);
            
            // Resolve Gait foot targets
            let lGaitX = this.nodes.lHip.x + Math.sin(this.gaitPhase) * 24;
            let lGaitY = this.groundY - Math.max(0, Math.cos(this.gaitPhase)) * 14;
            let rGaitX = this.nodes.rHip.x - Math.sin(this.gaitPhase) * 24;
            let rGaitY = this.groundY - Math.max(0, -Math.cos(this.gaitPhase)) * 14;
            
            // Standing foot targets
            let lStandX = this.nodes.lHip.x - 2;
            let lStandY = this.groundY;
            let rStandX = this.nodes.rHip.x + 2;
            let rStandY = this.groundY;

            // Blend Stand/Run dynamic targets
            this.leftFoot.x = Phaser.Math.Interpolation.Linear([lStandX, lGaitX], this.runBlend);
            this.leftFoot.y = Phaser.Math.Interpolation.Linear([lStandY, lGaitY], this.runBlend);
            this.rightFoot.x = Phaser.Math.Interpolation.Linear([rStandX, rGaitX], this.runBlend);
            this.rightFoot.y = Phaser.Math.Interpolation.Linear([rStandY, rGaitY], this.runBlend);
        } else {
            // Jump posture: pull legs in slightly
            this.leftFoot.x += (this.nodes.lHip.x - 3 - this.leftFoot.x) * 0.2;
            this.leftFoot.y += (pelvisY + 68 - this.leftFoot.y) * 0.2;
            this.rightFoot.x += (this.nodes.rHip.x + 3 - this.rightFoot.x) * 0.2;
            this.rightFoot.y += (pelvisY + 68 - this.rightFoot.y) * 0.2;
        }

        // Solve leg joint angles using analytic trigonometry (IK Knee Solver)
        this.leftKnee = this.solveKneeIK(this.nodes.lHip, this.leftFoot, this.L1, this.L2, this.facingRight);
        this.rightKnee = this.solveKneeIK(this.nodes.rHip, this.rightFoot, this.L1, this.L2, this.facingRight);
    }

    solveKneeIK(hip, foot, legLength1, legLength2, bendRight) {
        let dx = foot.x - hip.x;
        let dy = foot.y - hip.y;
        let dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist >= legLength1 + legLength2) {
            let ux = dx / dist;
            let uy = dy / dist;
            return {
                x: hip.x + ux * legLength1,
                y: hip.y + uy * legLength1
            };
        }
        
        let a = legLength1;
        let b = legLength2;
        let c = dist;
        
        let cosA = (a*a + c*c - b*b) / (2 * a * c);
        let angle = Math.acos(Phaser.Math.Clamp(cosA, -1, 1));
        
        let angleBase = Math.atan2(dy, dx);
        
        // Bend knees forward based on heading direction
        let bendAngle = bendRight ? (angleBase + angle) : (angleBase - angle);
        
        return {
            x: hip.x + Math.cos(bendAngle) * legLength1,
            y: hip.y + Math.sin(bendAngle) * legLength1
        };
    }

    draw(graphics) {
        const neonPink = 0xff007f;
        const neonCyan = 0x00f3ff;
        const neonPurple = 0x9d4edd;

        // Draw bone outline glow styles
        const drawCyberBone = (p1, p2, color) => {
            graphics.lineStyle(6, color, 0.22);
            graphics.strokeLineShape(new Phaser.Geom.Line(p1.x, p1.y, p2.x, p2.y));
            graphics.lineStyle(2, 0xffffff, 0.95);
            graphics.strokeLineShape(new Phaser.Geom.Line(p1.x, p1.y, p2.x, p2.y));
        };

        const drawJointCap = (p, color) => {
            graphics.fillStyle(color, 0.4);
            graphics.fillCircle(p.x, p.y, 5);
            graphics.fillStyle(0xffffff, 1);
            graphics.fillCircle(p.x, p.y, 2.2);
        };

        // 1. Draw Legs (Left = Pink, Right = Purple for depth separation)
        drawCyberBone(this.nodes.lHip, this.leftKnee, neonPink);
        drawCyberBone(this.leftKnee, this.leftFoot, neonPink);
        drawCyberBone(this.nodes.rHip, this.rightKnee, neonPurple);
        drawCyberBone(this.rightKnee, this.rightFoot, neonPurple);

        drawJointCap(this.leftKnee, neonPink);
        drawJointCap(this.rightKnee, neonPurple);
        drawJointCap(this.leftFoot, neonPink);
        drawJointCap(this.rightFoot, neonPurple);

        // 2. Draw Spine and Torso (Neon Cyan)
        drawCyberBone(this.nodes.pelvis, this.nodes.torso, neonCyan);
        
        // Draw cybernetic glassmorphic chest plate
        graphics.fillStyle(0x0f101a, 0.65);
        graphics.lineStyle(2.5, neonCyan, 0.9);
        let chestRect = new Phaser.Geom.Rectangle(this.nodes.torso.x - 10, this.nodes.torso.y, 20, 24);
        graphics.fillRectShape(chestRect);
        graphics.strokeRectShape(chestRect);
        
        // Torso Core Reactor glow
        graphics.fillStyle(neonPink, 0.8);
        graphics.fillCircle(this.nodes.torso.x, this.nodes.torso.y + 12, 4);

        // 3. Draw Arms (Left = Pink, Right = Purple)
        drawCyberBone(this.nodes.lShoulder, this.nodes.lElbow, neonPink);
        drawCyberBone(this.nodes.lElbow, this.nodes.lHand, neonPink);
        drawCyberBone(this.nodes.rShoulder, this.nodes.rElbow, neonPurple);
        drawCyberBone(this.nodes.rElbow, this.nodes.rHand, neonPurple);

        drawJointCap(this.nodes.lElbow, neonPink);
        drawJointCap(this.nodes.rElbow, neonPurple);
        drawJointCap(this.nodes.lHand, neonPink);
        drawJointCap(this.nodes.rHand, neonPurple);

        // 4. Draw Neck & Head (Helmet visor)
        drawCyberBone(this.nodes.torso, this.nodes.head, neonCyan);
        
        // Cyber Helmet
        graphics.fillStyle(0x131722, 0.85);
        graphics.lineStyle(2, 0xffffff, 0.9);
        graphics.fillCircle(this.nodes.head.x, this.nodes.head.y, 9);
        graphics.strokeCircle(this.nodes.head.x, this.nodes.head.y, 9);
        
        // Glowing Cyan Visor
        graphics.fillStyle(neonCyan, 0.95);
        let visorX = this.nodes.head.x + (this.facingRight ? 2 : -7);
        graphics.fillRect(visorX, this.nodes.head.y - 4, 5, 4);
    }
}

// Phaser.js Instance Bootstrap configurations
const phaserConfig = {
    type: Phaser.CANVAS,
    canvas: document.getElementById('gameCanvas'),
    width: window.innerWidth,
    height: window.innerHeight,
    transparent: true,
    physics: {
        default: 'arcade'
    },
    scene: [PortfolioScene]
};

const game = new Phaser.Game(phaserConfig);
