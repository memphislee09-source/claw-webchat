import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { groupMessageBlocksForRender, parseTextIntoBlocks } from '../public/message-blocks.js';

const base = process.env.OPENCLAW_WEBCHAT_BASE || 'http://127.0.0.1:3770';
const agentId = process.env.OPENCLAW_WEBCHAT_TEST_AGENT || 'mira';
const sessionKey = `openclaw-webchat:${agentId}`;
const requestTimeoutMs = Number(process.env.OPENCLAW_WEBCHAT_SELFTEST_REQUEST_TIMEOUT_MS || 150000);
const defaultBindingsFile = fileURLToPath(new URL('../data/session-bindings.json', import.meta.url));
const defaultProfilesFile = fileURLToPath(new URL('../data/agent-profiles.json', import.meta.url));
const defaultServerFile = fileURLToPath(new URL('../src/server.js', import.meta.url));
const bindingsFile = process.env.OPENCLAW_WEBCHAT_DATA_DIR
  ? path.join(path.resolve(process.env.OPENCLAW_WEBCHAT_DATA_DIR), 'session-bindings.json')
  : defaultBindingsFile;
const profilesFile = process.env.OPENCLAW_WEBCHAT_DATA_DIR
  ? path.join(path.resolve(process.env.OPENCLAW_WEBCHAT_DATA_DIR), 'agent-profiles.json')
  : defaultProfilesFile;

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
await checkSlashCommands();
await checkUpload();
await checkAudioUpload();
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
  assert(appJs.includes('async function switchSessionModel'), 'app.js should include model switch handler');
  assert(appJs.includes('async function stopActiveSessionReply'), 'app.js should include current reply stop handler');
  assert(appJs.includes('function renderSendButtonState'), 'app.js should include send/stop button state renderer');
  assert(appJs.includes('function attachVideoPreview'), 'app.js should include video preview helper');
  assert(appJs.includes('function handleMediaViewerPointerDown'), 'app.js should include image pan flow');
  assert(appJs.includes('function formatPresenceLabel'), 'app.js should include sidebar presence label formatting');
  assert(appJs.includes('function renderMarkdownBlock'), 'app.js should include markdown bubble rendering');
  assert(appJs.includes("bubble.classList.add('visual-media-bubble')"), 'app.js should include responsive visual media bubble branch');
  assert(appJs.includes('groupMessageBlocksForRender'), 'app.js should include shared block render grouping');
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
  assert(css.includes('.command-item'), 'styles.css should include slash command item styles');
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
}

async function checkBootstrapContract() {
  const serverJs = fs.readFileSync(defaultServerFile, 'utf8');
  assert(serverJs.includes("const BOOTSTRAP_VERSION = '2026-03-24.media-v1';"), 'server bootstrap version should reflect the media guidance refresh');
  assert(serverJs.includes('You are replying inside Claw WebChat.'), 'bootstrap should target Claw WebChat explicitly');
  assert(serverJs.includes('Use that fallback for both local files and direct remote media URLs.'), 'bootstrap should explain local and remote fallback media handling');
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
    '远程视频如下',
    'mediaUrl: https://example.com/demo.mp4'
  ].join('\n'));
  const directiveSummary = directiveBlocks.map((block) => `${block.type}:${block.type === 'text' ? block.text : block.source}`);
  const expectedDirectiveSummary = [
    'text:本地图片如下',
    'image:/tmp/example.png',
    'text:远程视频如下',
    'video:https://example.com/demo.mp4'
  ];
  assert(JSON.stringify(directiveSummary) === JSON.stringify(expectedDirectiveSummary), 'MEDIA/mediaUrl directives should support both local paths and direct remote media urls');
}

async function checkSettings() {
  const settings = await getJson('/api/openclaw-webchat/settings');
  assert(settings?.userProfile, 'settings should return userProfile');
  assert(settings?.serviceSettings, 'settings should return serviceSettings');
  assert(typeof settings?.authStatus?.enabled === 'boolean', 'settings should return auth status');
  assert(typeof settings.userProfile.displayName === 'string', 'settings should include displayName');

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
    transcribe: false,
    contentBase64: 'UklGRmQGAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YUAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
  });
  assert(payload?.ok === true, 'audio upload should return ok=true');
  assert(payload?.upload?.source, 'audio upload should return stored source');
  assert(payload.upload.source.startsWith('openclaw-upload:'), 'audio upload should return opaque upload source instead of absolute path');
  assert(payload?.block?.type === 'audio', 'audio upload should return audio block');
  assert((payload?.upload?.transcriptStatus ?? null) === null, 'audio upload selftest should skip transcription');
  const mediaResponse = await fetch(`${base}${payload.block.url}`);
  assert(mediaResponse.ok, 'uploaded audio url should be readable');
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

function readBinding(targetAgentId) {
  const bindings = JSON.parse(fs.readFileSync(bindingsFile, 'utf8'));
  return bindings?.[targetAgentId] || null;
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
