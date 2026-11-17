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
  itemCounts: { all: 0, available: 0, repair: 0, donation: 0 },
  workOrders: [],
  studentProgress: { workOrders: [], riskReports: [] },
  risks: [],
  riskReports: [],
  riskReviewers: [],
  reviewCenter: { resources: [], riskReports: [], workOrders: [] },
  todos: [],
  notifications: [],
  notificationUnread: 0,
  users: [],
  evidence: [],
  interviews: [],
  rewards: null,
  metrics: {},
  orderFilter: 'all',
  assignees: [],
  refreshTimer: null,
  lastOrdersRefresh: null
};

const pageLabels = { overview: 'Overview', exchange: 'Resource exchange', operations: 'Facilities operations', impact: 'Impact dashboard', governance: 'Governance & risk', implementation: 'Implementation', evidence: 'Research evidence' };
const modalRoot = document.getElementById('modal-root');
const toast = document.getElementById('toast');
const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:4173' : '';
let toastTimer;
const roleLabels = { student: 'Student', operator: 'Facilities operator', sustainability: 'Sustainability admin', admin: 'System administrator' };
const roleDescriptions = { student: 'Student user', operator: 'Campus operator', sustainability: 'Sustainability admin', admin: 'System administrator' };

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

const englishUiMap = {
};

Object.assign(englishUiMap, {
  '复核账户：':'Review account: ','权限目录':'Access directory','保存负责人':'Save owner','已完成领取者回访。':'Recipient follow-up completed.','处理记录':'Work notes','写入审计':'Added to audit log','暂无处理备注':'No work notes yet','暂无现场证据':'No field evidence yet','补充处理备注':'Add a work note','证据名称或照片编号':'Evidence name or photo reference','保存记录':'Save record','请填写备注或证据名称':'Enter a note or evidence name','处理记录已保存':'Work record saved',
  '总览': 'Overview', '资源交换': 'Resource exchange', '设施运营': 'Facilities operations', '影响仪表板': 'Impact dashboard', '治理与风险': 'Governance & risk', '实施路线': 'Implementation', '研究证据': 'Research evidence', '项目设置': 'Workspace settings', '帮助中心': 'Help centre', '离线队列': 'Offline queue', '等待同步到云端': 'Waiting to sync to the server', '当前处于离线模式': 'Offline mode is active', '模拟离线': 'Simulate offline', '退出离线': 'Exit offline mode', '同步': 'Sync', '当前状态': 'Current status', '当前负责人': 'Current owner', '负责人': 'Owner', '复核人': 'Reviewer', '待处理': 'Pending', '处理中': 'In progress', '待清运': 'Awaiting collection', '已完成': 'Completed', '待审核': 'Pending review', '审核中': 'Under review', '审核完成': 'Review completed', '已打回': 'Returned for revision', '已驳回': 'Rejected', '待分配': 'Unassigned', '待领取': 'Available for collection', '待捐赠': 'Pending donation', '待维修': 'Awaiting repair', '维修中': 'Repair in progress', '维修后再利用': 'Reused after repair', '已完成再利用': 'Reuse completed', '监控中': 'Monitoring', '已缓解': 'Mitigated', '已关闭': 'Closed', '上报风险': 'Report risk', '登记风险': 'Register risk', '风险登记表': 'Risk register', '风险上报审核': 'Risk-report review', '人工审核': 'Human review', '资源发布审核': 'Resource publishing review', '审核': 'Review', '通过': 'Approve', '驳回': 'Reject', '保存': 'Save', '关闭': 'Close', '取消': 'Cancel', '查看全部': 'View all', '查看详情': 'View details', '详情': 'Details', '新建工单': 'New work order', '报告设施问题': 'Report a facilities issue', '提交问题': 'Submit request', '创建工单': 'Create work order', '工单名称': 'Work-order title', '问题标题': 'Issue title', '问题描述': 'Issue description', '处理说明': 'Handling notes', '地点': 'Location', '类型': 'Type', '截止时间': 'Due time', '优先级': 'Priority', '数量': 'Quantity', '添加证据记录': 'Add evidence', '已录入记录': 'Recorded evidence', '风险项': 'Risk items', '开放工单': 'Open work orders', '今日待清运': 'Collections today', '平均处理时长': 'Average handling time', '离线待同步': 'Offline items to sync', '实时': 'Live', '实时路线': 'Live route', '实时指标快照': 'Live KPI snapshot', '数据完整度': 'Data completeness', '目标与实际': 'Target vs actual', '目标': 'Target', '当前值': 'Current', '差距': 'Gap', '指标': 'Metric', '影响对象': 'Affected groups', '缓解措施': 'Mitigation', '操作审计': 'Audit log', '审计报告': 'Audit report', '报告中心': 'Report centre', '导出': 'Export', '复制路线摘要': 'Copy route summary', '复制摘要': 'Copy summary', '加入行动清单': 'Add to action list', '路线视图': 'Route view', '全部': 'All', '我的': 'Mine', '需要关注': 'Needs attention', '无关键风险': 'No critical risks', '合规状态良好': 'Compliance status is good', '运行正常': 'Operating normally', '试点进行中': 'Pilot in progress', '数据完整度': 'Data completeness', '本学期': 'This term', '本月避免填埋': 'Landfill avoided this month', '过去 7 天': 'Past 7 days', '过去两周': 'Past two weeks', '今天': 'Today', '昨天': 'Yesterday', '刚刚': 'Just now', '待确认': 'To be confirmed', '待安排': 'To be scheduled', '高': 'High', '中': 'Medium', '低': 'Low', '风险': 'Risk', '设施': 'Facilities', '资源': 'Resource', '书籍': 'Books', '家具': 'Furniture', '电子产品': 'Electronics', '电子': 'Electronics', '交通': 'Transport', '生活用品': 'Household items', '其他': 'Other', '件': 'items', '项': 'items', '条': 'records', '小时': 'hours', '站点': 'sites', '上报': 'Report', '发布资源': 'Publish resource', '发布': 'Publish', '流转': 'Lifecycle', '完成': 'Completed', '进行中': 'In progress', '逾期': 'Overdue', '状态': 'Status', '等级': 'Level', '再利用率': 'Reuse rate', '账户目录': 'Account directory', '账户与权限': 'Accounts & permissions', '退出登录': 'Sign out', '通知': 'Notifications', '权限复核': 'Access review', '数据治理': 'Data governance', '预算边界': 'Budget boundary', '原型边界': 'Prototype boundary', '人工监督': 'Human oversight', '学生参与': 'Student participation', '影响看板': 'Impact dashboard', '系统连接边界': 'System integration boundary', '需求—功能—指标追踪': 'Requirement–feature–metric traceability', '需求与用户研究': 'Requirements and user research', '学生身份': 'Student identity', '学生访谈 + 资源日志': 'Student interviews + resource logs', '仪表盘快照 + 季度报告': 'Dashboard snapshot + quarterly report', '已复核': 'Reviewed', '已启用': 'Active', '已优化': 'Optimised', '最后Sync：': 'Last sync: ', '最近 30 天': 'Past 30 days', 'Books与纸张': 'Books and paper', '早上好，': 'Good morning, ',
  '把ResourceLifecycle转化为可解释、可审计的校园可持续成果。': 'Turn the resource lifecycle into explainable and auditable campus sustainability outcomes.',
  '保留期限': 'Retention period', '本地队列': 'Local queue', '混合物资': 'Mixed materials', '退宿季资源回收行动': 'Move-out resource recovery action',
  '完成Access review this week': 'Complete access review this week', '危险物品、异常交易和激励申诉进入Human review队列。': 'Hazardous items, anomalous transactions and incentive appeals enter the human review queue.',
  '系统连接边界': 'System integration boundary', '需求—功能—指标追踪': 'Requirement–feature–metric traceability', '需求与用户研究': 'Requirements and user research',
  '学生不知道闲置物品去哪里': 'Students cannot see where idle items should go', '学生访谈 + Resource日志': 'Student interviews + resource logs', '学生身份': 'Student identity',
  '学生提交 · 等待内容Review': 'Student submission · content review pending', '仪表盘快照 + 季度报告': 'Dashboard snapshot + quarterly report', '已复核': 'Reviewed', '已启用': 'Active', '已优化': 'Optimised',
  '影响看板': 'Impact dashboard', '用最少的数据完成必要的服务，用清晰的责任保证每一次处理可追溯。': 'Use only the data needed for service delivery and make every action traceable through clear ownership.',
  '逾期': 'Overdue', '预计节省': 'Estimated saving', '预算边界': 'Budget boundary', '原型边界': 'Prototype boundary', '再利用率': 'Reuse rate', '早上好，': 'Good morning, ',
  '账户目录状态': 'Account directory status', '账户与权限': 'Accounts & permissions', '这里只处理学生和Facilities人员主动Report的Risk；Approve后才会写入Risk register。': 'This queue handles risks reported by students and facilities staff; approved reports are added to the risk register.',
  '正式投标阶段应进一步拆分许可、集成、安全、培训和预留费用。': 'The formal bid should split licensing, integration, security, training and contingency costs.', '重置演示数据': 'Reset demo data', '状态': 'Status',
  '准时完成': 'On-time completion', '最后Sync：': 'Last sync: ', '最近 30 天': 'Past 30 days', 'Books与纸张': 'Books and paper', '退出登录': 'Sign out', '通知': 'Notifications',
  '本地 Node 服务和 JSON 数据文件': 'local Node service and JSON data file', '今天优先处理': 'Today’s priority', '实时计算': 'Calculated live', '账户目录': 'Account directory',
  '风险登记表': 'Risk register', '权限复核': 'Access review', '数据治理': 'Data governance', '交付阶段': 'Delivery phase', '设施问题和风险上报会在这里持续更新。': 'Facilities issues and risk reports are updated here continuously.',
  '学生提交 · 等待内容审核': 'Student submission · content review pending', '完成本周权限复核': 'Complete this week’s access review', '学生访谈 + 资源日志': 'Student interviews + resource logs', '本周权限复核': 'Access review this week', '访谈学生、设施人员和可持续发展办公室，确定流程边界、字段和成功指标。': 'Interview students, facilities staff and the sustainability office to define process boundaries, fields and success metrics.', '分享视图': 'Share view', '个站点 · 12.4 km': 'sites · 12.4 km', '工单看板': 'Work-order board', '工单看板 · SLA 逾期率': 'Work-order board · SLA overdue rate', '工单历史 + 处理时长': 'Work-order history + handling time', '工单准时完成': 'On-time work orders', '贡献最多的地点': 'Top contributing locations', '管理层无法判断投资效果': 'Management cannot see investment outcomes', '后端资源目录': 'Backend resource directory', '回收与捐赠': 'Collection & donation', '活跃资源': 'Active resources', '集成与安全': 'Integration & security', '继续留在校园循环中。': 'Keep it in the campus loop.', '角色和启停状态会写入后端数据文件；已停用账户无法继续登录，当前管理员账户不能自我降级。': 'Roles and activation status are persisted; disabled accounts cannot sign in and the current admin cannot demote itself.', '较上月同期': 'Compared with last month', '截止今天': 'Due today', '学生提交 · 等待内容审核': 'Student submission · content review pending', '完成本周权限复核': 'Complete this week’s access review', '建议在退宿高峰期将临时领取点前移到大堂，并由学生大使提供扫码协助。': 'During move-out peaks, move the temporary collection point to the lobby and provide QR assistance through student ambassadors.', '0 条记录': '0 records', '14 个设施工单': '14 facilities work orders', '3 条离线记录': '3 offline records', '按避免填埋量': 'By landfill avoided', '按已完成再利用计算': 'Calculated from completed reuse', '把领取点前移到 B 区大堂': 'Move the collection point to the Residence B lobby', '本月已经让': 'This month we have kept', '本周新增领取点：': 'New collection point this week: ', '比较再利用率、处理时长、参与率和数据完整度，修正流程与激励机制。': 'Compare reuse rate, handling time, participation and data completeness to refine the workflow and incentives.', '避免填埋趋势': 'Landfill avoided trend', '查看本轮更新': 'View this cycle’s update', '查看风险 →': 'View risks →', '从可验证的 Residence B–D 试点开始，再根据指标扩大到全校。': 'Start with a verifiable Residence B–D pilot and scale using measured results.', '打开账户目录': 'Open account directory', '待处理总览': 'Workflow overview', '待开始': 'Not started', '当前有': 'Current', '第二年维护与支持': 'Year 2 maintenance and support', '第三年维护与扩展': 'Year 3 maintenance and expansion', '第一阶段使用结构化 API 和 CSV 交换，避免让单一系统成为故障点。': 'Phase 1 uses structured API and CSV exchange to avoid a single system becoming a failure point.', '第一年实施': 'Year 1 implementation', '动态指标、SLA 和 RFP 验收链路已接入': 'Live metrics, SLA and RFP acceptance traceability are connected.', '当前版本用于课程演示': 'This version is for course demonstration', '正式部署应替换为数据库、密码哈希、对象存储、细粒度权限和备份策略。': 'A production deployment should use a database, password hashing, object storage, fine-grained permissions and backups.', '退宿高峰期': 'move-out peak', '退宿季试点进入第 3 周。今天优先处理': 'The move-out pilot is in week 3. Today’s priority is', '从发现问题到完成回收，每一个工单都有负责人。': 'Every request has an owner from issue discovery to completion.', '动态指标': 'Live metrics', '平台与运营模块': 'Platform and operations modules', '交接记录保留 12 个月，聚合指标长期保存且去标识化。': 'Handover records are retained for 12 months; aggregated metrics are retained long term and de-identified.'
});

