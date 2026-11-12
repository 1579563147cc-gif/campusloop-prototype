const http = require('http');
const fs = require('fs/promises');
const path = require('path');

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DATA_PATH = path.join(DATA_DIR, 'store.json');
const MAX_BODY_BYTES = 1024 * 1024;
const sessions = new Map();
const users = [
  { username: 'student', password: 'student123', role: 'student', displayName: 'Mia Student', initials: 'MS' },
  { username: 'operator', password: 'operator123', role: 'operator', displayName: 'Lin Mei', initials: 'LM' },
  { username: 'operator_jc', password: 'operator123', role: 'operator', displayName: 'Jordan Chen', initials: 'JC' },
  { username: 'operator_ak', password: 'operator123', role: 'operator', displayName: 'Ava Kim', initials: 'AK' },
  { username: 'sustainability', password: 'sustain123', role: 'sustainability', displayName: 'Ravi Green', initials: 'RG' },
  { username: 'admin', password: 'admin123', role: 'admin', displayName: 'Alex Admin', initials: 'AA' }
];

const seedStore = {
  meta: { offlineQueue: 3, lastSync: '今天 08:42' },
  userDirectory: users.map(user => ({ username: user.username, role: user.role, displayName: user.displayName, initials: user.initials, active: true, reviewed: user.username !== 'admin', reviewWeight: { student: 5, operator: 5, operator_jc: 5, operator_ak: 4, sustainability: 4, admin: 2 }[user.username] || 1, lastLogin: null })),
  evidence: [],
  riskReports: [],
  items: [
    { id: 'ITM-1042', name: '木质学习桌', category: '家具', location: 'North Residence B · 1F', status: '待领取', statusKey: 'available', impact: '避免 18 kg 废弃物', emoji: '🪑', owner: '匿名学生', posted: '2 小时前' },
    { id: 'ITM-1038', name: 'Dell 24″ 显示器', category: '电子产品', location: 'Library loading bay', status: '待维修', statusKey: 'repair', impact: '维修后再利用', emoji: '🖥️', owner: 'IT Services', posted: '今天 08:15' },
    { id: 'ITM-1034', name: '城市通勤自行车', category: '交通', location: 'South Residence D · 服务台', status: '待领取', statusKey: 'available', impact: '避免 12 kg 废弃物', emoji: '🚲', owner: '匿名学生', posted: '昨天' },
    { id: 'ITM-1027', name: '课程教材组合', category: '书籍', location: 'Student Union · 2F', status: '待捐赠', statusKey: 'donation', impact: '预计惠及 6 位学生', emoji: '📚', owner: 'Business Society', posted: '昨天' },
    { id: 'ITM-1020', name: '折叠椅 × 4', category: '家具', location: 'North Residence C · 3F', status: '待领取', statusKey: 'available', impact: '避免 9 kg 废弃物', emoji: '🪑', owner: 'Residence team', posted: '2 天前' },
    { id: 'ITM-1014', name: '小型投影仪', category: '电子产品', location: 'Media Lab · 1F', status: '待维修', statusKey: 'repair', impact: '延长 2 年使用期', emoji: '📽️', owner: 'Media Lab', posted: '3 天前' },
    { id: 'ITM-1008', name: '收纳箱 × 8', category: '生活用品', location: 'South Residence D · 1F', status: '待领取', statusKey: 'available', impact: '避免 6 kg 废弃物', emoji: '📦', owner: '匿名学生', posted: '3 天前' },
    { id: 'ITM-1004', name: '白板与支架', category: '学习用品', location: 'Student Union · 3F', status: '待捐赠', statusKey: 'donation', impact: '支持社团共享', emoji: '🧾', owner: 'Design Society', posted: '4 天前' }
  ],
  workOrders: [
    { id: 'WO-2041', title: 'B 区家具集中清运', area: 'North Residence B', type: '家具', due: '今天 10:30', status: 'new', person: 'LM', priority: '高', description: '退宿季家具集中清运，先检查二维码记录。' },
    { id: 'WO-2038', title: '电子产品安全检查', area: 'Library loading bay', type: '电子', due: '今天 11:15', status: 'progress', person: 'JC', priority: '中', description: '检查电源线和可维修状态。' },
    { id: 'WO-2034', title: '回收点标识更新', area: 'South Residence D', type: '标识', due: '今天 13:00', status: 'progress', person: 'AK', priority: '低', description: '补充分类说明和离线登记二维码。' },
    { id: 'WO-2029', title: '书籍领取点补货', area: 'Student Union', type: '书籍', due: '今天 14:30', status: 'pickup', person: 'LM', priority: '中', description: '将待领取教材移至二层服务台。' },
    { id: 'WO-2024', title: '上周纸张回收核对', area: 'Academic block', type: '纸张', due: '已完成 09:10', status: 'done', person: 'JC', priority: '低', description: '已完成称重和台账核对。' },
    { id: 'WO-2018', title: '宿舍 C 区维修回访', area: 'North Residence C', type: '维修', due: '已完成 昨天', status: 'done', person: 'AK', priority: '低', description: '已完成领取者回访。' }
  ],
  risks: [
    { id: 'R-03', title: 'Wi-Fi 中断导致工单无法更新', category: 'Infrastructure', affected: '设施团队、学生', level: 'medium', mitigation: '离线队列 + 纸面备用表 + 恢复后冲突检查', owner: '运营负责人', status: '已缓解' },
    { id: 'R-05', title: '奖励机制造成不公平参与', category: 'Ethics', affected: '低带宽用户、残障用户', level: 'high', mitigation: '不以个人排名为唯一激励，保留人工申诉和替代渠道', owner: '治理负责人', status: '监控中' },
    { id: 'R-07', title: '危险物品误发布', category: 'Safety', affected: '领取者、设施团队', level: 'high', mitigation: '分类规则、关键词拦截、人工审核和下架审计', owner: '学生大使', status: '已缓解' }
  ],
  auditLog: []
};

