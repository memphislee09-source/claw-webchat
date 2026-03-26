import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { groupMessageBlocksForRender, parseTextIntoBlocks } from '../public/message-blocks.js';

const execFileAsync = promisify(execFile);
const base = process.env.OPENCLAW_WEBCHAT_BASE || 'http://127.0.0.1:3770';
const openclawBin = process.env.OPENCLAW_BIN || 'openclaw';
const agentId = process.env.OPENCLAW_WEBCHAT_TEST_AGENT || 'mira';
const sessionKey = `openclaw-webchat:${agentId}`;
const requestTimeoutMs = Number(process.env.OPENCLAW_WEBCHAT_SELFTEST_REQUEST_TIMEOUT_MS || 150000);
const defaultBindingsFile = fileURLToPath(new URL('../data/session-bindings.json', import.meta.url));
const defaultProfilesFile = fileURLToPath(new URL('../data/agent-profiles.json', import.meta.url));
const defaultServerFile = fileURLToPath(new URL('../src/server.js', import.meta.url));
const defaultAppFile = fileURLToPath(new URL('../public/app.js', import.meta.url));
const bindingsFile = process.env.OPENCLAW_WEBCHAT_DATA_DIR
  ? path.join(path.resolve(process.env.OPENCLAW_WEBCHAT_DATA_DIR), 'session-bindings.json')
  : defaultBindingsFile;
const profilesFile = process.env.OPENCLAW_WEBCHAT_DATA_DIR
  ? path.join(path.resolve(process.env.OPENCLAW_WEBCHAT_DATA_DIR), 'agent-profiles.json')
  : defaultProfilesFile;
const uploadsDir = path.join(path.dirname(bindingsFile), 'uploads');

const unique = `selftest-${Date.now()}`;

await checkHealth();
await checkAuthStatus();
await checkCommandsCatalog();
await checkPageShell();
await checkBootstrapContract();
await checkMixedMediaParsing();
await checkSettings();
await checkAgents();
await checkAgentProfile();
await checkOpenAgent();
await checkStopEndpoint();
await checkSessionVoiceApi();
await checkSlashCommands();
await checkUpload();
await checkAudioUpload();
await checkFileUpload();
await checkUpstreamAttachmentMaterialization();
await checkSend();
await checkReset();
await checkHistory();
await checkHistorySearch();

console.log('SELFTEST_OK');

async function checkHealth() {
  const health = await getJson('/healthz');
  assert(health?.ok === true, 'healthz should return ok=true');
}

async function checkAuthStatus() {
  const payload = await getJson('/api/openclaw-webchat/auth/status');
  assert(typeof payload?.enabled === 'boolean', 'auth status should expose enabled flag');
  assert(typeof payload?.authenticated === 'boolean', 'auth status should expose authenticated flag');
}

