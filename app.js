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
  risks: []
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
  state.token = payload.token; sessionStorage.setItem('campusloop-token', state.token); showApp(payload.user); await loadAuthenticatedData();
}

async function loadAuthenticatedData() {
  setServerStatus('loading', '加载工作空间…');
  await Promise.all([loadItems(), loadWorkOrders(), loadRisks(), loadModerationQueue()]);
  setServerStatus('online', '已登录 · 后端已连接');
  persistOfflineQueue();
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
  renderKanban();
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

function renderModerationQueue(items) {
  const list = document.getElementById('moderation-list');
  const count = document.getElementById('moderation-count');
  if (!list || !count) return;
  count.textContent = `${items.length} 项`;
  if (!items.length) { list.innerHTML = '<p class="empty-inline">当前没有待人工审核资源。</p>'; return; }
  list.innerHTML = items.map(item => `<div class="moderation-row"><div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.category)} · ${escapeHtml(item.location)} · ${escapeHtml(item.id)}</span></div><div class="moderation-actions"><button class="button small secondary" data-review-item="${escapeHtml(item.id)}" data-review-status="rejected">驳回</button><button class="button small primary" data-review-item="${escapeHtml(item.id)}" data-review-status="approved">通过</button></div></div>`).join('');
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
  if (page === 'governance') { loadRisks().catch(handleApiError); loadModerationQueue().catch(handleApiError); }
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
  board.innerHTML = columns.map(column => {
    const orders = state.workOrders.filter(order => order.status === column.key);
    return `<div class="kanban-column"><div class="column-heading"><span>${column.label}</span><b>${orders.length}</b></div><div class="kanban-stack">${orders.map(order => `<button class="kanban-card" data-order-id="${escapeHtml(order.id)}" aria-label="查看工单 ${escapeHtml(order.id)}"><div class="kanban-card-top"><strong>${escapeHtml(order.title)}</strong><span class="kanban-tag">${escapeHtml(order.priority)}</span></div><p>${escapeHtml(order.area)} · ${escapeHtml(order.type)}</p><div class="kanban-card-foot"><span>${escapeHtml(order.due)}</span><span class="assignee"><i class="assignee-avatar">${escapeHtml(order.person)}</i></span></div></button>`).join('')}</div></div>`;
  }).join('');
}

function riskClass(level) { return level === 'high' ? 'high' : level === 'low' ? 'low' : 'medium'; }
function riskLabel(level) { return level === 'high' ? '高' : level === 'low' ? '低' : '中'; }
function riskScore(risk) { return Number(risk.score || ((Number(risk.probability) || 3) * (Number(risk.impact) || 3))); }

function renderRisks() {
  const body = document.getElementById('risk-table-body');
  if (!body) return;
  body.innerHTML = state.risks.length ? state.risks.map(risk => `<tr><td><strong>${escapeHtml(risk.title)}</strong><span class="table-sub">${escapeHtml(risk.category)} · ${escapeHtml(risk.id)}</span></td><td>${escapeHtml(risk.affected)}</td><td><span class="risk-label ${riskClass(risk.level)}">${riskLabel(risk.level)}</span></td><td><span class="score-pill ${riskScore(risk) >= 12 ? 'score-high' : riskScore(risk) >= 6 ? 'score-medium' : 'score-low'}">${riskScore(risk)} / 25</span></td><td>${escapeHtml(risk.mitigation)}</td><td>${escapeHtml(risk.owner)}</td><td><span class="status-text ${risk.status === '已缓解' ? 'green-text' : 'amber-text'}">${escapeHtml(risk.status)}</span></td></tr>`).join('') : '<tr><td colspan="7">暂无风险记录</td></tr>';
}

function openModal(content) {
  modalRoot.innerHTML = `<div class="modal-backdrop" data-close-modal="true"></div><div class="modal" role="dialog" aria-modal="true">${content}</div>`;
  modalRoot.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
}

function closeModal() { modalRoot.setAttribute('aria-hidden', 'true'); modalRoot.innerHTML = ''; document.body.style.overflow = ''; }

function openAddItemModal() {
  openModal(`<div class="modal-head"><div><p class="panel-kicker">NEW RESOURCE · API CREATE</p><h2>发布一件资源</h2><p>提交后会写入后端数据文件，并进入人工审核队列。</p></div><button class="close-modal" data-close-modal="true" aria-label="关闭">×</button></div><form class="modal-form" id="add-item-form"><div class="form-field"><label for="item-name">资源名称</label><input id="item-name" name="name" required placeholder="例如：可折叠学习桌" /></div><div class="form-grid"><div class="form-field"><label for="item-category">分类</label><select id="item-category" name="category"><option>家具</option><option>书籍</option><option>电子产品</option><option>生活用品</option><option>其他</option></select></div><div class="form-field"><label for="item-location">领取地点</label><select id="item-location" name="location"><option>North Residence B · 1F</option><option>Library loading bay</option><option>Student Union · 服务台</option><option>South Residence D · 1F</option></select></div></div><div class="form-field"><label for="item-note">补充说明</label><textarea id="item-note" name="note" placeholder="描述物品状态、领取方式或安全注意事项"></textarea></div><div class="modal-actions"><button class="button secondary" type="button" data-close-modal="true">取消</button><button class="button primary" type="submit">写入后端 <span>→</span></button></div></form>`);
  document.getElementById('add-item-form').addEventListener('submit', async event => { event.preventDefault(); if (!requireApi()) return; const body = Object.fromEntries(new FormData(event.currentTarget).entries()); try { const result = await apiRequest('/api/items', { method: 'POST', body: JSON.stringify(body) }); if (result.queued) { state.items.unshift({ ...body, id: `OFF-${Date.now()}`, status: '待同步', statusKey: 'available', impact: '待估算影响', owner: 'Lin Mei', posted: '刚刚', emoji: body.category === '家具' ? '🪑' : body.category === '电子产品' ? '🖥️' : '📦' }); renderItems(); } else await loadItems(); closeModal(); showToast(result.queued ? '资源已加入离线队列' : '资源已写入后端，等待学生大使审核'); } catch (error) { handleApiError(error); } });
}

function openItemModal(id) {
  const item = state.items.find(entry => entry.id === id); if (!item) return;
  const lifecycle = item.history || [{ label: '已发布', at: item.posted }, { label: item.status, at: '当前状态' }];
  const timeline = lifecycle.map((step, index) => `<div class="timeline-step ${index === lifecycle.length - 1 ? 'current' : 'complete'}"><span class="timeline-dot"></span><div><strong>${escapeHtml(step.label)}</strong><small>${escapeHtml(step.at || '')}</small></div></div>`).join('');
  openModal(`<div class="modal-head"><div><p class="panel-kicker">RESOURCE DETAIL · ${escapeHtml(item.id)}</p><h2>资源详情</h2></div><button class="close-modal" data-close-modal="true" aria-label="关闭">×</button></div><div class="detail-hero"><span class="item-emoji">${itemEmoji(item)}</span><div class="detail-meta"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.category)} · ${escapeHtml(item.status)}</span></div></div><div class="detail-list"><div><span>领取地点</span><span>${escapeHtml(item.location)}</span></div><div><span>发布者</span><span>${escapeHtml(item.owner)}</span></div><div><span>循环价值</span><span class="green-text">${escapeHtml(item.impact)}</span></div><div><span>更新时间</span><span>${escapeHtml(item.posted)}</span></div></div><div class="timeline"><p class="panel-kicker">LIFECYCLE AUDIT</p>${timeline}</div><div class="modal-actions"><button class="button secondary" data-close-modal="true">关闭</button><button class="button primary" id="claim-item">${item.statusKey === 'available' ? '预约领取' : '关注状态'} <span>→</span></button></div>`);
  document.getElementById('claim-item').addEventListener('click', async () => { if (item.statusKey !== 'available') { closeModal(); showToast('已加入状态提醒'); return; } if (!requireApi()) return; try { await apiRequest(`/api/items/${encodeURIComponent(item.id)}`, { method: 'PATCH', body: JSON.stringify({ action: 'claim' }) }); closeModal(); await loadItems(); showToast(`已预约“${item.name}”，请在领取时间内完成扫码`); } catch (error) { handleApiError(error); } });
}

function openWorkOrderModal() {
  openModal(`<div class="modal-head"><div><p class="panel-kicker">NEW WORK ORDER · API CREATE</p><h2>新建设施工单</h2><p>新工单会进入“待处理”列，并写入后端数据文件。</p></div><button class="close-modal" data-close-modal="true" aria-label="关闭">×</button></div><form class="modal-form" id="work-order-form"><div class="form-field"><label for="order-title">工单名称</label><input id="order-title" name="title" required placeholder="例如：B 区家具集中清运" /></div><div class="form-grid"><div class="form-field"><label for="order-area">地点</label><select id="order-area" name="area"><option>North Residence B</option><option>North Residence C</option><option>South Residence D</option><option>Library loading bay</option><option>Student Union</option></select></div><div class="form-field"><label for="order-type">类型</label><select id="order-type" name="type"><option>家具</option><option>电子</option><option>书籍</option><option>维修</option><option>清运</option></select></div></div><div class="form-grid"><div class="form-field"><label for="order-due">截止时间</label><input id="order-due" name="due" required placeholder="今天 16:30" /></div><div class="form-field"><label for="order-priority">优先级</label><select id="order-priority" name="priority"><option>高</option><option selected>中</option><option>低</option></select></div></div><div class="form-grid"><div class="form-field"><label for="order-person">负责人</label><select id="order-person" name="person"><option value="LM">Lin Mei</option><option value="JC">Jordan Chen</option><option value="AK">Ava Kim</option></select></div><div class="form-field"><label for="order-quantity">数量</label><input id="order-quantity" name="quantity" type="number" min="1" value="1" /></div></div><div class="form-field"><label for="order-description">处理说明</label><textarea id="order-description" name="description" placeholder="填写特殊安全要求或现场联系人"></textarea></div><div class="modal-actions"><button class="button secondary" type="button" data-close-modal="true">取消</button><button class="button primary" type="submit">创建工单 <span>→</span></button></div></form>`);
  document.getElementById('work-order-form').addEventListener('submit', async event => { event.preventDefault(); if (!requireApi()) return; const body = Object.fromEntries(new FormData(event.currentTarget).entries()); try { const result = await apiRequest('/api/work-orders', { method: 'POST', body: JSON.stringify(body) }); if (result.queued) { state.workOrders.unshift({ ...body, id: `OFF-${Date.now()}`, status: 'new', person: body.person || 'LM', priority: body.priority || '中' }); renderKanban(); } else await loadWorkOrders(); closeModal(); showToast(result.queued ? '工单已加入离线队列' : '工单已创建，已进入待处理队列'); } catch (error) { handleApiError(error); } });
}

function openOrderModal(id) {
  const order = state.workOrders.find(entry => entry.id === id); if (!order) return;
  const nextStatus = { new: 'progress', progress: 'pickup', pickup: 'done', done: 'done' }[order.status]; const nextLabel = { new: '开始处理', progress: '标记待清运', pickup: '完成工单', done: '已完成' }[order.status]; const statusLabel = { new: '待处理', progress: '处理中', pickup: '待清运', done: '已完成' }[order.status];
  const history = (order.history || [{ label: statusLabel, at: order.due }]).map(step => `<div class="timeline-step complete"><span class="timeline-dot"></span><div><strong>${escapeHtml(step.label)}</strong><small>${escapeHtml(step.at || '')}</small></div></div>`).join('');
  const assignment = ['operator','admin'].includes(state.user?.role) ? `<div class="form-field inline-assignee"><label for="order-assignee">负责人</label><select id="order-assignee"><option value="LM" ${order.person === 'LM' ? 'selected' : ''}>Lin Mei</option><option value="JC" ${order.person === 'JC' ? 'selected' : ''}>Jordan Chen</option><option value="AK" ${order.person === 'AK' ? 'selected' : ''}>Ava Kim</option></select></div>` : `<div><span>负责人</span><span>${escapeHtml(order.person)} · Facilities</span></div>`;
  openModal(`<div class="modal-head"><div><p class="panel-kicker">WORK ORDER · ${escapeHtml(order.id)}</p><h2>${escapeHtml(order.title)}</h2><p>${escapeHtml(order.area)} · ${escapeHtml(order.type)}</p></div><button class="close-modal" data-close-modal="true" aria-label="关闭">×</button></div><div class="detail-list"><div><span>当前状态</span><span>${statusLabel}</span></div><div><span>截止时间</span><span>${escapeHtml(order.due)}</span></div><div><span>数量</span><span>${escapeHtml(order.quantity || 1)}</span></div><div><span>优先级</span><span>${escapeHtml(order.priority)}</span></div>${assignment}<div><span>处理说明</span><span>${escapeHtml(order.description || '暂无说明')}</span></div></div><div class="timeline"><p class="panel-kicker">WORK ORDER AUDIT</p>${history}</div><div class="modal-actions"><button class="button secondary" data-close-modal="true">关闭</button><button class="button primary" id="advance-order" ${order.status === 'done' ? 'disabled' : ''}>${nextLabel} <span>→</span></button></div>`);
  const advance = document.getElementById('advance-order'); if (advance && order.status !== 'done') advance.addEventListener('click', async () => { if (!requireApi()) return; const assignee = document.getElementById('order-assignee')?.value; try { await apiRequest(`/api/work-orders/${encodeURIComponent(order.id)}`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus, person: assignee }) }); closeModal(); await loadWorkOrders(); showToast(`${order.id} 已更新，状态进入下一阶段`); } catch (error) { handleApiError(error); } });
}