Object.assign(englishUiMap, {
  '工单': 'Work order', '今日待办': 'Today’s tasks', '今日清运路线': 'Today’s collection route', '仅保留服务所需字段，默认不收集身份证明以外的敏感资料。': 'Only service-required fields are retained; sensitive data is not collected by default.', '仅系统管理员可修改': 'Only system administrators can edit', '进入预约流转。': 'Enter the reservation lifecycle.', '了解更多 →': 'Learn more →', '连接身份、资产和设施系统，逐步评估传感器或预测分析的必要性。': 'Connect identity, asset and facilities systems, then assess the need for sensors or predictive analytics.', '明细': 'Details', '模拟报价': 'Illustrative quote', '模拟商业边界': 'Illustrative commercial boundary', '模拟数据基于 3 个住宿区和 2 个设施运营点，用于展示提案中的指标设计。': 'Demonstration data uses three residences and two facilities points to illustrate the proposal metrics.', '年度维护': 'Annual maintenance', '评分': 'Rating', '评估与调整': 'Evaluate and adjust', '全校推广': 'Campus-wide rollout', '确认 North Residence B 区清运': 'Confirm Residence B collection', '让每一件物品找到下一次使用的机会。': 'Give every item a next use.', '三年总拥有成本': 'Three-year total cost of ownership', '筛选': 'Filter', '上线资源交换、工单、二维码交接和离线队列，建立第一版基线。': 'Launch resource exchange, work orders, QR handover and the offline queue to establish the baseline.', '实施 + 两年维护': 'Implementation + two years maintenance', '实施预算 · 上限 USD 750,000': 'Implementation budget · USD 750,000 cap', '和': 'and'
});

Object.assign(englishUiMap, {
  '请先登录': 'Please sign in first', '试点健康度': 'Pilot health', '试点与学生大使': 'Pilot and student ambassadors', '数据每 6 小时更新': 'Data refreshes every 6 hours', '数据最小化': 'Data minimisation', '提交设施问题或风险后，你可以在这里跟踪处理进度。': 'Track progress here after submitting a facilities issue or risk.', '危险物品、异常交易和激励申诉进入Human review队列。': 'Hazardous items, anomalous transactions and incentive appeals enter the human review queue.', '这里只处理学生和Facilities人员主动Report的Risk；Approve后才会写入Risk register。': 'This queue handles risks reported by students and facilities staff; approved reports are added to the risk register.', '正在加载你的上报记录': 'Loading your reports', '正在加载审计日志…': 'Loading audit log…', '正在加载账户目录…': 'Loading account directory…', '正在加载实时状态…': 'Loading live status…', '正在加载资源队列…': 'Loading resource queue…'
});

Object.assign(englishUiMap, {
  '危险物品、异常交易and激励申诉进入Human review队列。': 'Hazardous items, anomalous transactions and incentive appeals enter the human review queue.',
  '这里只处理学生andFacilities人员主动Report的Risk；Approve后才会写入Risk register。': 'This queue handles risks reported by students and facilities staff; approved reports are added to the risk register.',
  '正在加载RiskReport…': 'Loading risk reports…', '正在加载Workflow overview…': 'Loading workflow overview…', 'Resource循环量趋势图': 'Resource lifecycle trend chart',
  '设施问题无法追踪': 'Facilities issues cannot be tracked', '家具与木材': 'Furniture and timber', '搜索物品、地点或编号': 'Search items, locations or IDs', '项目管理与预留': 'Project management and contingency',
  '我的上报进度': 'My report progress', '本周新增领取点：North Residence B 区一层服务台 · 现场支持离线登记': 'New collection point this week: Residence B ground-floor service desk · offline field support',
  '过去两周，B 区的家具领取完成率比其他地点高': 'Over the past two weeks, Residence B furniture collection completion was higher than other locations.',
  '发布审核决定资源能否进入交换；学生预约后会自动生成交接任务，运营人员在这里继续分配和完成。': 'Publishing review determines whether a resource enters exchange; student reservations create a handover task for operations to assign and complete.',
  '报告中心可查看当前指标、目标与实际；设施运营可记录处理证据，风险审核可填写复核意见。': 'The report centre shows current metrics, targets and actuals; facilities operations can record evidence and risk reviewers can add decisions.',
  '资源交换 · 领取完成率': 'Resource exchange · collection completion rate', '已有': 'already have', '资源构成': 'Resource composition', '资源循环量': 'Resource lifecycle volume', '资源审核与交接': 'Resource review and handover',
  '审核 8 条新资源发布': 'Review 8 new resource postings', '复核人分配 · 审核完成率': 'Reviewer assignment · review completion rate', 'RFP 验收依据': 'RFP acceptance basis', '风险上报缺少责任人': 'Risk reports lack accountable owners', '风险审核记录 + 审计日志': 'Risk review records + audit log',
  'Residence B–D 试点': 'Residence B–D pilot', '选择时间范围': 'Select time range', 'Landfill avoided trend折线图': 'Landfill avoided trend line chart', '当前版本用于课程演示，使用local Node service and JSON data file。正式部署应替换为数据库、密码哈希、对象存储、细粒度权限和备份策略。': 'This version is for course demonstration with a local Node service and JSON data file. A production deployment should use a database, password hashing, object storage and backups.', 'USD 170,000 / 年': 'USD 170,000 / year',
  '数据每 6 hours更新': 'Data refreshes every 6 hours', 'Residence B 区一层服务台 · 现场支持离线登记': 'Residence B ground-floor service desk · offline field support', 'B 区': 'Residence B', '领取完成率': 'collection completion rate', '审核完成率': 'review completion rate'
});

Object.assign(englishUiMap, {
  'Resource lifecycle volume趋势图': 'Resource lifecycle volume trend chart',
  'Resource等Pending review，已有': 'Resources pending review; already have',
  'Resource等Pending review': 'Resources pending review',
  '，already have': '; already have',
  '，使用local Node service and JSON data file。A production deployment should use a database, password hashing, object storage, fine-grained permissions and backups。': ' with a local Node service and JSON data file. A production deployment should use a database, password hashing, object storage and backups.',
  'This version is for course demonstration，使用local Node service and JSON data file。A production deployment should use a database, password hashing, object storage, fine-grained permissions and backups。': 'This version is for course demonstration with a local Node service and JSON data file. A production deployment should use a database, password hashing, object storage and backups.'
});

// English display copy for the bundled demonstration records and workflows.
Object.assign(englishUiMap, {
  '木质学习桌':'Wooden study desk','Dell 24″ 显示器':'Dell 24-inch monitor','城市通勤自行车':'Commuter bicycle','课程教材组合':'Course textbook set','折叠椅 × 4':'Folding chairs × 4','小型投影仪':'Compact projector','收纳箱 × 8':'Storage boxes × 8','白板与支架':'Whiteboard and stand','人体工学办公椅':'Ergonomic office chair','统计学教材套装':'Statistics textbook set','USB-C 扩展坞':'USB-C docking station','宿舍收纳架 × 3':'Residence storage racks × 3','折叠会议桌':'Folding meeting table','便携音箱':'Portable speaker',
  '避免 18 kg 废弃物':'18 kg of waste avoided','避免 12 kg 废弃物':'12 kg of waste avoided','避免 9 kg 废弃物':'9 kg of waste avoided','避免 6 kg 废弃物':'6 kg of waste avoided','避免 14 kg 废弃物':'14 kg of waste avoided','避免 8 kg 废弃物':'8 kg of waste avoided','避免 3 kg 废弃物':'3 kg of waste avoided','预计惠及 6 位学生':'Estimated to benefit 6 students','预计惠及 4 位学生':'Estimated to benefit 4 students','延长 2 年使用期':'Extends useful life by 2 years','支持社团共享':'Supports student society sharing','支持课程共享':'Supports course sharing','匿名学生':'Anonymous student','服务台':'Service desk','学习用品':'Study supplies','天前':' days ago','小时前':' hours ago','上周':'Last week',
  'B 区家具集中清运':'Residence B furniture collection','电子产品安全检查':'Electronics safety inspection','回收点标识更新':'Update collection point signage','书籍领取点补货':'Restock the book collection point','上周纸张回收核对':'Verify last week’s paper collection','宿舍 C 区维修回访':'Residence C repair follow-up','标识':'Signage','纸张':'Paper','维修':'Repair','清运':'Collection',
  'Wi-Fi 中断导致工单无法更新':'Wi-Fi outage prevents work order updates','奖励机制造成不公平参与':'Incentive design may create unequal participation','危险物品误发布':'Hazardous items posted by mistake','设施团队、学生':'Facilities staff and students','低带宽用户、残障用户':'Low-bandwidth users and users with disabilities','领取者、设施团队':'Recipients and facilities staff','离线队列 + 纸面备用表 + 恢复后冲突检查':'Offline queue, paper backup and conflict checks after reconnection','不以个人排名为唯一激励，保留人工申诉和替代渠道':'Avoid relying on individual rankings; provide human appeals and alternative channels','分类规则、关键词拦截、人工审核和下架审计':'Classification rules, keyword screening, human review and removal audit','运营负责人':'Operations lead','治理负责人':'Governance lead','学生大使':'Student ambassador',
  '报告中心可查看当前指标、目标与实际；设施运营可记录处理证据，风险审核可填写复核意见。':'The report centre compares actual metrics with targets. Facilities staff can record evidence and risk reviewers can add comments.','我的上报进度':'My reports','还没有上报记录':'No reports yet','当前没有待审核发布或待处理交接任务。':'There are no resource listings or handovers awaiting review.','新建一条待审核资源':'Create a resource listing','当前没有待审核的风险上报。':'There are no risk reports awaiting review.','当前分类没有待处理事项。':'There are no pending items in this category.','处理资源名称、分类、地点和领取信息':'Review the resource name, category, location and collection details','通过后才会写入正式风险登记表':'Approved reports are added to the risk register','未分配或已超过截止时间的设施工单':'Unassigned or overdue facilities work orders','定位资源队列':'Open resource queue','定位风险队列':'Open risk queue','打开工单看板':'Open work-order board','条资源等待审核':' resources awaiting review','条风险上报等待审核':' risk reports awaiting review','项工单需要跟进':' work orders require follow-up','项待处理':' pending','项待审核':' awaiting review','项':' items','条记录':' records',
  '最近登录':'Last signed in','尚未登录':'Never signed in','启用':'Active','停用':'Disabled','登录系统':'Signed in','暂无操作记录。':'No audit entries yet.','演示数据':'Demo data',
  '资源详情与流转':'Resource details and lifecycle','领取/交接地点':'Collection or handover location','可预约后按地点领取':'Reserve first, then collect at this location','维修完成后恢复领取':'Available after repair','按当前流程节点处理':'Follow the current workflow','发布者':'Posted by','当前处理人':'Current handler','循环价值':'Circular impact','更新时间':'Updated','资源发布':'Resource posted','资源已进入 CampusLoop':'Resource added to CampusLoop','等待审核分类、地点和安全信息':'Awaiting category, location and safety review','审核节点已完成':'Review completed','待认领维修':'Awaiting repair assignment','维修人员已接手处理':'Repair assigned to a technician','等待维修清运人员认领':'Awaiting a facilities operator','已计入再利用率和避免填埋量':'Included in reuse and landfill diversion metrics','领取学生':'Student recipient','可在指定地点预约领取':'Reserve for collection at the listed location','等待审核完成':'Awaiting review','查看处理进度':'View progress','预约领取':'Reserve for collection','认领维修':'Claim repair','完成维修并开放领取':'Complete repair and reopen for collection','登记完成再利用':'Record completed reuse','请在交接工单中继续处理':'Continue in the handover work order','查看状态':'View status',
  '当前为本地演示环境。离线模式、自动刷新和数据写入都由当前浏览器与本地 Node 服务控制。':'This is a local demonstration. Offline mode, automatic refresh and data storage are handled by this browser and the local Node service.','如需切换账号，请点击右上角退出后重新登录。':'To switch accounts, sign out and then sign in again.','知道了':'Got it','资源交换：发布资源后会进入人工审核队列，学生可预约已通过审核的资源。':'Resource exchange: listings are reviewed before students can reserve them.','设施运营：负责人只能推进自己负责的工单，管理员可以查看全部工单。':'Facilities: assigned staff can advance their work orders; administrators can view all orders.','治理与风险：可持续管理员和系统管理员可以登记、更新风险。':'Governance: sustainability and system administrators can register and update risks.','工单页面每 15 秒刷新一次，页面上的时间会显示最近一次后端同步。':'The work-order page refreshes every 15 seconds and shows the latest update time.','搜索物品、地点或编号':'Search items, locations or IDs','编辑状态':'Edit status',
  '项逾期':' overdue','件':'items','项':'items','Books与Paper':'Books and paper','工单状态':'Work order status','资源状态':'Resource status','风险审核':'Risk review','当前状态：':'Current status: ','已预约':'Reserved','已发布':'Posted','待同步':'Waiting to sync','待估算影响':'Impact pending assessment','设施运营 / 系统管理员':'Facilities operations / system administrator','设施运营人员':'Facilities operator','设施运营团队':'Facilities operations team','资源交接':'Resource handover','系统管理员':'System administrator','待安排':'To be scheduled','待确认地点':'Location to be confirmed','暂无风险记录':'No risk records','暂无账户记录。':'No accounts found.','当前没有待办事项。':'There are no tasks yet.','正在加载待处理总览…':'Loading workflow overview…','正在加载风险上报…':'Loading risk reports…','正在加载你的上报记录':'Loading your reports','正在加载实时状态…':'Loading live status…','正在加载资源队列…':'Loading resource queue…'
});

