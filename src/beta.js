// Backup Key
const BACKUP_KEY = 'beta_albums_backup_v1';
import { db, storage, collection, getDocs, doc, setDoc, deleteDoc, updateDoc, getDoc, ref, uploadBytesResumable, getDownloadURL } from './firebase.js';
import WaveSurfer from 'wavesurfer.js';

// EXPOSE FIREBASE FOR UI SCRIPT
window.FB = { db, setDoc, doc, getDocs, collection };

// Visualizer & Background Animation
const canvas = document.getElementById('bg-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;
if (!ctx) console.warn("Canvas context missing in beta.js - Visuals disabled");
let particles = [];
let momentumY = 0;
let lastScrollY = window.scrollY;


function resizeCanvas() {
  if (canvas) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
}
resizeCanvas();

// --- IMAGE COMPRESSION HELPER ---
function compressImage(file, maxWidth = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

class Particle {
  constructor() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.size = Math.random() * 2 + 0.5;
    this.currentSize = this.size;
    this.baseSpeedX = (Math.random() - 0.5) * 1;
    this.baseSpeedY = (Math.random() - 0.5) * 1;
    this.opacity = Math.random() * 0.5 + 0.3;
  }

  update() {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const dx = centerX - this.x;
    const dy = centerY - this.y;
    const angle = Math.atan2(dy, dx);
    const distance = Math.sqrt(dx * dx + dy * dy);

    this.x += (Math.random() - 0.5) * 1.5;
    this.y += (Math.random() - 0.5) * 1.5;

    if (Math.abs(momentumY) > 0.5) {
      const speed = momentumY * 0.8;
      this.x += Math.cos(angle) * speed;
      this.y += Math.sin(angle) * speed;
      this.x -= Math.sin(angle) * (Math.abs(momentumY) * 0.1);
      this.y += Math.cos(angle) * (Math.abs(momentumY) * 0.1);

      if (momentumY > 0 && distance < 100) {
        this.x = Math.random() > 0.5 ? 0 : canvas.width;
        this.y = Math.random() * canvas.height;
      }
    } else {
      this.y -= 2.0;
      this.x += this.baseSpeedX;
      this.x += Math.sin(this.y * 0.01 + Date.now() * 0.002);
    }

    if (this.x > canvas.width) this.x = 0;
    if (this.x < 0) this.x = canvas.width;
    if (this.y > canvas.height) this.y = 0;
    if (this.y < 0) this.y = canvas.height;
  }
}

for (let i = 0; i < 150; i++) {
  particles.push(new Particle());
}

window.addEventListener('resize', resizeCanvas);
window.addEventListener('scroll', () => {
  const currentScrollY = window.scrollY;
  momentumY = currentScrollY - lastScrollY;
  lastScrollY = currentScrollY;
});

// Audio Visualizer Bridge
let audioAnalyser = null;
let dataArray = null;

window.connectAudioVisualizer = (audioElement) => {
  try {
    if (!audioAnalyser) {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioAnalyser = audioCtx.createAnalyser();
      audioAnalyser.fftSize = 256;
      dataArray = new Uint8Array(audioAnalyser.frequencyBinCount);

      const source = audioCtx.createMediaElementSource(audioElement);
      source.connect(audioAnalyser);
      audioAnalyser.connect(audioCtx.destination);
    }
  } catch (e) {
    console.log("Audio Context already initialized or CORS issue");
  }
};

function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  momentumY *= 0.95;
  if (Math.abs(momentumY) < 0.1) momentumY = 0;

  let bassEnergy = 0;
  if (audioAnalyser) {
    audioAnalyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < 20; i++) {
      sum += dataArray[i];
    }
    bassEnergy = (sum / 20) / 255;
  }

  particles.forEach(particle => {
    const pulse = 1 + (bassEnergy * 2);

    if (bassEnergy > 0.5) {
      particle.x += (Math.random() - 0.5) * 5 * bassEnergy;
      particle.y += (Math.random() - 0.5) * 5 * bassEnergy;
    }

    particle.currentSize = particle.size * pulse;
    particle.update();

    ctx.fillStyle = `rgba(${255}, ${102 + (bassEnergy * 150)}, ${bassEnergy * 200}, ${particle.opacity + bassEnergy})`;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.currentSize || particle.size, 0, Math.PI * 2);
    ctx.fill();
  });

  if (bassEnergy > 0.1) {
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    const sliceWidth = canvas.width / dataArray.length;
    let x = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * canvas.height / 2) + (canvas.height / 4);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.strokeStyle = `rgba(255, 255, 255, 0.1)`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  requestAnimationFrame(animate);
}
animate();

// Firestore Helper & Variables
// Helper to get pure Base64 from a Blob slice without loading whole file
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      // Strip "data:application/octet-stream;base64," header
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Low-memory sequential uploader
async function saveAudioFile(file, onProgress) {
  try {
    // Multiple of 3 bytes is mandatory for clean Base64 concatenation
    const CHUNK_SIZE_BYTES = 1024 * 1024; // 1MB binary chunks (balanced for network/memory)
    const totalBytes = file.size;
    const totalChunks = Math.ceil(totalBytes / CHUNK_SIZE_BYTES);
    const fileId = 'audio_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const chunkIds = [];

    console.log(`Starting ROBUST upload for ${file.name}: ${totalBytes} bytes in ${totalChunks} chunks.`);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE_BYTES;
      const end = Math.min(start + CHUNK_SIZE_BYTES, totalBytes);
      const blobSlice = file.slice(start, end);

      // Convert ONLY this slice to Base64
      let chunkContent = await blobToBase64(blobSlice);

      // Reconstruct Data URI header ONLY on the first chunk
      if (i === 0) {
        chunkContent = `data:${file.type};base64,${chunkContent}`;
      }

      const chunkId = `${fileId}_chunk_${i}`;

      await setDoc(doc(db, "audio_chunks", chunkId), {
        data: chunkContent,
        index: i,
        fileId: fileId,
        totalChunks: totalChunks
      });

      chunkIds.push(chunkId);

      // UI Update
      if (onProgress) {
        onProgress(((i + 1) / totalChunks) * 100);
      }

      // Garbage Collection Pause
      await new Promise(r => setTimeout(r, 100));
    }

    return chunkIds;
  } catch (e) {
    console.error(`UPLOAD FAILED at chunk ${chunkIds.length}:`, e);
    // Forward specific errors to UI logs
    if (e.code) console.error(`Code: ${e.code}`);
    throw e;
  }
}