async function checkPageShell() {
  const html = await getText('/');
  assert(html.includes('id="agentList"'), 'page should contain agentList');
  assert(html.includes('id="messageList"'), 'page should contain messageList');
  assert(html.includes('id="composerInput"'), 'page should contain composerInput');
  assert(html.includes('slash 命令可执行本地命令'), 'page should reflect slash command composer hint');
  assert(html.includes('id="attachButton"'), 'page should contain attachButton');
  assert(html.includes('id="mediaUploadInput"'), 'page should contain mediaUploadInput');
  assert(html.includes('id="newContextButton"'), 'page should contain slash trigger button');
  assert(html.includes('id="commandMenu"'), 'page should contain command menu');
  assert(html.includes('id="thinkingButton"'), 'page should contain thinking trigger button');
  assert(html.includes('id="thinkingMenu"'), 'page should contain thinking options menu');
  assert(html.includes('class="primary-button send-button"'), 'page should contain icon-style send button');
  assert(html.includes('id="historySearchShell"'), 'page should contain persistent history search shell');
  assert(html.includes('id="historySearchPanel"'), 'page should contain history search panel');
  assert(html.includes('id="historySearchInput"'), 'page should contain history search input');
  assert(html.includes('id="historySearchFromInput"'), 'page should contain history search start date input');
  assert(html.includes('id="historySearchToInput"'), 'page should contain history search end date input');
  assert(html.includes('id="historySearchLimitSelect"'), 'page should contain history search limit select');
  assert(html.includes('id="historySearchResults"'), 'page should contain history search results container');
  assert(html.includes('id="modelPicker"'), 'page should contain model picker modal');
  assert(html.includes('id="modelPickerCurrent"'), 'page should contain current model summary');
  assert(html.includes('id="modelPickerList"'), 'page should contain model picker list');
  assert(html.includes('id="settingsPanel"'), 'page should contain settingsPanel');
  assert(html.includes('id="settingsContactSelect"'), 'page should contain settingsContactSelect');
  assert(html.includes('id="saveSettingsButton"'), 'page should contain saveSettingsButton');
  assert(html.includes('id="settingsPreferencesSection"'), 'page should contain settingsPreferencesSection');
  assert(html.includes('id="settingsThemePresetButtons"'), 'page should contain theme preset selector');
  assert(html.includes('id="settingsThemeDarkButton"'), 'page should contain dark theme button');
  assert(html.includes('id="settingsThemePaperButton"'), 'page should contain paper theme button');
  assert(html.includes('id="settingsThemeGrayButton"'), 'page should contain gray theme button');
  assert(html.includes('id="settingsThemeLinenButton"'), 'page should contain linen theme button');
  assert(html.includes('id="settingsThemeMistButton"'), 'page should contain mist theme button');
  assert(html.includes('id="settingsThemeSandButton"'), 'page should contain sand theme button');
  assert(html.includes('id="mediaViewer"'), 'page should contain mediaViewer');
  assert(html.includes('id="mediaViewerImage"'), 'page should contain mediaViewerImage');

  const appJs = await getText('/static/app.js');
  const css = await getText('/static/styles.css');
  assert(appJs.includes('HISTORY_SEARCH_RECENTS_STORAGE_KEY'), 'app.js should include history search recent storage key');
  assert(appJs.includes('function createHistorySearchRecentItem'), 'app.js should include history search recent item rendering');
  assert(appJs.includes('function highlightSearchTextInElement'), 'app.js should include history search text highlight helper');
  assert(appJs.includes('function handleHistorySearchFocus'), 'app.js should include history search focus handler');
  assert(appJs.includes('function handleGlobalDocumentClick'), 'app.js should include outside click collapse handler');
  assert(appJs.includes('async function openAgent'), 'app.js should include openAgent');
  assert(appJs.includes('async function ensurePendingUploadsReady'), 'app.js should include image upload flow');
  assert(appJs.includes('async function saveSettingsContact'), 'app.js should include unified visual contact settings');
  assert(appJs.includes('async function cropAvatarToSquare'), 'app.js should include avatar crop flow');
  assert(appJs.includes('function openMediaViewer'), 'app.js should include image viewer flow');
  assert(appJs.includes('async function loadCommandCatalog'), 'app.js should include slash command catalog loading');
  assert(appJs.includes('function applyThemeChoice'), 'app.js should include theme choice application');
  assert(appJs.includes('function persistThemeChoice'), 'app.js should include theme choice persistence');
  assert(appJs.includes('const THEME_PRESETS = {'), 'app.js should include theme preset catalog');
  assert(appJs.includes('function renderCommandMenu'), 'app.js should include slash command menu rendering');
  assert(appJs.includes('async function executeSlashCommand'), 'app.js should include slash command execution');
  assert(appJs.includes('async function openModelPicker'), 'app.js should include model picker loader');
  assert(appJs.includes('const MODEL_PICKER_CACHE_TTL_MS = 15000;'), 'app.js should include a short-lived model picker cache TTL');
  assert(appJs.includes('async function refreshModelPickerState'), 'app.js should include reusable model picker refresh logic');
  assert(appJs.includes('function shouldRefreshModelStateForCommand(command)'), 'app.js should refresh model picker state after model/session slash commands');
  assert(appJs.includes('async function switchSessionModel'), 'app.js should include model switch handler');
  assert(appJs.includes('async function stopActiveSessionReply'), 'app.js should include current reply stop handler');
  assert(appJs.includes('async function openThinkingMenu'), 'app.js should include thinking picker loader');
  assert(appJs.includes('async function switchSessionThinkingLevel'), 'app.js should include thinking switch handler');
  assert(appJs.includes('function getThinkingButtonLabel()'), 'app.js should include dynamic thinking button label helper');
  assert(appJs.includes("thinkingButtonEl.textContent = getThinkingButtonLabel();"), 'app.js should render the current thinking level on the composer button');
  assert(appJs.includes('function renderSendButtonState'), 'app.js should include send/stop button state renderer');
  assert(appJs.includes('function attachVideoPreview'), 'app.js should include video preview helper');
  assert(appJs.includes('function handleMediaViewerPointerDown'), 'app.js should include image pan flow');
  assert(appJs.includes('function formatPresenceLabel'), 'app.js should include sidebar presence label formatting');
  assert(appJs.includes('function renderMarkdownBlock'), 'app.js should include markdown bubble rendering');
  assert(appJs.includes("bubble.classList.add('visual-media-bubble')"), 'app.js should include responsive visual media bubble branch');
  assert(appJs.includes('groupMessageBlocksForRender'), 'app.js should include shared block render grouping');
  assert(appJs.includes('const previousTop = messageListEl.scrollTop;'), 'app.js should preserve pre-load scroll offset when prepending history');
  assert(appJs.includes('previousTop + (nextHeight - previousHeight)'), 'app.js should restore scroll position relative to prepended history height');
  assert(appJs.includes("return state.scrollMode === 'follow-bottom' && state.autoScrollPinned ? 'follow-bottom' : 'preserve-anchor';"), 'app.js should derive viewport policy from the explicit follow-bottom mode instead of ad-hoc scroll writes');
  assert(appJs.includes('function captureVisibleMessageAnchor()'), 'app.js should include a visible-message anchor capture helper');
  assert(appJs.includes('async function handleConversationNavigationKey(event)'), 'app.js should include keyboard navigation handling for the conversation pane');
  assert(appJs.includes("conversationRefreshNoticeEl.textContent = state.pendingConversationRefreshSyncing"), 'app.js should render a dedicated pending-refresh notice for history readers');
  assert(appJs.includes("const settingsVersionValueEl = document.getElementById('settingsVersionValue');"), 'app.js should bind the About settings version element');
  assert(appJs.includes("settingsVersionValueEl.textContent = state.projectInfo.version || '0.1.8';"), 'app.js should render the current project version in About settings');
  assert(css.includes('.agent-card'), 'styles.css should include agent-card styles');
  assert(css.includes('.agent-bottom-row'), 'styles.css should include enhanced agent list layout');
  assert(css.includes('.command-menu'), 'styles.css should include slash command menu styles');
  assert(css.includes('.history-search-shell'), 'styles.css should include persistent history search shell styles');
  assert(css.includes('.history-search-inline-form'), 'styles.css should include inline history search form styles');
  assert(css.includes('.history-search-panel'), 'styles.css should include history search panel styles');
  assert(css.includes('.history-search-filters'), 'styles.css should include history search filter row styles');
  assert(css.includes('.history-search-filter'), 'styles.css should include history search filter styles');
  assert(css.includes('.history-search-result'), 'styles.css should include history search result styles');
  assert(css.includes('.history-search-result.active'), 'styles.css should include active history search result styles');
  assert(css.includes('.history-search-result.recent'), 'styles.css should include recent history search list styles');
  assert(css.includes('.history-search-result.recent + .history-search-result.recent'), 'styles.css should include recent search divider styles');
  assert(css.includes('.history-search-highlight'), 'styles.css should include history search keyword highlight styles');
  assert(css.includes('.message-row.search-target .message-bubble'), 'styles.css should include search target highlight styles');
  assert(css.includes('.message-list.showing-history-target > :first-child'), 'styles.css should disable bottom anchoring when showing a history target');
  assert(css.includes('scroll-behavior: auto;'), 'styles.css should keep the message list on direct scroll behavior to avoid overlapping scroll animations');
  assert(css.includes('.command-item'), 'styles.css should include slash command item styles');
  assert(css.includes('.thinking-menu'), 'styles.css should include thinking menu styles');
  assert(css.includes('.thinking-option'), 'styles.css should include thinking option styles');
  assert(css.includes('.model-picker'), 'styles.css should include model picker overlay styles');
  assert(css.includes('.model-picker-card'), 'styles.css should include model picker card styles');
  assert(css.includes('.model-picker-option'), 'styles.css should include model picker option styles');
  assert(css.includes('.send-button.stop-state'), 'styles.css should include stop-state send button styles');
  assert(css.includes('.message-video-preview'), 'styles.css should include video preview overlay styles');
  assert(css.includes('.markdown-content'), 'styles.css should include markdown content styles');
  assert(css.includes('.message-bubble.visual-media-bubble'), 'styles.css should include equal-width visual media bubble styles');
  assert(css.includes('.message-list > :first-child'), 'styles.css should use first-child auto margin for bottom anchoring');
  assert(css.includes('#headerRefreshButton'), 'styles.css should include mobile header refresh hiding rule');
  assert(css.includes('.chat-subtitle'), 'styles.css should include mobile subtitle hiding rule');
  assert(css.includes('.pending-upload'), 'styles.css should include pending upload styles');
  assert(css.includes('.settings-panel'), 'styles.css should include settings panel styles');
  assert(css.includes('.settings-accordion'), 'styles.css should include accordion settings layout styles');
  assert(css.includes('.theme-preset-grid'), 'styles.css should include theme preset grid styles');
  assert(css.includes('.theme-preset-card'), 'styles.css should include theme preset card styles');
  assert(css.includes(':root[data-theme="light-paper"]'), 'styles.css should include paper light theme tokens');
  assert(css.includes(':root[data-theme="light-gray"]'), 'styles.css should include gray light theme tokens');
  assert(css.includes(':root[data-theme="light-linen"]'), 'styles.css should include linen light theme tokens');
  assert(css.includes(':root[data-theme="light-mist"]'), 'styles.css should include mist light theme tokens');
  assert(css.includes(':root[data-theme="light-sand"]'), 'styles.css should include sand light theme tokens');
  assert(css.includes('.media-viewer'), 'styles.css should include media viewer styles');
  assert(css.includes('grid-template-rows: auto auto auto auto minmax(0, 1fr);'), 'model picker card should reserve scrollable space for the option list');
  assert(css.includes('.model-picker-list {\n  min-height: 0;\n  max-height: 100%;\n  overflow: auto;'), 'model picker list should own its own scrolling region');
}

