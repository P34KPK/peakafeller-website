import { db, storage, collection, getDocs, doc, setDoc, deleteDoc, updateDoc, getDoc, ref, uploadBytesResumable, getDownloadURL } from './firebase.js';
import WaveSurfer from 'wavesurfer.js';

// Visualizer & Background Animation
const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');
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
const CHUNK_SIZE = 300 * 1024; // 300KB chunks

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
}

async function saveAudioFile(file, onProgress) {
  try {
    const base64Data = await fileToBase64(file);
    const totalLength = base64Data.length;
    const totalChunks = Math.ceil(totalLength / CHUNK_SIZE);
    const fileId = 'audio_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const chunkIds = [];

    console.log(`Starting upload for ${file.name}: ${totalLength} chars in ${totalChunks} chunks.`);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, totalLength);
      const chunkContent = base64Data.substring(start, end);
      const chunkId = `${fileId}_chunk_${i}`;

      await setDoc(doc(db, "audio_chunks", chunkId), {
        data: chunkContent,
        index: i,
        fileId: fileId,
        totalChunks: totalChunks
      });

      chunkIds.push(chunkId);

      if (onProgress) {
        const percent = ((i + 1) / totalChunks) * 100;
        onProgress(percent);
      }
    }
    return chunkIds;
  } catch (e) {
    console.error("Chunk upload failed:", e);
    throw e;
  }
}

