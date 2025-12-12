
import './style.css';
// import './rawbeat.css';

// --- VISUAL CORE (Critical Priority) ---

// Custom Cursor Logic
let cursor = document.getElementById('cursor');
let cursorBorder = document.getElementById('cursor-border');

// Foolproof Injection: If HTML elements are missing (race condition), create them.
if (!cursor || !cursorBorder) {
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

// Hover Effect
const clickableElements = document.querySelectorAll('a, button, .spotify-card, .gallery-item');
clickableElements.forEach(el => {
  el.addEventListener('mouseenter', () => document.body.classList.add('hovering'));
  el.addEventListener('mouseleave', () => document.body.classList.remove('hovering'));
});


// Animated Background Canvas
const canvas = document.getElementById('bg-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;

if (ctx) {

  let particles = [];
  let scrollY = 0;
  let scrollVelocity = 0;
  let vortexStrength = 0;

  // Glow Variables
  let glowX = window.innerWidth / 2;
  let glowY = window.innerHeight / 2;
  let targetGlowX = window.innerWidth / 2;
  let targetGlowY = window.innerHeight / 2;

  // Set canvas size
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  resizeCanvas();

  // Mouse Tracking for Canvas
  let mouseX = -1000;
  let mouseY = -1000;
  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  // Particle class
  class Particle {
    constructor() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.baseSize = Math.random() * 2 + 0.5; // Pixels are varied
      this.size = this.baseSize;
      this.speedX = (Math.random() - 0.5) * 0.2; // Slower base drift
      this.speedY = (Math.random() - 0.5) * 0.2;

      // Code aesthetic
      this.chars = ['0', '1', '{', '}', '<', '>', '/', ';', '*', '+'];
      this.char = Math.random() < 0.1 ? this.chars[Math.floor(Math.random() * this.chars.length)] : null; // 10% are chars

      this.color = { r: 60, g: 60, b: 60, a: 0.3 }; // Default dark grey
      this.energy = 0; // 0 = dormant, 1 = fully active (orange)
    }

    update(isMusicActive, kickEnvelope, index, mx, my) {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // 1. Mouse Interaction (Repulsion / Excitement)
      const dxMouse = this.x - mx;
      const dyMouse = this.y - my;
      const distMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);
      const mouseRange = 150;

      if (distMouse < mouseRange) {
        const force = (mouseRange - distMouse) / mouseRange;
        // Push away slightly
        this.x += (dxMouse / distMouse) * force * 2;
        this.y += (dyMouse / distMouse) * force * 2;
        // Energize!
        this.energy = Math.min(this.energy + 0.1, 1);
      } else {
        // Decay energy
        this.energy = Math.max(this.energy - 0.02, 0);
      }

      // 2. Scroll / Vortex Physics
      if (vortexStrength > 0.1) {
        const dx = centerX - this.x;
        const dy = centerY - this.y;
        const distCenter = Math.sqrt(dx * dx + dy * dy);

        // Calculate angle towards center
        let angle = Math.atan2(dy, dx);

        // Add swirl (spiral effect) - closer to 90deg (PI/2) means more orbit, less suction
        // Randomize direction slightly per particle for organic feel?
        // Let's make a nice galaxy spiral: Angle + offset
        angle += 1.5; // Nearly perpendicular (orbit) with slight inward pull

        const pull = vortexStrength * 0.02; // Reduced pull factor

        // Orbit velocity based on distance (faster near center, like gravity)
        // But limit suction at very close range to avoid singularity

        if (distCenter < 50) {
          // Too close! Push out / orbit fast without getting sucked in
          this.x -= Math.cos(angle) * 2;
          this.y -= Math.sin(angle) * 2;
          this.energy = 1; // Glow up
        } else {
          this.x += Math.cos(angle) * pull * (distCenter / 20);
          this.y += Math.sin(angle) * pull * (distCenter / 20);
        }

        // Add "Data Stream" speed
        this.energy = Math.min(this.energy + 0.02, 1);
      } else {
        // Normal drift
        this.x += this.speedX;
        this.y += this.speedY;
      }

      // 3. Kick Impact
      if (isMusicActive && kickEnvelope > 0.2) {
        this.energy = 1; // Beat hits light everything up
        // Jitter
        this.x += (Math.random() - 0.5) * kickEnvelope * 5;
        this.y += (Math.random() - 0.5) * kickEnvelope * 5;
      }

      // Wrap
      if (this.x > canvas.width + 50) this.x = -50;
      if (this.x < -50) this.x = canvas.width + 50;
      if (this.y > canvas.height + 50) this.y = -50;
      if (this.y < -50) this.y = canvas.height + 50;
    }

    draw(isMusicActive, kickEnvelope, index) {
      // Interpolate Color: Grey to Neon Orange
      // Orange: 255, 85, 0
      // Grey: 60, 60, 60

      let r = 60 + (255 - 60) * this.energy;
      let g = 60 + (85 - 60) * this.energy;
      let b = 60 + (0 - 60) * this.energy;
      let a = 0.3 + (0.7) * this.energy;

      ctx.fillStyle = `rgba(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)}, ${a})`;

      if (this.char && (this.energy > 0.5 || isMusicActive)) {
        // Draw Character for high energy particles
        ctx.font = `${this.baseSize * 4}px monospace`;
        ctx.fillText(this.char, this.x, this.y);
      } else {
        // Draw Pixel Square
        let size = this.baseSize * (1 + this.energy); // Grow when active
        ctx.fillRect(this.x, this.y, size, size);
      }
    }
  }

  // Initialize particles
  function initParticles() {
    particles = [];
    const particleCount = Math.floor((canvas.width * canvas.height) / 4000); // Much higher density
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }
  }

  initParticles();

  // Optimized Resize Handler
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const oldWidth = canvas.width;
      resizeCanvas();
      // Only re-init if width changed (orientation change) or huge height change
      if (Math.abs(canvas.width - oldWidth) > 50) {
        initParticles();
      }
    }, 100);
  });

  // Beat Simulation Variables
  let lastBeatTime = 0;
  const beatInterval = 468; // ~128 BPM
  let kickEnvelope = 0;

  // Animation loop
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // --- Draw Subtle Orange Glow ---
    // Smoothly interpolate current glow position towards target
    glowX += (targetGlowX - glowX) * 0.05;
    glowY += (targetGlowY - glowY) * 0.05;

    const glowRadius = Math.max(canvas.width, canvas.height) * 0.6;
    const glowGradient = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, glowRadius);

    // Very subtle orange (adjust alpha for subtlety)
    glowGradient.addColorStop(0, 'rgba(255, 85, 0, 0.15)');
    glowGradient.addColorStop(1, 'rgba(255, 85, 0, 0)');

    ctx.fillStyle = glowGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // -------------------------------

    // Check if music is playing
    const isMusicActive = document.getElementById('stickyPlayer')?.classList.contains('active');
    const currentTime = Date.now();

    if (isMusicActive) {
      // Simulate Kick Drum (Metronome)
      if (currentTime - lastBeatTime > beatInterval) {
        lastBeatTime = currentTime;
        kickEnvelope = 1.0; // BOOM: Kick hits max
      }
      // Physics: Fast Attack, Exponential Decay
      kickEnvelope *= 0.85;

      // Base vortex is active but disrupted by kicks
      // Vortex strength pulses slightly with the beat
      vortexStrength = 0.6 + (kickEnvelope * 0.4);
    } else {
      // No music: Calm decay
      kickEnvelope *= 0.9;
      vortexStrength *= 0.95;
    }

    particles.forEach((particle, index) => {
      // Pass mouse interaction data
      particle.update(isMusicActive, kickEnvelope, index, mouseX, mouseY);
      particle.draw(isMusicActive, kickEnvelope, index);
    });


    requestAnimationFrame(animate);
  }

  animate();

  // Optimized Scroll Handling
  let lastKnownScrollPosition = 0;
  let ticking = false;
  let lastScrollY = 0; // Moved here to be accessible by handleScroll
  let scrollTimeout; // Declared globally for handleScroll
  let visualsScrollTimeout; // Declared globally for handleScroll
  let animationScrollTimeout; // Declared globally for handleScroll

  window.addEventListener('scroll', () => {
    lastKnownScrollPosition = window.scrollY;

    if (!ticking) {
      window.requestAnimationFrame(() => {
        if (typeof handleScroll === 'function') handleScroll(lastKnownScrollPosition);
        ticking = false;
      });

      ticking = true;
    }
  });

  function handleScroll(scrollPos) {
    // 1. Particle / Vortex Math
    const currentScrollY = scrollPos;
    scrollVelocity = currentScrollY - lastScrollY;

    // Vortex Activation
    const speed = Math.abs(scrollVelocity);
    if (speed > 0) {
      vortexStrength = Math.min(vortexStrength + speed * 0.05, 4);
    }

    // Glow Movement
    targetGlowY += scrollVelocity * 1.5;
    if (speed > 2) {
      targetGlowX += (Math.random() - 0.5) * 150;
      targetGlowY += (Math.random() - 0.5) * 100;
    }

    // Bounds
    targetGlowY = Math.max(-400, Math.min(canvas.height + 400, targetGlowY));
    targetGlowX = Math.max(-200, Math.min(canvas.width + 200, targetGlowX));

    scrollY = scrollVelocity;
    lastScrollY = currentScrollY;

    // Decay scroll influence
    setTimeout(() => {
      scrollY *= 0.9;
    }, 50);

    // 2. Parallax Effect
    const parallaxLayers = document.querySelectorAll('.parallax-layer');
    parallaxLayers.forEach(layer => {
      const speed = layer.getAttribute('data-speed');
      const yPos = -(scrollPos * speed);
      layer.style.transform = `translate3d(0, ${yPos}px, 0)`; // Hardware acceleration
    });

    // 3. Scroll Detection for CSS Classes
    document.body.classList.add('is-scrolling');
    clearTimeout(animationScrollTimeout);
    animationScrollTimeout = setTimeout(() => {
      document.body.classList.remove('is-scrolling');
    }, 150);

    // 4. Triangle Loader Logic
    const triangleLoader = document.querySelector('.triangle-loader');
    if (triangleLoader) {
      const musicSection = document.querySelector('#music');
      if (musicSection) {
        // Simple check to avoid layout thrashing if not needed
        const rect = musicSection.getBoundingClientRect();
        const inView = rect.top < window.innerHeight && rect.bottom > 0;
        if (inView) {
          triangleLoader.classList.remove('paused');
          clearTimeout(scrollTimeout);
          scrollTimeout = setTimeout(() => {
            triangleLoader.classList.add('paused');
          }, 1000);
        }
      }
    }

    // 5. Visual Loader Logic
    const visualLoader = document.querySelector('.visual-loader');
    if (visualLoader) {
      const visualsSection = document.querySelector('#visuals');
      if (visualsSection) {
        const rect = visualsSection.getBoundingClientRect();
        const inView = rect.top < window.innerHeight && rect.bottom > 0;
        if (inView) {
          visualLoader.classList.remove('paused');
          clearTimeout(visualsScrollTimeout);
          visualsScrollTimeout = setTimeout(() => {
            visualLoader.classList.add('paused');
          }, 1000);
        }
      }
    }
  } // End handleScroll
} // End if(ctx)