async function checkBootstrapContract() {
  const serverJs = fs.readFileSync(defaultServerFile, 'utf8');
  const appJs = fs.readFileSync(defaultAppFile, 'utf8');
  assert(serverJs.includes("const BOOTSTRAP_VERSION = '2026-03-25.media-v2';"), 'server bootstrap version should reflect the latest media guidance refresh');
  assert(serverJs.includes("app.get('/api/openclaw-webchat/events', (req, res) => {"), 'server should expose an SSE events endpoint for event-driven refresh');
  assert(serverJs.includes("app.get('/api/openclaw-webchat/sessions/:sessionKey/events', (req, res) => {"), 'server should expose a session-scoped SSE events endpoint for voice/chat runs');
  assert(serverJs.includes("app.post('/api/openclaw-webchat/sessions/:sessionKey/turns', async (req, res) => {"), 'server should expose async session turn submission');
  assert(serverJs.includes("app.post('/api/openclaw-webchat/sessions/:sessionKey/runs/:runId/abort', async (req, res) => {"), 'server should expose explicit run abort routing');
  assert(serverJs.includes('function emitSessionEvent(sessionKey, event, payload = {}) {'), 'server should maintain a session-scoped SSE event pipeline');
  assert(serverJs.includes('function acceptAsyncSessionTurn(binding, body) {'), 'server should accept asynchronous text/voice turns');
  assert(serverJs.includes('function validateAsyncTurnBlocks({ mode, userBlocks }) {'), 'server should validate voice turns contain transcript and raw audio blocks');
  assert(serverJs.includes("broadcastEventStream('agent-update'"), 'server should broadcast agent updates onto the SSE stream');
  assert(serverJs.includes("broadcastEventStream('conversation-update'"), 'server should broadcast conversation updates onto the SSE stream');
  assert(serverJs.includes('const HISTORY_RECONCILE_FETCH_LIMIT = Number(process.env.OPENCLAW_WEBCHAT_HISTORY_RECONCILE_LIMIT || 200);'), 'server should define an open-time upstream history reconciliation fetch limit');
  assert(serverJs.includes('const HISTORY_RECONCILE_USER_MATCH_WINDOW_MS = Number(process.env.OPENCLAW_WEBCHAT_HISTORY_RECONCILE_USER_MATCH_WINDOW_MS || 2 * 60 * 1000);'), 'server should bound upstream/local user-turn matching with a narrow reconciliation window');
  assert(serverJs.includes('const MODEL_CATALOG_CACHE_TTL_MS = Number(process.env.OPENCLAW_WEBCHAT_MODEL_CATALOG_CACHE_TTL_MS || 30000);'), 'server should cache gateway model catalogs briefly');
  assert(serverJs.includes('const SESSION_STATE_CACHE_TTL_MS = Number(process.env.OPENCLAW_WEBCHAT_SESSION_STATE_CACHE_TTL_MS || 2500);'), 'server should cache gateway session state briefly');
  assert(serverJs.includes('function summarizeModelCatalog(models) {'), 'server should summarize the model catalog by provider for slash output');
  assert(serverJs.includes('await reconcileBindingHistory(hydrated, { limit: HISTORY_RECONCILE_FETCH_LIMIT });'), 'server should reconcile upstream session history when opening an agent');
  assert(serverJs.includes('function findLatestPersistableAssistantMessageAfterUser(messages, userIndex, minTimestampMs) {'), 'server should look for the latest persistable assistant instead of blindly taking the latest raw assistant event');
  assert(serverJs.includes('if (gatewayMessageHasToolCalls(message)) return null;'), 'server should keep tool-phase assistant messages from being persisted as final replies');
  assert(serverJs.includes('const candidates = extractReconcileAssistantRows(latestBinding, messages, localRows, sessionStartMs);'), 'open-time reconciliation should only extract assistant backfill candidates');
  assert(serverJs.includes('if (pendingAssistantRow && activeUserMatchedLocalHistory) rows.push(pendingAssistantRow);'), 'assistant backfill should only occur for turns whose user message already exists locally');
  assert(serverJs.includes('function hasEquivalentUserHistoryRow(rows, candidate) {'), 'server should explicitly compare upstream user turns to local user history before backfilling assistants');
  assert(serverJs.includes('if (toIsoString(row.createdAt) !== candidateCreatedAt) return false;'), 'assistant dedupe should require exact timestamps so repeated short replies are not collapsed');
  assert(serverJs.includes('const assistantBlocks = getPersistableAssistantBlocks(assistantRaw);'), 'server should reuse persistable assistant filtering in both sync and late reconciliation paths');
  assert(appJs.includes("const source = new window.EventSource('/api/openclaw-webchat/events');"), 'app should connect to the SSE events endpoint');
  assert(appJs.includes("source.addEventListener('agent-update', handleServerEvent);"), 'app should subscribe to agent-update SSE events');
  assert(appJs.includes("source.addEventListener('conversation-update', handleServerEvent);"), 'app should subscribe to conversation-update SSE events');
  assert(appJs.includes('queueBackgroundRefresh();'), 'app should queue background refresh work from SSE or fallback polling');
  assert(appJs.includes('}, 60000);'), 'fallback polling should be reduced to a low-frequency safety net');
  assert(appJs.includes('function captureConversationViewportSnapshot() {'), 'app should capture unified conversation viewport snapshots before rerendering');
  assert(appJs.includes('function scheduleConversationViewportRestore(snapshot) {'), 'app should restore the viewport through a unified post-render helper');
  assert(appJs.includes('function runProgrammaticScroll(action) {'), 'app should wrap programmatic message-list scrolling so user scroll state is not invalidated');
  assert(appJs.includes('state.viewportRevision += 1;'), 'app should version viewport snapshots so stale async restores can be ignored');
  assert(appJs.includes('const snapshot = captureConversationViewportSnapshot();'), 'media-load pinning should reuse the unified viewport snapshot helper');
  assert(appJs.includes('const THINKING_PICKER_CACHE_TTL_MS = 15000;'), 'app should cache thinking picker payloads briefly for warm reopen');
  assert(appJs.includes("state.thinkingPickerNotice = t('status.thinkingSwitchDone'"), 'thinking picker should keep a visible success notice after switching');
  assert(serverJs.includes('You are replying inside Claw WebChat.'), 'bootstrap should target Claw WebChat explicitly');
  assert(serverJs.includes('Use that fallback for both local files and direct remote media URLs, including generated local audio such as `.mp3` / `.wav` TTS output.'), 'bootstrap should explicitly include local generated audio fallback guidance');
  assert(serverJs.includes('If you already created a local media file, attach it with that fallback instead of saying Claw WebChat cannot receive the file.'), 'bootstrap should steer agents away from refusing already-generated local media');
  assert(serverJs.includes("Do not use `message` tool or any `webchat` channel send path."), 'bootstrap should forbid unsupported webchat message-tool media sending');
}

