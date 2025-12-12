
// --- SYSTEM 1: CURSOR & INTERACTION (Critical) ---
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Custom Cursor Logic
        let cursor = document.getElementById('cursor');
        let cursorBorder = document.getElementById('cursor-border');

        // Injection if missing
        if (!cursor || !cursorBorder) {
            if (!document.body) {
                console.warn("Body not ready for cursor injection");
                return;
            }
            if (!cursor) {
                cursor = document.createElement('div');
                cursor.id = 'cursor';
                document.body.appendChild(cursor);
            }
            if (!cursorBorder) {
                cursorBorder = document.createElement('div');
                cursorBorder.id = 'cursor-border';
                document.body.appendChild(cursorBorder);
            }
        }

        // Mouse Movement
        document.addEventListener('mousemove', (e) => {
            if (cursor) {
                cursor.style.left = e.clientX + 'px';
                cursor.style.top = e.clientY + 'px';
            }
            if (cursorBorder) {
                setTimeout(() => {
                    cursorBorder.style.left = e.clientX + 'px';
                    cursorBorder.style.top = e.clientY + 'px';
                }, 50);
            }
        });

        // Hover Effects
        const clickableElements = document.querySelectorAll('a, button, .spotify-card, .gallery-item');
        clickableElements.forEach(el => {
            el.addEventListener('mouseenter', () => document.body.classList.add('hovering'));
            el.addEventListener('mouseleave', () => document.body.classList.remove('hovering'));
        });

        console.log("System 1 (Cursor) initialized.");
        document.body.classList.add('custom-cursor-active');
    } catch (e) {
        console.error("Cursor System Failed:", e);
    }
});