// --- INTERACTIVE ELEMENTS ---

// Scramble Text Class
class ScrambleText {
  constructor(element) {
    this.element = element;
    this.originalText = element.innerText;
    this.chars = '!<>-_\\/[]{}—=+*^?#________';
    this.frame = 0;
    this.queue = [];
    this.resolving = false;

    this.update = this.update.bind(this);

    let counter = 0;
    for (let i = 0; i < this.originalText.length; i++) {
      const from = this.originalText[i];
      const to = this.originalText[i];
      const start = Math.floor(Math.random() * 40);
      const end = start + Math.floor(Math.random() * 40);
      this.queue.push({ from, to, start, end });
    }

    this.element.innerText = '';
    this.animate();
  }

  animate() {
    this.frameRequest = requestAnimationFrame(this.update);
  }

  update() {
    let output = '';
    let complete = 0;

    for (let i = 0, n = this.queue.length; i < n; i++) {
      let { from, to, start, end, char } = this.queue[i];

      if (this.frame >= end) {
        complete++;
        output += to;
      } else if (this.frame >= start) {
        if (!char || Math.random() < 0.28) {
          char = this.randomChar();
          this.queue[i].char = char;
        }
        output += `<span class="dud">${char}</span>`;
      } else {
        output += from;
      }
    }

    this.element.innerHTML = output;

    if (complete === this.queue.length) {
      cancelAnimationFrame(this.frameRequest);
      this.resolving = false;
    } else {
      this.frame++;
      this.frameRequest = requestAnimationFrame(this.update);
    }
  }

