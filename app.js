const state = {
  activePage: 'overview',
  filter: 'all',
  search: '',
  user: null,
  token: sessionStorage.getItem('campusloop-token') || '',
  offlineMode: false,
  queuedRequests: JSON.parse(localStorage.getItem('campusloop-offline-queue') || '[]'),
  apiOnline: false,
  items: [],
  workOrders: [],
  risks: [],
  users: [],
  evidence: [],
  metrics: {},
  orderFilter: 'all',
  assignees: [],
  refreshTimer: null,
  lastOrdersRefresh: null
};

const pageLabels = { overview: '总览', exchange: '资源交换', operations: '设施运营', impact: '影响仪表板', governance: '治理与风险', implementation: '实施路线', evidence: '研究证据' };
const modalRoot = document.getElementById('modal-root');
const toast = document.getElementById('toast');
const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:4173' : '';
let toastTimer;
const roleLabels = { student: '学生用户', operator: '设施运营', sustainability: '可持续管理员', admin: '系统管理员' };
const roleDescriptions = { student: 'Student user', operator: 'Campus operator', sustainability: 'Sustainability admin', admin: 'System administrator' };

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function showToast(message, tone = 'success') {
  document.getElementById('toast-message').textContent = message;
  document.querySelector('.toast-icon').textContent = tone === 'error' ? '!' : '✓';
  toast.classList.toggle('error', tone === 'error');
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function setServerStatus(status, message) {
  const root = document.getElementById('server-status');
  const text = document.getElementById('server-status-text');
  if (!root || !text) return;
  root.className = `server-status ${status}`;
  text.textContent = message;
}

function persistOfflineQueue() {
  localStorage.setItem('campusloop-offline-queue', JSON.stringify(state.queuedRequests));
  const count = document.getElementById('offline-count');
  const label = document.getElementById('offline-label');
  if (count) count.textContent = `离线队列 ${String(state.queuedRequests.length).padStart(2, '0')}`;
  if (label) label.textContent = state.offlineMode ? '当前处于离线模式' : '等待同步到云端';
  const button = document.getElementById('offline-mode-button');
  if (button) button.innerHTML = state.offlineMode ? '<span>●</span> 退出离线' : '<span>⌁</span> 模拟离线';
}

function queueOfflineRequest(path, options) {
  state.queuedRequests.push({ path, options: { method: options.method, body: options.body } });
  persistOfflineQueue();
  return { queued: true };
}

async function apiRequest(path, options = {}) {
  const requestOptions = { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options };
  if (state.token) requestOptions.headers.Authorization = `Bearer ${state.token}`;
  if (state.offlineMode && requestOptions.method && requestOptions.method !== 'GET') return queueOfflineRequest(path, requestOptions);
  const response = await fetch(`${API_BASE}${path}`, requestOptions);
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401 && path !== '/api/auth/login') { showLogin(); throw new Error('登录已失效，请重新登录'); }
  if (!response.ok) throw new Error(payload.error?.message || `请求失败（${response.status}）`);
  return payload;
}

function showLogin(message = '') {
  state.user = null; state.apiOnline = false;
  if (state.refreshTimer) { clearInterval(state.refreshTimer); state.refreshTimer = null; }
  document.getElementById('app-shell').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('login-error').textContent = message;
  setServerStatus('offline', '请先登录');
}

function showApp(user) {
  state.user = user; state.apiOnline = true;
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');
  document.getElementById('current-role').textContent = roleLabels[user.role] || user.role;
  document.getElementById('profile-name').textContent = user.displayName;
  document.getElementById('profile-role').textContent = roleDescriptions[user.role] || user.role;
  document.getElementById('profile-avatar').textContent = user.initials;
  applyRoleVisibility();
}

function applyRoleVisibility() {
  const role = state.user?.role;
  document.querySelectorAll('[data-roles]').forEach(el => {
    const allowed = el.dataset.roles.split(',');
    el.classList.toggle('role-hidden', !allowed.includes(role));
  });
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    const page = item.dataset.page;
    const allowed = { overview: ['student','operator','sustainability','admin'], exchange: ['student','operator','sustainability','admin'], operations: ['operator','admin'], impact: ['operator','sustainability','admin'], governance: ['operator','sustainability','admin'], implementation: ['operator','sustainability','admin'], evidence: ['student','operator','sustainability','admin'] }[page] || [];
    item.classList.toggle('role-hidden', !allowed.includes(role));
  });
}

