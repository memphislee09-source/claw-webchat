const base = process.env.OPENCLAW_WEBCHAT_BASE || 'http://127.0.0.1:3770';
const agentId = process.env.OPENCLAW_WEBCHAT_TEST_AGENT || 'mira';
const sessionKey = `openclaw-webchat:${agentId}`;

const unique = `selftest-${Date.now()}`;

await checkHealth();
await checkPageShell();
await checkSettings();
await checkAgents();
await checkAgentProfile();
await checkOpenAgent();
await checkUpload();
await checkAudioUpload();
await checkSend();
await checkReset();
await checkHistory();

console.log('SELFTEST_OK');

async function checkHealth() {
  const health = await getJson('/healthz');
  assert(health?.ok === true, 'healthz should return ok=true');
}

async function checkPageShell() {
  const html = await getText('/');
  assert(html.includes('id="agentList"'), 'page should contain agentList');
  assert(html.includes('id="messageList"'), 'page should contain messageList');
  assert(html.includes('id="composerInput"'), 'page should contain composerInput');
  assert(html.includes('Enter 换行；点击发送提交'), 'page should reflect enter-to-newline composer hint');
  assert(html.includes('id="attachButton"'), 'page should contain attachButton');
  assert(html.includes('id="mediaUploadInput"'), 'page should contain mediaUploadInput');
  assert(html.includes('id="settingsPanel"'), 'page should contain settingsPanel');
  assert(html.includes('id="settingsContactSelect"'), 'page should contain settingsContactSelect');
  assert(html.includes('id="saveSettingsButton"'), 'page should contain saveSettingsButton');
  assert(html.includes('id="settingsPreferencesSection"'), 'page should contain settingsPreferencesSection');
  assert(html.includes('id="mediaViewer"'), 'page should contain mediaViewer');
  assert(html.includes('id="mediaViewerImage"'), 'page should contain mediaViewerImage');

  const appJs = await getText('/static/app.js');
  const css = await getText('/static/styles.css');
  assert(appJs.includes('async function openAgent'), 'app.js should include openAgent');
  assert(appJs.includes('async function ensurePendingUploadsReady'), 'app.js should include image upload flow');
  assert(appJs.includes('async function saveSettingsContact'), 'app.js should include unified visual contact settings');
  assert(appJs.includes('async function cropAvatarToSquare'), 'app.js should include avatar crop flow');
  assert(appJs.includes('function openMediaViewer'), 'app.js should include image viewer flow');
  assert(appJs.includes('function handleMediaViewerPointerDown'), 'app.js should include image pan flow');
  assert(appJs.includes('function formatPresenceLabel'), 'app.js should include sidebar presence label formatting');
  assert(appJs.includes('function renderMarkdownBlock'), 'app.js should include markdown bubble rendering');
  assert(appJs.includes("bubble.classList.add('visual-media-bubble')"), 'app.js should include responsive visual media bubble branch');
  assert(css.includes('.agent-card'), 'styles.css should include agent-card styles');
  assert(css.includes('.agent-bottom-row'), 'styles.css should include enhanced agent list layout');
  assert(css.includes('.markdown-content'), 'styles.css should include markdown content styles');
  assert(css.includes('.message-bubble.visual-media-bubble'), 'styles.css should include equal-width visual media bubble styles');
  assert(css.includes('.pending-upload'), 'styles.css should include pending upload styles');
  assert(css.includes('.settings-panel'), 'styles.css should include settings panel styles');
  assert(css.includes('.settings-accordion'), 'styles.css should include accordion settings layout styles');
  assert(css.includes('.media-viewer'), 'styles.css should include media viewer styles');
}

async function checkSettings() {
  const settings = await getJson('/api/openclaw-webchat/settings');
  assert(settings?.userProfile, 'settings should return userProfile');
  assert(typeof settings.userProfile.displayName === 'string', 'settings should include displayName');

  const patched = await patchJson('/api/openclaw-webchat/settings/user-profile', {
    displayName: 'Selftest',
    avatarUrl: null
  });
  assert(patched?.userProfile?.displayName === 'Selftest', 'settings patch should persist displayName');
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
  const patched = await patchJson(`/api/openclaw-webchat/agents/${encodeURIComponent(agentId)}/profile`, {
    displayName: 'Selftest Agent',
    avatarUrl: null
  });
  assert(patched?.profile?.displayName === 'Selftest Agent', 'agent profile patch should persist displayName');
}

async function checkOpenAgent() {
  const payload = await postJson(`/api/openclaw-webchat/agents/${encodeURIComponent(agentId)}/open`, {});
  assert(payload?.sessionKey === sessionKey, 'open should return expected sessionKey');
  assert(payload?.history && Array.isArray(payload.history.messages), 'open should return history page');
}

async function checkSend() {
  const payload = await postJson(`/api/openclaw-webchat/sessions/${encodeURIComponent(sessionKey)}/send`, {
    text: `请只回复 ${unique}`
  });
  const text = collectText(payload?.message);
  assert(text.includes(unique), 'assistant reply should include unique token');
}

async function checkReset() {
  const payload = await postJson(`/api/openclaw-webchat/sessions/${encodeURIComponent(sessionKey)}/command`, {
    command: '/new'
  });
  assert(payload?.message?.role === 'marker', '/new should append marker');
  assert(payload?.message?.label === '已重置上下文', '/new marker label should match');
}

async function checkHistory() {
  const payload = await getJson(`/api/openclaw-webchat/agents/${encodeURIComponent(agentId)}/history?limit=8`);
  assert(Array.isArray(payload?.messages), 'history should return messages array');
  assert(typeof payload?.hasMore === 'boolean', 'history should return hasMore');
  assert('nextBefore' in payload, 'history should return nextBefore field');
  assert(payload.messages.some((item) => item.role === 'marker' && item.label === '已重置上下文'), 'history should include reset marker');
}

function collectText(message) {
  return (message?.blocks || [])
    .filter((block) => block.type === 'text')
    .map((block) => String(block.text || ''))
    .join('\n');
}

async function getJson(path) {
  const response = await fetch(`${base}${path}`);
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  assert(response.ok, `GET ${path} failed: ${response.status} ${text}`);
  return data;
}

async function postJson(path, body) {
  const response = await fetch(`${base}${path}`, {
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
  const response = await fetch(`${base}${path}`, {
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
  const response = await fetch(`${base}${path}`);
  const text = await response.text();
  assert(response.ok, `GET ${path} failed: ${response.status}`);
  return text;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