let store;

async function initStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try { store = JSON.parse(await fs.readFile(DATA_PATH, 'utf8')); }
  catch { store = JSON.parse(JSON.stringify(seedStore)); await persist(); }
  store.items = store.items.map(item => ({ ...item, history: item.history || [{ label: '已发布', at: item.posted || '演示数据' }] }));
  store.workOrders = store.workOrders.map(order => ({ ...order, quantity: order.quantity || 1, history: order.history || [{ label: order.status === 'done' ? '已完成' : '已创建', at: order.due || '演示数据' }] }));
  store.risks = store.risks.map(risk => ({ ...risk, probability: Number(risk.probability || 3), impact: Number(risk.impact || 3), score: Number(risk.score || 9), due: risk.due || '待确认' }));
  store.auditLog = Array.isArray(store.auditLog) ? store.auditLog : [];
  store.evidence = Array.isArray(store.evidence) ? store.evidence : [];
  store.riskReports = Array.isArray(store.riskReports) ? store.riskReports : [];
  const defaultDirectory = users.map(user => ({ username: user.username, role: user.role, displayName: user.displayName, initials: user.initials, active: true, reviewed: user.username !== 'admin', reviewWeight: { student: 5, operator: 5, operator_jc: 5, operator_ak: 4, sustainability: 4, admin: 2 }[user.username] || 1, lastLogin: null }));
  store.userDirectory = Array.isArray(store.userDirectory) ? store.userDirectory : defaultDirectory;
  store.userDirectory = users.map(account => {
    const existing = store.userDirectory.find(entry => entry.username === account.username) || {};
    return { username: account.username, role: existing.role || account.role, displayName: account.displayName, initials: account.initials, active: existing.active !== false, reviewed: existing.reviewed === undefined ? account.username !== 'admin' : existing.reviewed === true, reviewWeight: Number(existing.reviewWeight || ({ student: 5, operator: 5, operator_jc: 5, operator_ak: 4, sustainability: 4, admin: 2 }[account.username] || 1)), lastLogin: existing.lastLogin || null };
  });
  await persist();
}

