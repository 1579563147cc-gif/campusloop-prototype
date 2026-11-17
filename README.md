# CampusLoop campus circularity operations prototype

This is the local full-stack prototype for the BUS4093 RFP proposal. The interface is presented in English, while the Node API persists resources, work orders, risks, audit records and interview evidence in `data/store.json`.

- 总览与循环量趋势；
- 资源发布、搜索、分类筛选和预约领取；
- 设施工单看板与清运路线；
- 影响仪表板与资源构成；
- 数据治理、权限复核和风险登记表；
- 离线队列同步提示。
- 资源发布：`POST /api/items`；
- 资源生命周期：学生发布、人工审核、预约领取、自动生成交接工单、维修认领、完成再利用和动态指标计算；
- 交接安排：设施运营可在交接工单中修改领取地点与时间，资源详情会同步更新；
- 工单创建和状态推进：`POST/PATCH /api/work-orders`；
- 工单负责人目录和实时状态刷新：`GET /api/work-order-assignees`、页面每 15 秒轮询 `GET /api/work-orders`；
- 风险复核人目录与分配：`GET /api/risk-reviewers`、`PATCH /api/risk-reports/:id/assign`；
- 风险登记：`POST /api/risks`；
- 风险状态与缓解措施更新：`PATCH /api/risks/:id`；
- 研究证据录入：`GET/POST /api/evidence`；
- 访谈证据：`GET /api/interviews` returns the permanently stored English translation of the supplied student interview record, including 12 questions, three anonymised respondents, source status and design implications;
- 账户目录和权限修改：`GET /api/users`、`PATCH /api/users/:username`（仅系统管理员）；
- 审计日志读取：`GET /api/audit`，前端支持 CSV 导出；
- 离线队列同步：`POST /api/sync`。
- Offline sync keeps queued records when a request fails and only redirects to sign-in for a confirmed expired session; permission or network failures do not silently discard the queue;
- Student facilities requests receive a server-generated persistent ID such as `WO-2042`, which is reused in the student progress view, operator queue, notifications and audit log;
- Risk levels are calculated from probability × impact: 1–4 Low, 5–9 Medium, 10–16 High, 17–25 Critical;
- 角色切换：学生、设施运营、可持续管理员、系统管理员；
- 登录与服务端角色权限：未登录返回 401，无权限操作返回 403；
- 人工审核队列：设施运营和系统管理员可以审核待发布资源；
- 工单负责人：运营人员可以分配负责人，负责人或管理员可以推进状态；
- 学生上报进度：学生只能读取自己提交的设施问题和风险上报，并查看后端状态时间线；
- 仪表盘指标：资源趋势、材料构成、地点贡献、试点健康度和 KPI 目标值由后端数据计算；
- 工单 SLA：开放、逾期、平均处理时长、处理备注和现场证据均可追踪；
- 风险审核意见：复核人、审核意见、打回原因和补充证据会写入状态时间线；
- 学生通知：学生只接收与自己工单和风险上报有关的状态更新；
- 学生服务评价：完成设施工单后，提交人可以记录 1–5 分满意度和文字反馈；
- 通知已读状态：按登录账户记录已查看通知，新状态变化才会重新显示红点；
- RFP 追踪：实施页包含需求—功能—指标—证据矩阵和三年总拥有成本；
- 操作审计：登录、资源审核、资源预约、工单分配和风险登记写入审计日志；
- 系统管理员账户目录：可持久化调整角色和启停状态，停用账户无法继续登录，并保留权限变更审计；
- 资源和工单生命周期审计时间线；
- 模拟离线模式：写入操作先进入浏览器离线队列，恢复后统一同步；
- 实施路线、预算边界、系统集成和研究证据页面。

## 本地预览

在该目录启动后端：

```powershell
node server.js
```

然后打开 `http://localhost:4173/`。

The numbers, items, work orders and impact indicators are demonstration data and must not be presented as real campus operating results. The interview transcript is primary project evidence, and interview consent has been confirmed.

The dashboard seeds five completed example resources with illustrative weights. The reuse rate is the count of completed reuse records divided by active, non-rejected resources in this demonstration dataset. The seven-day bars count completed resources by their completion date; the impact line totals their recorded example weights by day. The total weight includes only completed resources with a numeric weight, and is not evidence of actual waste or landfill diversion. These prototype measures illustrate the report's proposed pilot KPIs and require real cohort definitions, handover verification and weight evidence for production.

Student rewards are a private demonstration: an eligible student posting or claiming a resource receives 10 points once the operator confirms completed reuse, with a 100-point UTC calendar-month cap. An item is counted once per student; demo items and activity completed before this feature are excluded. `/api/rewards/me` returns only the signed-in student's ledger and balance; non-student accounts are denied. Badges are display milestones, not redeemable benefits. The demo reset clears the reward ledger along with other demo data.

如果直接打开本地 `index.html`，只要 `node server.js` 正在运行，页面也会自动把 API 请求发送到 `http://localhost:4173`。

## 本地演示账户

| 角色 | 用户名 | 密码 |
|---|---|---|
| 学生用户 | `student` | `student123` |
| 设施运营 | `operator` | `operator123` |
| 设施运营（Jordan Chen） | `operator_jc` | `operator123` |
| 设施运营（Ava Kim） | `operator_ak` | `operator123` |
| 可持续管理员 | `sustainability` | `sustain123` |
| 系统管理员 | `admin` | `admin123` |

## GitHub 部署边界

本仓库已经托管完整源码和模拟数据。GitHub 仓库或 GitHub Pages 可以托管静态文件，但不会运行 `server.js`，也不会持久化 `data/store.json` 的写入。因此，要在线保留这些交互，需要另外部署 Node 后端和持久化数据库；当前仓库适合作为课程演示源码和本地可运行版本。