async function login(username, password) {
  const response = await fetch(`${API_BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || '登录失败');
  state.token = payload.token; sessionStorage.setItem('campusloop-token', state.token);
  try { showApp(payload.user); await loadAuthenticatedData(); } catch (error) { sessionStorage.removeItem('campusloop-token'); state.token = ''; showLogin(error.message || '工作空间加载失败'); throw error; }
}

async function loadAuthenticatedData() {
  setServerStatus('loading', '加载工作空间…');
  await Promise.all([loadDashboard(), loadItems(), loadWorkOrders(), loadRisks(), loadModerationQueue(), loadAudit(), loadUsers(), loadEvidence(), loadAssignees()]);
  setServerStatus('online', '已登录 · 后端已连接');
  persistOfflineQueue();
  startLiveRefresh();
}

async function loadDashboard() {
  const payload = await apiRequest('/api/dashboard');
  state.metrics = payload.metrics || {};
  renderDashboard();
}

async function loadItems() {
  const params = new URLSearchParams();
  if (state.filter !== 'all') params.set('filter', state.filter);
  if (state.search.trim()) params.set('search', state.search.trim());
  const payload = await apiRequest(`/api/items?${params.toString()}`);
  state.items = payload.items || [];
  renderItems();
}

async function loadWorkOrders() {
  const payload = await apiRequest('/api/work-orders');
  state.workOrders = payload.workOrders || [];
  state.lastOrdersRefresh = new Date();
  renderKanban();
  const updated = document.getElementById('orders-last-updated');
  if (updated) updated.textContent = `刚刚更新 ${state.lastOrdersRefresh.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
}

async function loadAssignees() {
  if (!['operator', 'admin'].includes(state.user?.role)) return;
  const payload = await apiRequest('/api/work-order-assignees');
  state.assignees = payload.assignees || [];
}

function startLiveRefresh() {
  if (state.refreshTimer) clearInterval(state.refreshTimer);
  state.refreshTimer = setInterval(async () => {
    if (!state.user || !state.apiOnline) return;
    try {
      if (state.activePage === 'operations') await Promise.all([loadWorkOrders(), loadDashboard()]);
      if (state.activePage === 'governance') await Promise.all([loadRisks(), loadModerationQueue(), loadAudit(), loadUsers()]);
    } catch (error) { handleApiError(error); }
  }, 15000);
}

async function loadRisks() {
  if (state.user?.role === 'student') { state.risks = []; renderRisks(); return; }
  const payload = await apiRequest('/api/risks');
  state.risks = payload.risks || [];
  renderRisks();
}

async function loadModerationQueue() {
  if (!['operator', 'admin'].includes(state.user?.role)) return;
  const payload = await apiRequest('/api/moderation/queue');
  renderModerationQueue(payload.items || []);
}

async function loadAudit() {
  if (!['operator', 'admin'].includes(state.user?.role)) return;
  const payload = await apiRequest('/api/audit');
  state.auditEntries = payload.audit || [];
  renderAudit(payload.audit || []);
}

async function loadUsers() {
  if (state.user?.role !== 'admin') return;
  const payload = await apiRequest('/api/users');
  state.users = payload.users || [];
  renderUsers();
}

async function loadEvidence() {
  if (!['operator', 'sustainability', 'admin'].includes(state.user?.role)) return;
  const payload = await apiRequest('/api/evidence');
  state.evidence = payload.evidence || [];
  renderEvidence();
}

function renderModerationQueue(items) {
  const list = document.getElementById('moderation-list');
  const count = document.getElementById('moderation-count');
  if (!list || !count) return;
  count.textContent = `${items.length} 项`;
  if (!items.length) { list.innerHTML = '<p class="empty-inline">当前没有待人工审核资源。</p>'; return; }
  list.innerHTML = items.map(item => `<div class="moderation-row"><div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.category)} · ${escapeHtml(item.location)} · ${escapeHtml(item.id)}</span></div><div class="moderation-actions"><button class="button small secondary" data-review-item="${escapeHtml(item.id)}" data-review-status="rejected">驳回</button><button class="button small primary" data-review-item="${escapeHtml(item.id)}" data-review-status="approved">通过</button></div></div>`).join('');
}

function renderAudit(entries) {
  const list = document.getElementById('audit-list');
  if (!list) return;
  if (!entries.length) { list.innerHTML = '<p class="empty-inline">暂无操作记录。</p>'; return; }
  list.innerHTML = entries.slice(0, 8).map(entry => `<div class="audit-row"><span class="audit-avatar">${escapeHtml(entry.initials || 'SYS')}</span><div><strong>${escapeHtml(entry.actionLabel)}</strong><small>${escapeHtml(entry.displayName || entry.actor)} · ${escapeHtml(entry.entityLabel)} · ${escapeHtml(entry.at)}</small></div><span class="audit-kind">${escapeHtml(entry.entityType)}</span></div>`).join('');
}

function renderUsers() {
  const list = document.getElementById('users-list');
  if (!list) return;
  if (!state.users.length) { list.innerHTML = '<p class="empty-inline">暂无账户记录。</p>'; return; }
  const roleOptions = Object.entries(roleLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
  list.innerHTML = state.users.map(account => {
    const isSelf = account.username === state.user?.username;
    const options = roleOptions.replace(`value="${account.role}"`, `value="${account.role}" selected`);
    const loginLabel = account.lastLogin ? `最近登录 ${escapeHtml(new Date(account.lastLogin).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' }))}` : '尚未登录';
    return `<div class="user-row" data-user-row="${escapeHtml(account.username)}"><div class="user-identity"><span class="user-avatar">${escapeHtml(account.initials)}</span><div><strong>${escapeHtml(account.displayName)}</strong><small>${escapeHtml(account.username)} · ${loginLabel}</small></div></div><div class="user-actions"><select data-user-role aria-label="${escapeHtml(account.displayName)} 的角色" ${isSelf ? 'disabled' : ''}>${options}</select><label class="user-active"><input type="checkbox" data-user-active ${account.active !== false ? 'checked' : ''} ${isSelf ? 'disabled' : ''}><span class="toggle-track"></span><em>${account.active !== false ? '启用' : '停用'}</em></label><label class="user-review"><input type="checkbox" data-user-review ${account.reviewed ? 'checked' : ''}><span>已复核</span></label><button class="button small primary" data-save-user>保存</button></div></div>`;
  }).join('');
}

function setText(id, value) { const element = document.getElementById(id); if (element) element.textContent = value; }

function renderDashboard() {
  const metrics = state.metrics || {};
  setText('overview-active-items', metrics.activeItems ?? '—');
  setText('overview-open-orders', metrics.openOrders ?? '—');
  setText('overview-reuse-rate', `${metrics.reuseRate ?? '—'}%`);
  setText('overview-published-items', metrics.activeItems ?? '—');
  setText('overview-pending-items', metrics.pendingItems ?? '—');
  setText('overview-claimed-items', metrics.claimedItems ?? '—');
  setText('overview-completed-orders', metrics.completedOrders ?? '—');
  setText('ops-open-orders', metrics.openOrders ?? '—');
  setText('ops-offline-queue', metrics.offlineQueue ?? state.queuedRequests.length);
  setText('chart-avoided-kg', `${metrics.avoidedKg ?? 0} kg`);
  setText('impact-avoided-kg', `${metrics.avoidedKg ?? 0} kg`);
  setText('mix-avoided-kg', metrics.avoidedKg ?? 0);
  setText('impact-reuse-rate', `${metrics.reuseRate ?? '—'}%`);
  setText('queue-count', `${Math.min(5, Number(metrics.openOrders || 0) + Number(metrics.pendingItems || 0))} 项`);
  const lifecycleNote = document.getElementById('lifecycle-note-text');
  if (lifecycleNote) lifecycleNote.innerHTML = `当前有 <strong>${escapeHtml(metrics.pendingItems ?? '—')} 件</strong>资源等待审核，已有 <strong>${escapeHtml(metrics.claimedItems ?? '—')} 件</strong>进入预约流转。`;
  const accessPercent = metrics.reviewPercent ?? (metrics.accountCount ? Math.round(((metrics.reviewedAccountCount ?? 0) / metrics.accountCount) * 100) : 0);
  setText('access-review-percent', `${accessPercent}%`);
  setText('access-review-count', `${metrics.reviewedAccountCount ?? 0} / ${metrics.accountCount ?? 0}`);
  const ring = document.getElementById('access-review-ring');
  if (ring) ring.style.background = `conic-gradient(var(--teal) 0 ${accessPercent}%, #e9f4f0 ${accessPercent}% 100%)`;
}

function renderEvidence() {
  const list = document.getElementById('evidence-list');
  if (!list) return;
  if (!state.evidence.length) { list.innerHTML = '<p class="empty-inline">尚未录入证据。请在取得受访者授权后添加访谈或观察记录。</p>'; return; }
  list.innerHTML = state.evidence.slice(0, 6).map(entry => `<div class="evidence-row"><div><strong>${escapeHtml(entry.title)}</strong><small>${escapeHtml(entry.type)} · ${escapeHtml(entry.source)} · ${escapeHtml(entry.createdBy)}</small></div><span class="evidence-consent ${entry.consent ? 'confirmed' : 'pending'}">${entry.consent ? '已授权' : '待确认'}</span><p>${escapeHtml(entry.finding)}</p></div>`).join('');
}

function assigneeOptions(selected = '') {
  const fallback = [{ initials: 'LM', displayName: 'Lin Mei' }, { initials: 'JC', displayName: 'Jordan Chen' }, { initials: 'AK', displayName: 'Ava Kim' }];
  const entries = state.assignees.length ? state.assignees : fallback;
  return entries.map(entry => `<option value="${escapeHtml(entry.initials)}" ${entry.initials === selected ? 'selected' : ''}>${escapeHtml(entry.displayName)} · ${escapeHtml(entry.initials)}</option>`).join('');
}

async function bootstrap() {
  try {
    await fetch(`${API_BASE}/api/health`);
    if (!state.token) { showLogin(); return; }
    const payload = await apiRequest('/api/auth/me');
    showApp(payload.user);
    await loadAuthenticatedData();
  } catch (error) {
    sessionStorage.removeItem('campusloop-token'); state.token = '';
    showLogin(error.message === 'Failed to fetch' ? '后端未启动，请先运行 node server.js' : '请登录后继续');
  }
}

function requireApi() {
  if (!state.apiOnline) {
    showToast('后端未连接，当前操作没有保存', 'error');
    return false;
  }
  return true;
}

function requireRole(roles) {
  if (!state.user || !roles.includes(state.user.role)) { showToast('当前账户没有执行此操作的权限', 'error'); return false; }
  return true;
}

function handleApiError(error) {
  state.apiOnline = false;
  setServerStatus('offline', '后端连接异常');
  showToast(error.message || '后端请求失败', 'error');
}

function goToPage(page) {
  if (!pageLabels[page]) return;
  const allowed = { overview: ['student','operator','sustainability','admin'], exchange: ['student','operator','sustainability','admin'], operations: ['operator','admin'], impact: ['operator','sustainability','admin'], governance: ['operator','sustainability','admin'], implementation: ['operator','sustainability','admin'], evidence: ['student','operator','sustainability','admin'] }[page] || [];
  if (state.user && !allowed.includes(state.user.role)) { showToast('当前账户无法访问这个工作区', 'error'); return; }
  state.activePage = page;
  document.querySelectorAll('.page').forEach(section => section.classList.toggle('active', section.id === `page-${page}`));
  document.querySelectorAll('.nav-item[data-page]').forEach(item => item.classList.toggle('active', item.dataset.page === page));
  document.getElementById('breadcrumb-current').textContent = pageLabels[page];
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (page === 'exchange') loadItems().catch(handleApiError);
  if (page === 'operations') loadWorkOrders().catch(handleApiError);
  if (page === 'governance') { loadRisks().catch(handleApiError); loadModerationQueue().catch(handleApiError); loadAudit().catch(handleApiError); loadUsers().catch(handleApiError); }
  if (page === 'evidence') loadEvidence().catch(handleApiError);
}

function itemVisual(item) {
  const category = item.category || '';
  if (category.includes('电子')) return 'electronics';
  if (category.includes('家具')) return 'furniture';
  if (category.includes('交通')) return 'bicycle';
  return 'books';
}

function itemEmoji(item) {
  if (item.emoji) return item.emoji;
  const category = item.category || '';
  if (category.includes('电子')) return '🖥️';
  if (category.includes('家具')) return '🪑';
  if (category.includes('交通')) return '🚲';
  if (category.includes('书')) return '📚';
  return '📦';
}

function renderItems() {
  const grid = document.getElementById('item-grid');
  if (!grid) return;
  if (!state.items.length) {
    grid.innerHTML = `<div class="empty-state"><strong>${state.apiOnline ? '没有找到匹配的资源' : '等待后端数据'}</strong><p>${state.apiOnline ? '可以换一个关键词，或清除当前筛选。' : '运行 node server.js 后刷新页面。'}</p></div>`;
    return;
  }
  grid.innerHTML = state.items.map(item => `
    <article class="item-card">
      <button class="item-visual ${itemVisual(item)}" data-item-id="${escapeHtml(item.id)}" aria-label="查看 ${escapeHtml(item.name)}"><span class="item-status ${escapeHtml(item.statusKey || 'available')}">${escapeHtml(item.status)}</span><span class="item-emoji">${itemEmoji(item)}</span></button>
      <div class="item-body"><h3>${escapeHtml(item.name)}</h3><div class="item-meta"><span>⌖ ${escapeHtml(item.location)}</span><span>${escapeHtml(item.id)}</span></div></div>
      <div class="item-foot"><span class="impact-label">✦ ${escapeHtml(item.impact)}</span><button class="item-action" data-item-id="${escapeHtml(item.id)}">${item.statusKey === 'available' ? '查看详情' : '查看状态'} ↗</button></div>
    </article>`).join('');
}

function renderKanban() {
  const board = document.getElementById('kanban');
  if (!board) return;
  const columns = [{ key: 'new', label: '待处理' }, { key: 'progress', label: '处理中' }, { key: 'pickup', label: '待清运' }, { key: 'done', label: '已完成' }];
  let visibleOrders = state.workOrders;
  if (state.orderFilter === 'mine') visibleOrders = state.workOrders.filter(order => order.person === state.user?.initials || order.person === state.user?.username);
  if (state.orderFilter === 'overdue') visibleOrders = state.workOrders.filter(order => order.status !== 'done' && /逾期|昨天|超时/.test(order.due || ''));
  document.querySelectorAll('[data-order-filter]').forEach(button => button.classList.toggle('active', button.dataset.orderFilter === state.orderFilter));
  board.innerHTML = columns.map(column => {
    const orders = visibleOrders.filter(order => order.status === column.key);
    return `<div class="kanban-column"><div class="column-heading"><span>${column.label}</span><b>${orders.length}</b></div><div class="kanban-stack">${orders.map(order => `<button class="kanban-card" data-order-id="${escapeHtml(order.id)}" aria-label="查看工单 ${escapeHtml(order.id)}"><div class="kanban-card-top"><strong>${escapeHtml(order.title)}</strong><span class="kanban-tag">${escapeHtml(order.priority)}</span></div><p>${escapeHtml(order.area)} · ${escapeHtml(order.type)}</p><div class="kanban-card-foot"><span>${escapeHtml(order.due)}</span><span class="assignee"><i class="assignee-avatar">${escapeHtml(order.person)}</i></span></div></button>`).join('')}</div></div>`;
  }).join('');
}

function riskClass(level) { return level === 'high' ? 'high' : level === 'low' ? 'low' : 'medium'; }
function riskLabel(level) { return level === 'high' ? '高' : level === 'low' ? '低' : '中'; }
function riskScore(risk) { return Number(risk.score || ((Number(risk.probability) || 3) * (Number(risk.impact) || 3))); }

function renderRisks() {
  const body = document.getElementById('risk-table-body');
  if (!body) return;
  body.innerHTML = state.risks.length ? state.risks.map(risk => `<tr><td><strong>${escapeHtml(risk.title)}</strong><span class="table-sub">${escapeHtml(risk.category)} · ${escapeHtml(risk.id)}</span></td><td>${escapeHtml(risk.affected)}</td><td><span class="risk-label ${riskClass(risk.level)}">${riskLabel(risk.level)}</span></td><td><span class="score-pill ${riskScore(risk) >= 12 ? 'score-high' : riskScore(risk) >= 6 ? 'score-medium' : 'score-low'}">${riskScore(risk)} / 25</span></td><td>${escapeHtml(risk.mitigation)}</td><td>${escapeHtml(risk.owner)}</td><td><button class="status-button ${risk.status === '已缓解' ? 'green-text' : 'amber-text'}" data-risk-id="${escapeHtml(risk.id)}">${escapeHtml(risk.status)} <span>↗</span></button></td></tr>`).join('') : '<tr><td colspan="7">暂无风险记录</td></tr>';
}

function openModal(content) {
  modalRoot.innerHTML = `<div class="modal-backdrop" data-close-modal="true"></div><div class="modal" role="dialog" aria-modal="true">${content}</div>`;
  modalRoot.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
}

function closeModal() { modalRoot.setAttribute('aria-hidden', 'true'); modalRoot.innerHTML = ''; document.body.style.overflow = ''; }

function openAddItemModal() {
  openModal(`<div class="modal-head"><div><p class="panel-kicker">NEW RESOURCE · API CREATE</p><h2>发布一件资源</h2><p>提交后会写入后端数据文件，并进入人工审核队列。</p></div><button class="close-modal" data-close-modal="true" aria-label="关闭">×</button></div><form class="modal-form" id="add-item-form"><div class="form-field"><label for="item-name">资源名称</label><input id="item-name" name="name" required placeholder="例如：可折叠学习桌" /></div><div class="form-grid"><div class="form-field"><label for="item-category">分类</label><select id="item-category" name="category"><option>家具</option><option>书籍</option><option>电子产品</option><option>生活用品</option><option>其他</option></select></div><div class="form-field"><label for="item-location">领取地点</label><select id="item-location" name="location"><option>North Residence B · 1F</option><option>Library loading bay</option><option>Student Union · 服务台</option><option>South Residence D · 1F</option></select></div></div><div class="form-field"><label for="item-note">补充说明</label><textarea id="item-note" name="note" placeholder="描述物品状态、领取方式或安全注意事项"></textarea></div><div class="modal-actions"><button class="button secondary" type="button" data-close-modal="true">取消</button><button class="button primary" type="submit">写入后端 <span>→</span></button></div></form>`);
  document.getElementById('add-item-form').addEventListener('submit', async event => { event.preventDefault(); if (!requireApi()) return; const body = Object.fromEntries(new FormData(event.currentTarget).entries()); try { const result = await apiRequest('/api/items', { method: 'POST', body: JSON.stringify(body) }); if (result.queued) { state.items.unshift({ ...body, id: `OFF-${Date.now()}`, status: '待同步', statusKey: 'available', impact: '待估算影响', owner: state.user?.displayName || '当前用户', posted: '刚刚', emoji: body.category === '家具' ? '🪑' : body.category === '电子产品' ? '🖥️' : '📦' }); renderItems(); } else await Promise.all([loadItems(), loadDashboard()]); closeModal(); showToast(result.queued ? '资源已加入离线队列' : '资源已写入后端，等待学生大使审核'); } catch (error) { handleApiError(error); } });
}

function openItemModal(id) {
  const item = state.items.find(entry => entry.id === id); if (!item) return;
  const lifecycle = item.history || [{ label: '已发布', at: item.posted }, { label: item.status, at: '当前状态' }];
  const timeline = lifecycle.map((step, index) => `<div class="timeline-step ${index === lifecycle.length - 1 ? 'current' : 'complete'}"><span class="timeline-dot"></span><div><strong>${escapeHtml(step.label)}</strong><small>${escapeHtml(step.at || '')}</small></div></div>`).join('');
  openModal(`<div class="modal-head"><div><p class="panel-kicker">RESOURCE DETAIL · ${escapeHtml(item.id)}</p><h2>资源详情</h2></div><button class="close-modal" data-close-modal="true" aria-label="关闭">×</button></div><div class="detail-hero"><span class="item-emoji">${itemEmoji(item)}</span><div class="detail-meta"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.category)} · ${escapeHtml(item.status)}</span></div></div><div class="detail-list"><div><span>领取地点</span><span>${escapeHtml(item.location)}</span></div><div><span>发布者</span><span>${escapeHtml(item.owner)}</span></div><div><span>循环价值</span><span class="green-text">${escapeHtml(item.impact)}</span></div><div><span>更新时间</span><span>${escapeHtml(item.posted)}</span></div></div><div class="timeline"><p class="panel-kicker">LIFECYCLE AUDIT</p>${timeline}</div><div class="modal-actions"><button class="button secondary" data-close-modal="true">关闭</button><button class="button primary" id="claim-item">${item.statusKey === 'available' ? '预约领取' : '关注状态'} <span>→</span></button></div>`);
  document.getElementById('claim-item').addEventListener('click', async () => { if (item.statusKey !== 'available') { closeModal(); showToast('已加入状态提醒'); return; } if (!requireApi()) return; try { await apiRequest(`/api/items/${encodeURIComponent(item.id)}`, { method: 'PATCH', body: JSON.stringify({ action: 'claim' }) }); closeModal(); await Promise.all([loadItems(), loadDashboard()]); showToast(`已预约“${item.name}”，请在领取时间内完成扫码`); } catch (error) { handleApiError(error); } });
}

function openWorkOrderModal() {
  const isStudent = state.user?.role === 'student';
  const assignmentField = isStudent ? '' : `<div class="form-field"><label for="order-person">负责人</label><select id="order-person" name="person">${assigneeOptions()}</select></div>`;
  openModal(`<div class="modal-head"><div><p class="panel-kicker">${isStudent ? 'FACILITY REPORT · API CREATE' : 'NEW WORK ORDER · API CREATE'}</p><h2>${isStudent ? '报告设施问题' : '新建设施工单'}</h2><p>${isStudent ? '提交后会进入设施运营的待分配队列。' : '新工单会进入“待处理”列，并写入后端数据文件。'}</p></div><button class="close-modal" data-close-modal="true" aria-label="关闭">×</button></div><form class="modal-form" id="work-order-form"><div class="form-field"><label for="order-title">${isStudent ? '问题标题' : '工单名称'}</label><input id="order-title" name="title" required placeholder="例如：North Residence B 回收点照明故障" /></div><div class="form-grid"><div class="form-field"><label for="order-area">地点</label><select id="order-area" name="area"><option>North Residence B</option><option>North Residence C</option><option>South Residence D</option><option>Library loading bay</option><option>Student Union</option></select></div><div class="form-field"><label for="order-type">类型</label><select id="order-type" name="type"><option>家具</option><option>电子</option><option>书籍</option><option>维修</option><option>清运</option></select></div></div><div class="form-grid"><div class="form-field"><label for="order-due">截止时间</label><input id="order-due" name="due" required placeholder="今天 16:30" /></div><div class="form-field"><label for="order-priority">优先级</label><select id="order-priority" name="priority"><option>高</option><option selected>中</option><option>低</option></select></div></div><div class="form-grid">${assignmentField}<div class="form-field"><label for="order-quantity">数量</label><input id="order-quantity" name="quantity" type="number" min="1" value="1" /></div></div><div class="form-field"><label for="order-description">${isStudent ? '问题描述' : '处理说明'}</label><textarea id="order-description" name="description" placeholder="填写现场情况、影响范围或安全要求"></textarea></div><div class="modal-actions"><button class="button secondary" type="button" data-close-modal="true">取消</button><button class="button primary" type="submit">${isStudent ? '提交问题' : '创建工单'} <span>→</span></button></div></form>`);
  document.getElementById('work-order-form').addEventListener('submit', async event => { event.preventDefault(); if (!requireApi()) return; const body = Object.fromEntries(new FormData(event.currentTarget).entries()); try { const result = await apiRequest('/api/work-orders', { method: 'POST', body: JSON.stringify(body) }); if (result.queued) { state.workOrders.unshift({ ...body, id: `OFF-${Date.now()}`, status: 'new', person: body.person || (state.user?.role === 'student' ? 'UNASSIGNED' : 'LM'), priority: body.priority || '中' }); renderKanban(); } else await Promise.all([loadWorkOrders(), loadDashboard()]); closeModal(); showToast(result.queued ? '问题已加入离线队列' : state.user?.role === 'student' ? '问题已提交，设施运营可以看到并分配工单' : '工单已创建，已进入待处理队列'); } catch (error) { handleApiError(error); } });
}

function openOrderModal(id) {
  const order = state.workOrders.find(entry => entry.id === id); if (!order) return;
  const nextStatus = { new: 'progress', progress: 'pickup', pickup: 'done', done: 'done' }[order.status]; const nextLabel = { new: '开始处理', progress: '标记待清运', pickup: '完成工单', done: '已完成' }[order.status]; const statusLabel = { new: '待处理', progress: '处理中', pickup: '待清运', done: '已完成' }[order.status];
  const history = (order.history || [{ label: statusLabel, at: order.due }]).map(step => `<div class="timeline-step complete"><span class="timeline-dot"></span><div><strong>${escapeHtml(step.label)}</strong><small>${escapeHtml(step.at || '')}</small></div></div>`).join('');
  const assignment = ['operator','admin'].includes(state.user?.role) ? `<div class="form-field inline-assignee"><label for="order-assignee">负责人</label><select id="order-assignee">${assigneeOptions(order.person)}</select></div>` : `<div><span>负责人</span><span>${escapeHtml(order.person)} · Facilities</span></div>`;
  openModal(`<div class="modal-head"><div><p class="panel-kicker">WORK ORDER · ${escapeHtml(order.id)}</p><h2>${escapeHtml(order.title)}</h2><p>${escapeHtml(order.area)} · ${escapeHtml(order.type)}</p></div><button class="close-modal" data-close-modal="true" aria-label="关闭">×</button></div><div class="detail-list"><div><span>当前状态</span><span>${statusLabel}</span></div><div><span>截止时间</span><span>${escapeHtml(order.due)}</span></div><div><span>数量</span><span>${escapeHtml(order.quantity || 1)}</span></div><div><span>优先级</span><span>${escapeHtml(order.priority)}</span></div>${assignment}<div><span>处理说明</span><span>${escapeHtml(order.description || '暂无说明')}</span></div></div><div class="timeline"><p class="panel-kicker">WORK ORDER AUDIT</p>${history}</div><div class="modal-actions"><button class="button secondary" data-close-modal="true">关闭</button><button class="button primary" id="advance-order" ${order.status === 'done' ? 'disabled' : ''}>${nextLabel} <span>→</span></button></div>`);
  const advance = document.getElementById('advance-order'); if (advance && order.status !== 'done') advance.addEventListener('click', async () => { if (!requireApi()) return; const assignee = document.getElementById('order-assignee')?.value; try { await apiRequest(`/api/work-orders/${encodeURIComponent(order.id)}`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus, person: assignee }) }); closeModal(); await Promise.all([loadWorkOrders(), loadDashboard()]); showToast(`${order.id} 已更新，状态进入下一阶段`); } catch (error) { handleApiError(error); } });
}

