import { db, doc, getDoc, updateDoc, increment } from "./firebase.js";
import "./visual-reveal.js";

// --- INTERACTIVE ELEMENTS (Scramble, Menu, etc.) ---

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

// --- SOUND FX (Restored) ---
const SoundFX = {
  playBeep: () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      // High-tech short blip
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.1, ctx.currentTime); // Boosted from 0.03 to 0.1
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
      // Ignore audio policy errors
    }
  }
};

// Bind Sounds to Interactive Elements
document.addEventListener('DOMContentLoaded', () => {
  const interactives = document.querySelectorAll('a, button, .nav-item, .clickable');
  interactives.forEach(el => {
    el.addEventListener('mouseenter', () => SoundFX.playBeep());
  });
});

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

// Scroll Detection for Animation
let isScrollingTimer;
window.addEventListener('scroll', () => {
  document.body.classList.add('is-scrolling');
  clearTimeout(isScrollingTimer);
  isScrollingTimer = setTimeout(() => {
    document.body.classList.remove('is-scrolling');
  }, 100);
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
    // Handler function
    const handlePlay = (e) => {
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

        const existingIframe = embedContainer.querySelector('iframe');
        // Check if we already have a SoundCloud iframe we can reuse
        if (existingIframe && existingIframe.src.includes('soundcloud.com')) {
          // Reuse Widget for Seamless Playback
          try {
            const widget = SC.Widget(existingIframe);
            widget.load(scApiUrl, {
              auto_play: true,
              visual: true,
              hide_related: false,
              show_comments: true,
              show_user: true
            });
          } catch (err) {
            console.error("SC Widget Error", err);
          }
        } else {
          // First Load (Visual Player)
          const embedUrl = `https://w.soundcloud.com/player/?url=${scApiUrl}&color=%23ff5500&auto_play=true&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true`;
          embedContainer.innerHTML = `<iframe id="sc-widget-iframe" width="100%" height="120" scrolling="no" frameborder="no" allow="autoplay *" src="${embedUrl}"></iframe>`;
        }
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
    };

    // Attach listeners
    // Reverted to simple click to ensure stability. 
    // The CSS z-index fix should handle the touch overlap issues.
    btn.addEventListener('click', handlePlay);
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


// Mobile Menu Toggle - Wrapped in DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  const menuIcon = document.querySelector('.header-menu-icon');
  const headerNav = document.querySelector('.header-nav');

  if (menuIcon && headerNav) {
    // Note: Toggle is handled via inline onclick in index.html for maximum robustness.
    // Keeping this commented out to avoid double-toggling.
    /*
    menuIcon.addEventListener('click', (e) => {
      e.stopPropagation(); 
      headerNav.classList.toggle('active');
      menuIcon.classList.toggle('is-open');
    });
    */

    // Close menu when a link is clicked
    const navLinks = headerNav.querySelectorAll('a');
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        headerNav.classList.remove('active');
        menuIcon.classList.remove('is-open');
      });
    });
  }
});


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

// Shop Modal Logic
// Shop Modal Logic
document.addEventListener('DOMContentLoaded', () => {
  const shopOverlay = document.getElementById('shop-modal');
  const shopTrigger = document.getElementById('nav-shop-trigger');
  const shopCloseKey = document.getElementById('closeShopBtn');

  if (shopTrigger && shopOverlay) {
    shopTrigger.addEventListener('click', (e) => {
      e.preventDefault();
      shopOverlay.classList.add('active');
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
    });

    const closeShop = () => {
      shopOverlay.classList.remove('active');
      document.body.style.overflow = '';
    };

    if (shopCloseKey) shopCloseKey.addEventListener('click', closeShop);

    // Close on outside click
    shopOverlay.addEventListener('click', (e) => {
      if (e.target === shopOverlay) closeShop();
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && shopOverlay.classList.contains('active')) {
        closeShop();
      }
    });
  }
});

// Shop Price Scanner Simulation
const scannerElements = document.querySelectorAll('.shop-price-scanner');
if (scannerElements.length > 0) {
  const scanObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        if (!el.classList.contains('scanned')) {
          el.classList.add('scanned');
          simulateScan(el);
        }
      }
    });
  }, { threshold: 0.5 });

  scannerElements.forEach(el => scanObserver.observe(el));

  function simulateScan(element) {
    let iterations = 0;
    const maxIterations = 20; // 2 seconds approx
    const originalText = element.getAttribute('data-original');

    const interval = setInterval(() => {
      // Generate random price like format: 000.00
      const r1 = Math.floor(Math.random() * 999).toString().padStart(3, '0');
      const r2 = Math.floor(Math.random() * 99).toString().padStart(2, '0');
      element.innerText = `[ ${r1}.${r2} $ ]`;

      iterations++;
      if (iterations >= maxIterations) {
        clearInterval(interval);
        element.innerText = originalText;
        element.style.color = '#fff'; // Flash white/accent
        setTimeout(() => element.style.color = '', 500);
      }
    }, 80);
  }
}

