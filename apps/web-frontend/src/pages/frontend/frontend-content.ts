export const frontendNavItems = [
  { label: '项目首页', to: '/', eyebrow: 'Overview' },
  { label: '系统架构', to: '/architecture', eyebrow: 'Architecture' },
  { label: '认证策略', to: '/authentication', eyebrow: 'Identity' },
] as const;

export const projectSignals = [
  { label: '登录方式', value: '3', note: '用户名密码、邮箱验证码、手机号验证码' },
  { label: '客户端', value: '2', note: 'Web 控制台与 Uni 微信小程序接入位点' },
  { label: '审计字段', value: '6', note: 'id / createId / updateId / createAt / updateAt / deleteAt' },
  { label: '核心目标', value: 'RBAC', note: '权限、菜单、角色、认证统一到一套控制台里' },
] as const;

export const capabilityCards = [
  {
    title: '动态控制台',
    eyebrow: 'Console Namespace',
    description: '控制台页面不再直接占据根路径，而是统一挂到 /console 下，通过菜单树动态注入实际业务页面。',
    bullets: ['保留运行时菜单装配能力', '菜单、面包屑、标签页继续基于同一套元数据工作'],
  },
  {
    title: '策略认证',
    eyebrow: 'Authentication Strategy',
    description: '登录、注册、验证码发送与校验不再写死在前端表单里，而是完全受后端策略配置驱动。',
    bullets: ['前端先读取启用策略，再决定渲染哪些表单片段', '支持 Mock 形态联调，不阻塞前后端并行开发'],
  },
  {
    title: '生产级审计',
    eyebrow: 'Reliability',
    description: 'ORM 与业务层统一审计字段与软删除语义，删除操作映射为 deleteAt 更新，保证可回溯性。',
    bullets: ['雪花 id 统一主键生成策略', 'create / update / delete 行为天然具备追踪上下文'],
  },
] as const;

export const consoleHighlights = [
  {
    title: '菜单与页面双向映射',
    description: '菜单结构管理页负责节点、路径、权限绑定；前端根据 viewKey 注册真实页面组件。',
  },
  {
    title: '角色与权限矩阵',
    description: '角色、权限、用户列表都已拆成统一页面规范，支持搜索表单、列表、详情与编辑抽离。',
  },
  {
    title: '前端权限指令',
    description: '通过 v-permission 和 v-role 在展示层隐藏无权限操作，同时保留后端鉴权的最终裁决。',
  },
] as const;

export const architectureLayers = [
  {
    title: 'Public Frontend',
    summary: '默认 / 命名空间用于说明系统能力、接入模式、认证思路，并承接控制台入口。',
    details: ['公共 Header / Footer 统一在布局层处理', '介绍页切换不依赖登录状态即可访问'],
  },
  {
    title: 'Console Workbench',
    summary: '控制台所有业务页面移动到 console 域，实际路由统一投放到 /console/** 下。',
    details: ['动态菜单决定可访问页面', 'Breadcrumb、Tabs、主题与布局偏好继续生效'],
  },
  {
    title: 'Auth & Client Strategy',
    summary: '客户端 secret、认证策略、验证码记录、mock 能力全部由后端策略模式承载。',
    details: ['前端只消费可用策略配置', '登录后可区分来自哪个 client'],
  },
  {
    title: 'Audit & Soft Delete',
    summary: '数据层标准化审计字段和逻辑删除，保证操作可追踪、可恢复、可审计。',
    details: ['delete 映射为 deleteAt 更新', '实体字段规范更利于后续扩展与治理'],
  },
] as const;

export const operatingPrinciples = [
  '公共前台负责介绍、引导与信任建立，避免用户一进站点就落到后台壳子里。',
  '控制台路由集中在 /console，避免和面向用户的页面语义混杂。',
  '业务页面继续维持页面组件只做 orchestration、细节下沉到 components 的规范。',
  '权限、菜单、认证、审计几块都围绕“后端定义，前端消费”的原则收拢。',
] as const;

export const authStrategies = [
  {
    title: '用户名密码',
    code: 'username-password',
    identifier: 'USERNAME',
    credential: 'PASSWORD',
    description: '适合管理员、内部运营等固定身份体系，登录路径直接、认知成本最低。',
  },
  {
    title: '邮箱验证码',
    code: 'email-code',
    identifier: 'EMAIL',
    credential: 'VERIFICATION_CODE',
    description: '更适合中后台外部协作者、邀请制接入或需要弱密码依赖的场景。',
  },
  {
    title: '手机验证码',
    code: 'phone-code',
    identifier: 'PHONE',
    credential: 'VERIFICATION_CODE',
    description: '适合移动端触达链路，后续可自然延伸到小程序和短信场景。',
  },
] as const;

export const authJourney = [
  {
    title: '读取后端启用策略',
    body: '登录页加载时先拿到策略集合，前端据此渲染登录、注册、验证码相关组件，不再把流程写死。',
  },
  {
    title: '按策略发送验证码',
    body: '发送验证码接口只关心 strategyCode、identifier、purpose，底层实现由后端策略类决定。',
  },
  {
    title: '校验凭据并返回 token',
    body: '密码或验证码都统一映射到认证记录与认证策略，校验通过后返回带 client 语义的 token。',
  },
  {
    title: '前端按角色和权限裁剪 UI',
    body: '进入控制台后，用户角色和权限列表用于驱动导航、按钮、右键菜单和展示层指令。',
  },
] as const;