// --- SYSTEM 2: VISUAL CORE (Canvas/Particles) ---
(function initCanvasSystem(attempts = 0) {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) {
        if (attempts < 50) { // Retry for 5 seconds
            // Silent retry to avoid console spam, or debug log
            if (attempts % 10 === 0) console.log(`Waiting for Canvas... (${attempts})`);
            setTimeout(() => initCanvasSystem(attempts + 1), 100);
            return;
        } else {
            console.error("CRITICAL: Canvas element #bg-canvas missing after 5 seconds.");
            return;
        }
    }

    try {
        console.log("Canvas found. Initializing Visuals...");

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Canvas context blocked.");

        let particles = [];
        let scrollY = 0;
        let scrollVelocity = 0;
        let vortexStrength = 0;

        // Glow Variables
        let glowX = window.innerWidth / 2;
        let glowY = window.innerHeight / 2;
        let targetGlowX = window.innerWidth / 2;
        let targetGlowY = window.innerHeight / 2;

        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        resizeCanvas();

        let mouseX = -1000;
        let mouseY = -1000;
        window.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });

        class Particle {
            constructor() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.baseSize = Math.random() * 2 + 0.5;
                this.size = this.baseSize;
                this.speedX = (Math.random() - 0.5) * 0.2;
                this.speedY = (Math.random() - 0.5) * 0.2;
                this.chars = ['0', '1', '{', '}', '<', '>', '/', ';', '*', '+'];
                this.char = Math.random() < 0.1 ? this.chars[Math.floor(Math.random() * this.chars.length)] : null;
                this.energy = 0;
            }

            update(isMusicActive, kickEnvelope) {
                const centerX = canvas.width / 2;
                const centerY = canvas.height / 2;

                // Mouse Repulsion
                const dxMouse = this.x - mouseX;
                const dyMouse = this.y - mouseY;
                const distMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);
                const mouseRange = 150;

                if (distMouse < mouseRange) {
                    const force = (mouseRange - distMouse) / mouseRange;
                    this.x += (dxMouse / distMouse) * force * 2;
                    this.y += (dyMouse / distMouse) * force * 2;
                    this.energy = Math.min(this.energy + 0.1, 1);
                } else {
                    this.energy = Math.max(this.energy - 0.02, 0);
                }

                // Vortex
                if (vortexStrength > 0.1) {
                    const dx = centerX - this.x;
                    const dy = centerY - this.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    let angle = Math.atan2(dy, dx) + 1.5;
                    const pull = vortexStrength * 0.02;

                    if (dist < 50) {
                        this.x -= Math.cos(angle) * 2;
                        this.y -= Math.sin(angle) * 2;
                        this.energy = 1;
                    } else {
                        this.x += Math.cos(angle) * pull * (dist / 20);
                        this.y += Math.sin(angle) * pull * (dist / 20);
                    }
                    this.energy = Math.min(this.energy + 0.02, 1);
                } else {
                    this.x += this.speedX;
                    this.y += this.speedY;
                }

                // Kick
                if (isMusicActive && kickEnvelope > 0.2) {
                    this.energy = 1;
                    this.x += (Math.random() - 0.5) * kickEnvelope * 5;
                    this.y += (Math.random() - 0.5) * kickEnvelope * 5;
                }

                // Wrap
                if (this.x > canvas.width + 50) this.x = -50;
                if (this.x < -50) this.x = canvas.width + 50;
                if (this.y > canvas.height + 50) this.y = -50;
                if (this.y < -50) this.y = canvas.height + 50;
            }

            draw() {
                // DEBUG: Force White Particles for Visibility Check
                // let r = 100 + (255 - 100) * this.energy;
                // let g = 100 + (85 - 100) * this.energy;
                // let b = 100 + (0 - 100) * this.energy;
                // let a = 0.5 + (0.5) * this.energy;
                // ctx.fillStyle = `rgba(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)}, ${a})`;

                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; // Force White for Debug

                if (this.char && this.energy > 0.5) {
                    ctx.font = `${this.baseSize * 4}px monospace`;
                    ctx.fillText(this.char, this.x, this.y);
                } else {
                    let size = this.baseSize * (1 + this.energy);
                    ctx.fillRect(this.x, this.y, size, size);
                }
            }
        }

        function initParticles() {
            particles = [];
            const count = Math.floor((canvas.width * canvas.height) / 4000);
            for (let i = 0; i < count; i++) particles.push(new Particle());
            console.log(`System 2: Created ${count} particles.`);
        }
        initParticles();

        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                const w = canvas.width;
                resizeCanvas();
                if (Math.abs(canvas.width - w) > 50) initParticles();
            }, 100);
        });

        // Loop Variables
        let lastBeatTime = 0;
        const beatInterval = 468;
        let kickEnvelope = 0;

        let debugLogCount = 0;

        function animate() {
            if (debugLogCount < 10) {
                console.log("Anim Frame Running");
                debugLogCount++;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Glow
            glowX += (targetGlowX - glowX) * 0.05;
            glowY += (targetGlowY - glowY) * 0.05;
            const glowR = Math.max(canvas.width, canvas.height) * 0.6;
            const grad = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, glowR);
            grad.addColorStop(0, 'rgba(255, 85, 0, 0.15)');
            grad.addColorStop(1, 'rgba(255, 85, 0, 0)');

            // TEMP DEBUG: Use brighter glow for test
            // ctx.fillStyle = grad;
            ctx.fillStyle = 'rgba(50, 0, 0, 0.2)'; // DEBUG RED BACKGROUND TINT

            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Audio Logic Stub (Music Active Check)
            const isMusicActive = document.getElementById('stickyPlayer')?.classList.contains('active');
            const now = Date.now();

            if (isMusicActive) {
                if (now - lastBeatTime > beatInterval) {
                    lastBeatTime = now;
                    kickEnvelope = 1.0;
                }
                kickEnvelope *= 0.85;
                vortexStrength = 0.6 + (kickEnvelope * 0.4);
            } else {
                kickEnvelope *= 0.9;
                vortexStrength *= 0.95;
            }

            particles.forEach(p => {
                p.update(isMusicActive, kickEnvelope);
                p.draw();
            });

            requestAnimationFrame(animate);
        }
        animate();

        // Scroll Handler (Required for Vortex)
        let ticking = false;
        let lastScrollY = 0;
        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const currentScrollY = window.scrollY;
                    const scrollVelocity = currentScrollY - lastScrollY;
                    const speed = Math.abs(scrollVelocity);

                    if (speed > 0) vortexStrength = Math.min(vortexStrength + speed * 0.05, 4);

                    targetGlowY += scrollVelocity * 1.5;
                    if (speed > 2) {
                        targetGlowX += (Math.random() - 0.5) * 150;
                        targetGlowY += (Math.random() - 0.5) * 100;
                    }

                    targetGlowY = Math.max(-400, Math.min(canvas.height + 400, targetGlowY));
                    targetGlowX = Math.max(-200, Math.min(canvas.width + 200, targetGlowX));

                    lastScrollY = currentScrollY;
                    ticking = false;
                });
                ticking = true;
            }
        });

        console.log("System 2 (Canvas) initialized.");

    } catch (err) {
        console.error("Canvas System Failed:", err);
    }
})();