async function loadAudioFile(chunkIds, onProgress) {
  let completed = 0;
  const total = chunkIds.length;

  // Wrap promises to track progress
  const chunkPromises = chunkIds.map(async (id) => {
    const snap = await getDoc(doc(db, "audio_chunks", id));
    completed++;
    if (onProgress) onProgress((completed / total) * 100);
    return snap;
  });

  const chunkSnaps = await Promise.all(chunkPromises);

  let fullDataUrl = '';
  // Reassemble in correct order (preserving index 0 to N)
  // Since map preserves order of promises, chunkSnaps matches chunkIds order?
  // Ideally chunkIds are sorted. We assume saveAudioFile produced them sorted.
  // But let's be safe: we rely on the order of chunkIds array.

  chunkSnaps.forEach(snap => {
    if (snap.exists()) {
      fullDataUrl += snap.data().data;
    }
  });
  return fullDataUrl;
}

const DB = {
  async getAll() {
    const querySnapshot = await getDocs(collection(db, "albums"));
    let albums = [];
    querySnapshot.forEach((doc) => {
      albums.push(doc.data());
    });
    return albums;
  },
  async save(album) {
    const idString = String(album.id);
    await setDoc(doc(db, "albums", idString), album);
  },
  async delete(id) {
    const idString = String(id);
    await deleteDoc(doc(db, "albums", idString));
  }
};

let currentAlbums = [];
let uploadedTracks = [];
let coverImage = null;
let coverFile = null;

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g,
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag]));
}

async function checkPassword(input) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex === '94f7188ada6d383c589a8066f29c7f3772f6e6132fd55b30056dd5896fc2e8bc';
}

// --- ROBUST DEBUG LOGGER (TOP LEVEL) ---
const logBuffer = [];
function flushLogs() {
  const debugDiv = document.getElementById('debugLog');
  if (debugDiv && logBuffer.length > 0) {
    logBuffer.forEach(({ msg, type }) => {
      const line = document.createElement('div');
      line.style.color = type === 'error' ? '#ff3333' : '#00ff00';
      line.style.marginBottom = '2px';
      line.style.borderBottom = '1px solid #222';
      line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
      debugDiv.appendChild(line);
    });
    logBuffer.length = 0; // Clear buffer
    debugDiv.scrollTop = debugDiv.scrollHeight;
  }
}

// Override Console Immediately
const originalLog = console.log;
const originalError = console.error;

function internalLog(type, args) {
  const msg = args.join(' ');
  const debugDiv = document.getElementById('debugLog');

  if (debugDiv) {
    // If DOM is ready, flush any old logs first, then write new one
    if (logBuffer.length > 0) flushLogs();

    const line = document.createElement('div');
    line.style.color = type === 'error' ? '#ff3333' : '#00ff00';
    line.style.marginBottom = '2px';
    line.style.borderBottom = '1px solid #222';
    line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    debugDiv.appendChild(line);
    debugDiv.scrollTop = debugDiv.scrollHeight;
  } else {
    // Buffer it
    logBuffer.push({ msg, type });
  }
}

console.log = (...args) => { originalLog(...args); internalLog('info', args); };
console.error = (...args) => { originalError(...args); internalLog('error', args); };

// Catch Global Errors
window.onerror = function (msg, source, lineno, colno, error) {
  console.error(`CRITICAL ERROR: ${msg} at ${source}:${lineno}`);
  return false;
};