function openRiskModal() {
  openModal(`<div class="modal-head"><div><p class="panel-kicker">NEW RISK · API CREATE</p><h2>新增风险项</h2><p>风险会进入治理登记表，供团队后续分配负责人和缓解措施。</p></div><button class="close-modal" data-close-modal="true" aria-label="关闭">×</button></div><form class="modal-form" id="risk-form"><div class="form-field"><label for="risk-title">风险名称</label><input id="risk-title" name="title" required placeholder="例如：数据同步延迟导致工单重复" /></div><div class="form-grid"><div class="form-field"><label for="risk-category">类别</label><select id="risk-category" name="category"><option>Infrastructure</option><option>Ethics</option><option>Safety</option><option>Privacy</option><option>Operations</option></select></div><div class="form-field"><label for="risk-level">等级</label><select id="risk-level" name="level"><option value="high">高</option><option value="medium" selected>中</option><option value="low">低</option></select></div></div><div class="form-grid"><div class="form-field"><label for="risk-probability">发生概率</label><select id="risk-probability" name="probability"><option value="1">1 · 很低</option><option value="2">2 · 较低</option><option value="3" selected>3 · 中</option><option value="4">4 · 较高</option><option value="5">5 · 很高</option></select></div><div class="form-field"><label for="risk-impact">影响程度</label><select id="risk-impact" name="impact"><option value="1">1 · 较小</option><option value="2">2 · 轻微</option><option value="3" selected>3 · 中</option><option value="4">4 · 严重</option><option value="5">5 · 关键</option></select></div></div><div class="form-grid"><div class="form-field"><label for="risk-due">复核日期</label><input id="risk-due" name="due" placeholder="例如：本周五" /></div><div class="form-field"><label for="risk-owner">负责人</label><input id="risk-owner" name="owner" required placeholder="例如：治理负责人" /></div></div><div class="form-field"><label for="risk-affected">影响对象</label><input id="risk-affected" name="affected" required placeholder="例如：学生、设施团队、数据管理员" /></div><div class="form-field"><label for="risk-mitigation">缓解措施</label><textarea id="risk-mitigation" name="mitigation" required placeholder="填写一个可执行的预防、监控或恢复措施"></textarea></div><div class="modal-actions"><button class="button secondary" type="button" data-close-modal="true">取消</button><button class="button primary" type="submit">写入风险登记表 <span>→</span></button></div></form>`);
  document.getElementById('risk-form').addEventListener('submit', async event => { event.preventDefault(); if (!requireApi()) return; const body = Object.fromEntries(new FormData(event.currentTarget).entries()); try { const result = await apiRequest('/api/risks', { method: 'POST', body: JSON.stringify(body) }); if (result.queued) { state.risks.unshift({ ...body, id: `OFF-${Date.now()}`, score: Number(body.probability) * Number(body.impact), status: '待同步' }); renderRisks(); } else await loadRisks(); closeModal(); showToast(result.queued ? '风险项已加入离线队列' : '风险项已写入治理登记表'); } catch (error) { handleApiError(error); } });
}