function openRiskModal() {
  openModal(`<div class="modal-head"><div><p class="panel-kicker">NEW RISK · API CREATE</p><h2>新增风险项</h2><p>风险会进入治理登记表，供团队后续分配负责人和缓解措施。</p></div><button class="close-modal" data-close-modal="true" aria-label="关闭">×</button></div><form class="modal-form" id="risk-form"><div class="form-field"><label for="risk-title">风险名称</label><input id="risk-title" name="title" required placeholder="例如：数据同步延迟导致工单重复" /></div><div class="form-grid"><div class="form-field"><label for="risk-category">类别</label><select id="risk-category" name="category"><option>Infrastructure</option><option>Ethics</option><option>Safety</option><option>Privacy</option><option>Operations</option></select></div><div class="form-field"><label for="risk-level">等级</label><select id="risk-level" name="level"><option value="high">高</option><option value="medium" selected>中</option><option value="low">低</option></select></div></div><div class="form-grid"><div class="form-field"><label for="risk-probability">发生概率</label><select id="risk-probability" name="probability"><option value="1">1 · 很低</option><option value="2">2 · 较低</option><option value="3" selected>3 · 中</option><option value="4">4 · 较高</option><option value="5">5 · 很高</option></select></div><div class="form-field"><label for="risk-impact">影响程度</label><select id="risk-impact" name="impact"><option value="1">1 · 较小</option><option value="2">2 · 轻微</option><option value="3" selected>3 · 中</option><option value="4">4 · 严重</option><option value="5">5 · 关键</option></select></div></div><div class="form-grid"><div class="form-field"><label for="risk-due">复核日期</label><input id="risk-due" name="due" placeholder="例如：本周五" /></div><div class="form-field"><label for="risk-owner">负责人</label><input id="risk-owner" name="owner" required placeholder="例如：治理负责人" /></div></div><div class="form-field"><label for="risk-affected">影响对象</label><input id="risk-affected" name="affected" required placeholder="例如：学生、设施团队、数据管理员" /></div><div class="form-field"><label for="risk-mitigation">缓解措施</label><textarea id="risk-mitigation" name="mitigation" required placeholder="填写一个可执行的预防、监控或恢复措施"></textarea></div><div class="modal-actions"><button class="button secondary" type="button" data-close-modal="true">取消</button><button class="button primary" type="submit">写入风险登记表 <span>→</span></button></div></form>`);
  document.getElementById('risk-form').addEventListener('submit', async event => { event.preventDefault(); if (!requireApi()) return; const body = Object.fromEntries(new FormData(event.currentTarget).entries()); try { const result = await apiRequest('/api/risks', { method: 'POST', body: JSON.stringify(body) }); if (result.queued) { state.risks.unshift({ ...body, id: `OFF-${Date.now()}`, score: Number(body.probability) * Number(body.impact), status: '待同步' }); renderRisks(); } else await loadRisks(); closeModal(); showToast(result.queued ? '风险项已加入离线队列' : '风险项已写入治理登记表'); } catch (error) { handleApiError(error); } });
}