// MAIN APP INITIALIZATION
function initApp() {
  console.log('Initializing Beta Backend... (v2.2 Buffered)');

  // Try to flush any logs that happened before DOM was ready
  setTimeout(flushLogs, 1000); // Give UI a moment to render

  if (!db) { console.error("Firebase DB not initialized!"); return; }

  // Hook for UI Script
  window.loadOwnerData = () => {
    loadOwnerAlbums();
    loadAccessRequests();
    loadTesterDashboard();
    initShareLink();
  };

  // File Inputs
  const coverUpload = document.getElementById('coverUpload');
  if (coverUpload) {
    console.log('Cover Upload input found, attaching listener...');
    coverUpload.addEventListener('change', async (e) => {
      console.log('File selected for upload...');
      const file = e.target.files[0];
      if (file) {
        console.log('File detected:', file.name, file.size, file.type);
        const preview = document.getElementById('coverPreview');
        preview.innerHTML = '<p style="color:var(--color-accent); font-weight:bold;">PROCESSING...</p>';

        // Safe Fallback Placeholder (Gradient)
        const SAFE_PLACEHOLDER = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKwOqAAAAABJRU5ErkJggg==";

        try {
          // Try to compress to 200px (Extra Small for Safety)
          coverImage = await compressImage(file, 200, 0.6);
          console.log('Compression Successful. Size:', coverImage.length);
          preview.innerHTML = `<img src="${coverImage}" style="max-width:100%; border-radius:4px; border:1px solid #0f0;">`;
        } catch (compErr) {
          console.warn("Compression Failed. Using Safe Placeholder.", compErr);
          coverImage = SAFE_PLACEHOLDER;
          preview.innerHTML = `<div style="width:100%; height:100px; background:#333; color:#fff; display:flex; align-items:center; justify-content:center; border:1px solid orange;">Cover Error (Using Default)</div>`;
        }
      }
    });
  } else {
    console.error('CRITICAL: coverUpload element not found in DOM');
  }

  // Manual Track Input Logic
  const addTrackBtn = document.getElementById('addManualTrackBtn');
  const trackInput = document.getElementById('trackNameInput');

  if (addTrackBtn && trackInput) {
    addTrackBtn.onclick = () => {
      const val = trackInput.value.trim();
      if (!val) return;
      const filename = val.includes('.') ? val : val + '.mp3';
      const nameDisplay = filename.replace(/\.[^/.]+$/, "");
      uploadedTracks.push({ name: nameDisplay, filename: filename, comments: [] });
      trackInput.value = '';
      renderTracksList();
    };
  }

  // Publish Button
  const publishBtn = document.getElementById('publishBtn');
  if (publishBtn) {
    publishBtn.addEventListener('click', async () => {
      const title = document.getElementById('albumTitle').value;
      const trackInputVal = document.getElementById('trackNameInput').value.trim();

      if (uploadedTracks.length === 0 && trackInputVal) {
        if (confirm(`You typed "${trackInputVal}" but didn't click "+ ADD TRACK". Add it now?`)) {
          document.getElementById('addManualTrackBtn').click();
          await new Promise(r => setTimeout(r, 100));
        }
      }

      console.log('--- PUBLISH CHECK ---');
      if (!title) return alert('❌ ERROR: Album Title is missing.');

      // Auto-recover cover if missing but present in DOM
      if (!coverImage) {
        const prev = document.getElementById('coverPreview');
        const imgTag = prev ? prev.querySelector('img') : null;
        if (imgTag && imgTag.src.startsWith('data:')) {
          coverImage = imgTag.src;
        } else {
          // PLAN B: No cover? Use placeholder automatically
          if (confirm("❌ Cover Missing. Use Default Placeholder?")) {
            coverImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKwOqAAAAABJRU5ErkJggg==";
          } else {
            return;
          }
        }
      }

      if (uploadedTracks.length === 0) return alert('❌ ERROR: No tracks added.');

      publishBtn.disabled = true;
      publishBtn.textContent = 'SAVING (PLAN B active)...';

      try {
        const timestamp = Date.now();
        console.log("Preparing Save...");

        // PLAN B ENFORCER: If cover is huge (>800KB), kill it.
        if (coverImage.length > 800000) {
          console.warn("Cover too big for DB. Using Safe Placeholder.");
          alert("⚠️ Cover image too large. Using default cover to ensure save.");
          coverImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKwOqAAAAABJRU5ErkJggg==";
        }

        const finalTracks = uploadedTracks.map(t => ({
          name: t.name,
          url: `./beta-tracks/${t.filename}`,
          comments: []
        }));

        let album = {
          id: timestamp,
          title,
          cover: coverImage,
          tracks: finalTracks,
          publishedAt: new Date().toISOString()
        };

        // Standard Save
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 15000));
        await Promise.race([DB.save(album), timeout]);

        console.log("Save Success");
        currentAlbums.push(album);

        // Reset UI
        document.getElementById('albumTitle').value = '';
        document.getElementById('coverPreview').innerHTML = '';
        uploadedTracks = [];
        coverImage = null;
        renderTracksList();

        await loadOwnerAlbums();

        publishBtn.textContent = 'PUBLISH FOR TESTING';
        publishBtn.disabled = false;
        alert('✅ Saved Successfully!');

      } catch (e) {
        console.error("Publish Error:", e);
        alert('Failed: ' + e.message);
        publishBtn.textContent = 'PUBLISH FOR TESTING';
        publishBtn.disabled = false;
      }
    });
  }

  // Request Access Button
  const requestBtn = document.getElementById('requestAccessBtn');
  if (requestBtn) {
    requestBtn.addEventListener('click', async () => {
      const name = document.getElementById('testerName').value;
      const email = document.getElementById('testerEmail').value;
      if (!name || !email) return alert('Enter name and email');

      requestBtn.textContent = 'SENDING...';
      const userId = 'user_' + Date.now();
      const request = { userId, name, email, requestedAt: new Date().toISOString(), status: 'pending' };

      try {
        await setDoc(doc(db, "requests", userId), request);
        localStorage.setItem('pendingBetaRequest', JSON.stringify(request));
        requestBtn.textContent = 'REQUEST SENT';
        requestBtn.disabled = true;

        setTimeout(() => {
          window.location.href = `mailto:p34k.productions@gmail.com?subject=Beta Access: ${name}&body=Requesting access...`;
        }, 1000);
      } catch (e) {
        alert("Error: " + e.message);
        requestBtn.textContent = 'REQUEST ACCESS';
      }
    });
    const adminLink = document.getElementById('adminTesterLogin');
    if (adminLink) {
      adminLink.addEventListener('click', (e) => {
        e.preventDefault();
        // Simulate Approved Tester Session
        const userId = 'admin_tester_' + Date.now();
        const user = { id: userId, name: "Admin Tester", email: "admin@peakafeller.com" };
        localStorage.setItem('betaUser', JSON.stringify(user));

        // precise expiration 24h
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        const approvalData = { status: 'approved', expiresAt: expiresAt.toISOString() };
        localStorage.setItem('approvalData_' + userId, JSON.stringify(approvalData));

        alert("Simulating Approved Tester Mode...");
        window.location.reload();
      });
    }
  }

  // --- DIAGNOSTIC TOOL ---
  const debugDiv = document.getElementById('debugLog');
  if (debugDiv) {
    const testBtn = document.createElement('button');
    testBtn.textContent = "[ RUN DB DIAGNOSTIC ]";
    testBtn.style.cssText = "background:#333; color:#fff; border:1px solid #555; padding:5px 10px; margin-top:10px; cursor:pointer; font-family:monospace; width:100%;";
    debugDiv.parentNode.insertBefore(testBtn, debugDiv.nextSibling);

    testBtn.onclick = async () => {
      console.log(">>> STARTING DATABASE DIAGNOSTIC...");
      try {
        const testId = "test_" + Date.now();
        // Write Test
        await setDoc(doc(db, "diagnostics", testId), {
          timestamp: new Date().toISOString(),
          test: "Can I write?"
        });
        console.log(">>> WRITE SUCCESS: Database is writable.");

        // Read Test
        const snap = await getDoc(doc(db, "diagnostics", testId));
        if (snap.exists()) console.log(">>> READ SUCCESS: Database is readable.");

        // Delete Test
        await deleteDoc(doc(db, "diagnostics", testId));
        console.log(">>> DELETE SUCCESS: Database is clean.");

        alert("DIAGNOSTIC PASSED: System is operational.");
      } catch (e) {
        console.error(">>> DIAGNOSTIC FAILED:", e);
        console.error(">>> ERROR CODE:", e.code || "Unknown");

        if (e.code === 'resource-exhausted') alert("FAIL: DAILY QUOTA EXCEEDED (Come back tomorrow)");
        else if (e.code === 'permission-denied') alert("FAIL: PERMISSION DENIED (Rules issue)");
        else alert("FAIL: " + e.message);
      }
    };
  }

  // Initial check
  checkAccess();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Global Helpers