// --- VISUAL ENHANCEMENTS (3D Tilt & Scroll Reveal) ---

// 1. 3D Tilt Effect for Cards
const cards = document.querySelectorAll('.spotify-card');

cards.forEach(card => {
  // Add glare element dynamically if not exists
  if (!card.querySelector('.glare')) {
    const glare = document.createElement('div');
    glare.classList.add('glare');
    card.appendChild(glare);
  }

  const glare = card.querySelector('.glare');

  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left; // x position within the element.
    const y = e.clientY - rect.top;  // y position within the element.

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -10; // Max rotation deg
    const rotateY = ((x - centerX) / centerX) * 10;

    // Apply rotation
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`;

    // Move Glare
    if (glare) {
      glare.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 80%)`;
      glare.style.opacity = '1';
    }
  });

  card.addEventListener('mouseleave', () => {
    card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
    if (glare) {
      glare.style.opacity = '0';
    }
  });
});


// 2. Scroll Reveal Animation
// Target more specific elements for better effect
const revealTargets = document.querySelectorAll('section, .spotify-card, .section-title, .gallery-item, .shop-item, .footer');
console.log('REVEAL: Found targets:', revealTargets.length);

const revealObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      // console.log('REVEAL: Revealing', entry.target);
      entry.target.classList.remove('pending');
      entry.target.classList.add('visible');
      observer.unobserve(entry.target); // Reveal only once for performance
    }
  });
}, {
  root: null,
  threshold: 0.01, // Trigger as soon as 1% is visible (Very Safe)
  rootMargin: "0px" // Standard margin
});

revealTargets.forEach(el => {
  // Add base class safely
  el.classList.add('reveal');

  // Don't hide Hero or elements currently in viewport on load
  const rect = el.getBoundingClientRect();
  const inView = (rect.top < window.innerHeight);

  if (!inView && !el.closest('.hero')) {
    el.classList.add('pending');
    revealObserver.observe(el);
  } else {
    el.classList.add('visible');
  }
});


// --- LOW PRIORITY LOGIC (Load Last) ---