async function loadAudioFile(chunkIds) {
  const chunkPromises = chunkIds.map(id => getDoc(doc(db, "audio_chunks", id)));
  const chunkSnaps = await Promise.all(chunkPromises);
  let fullDataUrl = '';
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
      console.log('File selected...');
      const file = e.target.files[0];
      if (file) {
        console.log('File:', file.name, file.size, file.type);
        try {
          const preview = document.getElementById('coverPreview');
          preview.innerHTML = '<p style="color:var(--color-accent); font-weight:bold;">COMPRESSING...</p>';

          coverFile = file;

          // Attempt compression
          try {
            coverImage = await compressImage(file, 600, 0.7);
            console.log('Compression success');
            preview.innerHTML = `<img src="${coverImage}" style="max-width:100%; border-radius:4px; border:1px solid #333;">`;
          } catch (compErr) {
            console.error("Compression error:", compErr);

            // Fallback if small enough
            if (file.size < 1024 * 1024) { // 1MB
              console.log('Falling back to direct base64');
              const reader = new FileReader();
              reader.onload = (re) => {
                coverImage = re.target.result;
                preview.innerHTML = `<img src="${coverImage}" style="max-width:100%; border-radius:4px;">`;
              };
              reader.readAsDataURL(file);
            } else {
              throw new Error("Image too large and compression failed. Please use a smaller image (<1MB).");
            }
          }
        } catch (err) {
          console.error("Image processing failed completely", err);
          alert("Error: " + err.message);
          document.getElementById('coverPreview').innerHTML = '<span style="color:red">Upload Failed</span>';
          coverImage = null;
        }
      }
    });
  } else {
    console.error('CRITICAL: coverUpload element not found in DOM');
  }

  const tracksUpload = document.getElementById('tracksUpload');
  if (tracksUpload) {
    tracksUpload.addEventListener('change', (e) => {
      console.log('Tracks input changed');
      const files = Array.from(e.target.files);
      files.forEach(file => {
        console.log('Adding track:', file.name);
        uploadedTracks.push({ name: file.name.replace('.mp3', ''), file: file, comments: [] });
      });
      console.log('Total tracks buffered:', uploadedTracks.length);
      renderTracksList();
    });
  }

  // Publish Button
  const publishBtn = document.getElementById('publishBtn');
  if (publishBtn) {
    publishBtn.addEventListener('click', async () => {
      const title = document.getElementById('albumTitle').value;

      console.log('Publish Clicked. Title:', title);
      console.log('Cover Image Present:', !!coverImage);
      console.log('Tracks Count:', uploadedTracks.length);

      if (!title || !coverImage || uploadedTracks.length === 0) {
        let missing = [];
        if (!title) missing.push("Title");
        if (!coverImage) missing.push("Cover Image");
        if (uploadedTracks.length === 0) missing.push("Tracks");

        alert('Missing fields: ' + missing.join(', '));
        return;
      }

      publishBtn.disabled = true;
      publishBtn.textContent = 'PUBLISHING...';

      try {
        const timestamp = Date.now();
        let uploadedTrackData = [];

        // Upload Tracks
        for (let i = 0; i < uploadedTracks.length; i++) {
          const track = uploadedTracks[i];
          console.log(`Starting upload for track ${i + 1}: ${track.name}`);

          publishBtn.textContent = `UPLOADING TRACK ${i + 1}/${uploadedTracks.length} (0%)...`;

          try {
            const chunkIds = await saveAudioFile(track.file, (percent) => {
              const p = Math.floor(percent);
              publishBtn.textContent = `UPLOADING TRACK ${i + 1}/${uploadedTracks.length} (${p}%)...`;
            });
            console.log(`Track ${i + 1} uploaded. Chunk IDs:`, chunkIds);
            uploadedTrackData.push({ name: track.name, chunkIds: chunkIds, comments: [] });
          } catch (trackError) {
            console.error(`Error uploading track ${track.name}:`, trackError);
            throw new Error(`Failed to upload ${track.name}. Check console for details.`);
          }
        }

        const album = {
          id: timestamp,
          title,
          cover: coverImage,
          tracks: uploadedTrackData,
          publishedAt: new Date().toISOString()
        };

        await DB.save(album);
        currentAlbums.push(album);

        // Reset
        document.getElementById('albumTitle').value = '';
        document.getElementById('coverPreview').innerHTML = '';
        uploadedTracks = [];
        coverImage = null;
        coverFile = null;
        renderTracksList();
        loadOwnerAlbums();

        publishBtn.textContent = 'PUBLISH FOR TESTING';
        publishBtn.disabled = false;
        alert('Album Published!');

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
        const modal = document.getElementById('ownerPasswordModal');
        if (modal) modal.style.display = 'flex';
      });
    }
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

function checkAccess() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  if (token) {
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

  if (currentUser && approvalData && approvalData.status === 'approved' && new Date() < new Date(approvalData.expiresAt)) {
    if (accessRequestForm) accessRequestForm.style.display = 'none';
    if (albumsGrid) albumsGrid.style.display = 'grid';
    if (donationSection) donationSection.style.display = 'block';
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

async function loadAccessRequests() {
  const list = document.getElementById('accessRequestsList');
  if (!list) return;
  const snap = await getDocs(collection(db, "requests"));
  let reqs = [];
  snap.forEach(d => reqs.push(d.data()));
  reqs = reqs.filter(r => r.status === 'pending').sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));

  if (reqs.length === 0) { list.innerHTML = '<p style="color:#666">No pending requests</p>'; return; }
  list.innerHTML = reqs.map(r => `
      <div class="access-request-item">
        <div>${escapeHTML(r.name)} <span style="color:#666">${escapeHTML(r.email)}</span></div>
        <div>
           <button onclick="approveRequest('${r.userId}')">APPROVE</button>
           <button onclick="denyRequest('${r.userId}')">DENY</button>
        </div>
      </div>
    `).join('');
}

window.approveRequest = async (userId) => {
  const snap = await getDocs(collection(db, "requests"));
  let docId = null;
  snap.forEach(d => { if (d.data().userId === userId) docId = d.id; });
  if (docId) {
    await updateDoc(doc(db, "requests", docId), { status: 'approved', approvedAt: new Date().toISOString() });
    loadAccessRequests(); loadTesterDashboard();
    alert('User Approved');
  }
};

window.denyRequest = async (userId) => {
  const snap = await getDocs(collection(db, "requests"));
  let docId = null;
  snap.forEach(d => { if (d.data().userId === userId) docId = d.id; });
  if (docId) {
    await updateDoc(doc(db, "requests", docId), { status: 'denied' });
    loadAccessRequests(); loadTesterDashboard();
  }
};

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
  currentAlbums = await DB.getAll();
  list.innerHTML = currentAlbums.map(a => `
      <div class="owner-album-item">
        <img src="${escapeHTML(a.cover)}" class="owner-album-cover">
        <div>${escapeHTML(a.title)} (${a.tracks.length} tracks)</div>
        <button onclick="deleteAlbum(${a.id})">DELETE</button>
      </div>
    `).join('');
}
window.deleteAlbum = async (id) => { if (confirm('Delete?')) { await DB.delete(id); loadOwnerAlbums(); } };

async function loadAlbums() {
  currentAlbums = await DB.getAll();
  const grid = document.getElementById('albumsGrid');
  if (!grid) return;
  if (currentAlbums.length === 0) { grid.innerHTML = '<div class="empty-state">No albums</div>'; return; }
  grid.innerHTML = currentAlbums.map(a => `
        <div class="album-card" onclick="openAlbum(${a.id})">
           <img src="${escapeHTML(a.cover)}" class="album-cover">
           <h3>${escapeHTML(a.title)}</h3>
        </div>
      `).join('');
}