  randomChar() {
    return this.chars[Math.floor(Math.random() * this.chars.length)];
  }
}

// Initialization of Scramble on Titles
const titles = document.querySelectorAll('[data-scramble]');
const observerConfig = { threshold: 0.1 };

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const element = entry.target;
      if (!element.classList.contains('scrambled')) {
        new ScrambleText(element);
        element.classList.add('scrambled');
      }
    }
  });
}, observerConfig);

titles.forEach(title => {
  observer.observe(title);
});

// Hover Scramble Effect for Header Nav and Hero Socials
const navItems = document.querySelectorAll('.nav-item, .scramble-link');

navItems.forEach(link => {
  const originalText = link.getAttribute('data-text');
  let interval;
  let isAnimating = false;

  link.addEventListener('mouseenter', () => {
    if (isAnimating) return;
    isAnimating = true;

    let count = 0;
    const maxIterations = 20; // Approx 1 second at 50ms interval

    interval = setInterval(() => {
      // Generate random number string of same length
      let randomString = '';
      for (let i = 0; i < originalText.length; i++) {
        randomString += Math.floor(Math.random() * 10);
      }

      link.innerText = randomString;
      count++;

      if (count >= maxIterations) {
        clearInterval(interval);
        link.innerText = originalText;
        isAnimating = false;
      }
    }, 50);
  });
});

