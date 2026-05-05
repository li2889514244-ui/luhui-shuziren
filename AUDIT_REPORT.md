# 🔍 网站深度审计报告

**项目**: 心理学博士卢慧 AI 智能体
**审计日期**: 2026-05-05
**文件**: `index.html`, `login.html`, `config.js`, `styles.css`

---

## 执行摘要

- 🔴 严重问题: **5 个**
- 🟡 中等问题: **10 个**
- 🟢 轻微问题: **8 个**
- 💡 改进建议: **7 个**

---

## 🔴 严重问题

### [S1] 默认 API Key 硬编码在前端代码中
- **文件**: `index.html`
- **行号**: ~2580 (IIFE 中 `defaultKey` 变量)
- **描述**: 当用户首次访问时，代码自动填入默认 API Key `sk-izjuVYtpXRz9tK9oJUz8jm9AJpJCXIA3Qn3ZKkdIjQe6NUQK` 并加密保存到 localStorage。虽然做了加密，但 Key 本身以明文形式存在于前端 JS 中，任何查看源码的人都能获取。
- **影响**: API Key 泄露 → 他人盗用你的 API 额度 → 产生意外费用。如果 Key 有写权限，还可能被滥用。
- **修复建议**: 移除硬编码的默认 Key。改为首次访问时显示配置引导，让用户自行填入 Key。如果必须提供默认 Key，应通过后端代理转发请求，不在前端暴露。

### [S2] 客户端密码哈希暴露
- **文件**: `config.js`
- **行号**: 2
- **描述**: `passwordHash` 是密码的 SHA-256 哈希值，直接暴露在前端 JS 中。SHA-256 是快速哈希，攻击者可以用彩虹表或暴力破解在短时间内还原密码。
- **影响**: 登录形同虚设。攻击者可以离线破解密码后直接访问应用。
- **修复建议**: (1) 将认证移到后端，使用 bcrypt/scrypt/argon2 等慢哈希；(2) 如果必须前端验证，至少加 salt 并增加迭代次数（PBKDF2）；(3) 添加登录失败次数限制。

### [S3] innerHTML 使用存在 XSS 风险
- **文件**: `index.html`
- **行号**: 多处（`addMessage`, `renderHistory`, `renderTopics`, `renderConcepts`, `renderPhrases`, `renderScripts`, `showExportMenu` 等）
- **描述**: 多个函数使用 `innerHTML` 拼接内容。虽然 `addMessage` 的用户消息路径调用了 `escapeHtml`，但以下路径存在风险：
  - `addMessage('assistant', content, false)` — 当 `streaming=false` 时，`content` 直接经 `escapeHtml` 后插入 `innerHTML`，这是安全的
  - `addMessage('user', content)` — 用户消息经 `escapeHtml` 处理，安全
  - **但** `renderHistory()` 中 `h.content` 来自 localStorage，如果 localStorage 被篡改（XSS 或恶意扩展），可注入 HTML
  - `openScript(title)` 中 `script.content` 使用 `textContent`，安全
  - 动态生成的 `onclick` 属性中包含用户数据（如 `quickAsk('生成一个${t.name}的脚本')`），如果 `t.name` 包含引号可导致注入
- **影响**: 潜在的存储型 XSS。攻击者可通过篡改 localStorage 或构造特殊话题名注入恶意脚本。
- **修复建议**: (1) 所有动态内容一律使用 `textContent` 或 `createElement` + `textContent`；(2) 如必须用 innerHTML，确保所有变量经过 `escapeHtml`；(3) 添加 CSP `script-src` 策略禁止 inline 脚本。

### [S4] 无 Content Security Policy (CSP)
- **文件**: `index.html`, `login.html`
- **行号**: `<head>` 区域
- **描述**: 没有设置 CSP meta 标签或 HTTP 头。页面使用了大量 inline `<script>` 和 inline `style`，以及 `onclick` 等 inline 事件处理器。
- **影响**: 一旦发生 XSS 注入，攻击者可以执行任意 JavaScript、加载外部脚本、窃取数据。没有 CSP 意味着浏览器无法阻止注入的脚本执行。
- **修复建议**: (1) 添加 CSP meta 标签，至少设置 `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.bltcy.ai; frame-ancestors 'none'`；(2) 长期目标：将 JS/CSS 外部化，移除 `unsafe-inline`。