function translateUi(root = document.body) {
  if (!root) return;
  const replacements = Object.entries(englishUiMap).sort((a, b) => b[0].length - a[0].length);
  const translate = input => {
    const trimmed = input.trim();
    if (Object.hasOwn(englishUiMap, trimmed)) return input.replace(trimmed, englishUiMap[trimmed]);
    // Replace whole phrases in one pass. Single characters inside Chinese words
    // must never be translated independently (e.g. 中 in 中断).
    const phrases = replacements.filter(([key]) => key.length > 1 && /[\u3400-\u9fff]/.test(key));
    const pattern = new RegExp(phrases.map(([key]) => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
    return input.replace(pattern, match => englishUiMap[match])
      .replace(/(\d+)\s*项/g, '$1 items')
      .replace(/(\d+)\s*件/g, '$1 items');
  };
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  textNodes.forEach(node => { if (node.parentElement?.closest('script, style')) return; const option = node.parentElement?.closest('option'); if (option && !option.hasAttribute('value')) option.value = option.textContent; const value = translate(node.nodeValue); if (value !== node.nodeValue) node.nodeValue = value; });
  root.querySelectorAll?.('[placeholder], [aria-label], [data-title], [title]').forEach(element => { ['placeholder', 'aria-label', 'data-title', 'title'].forEach(attribute => { const value = element.getAttribute(attribute); if (value) { const translated = translate(value); if (translated !== value) element.setAttribute(attribute, translated); } }); });
}

const englishUiObserver = new MutationObserver(() => translateUi(document.body));
englishUiObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
translateUi(document.body);

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
  const { skipAuthRedirect = false, ...requestConfig } = options;
  const requestOptions = { headers: { 'Content-Type': 'application/json', ...(requestConfig.headers || {}) }, ...requestConfig };
  if (state.token) requestOptions.headers.Authorization = `Bearer ${state.token}`;
  if (state.offlineMode && requestOptions.method && requestOptions.method !== 'GET') return queueOfflineRequest(path, requestOptions);
  const response = await fetch(`${API_BASE}${path}`, requestOptions);
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401 && path !== '/api/auth/login') { const error = new Error('Session expired. Please sign in again.'); error.code = 'UNAUTHENTICATED'; if (!skipAuthRedirect) showLogin(error.message); throw error; }
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
  await Promise.all([loadDashboard(), loadTodos(), loadReviewCenter(), loadNotifications(), loadItems(), loadWorkOrders(), loadStudentProgress(), loadRisks(), loadRiskReports(), loadRiskReviewers(), loadModerationQueue(), loadAudit(), loadUsers(), loadEvidence(), loadAssignees(), loadRewards()]);
  setServerStatus('online', '已登录 · 后端已连接');
  persistOfflineQueue();
  startLiveRefresh();
}

async function loadDashboard() {
  const payload = await apiRequest('/api/dashboard');
  state.metrics = payload.metrics || {};
  renderDashboard();
}

async function loadRewards() {
  if (state.user?.role !== 'student') { state.rewards = null; return; }
  state.rewards = await apiRequest('/api/rewards/me');
  const { total, monthly, monthlyCap } = state.rewards;
  setText('reward-total', total);
  setText('reward-monthly', `${monthly} / ${monthlyCap}`);
  const milestone = total >= 100 ? 'Circular Champion' : total >= 50 ? 'Reuse Advocate' : total >= 10 ? 'Loop Starter' : 'Your first reuse starts your journey';
  setText('reward-badge', milestone);
  const bar = document.getElementById('reward-progress');
  if (bar) bar.style.width = `${Math.min(100, monthlyCap ? monthly / monthlyCap * 100 : 0)}%`;
}

function openRewards() {
  if (state.user?.role !== 'student' || !state.rewards) return;
  const rewards = state.rewards;
  const entries = rewards.entries.map(entry => `<div class="reward-entry"><div><strong>${escapeHtml(entry.itemName)}</strong><small>${escapeHtml(entry.itemId)} · ${escapeHtml(entry.at.slice(0, 10))} · ${escapeHtml(entry.reason)}</small></div><b>+${entry.points}</b></div>`).join('');
  openModal(`<div class="modal-head"><div><p class="panel-kicker">PRIVATE REWARDS · DEMONSTRATION</p><h2>My reward activity</h2><p>Points recognise completed reuse. Only your account can view this activity.</p></div><button class="close-modal" data-close-modal="true" aria-label="Close">×</button></div><div class="reward-rules"><strong>How it works</strong><p>Earn ${rewards.pointsPerReuse} points per completed resource, up to ${rewards.monthlyCap} points per UTC calendar month. A resource counts once per student. No public ranking or point deductions.</p><p>Badges are illustrative milestones, not vouchers or a promise of real-world benefits. Demo records do not earn points. Existing activity is not credited retroactively.</p></div><h3 class="reward-history-heading">Recent activity</h3><div class="reward-history">${entries || '<p class="empty-inline">No points yet. Complete a resource handover to get started.</p>'}</div><div class="modal-actions"><button class="button primary" data-close-modal="true">Close</button></div>`);
}

async function loadTodos() {
  const payload = await apiRequest('/api/todos');
  state.todos = payload.todos || [];
  renderTodos();
}

async function loadReviewCenter() {
  if (state.user?.role === 'student') return;
  const payload = await apiRequest('/api/review-center');
  state.reviewCenter = payload;
  renderReviewCenter();
}

async function loadNotifications() {
  const payload = await apiRequest('/api/notifications');
  state.notifications = payload.notifications || [];
  const seenKey = `campusloop-seen-notifications:${state.user?.username || 'anonymous'}`;
  const seen = new Set(JSON.parse(localStorage.getItem(seenKey) || '[]'));
  const signature = entry => `${entry.id}|${entry.detail}|${entry.at}`;
  state.notificationUnread = state.notifications.filter(entry => !seen.has(signature(entry))).length;
  const count = document.getElementById('notification-count');
  const dot = document.querySelector('.notification-dot');
  const unread = state.notificationUnread;
  if (count) { count.textContent = unread > 99 ? '99+' : String(unread); count.classList.toggle('hidden', unread === 0); }
  if (dot) dot.classList.toggle('hidden', unread === 0);
}

async function loadReportCenter() {
  const payload = await apiRequest('/api/report-center');
  return payload;
}

async function loadItems() {
  const params = new URLSearchParams();
  if (state.filter !== 'all') params.set('filter', state.filter);
  if (state.search.trim()) params.set('search', state.search.trim());
  const payload = await apiRequest(`/api/items?${params.toString()}`);
  state.items = payload.items || [];
  state.itemCounts = payload.counts || state.itemCounts;
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

async function loadStudentProgress() {
  if (state.user?.role !== 'student') return;
  const payload = await apiRequest('/api/my-progress');
  state.studentProgress = { workOrders: payload.workOrders || [], riskReports: payload.riskReports || [] };
  renderStudentProgress();
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
      if (state.activePage === 'overview') await Promise.all([loadDashboard(), loadTodos(), loadNotifications(), loadStudentProgress(), loadRewards()]);
      if (state.activePage === 'governance') await Promise.all([loadRisks(), loadRiskReports(), loadRiskReviewers(), loadReviewCenter(), loadModerationQueue(), loadAudit(), loadUsers()]);
    } catch (error) { handleApiError(error); }
  }, 15000);
}

async function loadRisks() {
  if (state.user?.role === 'student') { state.risks = []; renderRisks(); return; }
  const payload = await apiRequest('/api/risks');
  state.risks = payload.risks || [];
  renderRisks();
}

async function loadRiskReports() {
  if (!['sustainability', 'admin'].includes(state.user?.role)) return;
  const payload = await apiRequest('/api/risk-reports');
  state.riskReports = payload.reports || [];
  renderRiskReports();
}

async function loadRiskReviewers() {
  if (!['sustainability', 'admin'].includes(state.user?.role)) return;
  const payload = await apiRequest('/api/risk-reviewers');
  state.riskReviewers = payload.reviewers || [];
  renderRiskReports();
}

async function loadModerationQueue() {
  if (!['operator', 'admin'].includes(state.user?.role)) return;
  const payload = await apiRequest('/api/moderation/queue');
  const handoffIds = new Set((payload.handoffs || []).map(order => order.id));
  state.workOrders = [...state.workOrders.filter(order => !handoffIds.has(order.id)), ...(payload.handoffs || [])];
  renderModerationQueue(payload.items || [], payload.handoffs || []);
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
  const payload = await apiRequest('/api/evidence');
  state.evidence = payload.evidence || [];
  state.interviews = state.evidence.filter(entry => entry.type === 'Primary interview evidence');
  renderEvidence();
}

function renderModerationQueue(items, handoffs = []) {
  const list = document.getElementById('moderation-list');
  const count = document.getElementById('moderation-count');
  if (!list || !count) return;
  const total = items.length + handoffs.length;
  count.textContent = `${total} 项`;
  if (!total) { list.innerHTML = '<div class="moderation-empty"><p class="empty-inline">当前没有待审核发布或待处理交接任务。</p><button class="button small secondary" data-action="open-add-item">新建一条待审核资源</button></div>'; return; }
  const resourceRows = items.map(item => `<div class="moderation-row"><div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.category)} · ${escapeHtml(item.location)} · ${escapeHtml(item.id)}</span></div><div class="moderation-actions"><button class="button small secondary" data-review-item="${escapeHtml(item.id)}" data-review-status="rejected">驳回</button><button class="button small primary" data-review-item="${escapeHtml(item.id)}" data-review-status="approved">通过</button></div></div>`).join('');
  const handoffRows = handoffs.map(order => `<div class="moderation-row moderation-handoff"><div><strong><span class="moderation-kind">资源交接</span>${escapeHtml(String(order.title || '').replace(/^资源交接：/, ''))}</strong><span>${escapeHtml(order.area || '待确认地点')} · ${escapeHtml(order.due || '待安排')} · ${order.person === 'UNASSIGNED' ? '待分配设施运营负责人' : `负责人 ${escapeHtml(order.person)}`}</span></div><div class="moderation-actions"><button class="button small primary" data-order-id="${escapeHtml(order.id)}">打开交接工单</button></div></div>`).join('');
  list.innerHTML = resourceRows + handoffRows;
}