// Smooth Scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const targetId = this.getAttribute('href');
    if (targetId === '#' || !targetId) return;

    const targetElement = document.querySelector(targetId);
    if (targetElement) {
      targetElement.scrollIntoView({
        behavior: 'smooth'
      });
    }
  });
});

// Custom SoundCloud Player Initialization
window.addEventListener('load', () => {
  // Wait for SC API to be available
  const initPlayers = () => {
    if (!window.SC) {
      setTimeout(initPlayers, 500);
      return;
    }

    const playBtns = document.querySelectorAll('.play-btn');

    playBtns.forEach(btn => {
      const targetId = btn.getAttribute('data-target');
      const iframe = document.getElementById(targetId);
      if (!iframe) return;

      const widget = SC.Widget(iframe);
      const parentPlayer = btn.closest('.terminal-player');
      const statusIndicator = parentPlayer.querySelector('.status-indicator');
      const progressBar = parentPlayer.querySelector('.progress-bar-fill');
      const timeDisplay = parentPlayer.querySelector('.time-display');

      let isPlaying = false;
      let duration = 0;

      // Bind Events
      widget.bind(SC.Widget.Events.READY, () => {
        statusIndicator.textContent = '[ONLINE]';
        widget.getDuration((d) => {
          duration = d;
        });
      });

      widget.bind(SC.Widget.Events.PLAY, () => {
        isPlaying = true;
        statusIndicator.classList.add('active');
        statusIndicator.textContent = '[PLAYING]';
        btn.textContent = '[ STOP ]';
        btn.style.color = '#ff4444';
        btn.style.borderColor = '#ff4444';
      });

      widget.bind(SC.Widget.Events.PAUSE, () => {
        isPlaying = false;
        statusIndicator.classList.remove('active');
        statusIndicator.textContent = '[PAUSED]';
        btn.textContent = '[ RESUME ]';
        btn.style.color = ''; // Reset
        btn.style.borderColor = '';
      });

      widget.bind(SC.Widget.Events.PLAY_PROGRESS, (data) => {
        if (duration > 0) {
          const percent = (data.currentPosition / duration) * 100;
          progressBar.style.width = percent + '%';

          // Update time
          const curMin = Math.floor(data.currentPosition / 60000);
          const curSec = Math.floor((data.currentPosition % 60000) / 1000).toString().padStart(2, '0');
          const durMin = Math.floor(duration / 60000);
          const durSec = Math.floor((duration % 60000) / 1000).toString().padStart(2, '0');

          timeDisplay.textContent = `${curMin}:${curSec} / ${durMin}:${durSec}`;
        }
      });

      widget.bind(SC.Widget.Events.FINISH, () => {
        isPlaying = false;
        statusIndicator.classList.remove('active');
        statusIndicator.textContent = '[ONLINE]';
        btn.textContent = '[ REPLAY ]';
        progressBar.style.width = '0%';
      });

      // Button Click
      btn.addEventListener('click', () => {
        widget.toggle();
      });
    });
  };

  initPlayers();
});

