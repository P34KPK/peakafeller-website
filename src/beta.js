// import './beta.css';

// Same background animation as main site
const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');
let particles = [];
let scrollY = 0;
let scrollVelocity = 0;
let vortexStrength = 0;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

resizeCanvas();
// window.addEventListener('resize', resizeCanvas); // Handled below

class Particle {
  constructor() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.size = Math.random() * 2 + 0.5;
    this.speedX = (Math.random() - 0.5) * 0.5;
    this.speedY = (Math.random() - 0.5) * 0.5;
    this.opacity = Math.random() * 0.5 + 0.1;
    this.angle = 0;
  }

  update() {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const dx = centerX - this.x;
    const dy = centerY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (vortexStrength > 0.1) {
      const pullForce = vortexStrength * 0.02;
      const rotationForce = vortexStrength * 0.05;
      this.angle = Math.atan2(dy, dx);
      this.x += Math.cos(this.angle) * pullForce * (distance / 100);
      this.y += Math.sin(this.angle) * pullForce * (distance / 100);
      this.x += -Math.sin(this.angle) * rotationForce;
      this.y += Math.cos(this.angle) * rotationForce;
      const spiralAngle = this.angle + (vortexStrength * 0.1);
      this.x += Math.cos(spiralAngle) * 0.5;
      this.y += Math.sin(spiralAngle) * 0.5;
    } else {
      this.x += this.speedX + scrollY * 0.01;
      this.y += this.speedY;
    }

    if (this.x > canvas.width + 50) this.x = -50;
    if (this.x < -50) this.x = canvas.width + 50;
    if (this.y > canvas.height + 50) this.y = -50;
    if (this.y < -50) this.y = canvas.height + 50;
  }

  draw() {
    const vortexOpacity = this.opacity + (vortexStrength * 0.3);
    const vortexSize = this.size * (1 + vortexStrength * 0.5);
    ctx.fillStyle = `rgba(255, 102, 0, ${Math.min(vortexOpacity, 1)})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, vortexSize, 0, Math.PI * 2);
    ctx.fill();
  }
}

function initParticles() {
  particles = [];
  const particleCount = Math.floor((canvas.width * canvas.height) / 15000);
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
    if (Math.abs(canvas.width - oldWidth) > 50) {
      initParticles();
    }
  }, 100);
});

function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  vortexStrength *= 0.95;
  particles.forEach(particle => {
    particle.update();
    particle.draw();
  });
  requestAnimationFrame(animate);
}

animate();

let lastScrollY = 0;
window.addEventListener('scroll', () => {
  const currentScrollY = window.scrollY;
  scrollVelocity = currentScrollY - lastScrollY;
  if (scrollVelocity > 0) {
    vortexStrength = Math.min(vortexStrength + scrollVelocity * 0.05, 3);
  }
  scrollY = scrollVelocity;
  lastScrollY = currentScrollY;
  setTimeout(() => { scrollY *= 0.9; }, 50);
});

import { db, storage, collection, getDocs, doc, setDoc, deleteDoc, updateDoc, ref, uploadBytes, getDownloadURL } from './firebase.js';

// Beta Testing App Logic
// Firestore Helper
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
    // Ensure ID is string for Firestore doc
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

// Security: Escape HTML to prevent XSS
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

// Security: SHA-256 Hash for password (better than plain text)
async function checkPassword(input) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex === '94f7188ada6d383c589a8066f29c7f3772f6e6132fd55b30056dd5896fc2e8bc';
}

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing beta app...');

  const ownerMode = document.getElementById('ownerMode');
  const testerMode = document.getElementById('testerMode');
  const ownerPanel = document.getElementById('ownerPanel');
  const testerPanel = document.getElementById('testerPanel');
  const albumsGrid = document.getElementById('albumsGrid');
  const albumModal = document.getElementById('albumModal');

  console.log('Elements found:', {
    ownerMode: !!ownerMode,
    testerMode: !!testerMode,
    ownerPanel: !!ownerPanel,
    testerPanel: !!testerPanel,
    publishBtn: !!document.getElementById('publishBtn')
  });

  if (!ownerMode || !testerMode) {
    console.error('Critical elements not found!');
    return;
  }

  // Owner button opens password modal
  ownerMode.addEventListener('click', () => {
    const modal = document.getElementById('ownerPasswordModal');
    if (modal) {
      modal.style.display = 'flex';
    }
  });

  // Handle password submission
  const ownerPasswordSubmit = document.getElementById('ownerPasswordSubmit');
  const ownerPasswordInput = document.getElementById('ownerPasswordInput');

  if (ownerPasswordSubmit && ownerPasswordInput) {
    // Allow pressing "Enter" to submit
    ownerPasswordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        ownerPasswordSubmit.click();
      }
    });

    ownerPasswordSubmit.addEventListener('click', async () => {
      const password = ownerPasswordInput.value;
      if (!await checkPassword(password)) {
        alert('Incorrect password');
        return;
      }
      // Close modal
      const modal = document.getElementById('ownerPasswordModal');
      if (modal) modal.style.display = 'none';
      // Activate owner mode
      ownerMode.classList.add('active');
      testerMode.classList.remove('active');
      ownerPanel.style.display = 'block';
      testerPanel.style.display = 'none';
      // HOTFIX: Inject missing request for specific user if not present (Simulating sync)
      // Load requests from Firebase
      loadOwnerAlbums();
      loadAccessRequests();
      loadTesterDashboard();
      initShareLink();

      loadOwnerAlbums();
      loadAccessRequests();
      loadTesterDashboard();
      initShareLink();

      // Init Manual Invite
      document.getElementById('sendInviteBtn')?.addEventListener('click', () => {
        const name = document.getElementById('inviteName').value;
        const email = document.getElementById('inviteEmail').value;
        if (!name || !email) { alert('Enter name and email'); return; }

        // Generate Token
        const data = {
          n: name,
          e: email,
          x: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
          s: 'approved' // Secret status
        };

        const token = btoa(JSON.stringify(data));
        const link = `${window.location.origin}${window.location.pathname}?token=${token}`;

        const subject = "Welcome to PEAKAFELLER Beta Beat";
        const body = `Hello ${name},\n\nYou have been granted access to the Peakafeller Beta Testing program.\n\nCLICK HERE TO ACCESS:\n${link}\n\nEnjoy,\nPeakafeller`;

        window.open(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
      });
    });
  }

  testerMode.addEventListener('click', () => {
    console.log('Tester button clicked!');
    testerMode.classList.add('active');
    ownerMode.classList.remove('active');
    testerPanel.style.display = 'block';
    ownerPanel.style.display = 'none';
    checkAccess();
  });

  // Access Management Functions
  function initShareLink() {
    const baseUrl = window.location.origin + window.location.pathname;
    const shareUrl = `${baseUrl}?invite=true`;
    const shareLinkInput = document.getElementById('shareLink');
    if (shareLinkInput) {
      shareLinkInput.value = shareUrl;
    }
  }

  function checkAccess() {
    // Check for Magic Link Token
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (token) {
      try {
        const data = JSON.parse(atob(token));
        if (data.s === 'approved') {
          // Auto-register user
          const userId = 'user_' + Date.now();
          const user = { id: userId, name: data.n, email: data.e };

          localStorage.setItem('betaUser', JSON.stringify(user));

          const approvalData = {
            status: 'approved',
            expiresAt: new Date(data.x).toISOString()
          };
          localStorage.setItem('approvalData_' + userId, JSON.stringify(approvalData));

          // Add to Firebase Access List (for sync)
          // We can't write to the global access list without admin rights strictly speaking
          // But for this prototype we assume open write access to 'requests' collection or we use the Owner Panel flow.
          // Wait, if user is granting access via magic link, we don't necessarily update the 'requests' list 
          // unless the Owner generated the link which implies approval.
          // We should ideally add this user to the 'active_testers' collection.

          alert('ACCESS GRANTED! Welcome to Beta Beat.');

          alert('ACCESS GRANTED! Welcome to Beta Beat.');
          // Clear URL
          window.history.replaceState({}, document.title, window.location.pathname);

          // Reload to refresh view
          window.location.reload();
          return;
        }
      } catch (e) {
        console.error('Invalid token', e);
      }
    }

    const currentUser = JSON.parse(localStorage.getItem('betaUser')) || null;
    const approvalData = JSON.parse(localStorage.getItem('approvalData_' + (currentUser ? currentUser.id : ''))) || null;

    // Check expiration
    if (approvalData && approvalData.expiresAt) {
      if (new Date() > new Date(approvalData.expiresAt)) {
        alert('Your beta access has expired (30 days limit). Please request access again.');
        localStorage.removeItem('approvalData_' + currentUser.id);
      }
    }

    const accessRequestForm = document.getElementById('accessRequestForm');
    const albumsGrid = document.getElementById('albumsGrid');

    if (!accessRequestForm || !albumsGrid) {
      loadAlbums();
      return;
    }

    // Check if user is approved and not expired

    const donationSection = document.getElementById('donationSection');

    // Check if user is approved and not expired
    if (currentUser && approvalData && approvalData.status === 'approved' && new Date() < new Date(approvalData.expiresAt)) {
      accessRequestForm.style.display = 'none';
      albumsGrid.style.display = 'grid';
      if (donationSection) donationSection.style.display = 'block';
      loadAlbums();
    } else {
      // Not approved or no user
      accessRequestForm.style.display = 'block';
      albumsGrid.style.display = 'none';
      if (donationSection) donationSection.style.display = 'none';

      // If pending
      const requests = JSON.parse(localStorage.getItem('accessRequests')) || [];
      const myRequest = currentUser ? requests.find(r => r.userId === currentUser.id) : null;
      if (myRequest && myRequest.status === 'pending') {
        document.getElementById('testerName').value = myRequest.name;
        document.getElementById('testerEmail').value = myRequest.email;
        document.getElementById('testerName').disabled = true;
        document.getElementById('testerEmail').disabled = true;
        document.getElementById('requestAccessBtn').disabled = true;
        document.getElementById('requestStatus').textContent = 'Request sent! Waiting for approval...';
      }
    }
  }

  // Helper for crypto copy
  window.copyToClipboard = (btn, text) => {
    navigator.clipboard.writeText(text).then(() => {
      const originalText = btn.textContent;
      btn.textContent = 'COPIED!';
      setTimeout(() => {
        btn.textContent = originalText;
      }, 2000);
    });
  };

  async function loadAccessRequests() {
    const requestsList = document.getElementById('accessRequestsList');
    if (!requestsList) return;

    // Load from Firestore
    const querySnapshot = await getDocs(collection(db, "requests"));
    let accessRequests = [];
    querySnapshot.forEach((doc) => {
      accessRequests.push(doc.data());
    });

    // Sort by Date
    accessRequests.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));

    const pendingRequests = accessRequests.filter(r => r.status === 'pending');

    if (pendingRequests.length === 0) {
      requestsList.innerHTML = '<p style="color: #666; font-family: var(--font-mono); font-size: 0.8rem;">No pending requests</p>';
      return;
    }

    requestsList.innerHTML = pendingRequests.map(request => `
    <div class="access-request-item">
      <div class="request-info">
        <div class="request-name">${escapeHTML(request.name)}</div>
        <div class="request-email" style="font-size: 0.8rem; color: #888;">${escapeHTML(request.email)}</div>
        <div class="request-time">Requested ${new Date(request.requestedAt).toLocaleString()}</div>
      </div>
      <div class="request-actions">
        <button class="approve-btn" onclick="approveRequest('${escapeHTML(request.userId)}')">APPROVE</button>
        <button class="deny-btn" onclick="denyRequest('${escapeHTML(request.userId)}')">DENY</button>
      </div>
    </div>
  `).join('');
  }

  window.approveRequest = async (userId) => {
    // Get Request
    const querySnapshot = await getDocs(collection(db, "requests"));
    let requestDoc = null;
    let requestData = null;

    querySnapshot.forEach((docSnap) => {
      if (docSnap.data().userId === userId) {
        requestDoc = docSnap;
        requestData = docSnap.data();
      }
    });

    if (!requestData) return;

    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 30); // Add 30 days

    // Update Firestore
    const requestRef = doc(db, "requests", requestDoc.id);
    await updateDoc(requestRef, {
      status: 'approved',
      approvedAt: new Date().toISOString(),
      expiresAt: expirationDate.toISOString()
    });

    // Send Email
    const emailSubject = "Beta Access Granted";
    const emailBody = `Hello ${requestData.name},\n\nYou have been granted execution access to the Peakafeller Beta for 30 days.\nExpires: ${expirationDate.toLocaleDateString()}\n\nBest,\nPeakafeller`;

    window.open(`mailto:${requestData.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`);

    loadAccessRequests();
    loadTesterDashboard();
    alert(`Access granted for 30 days. Email client opened.`);
  };

  window.denyRequest = async (userId) => {
    // Get Request
    const querySnapshot = await getDocs(collection(db, "requests"));
    let requestRef = null;

    querySnapshot.forEach((docSnap) => {
      if (docSnap.data().userId === userId) {
        requestRef = doc(db, "requests", docSnap.id);
      }
    });

    if (requestRef) {
      await updateDoc(requestRef, { status: 'denied' });
    }

    loadAccessRequests();
    loadTesterDashboard();
    alert('User denied/ejected');
  };

  // --- Tester Dashboard Logic ---

  window.loadTesterDashboard = async () => {
    const dashboardList = document.getElementById('testerDashboardList');
    if (!dashboardList) return;

    // Load from Firestore
    const querySnapshot = await getDocs(collection(db, "requests"));
    let accessRequests = [];
    querySnapshot.forEach((doc) => {
      accessRequests.push(doc.data());
    });

    const approvedTesters = accessRequests.filter(r => r.status === 'approved');

    if (approvedTesters.length === 0) {
      dashboardList.innerHTML = '<p style="color:#666; font-family:var(--font-mono); font-size:0.8rem;">No active testers found.</p>';
      return;
    }

    dashboardList.innerHTML = approvedTesters.map(tester => `
      <div class="tester-item" style="display:flex; justify-content:space-between; align-items:center; background:#111; padding:1rem; border-bottom:1px solid #333; margin-bottom:0.5rem;">
        <div style="cursor:pointer;" onclick="openTesterStats('${tester.userId}')">
          <div style="font-weight:bold; color:var(--color-accent);">${escapeHTML(tester.name)}</div>
          <div style="font-size:0.8rem; color:#888;">${escapeHTML(tester.email)}</div>
          <div style="font-size:0.7rem; color:#555;">Joined: ${new Date(tester.approvedAt).toLocaleDateString()}</div>
        </div>
        <button class="delete-album-btn" style="padding:0.5rem; font-size:0.7rem;" onclick="ejectTester('${tester.userId}')">EJECT</button>
      </div>
    `).join('');
  };

  window.ejectTester = (userId) => {
    if (!confirm("Are you sure you want to eject this tester? They will lose access immediately.")) return;

    // Deny request
    window.denyRequest(userId);

    // Remove individual approval token (simulate logout for them)
    localStorage.removeItem('approvalData_' + userId);
  };

  window.openTesterStats = async (userId) => {
    try {
      const albums = await DB.getAll();

      // Get Tester Info
      const querySnapshot = await getDocs(collection(db, "requests"));
      let tester = null;
      querySnapshot.forEach(docSnap => {
        if (docSnap.data().userId === userId) tester = docSnap.data();
      });

      if (!tester) return;

      let activityHTML = '';
      let totalRatings = 0;
      let totalComments = 0;

      albums.forEach(album => {
        let albumActivity = '';
        album.tracks.forEach(track => {
          const ratingObj = (track.ratings || []).find(r => r.userId === userId);
          const userComments = (track.comments || []).filter(c => c.userId === userId);

          if (ratingObj || userComments.length > 0) {
            totalRatings += ratingObj ? 1 : 0;
            totalComments += userComments.length;

            const starStr = ratingObj ? '★'.repeat(ratingObj.rating) + '☆'.repeat(5 - ratingObj.rating) : 'Unrated';

            albumActivity += `
                 <div style="margin-bottom:1rem; padding:0.5rem; background:#222; border-radius:4px;">
                    <div style="font-weight:bold; color:#fff; font-size:0.9rem;">${escapeHTML(track.name)}</div>
                    <div style="font-size:0.8rem; color:#ff6600; margin:0.2rem 0;">Rating: ${starStr}</div>
                    ${userComments.length > 0 ? `
                      <div style="font-size:0.8rem; color:#aaa; margin-top:0.5rem;">Comments:</div>
                      <ul style="padding-left:1rem; margin:0; list-style:none;">
                        ${userComments.map(c => `<li style="font-size:0.8rem; border-left:2px solid #555; padding-left:0.5rem; margin-top:0.2rem; color:#ccc;">"${escapeHTML(c.text)}"</li>`).join('')}
                      </ul>
                    ` : ''}
                 </div>
               `;
          }
        });

        if (albumActivity) {
          activityHTML += `<h4 style="color:var(--color-accent); margin-top:1.5rem; border-bottom:1px solid #333; padding-bottom:0.5rem;">${escapeHTML(album.title)}</h4>` + albumActivity;
        }
      });

      if (!activityHTML) {
        activityHTML = '<p style="color:#666;">No activity recorded for this tester yet.</p>';
      }

      const statsContent = `
         <h2 style="font-family:var(--font-main); color:var(--color-accent); margin-bottom:0.5rem;">${escapeHTML(tester.name)}</h2>
         <p style="color:#888; font-family:var(--font-mono); font-size:0.8rem; margin-bottom:2rem;">${escapeHTML(tester.email)}</p>
         
         <div style="display:flex; gap:2rem; margin-bottom:2rem; background:#111; padding:1rem;">
            <div>
              <div style="font-size:1.5rem; font-weight:bold; color:#fff;">${totalRatings}</div>
              <div style="font-size:0.7rem; color:#666;">RATINGS</div>
            </div>
            <div>
              <div style="font-size:1.5rem; font-weight:bold; color:#fff;">${totalComments}</div>
              <div style="font-size:0.7rem; color:#666;">COMMENTS</div>
            </div>
         </div>

         <div style="max-height:400px; overflow-y:auto;">
           ${activityHTML}
         </div>
       `;

      document.getElementById('testerStatsContent').innerHTML = statsContent;
      document.getElementById('testerStatsModal').classList.add('active');

    } catch (e) {
      console.error(e);
      alert('Error loading stats');
    }
  };


  // Copy link handler
  document.getElementById('copyLinkBtn')?.addEventListener('click', () => {
    const shareLinkInput = document.getElementById('shareLink');
    if (shareLinkInput) {
      shareLinkInput.select();
      document.execCommand('copy');

      const copyBtn = document.getElementById('copyLinkBtn');
      const originalText = copyBtn.textContent;
      copyBtn.textContent = 'COPIED!';
      setTimeout(() => {
        copyBtn.textContent = originalText;
      }, 2000);
    }
  });

  // Request access handler
  // Request access handler
  // Request access handler
  document.getElementById('requestAccessBtn')?.addEventListener('click', async () => {
    const name = document.getElementById('testerName').value.trim();
    const email = document.getElementById('testerEmail').value.trim();

    if (!name || !email) {
      alert('Please enter your name and email');
      return;
    }

    const userId = 'user_' + Date.now().toString();
    const request = {
      userId: userId,
      name: name,
      email: email,
      requestedAt: new Date().toISOString(),
      status: 'pending'
    };

    // Save to Firestore
    try {
      // Use email as doc ID to prevent duplicates easily? Or random ID?
      // Let's use random but check email
      await setDoc(doc(db, "requests", userId), request);

      document.getElementById('testerEmail').disabled = true;
      document.getElementById('requestAccessBtn').disabled = true;
      document.getElementById('requestStatus').textContent = 'Request sent! Waiting for approval...';

      // Also send email as backup notification
      const subject = "Beta Access Request: " + name;
      const body = `Name: ${name}\nEmail: ${email}\n\nI would like to request access to the Peakafeller Beta Beat platform.`;
      window.location.href = `mailto:p34k.productions@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    } catch (e) {
      console.error("Error sending request: ", e);
      alert("Error sending request.");
    }
  });

  // Admin Tester Login
  document.getElementById('adminTesterLogin')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const modal = document.getElementById('ownerPasswordModal');

    // Check if we can reuse the modal or prompt
    // Since reusing the modal logic requires binding a specific callback, let's use prompt for simplicity 
    // OR create a temporary binding if we want to use the nice modal.
    // Let's use prompt for the "Admin Access" link to keep it simple as requested "simple password entry".

    const password = prompt("Enter Owner Password:");
    if (await checkPassword(password)) {
      const userId = 'admin_user';
      const user = { id: userId, name: 'Administrator', email: 'admin@peakafeller.com' };

      // Grant permanent access
      const expirationDate = new Date();
      expirationDate.setFullYear(expirationDate.getFullYear() + 99);

      const approvalData = {
        status: 'approved',
        expiresAt: expirationDate.toISOString()
      };

      localStorage.setItem('betaUser', JSON.stringify(user));
      localStorage.setItem('approvalData_' + userId, JSON.stringify(approvalData));

      alert('Access Granted as Admin');

      // Reload page to ensure all states form/grids are reset correctly
      window.location.reload();
    } else if (password !== null) {
      alert('Incorrect password');
    }
  });

  // Load Owner Albums
  async function loadOwnerAlbums() {
    const ownerAlbumsList = document.getElementById('ownerAlbumsList');
    try {
      currentAlbums = await DB.getAll();
    } catch (e) {
      console.error('Failed to load albums', e);
      currentAlbums = [];
    }


    if (currentAlbums.length === 0) {
      ownerAlbumsList.innerHTML = '<p style="color: #666; font-family: var(--font-mono); font-size: 0.8rem;">No albums published yet</p>';
      return;
    }

    ownerAlbumsList.innerHTML = currentAlbums.map(album => `
    <div class="owner-album-item">
      <img src="${escapeHTML(album.cover)}" class="owner-album-cover" alt="${escapeHTML(album.title)}">
      <div class="owner-album-info">
        <div class="owner-album-title">${escapeHTML(album.title)}</div>
        <div class="owner-album-meta">
          ${album.tracks.length} tracks • Published ${new Date(album.publishedAt).toLocaleDateString()}
          ${album.tracks.reduce((total, track) => total + (track.comments?.length || 0), 0)} comments
        </div>
      </div>
      <button class="delete-album-btn" onclick="deleteAlbum(${album.id})">DELETE</button>
    </div>
  `).join('');
  }

  // Delete Album
  window.deleteAlbum = async (albumId) => {
    if (!confirm('Are you sure you want to delete this album? All comments will be lost.')) {
      return;
    }

    try {
      await DB.delete(albumId);
      currentAlbums = currentAlbums.filter(a => a.id !== albumId);
      loadOwnerAlbums();
      alert('Album deleted successfully');
    } catch (e) {
      alert('Error deleting album');
    }
  };


  // Cover Upload
  document.getElementById('coverUpload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        coverImage = event.target.result;
        document.getElementById('coverPreview').innerHTML = `<img src="${coverImage}" alt="Cover">`;
      };
      reader.readAsDataURL(file);
    }
  });

  // Tracks Upload
  // Tracks Upload
  document.getElementById('tracksUpload').addEventListener('change', (e) => {
    const files = Array.from(e.target.files);

    if (files.length === 0) {
      return;
    }

    console.log(`Queued ${files.length} file(s) for upload...`);

    files.forEach(file => {
      if (!file.type.includes('audio')) {
        alert(`${file.name} is not an audio file`);
        return;
      }

      // Store File Object directly for upload later
      uploadedTracks.push({
        name: file.name.replace('.mp3', ''),
        file: file, // Keep raw file
        comments: []
      });

      renderTracksList();
    });

    // Reset input
    e.target.value = '';
  });

  function renderTracksList() {
    const tracksList = document.getElementById('tracksList');
    tracksList.innerHTML = uploadedTracks.map((track, index) => `
    <div class="track-item">
      <span class="track-name">${escapeHTML(track.name)}</span>
      <button class="track-remove" onclick="removeTrack(${index})">×</button>
    </div>
  `).join('');
  }

  window.removeTrack = (index) => {
    uploadedTracks.splice(index, 1);
    renderTracksList();
  };

  // Publish Album
  const publishBtn = document.getElementById('publishBtn');
  if (publishBtn) {
    publishBtn.addEventListener('click', async () => {
      console.log('Publish button clicked');
      const title = document.getElementById('albumTitle').value;

      console.log('Title:', title);
      console.log('Cover:', coverImage ? 'Yes' : 'No');
      console.log('Tracks:', uploadedTracks.length);

      if (!title || !coverImage || uploadedTracks.length === 0) {
        alert('Please fill all fields and upload at least one track');
        return;
      }

      // Logic moved inside try/catch block for async upload processing
      // Removing old sync object creation
      /* 
      const album = {
        id: Date.now(),
        title,
        cover: coverImage,
        tracks: uploadedTracks.slice(), // Create a copy
        publishedAt: new Date().toISOString()
      };
      */

      try {
        publishBtn.textContent = 'UPLOADING TO CLOUD... (0%)';
        publishBtn.disabled = true;

        const timestamp = Date.now();
        let uploadedTrackData = [];

        // 1. Upload Cover
        let coverUrl = coverImage; // Default if string (not implemented yet for file object logic here, keeping base64 for cover for now is okayish but storage better)
        // Note: For cover, existing code reads as DataURL. For optimization, we should upload it too.
        // Assuming coverImage is DataURL string. We can convert to blob or just keep as string for small images.
        // Let's keep cover as is for simplicity unless it's huge, but ideally upload.
        // For strictly following Recommendation 2, we focus on Audio which is heavy.

        // 2. Upload Tracks to Storage
        for (let i = 0; i < uploadedTracks.length; i++) {
          const track = uploadedTracks[i];
          publishBtn.textContent = `UPLOADING TRACK ${i + 1}/${uploadedTracks.length}...`;

          try {
            const storageRef = ref(storage, `albums/${timestamp}/${track.name}.mp3`);
            const snapshot = await uploadBytes(storageRef, track.file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            uploadedTrackData.push({
              name: track.name,
              url: downloadURL, // Store URL instead of data
              comments: []
            });
          } catch (err) {
            console.error("Upload failed for " + track.name, err);
            throw new Error("Upload failed for " + track.name);
          }
        }

        const album = {
          id: timestamp,
          title,
          cover: coverImage,
          tracks: uploadedTrackData,
          publishedAt: new Date().toISOString()
        };

        // 3. Save Metadata to Firestore
        await DB.save(album);
        currentAlbums.push(album);

        // Reset form
        document.getElementById('albumTitle').value = '';
        document.getElementById('coverPreview').innerHTML = '';
        uploadedTracks = [];
        coverImage = null;
        renderTracksList();
        loadOwnerAlbums();

        alert('Album published successfully! Tracks are hosted in the Cloud.');
      } catch (err) {
        if (err.name === 'QuotaExceededError' || err.message.includes('quota')) {
          alert('Storage limit reached! Even with 20MB+ support, the browser has set a limit. Try removing old albums.');
        } else {
          console.error('Publish error:', err);
          alert('An updated unexpected error occurred: ' + err.message);
        }
      } finally {
        publishBtn.textContent = 'PUBLISH FOR TESTING';
        publishBtn.disabled = false;
      }
    }); // Close async callback
  } // Close if(publishBtn) check


  // Load Albums (Tester View)
  async function loadAlbums() {
    try {
      currentAlbums = await DB.getAll();
    } catch (e) {
      currentAlbums = [];
    }

    if (currentAlbums.length === 0) {
      albumsGrid.innerHTML = `
      <div class="empty-state">
        <p>NO ALBUMS IN BETA TESTING</p>
        <p class="hint">Check back later for new releases</p>
      </div>
    `;
      return;
    }

    albumsGrid.innerHTML = currentAlbums.map(album => `
    <div class="album-card" onclick="openAlbum(${album.id})">
      <img src="${escapeHTML(album.cover)}" alt="${escapeHTML(album.title)}" class="album-cover">
      <div class="album-info">
        <h3 class="album-title">${escapeHTML(album.title)}</h3>
        <p class="album-meta">${album.tracks.length} tracks • ${new Date(album.publishedAt).toLocaleDateString()}</p>
      </div>
    </div>
  `).join('');
  }

  // Open Album Detail
  window.openAlbum = (albumId) => {
    const album = currentAlbums.find(a => a.id === albumId);
    if (!album) return;

    const currentUser = JSON.parse(localStorage.getItem('betaUser'));

    const detailHTML = `
    <h2 style="font-family: var(--font-main); font-size: 2rem; font-weight: 100; margin-bottom: 2rem; color: var(--color-accent);">
      ${escapeHTML(album.title)}
    </h2>
    <img src="${escapeHTML(album.cover)}" style="width: 100%; max-width: 400px; border-radius: 8px; margin-bottom: 2rem;">
    
    ${album.tracks.map((track, index) => {
      // Logic for Ratings
      const myRatingObj = (track.ratings || []).find(r => r.userId === currentUser?.id);
      const myRating = myRatingObj ? myRatingObj.rating : 0;

      // Star HTML Generator
      const starsHTML = [1, 2, 3, 4, 5].map(star => `
        <span class="star-rating ${star <= myRating ? 'active' : ''}" 
              onclick="rateTrack(${albumId}, ${index}, ${star})"
              style="cursor: pointer; color: ${star <= myRating ? '#ff6600' : '#444'}; font-size: 1.5rem;">
          ★
        </span>
      `).join('');

      // Filter Comments: Only show MINE
      const myComments = (track.comments || []).filter(c => c.userId === currentUser?.id);

      return `
      <div class="track-player">
        <div class="track-header">
          <span class="track-title">${escapeHTML(track.name)}</span>
          <div class="track-rating">
            ${starsHTML}
          </div>
        </div>
        <audio controls src="${track.data}" id="audio-${index}"></audio>
        
        <div class="comments-section">
          <h4 style="font-family: var(--font-mono); font-size: 0.8rem; margin-bottom: 0.5rem; color: #888;">YOUR PRIVATE NOTES:</h4>
          
          <div id="comments-${index}" style="margin-bottom: 1rem; max-height: 200px; overflow-y: auto; background: #111; padding: 0.5rem; border: 1px solid #333;">
            ${myComments.length === 0 ? '<div style="color:#555; text-align:center; font-size:0.8rem;">No notes yet.</div>' : ''}
            ${myComments.map(c => `
              <div class="comment-item" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem; border-bottom: 1px solid #222; padding-bottom: 0.5rem;">
                <div>
                   <div class="comment-timestamp" style="color: var(--color-accent); font-size: 0.7rem;">${escapeHTML(c.timestamp)}</div>
                   <div class="comment-content" style="font-size: 0.9rem;">${escapeHTML(c.text)}</div>
                </div>
                <div class="comment-actions">
                  <button onclick="editComment(${albumId}, ${index}, '${c.id}')" style="background:none; border:none; color:#fbcece; cursor:pointer; font-size:0.7rem; margin-right:0.5rem;">EDIT</button>
                  <button onclick="deleteComment(${albumId}, ${index}, '${c.id}')" style="background:none; border:none; color: #ff4444; cursor:pointer; font-size:0.7rem;">DEL</button>
                </div>
              </div>
            `).join('')}
          </div>

          <div class="comment-input">
            <input type="text" class="timestamp-input" id="timestamp-${index}" placeholder="0:00">
            <textarea class="comment-text" id="comment-${index}" placeholder="Add private feedback..."></textarea>
            <button class="comment-btn" onclick="addComment(${albumId}, ${index})">SAVE NOTE</button>
          </div>
        </div>
      </div>
      `;
    }).join('')}
  `;

    document.getElementById('albumDetail').innerHTML = detailHTML;
    albumModal.classList.add('active');
  };

  window.closeModal = () => {
    albumModal.classList.remove('active');
  };

  window.addComment = async (albumId, trackIndex) => {
    const timestamp = document.getElementById(`timestamp-${trackIndex}`).value;
    const text = document.getElementById(`comment-${trackIndex}`).value;

    if (!timestamp || !text) {
      alert('Please enter both timestamp and comment');
      return;
    }

    const currentUser = JSON.parse(localStorage.getItem('betaUser'));
    if (!currentUser) return;

    const albumIndex = currentAlbums.findIndex(a => a.id === albumId);
    if (!currentAlbums[albumIndex].tracks[trackIndex].comments) {
      currentAlbums[albumIndex].tracks[trackIndex].comments = [];
    }

    const newComment = {
      id: Date.now().toString(),
      userId: currentUser.id,
      timestamp,
      text,
      createdAt: new Date().toISOString()
    };

    currentAlbums[albumIndex].tracks[trackIndex].comments.push(newComment);

    // Save
    try {
      await DB.save(currentAlbums[albumIndex]);
      openAlbum(albumId); // Refresh
    } catch (e) {
      alert('Failed to save comment');
    }
  };

  // Rate Track Function
  window.rateTrack = async (albumId, trackIndex, rating) => {
    const currentUser = JSON.parse(localStorage.getItem('betaUser'));
    if (!currentUser) return;

    const albumIndex = currentAlbums.findIndex(a => a.id === albumId);
    const track = currentAlbums[albumIndex].tracks[trackIndex];

    if (!track.ratings) track.ratings = [];

    // Check if user already rated
    const existingRatingIndex = track.ratings.findIndex(r => r.userId === currentUser.id);
    if (existingRatingIndex >= 0) {
      track.ratings[existingRatingIndex].rating = rating;
    } else {
      track.ratings.push({ userId: currentUser.id, rating: rating });
    }

    try {
      await DB.save(currentAlbums[albumIndex]);
      openAlbum(albumId); // Refresh UI
    } catch (e) {
      console.error(e);
    }
  };

  // Delete Comment Function
  window.deleteComment = async (albumId, trackIndex, commentId) => {
    if (!confirm('Delete this comment?')) return;

    const albumIndex = currentAlbums.findIndex(a => a.id === albumId);
    const track = currentAlbums[albumIndex].tracks[trackIndex];

    track.comments = track.comments.filter(c => c.id !== commentId.toString());

    try {
      await DB.save(currentAlbums[albumIndex]);
      openAlbum(albumId); // Refresh
    } catch (e) {
      alert('Failed to delete comment');
    }
  };

  // Edit Comment Function (Simplified: Loads into input, deletes old)
  window.editComment = (albumId, trackIndex, commentId) => {
    const album = currentAlbums.find(a => a.id === albumId);
    const track = album.tracks[trackIndex];
    const comment = track.comments.find(c => c.id === commentId.toString());

    if (comment) {
      document.getElementById(`timestamp-${trackIndex}`).value = comment.timestamp;
      document.getElementById(`comment-${trackIndex}`).value = comment.text;
      // We delete the old one so "POST" creates the updated version
      deleteComment(albumId, trackIndex, commentId);
    }
  };

  // Initial load
  checkAccess();

  // Custom Cursor Logic


  // Hover Effect for interactive elements
  // Use event delegation for dynamic content
  document.body.addEventListener('mouseover', (e) => {
    if (e.target.matches('a, button, .album-card, input, .track-item, .modal-close') || e.target.closest('a, button, .album-card')) {
      document.body.classList.add('hovering');
    } else {
      document.body.classList.remove('hovering');
    }
  });

}); // End DOMContentLoaded

// Custom Cursor Logic
const cursor = document.getElementById('cursor');
const cursorBorder = document.getElementById('cursor-border');

if (cursor && cursorBorder) {
  document.addEventListener('mousemove', (e) => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';

    // Slight delay for the border to create drag effect
    setTimeout(() => {
      cursorBorder.style.left = e.clientX + 'px';
      cursorBorder.style.top = e.clientY + 'px';
    }, 50);
  });
}