function renderAudit(entries) {
  const list = document.getElementById('audit-list');
  if (!list) return;
  if (!entries.length) { list.innerHTML = '<p class="empty-inline">暂无操作记录。</p>'; return; }
  list.innerHTML = entries.slice(0, 8).map(entry => { const change = entry.change ? ` · ${escapeHtml(JSON.stringify(entry.change.after))}` : ''; return `<div class="audit-row"><span class="audit-avatar">${escapeHtml(entry.initials || 'SYS')}</span><div><strong>${escapeHtml(entry.actionLabel)}</strong><small>${escapeHtml(entry.displayName || entry.actor)} · ${escapeHtml(entry.entityLabel)} · ${escapeHtml(entry.at)}${change}</small></div><span class="audit-kind">${escapeHtml(entry.entityType)}</span></div>`; }).join('');
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
  setText('nav-resource-count', metrics.availableItems ?? metrics.activeItems ?? 0);
  setText('overview-active-items', metrics.activeItems ?? '—');
  setText('overview-open-orders', metrics.openOrders ?? '—');
  setText('overview-orders-overdue', `${metrics.overdueOrders ?? 0} 项逾期`);
  setText('overview-reuse-rate', `${metrics.reuseRate ?? '—'}%`);
  setText('reuse-basis', `${metrics.completedReuseItems ?? 0} completed / ${metrics.activeItems ?? 0} eligible items`);
  setText('overview-avoided-kg', `${metrics.avoidedKg ?? 0} kg`);
  setText('overview-published-items', metrics.activeItems ?? '—');
  setText('overview-pending-items', metrics.pendingItems ?? '—');
  setText('overview-claimed-items', metrics.claimedItems ?? '—');
  setText('overview-completed-orders', metrics.completedReuseItems ?? metrics.completedOrders ?? '—');
  setText('ops-open-orders', metrics.openOrders ?? '—');
  setText('ops-overdue-orders', metrics.overdueOrders ?? '—');
  setText('ops-pickup-sites', metrics.pickupSites ?? '—');
  setText('ops-completion-rate', metrics.completionRate ?? '—');
  setText('ops-offline-queue', metrics.offlineQueue ?? state.queuedRequests.length);
  setText('chart-avoided-kg', `${(metrics.trend || []).reduce((total, point) => total + (Number(point.value) || 0), 0)} completed items`);
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
  const averageHours = document.getElementById('ops-average-hours'); if (averageHours) averageHours.innerHTML = `${escapeHtml(metrics.sla?.averageHours ?? '—')}<small>小时</small>`;
  setText('pilot-participation', `${metrics.pilotHealth?.participation ?? '—'}%`); setText('pilot-on-time', `${metrics.pilotHealth?.onTime ?? '—'}%`); setText('pilot-data-completeness', `${metrics.pilotHealth?.dataCompleteness ?? '—'}%`);
  const pilotBarIds = { participation: 'pilot-participation-bar', onTime: 'pilot-on-time-bar', dataCompleteness: 'pilot-data-completeness-bar' };
  Object.entries(pilotBarIds).forEach(([key, id]) => { const bar = document.getElementById(id); if (bar) bar.style.width = `${metrics.pilotHealth?.[key] ?? 0}%`; });
  const bars = [...document.querySelectorAll('#page-overview .bar-group')]; const trend = metrics.trend || []; const maxTrend = Math.max(...trend.map(point => Number(point.value) || 0), 1); bars.forEach((group, index) => { const point = trend[index]; if (!point) return; const value = Number(point.value) || 0; const valueNode = group.querySelector('.bar-value'); const bar = group.querySelector('.bar'); const label = group.querySelector('span:last-child'); if (valueNode) valueNode.textContent = value; if (bar) bar.style.height = `${Math.round(value / maxTrend * 100)}%`; if (label) label.textContent = point.label; });
  const maxWeight = Math.max(...trend.map(point => Number(point.avoidedKg) || 0), 1); document.querySelectorAll('#page-impact .line-grid span').forEach((label, index) => { label.textContent = String(Number((maxWeight * (4 - index) / 4).toFixed(1))); }); const linePoints = trend.map((point, index) => [index * (720 / Math.max(trend.length - 1, 1)), 220 - ((Number(point.avoidedKg) || 0) / maxWeight) * 195]); if (linePoints.length > 1) { const linePath = linePoints.map((point, index) => `${index ? 'L' : 'M'}${point[0].toFixed(1)} ${point[1].toFixed(1)}`).join(' '); const areaPath = `${linePath} L720 240 L0 240Z`; document.getElementById('impact-line')?.setAttribute('d', linePath); document.getElementById('impact-area')?.setAttribute('d', areaPath); const end = linePoints[linePoints.length - 1]; document.getElementById('impact-line-end')?.setAttribute('cx', end[0]); document.getElementById('impact-line-end')?.setAttribute('cy', end[1]); }
  const mixKeys = ['furniture', 'books', 'electronics', 'other']; (metrics.mix || []).forEach((entry, index) => { setText(`mix-${mixKeys[index]}`, `${entry.percent}%`); }); const donut = document.getElementById('material-donut'); if (donut && metrics.mix?.length) { let cursor = 0; const colors = ['#7358f4', '#3bbba5', '#f0b24e', '#78a8ef']; donut.style.background = `conic-gradient(${metrics.mix.map((entry, index) => { const start = cursor; cursor += entry.percent; return `${colors[index]} ${start}% ${cursor}%`; }).join(', ')})`; }
  const locationList = document.getElementById('impact-locations'); if (locationList && metrics.locations?.length) { const maxLocation = Math.max(...metrics.locations.map(item => item.value), 1); locationList.innerHTML = metrics.locations.map((item, index) => `<div class="location-row"><span class="rank">${String(index + 1).padStart(2, '0')}</span><div class="location-name"><strong>${escapeHtml(item.location)}</strong><div class="location-bar"><i style="width:${Math.round(item.value / maxLocation * 100)}%"></i></div></div><strong>${item.value} kg</strong></div>`).join(''); }
  const kpiBody = document.getElementById('kpi-target-body'); if (kpiBody) { kpiBody.innerHTML = (metrics.kpis || []).map(kpi => { const gap = Number(kpi.actual) - Number(kpi.target); const denominator = typeof kpi.denominator === 'number' ? `${kpi.numerator} / ${kpi.denominator}` : `${kpi.numerator || '—'} / ${kpi.denominator || '—'}`; return `<tr><td><strong>${escapeHtml(kpi.label)}</strong><small class="kpi-definition">${escapeHtml(kpi.definition || '')}</small><small class="kpi-definition">Basis: ${escapeHtml(denominator)} · Source: ${escapeHtml(kpi.source || 'Live records')} · Period: ${escapeHtml(kpi.period || 'Current')}</small></td><td>${escapeHtml(kpi.target)} ${escapeHtml(kpi.unit)}</td><td>${escapeHtml(kpi.actual)} ${escapeHtml(kpi.unit)}</td><td class="${gap >= 0 ? 'kpi-positive' : 'kpi-negative'}">${gap >= 0 ? '+' : ''}${gap.toFixed(1)} ${escapeHtml(kpi.unit)}</td><td>${escapeHtml(kpi.label.includes('risk') ? 'Sustainability admin' : kpi.label.includes('work-order') ? 'Facilities operations' : 'Project lead')}</td></tr>`; }).join(''); }
}

function studentAssigneeLabel(person) {
  return { LM: 'Lin Mei · 设施运营', JC: 'Jordan Chen · 设施运营', AK: 'Ava Kim · 设施运营', UNASSIGNED: '设施运营主管 · 待分配' }[person] || '设施运营团队';
}

function studentFlowFor(item, kind) {
  if (kind === 'riskReport') {
    const approved = item.status === 'approved';
    const rejected = item.status === 'rejected';
    return [
      { label: '已提交上报', state: 'complete', owner: item.reportedByName || '你', meta: '学生提交风险信息' },
      { label: rejected ? '已打回' : approved ? '审核完成' : '人工审核中', state: rejected ? 'rejected' : approved ? 'complete' : 'current', owner: item.reviewerName || '可持续管理员 / 系统管理员', meta: rejected ? (item.reviewReason || '审核未通过') : approved ? '已通过人工审核' : '等待人工审核处理' },
      { label: '风险登记', state: approved ? 'complete' : 'pending', owner: item.owner && item.owner !== '待分配' ? item.owner : '治理负责人 · 待分配', meta: approved ? `已登记 · ${item.formalRiskStatus || '监控中'}` : '审核通过后自动登记' },
      { label: '持续监控', state: approved && item.formalRiskStatus === '监控中' ? 'current' : 'pending', owner: item.owner && item.owner !== '待分配' ? item.owner : '治理负责人 · 待分配', meta: approved ? '根据风险状态持续跟进' : '尚未进入该节点' }
    ];
  }
  const assigned = item.person && item.person !== 'UNASSIGNED';
  const statuses = { new: '待分配', progress: '处理中', pickup: '待清运', done: '已完成' };
  const current = statuses[item.status] || '待处理';
  return [
    { label: '问题已上报', state: 'complete', owner: '你', meta: '学生提交设施问题' },
    { label: assigned ? '负责人已分配' : '待分配负责人', state: assigned ? 'complete' : 'current', owner: assigned ? studentAssigneeLabel(item.person) : '设施运营主管', meta: assigned ? '已进入运营人员工作列表' : '等待设施运营接单' },
    { label: '现场处理', state: item.status === 'progress' ? 'current' : ['pickup', 'done'].includes(item.status) ? 'complete' : 'pending', owner: assigned ? studentAssigneeLabel(item.person) : '待分配', meta: item.status === 'progress' ? '运营人员正在处理' : item.status === 'new' ? '负责人确认后开始' : '处理节点已完成' },
    { label: '清运与复核', state: item.status === 'pickup' ? 'current' : item.status === 'done' ? 'complete' : 'pending', owner: assigned ? studentAssigneeLabel(item.person) : '设施运营团队', meta: item.status === 'pickup' ? '等待完成清运并复核' : item.status === 'done' ? '已完成清运和记录复核' : '现场处理完成后进入' },
    { label: '工单完成', state: item.status === 'done' ? 'complete' : 'pending', owner: '设施运营团队', meta: item.status === 'done' ? '流程已闭环' : `当前节点：${current}` }
  ];
}

function studentOrderProgress(order) {
  const config = {
    new: { label: '已上报 · 待分配', percent: 25, tone: 'blue' },
    progress: { label: '处理中', percent: 55, tone: 'purple' },
    pickup: { label: '待清运', percent: 78, tone: 'amber' },
    done: { label: '已完成', percent: 100, tone: 'green' }
  }[order.status] || { label: '处理中', percent: 50, tone: 'purple' };
  return { kind: 'workOrder', id: order.id, title: order.title, meta: `${order.area} · ${order.due || '截止时间待确认'}`, status: config.label, percent: config.percent, tone: config.tone, item: order, currentOwner: studentFlowFor(order, 'workOrder').find(node => node.state === 'current')?.owner || '设施运营团队' };
}

function studentRiskProgress(report) {
  const approved = report.status === 'approved';
  const rejected = report.status === 'rejected';
  const config = approved
    ? { label: report.formalRiskStatus ? `已登记 · ${report.formalRiskStatus}` : '已通过 · 登记中', percent: 100, tone: 'green' }
    : rejected
      ? { label: '已驳回', percent: 100, tone: 'red' }
      : { label: '审核中', percent: 48, tone: 'amber' };
  return { kind: 'riskReport', id: report.id, title: report.title, meta: `${report.category} · ${report.location}`, status: config.label, percent: config.percent, tone: config.tone, item: report, currentOwner: studentFlowFor(report, 'riskReport').find(node => node.state === 'current' || node.state === 'rejected')?.owner || report.owner || '治理负责人' };
}

function renderStudentProgress() {
  const list = document.getElementById('student-progress-list');
  const count = document.getElementById('student-progress-count');
  if (!list || !count || state.user?.role !== 'student') return;
  const rows = [
    ...state.studentProgress.workOrders.map(studentOrderProgress),
    ...state.studentProgress.riskReports.map(studentRiskProgress)
  ].sort((a, b) => String(b.item.createdAt || '').localeCompare(String(a.item.createdAt || '')));
  count.textContent = `${rows.length} 条记录`;
  if (!rows.length) {
    list.innerHTML = '<div class="student-progress-empty"><span class="student-progress-empty-icon">⌁</span><div><strong>还没有上报记录</strong><p>提交设施问题或风险后，你可以在这里跟踪处理进度。</p></div><div class="student-progress-empty-actions"><button class="button small secondary" data-action="open-work-order">报告设施问题</button><button class="button small primary" data-action="open-risk-report">上报风险</button></div></div>';
    return;
  }
  list.innerHTML = rows.map(row => `<button class="student-progress-row" data-student-progress-id="${escapeHtml(row.id)}" data-student-progress-kind="${escapeHtml(row.kind)}"><span class="student-progress-type ${row.kind === 'riskReport' ? 'risk' : 'facility'}">${row.kind === 'riskReport' ? '风险' : '设施'}</span><span class="student-progress-copy"><strong>${escapeHtml(row.title)}</strong><small>${escapeHtml(row.meta)}</small></span><span class="student-progress-state"><strong>${escapeHtml(row.status)}</strong><small>负责人：${escapeHtml(row.currentOwner)}</small><span class="student-progress-track"><i class="${row.tone}" style="width:${row.percent}%"></i></span></span><span class="student-progress-detail">查看详情</span><span class="student-progress-arrow">→</span></button>`).join('');
}

function renderEvidence() {
  const list = document.getElementById('evidence-list');
  if (!list) return;
  if (!state.evidence.length) { list.innerHTML = '<p class="empty-inline">No evidence has been recorded yet.</p>'; return; }
  list.innerHTML = state.evidence.slice(0, 6).map(entry => `<button type="button" class="evidence-row" data-evidence-id="${escapeHtml(entry.id)}"><div><strong>${escapeHtml(entry.title)}</strong><small>${escapeHtml(entry.type)} · ${escapeHtml(entry.source)}</small></div><span class="evidence-consent ${entry.consent ? 'confirmed' : 'pending'}">${entry.consent ? 'Consent confirmed' : 'Consent to verify'}</span><p>${escapeHtml(entry.finding)}</p><span class="evidence-open-link">Open transcript →</span></button>`).join('');
}

function openInterviewEvidenceModal(id) {
  const entry = state.evidence.find(item => item.id === id);
  if (!entry) return;
  const questions = (entry.questions || []).map(question => `<article class="interview-question"><span class="interview-question-id">${escapeHtml(question.id)}</span><div><h3>${escapeHtml(question.question)}</h3>${Object.entries(question.answers || {}).map(([respondent, answer]) => `<p><strong>Respondent ${escapeHtml(respondent)}:</strong> ${escapeHtml(answer)}</p>`).join('')}</div></article>`).join('');
  const findings = (entry.keyFindings || []).map(item => `<li>${escapeHtml(item)}</li>`).join('');
  const implications = (entry.designImplications || []).map(item => `<li>${escapeHtml(item)}</li>`).join('');
  openModal(`<div class="modal-head"><div><p class="panel-kicker">PRIMARY INTERVIEW EVIDENCE · ${escapeHtml(entry.id)}</p><h2>${escapeHtml(entry.title)}</h2><p>${escapeHtml(entry.respondentLabel || '')} · ${escapeHtml(entry.language || '')}</p></div><button class="close-modal" data-close-modal="true" aria-label="Close">×</button></div><div class="evidence-source-note"><strong>Source</strong><span>${escapeHtml(entry.source)}</span><span>Consent confirmed</span></div><div class="interview-summary"><h3>Cross-respondent synthesis</h3><p>${escapeHtml(entry.finding)}</p><div class="interview-columns"><div><h4>Key findings</h4><ul>${findings}</ul></div><div><h4>Design implications</h4><ul>${implications}</ul></div></div></div><div class="interview-transcript"><div class="panel-heading"><div><p class="panel-kicker">ENGLISH TRANSCRIPT</p><h3>Questions and answers</h3></div><span class="small-muted">12 questions · 3 respondents</span></div>${questions}</div><div class="modal-actions"><button class="button secondary" data-close-modal="true">Close</button></div>`);
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
  if (page === 'governance') { loadRisks().catch(handleApiError); loadRiskReports().catch(handleApiError); loadRiskReviewers().catch(handleApiError); loadModerationQueue().catch(handleApiError); loadAudit().catch(handleApiError); loadUsers().catch(handleApiError); }
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
  const filterCounts = state.itemCounts || { all: state.items.length, available: state.items.filter(item => item.statusKey === 'available').length, repair: state.items.filter(item => ['repair', 'repair_in_progress'].includes(item.statusKey)).length, donation: state.items.filter(item => item.statusKey === 'donation').length };
  setText('nav-resource-count', filterCounts.available);
  document.querySelectorAll('.segment[data-filter]').forEach(button => { const count = button.querySelector('b'); if (count) count.textContent = filterCounts[button.dataset.filter] ?? 0; });
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
  body.innerHTML = state.risks.length ? state.risks.map(risk => `<tr><td><strong>${escapeHtml(risk.title)}</strong><span class="table-sub">${escapeHtml(risk.category)} · ${escapeHtml(risk.id)}</span></td><td>${escapeHtml(risk.affected)}</td><td><span class="risk-label ${riskClass(risk.level)}">${riskLabel(risk.level)}</span></td><td><span class="score-pill ${riskScore(risk) >= 12 ? 'score-high' : riskScore(risk) >= 6 ? 'score-medium' : 'score-low'}">${riskScore(risk)} / 25</span></td><td>${escapeHtml(risk.mitigation)}</td><td>${escapeHtml(risk.owner)}</td><td><button class="risk-status-action ${risk.status === '已缓解' ? 'green-action' : 'amber-action'}" data-risk-id="${escapeHtml(risk.id)}"><span class="risk-status-dot"></span><strong>${escapeHtml(risk.status)}</strong><span class="risk-edit-label">编辑状态&nbsp;↗</span></button></td></tr>`).join('') : '<tr><td colspan="7">暂无风险记录</td></tr>';
}