### [S5] 无点击劫持保护
- **文件**: `index.html`, `login.html`
- **行号**: `<head>` 区域
- **描述**: 没有 `X-Frame-Options` 头或 `frame-ancestors` CSP 指令。页面可以被嵌入任意 iframe 中。
- **影响**: 攻击者可以将页面嵌入恶意网站的 iframe 中，诱导用户点击（点击劫持），可能泄露 API Key 或执行操作。
- **修复建议**: 添加 `<meta http-equiv="X-Frame-Options" content="DENY">` 或在 CSP 中添加 `frame-ancestors 'none'`。对于需要嵌入的场景使用 `sameorigin`。

---

## 🟡 中等问题

### [M1] 外部 CSS 文件冗余未使用
- **文件**: `styles.css` vs `index.html` 内联 `<style>`
- **描述**: `styles.css` 文件存在但 HTML 中所有 CSS 都以内联 `<style>` 标签形式存在。外部文件是内联样式的副本但不完整（缺少部分 keyframes 等），从未被 `<link>` 引用。
- **影响**: 代码维护混乱。修改 CSS 时容易遗漏同步，导致不一致。
- **修复建议**: 删除 `styles.css` 或将其作为唯一的 CSS 来源通过 `<link>` 引用。

### [M2] 巨大的单文件架构
- **文件**: `index.html`
- **描述**: 所有 HTML + CSS + JavaScript（约 2800+ 行）都在一个文件中。`CASES_DNA` 数据对象非常庞大（数百个案例对象），与业务逻辑混合在一起。
- **影响**: (1) 首次加载必须下载全部内容，影响 FCP/LCP；(2) 难以维护和调试；(3) 浏览器解析阻塞时间长。
- **修复建议**: (1) 将 CSS 外部化；(2) 将 JS 模块化（数据层、业务逻辑层、UI 层分离）；(3) `CASES_DNA` 等大数据考虑按需加载或压缩。

### [M3] localStorage 无配额管理的持久增长
- **文件**: `index.html`
- **行号**: `saveHistory`, `addToHistory` 函数
- **描述**: 历史记录存储在 localStorage 中，虽然有截断到 50 条的逻辑和 `QuotaExceededError` 处理，但每条记录包含完整的生成内容（可达数千字），50 条可能占用数 MB。
- **影响**: localStorage 通常限制 5-10MB。大量长文本记录可能快速耗尽配额，影响其他功能（API Key 存储、配置等）。
- **修复建议**: (1) 限制每条记录的存储长度（如只存前 500 字 + 全文 hash）；(2) 添加总大小监控；(3) 考虑使用 IndexedDB 替代。

### [M4] 无离线/错误状态的 Service Worker
- **文件**: 项目整体
- **描述**: 没有 Service Worker 或离线处理。当网络不稳定时，API 请求直接失败，用户看到错误消息但无法重试或使用离线功能。
- **影响**: 网络差时用户体验差，可能丢失正在生成的内容。
- **修复建议**: (1) 添加请求重试机制（已有 2 次重试，可增加指数退避）；(2) 考虑添加 Service Worker 缓存静态资源；(3) 为生成中的内容添加本地暂存。

### [M5] 流式响应中断时内容丢失风险
- **文件**: `index.html`
- **行号**: `sendMessage` 函数中 `catch` 块
- **描述**: 当 SSE 流式传输因网络中断（非用户主动停止）而失败时，如果 `partialContent` 为空，气泡会被 `destroy()` 移除，用户看到的是空白或错误消息，已等待的时间白费。
- **影响**: 用户体验差，可能需要重新生成。
- **修复建议**: 即使 `partialContent` 为空，也显示一个有意义的错误提示并保留重试按钮。考虑在 localStorage 中暂存部分生成内容。

### [M6] 缺少 `<noscript>` 回退
- **文件**: `index.html`
- **描述**: 整个应用完全依赖 JavaScript，但没有 `<noscript>` 标签提供回退提示。
- **影响**: JS 被禁用或加载失败时，用户看到空白页面。
- **修复建议**: 在 `<body>` 开头添加 `<noscript><div style="...">请启用 JavaScript 以使用此应用</div></noscript>`。

### [M7] 对比度不足的辅助文本
- **文件**: `index.html` (CSS 变量)
- **行号**: `:root` 变量定义区域
- **描述**: 多个文本颜色对比度不足：
  - `--text-secondary: rgba(232,232,240,.55)` 在 `#06060f` 背景上对比度约 3.8:1（WCAG AA 需 4.5:1）
  - `--text-tertiary: rgba(232,232,240,.45)` 对比度约 3.1:1
  - `--text-dim: rgba(232,232,240,.18)` 对比度约 1.4:1（几乎不可见）
- **影响**: 低视力用户难以阅读辅助文本、标签、提示信息。
- **修复建议**: 提高不透明度。`--text-secondary` 至少 `.65`，`--text-tertiary` 至少 `.55`，`--text-dim` 至少 `.35`。