// Smart Link Redirector (Isolated at Bottom)
(async function handleSmartRedirect() {
  const params = new URLSearchParams(window.location.search);
  const alias = params.get('go');
  const refParam = params.get('ref');

  // STATELESS REDIRECT (NO DB)
  if (refParam) {
    try {
      console.log(">> SMART LINK DETECTED:", refParam);
      let target;
      try {
        target = decodeURIComponent(atob(refParam));
      } catch (err) {
        console.warn("Legacy decode used");
        target = atob(refParam);
      }

      // Fix Amazon Short Links not opening App
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const isAmazon = target.includes('amazon') || target.includes('amzn.to');

      // Visual Feedback with Manual Button (Crucial for Mobile Intent)
      document.documentElement.innerHTML = `
         <head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
         <body style="background:#000; color:#fff; display:flex; flex-direction:column; height:100vh; justify-content:center; align-items:center; font-family:sans-serif;">
            <div style="margin-bottom:20px; color:#ff6600; font-weight:bold;">PEAKAFELLER REDIRECT</div>
            <div style="font-size:0.8rem; color:#666; margin-bottom:30px; max-width:80%; text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${target}</div>
            
            <button id="goBtn" style="background:#ff6600; color:black; border:none; padding:15px 30px; font-size:1rem; font-weight:bold; cursor:pointer; border-radius:4px;">
                OPEN LINK
            </button>
            <div style="margin-top:20px; font-size:0.7rem; color:#444;">Redirecting in 2s...</div>
         </body>`;

      const doRedirect = () => {
        // Deep Link Attempts
        if (isMobile) {
          if (target.includes('amazon') || target.includes('amzn.to')) {
            // Try to force Amazon App using scheme
            // This works for both short links (amzn.to) and long links
            const deep = `amazon://open?url=${encodeURIComponent(target)}`;

            // 1. Try Deep Link
            window.location.href = deep;

            // 2. Fallback to Web immediately (OS will handle priority)
            setTimeout(() => {
              window.location.href = target;
            }, 800);
          } else if (target.includes('spotify.com')) {
            window.location.href = target.replace('https://open.spotify.com/', 'spotify:').replace(/\//g, ':');
            setTimeout(() => window.location.href = target, 500);
          } else {
            window.location.href = target;
          }
        } else {
          window.location.href = target;
        }
      };

      // Bind Button
      setTimeout(() => {
        document.getElementById('goBtn').onclick = doRedirect;
      }, 50);

      // Auto Redirect
      setTimeout(doRedirect, 2000);

      return; // Stop execution
    } catch (e) {
      console.error("Invalid Ref", e);
    }
  }

  // LEGACY DB REDIRECT
  if (alias) {
    // Basic redirect message
    document.documentElement.innerHTML = `<body style="background:#000; color:#0f0; display:flex; height:100vh; justify-content:center; align-items:center; font-family:monospace;">> REDIRECTING /${alias}...</body>`;

    try {


      const linkRef = doc(db, "smart_links", "link_" + alias);
      const snap = await getDoc(linkRef);

      if (snap.exists()) {
        const data = snap.data();
        updateDoc(linkRef, { clicks: increment(1) });

        const webUrl = data.target;
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        let deepLink = null;

        if (isMobile) {
          if (webUrl.includes('spotify.com')) {
            // Spotify URI
            deepLink = webUrl.replace('https://open.spotify.com/', 'spotify:').replace(/\//g, ':');
          } else if (webUrl.includes('instagram.com')) {
            // Instagram
            const username = webUrl.split('instagram.com/')[1]?.split('/')[0];
            if (username) deepLink = `instagram://user?username=${username}`;
          } else if (webUrl.includes('youtube.com') || webUrl.includes('youtu.be')) {
            // YouTube
            deepLink = `vnd.youtube:${webUrl.split('v=')[1] || webUrl.split('/').pop()}`;
          } else if (webUrl.includes('amazon')) {
            // Amazon is tricky. Best bet on mobile is often just the HTTPS link which triggers Universal Links/App Links.
            // But we can try the scheme:
            deepLink = `amazon://content/item?ASIN=${webUrl.match(/\/([A-Z0-9]{10})/)?.[1]}`; // Try to extract ASIN
            if (!deepLink.includes('ASIN')) deepLink = null; // Fallback if no ASIN found
          }
        }

        if (deepLink) {
          console.log("Attempting Deep Link:", deepLink);
          const start = Date.now();
          window.location.href = deepLink;

          // Fallback if app doesn't open
          setTimeout(() => {
            if (document.hidden || document.webkitHidden) return; // App opened
            if (Date.now() - start < 3000) {
              window.location.replace(webUrl);
            }
          }, 2500);
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

// --- 4. SOUND FX (Agent A) ---
// --- 4. SOUND FX (Agent A) ---
class SoundController {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.isMuted = false;
    this.initialized = false;

    // Resume AudioContext on first user interaction
    const initAudio = () => {
      if (!this.initialized) {
        this.ctx.resume().then(() => {
          console.log("AudioContext Resumed");
          this.initialized = true;
        });
        // Remove listeners once initialized
        ['click', 'touchstart', 'keydown'].forEach(evt =>
          window.removeEventListener(evt, initAudio)
        );
      }
    };

    ['click', 'touchstart', 'keydown'].forEach(evt =>
      window.addEventListener(evt, initAudio)
    );
  }

  playTone(freq, type, duration, vol = 0.5) {
    // Force resume on every attempt if suspended (robustness)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(e => console.log("Audio resume failed", e));
    }

    if (this.ctx.state !== 'running') return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      // Standard Volume
      gain.gain.setValueAtTime(vol * 0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // console.warn("SFX Error:", e);
    }
  }

  hover() {
    // Revert to original High Tech Chirp
    this.playTone(800, 'sine', 0.05, 0.2);
  }

  click() {
    // Revert to original Confirm Beep
    this.playTone(400, 'square', 0.1, 0.3);
  }
}

// Global SFX Instance
const sfx = new SoundController();

// Unlock Audio Context Globallly on ANY interaction
const unlockAudio = () => {
  if (sfx.ctx.state === 'suspended') {
    sfx.ctx.resume();
  }
  // Don't remove listener immediately, keep it to ensure it catches eventually
};
['click', 'touchstart', 'keydown'].forEach(evt => window.addEventListener(evt, unlockAudio, { passive: true }));


// Event Delegation
document.addEventListener('mouseover', (e) => {
  if (e.target.closest('a, button, .nav-item, .term-file, .product-card')) {
    sfx.hover();
  }
});

document.addEventListener('click', (e) => {
  if (e.target.closest('a, button, .nav-item, .term-file, .product-card')) {
    sfx.click();
  }
});