function riskReviewerOptions(selected = '') {
  if (!state.riskReviewers.length) return '<option value="">暂无可用复核人</option>';
  return '<option value="">选择复核人</option>' + state.riskReviewers.map(reviewer => `<option value="${escapeHtml(reviewer.username)}" ${reviewer.username === selected ? 'selected' : ''}>${escapeHtml(reviewer.displayName)} · ${escapeHtml(roleLabels[reviewer.role] || reviewer.role)}</option>`).join('');
}

function renderRiskReports() {
  const list = document.getElementById('risk-report-list'); const count = document.getElementById('risk-report-count');
  if (!list || !count) return;
  count.textContent = `${state.riskReports.length} 项待审核`;
  if (!state.riskReports.length) { list.innerHTML = '<p class="empty-inline">当前没有待审核的风险上报。</p>'; return; }
  list.innerHTML = state.riskReports.map(report => `<div class="risk-report-row" data-risk-report-row="${escapeHtml(report.id)}"><div class="risk-report-copy"><strong>${escapeHtml(report.title)}</strong><small>${escapeHtml(report.category)} · ${escapeHtml(report.location)} · ${escapeHtml(report.reportedByName || report.reportedBy)}</small><p>${escapeHtml(report.mitigation)}</p>${report.evidence ? `<span class="evidence-chip">证据：${escapeHtml(report.evidence)}</span>` : ''}</div><div class="risk-report-reviewer"><label>复核人</label><select data-risk-reviewer aria-label="${escapeHtml(report.title)} 的复核人">${riskReviewerOptions(report.reviewerUsername)}</select><button class="button small secondary" data-save-risk-reviewer="${escapeHtml(report.id)}">保存</button></div><div class="risk-report-actions"><button class="button small secondary" data-review-risk-report="${escapeHtml(report.id)}" data-review-status="rejected">驳回</button><button class="button small primary" data-review-risk-report="${escapeHtml(report.id)}" data-review-status="approved">通过并登记</button></div></div>`).join('');
}

function renderTodos() {
  const list = document.getElementById('todo-list'); if (!list) return;
  const count = document.getElementById('queue-count'); if (count) count.textContent = `${state.todos.length} 项`;
  if (!state.todos.length) { list.innerHTML = '<p class="empty-inline">当前没有待办事项。</p>'; return; }
  list.innerHTML = state.todos.slice(0, 5).map(todo => `<button class="task-row" data-page-jump="${escapeHtml(todo.target)}"><span class="task-status ${todo.priority === 'high' ? 'purple' : 'blue-dot'}"></span><span class="task-copy"><strong>${escapeHtml(todo.title)}</strong><small>${escapeHtml(todo.meta)}</small></span><span class="task-arrow">→</span></button>`).join('');
}

function renderReviewCenter() {
  const list = document.getElementById('review-center-list'); const count = document.getElementById('review-center-count');
  if (!list || !count) return;
  const total = state.reviewCenter.resources.length + state.reviewCenter.riskReports.length + state.reviewCenter.workOrders.length;
  count.textContent = `${total} 项待处理`;
  const activeTab = document.querySelector('[data-review-tab].active')?.dataset.reviewTab || 'all';
  const entries = [];
  const summaryRow = (kind, title, detail, action, label) => `<div class="review-center-row review-summary-row"><div><span class="review-summary-kind">${escapeHtml(kind)}</span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></div><button class="button small ${action === 'operations' ? 'secondary' : 'primary'}" data-action="${escapeHtml(action)}">${escapeHtml(label)} <span>→</span></button></div>`;
  if (activeTab === 'all' || activeTab === 'resources') entries.push(summaryRow('RESOURCE MODERATION', `${state.reviewCenter.resources.length} 条资源等待审核`, '处理资源名称、分类、地点和领取信息', 'focus-moderation', '定位资源队列'));
  if (activeTab === 'all' || activeTab === 'risks') entries.push(summaryRow('RISK REPORT MODERATION', `${state.reviewCenter.riskReports.length} 条风险上报等待审核`, '通过后才会写入正式风险登记表', 'focus-risk-reports', '定位风险队列'));
  if (activeTab === 'all' || activeTab === 'workOrders') entries.push(summaryRow('WORK ORDER FOLLOW-UP', `${state.reviewCenter.workOrders.length} 项工单需要跟进`, '未分配或已超过截止时间的设施工单', 'open-operations', '打开工单看板'));
  list.innerHTML = entries.length ? entries.join('') : '<p class="empty-inline">当前分类没有待处理事项。</p>';
}

function openModal(content) {
  modalRoot.innerHTML = `<div class="modal-backdrop" data-close-modal="true"></div><div class="modal" role="dialog" aria-modal="true">${content}</div>`;
  modalRoot.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
}

function closeModal() { modalRoot.setAttribute('aria-hidden', 'true'); modalRoot.innerHTML = ''; document.body.style.overflow = ''; }

function focusPanel(id, message) {
  const panel = document.getElementById(id);
  if (!panel) return;
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  panel.classList.remove('panel-focus');
  window.setTimeout(() => panel.classList.add('panel-focus'), 220);
  window.setTimeout(() => panel.classList.remove('panel-focus'), 1900);
  showToast(message);
}

function openAddItemModal() {
  openModal(`<div class="modal-head"><div><p class="panel-kicker">NEW RESOURCE · API CREATE</p><h2>发布一件资源</h2><p>提交后会写入后端数据文件，并进入人工审核队列。</p></div><button class="close-modal" data-close-modal="true" aria-label="关闭">×</button></div><form class="modal-form" id="add-item-form"><div class="form-field"><label for="item-name">资源名称</label><input id="item-name" name="name" required placeholder="例如：可折叠学习桌" /></div><div class="form-grid"><div class="form-field"><label for="item-category">分类</label><select id="item-category" name="category"><option>家具</option><option>书籍</option><option>电子产品</option><option>生活用品</option><option>其他</option></select></div><div class="form-field"><label for="item-location">领取地点</label><select id="item-location" name="location"><option>North Residence B · 1F</option><option>Library loading bay</option><option>Student Union · 服务台</option><option>South Residence D · 1F</option></select></div></div><div class="form-field"><label for="item-note">补充说明</label><textarea id="item-note" name="note" placeholder="描述物品状态、领取方式或安全注意事项"></textarea></div><div class="modal-actions"><button class="button secondary" type="button" data-close-modal="true">取消</button><button class="button primary" type="submit">写入后端 <span>→</span></button></div></form>`);
  document.getElementById('add-item-form').addEventListener('submit', async event => { event.preventDefault(); if (!requireApi()) return; const body = Object.fromEntries(new FormData(event.currentTarget).entries()); try { const result = await apiRequest('/api/items', { method: 'POST', body: JSON.stringify(body) }); if (result.queued) { state.items.unshift({ ...body, id: `OFF-${Date.now()}`, status: '待同步', statusKey: 'available', impact: '待估算影响', owner: state.user?.displayName || '当前用户', posted: '刚刚', emoji: body.category === '家具' ? '🪑' : body.category === '电子产品' ? '🖥️' : '📦' }); renderItems(); } else await Promise.all([loadItems(), loadDashboard()]); closeModal(); showToast(result.queued ? '资源已加入离线队列' : '资源已写入后端，等待学生大使审核'); } catch (error) { handleApiError(error); } });
}

function resourceFlowFor(item) {
  const status = item.statusKey || 'available';
  const reviewState = item.status === '待审核' ? 'current' : 'complete';
  const nodes = [{ label: '资源发布', state: 'complete', owner: item.owner || '发布者', meta: '资源已进入 CampusLoop' }, { label: '人工审核', state: reviewState, owner: item.reviewedByName || '设施运营 / 系统管理员', meta: item.status === '待审核' ? '等待审核分类、地点和安全信息' : '审核节点已完成' }];
  if (status === 'repair' || status === 'repair_in_progress') nodes.push({ label: status === 'repair_in_progress' ? '维修处理中' : '待认领维修', state: status === 'repair_in_progress' ? 'current' : 'pending', owner: item.claimedByName || '设施运营人员', meta: status === 'repair_in_progress' ? '维修人员已接手处理' : '等待维修清运人员认领' });
  else if (status === 'completed') nodes.push({ label: '已完成再利用', state: 'complete', owner: item.completedByName || '设施运营团队', meta: '已计入再利用率和避免填埋量' });
  else if (status === 'reserved') nodes.push({ label: '已预约领取', state: 'current', owner: item.claimedByName || '领取学生', meta: '请按领取地点完成交接' });
  else if (status === 'donation') nodes.push({ label: '待捐赠流转', state: 'current', owner: '学生大使 / 设施运营', meta: '等待下一次校园使用' });
  else nodes.push({ label: '待领取', state: status === 'available' ? 'current' : 'pending', owner: '领取学生', meta: status === 'available' ? '可在指定地点预约领取' : '等待审核完成' });
  return nodes;
}

function openItemModal(id) {
  const item = state.items.find(entry => entry.id === id); if (!item) return;
  const resourceTimeline = resourceFlowFor(item).map((step, index) => `<div class="timeline-step ${step.state === 'pending' ? '' : step.state === 'current' ? 'current' : 'complete'}"><span class="timeline-dot"></span><div><strong>${escapeHtml(step.label)}</strong><small>负责人：${escapeHtml(step.owner)} · ${escapeHtml(step.meta)}</small></div></div>`).join('');
  const canOperate = ['operator', 'admin'].includes(state.user?.role); const action = item.statusKey === 'available' && state.user?.role === 'student' ? { id: 'claim-item', label: '预约领取', action: 'claim', tone: 'primary' } : item.statusKey === 'repair' && canOperate ? { id: 'claim-item', label: '认领维修', action: 'claim_repair', tone: 'primary' } : item.statusKey === 'repair_in_progress' && canOperate ? { id: 'claim-item', label: '完成维修并开放领取', action: 'complete_repair', tone: 'primary' } : item.statusKey === 'donation' && canOperate ? { id: 'claim-item', label: '登记完成再利用', action: 'complete_reuse', tone: 'primary' } : item.statusKey === 'completed' ? { id: 'claim-item', label: '已完成再利用', action: null, tone: 'secondary' } : { id: 'claim-item', label: item.statusKey === 'reserved' ? '请在交接工单中继续处理' : '查看处理进度', action: null, tone: 'secondary' };
  const claimed = item.claimedByName ? `<div><span>当前处理人</span><span>${escapeHtml(item.claimedByName)}</span></div>` : '';
  const publishAction = state.user?.role === 'student' && ['donation', 'completed'].includes(item.statusKey) ? '<button class="button secondary" data-action="open-add-item">发布/捐赠我的资源</button>' : '';
  openModal(`<div class="modal-head"><div><p class="panel-kicker">RESOURCE DETAIL · ${escapeHtml(item.id)}</p><h2>资源详情与流转</h2></div><button class="close-modal" data-close-modal="true" aria-label="关闭">×</button></div><div class="detail-hero"><span class="item-emoji">${itemEmoji(item)}</span><div class="detail-meta"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.category)} · ${escapeHtml(item.status)}</span></div></div><div class="resource-location-card"><span class="resource-location-icon">⌖</span><div><strong>领取/交接地点</strong><span>${escapeHtml(item.location)}</span><small>${item.statusKey === 'available' ? '可预约后按地点领取' : item.statusKey === 'repair_in_progress' ? '维修完成后恢复领取' : '按当前流程节点处理'}</small></div></div><div class="detail-list"><div><span>发布者</span><span>${escapeHtml(item.owner)}</span></div>${claimed}<div><span>循环价值</span><span class="green-text">${escapeHtml(item.impact)}</span></div><div><span>更新时间</span><span>${escapeHtml(item.updatedAt || item.posted)}</span></div></div><div class="timeline"><p class="panel-kicker">RESOURCE LIFECYCLE</p>${resourceTimeline}</div><div class="modal-actions">${publishAction}<button class="button secondary" data-close-modal="true">关闭</button><button class="button ${action.tone}" id="claim-item" ${action.action ? '' : 'disabled'}>${action.label} <span>→</span></button></div>`);
  document.getElementById('claim-item').addEventListener('click', async () => { if (!action.action) return; if (!requireApi()) return; try { await apiRequest(`/api/items/${encodeURIComponent(item.id)}`, { method: 'PATCH', body: JSON.stringify({ action: action.action }) }); closeModal(); await Promise.all([loadItems(), loadDashboard(), loadStudentProgress(), loadNotifications()]); showToast(action.action === 'claim' ? `已预约“${item.name}”，请按地点领取` : action.action === 'claim_repair' ? `已认领“${item.name}”维修任务` : action.action === 'complete_repair' ? '维修已完成，资源重新开放领取' : '已登记完成再利用，指标已更新'); } catch (error) { handleApiError(error); } });
}