function openRiskDetailModal(id) {
  const risk = state.risks.find(entry => entry.id === id); if (!risk) return;
  const statusMap = { '监控中': 'monitoring', '已缓解': 'mitigated', '已关闭': 'closed' };
  openModal(`<div class="modal-head"><div><p class="panel-kicker">RISK CONTROL · ${escapeHtml(risk.id)}</p><h2>${escapeHtml(risk.title)}</h2><p>${escapeHtml(risk.category)} · 评分 ${riskScore(risk)} / 25</p></div><button class="close-modal" data-close-modal="true" aria-label="关闭">×</button></div><form class="modal-form" id="risk-update-form"><div class="form-field"><label for="risk-update-status">当前状态</label><select id="risk-update-status" name="status"><option value="monitoring" ${statusMap[risk.status] === 'monitoring' ? 'selected' : ''}>监控中</option><option value="mitigated" ${statusMap[risk.status] === 'mitigated' ? 'selected' : ''}>已缓解</option><option value="closed" ${statusMap[risk.status] === 'closed' ? 'selected' : ''}>已关闭</option></select></div><div class="form-field"><label for="risk-update-mitigation">最新缓解措施</label><textarea id="risk-update-mitigation" name="mitigation">${escapeHtml(risk.mitigation)}</textarea></div><div class="detail-list"><div><span>影响对象</span><span>${escapeHtml(risk.affected)}</span></div><div><span>负责人</span><span>${escapeHtml(risk.owner)}</span></div><div><span>复核日期</span><span>${escapeHtml(risk.due)}</span></div></div><div class="modal-actions"><button class="button secondary" type="button" data-close-modal="true">取消</button><button class="button primary" type="submit">保存风险状态 <span>→</span></button></div></form>`);
  document.getElementById('risk-update-form').addEventListener('submit', async event => { event.preventDefault(); if (!requireRole(['sustainability', 'admin']) || !requireApi()) return; const body = Object.fromEntries(new FormData(event.currentTarget).entries()); try { await apiRequest(`/api/risks/${encodeURIComponent(risk.id)}`, { method: 'PATCH', body: JSON.stringify(body) }); closeModal(); await Promise.all([loadRisks(), loadDashboard(), loadAudit()]); showToast('风险状态已更新并写入审计'); } catch (error) { handleApiError(error); } });
}