// Sticky Player Logic
document.addEventListener('DOMContentLoaded', () => {
  const stickyPlayer = document.getElementById('stickyPlayer');
  const closePlayerBtn = document.getElementById('closePlayer');
  const embedContainer = document.getElementById('bandcamp-embed-container');
  const cardPlayBtns = document.querySelectorAll('.card-play-btn');

  cardPlayBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation(); // Stop parent anchor click

      // Show Player
      stickyPlayer.classList.add('active');

      const source = btn.getAttribute('data-source');

      if (source === 'soundcloud') {
        // SoundCloud Logic
        const trackId = btn.getAttribute('data-track-id');
        let scApiUrl = '';

        if (/^\d+$/.test(trackId)) {
          scApiUrl = `https%3A//api.soundcloud.com/tracks/${trackId}`;
        } else {
          scApiUrl = encodeURIComponent(trackId);
        }

        const embedUrl = `https://w.soundcloud.com/player/?url=${scApiUrl}&color=%23ff5500&auto_play=true&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true`;

        embedContainer.innerHTML = `<iframe width="100%" height="120" scrolling="no" frameborder="no" allow="autoplay *" src="${embedUrl}"></iframe>`;
      } else if (source === 'spotify') {
        // Spotify Logic
        const trackId = btn.getAttribute('data-track-id');
        // Add autoplay=1
        const embedUrl = `https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0&autoplay=1`;
        embedContainer.innerHTML = `<iframe style="border-radius:12px" src="${embedUrl}" width="100%" height="152" frameBorder="0" allowfullscreen="" allow="autoplay *; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
      } else {
        // Bandcamp Logic (Default)
        const albumId = btn.getAttribute('data-album-id');
        const bcTrackId = btn.getAttribute('data-bc-track-id');

        let embedUrl = '';

        if (bcTrackId) {
          // Track Embed - Add autoplay=true
          embedUrl = `https://bandcamp.com/EmbeddedPlayer/track=${bcTrackId}/size=large/bgcol=333333/linkcol=0f9159/artwork=small/transparent=true/autoplay=true/`;
        } else if (albumId) {
          // Album Embed - Add autoplay=true
          embedUrl = `https://bandcamp.com/EmbeddedPlayer/album=${albumId}/size=large/bgcol=333333/linkcol=0f9159/artwork=small/transparent=true/autoplay=true/`;
        }

        // Inject Iframe
        if (embedUrl) {
          embedContainer.innerHTML = `<iframe style="border: 0; width: 100%; height: 120px;" src="${embedUrl}" seamless allow="autoplay *"></iframe>`;
        }
      }
    });
  });

  closePlayerBtn.addEventListener('click', () => {
    stickyPlayer.classList.remove('active');
    embedContainer.innerHTML = ''; // Stop music
  });
});


// Video Terminal Logic
const playlistItems = document.querySelectorAll('.term-file');
const mainDisplay = document.getElementById('mainVideoDisplay');
const videoTitleDisplay = document.getElementById('videoTitleDisplay');
const videoStatus = document.getElementById('videoStatus');

