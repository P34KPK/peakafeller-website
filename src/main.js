
import './style.css';
import { db, doc, getDoc, updateDoc, increment } from "./firebase.js";
// import './rawbeat.css';

// --- VISUALS MOVED TO src/visuals.js ---
// This ensures graphics load even if app logic fails.


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

// --- LOW PRIORITY LOGIC (Load Last) ---

// Smart Link Redirector (Isolated at Bottom)
(async function handleSmartRedirect() {
  const params = new URLSearchParams(window.location.search);
  const alias = params.get('go');

  if (alias) {
    // Basic redirect message
    document.documentElement.innerHTML = `<body style="background:#000; color:#0f0; display:flex; height:100vh; justify-content:center; align-items:center; font-family:monospace;">> REDIRECTING /${alias}...</body>`;

    try {
      // Logic uses static imports from top of file
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