async function syncQueue() {
  if (!state.apiOnline) { showToast('后端未连接，无法同步', 'error'); return; }
  if (state.offlineMode) { state.offlineMode = false; persistOfflineQueue(); }
  try {
    for (const queued of state.queuedRequests) await apiRequest(queued.path, queued.options);
    state.queuedRequests = [];
    persistOfflineQueue();
    await apiRequest('/api/sync', { method: 'POST', body: JSON.stringify({ count: 3 }) });
    await Promise.all([loadItems(), loadWorkOrders(), loadRisks()]);
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
  if (action) { if (action.dataset.action === 'open-add-item') openAddItemModal(); if (action.dataset.action === 'open-work-order' && requireRole(['operator','admin'])) openWorkOrderModal(); if (action.dataset.action === 'open-risk' && requireRole(['sustainability','admin'])) openRiskModal(); if (action.dataset.action === 'show-toast') showToast(action.dataset.toast || '已完成'); return; }
  const itemButton = event.target.closest('[data-item-id]'); if (itemButton && state.activePage === 'exchange') { openItemModal(itemButton.dataset.itemId); return; }
  const orderButton = event.target.closest('[data-order-id]'); if (orderButton) { openOrderModal(orderButton.dataset.orderId); return; }
  if (event.target.closest('[data-close-modal]')) closeModal();
});