async function checkMixedMediaParsing() {
  const raw = [
    '第一条新闻',
    '![封面图](https://example.com/cover.png)',
    '正文里提到 MEDIA: 字段只是说明文字，不是媒体指令',
    '第二条前缀 ![配图](https://example.com/news.jpg) 第二条后缀'
  ].join('\n');
  const blocks = parseTextIntoBlocks(raw);
  assert(Array.isArray(blocks) && blocks.length === 5, 'mixed markdown image parsing should preserve five ordered blocks');

  const summary = blocks.map((block) => `${block.type}:${block.type === 'text' ? block.text : block.source}`);
  const expectedSummary = [
    'text:第一条新闻',
    'image:https://example.com/cover.png',
    'text:正文里提到 MEDIA: 字段只是说明文字，不是媒体指令\n第二条前缀',
    'image:https://example.com/news.jpg',
    'text:第二条后缀'
  ];
  assert(JSON.stringify(summary) === JSON.stringify(expectedSummary), 'mixed markdown image parsing should keep text/media interleaving order');

  const renderGroups = groupMessageBlocksForRender(blocks);
  const renderSummary = renderGroups.map((group) => {
    if (group.kind === 'text') return `text:${group.blocks.map((block) => block.text).join('|')}`;
    return `${group.block.type}:${group.block.source || group.block.url || ''}`;
  });
  const expectedRenderSummary = [
    'text:第一条新闻',
    'image:https://example.com/cover.png',
    'text:正文里提到 MEDIA: 字段只是说明文字，不是媒体指令\n第二条前缀',
    'image:https://example.com/news.jpg',
    'text:第二条后缀'
  ];
  assert(JSON.stringify(renderSummary) === JSON.stringify(expectedRenderSummary), 'render grouping should preserve the original block order');

  const directiveBlocks = parseTextIntoBlocks([
    '本地图片如下',
    'MEDIA:/tmp/example.png',
    '本地音频如下',
    'MEDIA:/tmp/example.mp3',
    '远程视频如下',
    'mediaUrl: https://example.com/demo.mp4'
  ].join('\n'));
  const directiveSummary = directiveBlocks.map((block) => `${block.type}:${block.type === 'text' ? block.text : block.source}`);
  const expectedDirectiveSummary = [
    'text:本地图片如下',
    'image:/tmp/example.png',
    'text:本地音频如下',
    'audio:/tmp/example.mp3',
    'text:远程视频如下',
    'video:https://example.com/demo.mp4'
  ];
  assert(JSON.stringify(directiveSummary) === JSON.stringify(expectedDirectiveSummary), 'MEDIA/mediaUrl directives should support local images, local audio, and direct remote media urls');
}

async function checkSettings() {
  const settings = await getJson('/api/openclaw-webchat/settings');
  assert(settings?.userProfile, 'settings should return userProfile');
  assert(settings?.serviceSettings, 'settings should return serviceSettings');
  assert(typeof settings?.projectInfo?.version === 'string', 'settings should return project version');
  assert(typeof settings?.authStatus?.enabled === 'boolean', 'settings should return auth status');
  assert(typeof settings.userProfile.displayName === 'string', 'settings should include displayName');

  const indexHtml = await getText('/');
  assert(indexHtml.includes('id="settingsVersionValue"'), 'index.html should include About settings version field');

  const patched = await patchJson('/api/openclaw-webchat/settings/user-profile', {
    displayName: 'Selftest',
    avatarUrl: null
  });
  assert(patched?.userProfile?.displayName === 'Selftest', 'settings patch should persist displayName');
}

