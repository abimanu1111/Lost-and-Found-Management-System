let currentView = 'home';
let user = null;
let isAdmin = false;
let clickCount = 0;
let clickTimer = null;
let currentEditId = null;

const views = {
  home: document.getElementById('homeView'),
  login: document.getElementById('loginView'),
  forgot: document.getElementById('forgotView'),
  signup: document.getElementById('signupView'),
  report: document.getElementById('reportView'),
  myReports: document.getElementById('myReportsView'),
  admin: document.getElementById('adminView')
};

const homeBtn = document.getElementById('homeBtn');
const reportBtn = document.getElementById('reportBtn');
const myReportsBtn = document.getElementById('myReportsBtn');
const loginBtn = document.getElementById('loginBtn');
const signupBtn = document.getElementById('signupBtn');
const logoutBtn = document.getElementById('logoutBtn');
const logo = document.getElementById('logo');

const filterType = document.getElementById('filterType');
const filterCategory = document.getElementById('filterCategory');
const searchQuery = document.getElementById('searchQuery');
const itemsGrid = document.getElementById('itemsGrid');
const emptyState = document.getElementById('emptyState');
const publicStatsGrid = document.getElementById('publicStatsGrid');
const myReportsGrid = document.getElementById('myReportsGrid');
const myReportsEmpty = document.getElementById('myReportsEmpty');
const myReportsCompletedGrid = document.getElementById('myReportsCompletedGrid');
const myReportsCompletedEmpty = document.getElementById('myReportsCompletedEmpty');

const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const reportForm = document.getElementById('reportForm');
const reportType = document.getElementById('reportType');
const foundFields = document.getElementById('foundFields');
const gpsBtn = document.getElementById('gpsBtn');
const locationCoords = document.getElementById('locationCoords');

const adminLogin = document.getElementById('adminLogin');
const adminLoginForm = document.getElementById('adminLoginForm');
const adminContent = document.getElementById('adminContent');
const statsGrid = document.getElementById('statsGrid');
const adminItemsList = document.getElementById('adminItemsList');

const chatPanel = document.getElementById('chatPanel');
const chatCloseBtn = document.getElementById('chatCloseBtn');
const chatTitle = document.getElementById('chatTitle');
const chatSubtitle = document.getElementById('chatSubtitle');
const chatSelectRow = document.getElementById('chatSelectRow');
const chatSelect = document.getElementById('chatSelect');
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');

const goSignup = document.getElementById('goSignup');
const goLogin = document.getElementById('goLogin');
const goForgot = document.getElementById('goForgot');
const goLoginFromForgot = document.getElementById('goLoginFromForgot');
const forgotForm = document.getElementById('forgotForm');

let currentChatId = null;
let currentChatItemId = null;
let chatPoller = null;

function switchView(view) {
  Object.values(views).forEach(v => v.classList.remove('active'));
  views[view].classList.add('active');
  currentView = view;
}

function updateNav() {
  loginBtn.style.display = user ? 'none' : 'inline-block';
  signupBtn.style.display = user ? 'none' : 'inline-block';
  logoutBtn.style.display = user ? 'inline-block' : 'none';
  myReportsBtn.style.display = user ? 'inline-block' : 'none';
}

async function fetchMe() {
  const res = await fetch('/api/me');
  const data = await res.json();
  user = data.user;
  isAdmin = data.isAdmin;
  updateNav();
}

async function loadPublicStats() {
  if (!publicStatsGrid) return;
  const res = await fetch('/api/public-stats');
  const data = await res.json();
  if (!res.ok) return;
  const stats = data.stats || {};
  publicStatsGrid.innerHTML = `
    <div class="stat-card"><div>Found Reports</div><div class="stat-value">${stats.foundItems ?? 0}</div></div>
    <div class="stat-card"><div>Lost Reports</div><div class="stat-value">${stats.lostItems ?? 0}</div></div>
    <div class="stat-card"><div>Completed Reports</div><div class="stat-value">${stats.completedItems ?? 0}</div></div>
  `;
}