window.openAlbum = (id) => {
  const album = currentAlbums.find(a => a.id === id);
  if (!album) return;
  const user = JSON.parse(localStorage.getItem('betaUser'));

  const tracksHTML = album.tracks.map((t, i) => {
    const myRating = (t.ratings || []).find(r => r.userId === user?.id)?.rating || 0;
    const stars = [1, 2, 3, 4, 5].map(s => `<span style="color:${s <= myRating ? '#ff6600' : '#444'}; cursor:pointer" onclick="rateTrack(${id},${i},${s})">★</span>`).join('');
    const myComments = (t.comments || []).filter(c => c.userId === user?.id);

    return `
          <div class="track-wrapper" style="margin-bottom:2rem;">
             <div class="track-head" style="display:flex; justify-content:space-between; color:#fff;">
                <span>${escapeHTML(t.name)}</span>
                <div>${stars}</div>
             </div>
             <div id="waveform-${i}" style="width:100%; margin:1rem 0;"></div>
             <button id="playBtn-${i}" class="play-btn-custom">PLAY</button>
             
             <!-- Comments -->
             <div style="background:#111; padding:1rem; margin-top:1rem;">
                ${myComments.map(c => `<div style="font-size:0.8rem; color:#ccc; border-bottom:1px solid #333; padding:0.5rem 0;">${escapeHTML(c.text)} <button onclick="deleteComment(${id},${i},'${c.id}')" style="color:red; float:right;">x</button></div>`).join('')}
                <div style="margin-top:1rem; display:flex;">
                   <input id="comment-${i}" placeholder="Private feedback..." style="flex:1; background:#000; border:1px solid #333; color:#fff; padding:0.5rem;">
                   <button onclick="addComment(${id},${i})">SAVE</button>
                </div>
             </div>
          </div>
        `;
  }).join('');

  document.getElementById('albumDetail').innerHTML = `
      <h2 style="color:var(--color-accent);">${escapeHTML(album.title)}</h2>
      ${tracksHTML}
    `;
  document.getElementById('albumModal').classList.add('active');

  // Init WaveSurfer
  window.activeWaveSurfers = window.activeWaveSurfers || [];
  window.activeWaveSurfers.forEach(ws => ws.destroy());
  window.activeWaveSurfers = [];

  album.tracks.forEach(async (t, i) => {
    const container = document.getElementById(`waveform-${i}`);
    if (!container) return;

    const ws = WaveSurfer.create({
      container: container,
      waveColor: '#444',
      progressColor: '#ff6600',
      height: 50,
      backend: 'WebAudio'
    });

    if (t.chunkIds) {
      ws.load(await loadAudioFile(t.chunkIds));
    } else {
      ws.load(t.url || t.data);
    }

    const btn = document.getElementById(`playBtn-${i}`);
    btn.onclick = () => ws.playPause();
    ws.on('play', () => {
      btn.textContent = 'PAUSE';
      try { window.connectAudioVisualizer(ws.getMediaElement()); } catch (e) { }
    });
    ws.on('pause', () => btn.textContent = 'PLAY');

    window.activeWaveSurfers.push(ws);
  });
};

window.closeModal = () => document.getElementById('albumModal').classList.remove('active');

window.rateTrack = async (aid, ti, r) => {
  const user = JSON.parse(localStorage.getItem('betaUser'));
  const album = currentAlbums.find(a => a.id === aid);
  const track = album.tracks[ti];
  if (!track.ratings) track.ratings = [];
  const existing = track.ratings.find(rt => rt.userId === user.id);
  if (existing) existing.rating = r; else track.ratings.push({ userId: user.id, rating: r });
  await DB.save(album);
  openAlbum(aid);
};

window.addComment = async (aid, ti) => {
  const text = document.getElementById(`comment-${ti}`).value;
  if (!text) return;
  const user = JSON.parse(localStorage.getItem('betaUser'));
  const album = currentAlbums.find(a => a.id === aid);
  if (!album.tracks[ti].comments) album.tracks[ti].comments = [];
  album.tracks[ti].comments.push({ id: Date.now().toString(), userId: user.id, text, timestamp: '0:00' });
  await DB.save(album);
  openAlbum(aid);
};

window.deleteComment = async (aid, ti, cid) => {
  const album = currentAlbums.find(a => a.id === aid);
  album.tracks[ti].comments = album.tracks[ti].comments.filter(c => c.id !== cid);
  await DB.save(album);
  openAlbum(aid);
};

// Hover Interactions
document.body.addEventListener('mouseover', (e) => {
  if (e.target.matches('button, a, input, .album-card')) document.body.classList.add('hovering');
  else document.body.classList.remove('hovering');
});