function openEvidenceModal() {
  openModal(`<div class="modal-head"><div><p class="panel-kicker">RESEARCH EVIDENCE · API CREATE</p><h2>添加证据记录</h2><p>只录入已经取得授权的访谈、观察或验证结果。</p></div><button class="close-modal" data-close-modal="true" aria-label="关闭">×</button></div><form class="modal-form" id="evidence-form"><div class="form-field"><label for="evidence-title">记录标题</label><input id="evidence-title" name="title" required placeholder="例如：学生访谈 01 · 领取点信任问题" /></div><div class="form-grid"><div class="form-field"><label for="evidence-type">证据类型</label><select id="evidence-type" name="type"><option>访谈</option><option>现场观察</option><option>流程验证</option><option>设计决策</option></select></div><div class="form-field"><label for="evidence-source">来源</label><input id="evidence-source" name="source" required placeholder="例如：学生受访者 S01" /></div></div><div class="form-field"><label for="evidence-finding">关键发现</label><textarea id="evidence-finding" name="finding" required placeholder="写下观察到的事实、痛点或设计依据"></textarea></div><label class="consent-field"><input type="checkbox" name="consent" value="true" required><span>我确认该记录已取得必要授权，可用于课程项目展示。</span></label><div class="modal-actions"><button class="button secondary" type="button" data-close-modal="true">取消</button><button class="button primary" type="submit">写入证据库 <span>→</span></button></div></form>`);
  document.getElementById('evidence-form').addEventListener('submit', async event => { event.preventDefault(); if (!requireApi()) return; const body = Object.fromEntries(new FormData(event.currentTarget).entries()); body.consent = body.consent === 'true'; try { await apiRequest('/api/evidence', { method: 'POST', body: JSON.stringify(body) }); closeModal(); await Promise.all([loadEvidence(), loadAudit()]); showToast('证据记录已写入后端'); } catch (error) { handleApiError(error); } });
}