function openWorkOrderModal() {
  const isStudent = state.user?.role === 'student';
  const assignmentField = isStudent ? '' : `<div class="form-field"><label for="order-person">负责人</label><select id="order-person" name="person">${assigneeOptions()}</select></div>`;
  openModal(`<div class="modal-head"><div><p class="panel-kicker">${isStudent ? 'FACILITY REPORT · API CREATE' : 'NEW WORK ORDER · API CREATE'}</p><h2>${isStudent ? '报告设施问题' : '新建设施工单'}</h2><p>${isStudent ? '提交后会进入设施运营的待分配队列。' : '新工单会进入“待处理”列，并写入后端数据文件。'}</p></div><button class="close-modal" data-close-modal="true" aria-label="关闭">×</button></div><form class="modal-form" id="work-order-form"><div class="form-field"><label for="order-title">${isStudent ? '问题标题' : '工单名称'}</label><input id="order-title" name="title" required placeholder="例如：North Residence B 回收点照明故障" /></div><div class="form-grid"><div class="form-field"><label for="order-area">地点</label><select id="order-area" name="area"><option>North Residence B</option><option>North Residence C</option><option>South Residence D</option><option>Library loading bay</option><option>Student Union</option></select></div><div class="form-field"><label for="order-type">类型</label><select id="order-type" name="type"><option>家具</option><option>电子</option><option>书籍</option><option>维修</option><option>清运</option></select></div></div><div class="form-grid"><div class="form-field"><label for="order-due">截止时间</label><input id="order-due" name="due" required placeholder="今天 16:30" /></div><div class="form-field"><label for="order-priority">优先级</label><select id="order-priority" name="priority"><option>高</option><option selected>中</option><option>低</option></select></div></div><div class="form-grid">${assignmentField}<div class="form-field"><label for="order-quantity">数量</label><input id="order-quantity" name="quantity" type="number" min="1" value="1" /></div></div><div class="form-field"><label for="order-description">${isStudent ? '问题描述' : '处理说明'}</label><textarea id="order-description" name="description" placeholder="填写现场情况、影响范围或安全要求"></textarea></div><div class="modal-actions"><button class="button secondary" type="button" data-close-modal="true">取消</button><button class="button primary" type="submit">${isStudent ? '提交问题' : '创建工单'} <span>→</span></button></div></form>`);
  document.getElementById('work-order-form').addEventListener('submit', async event => { event.preventDefault(); if (!requireApi()) return; const body = Object.fromEntries(new FormData(event.currentTarget).entries()); try { const result = await apiRequest('/api/work-orders', { method: 'POST', body: JSON.stringify(body) }); if (result.queued) { const offlineId = `OFF-${Date.now()}`; state.workOrders.unshift({ ...body, id: offlineId, status: 'new', person: body.person || (state.user?.role === 'student' ? 'UNASSIGNED' : 'LM'), priority: body.priority || '中' }); renderKanban(); } else { await Promise.all([loadWorkOrders(), loadStudentProgress(), loadDashboard()]); } closeModal(); const createdId = result.workOrder?.id || (result.queued ? 'assigned after sync' : 'created'); showToast(result.queued ? `Request queued offline · temporary reference ${createdId}` : state.user?.role === 'student' ? `Request ${createdId} submitted. Facilities operations can now assign it.` : `Work order ${createdId} created and added to the queue.`); } catch (error) { handleApiError(error); } });
}

function openOrderModal(id) {
  const order = state.workOrders.find(entry => entry.id === id); if (!order) return;
  const nextStatus = { new: 'progress', progress: 'pickup', pickup: 'done', done: 'done' }[order.status]; const nextLabel = { new: '开始处理', progress: '标记待清运', pickup: '完成工单', done: '已完成' }[order.status]; const statusLabel = { new: '待处理', progress: '处理中', pickup: '待清运', done: '已完成' }[order.status];
  const history = (order.history || [{ label: statusLabel, at: order.due }]).map(step => `<div class="timeline-step complete"><span class="timeline-dot"></span><div><strong>${escapeHtml(step.label)}</strong><small>${escapeHtml(step.at || '')}</small></div></div>`).join('');
  const assignment = ['operator','admin'].includes(state.user?.role) ? `<div class="form-field inline-assignee"><label for="order-assignee">负责人</label><select id="order-assignee">${assigneeOptions(order.person)}</select><button class="button small secondary" type="button" id="save-order-assignee">保存负责人</button></div>` : `<div><span>负责人</span><span>${escapeHtml(order.person)} · Facilities</span></div>`;
  const ratingSummary = order.rating ? `<div><span>学生满意度</span><span class="green-text">${escapeHtml(order.rating)} / 5${order.feedback ? ` · ${escapeHtml(order.feedback)}` : ''}</span></div>` : '';
  const handoffSchedule = order.sourceType === 'resourceHandoff' && ['operator', 'admin'].includes(state.user?.role) && order.status !== 'done' ? `<div class="handoff-schedule"><div class="form-field"><label for="handoff-area">领取地点</label><input id="handoff-area" value="${escapeHtml(order.area || '')}" maxlength="200" /></div><div class="form-field"><label for="handoff-due">交接时间</label><input id="handoff-due" value="${escapeHtml(order.due === '待安排' ? '' : order.due || '')}" maxlength="100" placeholder="例如：今天 16:30" /></div><button class="button small secondary" type="button" id="save-handoff-arrangement">保存交接安排</button></div>` : '';
  openModal(`<div class="modal-head"><div><p class="panel-kicker">WORK ORDER · ${escapeHtml(order.id)}</p><h2>${escapeHtml(order.title)}</h2><p>${escapeHtml(order.area)} · ${escapeHtml(order.type)}</p></div><button class="close-modal" data-close-modal="true" aria-label="关闭">×</button></div><div class="detail-list"><div><span>当前状态</span><span>${statusLabel}</span></div><div><span>截止时间</span><span>${escapeHtml(order.due)}</span></div><div><span>数量</span><span>${escapeHtml(order.quantity || 1)}</span></div><div><span>优先级</span><span>${escapeHtml(order.priority)}</span></div>${assignment}${ratingSummary}<div><span>处理说明</span><span>${escapeHtml(order.description || '暂无说明')}</span></div></div>${handoffSchedule}<div class="timeline"><p class="panel-kicker">WORK ORDER AUDIT</p>${history}</div><div class="modal-actions"><button class="button secondary" data-close-modal="true">关闭</button><button class="button primary" id="advance-order" ${order.status === 'done' ? 'disabled' : ''}>${nextLabel} <span>→</span></button></div>`);
  const saveHandoff = document.getElementById('save-handoff-arrangement'); if (saveHandoff) saveHandoff.addEventListener('click', async () => { if (!requireApi()) return; const area = document.getElementById('handoff-area')?.value.trim(); const due = document.getElementById('handoff-due')?.value.trim(); if (!area || !due) return showToast('请填写领取地点和交接时间', 'error'); saveHandoff.disabled = true; try { await apiRequest(`/api/work-orders/${encodeURIComponent(order.id)}`, { method: 'PATCH', body: JSON.stringify({ area, due }) }); closeModal(); await Promise.all([loadWorkOrders(), loadDashboard(), loadItems(), loadAudit()]); showToast('资源交接地点和时间已保存'); } catch (error) { saveHandoff.disabled = false; handleApiError(error); } });
  const saveAssignee = document.getElementById('save-order-assignee'); if (saveAssignee) saveAssignee.addEventListener('click', async () => { if (!requireApi()) return; const assignee = document.getElementById('order-assignee')?.value; if (!assignee) return showToast('请选择一名设施运营负责人', 'error'); saveAssignee.disabled = true; try { await apiRequest(`/api/work-orders/${encodeURIComponent(order.id)}`, { method: 'PATCH', body: JSON.stringify({ person: assignee }) }); closeModal(); await Promise.all([loadWorkOrders(), loadDashboard(), loadStudentProgress(), loadModerationQueue()]); showToast(`${order.id} 已分配给 ${assigneeOptions(assignee).match(/selected[^>]*>([^<]+)/)?.[1] || '设施运营人员'}`); } catch (error) { saveAssignee.disabled = false; handleApiError(error); } });
  const advance = document.getElementById('advance-order'); if (advance && order.status !== 'done') advance.addEventListener('click', async () => { if (!requireApi()) return; const assignee = document.getElementById('order-assignee')?.value; try { await apiRequest(`/api/work-orders/${encodeURIComponent(order.id)}`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus, person: assignee }) }); closeModal(); await Promise.all([loadWorkOrders(), loadDashboard(), loadStudentProgress()]); showToast(`${order.id} 已更新，状态进入下一阶段`); } catch (error) { handleApiError(error); } });
  if (['operator', 'admin'].includes(state.user?.role)) { const notes = (order.notes || []).map(note => `<div class="work-log-row"><strong>${escapeHtml(note.text)}</strong><small>${escapeHtml(note.by)} · ${escapeHtml(note.at)}</small></div>`).join(''); const evidence = (order.evidence || []).map(item => `<span class="evidence-chip">${escapeHtml(item.label)} · ${escapeHtml(item.by)}</span>`).join(''); document.querySelector('.modal')?.insertAdjacentHTML('beforeend', `<div class="work-order-log"><div class="panel-heading"><div><p class="panel-kicker">FIELD NOTES & EVIDENCE</p><h3>处理记录</h3></div><span class="small-muted">写入审计</span></div><div class="work-log-list">${notes || '<p class="empty-inline">暂无处理备注</p>'}</div><div class="evidence-chip-list">${evidence || '<span class="empty-inline">暂无现场证据</span>'}</div><form id="work-note-form" class="work-note-form"><input name="note" placeholder="补充处理备注" /><input name="evidence" placeholder="证据名称或照片编号" /><button class="button small primary" type="submit">保存记录</button></form></div>`); document.getElementById('work-note-form')?.addEventListener('submit', async event => { event.preventDefault(); if (!requireApi()) return; const body = Object.fromEntries(new FormData(event.currentTarget).entries()); if (!body.note && !body.evidence) return showToast('请填写备注或证据名称', 'error'); try { await apiRequest(`/api/work-orders/${encodeURIComponent(order.id)}`, { method: 'PATCH', body: JSON.stringify(body) }); closeModal(); await Promise.all([loadWorkOrders(), loadDashboard(), loadAudit()]); showToast('处理记录已保存'); } catch (error) { handleApiError(error); } }); }
}

function openStudentProgressModal(id, kind) {
  if (state.user?.role !== 'student') return;
  const item = kind === 'riskReport' ? state.studentProgress.riskReports.find(entry => entry.id === id) : state.studentProgress.workOrders.find(entry => entry.id === id);
  if (!item) return;
  const flow = studentFlowFor(item, kind);
  const current = flow.find(node => node.state === 'current' || node.state === 'rejected') || flow.find(node => node.state === 'pending') || flow[flow.length - 1];
  const typeLabel = kind === 'riskReport' ? '风险上报' : '设施问题';
  const meta = kind === 'riskReport' ? (item.category + ' · ' + item.location) : (item.area + ' · ' + item.type);
  const nodes = flow.map((node, index) => '<div class="student-flow-node ' + node.state + '"><span class="student-flow-index">' + String(index + 1).padStart(2, '0') + '</span><div class="student-flow-copy"><div><strong>' + escapeHtml(node.label) + '</strong><span class="student-flow-state">' + (node.state === 'complete' ? '已完成' : node.state === 'current' ? '当前节点' : node.state === 'rejected' ? '已打回' : '待处理') + '</span></div><small>负责人：' + escapeHtml(node.owner) + '</small><p>' + escapeHtml(node.meta) + '</p></div></div>').join('');
  const resubmit = kind === 'riskReport' && item.status === 'rejected' ? '<button class="button secondary" data-action="open-risk-report">重新提交风险</button>' : '';
  const ratingOptions = [1, 2, 3, 4, 5].map(score => `<label><input type="radio" name="rating" value="${score}"${score === 5 ? ' checked' : ''}><span>${score}★</span></label>`).join('');
  const rating = kind === 'workOrder' && item.status === 'done' ? (item.rating ? `<div class="student-rating-card"><div><span class="panel-kicker">SERVICE FEEDBACK</span><strong>你的满意度：${escapeHtml(item.rating)} / 5</strong><small>${escapeHtml(item.feedback || '已完成评价')}</small></div></div>` : `<form id="student-rating-form" class="student-rating-form"><div><span class="panel-kicker">SERVICE FEEDBACK</span><strong>工单已完成，给设施运营打个分</strong></div><div class="rating-stars" role="radiogroup" aria-label="满意度评分">${ratingOptions}</div><textarea name="feedback" placeholder="可选：告诉我们哪里做得好，或还可以怎样改进"></textarea><button class="button small primary" type="submit">提交评价</button></form>`) : '';
  openModal('<div class="modal-head"><div><p class="panel-kicker">MY REPORT · ' + escapeHtml(item.id) + '</p><h2>' + typeLabel + '详情</h2><p>' + escapeHtml(meta) + '</p></div><button class="close-modal" data-close-modal="true" aria-label="关闭">×</button></div><div class="student-current-node ' + current.state + '"><div><span>当前处理节点</span><strong>' + escapeHtml(current.label) + '</strong></div><div><span>当前负责人</span><strong>' + escapeHtml(current.owner) + '</strong></div></div><div class="student-flow">' + nodes + '</div>' + rating + '<div class="modal-actions">' + resubmit + '<button class="button primary" data-close-modal="true">知道了</button></div>');
  document.getElementById('student-rating-form')?.addEventListener('submit', async event => { event.preventDefault(); if (!requireApi()) return; const body = Object.fromEntries(new FormData(event.currentTarget).entries()); try { await apiRequest(`/api/work-orders/${encodeURIComponent(item.id)}`, { method: 'PATCH', body: JSON.stringify({ rating: body.rating, feedback: body.feedback }) }); closeModal(); await Promise.all([loadStudentProgress(), loadNotifications(), loadDashboard()]); showToast('感谢评价，满意度已记录'); } catch (error) { handleApiError(error); } });
}