### [M8] 键盘导航不完整
- **文件**: `index.html`
- **描述**: (1) 欢迎页面的提示按钮（`.welcome-hint`）和话题标签（`.welcome-topic-pill`）使用 `<button>` 但缺少 `type="button"`，在 `<form>` 内可能触发表单提交；(2) 侧边栏话题网格（`.topic-chip`）使用 `<div>` + `onclick`，键盘用户无法聚焦；(3) 语料库的短语项（`.phrase-item`）使用 `<div>` + `onclick`，同样不可聚焦。
- **影响**: 键盘和辅助技术用户无法完整使用应用。
- **修复建议**: (1) 将可交互的 `<div>` 改为 `<button>` 或添加 `tabindex="0"` + `role="button"` + `keydown` 处理；(2) 确保所有交互元素可通过 Tab 到达。

### [M9] 事件监听器未清理
- **文件**: `index.html`
- **行号**: `initSwipeToClose`, `_apiBarOutsideHandler`, `_modalKeyHandler` 等
- **描述**: 部分事件监听器在条件满足时添加但清理不够彻底：
  - `initSwipeToClose` 的 touch 事件在 `touchend` 时移除，但如果用户从未 touchend（如切走页面），监听器会残留
  - `_apiBarOutsideHandler` 通过 `document.addEventListener('click', ...)` 添加，在某些路径下可能未移除
  - 每次打开模态框都添加 `_modalKeyHandler`，虽然关闭时移除，但如果多次快速开关可能叠加
- **影响**: 内存泄漏、事件处理器叠加导致行为异常。
- **修复建议**: 使用 AbortController 统一管理事件监听器的生命周期。

### [M10] 缺少 `robots.txt` 和 `sitemap.xml`
- **文件**: 项目整体
- **描述**: 虽然 HTML 中有 `<meta name="robots">` 标签，但没有 `robots.txt` 文件。canonical URL 指向 `luchai.example.com`（不存在的域名）。
- **影响**: SEO 效果差，搜索引擎可能无法正确索引。
- **修复建议**: (1) 更新 canonical URL 为实际域名；(2) 添加 `robots.txt`；(3) 考虑添加 `sitemap.xml`。

---

## 🟢 轻微问题

### [L1] 重复的 `theme-color` meta 标签
- **文件**: `index.html`
- **行号**: 第 7 行和第 15-16 行
- **描述**: `<meta name="theme-color" content="#06060f">` 和后续的带 `media` 查询的版本重复。第一个没有 `media` 属性会被后面的覆盖。
- **修复建议**: 删除第 7 行的无条件版本，保留带 `media` 查询的版本。

### [L2] 重复的 `apple-mobile-web-app-status-bar-style`
- **文件**: `index.html`
- **行号**: 第 8 行和第 20 行
- **描述**: 同一个 meta 标签出现两次。
- **修复建议**: 删除其中一个。

### [L3] `maximum-scale=1` 阻止缩放
- **文件**: `index.html`, `login.html`
- **行号**: viewport meta 标签
- **描述**: `maximum-scale=1` 阻止用户缩放页面，违反 WCAG 2.1 AA 标准（1.4.4 Resize Text）。
- **影响**: 低视力用户无法放大页面查看内容。
- **修复建议**: 移除 `maximum-scale=1`，保留 `user-scalable=yes`（默认值）。

### [L4] `will-change` 过度使用
- **文件**: `index.html` (CSS)
- **行号**: 多个选择器中的 `will-change: transform`
- **描述**: 对大量交互元素设置了 `will-change: transform`，包括所有 chip、pill、button 等。这会为每个元素创建独立的合成层，消耗 GPU 内存。
- **修复建议**: 仅在动画即将开始时动态添加 `will-change`，动画结束后移除。或使用 CSS `@media (hover: hover)` 仅在支持 hover 的设备上启用。

### [L5] `prefers-reduced-motion` 不完整
- **文件**: `index.html` (CSS)
- **描述**: `prefers-reduced-motion: reduce` 媒体查询覆盖了主要动画，但部分 CSS 动画（如 `btnHoverIn`, `chipPress`）在 `!important` 的 `transition` 规则下仍会生效。JS 中的 typewriter 效果也没有检查此偏好。
- **修复建议**: (1) 在 `prefers-reduced-motion` 中禁用所有 transform transition；(2) JS 中检查 `window.matchMedia('(prefers-reduced-motion: reduce)')` 并跳过打字机效果。