function openRouteModal() {
  openModal(`<div class="modal-head"><div><p class="panel-kicker">TODAY'S ROUTE · LIVE VIEW</p><h2>今日清运路线</h2><p>根据当前开放工单生成的演示路线。</p></div><button class="close-modal" data-close-modal="true" aria-label="关闭">×</button></div><div class="route-modal-list"><div><strong>01 · North Residence B</strong><span>家具 · 09:30–10:30 · WO-2041</span></div><div><strong>02 · Library loading bay</strong><span>电子产品 · 10:45–11:15 · WO-2038</span></div><div><strong>03 · Student Union</strong><span>书籍 · 11:30–12:00 · WO-2029</span></div><div><strong>04 · South Residence D</strong><span>混合物资 · 13:00–13:45</span></div></div><div class="modal-actions"><button class="button secondary" data-close-modal="true">关闭</button><button class="button primary" data-action="copy-route">复制路线摘要 <span>↗</span></button></div>`);
}

function downloadCsv(filename, rows) {
  const csv = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })); link.download = filename; link.click(); URL.revokeObjectURL(link.href);
}

function exportAudit() {
  const entries = state.auditEntries || [];
  if (!entries.length) return showToast('当前没有可导出的审计记录', 'error');
  downloadCsv('campusloop-audit.csv', [['时间', '操作者', '动作', '对象类型', '对象'], ...entries.map(entry => [entry.at, entry.displayName || entry.actor, entry.actionLabel, entry.entityType, entry.entityLabel])]);
  showToast('审计日志已下载为 CSV');
}