function renderTracksList() {
  const list = document.getElementById('tracksList');
  if (list) {
    list.innerHTML = uploadedTracks.map((t, i) => `
          <div class="track-item">${escapeHTML(t.name)} <button onclick="removeTrack(${i})">x</button></div>
        `).join('');
  }
}
window.removeTrack = (i) => { uploadedTracks.splice(i, 1); renderTracksList(); };

function initShareLink() {
  const shareUrl = `${window.location.origin}${window.location.pathname}?invite=true`;
  const shareLinkInput = document.getElementById('shareLink');
  if (shareLinkInput) shareLinkInput.value = shareUrl;
}

// --- CHECK ACCESS Logic (Updated) ---
window.checkAccess = async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  // 1. Handle Invite Links (Unique Tokens)
  if (token && token.startsWith('inv_')) {
    await handleInviteToken(token);
    return;
  }

  // 2. Handle Old Legacy Base64 Tokens (if any still exist)
  if (token && !token.startsWith('inv_')) {
    try {
      const data = JSON.parse(atob(token));
      if (data.s === 'approved') {
        const userId = 'user_' + Date.now();
        const user = { id: userId, name: data.n, email: data.e };
        localStorage.setItem('betaUser', JSON.stringify(user));
        const approvalData = { status: 'approved', expiresAt: new Date(data.x).toISOString() };
        localStorage.setItem('approvalData_' + userId, JSON.stringify(approvalData));
        alert('ACCESS GRANTED! Welcome to Beta Beat.');
        window.history.replaceState({}, document.title, window.location.pathname);
        window.location.reload();
        return;
      }
    } catch (e) {
      console.error('Invalid token', e);
    }
  }

  const currentUser = JSON.parse(localStorage.getItem('betaUser'));
  const approvalData = JSON.parse(localStorage.getItem('approvalData_' + (currentUser ? currentUser.id : '')));
  const accessRequestForm = document.getElementById('accessRequestForm');
  const donationSection = document.getElementById('donationSection');
  const albumsGrid = document.getElementById('albumsGrid');

  // ACCESS RULE: Approved Tester OR Owner Session
  const isOwner = sessionStorage.getItem('peak_owner_session') === 'active';
  const isTester = currentUser && approvalData && approvalData.status === 'approved' && new Date() < new Date(approvalData.expiresAt);

  if (isOwner || isTester) {
    if (accessRequestForm) accessRequestForm.style.display = 'none';
    if (albumsGrid) albumsGrid.style.display = 'grid';
    if (donationSection) donationSection.style.display = 'block';

    console.log("Access Granted via:", isOwner ? "Owner Session" : "Tester Token");
    loadAlbums();
  } else {
    if (accessRequestForm) accessRequestForm.style.display = 'block';
    if (albumsGrid) albumsGrid.style.display = 'none';
    if (donationSection) donationSection.style.display = 'none';

    const pendingRequest = JSON.parse(localStorage.getItem('pendingBetaRequest'));
    if (pendingRequest) {
      const tName = document.getElementById('testerName');
      const tEmail = document.getElementById('testerEmail');
      const rBtn = document.getElementById('requestAccessBtn');
      const rStatus = document.getElementById('requestStatus');

      if (tName) tName.value = pendingRequest.name;
      if (tEmail) tEmail.value = pendingRequest.email;
      if (rBtn) {
        rBtn.textContent = 'REQUEST SENT';
        rBtn.disabled = true;
      }
      if (rStatus) rStatus.textContent = 'Request sent! Waiting for approval...';
    }
  }
}

// --- INVITE SYSTEM LOGIC ---

async function loadAccessRequests() {
  const list = document.getElementById('accessRequestsList');
  if (!list) return;

  // 1. Fetch Requests & Invites
  const reqSnap = await getDocs(collection(db, "requests"));
  const invSnap = await getDocs(collection(db, "invites"));

  let items = [];

  // Sort Requests
  reqSnap.forEach(d => {
    const data = d.data();
    if (data.status === 'pending') items.push({ type: 'request', ...data });
  });

  // Sort Invites
  invSnap.forEach(d => {
    items.push({ type: 'invite', ...d.data() });
  });

  // Sort Newest First
  items.sort((a, b) => new Date(b.date || b.requestedAt) - new Date(a.date || a.requestedAt));

  if (items.length === 0) { list.innerHTML = '<p style="color:#666">No pending activity.</p>'; return; }

  list.innerHTML = items.map(item => {
    if (item.type === 'request') {
      // REQUEST CARD
      return `
           <div class="access-request-item" style="border-left: 3px solid #ff6600;">
             <div>
                <span style="display:inline-block; background:#ff6600; color:#000; font-size:0.6rem; padding:2px 4px; border-radius:2px; margin-right:5px;">REQUEST</span>
                ${escapeHTML(item.name)} <span style="color:#666">${escapeHTML(item.email)}</span>
             </div>
             <div>
                <button onclick="approveRequest('${item.userId}')">APPROVE</button>
                <button onclick="denyRequest('${item.userId}')">DENY</button>
             </div>
           </div>`;
    } else {
      // INVITE CARD with STATUS
      let statusColor = '#888';
      let statusText = 'SENT';
      if (item.status === 'seen') { statusColor = '#0f0'; statusText = 'SEEN / JOINED'; }

      return `
           <div class="access-request-item" style="border-left: 3px solid #00ccff;">
             <div style="flex:1;">
                <span style="display:inline-block; background:#00ccff; color:#000; font-size:0.6rem; padding:2px 4px; border-radius:2px; margin-right:5px;">INVITE</span>
                <span style="color:#fff">${escapeHTML(item.email)}</span>
                <div style="font-size:0.75rem; color:${statusColor}; margin-top:4px;">
                    STATUS: ${statusText} • ${new Date(item.date).toLocaleDateString()}
                </div>
             </div>
             <div>
                <button onclick="copyInviteLink('${item.token}')" style="font-size:0.7rem;">COPY LINK</button>
             </div>
           </div>`;
    }
  }).join('');
}

