import './beta.css';

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
window.addEventListener('resize', resizeCanvas);

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
window.addEventListener('resize', initParticles);

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

// Beta Testing App Logic
let currentAlbums = JSON.parse(localStorage.getItem('betaAlbums')) || [];
let uploadedTracks = [];
let coverImage = null;

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

    ownerPasswordSubmit.addEventListener('click', () => {
      const password = ownerPasswordInput.value;
      if (password !== 'sebasPK123') {
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
      loadOwnerAlbums();
      loadAccessRequests();
      initShareLink();
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
    const urlParams = new URLSearchParams(window.location.search);
    const isInvite = urlParams.get('invite') === 'true';
    const currentUser = JSON.parse(localStorage.getItem('betaUser')) || null;
    const approvalData = JSON.parse(localStorage.getItem('approvalData_' + (currentUser ? currentUser.id : ''))) || null;

    // Check expiration
    if (approvalData && approvalData.expiresAt) {
      if (new Date() > new Date(approvalData.expiresAt)) {
        alert('Your beta access has expired (30 days limit). Please request access again.');
        localStorage.removeItem('approvalData_' + currentUser.id);
        const accessRequests = JSON.parse(localStorage.getItem('accessRequests')) || [];
        // Reset status to pending or removed? Let's just reset local state for now so they see the form
        // Realistically we should update the central request list, but local storage sync is tricky without backend.
        // We will just show the form again.
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

  function loadAccessRequests() {
    const requestsList = document.getElementById('accessRequestsList');
    if (!requestsList) return;

    const accessRequests = JSON.parse(localStorage.getItem('accessRequests')) || [];
    const pendingRequests = accessRequests.filter(r => r.status === 'pending');

    if (pendingRequests.length === 0) {
      requestsList.innerHTML = '<p style="color: #666; font-family: var(--font-mono); font-size: 0.8rem;">No pending requests</p>';
      return;
    }

    requestsList.innerHTML = pendingRequests.map(request => `
    <div class="access-request-item">
      <div class="request-info">
        <div class="request-name">${request.name}</div>
        <div class="request-email" style="font-size: 0.8rem; color: #888;">${request.email}</div>
        <div class="request-time">Requested ${new Date(request.requestedAt).toLocaleString()}</div>
      </div>
      <div class="request-actions">
        <button class="approve-btn" onclick="approveRequest('${request.userId}')">APPROVE</button>
        <button class="deny-btn" onclick="denyRequest('${request.userId}')">DENY</button>
      </div>
    </div>
  `).join('');
  }

  window.approveRequest = (userId) => {
    let accessRequests = JSON.parse(localStorage.getItem('accessRequests')) || [];
    const requestIndex = accessRequests.findIndex(r => r.userId === userId);

    if (requestIndex === -1) return;

    const request = accessRequests[requestIndex];
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 30); // Add 30 days

    // Update global request status
    accessRequests[requestIndex] = {
      ...request,
      status: 'approved',
      approvedAt: new Date().toISOString(),
      expiresAt: expirationDate.toISOString()
    };

    localStorage.setItem('accessRequests', JSON.stringify(accessRequests));

    // Simulating "Sending email" by setting a flag that the user's browser will pick up
    // In a real app, this would happen on the server.
    // Here, we can't easily write to the user's specific local storage if they are on a different machine.
    // LIMITATION: This only works if Owner and Tester are on the same machine/browser for this demo.
    // However, to simulate "Email sent", we can simulate the data structure.

    // Ideally, we'd send an email here.
    const emailSubject = "Beta Access Granted";
    const emailBody = `Hello ${request.name},\n\nYou have been granted execution access to the Peakafeller Beta for 30 days.\nExpires: ${expirationDate.toLocaleDateString()}\n\nBest,\nPeakafeller`;

    // We can open a mailto link for the owner to actually send the email?
    // User requested "Access... sent to email".
    window.open(`mailto:${request.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`);

    // For the "Tester" to actually get in on this local prototype:
    // They need to "check" if they are approved. 
    // Since we are using localStorage as a "mock database", the checkAccess() function above
    // reads 'accessRequests'. But I previously used 'approvedUsers' array. 
    // I should align logic to use 'accessRequests' as the source of truth for status.
    // However, the Tester browser needs to know it's approved. 
    // In this local-only version, Tester must be on same browser or we can't share data.
    // Assuming same browser for demo:

    // Store user-specific approval data to simulate "Login" token
    const approvalData = {
      status: 'approved',
      expiresAt: expirationDate.toISOString()
    };
    localStorage.setItem('approvalData_' + userId, JSON.stringify(approvalData));

    loadAccessRequests();
    alert(`Access granted for 30 days. Email client opened to notify user.`);
  };

  window.denyRequest = (userId) => {
    let accessRequests = JSON.parse(localStorage.getItem('accessRequests')) || [];
    accessRequests = accessRequests.map(r =>
      r.userId === userId ? { ...r, status: 'denied' } : r
    );

    localStorage.setItem('accessRequests', JSON.stringify(accessRequests));

    loadAccessRequests();
    alert('User denied');
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
  document.getElementById('requestAccessBtn')?.addEventListener('click', () => {
    const name = document.getElementById('testerName').value.trim();
    const email = document.getElementById('testerEmail').value.trim();

    if (!name || !email) {
      alert('Please enter your name and email');
      return;
    }

    const userId = 'user_' + Date.now().toString(); // Simple ID
    const user = { id: userId, name: name, email: email };

    const request = {
      userId: userId,
      name: name,
      email: email,
      requestedAt: new Date().toISOString(),
      status: 'pending'
    };

    let accessRequests = JSON.parse(localStorage.getItem('accessRequests')) || [];
    // Check if email already requested
    if (accessRequests.some(r => r.email === email && r.status === 'pending')) {
      alert('A request for this email is already pending.');
      return;
    }

    accessRequests.push(request);

    localStorage.setItem('betaUser', JSON.stringify(user));
    localStorage.setItem('accessRequests', JSON.stringify(accessRequests));

    document.getElementById('testerEmail').disabled = true;
    document.getElementById('requestAccessBtn').disabled = true;
    document.getElementById('requestStatus').textContent = 'Request sent! Waiting for approval...';
  });

  // Admin Tester Login
  document.getElementById('adminTesterLogin')?.addEventListener('click', (e) => {
    e.preventDefault();
    const modal = document.getElementById('ownerPasswordModal');

    // Check if we can reuse the modal or prompt
    // Since reusing the modal logic requires binding a specific callback, let's use prompt for simplicity 
    // OR create a temporary binding if we want to use the nice modal.
    // Let's use prompt for the "Admin Access" link to keep it simple as requested "simple password entry".

    const password = prompt("Enter Owner Password:");
    if (password === 'sebasPK123') {
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
  function loadOwnerAlbums() {
    const ownerAlbumsList = document.getElementById('ownerAlbumsList');
    currentAlbums = JSON.parse(localStorage.getItem('betaAlbums')) || [];

    if (currentAlbums.length === 0) {
      ownerAlbumsList.innerHTML = '<p style="color: #666; font-family: var(--font-mono); font-size: 0.8rem;">No albums published yet</p>';
      return;
    }

    ownerAlbumsList.innerHTML = currentAlbums.map(album => `
    <div class="owner-album-item">
      <img src="${album.cover}" class="owner-album-cover" alt="${album.title}">
      <div class="owner-album-info">
        <div class="owner-album-title">${album.title}</div>
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
  window.deleteAlbum = (albumId) => {
    if (!confirm('Are you sure you want to delete this album? All comments will be lost.')) {
      return;
    }

    currentAlbums = currentAlbums.filter(a => a.id !== albumId);
    localStorage.setItem('betaAlbums', JSON.stringify(currentAlbums));
    loadOwnerAlbums();
    alert('Album deleted successfully');
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
  document.getElementById('tracksUpload').addEventListener('change', (e) => {
    const files = Array.from(e.target.files);

    if (files.length === 0) {
      return;
    }

    console.log(`Uploading ${files.length} file(s)...`);

    files.forEach(file => {
      if (!file.type.includes('audio')) {
        alert(`${file.name} is not an audio file`);
        return;
      }

      const reader = new FileReader();

      reader.onload = (event) => {
        uploadedTracks.push({
          name: file.name.replace('.mp3', ''),
          data: event.target.result,
          comments: []
        });
        renderTracksList();
        console.log(`Added track: ${file.name}`);
      };

      reader.onerror = (error) => {
        console.error('Error reading file:', error);
        alert(`Error reading ${file.name}`);
      };

      reader.readAsDataURL(file);
    });

    // Reset input
    e.target.value = '';
  });

  function renderTracksList() {
    const tracksList = document.getElementById('tracksList');
    tracksList.innerHTML = uploadedTracks.map((track, index) => `
    <div class="track-item">
      <span class="track-name">${track.name}</span>
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

      const album = {
        id: Date.now(),
        title,
        cover: coverImage,
        tracks: uploadedTracks.slice(), // Create a copy
        publishedAt: new Date().toISOString()
      };

      try {
        publishBtn.textContent = 'PUBLISHING...';
        publishBtn.disabled = true;

        // Attempt to save
        currentAlbums.push(album);
        try {
          localStorage.setItem('betaAlbums', JSON.stringify(currentAlbums));
        } catch (e) {
          if (e.name === 'QuotaExceededError' || e.code === 22) {
            alert('Storage limit exceeded! LocalStorage is limited to ~5MB. Try uploading smaller files or fewer tracks. This is a browser limitation for this beta version.');
            // Revert changes
            currentAlbums.pop();
            publishBtn.textContent = 'PUBLISH FOR TESTING';
            publishBtn.disabled = false;
            return;
          } else {
            throw e;
          }
        }

        // Reset form
        document.getElementById('albumTitle').value = '';
        document.getElementById('coverPreview').innerHTML = '';
        uploadedTracks = [];
        coverImage = null;
        renderTracksList();
        loadOwnerAlbums();

        alert('Album published for beta testing!');
      } catch (err) {
        console.error('Publish error:', err);
        alert('An updated unexpected error occurred: ' + err.message);
      } finally {
        publishBtn.textContent = 'PUBLISH FOR TESTING';
        publishBtn.disabled = false;
      }
    });
  } else {
    console.error('Publish button not found!');
  }


  // Load Albums (Tester View)
  function loadAlbums() {
    currentAlbums = JSON.parse(localStorage.getItem('betaAlbums')) || [];

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
      <img src="${album.cover}" alt="${album.title}" class="album-cover">
      <div class="album-info">
        <h3 class="album-title">${album.title}</h3>
        <p class="album-meta">${album.tracks.length} tracks • ${new Date(album.publishedAt).toLocaleDateString()}</p>
      </div>
    </div>
  `).join('');
  }

  // Open Album Detail
  window.openAlbum = (albumId) => {
    const album = currentAlbums.find(a => a.id === albumId);
    if (!album) return;

    const detailHTML = `
    <h2 style="font-family: var(--font-main); font-size: 2rem; font-weight: 100; margin-bottom: 2rem; color: var(--color-accent);">
      ${album.title}
    </h2>
    <img src="${album.cover}" style="width: 100%; max-width: 400px; border-radius: 8px; margin-bottom: 2rem;">
    
    ${album.tracks.map((track, index) => `
      <div class="track-player">
        <div class="track-header">
          <span class="track-title">${track.name}</span>
        </div>
        <audio controls src="${track.data}" id="audio-${index}"></audio>
        
        <div class="comments-section">
          <div class="comment-input">
            <input type="text" class="timestamp-input" id="timestamp-${index}" placeholder="0:00">
            <textarea class="comment-text" id="comment-${index}" placeholder="Add your feedback..."></textarea>
            <button class="comment-btn" onclick="addComment(${albumId}, ${index})">POST</button>
          </div>
          <div id="comments-${index}">
            ${(track.comments || []).map(c => `
              <div class="comment-item">
                <div class="comment-timestamp">${c.timestamp}</div>
                <div class="comment-content">${c.text}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `).join('')}
  `;

    document.getElementById('albumDetail').innerHTML = detailHTML;
    albumModal.classList.add('active');
  };

  window.closeModal = () => {
    albumModal.classList.remove('active');
  };

  window.addComment = (albumId, trackIndex) => {
    const timestamp = document.getElementById(`timestamp-${trackIndex}`).value;
    const text = document.getElementById(`comment-${trackIndex}`).value;

    if (!timestamp || !text) {
      alert('Please enter both timestamp and comment');
      return;
    }

    const albumIndex = currentAlbums.findIndex(a => a.id === albumId);
    if (!currentAlbums[albumIndex].tracks[trackIndex].comments) {
      currentAlbums[albumIndex].tracks[trackIndex].comments = [];
    }

    currentAlbums[albumIndex].tracks[trackIndex].comments.push({
      timestamp,
      text,
      createdAt: new Date().toISOString()
    });

    localStorage.setItem('betaAlbums', JSON.stringify(currentAlbums));

    // Refresh the modal
    openAlbum(albumId);
  };

  // Initial load
  checkAccess();

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