async function checkCommandsCatalog() {
  const payload = await getJson('/api/openclaw-webchat/commands');
  assert(Array.isArray(payload?.commands), 'commands endpoint should return command definitions');
  assert(Array.isArray(payload?.allowed), 'commands endpoint should return allowed whitelist');
  const names = payload.commands.map((item) => item?.name);
  assert(names.includes('/new'), 'commands endpoint should include /new');
  assert(names.includes('/model'), 'commands endpoint should include /model');
  assert(names.includes('/think'), 'commands endpoint should include /think');
  assert(names.includes('/compact'), 'commands endpoint should include /compact');
  assert(payload.allowed.includes('/model'), 'commands whitelist should include /model');
}

async function checkUpload() {
  const payload = await postJson('/api/openclaw-webchat/uploads', {
    kind: 'image',
    filename: 'tiny.png',
    mimeType: 'image/png',
    contentBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2W2i8AAAAASUVORK5CYII='
  });
  assert(payload?.ok === true, 'upload should return ok=true');
  assert(payload?.upload?.source, 'upload should return stored source');
  assert(payload.upload.source.startsWith('openclaw-upload:'), 'upload should return opaque upload source instead of absolute path');
  assert(payload?.block?.type === 'image', 'upload should return image block');
  const mediaResponse = await fetch(`${base}${payload.block.url}`);
  assert(mediaResponse.ok, 'uploaded media url should be readable');
}

async function checkAudioUpload() {
  const payload = await postJson('/api/openclaw-webchat/uploads', {
    kind: 'audio',
    filename: 'tiny.wav',
    mimeType: 'audio/wav',
    durationMs: 2140,
    transcribe: false,
    contentBase64: 'UklGRmQGAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YUAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
  });
  assert(payload?.ok === true, 'audio upload should return ok=true');
  assert(payload?.upload?.source, 'audio upload should return stored source');
  assert(payload.upload.source.startsWith('openclaw-upload:'), 'audio upload should return opaque upload source instead of absolute path');
  assert(payload?.block?.type === 'audio', 'audio upload should return audio block');
  assert(payload?.upload?.durationMs === 2140, 'audio upload should return durationMs when provided');
  assert(payload?.block?.durationMs === 2140, 'audio block should preserve durationMs');
  assert((payload?.upload?.transcriptStatus ?? null) === 'not_requested', 'audio upload selftest should skip transcription explicitly');
  const mediaResponse = await fetch(`${base}${payload.block.url}`);
  assert(mediaResponse.ok, 'uploaded audio url should be readable');
}

async function checkFileUpload() {
  const payload = await postJson('/api/openclaw-webchat/uploads', {
    kind: 'file',
    filename: 'notes.txt',
    mimeType: 'text/plain',
    contentBase64: Buffer.from(`generic-file-${unique}`, 'utf8').toString('base64')
  });
  assert(payload?.ok === true, 'file upload should return ok=true');
  assert(payload?.upload?.source, 'file upload should return stored source');
  assert(payload.upload.source.startsWith('openclaw-upload:'), 'file upload should return opaque upload source instead of absolute path');
  assert(payload?.block?.type === 'file', 'file upload should return file block');
  const mediaResponse = await fetch(`${base}${payload.block.url}`);
  assert(mediaResponse.ok, 'uploaded file url should be readable');
  const text = await mediaResponse.text();
  assert(text.includes(`generic-file-${unique}`), 'uploaded file content should round-trip through the media endpoint');
}

async function checkUpstreamAttachmentMaterialization() {
  const imageUpload = await postJson('/api/openclaw-webchat/uploads', {
    kind: 'image',
    filename: 'upstream-materialization.png',
    mimeType: 'image/png',
    contentBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2W2i8AAAAASUVORK5CYII='
  });
  const fileUpload = await postJson('/api/openclaw-webchat/uploads', {
    kind: 'file',
    filename: 'upstream-materialization.txt',
    mimeType: 'text/plain',
    contentBase64: Buffer.from(`upstream-materialization-file-${unique}`, 'utf8').toString('base64')
  });

  const prompt = `请只回复 upstream-materialized-${unique}`;
  const payload = await postJson(`/api/openclaw-webchat/sessions/${encodeURIComponent(sessionKey)}/send`, {
    text: prompt,
    blocks: [
      {
        type: 'image',
        source: imageUpload.upload.source,
        name: imageUpload.upload.name,
        mimeType: imageUpload.upload.mimeType,
        sizeBytes: imageUpload.upload.size
      },
      {
        type: 'file',
        source: fileUpload.upload.source,
        name: fileUpload.upload.name,
        mimeType: fileUpload.upload.mimeType,
        sizeBytes: fileUpload.upload.size
      }
    ]
  });
  assert(payload?.message?.role === 'assistant', 'materialization send should still return an assistant message envelope');

  const binding = readBinding(agentId);
  assert(binding?.upstreamSessionKey, 'materialization check should have an upstreamSessionKey');
  const upstreamHistory = await gatewayCall('chat.history', { sessionKey: binding.upstreamSessionKey, limit: 20 });
  const upstreamUserMessage = (Array.isArray(upstreamHistory?.messages) ? upstreamHistory.messages : []).find((message) => (
    message?.role === 'user' && collectGatewayText(message).includes(prompt)
  ));
  assert(upstreamUserMessage, 'upstream history should include the attachment materialization prompt');
  const upstreamText = collectGatewayText(upstreamUserMessage);
  assert(!upstreamText.includes(imageUpload.upload.source), 'upstream attachment wrapper should not expose raw image openclaw-upload source');
  assert(!upstreamText.includes(fileUpload.upload.source), 'upstream attachment wrapper should not expose raw file openclaw-upload source');
  assert(upstreamText.includes(managedUploadPathFromSource(imageUpload.upload.source)), 'upstream attachment wrapper should include the resolved local image path');
  assert(upstreamText.includes(managedUploadPathFromSource(fileUpload.upload.source)), 'upstream attachment wrapper should include the resolved local file path');
}

async function checkAgents() {
  const payload = await getJson('/api/openclaw-webchat/agents');
  assert(Array.isArray(payload?.agents), 'agents endpoint should return array');
  assert(payload.agents.some((item) => item.agentId === agentId), `agents should include ${agentId}`);
}