window.approveRequest = async (userId) => {
  const snap = await getDocs(collection(db, "requests"));
  let docId = null;
  snap.forEach(d => { if (d.data().userId === userId) docId = d.id; });
  if (docId) {
    await updateDoc(doc(db, "requests", docId), { status: 'approved', approvedAt: new Date().toISOString() });
    loadAccessRequests();
    alert('User Approved');
  }
};

window.denyRequest = async (userId) => {
  const snap = await getDocs(collection(db, "requests"));
  let docId = null;
  snap.forEach(d => { if (d.data().userId === userId) docId = d.id; });
  if (docId) {
    await updateDoc(doc(db, "requests", docId), { status: 'denied' });
    loadAccessRequests();
  }
};


// --- SEND INVITE (New Feature) ---
window.sendAccessEmail = async () => {
  // We repurpose the "Send Access" UI or add a button logic here
  const email = prompt("Enter email to invite:");
  if (!email || !email.includes('@')) return;

  const token = 'inv_' + Date.now() + Math.random().toString(36).substr(2, 5);
  const link = `${window.location.origin}${window.location.pathname}?token=${token}`;

  // Save Invite
  await setDoc(doc(db, "invites", token), {
    email: email,
    token: token,
    date: new Date().toISOString(),
    status: 'sent'
  });

  // Try to open Mail Client automatically
  const subject = "Beta Access - Peakafeller";
  const body = `You are invited to the Beta Beat.\n\nClick here to access: ${link}`;
  window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  alert(`Invite Generated!\n\nThe status will update to 'SEEN' when they click the link.\n\n(If mail app didn't open, copy this link manually:\n${link})`);

  loadAccessRequests();
};

window.copyInviteLink = (token) => {
  const link = `${window.location.origin}${window.location.pathname}?token=${token}`;
  navigator.clipboard.writeText(link).then(() => alert("Link Copied!"));
};

// Update checkAccess to handle Invite Tokens
async function handleInviteToken(token) {
  try {
    const docRef = doc(db, "invites", token);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      // Update Status
      await updateDoc(docRef, { status: 'seen', seenAt: new Date().toISOString() });

      // Auto Login as Tester
      const data = snap.data();
      const user = { id: 'user_' + token, name: 'Invited User', email: data.email };
      localStorage.setItem('betaUser', JSON.stringify(user));

      // Set Approval
      const approvalData = { status: 'approved', expiresAt: new Date(Date.now() + 86400000 * 30).toISOString() }; // 30 Days
      localStorage.setItem('approvalData_' + user.id, JSON.stringify(approvalData));

      alert(`Welcome Beta Tester! (${data.email})`);

      // Strip token from URL
      window.history.replaceState({}, document.title, window.location.pathname);
      window.location.reload();
      return true;
    }
  } catch (e) { console.error("Invite Error", e); }
  return false;
}

// Hook into existing checkAccess (insert at start)
const originalCheckAccess = window.checkAccess; // (Not defined globally like that, we modify the function directly below)


// --- SMART LINKS LOGIC ---
window.switchOwnerTab = (tab) => {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab' + (tab === 'beta' ? 'Beta' : 'Links')).classList.add('active');

  document.getElementById('viewBeta').style.display = tab === 'beta' ? 'block' : 'none';
  document.getElementById('viewLinks').style.display = tab === 'links' ? 'block' : 'none';

  if (tab === 'links') loadSmartLinks();
};

// --- STATELESS SMART LINKS SYSTEM (NO FIREBASE) ---

// Load Links from Local Storage
window.loadSmartLinks = function () {
  const list = document.getElementById('smartLinksList');
  if (!list) return;

  try {
    const links = JSON.parse(localStorage.getItem('my_smart_links') || '[]');

    if (links.length === 0) {
      list.innerHTML = '<p style="color:#666; font-family:monospace;">No links created yet. Links are stored locally.</p>';
      return;
    }

    // Sort by Date (Newest first)
    links.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    list.innerHTML = links.map(l => {
      // Reconstruct the link
      const encoded = btoa(encodeURIComponent(l.target));
      const smartLink = `${window.location.origin}/?ref=${encoded}`;

      return `
            <div class="link-item">
                <div class="link-info">
                    <a href="${smartLink}" target="_blank" class="link-alias" 
                       style="color:var(--color-accent); text-decoration:underline; display:block; margin-bottom:0.2rem; cursor:pointer; font-weight:bold;">
                       ${l.alias} ↗
                    </a>
                    <div style="font-size:0.7em; color:#666; font-family:monospace; margin-bottom:4px;">${smartLink}</div>
                    <a href="${l.target}" target="_blank" class="link-target">${l.target}</a>
                    <div class="link-stats">Created: ${new Date(l.createdAt).toLocaleDateString()}</div>
                </div>
                <div class="link-actions">
                    <button class="copy-link-btn" onclick="copyToClipboard(this, '${smartLink}')">COPY</button>
                    <button class="delete-link-btn" onclick="deleteSmartLink('${l.id}')">DEL</button>
                </div>
            </div>`;
    }).join('');

  } catch (e) {
    console.error("Error loading links:", e);
    list.innerHTML = `<p style="color:red">Error: ${e.message}</p>`;
  }
};