function openInfoModal(title, kicker, body) {
  openModal(`<div class="modal-head"><div><p class="panel-kicker">${escapeHtml(kicker)}</p><h2>${escapeHtml(title)}</h2></div><button class="close-modal" data-close-modal="true" aria-label="关闭">×</button></div><div class="info-modal-copy">${body}</div><div class="modal-actions"><button class="button primary" data-close-modal="true">知道了</button></div>`);
}

function copyText(value, successMessage, fallbackMessage = value) {
  const copyPromise = navigator.clipboard?.writeText?.(value);
  if (copyPromise) copyPromise.then(() => showToast(successMessage)).catch(() => showToast(fallbackMessage));
  else showToast(fallbackMessage);
}

function openAccessReview() {
  if (!requireRole(['admin'])) return;
  const reviewed = state.users.filter(account => account.reviewed).length;
  const reviewPercent = state.metrics.reviewPercent ?? 0;
  const rows = state.users.map(account => `<div class="access-review-row" data-access-row="${escapeHtml(account.username)}"><div><strong>${escapeHtml(account.displayName)}</strong><small>${escapeHtml(account.username)} · ${escapeHtml(roleLabels[account.role] || account.role)}</small></div><label class="user-review"><input type="checkbox" data-access-reviewed ${account.reviewed ? 'checked' : ''}><span>已复核</span></label><button class="button small primary" data-access-save>保存</button></div>`).join('');
  openModal(`<div class="modal-head"><div><p class="panel-kicker">ACCESS REVIEW · LIVE DIRECTORY</p><h2>权限复核目录</h2><p id="access-review-modal-summary">当前已复核 ${reviewed} / ${state.users.length} 个账户，权限项完成率 ${reviewPercent}%。</p></div><button class="close-modal" data-close-modal="true" aria-label="关闭">×</button></div><div class="access-review-list">${rows}</div><div class="modal-actions"><button class="button secondary" data-close-modal="true">关闭</button><button class="button primary" data-access-refresh>刷新目录 <span>↻</span></button></div>`);
}

async function syncQueue() {
  if (!state.apiOnline) { showToast('后端未连接，无法同步', 'error'); return; }
  if (state.offlineMode) { state.offlineMode = false; persistOfflineQueue(); }
  try {
    for (const queued of state.queuedRequests) await apiRequest(queued.path, queued.options);
    state.queuedRequests = [];
    persistOfflineQueue();
    await apiRequest('/api/sync', { method: 'POST', body: JSON.stringify({ count: 3 }) });
    await Promise.all([loadDashboard(), loadItems(), loadWorkOrders(), loadRisks(), loadAudit()]);
    setServerStatus('online', '后端已连接 · 模拟数据');
    showToast('同步完成，离线记录已写入审计日志');
  } catch (error) { state.offlineMode = true; persistOfflineQueue(); handleApiError(error); }
}

function toggleOfflineMode() {
  if (!state.apiOnline) { showToast('后端未连接，无法模拟离线', 'error'); return; }
  state.offlineMode = !state.offlineMode;
  persistOfflineQueue();
  setServerStatus(state.offlineMode ? 'offline' : 'online', state.offlineMode ? '离线模式 · 新写入进入队列' : '后端已连接 · 模拟数据');
  showToast(state.offlineMode ? '已进入离线模式，新建操作会暂存' : '已退出离线模式，可以同步队列');
}

document.addEventListener('click', event => {
  const nav = event.target.closest('[data-page]'); if (nav) { goToPage(nav.dataset.page); return; }
  const jump = event.target.closest('[data-page-jump]'); if (jump) { goToPage(jump.dataset.pageJump); return; }
  const action = event.target.closest('[data-action]');
  if (action) {
    if (action.dataset.action === 'open-add-item') openAddItemModal();
    if (action.dataset.action === 'open-work-order' && requireRole(['student','operator','admin'])) openWorkOrderModal();
    if (action.dataset.action === 'open-risk' && requireRole(['sustainability','admin'])) openRiskModal();
    if (action.dataset.action === 'open-evidence' && requireRole(['operator','sustainability','admin'])) openEvidenceModal();
    if (action.dataset.action === 'open-access-review') openAccessReview();
    if (action.dataset.action === 'open-route') openRouteModal();
    if (action.dataset.action === 'copy-route') { const text = 'CampusLoop 今日清运路线：North Residence B 09:30、Library loading bay 10:45、Student Union 11:30、South Residence D 13:00'; copyText(text, '路线摘要已复制', '路线摘要：North Residence B → Library loading bay → Student Union → South Residence D'); }
    if (action.dataset.action === 'focus-filter') { document.getElementById('item-search')?.focus(); showToast('已聚焦搜索框，可按地点、编号或物品筛选'); }
    if (action.dataset.action === 'export-audit') exportAudit();
    if (action.dataset.action === 'export-report') { downloadCsv('campusloop-impact-report.csv', [['指标', '当前值'], ['避免填埋', `${state.metrics.avoidedKg ?? 0} kg`], ['再利用率', `${state.metrics.reuseRate ?? 0}%`], ['活跃资源', state.metrics.activeItems ?? '—'], ['开放工单', state.metrics.openOrders ?? '—'], ['待审核资源', state.metrics.pendingItems ?? '—'], ['已预约资源', state.metrics.claimedItems ?? '—'], ['风险项', state.metrics.risks ?? '—']]); showToast('影响报告已下载为 CSV'); }
    if (action.dataset.action === 'share-view') { copyText(window.location.href, '当前页面链接已复制', '当前页面链接：' + window.location.href); }
    if (action.dataset.action === 'sync-now') syncQueue();
    if (action.dataset.action === 'add-insight') { localStorage.setItem('campusloop-insight', 'North Residence B 领取点前移'); showToast('行动建议已加入本地行动清单'); }
    if (action.dataset.action === 'copy-summary') { const summary = 'CampusLoop 实施路线：需求与用户研究 → Residence B–D 试点 → 评估与调整 → 全校推广'; copyText(summary, '实施摘要已复制', summary); }
    if (action.dataset.action === 'open-settings') openInfoModal('项目设置', 'WORKSPACE SETTINGS', '<p>当前为本地演示环境。离线模式、自动刷新和数据写入都由当前浏览器与本地 Node 服务控制。</p><p>如需切换账号，请点击右上角退出后重新登录。</p>');
    if (action.dataset.action === 'open-help') openInfoModal('帮助中心', 'INTERACTION GUIDE', '<ul><li>资源交换：发布资源后会进入人工审核队列，学生可预约已通过审核的资源。</li><li>设施运营：负责人只能推进自己负责的工单，管理员可以查看全部工单。</li><li>治理与风险：可持续管理员和系统管理员可以登记、更新风险。</li><li>工单页面每 15 秒刷新一次，页面上的时间会显示最近一次后端同步。</li></ul>');
    if (action.dataset.action === 'open-notifications') openInfoModal('通知中心', 'NOTIFICATIONS', state.auditEntries?.length ? state.auditEntries.slice(0, 5).map(entry => `<p><strong>${escapeHtml(entry.actionLabel)}</strong><br><small>${escapeHtml(entry.displayName || entry.actor)} · ${escapeHtml(entry.at)}</small></p>`).join('') : '<p>当前没有新的操作通知。</p>');
    if (action.dataset.action === 'open-pilot-info') openInfoModal('退宿季资源回收行动', 'PILOT BRIEF', '<p>本试点围绕 Residence B–D 设计资源发布、人工审核、预约领取、设施工单和离线同步五条闭环。</p><p>页面中的影响数字是课程演示数据；资源、工单、风险、账户和审计记录会写入本地后端数据文件。</p>');
    if (action.dataset.action === 'open-mix-details') openInfoModal('资源构成明细', 'MATERIAL MIX', '<p>家具与木材 42% · 书籍与纸张 26% · 电子产品 18% · 其他 14%。这些比例用于展示 RFP 指标设计，正式部署时应由资源分类记录计算。</p>');
    if (action.dataset.action === 'show-toast') showToast(action.dataset.toast || '已完成');
    return;
  }
  const itemButton = event.target.closest('[data-item-id]'); if (itemButton && state.activePage === 'exchange') { openItemModal(itemButton.dataset.itemId); return; }
  const orderButton = event.target.closest('[data-order-id]'); if (orderButton) { openOrderModal(orderButton.dataset.orderId); return; }
  const riskButton = event.target.closest('[data-risk-id]'); if (riskButton) { openRiskDetailModal(riskButton.dataset.riskId); return; }
  if (event.target.closest('[data-close-modal]')) closeModal();
});