async function loadItems() {
  const params = new URLSearchParams();
  if (filterType.value !== 'all') params.append('type', filterType.value);
  if (filterCategory.value !== 'all') params.append('category', filterCategory.value);
  if (searchQuery.value) params.append('search', searchQuery.value);

  const res = await fetch(`/api/items?${params}`);
  const data = await res.json();
  displayItems(data.items || []);
}

async function loadMyReports() {
  const res = await fetch('/api/items?my=1&includeCompleted=1');
  const data = await res.json();
  const items = (data.items || []).filter(item => item.canEdit);
  displayMyReports(items);
}

function displayItems(items) {
  if (!items.length) {
    itemsGrid.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';
  itemsGrid.innerHTML = items.map(item => `
    <div class="item-card">
      ${item.imageUrl ? `<img class="item-image my-report-image" src="${item.imageUrl}" alt="${item.title}">` : ''}
      <div class="item-content">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <span class="item-badge ${item.type === 'lost' ? 'badge-lost' : 'badge-found'}">${item.type}</span>
          <span class="item-category">${item.category}</span>
        </div>
        <h3>${item.title}</h3>
        <p>${item.description}</p>
        <div class="item-details">
          <span><strong>Location:</strong> ${item.location}</span>
          ${item.locationCoords ? `<span><strong>GPS:</strong> ${item.locationCoords}</span>` : ''}
          <span><strong>Date:</strong> ${new Date(item.date).toLocaleString()}</span>
          <span><strong>Posted by:</strong> ${item.canEdit ? 'You' : 'Reporter'}</span>
        </div>
        ${(item.canEdit || (user && !item.canEdit)) ? `
          <div class="item-actions">
            ${item.canEdit ? `<button class="btn-secondary btn-small" onclick='startEdit(${JSON.stringify(item)})'>Edit</button>` : ''}
            ${user && !item.canEdit ? `<button class="btn-secondary btn-small" onclick='startChat(${JSON.stringify(item)})'>Chat</button>` : ''}
          </div>
        ` : ''}
      </div>
    </div>
  `).join('');
}

function displayMyReports(items) {
  const activeItems = items.filter(item => item.status !== 'completed');
  const completedItems = items.filter(item => item.status === 'completed');

  if (!activeItems.length) {
    myReportsGrid.innerHTML = '';
    myReportsEmpty.style.display = 'block';
  } else {
    myReportsEmpty.style.display = 'none';
    myReportsGrid.innerHTML = activeItems.map(item => `
    <div class="item-card">
      ${item.imageUrl ? `<img class="item-image" src="${item.imageUrl}" alt="${item.title}">` : ''}
      <div class="item-content">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <span class="item-badge ${item.type === 'lost' ? 'badge-lost' : 'badge-found'}">${item.type}</span>
          <span class="item-category">${item.category}</span>
        </div>
        <h3>${item.title}</h3>
        <p>${item.description}</p>
        <div class="item-details">
          <span><strong>Location:</strong> ${item.location}</span>
          ${item.locationCoords ? `<span><strong>GPS:</strong> ${item.locationCoords}</span>` : ''}
          <span><strong>Date:</strong> ${new Date(item.date).toLocaleString()}</span>
        </div>
        <div class="item-actions">
          <button class="btn-secondary btn-small" onclick='startEdit(${JSON.stringify(item)})'>Edit</button>
          <button class="btn-secondary btn-small" onclick='startChatFromReport(${JSON.stringify(item)})'>Chats</button>
          <button class="btn-primary btn-small" onclick='completeReport(${item.id})'>Complete</button>
        </div>
      </div>
    </div>
    `).join('');
  }

  if (!completedItems.length) {
    myReportsCompletedGrid.innerHTML = '';
    myReportsCompletedEmpty.style.display = 'block';
    return;
  }
  myReportsCompletedEmpty.style.display = 'none';
  myReportsCompletedGrid.innerHTML = completedItems.map(item => `
    <div class="item-card completed-card">
      ${item.imageUrl ? `<img class="item-image my-report-image" src="${item.imageUrl}" alt="${item.title}">` : ''}
      <div class="item-content">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <span class="item-badge ${item.type === 'lost' ? 'badge-lost' : 'badge-found'}">${item.type}</span>
          <span class="item-category">${item.category}</span>
        </div>
        <h3>${item.title}</h3>
        <p>${item.description}</p>
        <div class="item-details">
          <span><strong>Location:</strong> ${item.location}</span>
          ${item.locationCoords ? `<span><strong>GPS:</strong> ${item.locationCoords}</span>` : ''}
          <span><strong>Date:</strong> ${new Date(item.date).toLocaleString()}</span>
          ${item.completedAt ? `<span><strong>Completed:</strong> ${new Date(item.completedAt).toLocaleString()}</span>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

async function loadAdminData() {
  const statsRes = await fetch('/api/stats');
  const statsData = await statsRes.json();
  if (statsRes.ok) {
    const stats = statsData.stats;
    statsGrid.innerHTML = `
      <div class="stat-card"><div>Total Items</div><div class="stat-value">${stats.totalItems}</div></div>
      <div class="stat-card"><div>Lost Items</div><div class="stat-value">${stats.lostItems}</div></div>
      <div class="stat-card"><div>Found Items</div><div class="stat-value">${stats.foundItems}</div></div>
      <div class="stat-card"><div>Completed Items</div><div class="stat-value">${stats.completedItems}</div></div>
    `;
  }

  const itemsRes = await fetch('/api/items');
  const itemsData = await itemsRes.json();
  const items = itemsData.items || [];

  adminItemsList.innerHTML = items.map(item => `
    <div class="admin-item">
      ${item.imageUrl ? `<img class="admin-item-image" src="${item.imageUrl}" alt="${item.title}">` : ''}
      <div class="admin-item-content">
        <div><strong>${item.title}</strong> (${item.type})</div>
        <div>${item.description}</div>
        <div>Category: ${item.category}</div>
        <div>Location: ${item.location}</div>
        ${item.locationCoords ? `<div>GPS: ${item.locationCoords}</div>` : ''}
        <div>Date: ${new Date(item.date).toLocaleString()}</div>
        ${item.contactInfo ? `<div>Contact: ${item.contactInfo}</div>` : ''}
        ${item.foundPersonName ? `<div>Found By: ${item.foundPersonName}</div>` : ''}
        ${item.foundPersonPhone ? `<div>Phone: ${item.foundPersonPhone}</div>` : ''}
        <div>Posted by: ${item.userName}</div>
      </div>
      <button class="btn-delete" onclick="deleteItem(${item.id})">Delete</button>
    </div>
  `).join('');
}

function openChatPanel() {
  chatPanel.classList.add('active');
  chatPanel.setAttribute('aria-hidden', 'false');
}

function closeChatPanel() {
  chatPanel.classList.remove('active');
  chatPanel.setAttribute('aria-hidden', 'true');
  chatMessages.innerHTML = '';
  chatSelect.innerHTML = '';
  chatSelectRow.style.display = 'none';
  currentChatId = null;
  currentChatItemId = null;
  if (chatPoller) {
    clearInterval(chatPoller);
    chatPoller = null;
  }
  setChatEnabled(false);
}

function setChatEnabled(enabled) {
  chatInput.disabled = !enabled;
  chatForm.querySelector('button[type="submit"]').disabled = !enabled;
}

function renderMessages(messages) {
  if (!messages.length) {
    chatMessages.innerHTML = '<div class="chat-empty">No messages yet. Start the conversation.</div>';
    return;
  }
  chatMessages.innerHTML = messages.map(message => `
    <div class="chat-message ${message.fromSelf ? 'mine' : 'theirs'}">
      <div>${message.body}</div>
      <div class="chat-meta">${new Date(message.createdAt).toLocaleString()}</div>
    </div>
  `).join('');
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function loadChatMessages() {
  if (!currentChatId) return;
  const res = await fetch(`/api/chats/${currentChatId}/messages`);
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || 'Unable to load messages');
    return;
  }
  renderMessages(data.messages || []);
}

function startChatPolling() {
  if (chatPoller) clearInterval(chatPoller);
  chatPoller = setInterval(loadChatMessages, 5000);
}

async function openChatForItem(item, isOwner) {
  if (!user) {
    alert('Please login to chat.');
    switchView('login');
    return;
  }

  openChatPanel();
  chatTitle.textContent = isOwner ? `Chats for: ${item.title}` : `Chat about: ${item.title}`;
  chatSubtitle.textContent = 'Do not share personal information in messages.';
  currentChatItemId = item.id;

  if (isOwner) {
    chatSelectRow.style.display = 'flex';
    const res = await fetch(`/api/items/${item.id}/chats`);
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Unable to load chats');
      closeChatPanel();
      return;
    }
    const chats = data.chats || [];
    if (!chats.length) {
      chatMessages.innerHTML = '<div class="chat-empty">No chats yet for this item.</div>';
      chatSelectRow.style.display = 'none';
      setChatEnabled(false);
      return;
    }
    chatSelect.innerHTML = chats.map(chat => `<option value="${chat.id}">${chat.label}</option>`).join('');
    currentChatId = chats[0].id;
    setChatEnabled(true);
    await loadChatMessages();
    startChatPolling();
  } else {
    chatSelectRow.style.display = 'none';
    const res = await fetch(`/api/items/${item.id}/chats`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Unable to start chat');
      closeChatPanel();
      return;
    }
    currentChatId = data.chatId;
    setChatEnabled(true);
    await loadChatMessages();
    startChatPolling();
  }
}

function startChat(item) {
  if (!item) return;
  openChatForItem(item, false);
}

function startChatFromReport(item) {
  if (!item) return;
  openChatForItem(item, true);
}

async function deleteItem(id) {
  if (!confirm('Delete this item?')) return;
  const res = await fetch(`/api/items/${id}`, { method: 'DELETE' });
  if (res.ok) loadAdminData();
  else alert('Failed to delete');
}

homeBtn.addEventListener('click', () => { switchView('home'); loadItems(); loadPublicStats(); });
reportBtn.addEventListener('click', () => {
  if (!user) {
    alert('Please login to report an item.');
    switchView('login');
    return;
  }
  switchView('report');
});
myReportsBtn.addEventListener('click', () => { switchView('myReports'); loadMyReports(); });
loginBtn.addEventListener('click', () => switchView('login'));
signupBtn.addEventListener('click', () => switchView('signup'));
logoutBtn.addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  user = null; isAdmin = false; updateNav(); switchView('home'); loadItems();
  closeChatPanel();
});