// Create Action
window.createSmartLinkAction = async () => {
  const btn = document.getElementById('createLinkBtn');
  if (!btn) return;

  const target = document.getElementById('linkTarget').value.trim();
  let alias = document.getElementById('linkAlias').value.trim();

  if (!target) return alert("Target URL is required");
  if (!target.startsWith('http')) return alert("URL must start with http://");
  if (!alias) alias = "Link " + Math.floor(Math.random() * 1000); // Simple Label

  btn.disabled = true;
  const oldText = btn.innerText;
  btn.innerText = "SAVING...";

  try {
    // 1. Generate Stateless Link
    // Secure Encoding (supports Unicode/Special Chars)
    const encoded = btoa(encodeURIComponent(target));
    const fullLink = `${window.location.origin}/?ref=${encoded}`;

    // 2. Save to Local Storage (User's Library)
    const links = JSON.parse(localStorage.getItem('my_smart_links') || '[]');

    // Check for dupes in alias purely for organization
    if (links.find(l => l.alias === alias)) {
      if (!confirm(`Alias '${alias}' already exists locally. Overwrite?`)) throw new Error("Cancelled");
      // Remove old
      const idx = links.findIndex(l => l.alias === alias);
      links.splice(idx, 1);
    }

    links.push({
      id: Date.now().toString(),
      alias: alias,
      target: target,
      createdAt: new Date().toISOString()
    });

    localStorage.setItem('my_smart_links', JSON.stringify(links));

    alert(`SUCCESS! Smart Link Created.\n\nCopy it from the list below.`);

    // Reset
    document.getElementById('linkTarget').value = '';
    document.getElementById('linkAlias').value = '';
    window.loadSmartLinks();

  } catch (e) {
    console.error(e);
    if (e.message !== "Cancelled") alert("Failed: " + e.message);
  } finally {
    btn.disabled = false;
    btn.innerText = oldText;
  }
};

// Delete Action
window.deleteSmartLink = (id) => {
  if (confirm('Remove this link from your list? (The link itself will still work technically, as it is stateless)')) {
    const links = JSON.parse(localStorage.getItem('my_smart_links') || '[]');
    const newLinks = links.filter(l => l.id !== id);
    localStorage.setItem('my_smart_links', JSON.stringify(newLinks));
    window.loadSmartLinks();
  }
};

// Initialize Link Creator (Safe Auto-Run)
function initSmartLinksUI() {
  const createLinkBtn = document.getElementById('createLinkBtn');
  if (createLinkBtn) {
    console.log("Initializing Smart Links UI...");
    createLinkBtn.onclick = window.createSmartLinkAction;
  }
}

// Run immediately if DOM ready, or wait
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSmartLinksUI);
} else {
  initSmartLinksUI();
}

window.loadTesterDashboard = async () => {
  const list = document.getElementById('testerDashboardList');
  if (!list) return;
  const snap = await getDocs(collection(db, "requests"));
  let testers = []; snap.forEach(d => testers.push(d.data()));
  testers = testers.filter(r => r.status === 'approved');
  list.innerHTML = testers.map(t => `<div class="tester-item">${escapeHTML(t.name)} (${escapeHTML(t.email)})</div>`).join('');
};



async function loadOwnerAlbums() {
  const list = document.getElementById('ownerAlbumsList');
  if (!list) return;

  console.log("Loading Owner Albums...");
  let allAlbums = [];
  let source = 'Cloud';

  try {
    allAlbums = await DB.getAll();
    console.log(`Cloud returned ${allAlbums.length} albums.`);

    if (allAlbums && allAlbums.length > 0) {
      try { localStorage.setItem(BACKUP_KEY, JSON.stringify(allAlbums)); } catch (e) { }
    } else {
      // If cloud is empty, check backup. It might be a network glitch returning []
      const backup = localStorage.getItem(BACKUP_KEY);
      if (backup) {
        const localData = JSON.parse(backup);
        if (localData.length > 0) {
          console.warn("Cloud empty, but Backup found. Using Backup.");
          allAlbums = localData;
          source = 'Backup';
        }
      }
    }
  } catch (e) {
    console.error("Cloud Error. Switching to Backup.", e);
    const backup = localStorage.getItem(BACKUP_KEY);
    if (backup) { allAlbums = JSON.parse(backup); source = 'Backup'; }
  }

  // Sort Newest First (Robust Fallback)
  currentAlbums = allAlbums.sort((a, b) => {
    const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : (a.id || 0);
    const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : (b.id || 0);
    return dateB - dateA;
  });

  if (currentAlbums.length === 0) {
    list.innerHTML = '<div style="padding:20px; text-align:center; color:#666;">No albums found. <button onclick="loadOwnerAlbums()">Retry</button></div>';
    return;
  }

  list.innerHTML = currentAlbums.map(a => `
      <div class="owner-album-item">
        <img src="${escapeHTML(a.cover)}" class="owner-album-cover">
        <div class="owner-album-info">
            <div class="owner-album-title">
                ${escapeHTML(a.title)} 
                ${source === 'Backup' ? '<span style="color:orange; font-size:0.7em;">(OFFLINE)</span>' : ''}
            </div>
            <div class="owner-album-meta">
                ${a.tracks.length} tracks • ${a.publishedAt ? new Date(a.publishedAt).toLocaleDateString() : 'No Date'}
                <!-- VISIBILITY TOGGLE -->
                <div style="margin-top:5px; display:flex; align-items:center;">
                    <span style="font-size:0.8rem; color:${a.hidden ? '#666' : '#0f0'}">
                        ${a.hidden ? 'HIDDEN' : 'VISIBLE'} TO TESTERS
                    </span>
                    <label class="switch">
                      <input type="checkbox" ${!a.hidden ? 'checked' : ''} onchange="toggleAlbumVisibility(${a.id}, this.checked)">
                      <span class="slider round"></span>
                    </label>
                </div>
            </div>
        </div>
        <button class="delete-album-btn" onclick="deleteAlbum(${a.id})">DELETE</button>
  </div>
    `).join('');
}


window.toggleAlbumVisibility = async (id, isVisible) => {
  // ATOMIC UPDATE PATTERN
  // 1. Fetch fresh from DB to avoid staleness
  console.log(`Toggling album ${id} to ${isVisible ? 'VISIBLE' : 'HIDDEN'}...`);

  try {
    const docRef = doc(db, "albums", String(id));
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const album = snap.data();
      album.hidden = !isVisible; // If visible=true, hidden=false

      await setDoc(docRef, album);
      console.log("Visibility Saved to Cloud.");

      // Update local backup if needed
      await loadOwnerAlbums();
    } else {
      alert("Album not found in database.");
    }
  } catch (e) {
    console.error("Toggle Failed", e);
    alert("Error updating visibility: " + e.message);
  }
};

window.deleteAlbum = async (id) => {
  if (confirm('Delete this album permanently?')) {
    await DB.delete(id);
    loadOwnerAlbums();
  }
};