async function checkAgentProfile() {
  const upload = await postJson('/api/openclaw-webchat/uploads', {
    kind: 'image',
    filename: 'agent-avatar.png',
    mimeType: 'image/png',
    contentBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2W2i8AAAAASUVORK5CYII='
  });
  assert(upload?.upload?.source, 'agent avatar upload should return persistent source');
  assert(upload.upload.source.startsWith('openclaw-upload:'), 'agent avatar upload should return opaque source instead of absolute path');
  assert(upload?.block?.url?.includes('/api/openclaw-webchat/media?token='), 'agent avatar upload should return a signed media url');

  const patched = await patchJson(`/api/openclaw-webchat/agents/${encodeURIComponent(agentId)}/profile`, {
    displayName: 'Selftest Agent',
    avatarUrl: upload.block.url
  });
  assert(patched?.profile?.displayName === 'Selftest Agent', 'agent profile patch should persist displayName');
  assert(patched?.profile?.avatarUrl?.includes('/api/openclaw-webchat/media?token='), 'agent profile response should expose a refreshed signed media url');

  const profiles = JSON.parse(fs.readFileSync(profilesFile, 'utf8'));
  assert(profiles?.[agentId]?.avatarUrl === upload.upload.source, 'agent profile should persist stable avatar source instead of signed url');
}

async function checkOpenAgent() {
  const payload = await postJson(`/api/openclaw-webchat/agents/${encodeURIComponent(agentId)}/open`, {});
  assert(payload?.sessionKey === sessionKey, 'open should return expected sessionKey');
  assert(payload?.history && Array.isArray(payload.history.messages), 'open should return history page');
  assert(payload.history.messages.length <= 15, 'open should return the reduced initial history page');
}

async function checkStopEndpoint() {
  const payload = await postJson(`/api/openclaw-webchat/sessions/${encodeURIComponent(sessionKey)}/stop`, {});
  assert(payload?.ok === true, 'stop endpoint should return ok=true');
  assert(typeof payload?.aborted === 'boolean', 'stop endpoint should expose aborted flag');
  assert(Array.isArray(payload?.runIds), 'stop endpoint should expose runIds array');
}

async function checkSessionVoiceApi() {
  const stream = await openSseStream(`/api/openclaw-webchat/sessions/${encodeURIComponent(sessionKey)}/events?mode=voice`);
  const readyEvent = await stream.waitFor((event) => event.event === 'ready' && event.payload?.sessionKey === sessionKey);
  assert(readyEvent?.payload?.streamVersion === 1, 'session event stream should expose streamVersion=1');

  const upload = await postJson('/api/openclaw-webchat/uploads', {
    kind: 'audio',
    filename: 'voice-turn-selftest.wav',
    mimeType: 'audio/wav',
    durationMs: 2140,
    transcribe: false,
    contentBase64: 'UklGRmQGAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YUAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
  });
  const clientTurnId = `voice-${unique}`;
  const requestedText = `请只回复 ${unique} voice`;
  const accepted = await postJson(`/api/openclaw-webchat/sessions/${encodeURIComponent(sessionKey)}/turns`, {
    clientTurnId,
    mode: 'voice',
    text: requestedText,
    blocks: [
      { type: 'text', text: requestedText },
      {
        type: 'audio',
        source: upload.upload.source,
        name: upload.upload.name,
        mimeType: upload.upload.mimeType,
        sizeBytes: upload.upload.size,
        durationMs: upload.upload.durationMs
      }
    ],
    transcript: {
      text: requestedText,
      source: 'selftest',
      locale: 'zh-CN',
      isFinal: true
    },
    response: {
      stream: true,
      thinking: 'low'
    },
    interrupt: {
      policy: 'abort_previous_if_running'
    },
    client: {
      platform: 'selftest',
      app: 'claw-webchat-selftest',
      appVersion: '1.0.0'
    }
  });
  assert(accepted?.ok === true, 'async voice turn should return ok=true');
  assert(accepted?.accepted === true, 'async voice turn should return accepted=true');
  assert(accepted?.runId, 'async voice turn should return runId');
  assert(accepted?.userMessageId, 'async voice turn should return userMessageId');
  assert(accepted?.status === 'queued', 'async voice turn should return queued status');

  const duplicate = await postJson(`/api/openclaw-webchat/sessions/${encodeURIComponent(sessionKey)}/turns`, {
    clientTurnId,
    mode: 'voice',
    text: requestedText,
    blocks: [
      { type: 'text', text: requestedText },
      {
        type: 'audio',
        source: upload.upload.source,
        name: upload.upload.name,
        mimeType: upload.upload.mimeType,
        sizeBytes: upload.upload.size,
        durationMs: upload.upload.durationMs
      }
    ],
    transcript: {
      text: requestedText,
      source: 'selftest',
      locale: 'zh-CN',
      isFinal: true
    },
    response: {
      stream: true,
      thinking: 'low'
    },
    interrupt: {
      policy: 'abort_previous_if_running'
    }
  });
  assert(duplicate?.runId === accepted.runId, 'duplicate clientTurnId should return the original runId');
  assert(duplicate?.userMessageId === accepted.userMessageId, 'duplicate clientTurnId should return the original userMessageId');

  const acceptedEvent = await stream.waitFor((event) => event.event === 'run.accepted' && event.payload?.runId === accepted.runId);
  assert(acceptedEvent?.payload?.clientTurnId === clientTurnId, 'run.accepted should include clientTurnId');
  const runningEvent = await stream.waitFor((event) => event.event === 'run.state' && event.payload?.runId === accepted.runId && event.payload?.state === 'running');
  assert(runningEvent?.payload?.sessionKey === sessionKey, 'run.state should include sessionKey');
  const finalEvent = await stream.waitFor((event) => event.event === 'assistant.final' && event.payload?.runId === accepted.runId, requestTimeoutMs + 120000);
  const finalText = collectText(finalEvent?.payload?.message);
  assert(finalText.trim().length > 0, 'assistant.final should contain non-empty assistant text');
  const finalState = await stream.waitFor((event) => event.event === 'run.state' && event.payload?.runId === accepted.runId && event.payload?.state === 'final');
  assert(finalState?.payload?.state === 'final', 'successful async run should emit final terminal state');

  const history = await getJson(`/api/openclaw-webchat/agents/${encodeURIComponent(agentId)}/history?limit=20`);
  const voiceUserMessage = history.messages.find((message) => message.id === accepted.userMessageId);
  assert(voiceUserMessage?.role === 'user', 'voice-originated turn should appear as a normal user history message');
  assert(voiceUserMessage.blocks.some((block) => block.type === 'text' && String(block.text || '') === requestedText), 'voice-originated user message should keep transcript text block');
  assert(voiceUserMessage.blocks.some((block) => block.type === 'audio' && block.durationMs === 2140), 'voice-originated user message should keep raw audio block with durationMs');

  const abortTurnId = `voice-abort-${unique}`;
  const abortAccepted = await postJson(`/api/openclaw-webchat/sessions/${encodeURIComponent(sessionKey)}/turns`, {
    clientTurnId: abortTurnId,
    mode: 'text',
    text: '请从 1 数到 500，每行一个数字，不要解释。',
    response: {
      stream: true
    },
    interrupt: {
      policy: 'abort_previous_if_running'
    }
  });
  assert(abortAccepted?.runId, 'abort selftest should return runId');
  const abortPayload = await postJson(`/api/openclaw-webchat/sessions/${encodeURIComponent(sessionKey)}/runs/${encodeURIComponent(abortAccepted.runId)}/abort`, {});
  assert(abortPayload?.ok === true, 'run abort should return ok=true');
  assert(abortPayload?.state === 'aborted', 'run abort should return aborted state');
  const abortedEvent = await stream.waitFor((event) => event.event === 'run.state' && event.payload?.runId === abortAccepted.runId && event.payload?.state === 'aborted');
  assert(abortedEvent?.payload?.state === 'aborted', 'run abort should emit run.state aborted');

  stream.close();
}