### [L6] `escapeHtml` 不处理引号和反斜杠
- **文件**: `index.html`
- **行号**: `escapeHtml` 函数
- **描述**: 函数只转义 `&`, `<`, `>` 和换行符，不转义 `"` 和 `'`。当输出被用在 HTML 属性中（如 `onclick="...('${t.name}')"`）时可能导致属性注入。
- **修复建议**: 添加 `'` → `&#39;` 和 `"` → `&quot;` 的转义。

### [L7] 模态框焦点陷阱不处理 `aria-hidden`
- **文件**: `index.html`
- **行号**: `openScript` / `closeModal`
- **描述**: 模态框打开时没有设置 `aria-hidden="true"` 在主内容区域，也没有 `role="dialog"` 和 `aria-modal="true"` 在模态框上。
- **影响**: 辅助技术用户可能同时感知到模态框和背后的内容。
- **修复建议**: 模态框添加 `role="dialog"` 和 `aria-modal="true"`；打开时给 `.app` 添加 `aria-hidden="true"`。

### [L8] `JSON-LD` 中 `alumniOf` 结构不完整
- **文件**: `index.html`
- **行号**: JSON-LD 第一个 script 块
- **描述**: `"alumniOf": {"@type": "CollegeOrUniversity", "name": "心理学博士"}` — `name` 应该是学校名称而非学位。学位应放在 `Person` 的 `hasCredential` 中。
- **修复建议**: 修正为实际学校名称，或移除此字段。

---

## 💡 改进建议

### [I1] 添加 PWA 支持
- 添加 `manifest.json` 支持安装到主屏幕
- 添加 Service Worker 缓存静态资源
- 这对移动端用户体验（尤其是反复访问的用户）有显著提升

### [I2] 实现生成内容的本地缓存
- 将正在生成的内容实时保存到 sessionStorage
- 页面刷新或意外关闭后可恢复
- 避免用户等待数分钟后因意外丢失结果

### [I3] 优化大数据加载
- `CASES_DNA` 对象包含数十个案例，每个案例有多个字段，总数据量可能超过 100KB
- 考虑：(1) 按需加载案例（只加载当前话题相关的）；(2) 使用 LZ 压缩；(3) 存储在 IndexedDB 中

### [I4] 添加字数控制的客户端验证
- 当前字数控制依赖 LLM 的 `max_tokens` 参数，但实际输出字数不可控
- 可以在客户端检测生成内容长度，如果超出目标范围，在下一轮对话中自动调整提示

### [I5] 改进错误恢复 UX
- API 失败时提供"重试"按钮而非仅显示错误消息
- 为常见错误（401, 429）提供具体的修复引导
- 添加"复制错误详情"按钮方便用户反馈

### [I6] 添加国际化支持准备
- 当前所有文案硬编码在 JS 中
- 建议提取为常量对象，为未来 i18n 做准备
- 特别是错误消息和 UI 标签

### [I7] 性能监控
- 添加 `PerformanceObserver` 监控 LCP, FID, CLS
- 对 API 响应时间做统计
- 这有助于发现真实用户的性能瓶颈

---

## 📊 问题分布

| 类别 | 严重 | 中等 | 轻微 | 建议 |
|------|------|------|------|------|
| 安全 | 4 | 0 | 1 | 0 |
| HTML | 0 | 2 | 3 | 0 |
| CSS | 0 | 1 | 2 | 0 |
| JavaScript | 1 | 3 | 1 | 3 |
| 性能 | 0 | 2 | 1 | 3 |
| UX/可访问性 | 0 | 2 | 1 | 1 |

---

## ✅ 做得好的地方

1. **响应式设计非常完善** — 从 320px 到桌面端都有适配，包括横屏、刘海屏、虚拟键盘弹出等场景
2. **暗色主题的 `prefers-reduced-motion` 支持** — 主要动画都有降级处理
3. **触摸目标尺寸** — 使用 `@media (pointer: coarse)` 确保 44px 最小触摸目标
4. **SSE 流式传输实现** — 使用 `ReadableStream` + `AbortController` 实现了可中断的流式输出
5. **API Key 加密存储** — 使用 Web Crypto API (PBKDF2 + AES-GCM) 加密存储，比明文 localStorage 好很多
6. **JSON-LD 结构化数据** — 提供了 Person 和 WebApplication 两种 schema
7. **移动端侧边栏手势** — 实现了滑动关闭手势
8. **虚拟键盘适配** — 使用 `visualViewport` API 处理 iOS 键盘弹出问题

---

*审计完成。建议优先处理 S1（硬编码 API Key）和 S3（XSS 风险），这两个问题最有可能导致实际安全事件。*