async function loadAlbums() {
  console.log("Loading Tester View...");
  const grid = document.getElementById('albumsGrid');
  if (!grid) return;
  grid.innerHTML = '<div style="color:#666; text-align:center; padding:20px;">Loading albums...</div>';

  try {
    // 1. Fetch
    const allAlbums = await DB.getAll();

    // 2. Sort Newest First
    const sortedAlbums = allAlbums.sort((a, b) => {
      const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : (a.id || 0);
      const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : (b.id || 0);
      return dateB - dateA;
    });

    // Update global state for Player to find them later
    currentAlbums = sortedAlbums;

    // 3. FILTER
    // Logic: Show ONLY if hidden is explicitly NOT true.
    // If 'hidden' is undefined, it defaults to visible.
    // If 'hidden' is false, it is visible.
    // If 'hidden' is true, it is hidden.
    const validAlbums = sortedAlbums.filter(a => {
      // Debug check
      // console.log(`Album ${a.id}: hidden = ${a.hidden} (${typeof a.hidden})`);
      return a.hidden !== true;
    });

    console.log(`Tester View: Found ${allAlbums.length}, Showing ${validAlbums.length}`);

    if (validAlbums.length === 0) {
      grid.innerHTML = '<div class="empty-state">No albums currently available for testing.</div>';
      return;
    }

    grid.innerHTML = validAlbums.map(a => `
            <div class="album-card" onclick="openAlbum(${a.id})">
            <img src="${escapeHTML(a.cover)}" class="album-cover">
            <div class="album-info">
                <h3 class="album-title">${escapeHTML(a.title)}</h3>
                <div class="album-meta">${a.tracks.length} tracks</div>
            </div>
            </div>
        `).join('');
  } catch (e) {
    console.error("Load Albums Error:", e);
    grid.innerHTML = `<div style="color:red">Error loading albums: ${e.message}</div>`;
  }
}


// --- MASTER PLAYER STATE ---
let currentPlaylist = [];
let currentTrackIndex = 0;
let activeWaveSurfer = null;
let activeAlbumId = null;

// Helper to format seconds to MM:SS
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

window.openAlbum = (id) => {
  const album = currentAlbums.find(a => a.id === id);
  if (!album) return;
  activeAlbumId = id;
  currentPlaylist = album.tracks;
  currentTrackIndex = 0;

  // 1. Render The Master Player Layout
  const modalContent = `
    <div class="master-player-container">
      <!-- FIXED HEADER: Waveform & Controls -->
      <div class="player-header">
         <div style="display:flex; justify-content:space-between; margin-bottom:1rem;">
             <h2 style="color:var(--color-accent); font-family:var(--font-main); margin:0;">${escapeHTML(album.title)}</h2>
             <button class="modal-close" onclick="closeModal()" style="position:static;">×</button>
         </div>

         <div class="player-main-info">
             <div class="player-track-title" id="mp-track-title">Loading...</div>
             <div style="font-size:0.8rem; color:#888;" id="mp-time-display">0:00 / 0:00</div>
         </div>

         <!-- SINGLE HUGE WAVEFORM -->
         <div id="master-waveform" class="large-waveform-container"></div>

         <div class="player-controls">
             <button class="ctrl-btn" onclick="prevTrack()">⏮</button>
             <button class="ctrl-btn play-btn-large" id="mp-play-btn" onclick="togglePlay()">▶</button>
             <button class="ctrl-btn" onclick="nextTrack()">⏭</button>
         </div>
      </div>

      <!-- SCROLLABLE CONTENT: Playlist & Comments -->
      <div class="player-content-scroll">
          <!-- LEFT: Playlist -->
          <div class="playlist-side" id="mp-playlist"></div>

          <!-- RIGHT: Comments for current track -->
          <div class="comments-side">
              <h3 style="font-size:0.9rem; color:#fff; border-bottom:1px solid #333; padding-bottom:0.5rem; margin-bottom:0.5rem;">
                COMMENTS <span id="mp-comment-count" style="color:#666; font-size:0.7rem;">(0)</span>
              </h3>
              <div id="mp-comments-feed" class="comment-feed"></div>
              
              <div class="comment-input-area">
                  <input type="text" id="mp-comment-input" class="input-field" placeholder="Type feedback at current time..." style="flex:1;">
                  <button class="comment-btn" onclick="postTimestampComment()">POST</button>
              </div>
          </div>
      </div>
    </div>
  `;

  document.getElementById('albumDetail').innerHTML = modalContent;
  document.getElementById('albumModal').classList.add('active');

  // 2. Initialize Single WaveSurfer Instance
  if (activeWaveSurfer) activeWaveSurfer.destroy();

  activeWaveSurfer = WaveSurfer.create({
    container: '#master-waveform',
    waveColor: 'rgba(255, 255, 255, 0.3)',
    progressColor: '#ff6600',
    cursorColor: '#fff',
    barWidth: 2,
    barGap: 3,
    height: 128,
    backend: 'WebAudio', // Necessary for visualizer connection
    responsive: true,
  });

  // Events
  activeWaveSurfer.on('play', () => {
    document.getElementById('mp-play-btn').innerHTML = '⏸';
    try { window.connectAudioVisualizer(activeWaveSurfer.getMediaElement()); } catch (e) { }
  });
  activeWaveSurfer.on('pause', () => document.getElementById('mp-play-btn').innerHTML = '▶');
  activeWaveSurfer.on('audioprocess', () => {
    const cur = activeWaveSurfer.getCurrentTime();
    const dur = activeWaveSurfer.getDuration();
    document.getElementById('mp-time-display').innerText = `${formatTime(cur)} / ${formatTime(dur)}`;
  });
  activeWaveSurfer.on('finish', () => nextTrack());

  // 3. Load First Track
  loadTrack(0);
};

// --- MASTER PLAYER ADDICIONAL LOGIC ---