async function checkSlashCommands() {
  const modelInfo = await postJson(`/api/openclaw-webchat/sessions/${encodeURIComponent(sessionKey)}/command`, {
    command: '/model'
  });
  const modelText = collectText(modelInfo?.message);
  assert(modelText.includes('当前模型：'), '/model should return current model info');
  const currentModel = modelText.match(/当前模型：([^\n]+)/)?.[1]?.trim();
  assert(currentModel, '/model should expose current model');

  const modelOptions = await getJson(`/api/openclaw-webchat/sessions/${encodeURIComponent(sessionKey)}/model-options`);
  assert(modelOptions?.current?.provider, 'model-options should return current provider');
  assert(modelOptions?.current?.model, 'model-options should return current model');
  assert(Array.isArray(modelOptions?.models), 'model-options should return model list');
  assert(modelOptions.models.length > 0, 'model-options should include at least one selectable model');
  for (const option of modelOptions.models) {
    assert(modelText.includes(String(option.model || '')), `/model should mention available model ${option.model}`);
  }
  const currentOption = modelOptions.models.find((item) => (
    item?.provider === modelOptions.current.provider && item?.model === modelOptions.current.model
  )) || modelOptions.models[0];

  const modelPatch = await patchJson(`/api/openclaw-webchat/sessions/${encodeURIComponent(sessionKey)}/model`, {
    provider: currentOption.provider,
    model: currentOption.model
  });
  assert(modelPatch?.ok === true, 'model patch endpoint should succeed');
  assert(modelPatch?.current?.provider === currentOption.provider, 'model patch endpoint should persist provider');
  assert(modelPatch?.current?.model === currentOption.model, 'model patch endpoint should persist model');

  const modelSet = await postJson(`/api/openclaw-webchat/sessions/${encodeURIComponent(sessionKey)}/command`, {
    command: `/model ${currentModel}`
  });
  assert(collectText(modelSet?.message).includes(`已设置模型：${currentModel}`), '/model <name> should patch the current model');

  const thinkInfo = await postJson(`/api/openclaw-webchat/sessions/${encodeURIComponent(sessionKey)}/command`, {
    command: '/think'
  });
  const thinkText = collectText(thinkInfo?.message);
  assert(thinkText.includes('当前 thinking level：'), '/think should return current thinking level');
  const currentLevel = thinkText.match(/当前 thinking level：([^\n]+)/)?.[1]?.trim();
  assert(currentLevel, '/think should expose current thinking level');

  const thinkingOptions = await getJson(`/api/openclaw-webchat/sessions/${encodeURIComponent(sessionKey)}/thinking-options`);
  assert(typeof thinkingOptions?.currentLevel === 'string', 'thinking-options should return current thinking level');
  assert(Array.isArray(thinkingOptions?.options), 'thinking-options should return selectable level list');
  assert(thinkingOptions.options.length > 0, 'thinking-options should include at least one selectable level');
  const currentThinkingOption = thinkingOptions.options.find((item) => item?.value === thinkingOptions.currentLevel) || thinkingOptions.options[0];

  const thinkingPatch = await patchJson(`/api/openclaw-webchat/sessions/${encodeURIComponent(sessionKey)}/thinking`, {
    thinkingLevel: currentThinkingOption.value
  });
  assert(thinkingPatch?.ok === true, 'thinking patch endpoint should succeed');
  assert(thinkingPatch?.currentLevel === currentThinkingOption.value, 'thinking patch endpoint should persist current level');

  const thinkSet = await postJson(`/api/openclaw-webchat/sessions/${encodeURIComponent(sessionKey)}/command`, {
    command: `/think ${currentLevel}`
  });
  assert(collectText(thinkSet?.message).includes(`已设置 thinking level：${currentLevel}`), '/think <level> should patch the current thinking level');
}

async function checkSend() {
  const payload = await postJson(`/api/openclaw-webchat/sessions/${encodeURIComponent(sessionKey)}/send`, {
    text: `请只回复 ${unique}`
  });
  const text = collectText(payload?.message);
  assert(text.includes(unique), 'assistant reply should include unique token');
}

async function checkReset() {
  const before = readBinding(agentId);
  const beforeUpstreamSessionKey = before?.upstreamSessionKey || null;

  const payload = await postJson(`/api/openclaw-webchat/sessions/${encodeURIComponent(sessionKey)}/command`, {
    command: '/new'
  });
  assert(payload?.message?.role === 'marker', '/new should append marker');
  assert(payload?.message?.label === '已重置上下文', '/new marker label should match');

  const after = readBinding(agentId);
  assert(after?.upstreamSessionKey, '/new should keep an upstreamSessionKey');
  if (beforeUpstreamSessionKey) {
    assert(after.upstreamSessionKey !== beforeUpstreamSessionKey, '/new should rotate upstreamSessionKey to isolate late async completions');
  }
}