if (mainDisplay && playlistItems.length > 0) {
  // Handle Playlist Clicks
  playlistItems.forEach(item => {
    item.addEventListener('click', () => {
      // Remove active class from all
      playlistItems.forEach(i => i.classList.remove('active'));
      // Add active to clicked
      item.classList.add('active');

      // Update Data
      const videoId = item.getAttribute('data-id');
      const title = item.getAttribute('data-title');

      // Update Main Screen
      mainDisplay.setAttribute('data-video-id', videoId);
      mainDisplay.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen style="position: absolute; top:0; left:0; width:100%; height:100%;"></iframe>`;

      videoTitleDisplay.textContent = title.toUpperCase();
      videoStatus.textContent = "> STATUS: PLAYING...";
    });
  });

  // Handle Main Screen Initial Click (Facade)
  mainDisplay.addEventListener('click', () => {
    if (mainDisplay.querySelector('iframe')) return; // Already playing
    const videoId = mainDisplay.getAttribute('data-video-id');
    mainDisplay.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen style="position: absolute; top:0; left:0; width:100%; height:100%;"></iframe>`;
  });
}


// Mobile Menu Toggle
const menuIcon = document.querySelector('.header-menu-icon');
const headerNav = document.querySelector('.header-nav');

if (menuIcon && headerNav) {
  menuIcon.addEventListener('click', () => {
    headerNav.classList.toggle('active');
    menuIcon.classList.toggle('is-open');
  });

  // Close menu when a link is clicked
  const navLinks = headerNav.querySelectorAll('a');
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      headerNav.classList.remove('active');
      menuIcon.classList.remove('is-open');
    });
  });
}


// Rawbeat Logo Interaction (Glitch & Dance)
const rawbeatLink = document.querySelector('.rawbeat-link');
if (rawbeatLink) {
  rawbeatLink.addEventListener('click', (e) => {
    e.preventDefault();

    // Trigger Glitch
    document.body.classList.add('system-failure');

    // Play harsh static sound if possible (optional, keeping silent for now as requested)

    // Remove after 1s
    setTimeout(() => {
      document.body.classList.remove('system-failure');
    }, 1000);
  });
}

// --- LOW PRIORITY LOGIC (Load Last) ---

// Smart Link Redirector (Isolated at Bottom)
(async function handleSmartRedirect() {
  const params = new URLSearchParams(window.location.search);
  const alias = params.get('go');

  if (alias) {
    // Basic redirect message
    document.documentElement.innerHTML = `<body style="background:#000; color:#0f0; display:flex; height:100vh; justify-content:center; align-items:center; font-family:monospace;">> REDIRECTING /${alias}...</body>`;

    try {
      // Dynamic import to isolate failures
      const { db, doc, getDoc, updateDoc, increment } = await import("./firebase.js");
      const linkRef = doc(db, "smart_links", "link_" + alias);
      const snap = await getDoc(linkRef);

      if (snap.exists()) {
        const data = snap.data();
        updateDoc(linkRef, { clicks: increment(1) });

        const webUrl = data.target;
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        let deepLink = null;

        if (isMobile) {
          if (webUrl.includes('amazon') || webUrl.includes('amzn')) {
            deepLink = 'amzn://open?url=' + encodeURIComponent(webUrl);
          } else if (webUrl.includes('spotify.com')) {
            deepLink = webUrl.replace('https://open.spotify.com/', 'spotify:').replace(/\//g, ':');
          } else if (webUrl.includes('instagram.com')) {
            deepLink = webUrl.replace('https://www.instagram.com/', 'instagram://user?username=').replace(/\/$/, '');
          }
        }

        if (deepLink) {
          window.location.href = deepLink;
          setTimeout(() => window.location.replace(webUrl), 500);
        } else {
          window.location.replace(webUrl);
        }
      } else {
        document.body.innerHTML = `<div style="color:red; font-family:monospace; padding:2rem;">ERROR: LINK /${alias} NOT FOUND</div>`;
      }
    } catch (e) {
      console.error("Redirect Error", e);
      window.location.href = "/";
    }
  }
})();