function openRiskModal() {
  openModal(`<div class="modal-head"><div><p class="panel-kicker">NEW RISK · API CREATE</p><h2>新增风险项</h2><p>风险会进入治理登记表，供团队后续分配负责人和缓解措施。</p></div><button class="close-modal" data-close-modal="true" aria-label="关闭">×</button></div><form class="modal-form" id="risk-form"><div class="form-field"><label for="risk-title">风险名称</label><input id="risk-title" name="title" required placeholder="例如：数据同步延迟导致工单重复" /></div><div class="form-grid"><div class="form-field"><label for="risk-category">类别</label><select id="risk-category" name="category"><option>Infrastructure</option><option>Ethics</option><option>Safety</option><option>Privacy</option><option>Operations</option></select></div><div class="form-field"><label for="risk-level">等级</label><select id="risk-level" name="level"><option value="high">高</option><option value="medium" selected>中</option><option value="low">低</option></select></div></div><div class="form-grid"><div class="form-field"><label for="risk-probability">发生概率</label><select id="risk-probability" name="probability"><option value="1">1 · 很低</option><option value="2">2 · 较低</option><option value="3" selected>3 · 中</option><option value="4">4 · 较高</option><option value="5">5 · 很高</option></select></div><div class="form-field"><label for="risk-impact">影响程度</label><select id="risk-impact" name="impact"><option value="1">1 · 较小</option><option value="2">2 · 轻微</option><option value="3" selected>3 · 中</option><option value="4">4 · 严重</option><option value="5">5 · 关键</option></select></div></div><div class="form-grid"><div class="form-field"><label for="risk-due">复核日期</label><input id="risk-due" name="due" placeholder="例如：本周五" /></div><div class="form-field"><label for="risk-owner">负责人</label><input id="risk-owner" name="owner" required placeholder="例如：治理负责人" /></div></div><div class="form-field"><label for="risk-affected">影响对象</label><input id="risk-affected" name="affected" required placeholder="例如：学生、设施团队、数据管理员" /></div><div class="form-field"><label for="risk-mitigation">缓解措施</label><textarea id="risk-mitigation" name="mitigation" required placeholder="填写一个可执行的预防、监控或恢复措施"></textarea></div><div class="modal-actions"><button class="button secondary" type="button" data-close-modal="true">取消</button><button class="button primary" type="submit">写入风险登记表 <span>→</span></button></div></form>`);
  document.getElementById('risk-form').addEventListener('submit', async event => { event.preventDefault(); if (!requireApi()) return; const body = Object.fromEntries(new FormData(event.currentTarget).entries()); try { const result = await apiRequest('/api/risks', { method: 'POST', body: JSON.stringify(body) }); if (result.queued) { state.risks.unshift({ ...body, id: `OFF-${Date.now()}`, score: Number(body.probability) * Number(body.impact), status: '待同步' }); renderRisks(); } else await loadRisks(); closeModal(); showToast(result.queued ? '风险项已加入离线队列' : '风险项已写入治理登记表'); } catch (error) { handleApiError(error); } });
}

function openRiskReportModal() {
  openModal(`<div class="modal-head"><div><p class="panel-kicker">RISK REPORT · HUMAN REVIEW</p><h2>上报一个风险</h2><p>提交后进入可持续管理员和系统管理员的人工审核队列。</p></div><button class="close-modal" data-close-modal="true" aria-label="关闭">×</button></div><form class="modal-form" id="risk-report-form"><div class="form-field"><label for="report-title">风险名称</label><input id="report-title" name="title" required placeholder="例如：危险物品被错误发布" /></div><div class="form-grid"><div class="form-field"><label for="report-category">类别</label><select id="report-category" name="category"><option>Infrastructure</option><option>Safety</option><option>Ethics</option><option>Privacy</option><option>Operations</option></select></div><div class="form-field"><label for="report-level">等级</label><select id="report-level" name="level"><option value="high">高</option><option value="medium" selected>中</option><option value="low">低</option></select></div></div><div class="form-grid"><div class="form-field"><label for="report-location">发生地点</label><input id="report-location" name="location" required placeholder="例如：North Residence B" /></div><div class="form-field"><label for="report-affected">影响对象</label><input id="report-affected" name="affected" required placeholder="例如：学生、设施团队" /></div></div><div class="form-field"><label for="report-mitigation">风险描述与建议措施</label><textarea id="report-mitigation" name="mitigation" required placeholder="描述你观察到的风险，以及建议如何预防或缓解"></textarea></div><div class="form-field"><label for="report-evidence">补充证据</label><input id="report-evidence" name="evidence" placeholder="照片编号、地点记录或相关链接" /></div><div class="modal-actions"><button class="button secondary" type="button" data-close-modal="true">取消</button><button class="button primary" type="submit">提交人工审核 <span>→</span></button></div></form>`);
  document.getElementById('risk-report-form').addEventListener('submit', async event => { event.preventDefault(); if (!requireApi()) return; const body = Object.fromEntries(new FormData(event.currentTarget).entries()); try { await apiRequest('/api/risk-reports', { method: 'POST', body: JSON.stringify(body) }); await loadStudentProgress(); closeModal(); showToast('风险已上报，等待人工审核'); } catch (error) { handleApiError(error); } });
}

function openRiskDetailModal(id) {
  const risk = state.risks.find(entry => entry.id === id); if (!risk) return;
  const statusMap = { '监控中': 'monitoring', '已缓解': 'mitigated', '已关闭': 'closed' };
  const riskHistory = risk.history || [{ label: '已登记', at: risk.createdAt || '演示数据' }];
  const riskTimeline = riskHistory.map((step, index) => `<div class="timeline-step ${index === riskHistory.length - 1 ? 'current' : 'complete'}"><span class="timeline-dot"></span><div><strong>${escapeHtml(step.label)}</strong><small>${escapeHtml(step.at || '')} · ${escapeHtml(step.by || '')}</small></div></div>`).join('');
  openModal(`<div class="modal-head"><div><p class="panel-kicker">RISK CONTROL · ${escapeHtml(risk.id)}</p><h2>${escapeHtml(risk.title)}</h2><p>${escapeHtml(risk.category)} · 评分 ${riskScore(risk)} / 25</p></div><button class="close-modal" data-close-modal="true" aria-label="关闭">×</button></div><form class="modal-form" id="risk-update-form"><div class="form-field"><label for="risk-update-status">当前状态</label><select id="risk-update-status" name="status"><option value="monitoring" ${statusMap[risk.status] === 'monitoring' ? 'selected' : ''}>监控中</option><option value="mitigated" ${statusMap[risk.status] === 'mitigated' ? 'selected' : ''}>已缓解</option><option value="closed" ${statusMap[risk.status] === 'closed' ? 'selected' : ''}>已关闭</option></select></div><div class="form-field"><label for="risk-update-mitigation">最新缓解措施</label><textarea id="risk-update-mitigation" name="mitigation">${escapeHtml(risk.mitigation)}</textarea></div><div class="detail-list"><div><span>影响对象</span><span>${escapeHtml(risk.affected)}</span></div><div><span>负责人</span><span>${escapeHtml(risk.owner)}</span></div><div><span>复核日期</span><span>${escapeHtml(risk.due)}</span></div></div><div class="timeline"><p class="panel-kicker">RISK LIFECYCLE</p>${riskTimeline}</div><div class="modal-actions"><button class="button secondary" type="button" data-close-modal="true">取消</button><button class="button primary" type="submit">保存风险状态 <span>→</span></button></div></form>`);
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

async function openReportCenter() {
  try {
    const report = await loadReportCenter(); const metrics = report.metrics;
    openModal(`<div class="modal-head"><div><p class="panel-kicker">REPORT CENTER · ${escapeHtml(new Date(report.generatedAt).toLocaleString('zh-CN'))}</p><h2>运营报告中心</h2><p>当前数据快照来自后端资源、工单、风险和审核记录。</p></div><button class="close-modal" data-close-modal="true" aria-label="关闭">×</button></div><div class="report-summary-grid"><div><strong>${escapeHtml(metrics.activeItems)}</strong><span>活跃资源</span></div><div><strong>${escapeHtml(metrics.openOrders)}</strong><span>开放工单</span></div><div><strong>${escapeHtml(metrics.risks)}</strong><span>风险项</span></div><div><strong>${escapeHtml(metrics.riskReportsPending)}</strong><span>待审核风险</span></div></div><div class="audit-report-preview"><p class="panel-kicker">RECENT AUDIT</p>${report.recentAudit.length ? report.recentAudit.slice(0, 5).map(entry => `<p><strong>${escapeHtml(entry.actionLabel)}</strong><small>${escapeHtml(entry.displayName || entry.actor)} · ${escapeHtml(entry.entityLabel)} · ${escapeHtml(entry.at)}</small></p>`).join('') : '<p>暂无审计记录。</p>'}</div><div class="modal-actions"><button class="button secondary" data-close-modal="true">关闭</button><button class="button primary" data-action="export-report">下载 CSV <span>↓</span></button></div>`);
  } catch (error) { handleApiError(error); }
}

function openResetDemoModal() {
  if (!requireRole(['admin'])) return;
  openModal(`<div class="modal-head"><div><p class="panel-kicker">DEMO CONTROL · ADMIN ONLY</p><h2>重置演示数据</h2><p>恢复初始资源、工单、风险、账户复核状态和审核队列，方便重新演示完整流程。</p></div><button class="close-modal" data-close-modal="true" aria-label="关闭">×</button></div><div class="reset-demo-note">此操作会清除当前演示产生的资源、工单、风险上报和审计记录。</div><div class="modal-actions"><button class="button secondary" data-close-modal="true">取消</button><button class="button primary" id="confirm-reset-demo">确认重置 <span>↻</span></button></div>`);
  document.getElementById('confirm-reset-demo').addEventListener('click', async () => { if (!requireApi()) return; try { await apiRequest('/api/admin/reset-demo', { method: 'POST' }); closeModal(); await loadAuthenticatedData(); showToast('演示数据已重置'); } catch (error) { handleApiError(error); } });
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
  if (!state.queuedRequests.length) { showToast('没有待同步的离线记录'); return; }
  const wasOffline = state.offlineMode;
  state.offlineMode = false;
  persistOfflineQueue();
  try {
    const pending = [...state.queuedRequests]; let syncedCount = 0;
    for (const queued of pending) { await apiRequest(queued.path, { ...queued.options, skipAuthRedirect: true }); state.queuedRequests.shift(); syncedCount += 1; persistOfflineQueue(); }
    await apiRequest('/api/sync', { method: 'POST', body: JSON.stringify({ count: syncedCount }), skipAuthRedirect: true });
    await Promise.all([loadDashboard(), loadItems(), loadWorkOrders(), loadRisks(), loadAudit()]);
    setServerStatus('online', '后端已连接 · 模拟数据');
    showToast('Sync complete. Offline records were written to the server.');
  } catch (error) {
    state.offlineMode = wasOffline;
    persistOfflineQueue();
    if (error.code === 'UNAUTHENTICATED') { showToast('Your session expired. Sign in again to sync the queue.', 'error'); showLogin(error.message); return; }
    setServerStatus('offline', 'Sync unavailable · queue preserved');
    showToast(`Sync failed; ${state.queuedRequests.length} record(s) remain queued.`, 'error');
  }
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
    if (action.dataset.action === 'open-rewards') openRewards();
    if (action.dataset.action === 'open-add-item') openAddItemModal();
    if (action.dataset.action === 'open-work-order' && requireRole(['student','operator','admin'])) openWorkOrderModal();
    if (action.dataset.action === 'open-risk' && requireRole(['sustainability','admin'])) openRiskModal();
    if (action.dataset.action === 'open-risk-report' && requireRole(['student','operator','sustainability','admin'])) openRiskReportModal();
    if (action.dataset.action === 'open-evidence' && requireRole(['operator','sustainability','admin'])) openEvidenceModal();
    if (action.dataset.action === 'open-access-review') openAccessReview();
    if (action.dataset.action === 'focus-account-directory' && requireRole(['admin'])) focusPanel('account-directory-panel', '已定位到账户与权限目录');
    if (action.dataset.action === 'focus-moderation') focusPanel('moderation-panel', '已定位到资源发布审核队列');
    if (action.dataset.action === 'focus-risk-reports') focusPanel('risk-report-panel', '已定位到风险上报审核队列');
    if (action.dataset.action === 'open-operations') goToPage('operations');
    if (action.dataset.action === 'reset-demo') openResetDemoModal();
    if (action.dataset.action === 'open-route') openRouteModal();
    if (action.dataset.action === 'copy-route') { const text = 'CampusLoop 今日清运路线：North Residence B 09:30、Library loading bay 10:45、Student Union 11:30、South Residence D 13:00'; copyText(text, '路线摘要已复制', '路线摘要：North Residence B → Library loading bay → Student Union → South Residence D'); }
    if (action.dataset.action === 'focus-filter') { document.getElementById('item-search')?.focus(); showToast('已聚焦搜索框，可按地点、编号或物品筛选'); }
    if (action.dataset.action === 'export-audit') exportAudit();
    if (action.dataset.action === 'open-report-center') openReportCenter();
    if (action.dataset.action === 'export-report') { downloadCsv('campusloop-impact-report.csv', [['指标', '当前值'], ['避免填埋', `${state.metrics.avoidedKg ?? 0} kg`], ['再利用率', `${state.metrics.reuseRate ?? 0}%`], ['活跃资源', state.metrics.activeItems ?? '—'], ['开放工单', state.metrics.openOrders ?? '—'], ['待审核资源', state.metrics.pendingItems ?? '—'], ['已预约资源', state.metrics.claimedItems ?? '—'], ['风险项', state.metrics.risks ?? '—']]); showToast('影响报告已下载为 CSV'); }
    if (action.dataset.action === 'share-view') { copyText(window.location.href, '当前页面链接已复制', '当前页面链接：' + window.location.href); }
    if (action.dataset.action === 'sync-now') syncQueue();
    if (action.dataset.action === 'add-insight') { localStorage.setItem('campusloop-insight', 'North Residence B 领取点前移'); showToast('行动建议已加入本地行动清单'); }
    if (action.dataset.action === 'copy-summary') { const summary = 'CampusLoop 实施路线：需求与用户研究 → Residence B–D 试点 → 评估与调整 → 全校推广'; copyText(summary, '实施摘要已复制', summary); }
    if (action.dataset.action === 'open-settings') openInfoModal('项目设置', 'WORKSPACE SETTINGS', '<p>当前为本地演示环境。离线模式、自动刷新和数据写入都由当前浏览器与本地 Node 服务控制。</p><p>如需切换账号，请点击右上角退出后重新登录。</p>');
    if (action.dataset.action === 'open-help') openInfoModal('帮助中心', 'INTERACTION GUIDE', '<ul><li>资源交换：发布资源后会进入人工审核队列，学生可预约已通过审核的资源。</li><li>设施运营：负责人只能推进自己负责的工单，管理员可以查看全部工单。</li><li>治理与风险：可持续管理员和系统管理员可以登记、更新风险。</li><li>工单页面每 15 秒刷新一次，页面上的时间会显示最近一次后端同步。</li></ul>');
    if (action.dataset.action === 'open-notifications') { const seenKey = `campusloop-seen-notifications:${state.user?.username || 'anonymous'}`; const seen = new Set(JSON.parse(localStorage.getItem(seenKey) || '[]')); state.notifications.forEach(entry => seen.add(`${entry.id}|${entry.detail}|${entry.at}`)); localStorage.setItem(seenKey, JSON.stringify([...seen].slice(-80))); state.notificationUnread = 0; openInfoModal('通知中心', 'NOTIFICATIONS', state.notifications?.length ? state.notifications.slice(0, 8).map(entry => `<p><strong>${escapeHtml(entry.title)}</strong><br><small>${escapeHtml(entry.detail)} · ${escapeHtml(entry.at)}</small></p>`).join('') : '<p>当前没有新的操作通知。</p>'); const count = document.getElementById('notification-count'); const dot = document.querySelector('.notification-dot'); if (count) count.classList.add('hidden'); if (dot) dot.classList.add('hidden'); }
    if (action.dataset.action === 'open-pilot-info') openInfoModal('退宿季资源回收行动', 'PILOT BRIEF', '<p>本试点围绕 Residence B–D 设计资源发布、人工审核、预约领取、设施工单和离线同步五条闭环。</p><p>页面中的影响数字是课程演示数据；资源、工单、风险、账户和审计记录会写入本地后端数据文件。</p>');
    if (action.dataset.action === 'open-mix-details') openInfoModal('资源构成明细', 'MATERIAL MIX', '<p>家具与木材 42% · 书籍与纸张 26% · 电子产品 18% · 其他 14%。这些比例用于展示 RFP 指标设计，正式部署时应由资源分类记录计算。</p>');
    if (action.dataset.action === 'show-toast') showToast(action.dataset.toast || '已完成');
    return;
  }
  const itemButton = event.target.closest('[data-item-id]'); if (itemButton && state.activePage === 'exchange') { openItemModal(itemButton.dataset.itemId); return; }
  const orderButton = event.target.closest('[data-order-id]'); if (orderButton) { openOrderModal(orderButton.dataset.orderId); return; }
  const riskButton = event.target.closest('[data-risk-id]'); if (riskButton) { openRiskDetailModal(riskButton.dataset.riskId); return; }
  const studentProgress = event.target.closest('[data-student-progress-id]'); if (studentProgress) { openStudentProgressModal(studentProgress.dataset.studentProgressId, studentProgress.dataset.studentProgressKind); return; }
  if (event.target.closest('[data-close-modal]')) closeModal();
});