async function checkHistory() {
  const payload = await getJson(`/api/openclaw-webchat/agents/${encodeURIComponent(agentId)}/history?limit=8`);
  assert(Array.isArray(payload?.messages), 'history should return messages array');
  assert(typeof payload?.hasMore === 'boolean', 'history should return hasMore');
  assert('nextBefore' in payload, 'history should return nextBefore field');
  assert(payload.messages.some((item) => item.role === 'marker' && item.label === '已重置上下文'), 'history should include reset marker');
}

async function checkHistorySearch() {
  const normalizedUnique = unique.replace('-', ' ');
  const today = formatLocalDate(new Date());
  const payload = await getJson(`/api/openclaw-webchat/agents/${encodeURIComponent(agentId)}/history/search?q=${encodeURIComponent(normalizedUnique)}&limit=100&from=${today}&to=${today}`);
  assert(Array.isArray(payload?.results), 'history search should return results array');
  assert(typeof payload?.total === 'number', 'history search should return total count');
  assert(payload?.limit === 100, 'history search should echo the requested result limit');
  assert(payload?.filters?.from === today, 'history search should echo the start date filter');
  assert(payload?.filters?.to === today, 'history search should echo the end date filter');
  assert(payload.results.some((item) => String(item?.excerpt || '').includes(unique) || String(item?.summary || '').includes(unique)), 'history search should find the unique token');
}

function collectText(message) {
  return (message?.blocks || [])
    .filter((block) => block.type === 'text')
    .map((block) => String(block.text || ''))
    .join('\n');
}

function collectGatewayText(message) {
  return (Array.isArray(message?.content) ? message.content : [])
    .filter((item) => item?.type === 'text' && item?.text)
    .map((item) => String(item.text))
    .join('\n');
}

async function openSseStream(path) {
  const controller = new AbortController();
  const response = await fetch(`${base}${path}`, {
    headers: { accept: 'text/event-stream' },
    signal: controller.signal
  });
  assert(response.ok, `SSE ${path} failed: ${response.status}`);
  assert(response.body, `SSE ${path} should return a body stream`);

  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  const events = [];
  const waiters = [];
  let buffer = '';
  let closed = false;

  const flushWaiters = () => {
    for (let index = waiters.length - 1; index >= 0; index -= 1) {
      const waiter = waiters[index];
      const matched = events.find(waiter.predicate);
      if (!matched) continue;
      clearTimeout(waiter.timeoutId);
      waiters.splice(index, 1);
      waiter.resolve(matched);
    }
  };

  const parseEventBlock = (block) => {
    let event = 'message';
    let id = null;
    const dataLines = [];
    for (const line of block.split('\n')) {
      if (!line || line.startsWith(':')) continue;
      if (line.startsWith('event:')) {
        event = line.slice(6).trim();
        continue;
      }
      if (line.startsWith('id:')) {
        id = line.slice(3).trim();
        continue;
      }
      if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart());
      }
    }
    if (!dataLines.length) return null;
    let payload = null;
    const raw = dataLines.join('\n');
    try { payload = JSON.parse(raw); } catch { payload = { raw }; }
    return { id, event, payload };
  };

  const pump = (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let splitIndex = buffer.indexOf('\n\n');
        while (splitIndex >= 0) {
          const rawBlock = buffer.slice(0, splitIndex);
          buffer = buffer.slice(splitIndex + 2);
          const parsed = parseEventBlock(rawBlock.replace(/\r/g, ''));
          if (parsed) {
            events.push(parsed);
            flushWaiters();
          }
          splitIndex = buffer.indexOf('\n\n');
        }
      }
    } catch (error) {
      if (error?.name !== 'AbortError') throw error;
    } finally {
      closed = true;
      flushWaiters();
    }
  })();

  return {
    async waitFor(predicate, timeoutMs = requestTimeoutMs) {
      const matched = events.find(predicate);
      if (matched) return matched;
      if (closed) throw new Error(`SSE stream ${path} closed before matching event arrived`);
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          const index = waiters.findIndex((item) => item.timeoutId === timeoutId);
          if (index >= 0) waiters.splice(index, 1);
          reject(new Error(`Timed out waiting for SSE event on ${path}`));
        }, timeoutMs);
        waiters.push({ predicate, resolve, reject, timeoutId });
      });
    },
    close() {
      controller.abort();
    },
    done: pump
  };
}

function readBinding(targetAgentId) {
  const bindings = JSON.parse(fs.readFileSync(bindingsFile, 'utf8'));
  return bindings?.[targetAgentId] || null;
}

function managedUploadPathFromSource(source) {
  const normalized = String(source || '');
  assert(normalized.startsWith('openclaw-upload:'), `expected managed upload source, got ${normalized}`);
  return path.join(uploadsDir, decodeURIComponent(normalized.slice('openclaw-upload:'.length)));
}

async function gatewayCall(method, params) {
  const { stdout, stderr } = await execFileAsync(openclawBin, [
    'gateway',
    'call',
    method,
    '--json',
    '--timeout',
    '120000',
    '--params',
    JSON.stringify(params || {})
  ], {
    cwd: process.cwd(),
    maxBuffer: 5 * 1024 * 1024
  });

  const raw = String(stdout || '').trim();
  assert(raw, `gateway ${method} should return JSON output: ${stderr || '(empty stdout)'}`);
  return JSON.parse(raw);
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function getJson(path) {
  const response = await fetchWithTimeout(path);
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  assert(response.ok, `GET ${path} failed: ${response.status} ${text}`);
  return data;
}

async function postJson(path, body) {
  const response = await fetchWithTimeout(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body || {})
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  assert(response.ok, `POST ${path} failed: ${response.status} ${text}`);
  return data;
}

async function patchJson(path, body) {
  const response = await fetchWithTimeout(path, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body || {})
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  assert(response.ok, `PATCH ${path} failed: ${response.status} ${text}`);
  return data;
}

async function getText(path) {
  const response = await fetchWithTimeout(path);
  const text = await response.text();
  assert(response.ok, `GET ${path} failed: ${response.status}`);
  return text;
}

async function fetchWithTimeout(path, init = {}) {
  return fetch(`${base}${path}`, {
    ...init,
    signal: AbortSignal.timeout(requestTimeoutMs)
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