goSignup.addEventListener('click', () => switchView('signup'));
goLogin.addEventListener('click', () => switchView('login'));
goForgot.addEventListener('click', () => switchView('forgot'));
goLoginFromForgot.addEventListener('click', () => switchView('login'));

if (chatCloseBtn) {
  chatCloseBtn.addEventListener('click', closeChatPanel);
}
if (chatSelect) {
  chatSelect.addEventListener('change', async () => {
    currentChatId = chatSelect.value;
    if (!currentChatId) return;
    setChatEnabled(true);
    await loadChatMessages();
    startChatPolling();
  });
}

filterType.addEventListener('change', loadItems);
filterCategory.addEventListener('change', loadItems);
searchQuery.addEventListener('input', () => {
  clearTimeout(window._searchTimer);
  window._searchTimer = setTimeout(loadItems, 300);
});

reportType.addEventListener('change', () => {
  foundFields.style.display = reportType.value === 'found' ? 'block' : 'none';
});

if (gpsBtn) {
  gpsBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      alert('Geolocation not supported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        locationCoords.value = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
      },
      () => alert('Unable to fetch location')
    );
  });
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(loginForm);
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: form.get('email'),
      password: form.get('password')
    })
  });
  const data = await res.json();
  if (res.ok) {
    user = data.user;
    updateNav();
    switchView('home');
    loadItems();
  } else {
    alert(data.error || 'Login failed');
  }
});

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(signupForm);
  const res = await fetch('/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: form.get('name'),
      email: form.get('email'),
      password: form.get('password'),
      securityAnswer: form.get('securityAnswer')
    })
  });
  const data = await res.json();
  if (res.ok) {
    alert('Account created. Please login.');
    switchView('login');
  } else {
    alert(data.error || 'Signup failed');
  }
});

forgotForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(forgotForm);
  const res = await fetch('/api/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: form.get('email'),
      securityAnswer: form.get('securityAnswer'),
      newPassword: form.get('newPassword')
    })
  });
  const data = await res.json();
  if (res.ok) {
    alert('Password reset successfully. Please login.');
    forgotForm.reset();
    switchView('login');
  } else {
    alert(data.error || 'Reset failed');
  }
});
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentChatId) return;
  const body = chatInput.value.trim();
  if (!body) return;
  const res = await fetch(`/api/chats/${currentChatId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body })
  });
  const data = await res.json();
  if (res.ok) {
    chatInput.value = '';
    loadChatMessages();
  } else {
    alert(data.error || 'Failed to send message');
  }
});
reportForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(reportForm);
  const isEditing = currentEditId !== null;
  const res = await fetch(isEditing ? `/api/items/${currentEditId}` : '/api/items', {
    method: isEditing ? 'PUT' : 'POST',
    body: form
  });
  const data = await res.json();
  if (res.ok) {
    alert(isEditing ? 'Item updated successfully' : 'Item reported successfully');
    reportForm.reset();
    foundFields.style.display = 'none';
    currentEditId = null;
    reportForm.querySelector('button[type="submit"]').textContent = 'Submit Report';
    if (currentView === 'myReports') {
      switchView('myReports');
      loadMyReports();
    } else {
      switchView('home');
      loadItems();
    }
    loadPublicStats();
  } else {
    alert(data.error || 'Failed to report item');
  }
});

adminLoginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(adminLoginForm);
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: form.get('password') })
  });
  const data = await res.json();
  if (res.ok) {
    isAdmin = true;
    adminLogin.style.display = 'none';
    adminContent.style.display = 'block';
    loadAdminData();
  } else {
    alert(data.error || 'Admin login failed');
  }
});

logo.addEventListener('click', () => {
  clickCount += 1;
  clearTimeout(clickTimer);
  clickTimer = setTimeout(() => { clickCount = 0; }, 1000);
  if (clickCount === 3) {
    switchView('admin');
    if (isAdmin) {
      adminLogin.style.display = 'none';
      adminContent.style.display = 'block';
      loadAdminData();
    } else {
      adminLogin.style.display = 'block';
      adminContent.style.display = 'none';
    }
  }
});

(async function init() {
  await fetchMe();
  switchView('home');
  loadItems();
  loadPublicStats();
})();

async function completeReport(id) {
  if (!confirm('Mark this report as completed?')) return;
  const res = await fetch(`/api/items/${id}/complete`, { method: 'POST' });
  if (res.ok) {
    loadMyReports();
    loadItems();
    loadPublicStats();
  } else {
    const data = await res.json().catch(() => ({}));
    alert(data.error || 'Failed to complete report');
  }
}

function toDateTimeLocal(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function startEdit(item) {
  if (!item || !item.canEdit) return;
  currentEditId = item.id;
  switchView('report');
  reportForm.querySelector('button[type="submit"]').textContent = 'Update Report';

  reportType.value = item.type;
  foundFields.style.display = reportType.value === 'found' ? 'block' : 'none';
  reportForm.elements['title'].value = item.title || '';
  reportForm.elements['description'].value = item.description || '';
  reportForm.elements['category'].value = item.category || 'Other';
  reportForm.elements['location'].value = item.location || '';
  locationCoords.value = item.locationCoords || '';
  reportForm.elements['date'].value = toDateTimeLocal(item.date);
  reportForm.elements['contactInfo'].value = item.contactInfo || '';
  reportForm.elements['foundPersonName'].value = item.foundPersonName || '';
  reportForm.elements['foundPersonPhone'].value = item.foundPersonPhone || '';
  reportForm.elements['imageUrl'].value = item.imageUrl || '';
}