document.querySelectorAll('.segment').forEach(button => button.addEventListener('click', () => { document.querySelectorAll('.segment').forEach(item => item.classList.remove('active')); button.classList.add('active'); state.filter = button.dataset.filter; loadItems().catch(handleApiError); }));
document.getElementById('item-search').addEventListener('input', event => { state.search = event.target.value; loadItems().catch(handleApiError); });
document.getElementById('top-sync').addEventListener('click', syncQueue);
document.getElementById('sync-sidebar').addEventListener('click', syncQueue);
document.getElementById('offline-mode-button').addEventListener('click', toggleOfflineMode);
document.getElementById('login-form').addEventListener('submit', async event => { event.preventDefault(); const form = new FormData(event.currentTarget); const error = document.getElementById('login-error'); error.textContent = ''; try { await login(form.get('username'), form.get('password')); } catch (err) { error.textContent = err.message; } });
document.querySelectorAll('[data-demo-account]').forEach(button => button.addEventListener('click', () => { const credentials = { student: ['student', 'student123'], operator: ['operator', 'operator123'], sustainability: ['sustainability', 'sustain123'], admin: ['admin', 'admin123'] }[button.dataset.demoAccount]; document.getElementById('login-username').value = credentials[0]; document.getElementById('login-password').value = credentials[1]; }));
document.getElementById('logout-button').addEventListener('click', async () => { try { await apiRequest('/api/auth/logout', { method: 'POST' }); } catch (_) {} sessionStorage.removeItem('campusloop-token'); state.token = ''; showLogin(); });
document.addEventListener('click', async event => { const review = event.target.closest('[data-review-item]'); if (!review) return; if (!['operator','admin'].includes(state.user?.role)) return showToast('当前账户没有人工审核权限', 'error'); try { await apiRequest(`/api/items/${encodeURIComponent(review.dataset.reviewItem)}/review`, { method: 'PATCH', body: JSON.stringify({ decision: review.dataset.reviewStatus }) }); await Promise.all([loadItems(), loadModerationQueue()]); showToast(review.dataset.reviewStatus === 'approved' ? '资源已通过人工审核' : '资源已驳回'); } catch (error) { handleApiError(error); } });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && modalRoot.getAttribute('aria-hidden') === 'false') closeModal(); });

bootstrap();