async function persist() {
  const tempPath = `${DATA_PATH}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(store, null, 2), 'utf8');
  await fs.rename(tempPath, DATA_PATH);
}

function sendJson(res, statusCode, payload, extraHeaders = {}) { res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS', ...extraHeaders }); res.end(JSON.stringify(payload)); }
function sendError(res, statusCode, code, message) { sendJson(res, statusCode, { error: { code, message } }); }

async function readJsonBody(req) {
  let total = 0; const chunks = [];
  for await (const chunk of req) { total += chunk.length; if (total > MAX_BODY_BYTES) throw Object.assign(new Error('请求体过大'), { statusCode: 413, code: 'PAYLOAD_TOO_LARGE' }); chunks.push(chunk); }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('请求体不是有效 JSON'), { statusCode: 400, code: 'INVALID_JSON' }); }
}

function nextId(prefix, records) { const max = records.reduce((highest, record) => Math.max(highest, Number(String(record.id).replace(/\D/g, '')) || 0), 0); return `${prefix}-${String(max + 1).padStart(4, '0')}`; }
function nextRiskId(records) { const max = records.reduce((highest, record) => Math.max(highest, Number(String(record.id).replace(/\D/g, '')) || 0), 0); return `R-${String(max + 1).padStart(2, '0')}`; }
function text(value, fallback = '') { return typeof value === 'string' && value.trim() ? value.trim() : fallback; }
function itemEmoji(category) { if (category.includes('电子')) return '🖥️'; if (category.includes('家具')) return '🪑'; if (category.includes('交通')) return '🚲'; if (category.includes('书')) return '📚'; return '📦'; }
function activeOperators() { return store.userDirectory.filter(entry => entry.active !== false && entry.role === 'operator'); }
function validAssignee(value) { return activeOperators().some(entry => entry.initials === value || entry.username === value); }
function normalizedAssignee(value, fallback) { const candidate = text(value, fallback); const match = activeOperators().find(entry => entry.initials === candidate || entry.username === candidate); return match ? match.initials : null; }

async function appendAudit(user, actionLabel, entityType, entityId, entityLabel, reason = '') {
  store.auditLog.unshift({ id: `AUD-${Date.now()}`, actor: user?.username || 'system', displayName: user?.displayName || 'System', initials: user?.initials || 'SYS', actionLabel, entityType, entityId, entityLabel, reason, at: new Date().toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' }) });
  store.auditLog = store.auditLog.slice(0, 120);
}

function getSession(req) {
  const auth = req.headers.authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const cookie = String(req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith('cl_session='));
  const token = bearer || (cookie ? cookie.slice('cl_session='.length) : '');
  return token ? sessions.get(token) : null;
}

function requireUser(req, res, roles = []) {
  const user = getSession(req);
  if (!user) { sendError(res, 401, 'UNAUTHENTICATED', '请先登录'); return null; }
  if (roles.length && !roles.includes(user.role)) { sendError(res, 403, 'FORBIDDEN', '当前角色没有执行此操作的权限'); return null; }
  return user;
}

async function handleApi(req, res, url) {
  const segments = url.pathname.split('/').filter(Boolean);
  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    const body = await readJsonBody(req); const account = users.find(user => user.username === body.username && user.password === body.password); const directoryEntry = account && store.userDirectory.find(entry => entry.username === account.username);
    if (!account) return sendError(res, 401, 'INVALID_CREDENTIALS', '用户名或密码不正确');
    if (directoryEntry && directoryEntry.active === false) return sendError(res, 403, 'ACCOUNT_DISABLED', '该账户已停用，请联系系统管理员');
    if (directoryEntry) directoryEntry.lastLogin = new Date().toISOString();
    const token = require('crypto').randomUUID(); const safeUser = { username: account.username, role: directoryEntry?.role || account.role, displayName: account.displayName, initials: account.initials };
    sessions.set(token, safeUser); await appendAudit(safeUser, '登录系统', 'Auth', safeUser.username, safeUser.displayName); await persist();
    return sendJson(res, 200, { token, user: safeUser }, { 'Set-Cookie': `cl_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800` });
  }
  if (req.method === 'GET' && url.pathname === '/api/auth/me') { const user = requireUser(req, res); if (!user) return; return sendJson(res, 200, { user }); }
  if (req.method === 'POST' && url.pathname === '/api/auth/logout') { const user = getSession(req); if (user) { const auth = req.headers.authorization || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (token) sessions.delete(token); } return sendJson(res, 200, { ok: true }, { 'Set-Cookie': 'cl_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' }); }
  if (req.method === 'GET' && url.pathname === '/api/health') return sendJson(res, 200, { ok: true, mode: 'local-demo', updatedAt: new Date().toISOString() });
  const user = requireUser(req, res); if (!user) return;
  if (req.method === 'GET' && url.pathname === '/api/dashboard') {
    const visibleOrders = user.role === 'operator' ? store.workOrders.filter(order => order.person === user.initials || order.person === user.username || order.person === 'UNASSIGNED') : user.role === 'student' ? [] : store.workOrders;
    const activeItems = store.items.filter(item => item.statusKey !== 'rejected').length;
    const claimedItems = store.items.filter(item => item.statusKey === 'donation' || item.status === '已预约').length;
    const activeAccountCount = store.userDirectory.filter(entry => entry.active !== false).length;
    const reviewedAccountCount = store.userDirectory.filter(entry => entry.reviewed === true).length;
    const reviewTotal = store.userDirectory.reduce((sum, entry) => sum + entry.reviewWeight, 0);
    const reviewCompleted = store.userDirectory.filter(entry => entry.reviewed === true).reduce((sum, entry) => sum + entry.reviewWeight, 0);
    return sendJson(res, 200, { metrics: { activeItems, pendingItems: store.items.filter(item => item.status === '待审核').length, claimedItems, openOrders: visibleOrders.filter(order => order.status !== 'done').length, completedOrders: visibleOrders.filter(order => order.status === 'done').length, risks: store.risks.length, offlineQueue: store.meta.offlineQueue, lastSync: store.meta.lastSync, reuseRate: Number(((claimedItems / Math.max(activeItems, 1)) * 100).toFixed(1)), avoidedKg: claimedItems * 12, accountCount: store.userDirectory.length, activeAccountCount, reviewedAccountCount, reviewCompleted, reviewTotal, reviewPercent: Math.round((reviewCompleted / Math.max(reviewTotal, 1)) * 100) } });
  }
  if (req.method === 'GET' && url.pathname === '/api/review-center') {
    if (user.role === 'student') return sendError(res, 403, 'FORBIDDEN', '学生账户不能访问审核中心');
    return sendJson(res, 200, { resources: ['operator','admin'].includes(user.role) ? store.items.filter(item => item.status === '待审核') : [], riskReports: ['sustainability','admin'].includes(user.role) ? store.riskReports.filter(report => report.status === 'pending') : [], workOrders: ['operator','admin'].includes(user.role) ? store.workOrders.filter(order => order.person === 'UNASSIGNED' || (order.status !== 'done' && /逾期|昨天|超时/.test(order.due || ''))) : [] });
  }
  if (req.method === 'GET' && url.pathname === '/api/todos') {
    const todos = [];
    if (user.role === 'student') { store.items.filter(item => item.ownerUsername === user.username && item.status === '待审核').forEach(item => todos.push({ id: item.id, kind: 'resource', title: `等待审核：${item.name}`, meta: '资源交换', target: 'exchange', priority: 'normal' })); store.riskReports.filter(report => report.reportedBy === user.username && report.status === 'pending').forEach(report => todos.push({ id: report.id, kind: 'risk', title: `等待审核：${report.title}`, meta: '风险上报', target: 'overview', priority: 'normal' })); }
    if (user.role === 'operator') { store.items.filter(item => item.status === '待审核').forEach(item => todos.push({ id: item.id, kind: 'resource', title: `审核资源：${item.name}`, meta: `${item.category} · ${item.location}`, target: 'governance', priority: 'high' })); store.workOrders.filter(order => order.person === 'UNASSIGNED' || (order.person === user.initials && order.status !== 'done')).slice(0, 5).forEach(order => todos.push({ id: order.id, kind: 'workOrder', title: order.person === 'UNASSIGNED' ? `分配工单：${order.title}` : `跟进工单：${order.title}`, meta: `${order.area} · ${order.due}`, target: 'operations', priority: order.priority === '高' ? 'high' : 'normal' })); }
    if (user.role === 'sustainability') { store.riskReports.filter(report => report.status === 'pending').forEach(report => todos.push({ id: report.id, kind: 'risk', title: `审核风险：${report.title}`, meta: `${report.category} · ${report.location}`, target: 'governance', priority: report.level === 'high' ? 'high' : 'normal' })); }
    if (user.role === 'admin') { store.items.filter(item => item.status === '待审核').forEach(item => todos.push({ id: item.id, kind: 'resource', title: `审核资源：${item.name}`, meta: `${item.category} · ${item.location}`, target: 'governance', priority: 'high' })); store.riskReports.filter(report => report.status === 'pending').forEach(report => todos.push({ id: report.id, kind: 'risk', title: `审核风险：${report.title}`, meta: `${report.category} · ${report.location}`, target: 'governance', priority: 'high' })); store.userDirectory.filter(entry => entry.reviewed !== true).forEach(entry => todos.push({ id: entry.username, kind: 'user', title: `复核账户：${entry.displayName}`, meta: `${entry.username} · 权限目录`, target: 'governance', priority: 'normal' })); }
    return sendJson(res, 200, { todos: todos.slice(0, 12) });
  }
  if (req.method === 'GET' && segments[0] === 'api' && segments[1] === 'items') {
    const filter = url.searchParams.get('filter'); const query = (url.searchParams.get('search') || '').toLowerCase();
    return sendJson(res, 200, { items: store.items.filter(item => (!filter || filter === 'all' || item.statusKey === filter) && (!query || `${item.name} ${item.category} ${item.location} ${item.id}`.toLowerCase().includes(query))) });
  }
  if (req.method === 'POST' && url.pathname === '/api/items') {
    const body = await readJsonBody(req); const name = text(body.name); const category = text(body.category, '其他'); const location = text(body.location, '待确认地点');
    if (!name) return sendError(res, 400, 'VALIDATION_ERROR', '资源名称不能为空');
    const item = { id: nextId('ITM', store.items), name, category, location, status: '待审核', statusKey: 'available', impact: '待估算影响', emoji: itemEmoji(category), owner: user.displayName, ownerUsername: user.username, posted: '刚刚', note: text(body.note), history: [{ label: '已发布', at: '刚刚', by: user.username }] };
    store.items.unshift(item); await appendAudit(user, '发布资源', 'Resource', item.id, item.name); await persist(); return sendJson(res, 201, { item });
  }
  if (req.method === 'PATCH' && segments[0] === 'api' && segments[1] === 'items' && segments[2] && segments[3] === 'review') {
    if (!['operator','admin'].includes(user.role)) return sendError(res, 403, 'FORBIDDEN', '只有设施运营或系统管理员可以审核资源');
    const item = store.items.find(entry => entry.id === segments[2]); if (!item) return sendError(res, 404, 'NOT_FOUND', '资源不存在');
    const body = await readJsonBody(req); const approved = body.decision === 'approved'; item.status = approved ? '待领取' : '已驳回'; item.statusKey = approved ? 'available' : 'rejected'; item.reviewedBy = user.username; item.history = [...(item.history || []), { label: approved ? '审核通过' : '审核驳回', at: '刚刚', by: user.username }]; await appendAudit(user, approved ? '审核通过资源' : '驳回资源', 'Resource', item.id, item.name); await persist(); return sendJson(res, 200, { item });
  }
  if (req.method === 'GET' && url.pathname === '/api/moderation/queue') { if (!['operator','admin'].includes(user.role)) return sendError(res, 403, 'FORBIDDEN', '没有人工审核权限'); return sendJson(res, 200, { items: store.items.filter(item => item.status === '待审核') }); }
  if (req.method === 'GET' && url.pathname === '/api/audit') { if (!['operator','admin'].includes(user.role)) return sendError(res, 403, 'FORBIDDEN', '没有审计日志权限'); return sendJson(res, 200, { audit: store.auditLog }); }
  if (req.method === 'GET' && url.pathname === '/api/users') { if (user.role !== 'admin') return sendError(res, 403, 'FORBIDDEN', '只有系统管理员可以查看账户目录'); return sendJson(res, 200, { users: store.userDirectory }); }
  if (req.method === 'GET' && url.pathname === '/api/work-order-assignees') { if (!['operator','admin'].includes(user.role)) return sendError(res, 403, 'FORBIDDEN', '没有工单分配权限'); return sendJson(res, 200, { assignees: activeOperators().map(entry => ({ username: entry.username, displayName: entry.displayName, initials: entry.initials })) }); }
  if (req.method === 'PATCH' && segments[0] === 'api' && segments[1] === 'users' && segments[2]) {
    if (user.role !== 'admin') return sendError(res, 403, 'FORBIDDEN', '只有系统管理员可以修改账户权限');
    const username = segments[2]; const account = users.find(entry => entry.username === username); const target = store.userDirectory.find(entry => entry.username === username);
    if (!account || !target) return sendError(res, 404, 'NOT_FOUND', '账户不存在');
    const body = await readJsonBody(req); const allowedRoles = ['student', 'operator', 'sustainability', 'admin']; const nextRole = body.role === undefined ? target.role : text(body.role);
    const nextActive = body.active === undefined ? target.active !== false : Boolean(body.active); const nextReviewed = body.reviewed === undefined ? target.reviewed === true : Boolean(body.reviewed);
    if (!allowedRoles.includes(nextRole)) return sendError(res, 400, 'VALIDATION_ERROR', '角色不在允许范围内');
    if (username === user.username && (!nextActive || nextRole !== 'admin')) return sendError(res, 409, 'SELF_LOCKOUT', '不能停用或降级当前管理员账户');
    const activeAdmins = store.userDirectory.filter(entry => entry.active !== false && entry.role === 'admin' && entry.username !== username).length;
    if ((target.role === 'admin' && (nextRole !== 'admin' || !nextActive)) && activeAdmins === 0) return sendError(res, 409, 'LAST_ADMIN', '系统至少需要保留一个启用中的管理员账户');
    target.role = nextRole; target.active = nextActive; target.reviewed = nextReviewed; target.updatedAt = new Date().toISOString();
    for (const [token, sessionUser] of sessions.entries()) {
      if (sessionUser.username !== username) continue;
      if (!nextActive) sessions.delete(token);
      else sessions.set(token, { ...sessionUser, role: nextRole });
    }
    await appendAudit(user, '更新账户权限', 'User', username, target.displayName, `${target.role} · ${target.active ? '启用' : '停用'}`); await persist(); return sendJson(res, 200, { user: target });
  }
  if (req.method === 'PATCH' && segments[0] === 'api' && segments[1] === 'items' && segments[2]) {
    const item = store.items.find(entry => entry.id === segments[2]); if (!item) return sendError(res, 404, 'NOT_FOUND', '资源不存在');
    const body = await readJsonBody(req); if (body.action === 'claim') { if (item.statusKey !== 'available') return sendError(res, 409, 'INVALID_STATE', '资源当前不可预约'); item.status = '已预约'; item.statusKey = 'donation'; item.claimedBy = user.username; item.history = [...(item.history || []), { label: '已预约', at: '刚刚', by: user.username }]; await appendAudit(user, '预约资源', 'Resource', item.id, item.name); } else { if (!['operator','admin'].includes(user.role)) return sendError(res, 403, 'FORBIDDEN', '只有运营或管理员可以更新资源状态'); if (body.status) { item.status = text(body.status, item.status); item.history = [...(item.history || []), { label: item.status, at: '刚刚', by: user.username }]; await appendAudit(user, '更新资源状态', 'Resource', item.id, item.name); } if (body.statusKey) item.statusKey = text(body.statusKey, item.statusKey); } item.updatedAt = new Date().toISOString(); await persist(); return sendJson(res, 200, { item });
  }
  if (req.method === 'GET' && url.pathname === '/api/work-orders') { const visible = user.role === 'student' ? [] : user.role === 'operator' ? store.workOrders.filter(order => order.person === user.initials || order.person === user.username || order.person === 'UNASSIGNED') : store.workOrders; return sendJson(res, 200, { workOrders: visible }); }
  if (req.method === 'POST' && url.pathname === '/api/work-orders') {
    if (!['student','operator','admin'].includes(user.role)) return sendError(res, 403, 'FORBIDDEN', '当前账户不能创建工单');
    const body = await readJsonBody(req); const title = text(body.title); if (!title) return sendError(res, 400, 'VALIDATION_ERROR', '工单名称不能为空');
    const defaultAssignee = user.role === 'student' ? 'UNASSIGNED' : user.role === 'operator' ? user.initials : (activeOperators().find(entry => entry.initials === 'LM') || activeOperators()[0])?.initials;
    const person = user.role === 'student' ? 'UNASSIGNED' : normalizedAssignee(body.person, defaultAssignee); if (!person) return sendError(res, 400, 'VALIDATION_ERROR', '负责人必须是启用中的设施运营人员');
    const order = { id: nextId('WO', store.workOrders), title, area: text(body.area, '待确认地点'), type: text(body.type, '其他'), due: text(body.due, '待确认'), status: 'new', person, quantity: Math.max(1, Number(body.quantity || 1)), priority: text(body.priority, '中'), description: text(body.description), createdBy: user.username, history: [{ label: '待处理', at: '刚刚', by: user.username }], createdAt: new Date().toISOString() };
    store.workOrders.unshift(order); await appendAudit(user, '创建工单', 'WorkOrder', order.id, order.title); await persist(); return sendJson(res, 201, { workOrder: order });
  }
  if (req.method === 'PATCH' && segments[0] === 'api' && segments[1] === 'work-orders' && segments[2]) {
    const order = store.workOrders.find(entry => entry.id === segments[2]); if (!order) return sendError(res, 404, 'NOT_FOUND', '工单不存在');
    const body = await readJsonBody(req); if (body.person && ['operator','admin'].includes(user.role)) { const nextPerson = normalizedAssignee(body.person, order.person); if (!nextPerson) return sendError(res, 400, 'VALIDATION_ERROR', '负责人必须是启用中的设施运营人员'); order.person = nextPerson; await appendAudit(user, '分配工单负责人', 'WorkOrder', order.id, order.title); } const allowed = ['new', 'progress', 'pickup', 'done']; if (body.status && allowed.includes(body.status)) { const canUpdate = user.role === 'admin' || order.person === user.initials; if (!canUpdate) return sendError(res, 403, 'FORBIDDEN', '只有负责人或管理员可以推进该工单'); order.status = body.status; order.history = [...(order.history || []), { label: { new: '待处理', progress: '处理中', pickup: '待清运', done: '已完成' }[body.status], at: '刚刚', by: user.username }]; await appendAudit(user, '推进工单状态', 'WorkOrder', order.id, order.title); } order.updatedAt = new Date().toISOString(); await persist(); return sendJson(res, 200, { workOrder: order });
  }
  if (req.method === 'GET' && url.pathname === '/api/risks') { if (user.role === 'student') return sendError(res, 403, 'FORBIDDEN', '学生账户不能访问风险后台'); return sendJson(res, 200, { risks: store.risks }); }
  if (req.method === 'GET' && url.pathname === '/api/risk-reports') { if (!['sustainability','admin'].includes(user.role)) return sendError(res, 403, 'FORBIDDEN', '只有可持续管理员或系统管理员可以查看风险上报审核队列'); return sendJson(res, 200, { reports: store.riskReports.filter(report => report.status === 'pending') }); }
  if (req.method === 'POST' && url.pathname === '/api/risk-reports') {
    const body = await readJsonBody(req); const title = text(body.title); const mitigation = text(body.mitigation); if (!title || !mitigation) return sendError(res, 400, 'VALIDATION_ERROR', '风险名称和建议措施不能为空');
    const report = { id: nextId('RR', store.riskReports), title, category: text(body.category, 'Operations'), affected: text(body.affected, '待确认'), level: ['high', 'medium', 'low'].includes(body.level) ? body.level : 'medium', probability: Math.min(5, Math.max(1, Number(body.probability || 3))), impact: Math.min(5, Math.max(1, Number(body.impact || 3))), due: text(body.due, '待确认'), mitigation, owner: text(body.owner, '待分配'), location: text(body.location, '待确认地点'), status: 'pending', reportedBy: user.username, reportedByName: user.displayName, createdAt: new Date().toISOString() };
    store.riskReports.unshift(report); await appendAudit(user, '上报风险', 'RiskReport', report.id, report.title); await persist(); return sendJson(res, 201, { report });
  }
  if (req.method === 'PATCH' && segments[0] === 'api' && segments[1] === 'risk-reports' && segments[2] && segments[3] === 'review') {
    if (!['sustainability','admin'].includes(user.role)) return sendError(res, 403, 'FORBIDDEN', '只有可持续管理员或系统管理员可以审核风险上报');
    const report = store.riskReports.find(entry => entry.id === segments[2]); if (!report) return sendError(res, 404, 'NOT_FOUND', '风险上报不存在');
    if (report.status !== 'pending') return sendError(res, 409, 'INVALID_STATE', '该风险上报已经处理');
    const body = await readJsonBody(req); const approved = body.decision === 'approved'; report.status = approved ? 'approved' : 'rejected'; report.reviewedBy = user.username; report.reviewReason = text(body.reason);
    if (approved) { const risk = { id: nextRiskId(store.risks), title: report.title, category: report.category, affected: report.affected, level: report.level, probability: report.probability, impact: report.impact, score: report.probability * report.impact, due: report.due, mitigation: report.mitigation, owner: report.owner, status: '监控中', sourceReportId: report.id, createdAt: new Date().toISOString() }; store.risks.unshift(risk); await appendAudit(user, '通过风险上报', 'Risk', risk.id, risk.title, `来源 ${report.id}`); } else await appendAudit(user, '驳回风险上报', 'RiskReport', report.id, report.title, report.reviewReason);
    await persist(); return sendJson(res, 200, { report });
  }
  if (req.method === 'PATCH' && segments[0] === 'api' && segments[1] === 'risks' && segments[2]) {
    if (!['sustainability','admin'].includes(user.role)) return sendError(res, 403, 'FORBIDDEN', '只有可持续管理员或系统管理员可以更新风险');
    const risk = store.risks.find(entry => entry.id === segments[2]); if (!risk) return sendError(res, 404, 'NOT_FOUND', '风险不存在');
    const body = await readJsonBody(req); const labels = { monitoring: '监控中', mitigated: '已缓解', closed: '已关闭' }; if (body.status && labels[body.status]) { risk.status = labels[body.status]; risk.updatedBy = user.username; await appendAudit(user, `更新风险为${risk.status}`, 'Risk', risk.id, risk.title); } if (body.mitigation) risk.mitigation = text(body.mitigation, risk.mitigation); await persist(); return sendJson(res, 200, { risk });
  }
  if (req.method === 'POST' && url.pathname === '/api/risks') {
    if (!['sustainability','admin'].includes(user.role)) return sendError(res, 403, 'FORBIDDEN', '只有可持续管理员或系统管理员可以登记风险');
    const body = await readJsonBody(req); const title = text(body.title); const mitigation = text(body.mitigation); if (!title || !mitigation) return sendError(res, 400, 'VALIDATION_ERROR', '风险名称和缓解措施不能为空');
    const probability = Math.min(5, Math.max(1, Number(body.probability || 3))); const impact = Math.min(5, Math.max(1, Number(body.impact || 3)));
    const risk = { id: nextRiskId(store.risks), title, category: text(body.category, 'Operations'), affected: text(body.affected, '待确认'), level: ['high', 'medium', 'low'].includes(body.level) ? body.level : 'medium', probability, impact, score: probability * impact, due: text(body.due, '待确认'), mitigation, owner: text(body.owner, '待分配'), status: '监控中', createdAt: new Date().toISOString() };
    store.risks.unshift(risk); await appendAudit(user, '登记风险', 'Risk', risk.id, risk.title); await persist(); return sendJson(res, 201, { risk });
  }
  if (req.method === 'GET' && url.pathname === '/api/evidence') { if (user.role === 'student') return sendError(res, 403, 'FORBIDDEN', '学生账户不能访问内部研究证据'); return sendJson(res, 200, { evidence: store.evidence }); }
  if (req.method === 'POST' && url.pathname === '/api/evidence') {
    if (!['operator','sustainability','admin'].includes(user.role)) return sendError(res, 403, 'FORBIDDEN', '当前账户不能录入研究证据');
    const body = await readJsonBody(req); const title = text(body.title); const finding = text(body.finding); if (!title || !finding) return sendError(res, 400, 'VALIDATION_ERROR', '证据标题和关键发现不能为空');
    const evidence = { id: nextId('EV', store.evidence), title, type: text(body.type, '访谈'), source: text(body.source, '待补充'), finding, consent: body.consent === true, createdBy: user.username, createdAt: new Date().toISOString() };
    store.evidence.unshift(evidence); await appendAudit(user, '录入研究证据', 'Evidence', evidence.id, evidence.title); await persist(); return sendJson(res, 201, { evidence });
  }
  if (req.method === 'POST' && url.pathname === '/api/sync') { store.meta.offlineQueue = 0; store.meta.lastSync = new Date().toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' }); await persist(); return sendJson(res, 200, { synced: true, meta: store.meta }); }
  if (req.method === 'POST' && url.pathname === '/api/admin/reset-demo') {
    if (user.role !== 'admin') return sendError(res, 403, 'FORBIDDEN', '只有系统管理员可以重置演示数据');
    store = JSON.parse(JSON.stringify(seedStore)); store.auditLog = []; store.riskReports = []; await appendAudit(user, '重置演示数据', 'System', 'demo', '演示数据'); await persist(); return sendJson(res, 200, { ok: true, message: '演示数据已重置' });
  }
  return sendError(res, 404, 'NOT_FOUND', 'API 路径不存在');
}

const mimeTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };
async function serveStatic(req, res, url) {
  const requestPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = path.resolve(ROOT, `.${requestPath}`);
  if (!filePath.startsWith(ROOT)) return sendError(res, 403, 'FORBIDDEN', '禁止访问该路径');
  try { const content = await fs.readFile(filePath); res.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(content); }
  catch { sendError(res, 404, 'NOT_FOUND', '文件不存在'); }
}

async function requestHandler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS' }); res.end(); return; }
  try { if (url.pathname.startsWith('/api/')) await handleApi(req, res, url); else if (req.method === 'GET') await serveStatic(req, res, url); else sendError(res, 405, 'METHOD_NOT_ALLOWED', '不支持该请求方法'); }
  catch (error) { sendError(res, error.statusCode || 500, error.code || 'INTERNAL_ERROR', error.message || '服务器内部错误'); }
}

initStore().then(() => http.createServer(requestHandler).listen(PORT, () => console.log(`CampusLoop backend ready: http://localhost:${PORT}`))).catch(error => { console.error(error); process.exitCode = 1; });

