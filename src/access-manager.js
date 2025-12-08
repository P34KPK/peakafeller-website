// Access Management System

// Check URL parameters for invite
const urlParams = new URLSearchParams(window.location.search);
const isInvite = urlParams.get('invite') === 'true';

// Get user session
let currentUser = JSON.parse(localStorage.getItem('betaUser')) || null;
let accessRequests = JSON.parse(localStorage.getItem('accessRequests')) || [];
let approvedUsers = JSON.parse(localStorage.getItem('approvedUsers')) || [];

// Generate and display share link
function initShareLink() {
    const baseUrl = window.location.origin + window.location.pathname;
    const shareUrl = `${baseUrl}?invite=true`;
    const shareLinkInput = document.getElementById('shareLink');
    if (shareLinkInput) {
        shareLinkInput.value = shareUrl;
    }
}

// Copy link to clipboard
document.getElementById('copyLinkBtn')?.addEventListener('click', () => {
    const shareLinkInput = document.getElementById('shareLink');
    shareLinkInput.select();
    document.execCommand('copy');

    const copyBtn = document.getElementById('copyLinkBtn');
    const originalText = copyBtn.textContent;
    copyBtn.textContent = 'COPIED!';
    setTimeout(() => {
        copyBtn.textContent = originalText;
    }, 2000);
});

// Check access and show appropriate UI
function checkAccess() {
    const accessRequestForm = document.getElementById('accessRequestForm');
    const albumsGrid = document.getElementById('albumsGrid');

    if (!accessRequestForm || !albumsGrid) return;

    // If user is approved, show albums
    if (currentUser && approvedUsers.includes(currentUser.id)) {
        accessRequestForm.style.display = 'none';
        albumsGrid.style.display = 'grid';
        loadAlbums();
    }
    // If user has pending request, show status
    else if (currentUser && accessRequests.find(r => r.userId === currentUser.id && r.status === 'pending')) {
        accessRequestForm.style.display = 'block';
        albumsGrid.style.display = 'none';
        document.getElementById('testerName').value = currentUser.name;
        document.getElementById('testerName').disabled = true;
        document.getElementById('requestAccessBtn').disabled = true;
        document.getElementById('requestStatus').textContent = 'Request pending approval...';
    }
    // If user was denied, show message
    else if (currentUser && accessRequests.find(r => r.userId === currentUser.id && r.status === 'denied')) {
        accessRequestForm.style.display = 'block';
        albumsGrid.style.display = 'none';
        document.getElementById('requestStatus').textContent = 'Access denied. Contact the owner for more information.';
        document.getElementById('requestAccessBtn').style.display = 'none';
    }
    // If invite link, show request form
    else if (isInvite) {
        accessRequestForm.style.display = 'block';
        albumsGrid.style.display = 'none';
    }
    // Default: show albums (backward compatibility)
    else {
        accessRequestForm.style.display = 'none';
        albumsGrid.style.display = 'grid';
        loadAlbums();
    }
}

// Request access
document.getElementById('requestAccessBtn')?.addEventListener('click', () => {
    const name = document.getElementById('testerName').value.trim();

    if (!name) {
        alert('Please enter your name');
        return;
    }

    const userId = Date.now().toString();
    const user = {
        id: userId,
        name: name
    };

    const request = {
        userId: userId,
        name: name,
        requestedAt: new Date().toISOString(),
        status: 'pending'
    };

    currentUser = user;
    accessRequests.push(request);

    localStorage.setItem('betaUser', JSON.stringify(user));
    localStorage.setItem('accessRequests', JSON.stringify(accessRequests));

    document.getElementById('testerName').disabled = true;
    document.getElementById('requestAccessBtn').disabled = true;
    document.getElementById('requestStatus').textContent = 'Request sent! Waiting for approval...';
});

// Load access requests (Owner view)
function loadAccessRequests() {
    const requestsList = document.getElementById('accessRequestsList');
    if (!requestsList) return;

    accessRequests = JSON.parse(localStorage.getItem('accessRequests')) || [];
    const pendingRequests = accessRequests.filter(r => r.status === 'pending');

    if (pendingRequests.length === 0) {
        requestsList.innerHTML = '<p style="color: #666; font-family: var(--font-mono); font-size: 0.8rem;">No pending requests</p>';
        return;
    }

    requestsList.innerHTML = pendingRequests.map(request => `
    <div class="access-request-item">
      <div class="request-info">
        <div class="request-name">${request.name}</div>
        <div class="request-time">Requested ${new Date(request.requestedAt).toLocaleString()}</div>
      </div>
      <div class="request-actions">
        <button class="approve-btn" onclick="approveRequest('${request.userId}')">APPROVE</button>
        <button class="deny-btn" onclick="denyRequest('${request.userId}')">DENY</button>
      </div>
    </div>
  `).join('');
}

// Approve request
window.approveRequest = (userId) => {
    accessRequests = accessRequests.map(r =>
        r.userId === userId ? { ...r, status: 'approved' } : r
    );

    approvedUsers = JSON.parse(localStorage.getItem('approvedUsers')) || [];
    if (!approvedUsers.includes(userId)) {
        approvedUsers.push(userId);
    }

    localStorage.setItem('accessRequests', JSON.stringify(accessRequests));
    localStorage.setItem('approvedUsers', JSON.stringify(approvedUsers));

    loadAccessRequests();
    alert('User approved!');
};

// Deny request
window.denyRequest = (userId) => {
    accessRequests = accessRequests.map(r =>
        r.userId === userId ? { ...r, status: 'denied' } : r
    );

    localStorage.setItem('accessRequests', JSON.stringify(accessRequests));

    loadAccessRequests();
    alert('User denied');
};

// Export functions
export { initShareLink, checkAccess, loadAccessRequests };