document.querySelectorAll('.segment').forEach(button => button.addEventListener('click', () => { document.querySelectorAll('.segment').forEach(item => item.classList.remove('active')); button.classList.add('active'); state.filter = button.dataset.filter; loadItems().catch(handleApiError); }));
document.querySelectorAll('[data-order-filter]').forEach(button => button.addEventListener('click', () => { state.orderFilter = button.dataset.orderFilter; renderKanban(); }));
document.querySelectorAll('[data-review-tab]').forEach(button => button.addEventListener('click', () => { document.querySelectorAll('[data-review-tab]').forEach(item => item.classList.remove('active')); button.classList.add('active'); renderReviewCenter(); }));
document.getElementById('item-search').addEventListener('input', event => { state.search = event.target.value; loadItems().catch(handleApiError); });
document.getElementById('top-sync').addEventListener('click', syncQueue);
document.getElementById('sync-sidebar').addEventListener('click', syncQueue);
document.getElementById('offline-mode-button').addEventListener('click', toggleOfflineMode);
document.getElementById('login-form').addEventListener('submit', async event => { event.preventDefault(); const form = new FormData(event.currentTarget); const error = document.getElementById('login-error'); error.textContent = ''; try { await login(form.get('username'), form.get('password')); } catch (err) { error.textContent = err.message; } });
document.querySelectorAll('[data-demo-account]').forEach(button => button.addEventListener('click', () => { const credentials = { student: ['student', 'student123'], operator: ['operator', 'operator123'], operator_jc: ['operator_jc', 'operator123'], operator_ak: ['operator_ak', 'operator123'], sustainability: ['sustainability', 'sustain123'], admin: ['admin', 'admin123'] }[button.dataset.demoAccount]; document.getElementById('login-username').value = credentials[0]; document.getElementById('login-password').value = credentials[1]; }));
document.getElementById('logout-button').addEventListener('click', async () => { try { await apiRequest('/api/auth/logout', { method: 'POST' }); } catch (_) {} sessionStorage.removeItem('campusloop-token'); state.token = ''; showLogin(); });
document.addEventListener('click', async event => { const review = event.target.closest('[data-review-item]'); if (!review) return; if (!['operator','admin'].includes(state.user?.role)) return showToast('当前账户没有人工审核权限', 'error'); try { await apiRequest(`/api/items/${encodeURIComponent(review.dataset.reviewItem)}/review`, { method: 'PATCH', body: JSON.stringify({ decision: review.dataset.reviewStatus }) }); await Promise.all([loadItems(), loadModerationQueue(), loadReviewCenter(), loadDashboard(), loadTodos()]); showToast(review.dataset.reviewStatus === 'approved' ? '资源已通过人工审核' : '资源已驳回'); } catch (error) { handleApiError(error); } });
document.addEventListener('click', async event => { const save = event.target.closest('[data-save-risk-reviewer]'); if (!save) return; if (!['sustainability','admin'].includes(state.user?.role)) return showToast('当前账户没有分配复核人的权限', 'error'); const row = save.closest('[data-risk-report-row]'); const reviewer = row?.querySelector('[data-risk-reviewer]')?.value; if (!reviewer) return showToast('请选择一名复核人', 'error'); save.disabled = true; try { await apiRequest(`/api/risk-reports/${encodeURIComponent(save.dataset.saveRiskReviewer)}/assign`, { method: 'PATCH', body: JSON.stringify({ reviewer }) }); await Promise.all([loadRiskReports(), loadRiskReviewers(), loadReviewCenter(), loadAudit()]); showToast('风险复核人已保存'); } catch (error) { save.disabled = false; handleApiError(error); } });
function openRiskReviewModal(id, decision, reviewer) {
  const report = state.riskReports.find(entry => entry.id === id); if (!report) return;
  const label = decision === 'approved' ? '通过并登记' : '驳回上报';
  openModal(`<div class="modal-head"><div><p class="panel-kicker">RISK REVIEW · ${escapeHtml(id)}</p><h2>${label}</h2><p>${escapeHtml(report.title)} · 复核意见会写入学生进度和审计日志。</p></div><button class="close-modal" data-close-modal="true" aria-label="关闭">×</button></div><form id="risk-review-form" class="modal-form"><div class="form-field"><label for="risk-review-reason">复核意见</label><textarea id="risk-review-reason" name="reason" ${decision === 'rejected' ? 'required' : ''} placeholder="说明判断依据、整改要求或通过原因"></textarea></div><div class="modal-actions"><button class="button secondary" type="button" data-close-modal="true">取消</button><button class="button primary" type="submit">确认${label} <span>→</span></button></div></form>`);
  document.getElementById('risk-review-form').addEventListener('submit', async event => { event.preventDefault(); if (!requireApi()) return; const body = Object.fromEntries(new FormData(event.currentTarget).entries()); try { await apiRequest(`/api/risk-reports/${encodeURIComponent(id)}/review`, { method: 'PATCH', body: JSON.stringify({ decision, reviewer, reason: body.reason }) }); closeModal(); await Promise.all([loadRisks(), loadRiskReports(), loadRiskReviewers(), loadReviewCenter(), loadDashboard(), loadTodos(), loadAudit()]); showToast(decision === 'approved' ? '风险上报已通过并登记' : '风险上报已驳回'); } catch (error) { handleApiError(error); } });
}

document.addEventListener('click', async event => { const review = event.target.closest('[data-review-risk-report]'); if (!review) return; if (!['sustainability','admin'].includes(state.user?.role)) return showToast('当前账户没有风险审核权限', 'error'); const row = review.closest('[data-risk-report-row]'); const reviewer = row?.querySelector('[data-risk-reviewer]')?.value || ''; if (!reviewer) return showToast('请先选择复核人，再处理风险上报', 'error'); openRiskReviewModal(review.dataset.reviewRiskReport, review.dataset.reviewStatus, reviewer); });
document.addEventListener('click', async event => { const saveButton = event.target.closest('[data-save-user]'); if (!saveButton || saveButton.disabled) return; const row = saveButton.closest('[data-user-row]'); const username = row?.dataset.userRow; if (!username || !requireRole(['admin'])) return; const role = row.querySelector('[data-user-role]')?.value; const active = row.querySelector('[data-user-active]')?.checked; const reviewed = row.querySelector('[data-user-review]')?.checked; saveButton.disabled = true; try { const payload = await apiRequest(`/api/users/${encodeURIComponent(username)}`, { method: 'PATCH', body: JSON.stringify({ role, active, reviewed }) }); const index = state.users.findIndex(account => account.username === username); if (index >= 0) state.users[index] = payload.user; await Promise.all([loadAssignees(), loadDashboard(), loadAudit()]); renderUsers(); showToast(`${payload.user.displayName} 的账户目录状态已保存`); } catch (error) { handleApiError(error); saveButton.disabled = false; } });
document.addEventListener('click', async event => { const saveButton = event.target.closest('[data-access-save]'); if (!saveButton) return; const row = saveButton.closest('[data-access-row]'); const username = row?.dataset.accessRow; if (!username || !requireRole(['admin'])) return; saveButton.disabled = true; try { const reviewed = row.querySelector('[data-access-reviewed]')?.checked; await apiRequest(`/api/users/${encodeURIComponent(username)}`, { method: 'PATCH', body: JSON.stringify({ reviewed }) }); await Promise.all([loadUsers(), loadDashboard(), loadAudit()]); closeModal(); openAccessReview(); showToast('权限复核状态已保存'); } catch (error) { handleApiError(error); saveButton.disabled = false; } });
document.addEventListener('click', async event => { const refresh = event.target.closest('[data-access-refresh]'); if (!refresh) return; try { await loadUsers(); closeModal(); openAccessReview(); } catch (error) { handleApiError(error); } });
document.addEventListener('click', event => { const evidence = event.target.closest('[data-evidence-id]'); if (evidence) openInterviewEvidenceModal(evidence.dataset.evidenceId); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && modalRoot.getAttribute('aria-hidden') === 'false') closeModal(); });

bootstrap();