document.querySelectorAll('.segment').forEach(button => button.addEventListener('click', () => { document.querySelectorAll('.segment').forEach(item => item.classList.remove('active')); button.classList.add('active'); state.filter = button.dataset.filter; loadItems().catch(handleApiError); }));
document.querySelectorAll('[data-order-filter]').forEach(button => button.addEventListener('click', () => { state.orderFilter = button.dataset.orderFilter; renderKanban(); }));
document.getElementById('item-search').addEventListener('input', event => { state.search = event.target.value; loadItems().catch(handleApiError); });
document.getElementById('top-sync').addEventListener('click', syncQueue);
document.getElementById('sync-sidebar').addEventListener('click', syncQueue);
document.getElementById('offline-mode-button').addEventListener('click', toggleOfflineMode);
document.getElementById('login-form').addEventListener('submit', async event => { event.preventDefault(); const form = new FormData(event.currentTarget); const error = document.getElementById('login-error'); error.textContent = ''; try { await login(form.get('username'), form.get('password')); } catch (err) { error.textContent = err.message; } });
document.querySelectorAll('[data-demo-account]').forEach(button => button.addEventListener('click', () => { const credentials = { student: ['student', 'student123'], operator: ['operator', 'operator123'], operator_jc: ['operator_jc', 'operator123'], operator_ak: ['operator_ak', 'operator123'], sustainability: ['sustainability', 'sustain123'], admin: ['admin', 'admin123'] }[button.dataset.demoAccount]; document.getElementById('login-username').value = credentials[0]; document.getElementById('login-password').value = credentials[1]; }));
document.getElementById('logout-button').addEventListener('click', async () => { try { await apiRequest('/api/auth/logout', { method: 'POST' }); } catch (_) {} sessionStorage.removeItem('campusloop-token'); state.token = ''; showLogin(); });
document.addEventListener('click', async event => { const review = event.target.closest('[data-review-item]'); if (!review) return; if (!['operator','admin'].includes(state.user?.role)) return showToast('当前账户没有人工审核权限', 'error'); try { await apiRequest(`/api/items/${encodeURIComponent(review.dataset.reviewItem)}/review`, { method: 'PATCH', body: JSON.stringify({ decision: review.dataset.reviewStatus }) }); await Promise.all([loadItems(), loadModerationQueue(), loadDashboard()]); showToast(review.dataset.reviewStatus === 'approved' ? '资源已通过人工审核' : '资源已驳回'); } catch (error) { handleApiError(error); } });
document.addEventListener('click', async event => { const saveButton = event.target.closest('[data-save-user]'); if (!saveButton || saveButton.disabled) return; const row = saveButton.closest('[data-user-row]'); const username = row?.dataset.userRow; if (!username || !requireRole(['admin'])) return; const role = row.querySelector('[data-user-role]')?.value; const active = row.querySelector('[data-user-active]')?.checked; const reviewed = row.querySelector('[data-user-review]')?.checked; saveButton.disabled = true; try { const payload = await apiRequest(`/api/users/${encodeURIComponent(username)}`, { method: 'PATCH', body: JSON.stringify({ role, active, reviewed }) }); const index = state.users.findIndex(account => account.username === username); if (index >= 0) state.users[index] = payload.user; await Promise.all([loadAssignees(), loadDashboard(), loadAudit()]); renderUsers(); showToast(`${payload.user.displayName} 的账户目录状态已保存`); } catch (error) { handleApiError(error); saveButton.disabled = false; } });
document.addEventListener('click', async event => { const saveButton = event.target.closest('[data-access-save]'); if (!saveButton) return; const row = saveButton.closest('[data-access-row]'); const username = row?.dataset.accessRow; if (!username || !requireRole(['admin'])) return; saveButton.disabled = true; try { const reviewed = row.querySelector('[data-access-reviewed]')?.checked; await apiRequest(`/api/users/${encodeURIComponent(username)}`, { method: 'PATCH', body: JSON.stringify({ reviewed }) }); await Promise.all([loadUsers(), loadDashboard(), loadAudit()]); closeModal(); openAccessReview(); showToast('权限复核状态已保存'); } catch (error) { handleApiError(error); saveButton.disabled = false; } });
document.addEventListener('click', async event => { const refresh = event.target.closest('[data-access-refresh]'); if (!refresh) return; try { await loadUsers(); closeModal(); openAccessReview(); } catch (error) { handleApiError(error); } });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && modalRoot.getAttribute('aria-hidden') === 'false') closeModal(); });

bootstrap();