window.loadTrack = async (index) => {
  if (index < 0 || index >= currentPlaylist.length) return;
  currentTrackIndex = index;
  const track = currentPlaylist[index];

  // Update UI Titles
  document.getElementById('mp-track-title').innerText = `${index + 1}. ${track.name}`;

  // Update Playlist Highlight
  renderPlaylist();
  // Render Comments
  renderComments();

  // Load Audio
  const playBtn = document.getElementById('mp-play-btn');
  playBtn.disabled = true;
  playBtn.style.opacity = '0.5';

  if (track.chunkIds) {
    try {
      const audioData = await loadAudioFile(track.chunkIds, (pct) => {
        document.getElementById('mp-track-title').innerText = `Loading... ${Math.floor(pct)}%`;
      });
      activeWaveSurfer.load(audioData);
      document.getElementById('mp-track-title').innerText = `${index + 1}. ${track.name}`;
    } catch (e) {
      console.error(e);
      alert("Error loading track audio");
    }
  } else {
    // Legacy or direct URL
    activeWaveSurfer.load(track.url || track.data);
  }

  // Auto-play when ready
  activeWaveSurfer.once('ready', () => {
    playBtn.disabled = false;
    playBtn.style.opacity = '1';
    activeWaveSurfer.play();
    const dur = activeWaveSurfer.getDuration();
    document.getElementById('mp-time-display').innerText = `0:00 / ${formatTime(dur)}`;
  });
};

window.togglePlay = () => {
  if (activeWaveSurfer.isPlaying()) activeWaveSurfer.pause();
  else activeWaveSurfer.play();
};

window.prevTrack = () => loadTrack(currentTrackIndex - 1);
window.nextTrack = () => loadTrack(currentTrackIndex + 1);

window.seekTo = (seconds) => {
  if (activeWaveSurfer) {
    activeWaveSurfer.setTime(seconds);
    activeWaveSurfer.play();
  }
};

function renderPlaylist() {
  const list = document.getElementById('mp-playlist');
  const user = JSON.parse(localStorage.getItem('betaUser'));

  list.innerHTML = currentPlaylist.map((t, i) => {
    const isActive = i === currentTrackIndex ? 'active' : '';
    const myRating = (t.ratings || []).find(r => r.userId === user?.id)?.rating || 0;

    // Stars Logic
    const stars = [1, 2, 3, 4, 5].map(s => `
            <span onclick="event.stopPropagation(); rateMasterTrack(${i},${s})" 
                  style="color:${s <= myRating ? '#ff6600' : '#444'}; cursor:pointer; font-size:1.2rem;">★</span>
        `).join('');

    return `
        <div class="playlist-item ${isActive}" onclick="loadTrack(${i})">
            <div>
                <div style="font-weight:600; color:#fff;">${i + 1}. ${escapeHTML(t.name)}</div>
                <div style="font-size:0.75rem; color:#666;">${t.comments?.length || 0} comments</div>
            </div>
            <div title="Rate this track">${stars}</div>
        </div>
        `;
  }).join('');
}

function renderComments() {
  const container = document.getElementById('mp-comments-feed');
  container.innerHTML = '';
  const track = currentPlaylist[currentTrackIndex];
  const comments = track.comments || [];

  // Sort by timestamp if available (legacy comments might not have seconds)
  comments.sort((a, b) => (a.seconds || 0) - (b.seconds || 0));

  document.getElementById('mp-comment-count').innerText = `(${comments.length})`;

  if (comments.length === 0) {
    container.innerHTML = '<div style="color:#666; font-style:italic; padding:1rem;">No comments yet. Be the first!</div>';
    return;
  }

  const user = JSON.parse(localStorage.getItem('betaUser'));

  container.innerHTML = comments.map(c => {
    const timeStr = c.formattedTime || c.timestamp || "0:00";
    const seconds = c.seconds || 0;
    const isMine = c.userId === user?.id;

    return `
        <div class="comment-card">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span class="timestamp-badge" onclick="seekTo(${seconds})">▶ ${timeStr}</span>
                ${isMine ? `<button onclick="deleteMasterComment('${c.id}')" style="color:#ff3333; background:none; border:none; cursor:pointer;">×</button>` : ''}
            </div>
            <div style="color:#ccc;">${escapeHTML(c.text)}</div>
        </div>
        `;
  }).join('');
}


// --- ACTIONS ---

window.rateMasterTrack = async (trackIndex, rating) => {
  const user = JSON.parse(localStorage.getItem('betaUser'));
  const album = currentAlbums.find(a => a.id === activeAlbumId);
  const track = album.tracks[trackIndex];

  if (!track.ratings) track.ratings = [];
  const existing = track.ratings.find(rt => rt.userId === user.id);
  if (existing) existing.rating = rating; else track.ratings.push({ userId: user.id, rating });

  await DB.save(album);
  currentPlaylist = album.tracks; // Update local state
  renderPlaylist(); // Re-render only playlist UI
};

window.postTimestampComment = async () => {
  const input = document.getElementById('mp-comment-input');
  const text = input.value.trim();
  if (!text) return;

  const currentTime = activeWaveSurfer.getCurrentTime();
  const formattedTime = formatTime(currentTime);

  const user = JSON.parse(localStorage.getItem('betaUser'));
  const album = currentAlbums.find(a => a.id === activeAlbumId);
  const track = album.tracks[currentTrackIndex];

  if (!track.comments) track.comments = [];

  track.comments.push({
    id: Date.now().toString(),
    userId: user.id,
    text: text,
    timestamp: formattedTime, // Legacy support
    formattedTime: formattedTime,
    seconds: currentTime
  });

  await DB.save(album);
  currentPlaylist = album.tracks;

  input.value = '';
  renderComments();
};

window.deleteMasterComment = async (commentId) => {
  if (!confirm("Delete comment?")) return;
  const album = currentAlbums.find(a => a.id === activeAlbumId);
  const track = album.tracks[currentTrackIndex];
  track.comments = track.comments.filter(c => c.id !== commentId);

  await DB.save(album);
  currentPlaylist = album.tracks;
  renderComments();
};

window.closeModal = () => {
  if (activeWaveSurfer) activeWaveSurfer.destroy();
  activeWaveSurfer = null;
  document.getElementById('albumModal').classList.remove('active');
};

// Hover Interactions
document.body.addEventListener('mouseover', (e) => {
  if (e.target.matches('button, a, input, .album-card')) document.body.classList.add('hovering');
  else document.body.classList.remove('hovering');
});
