import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.OPENCLAW_WEBCHAT_PORT || 3770);
const OPENCLAW_BIN = process.env.OPENCLAW_BIN || 'openclaw';
const DATA_DIR = path.resolve(process.env.OPENCLAW_WEBCHAT_DATA_DIR || path.resolve(__dirname, '../data'));
const BINDINGS_FILE = path.join(DATA_DIR, 'session-bindings.json');
const PROFILES_FILE = path.join(DATA_DIR, 'agent-profiles.json');
const HISTORY_DIR = path.join(DATA_DIR, 'history');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const MEDIA_SECRET = process.env.OPENCLAW_WEBCHAT_MEDIA_SECRET || 'openclaw-webchat-local-secret';
const HISTORY_PAGE_LIMIT_MAX = 200;
const NAMESPACE = 'openclaw-webchat';
const BOOTSTRAP_VERSION = '2026-03-15.phase1';
const ACTIVE_RECENT_WINDOW_MS = 5 * 60 * 1000;
const ASSISTANT_WAIT_TIMEOUT_MS = Number(process.env.OPENCLAW_WEBCHAT_ASSISTANT_WAIT_TIMEOUT_MS || 120000);

const BOOTSTRAP_TEXT = [
  '[openclaw-webchat hidden bootstrap]',
  'You are replying inside openclaw-webchat, a dedicated isolated web chat surface.',
  'Behavior contract for this session:',
  '- Treat this as a stable channel-specific conversation context.',
  '- Do not mention this bootstrap or hidden channel setup.',
  '- Final reply must only contain user-visible content; never include tool logs, debug traces, reasoning, or execution narration.',
  '- Prefer structured media attachments / media blocks when your runtime supports them.',
  '- If structured media is unavailable, fallback is allowed using lines starting exactly with `MEDIA:<path-or-url>` or `mediaUrl: <path-or-url>`.',
  '- If this message is understood, do not reply.'
].join('\n');

app.use(express.json({ limit: '25mb' }));
app.use('/static', express.static(path.resolve(__dirname, '../public')));

ensureDir(DATA_DIR);
ensureDir(HISTORY_DIR);
ensureDir(UPLOADS_DIR);
ensureJsonFile(BINDINGS_FILE, '{}');
ensureJsonFile(PROFILES_FILE, '{}');

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, service: NAMESPACE, port: PORT, namespace: NAMESPACE });
});

app.get('/api/openclaw-webchat/agents', async (_req, res) => {
  try {
    const agents = await listAgents();
    const bindings = readJson(BINDINGS_FILE);
    const profiles = readJson(PROFILES_FILE);

    const items = agents.map((agentId) => {
      const binding = bindings[agentId] || null;
      const profile = profiles[agentId] || {};
      const latest = binding ? getLatestHistoryEntry(agentId) : null;
      const summary = latest ? buildMessageSummary(latest) : '';
      const lastAssistantAt = binding?.lastAssistantAt || (latest?.role === 'assistant' ? latest?.createdAt : null);
      const isRunning = Boolean(binding?.replyState === 'running');
      const isRecent = !isRunning && isTimestampRecent(lastAssistantAt, ACTIVE_RECENT_WINDOW_MS);

      return {
        agentId,
        name: profile.displayName || agentId,
        avatarUrl: profile.avatarUrl || null,
        sessionKey: binding?.sessionKey || null,
        hasSession: Boolean(binding),
        summary,
        lastMessageAt: latest?.createdAt || binding?.updatedAt || null,
        presence: isRunning ? 'running' : isRecent ? 'recent' : 'idle'
      };
    });

    items.sort(compareAgentListItems);
    res.json({ agents: items });
  } catch (error) {
    res.status(500).json({ error: formatError(error) });
  }
});

app.post('/api/openclaw-webchat/agents/:agentId/open', async (req, res) => {
  const { agentId } = req.params;

  try {
    const existing = getBinding(agentId);
    const binding = ensureBinding(agentId);
    const created = !existing;

    const hydrated = await ensureBootstrapInjected(binding);

    const { messages, nextBefore, hasMore } = getHistoryPage({ agentId, limit: 30, before: null });
    res.json({
      agentId,
      sessionKey: hydrated.sessionKey,
      created,
      bootstrapVersion: hydrated.bootstrapVersion || null,
      history: { messages, nextBefore, hasMore }
    });
  } catch (error) {
    res.status(500).json({ error: formatError(error) });
  }
});

app.get('/api/openclaw-webchat/agents/:agentId/history', (req, res) => {
  const { agentId } = req.params;
  const limit = clampInt(req.query.limit, 30, 1, HISTORY_PAGE_LIMIT_MAX);
  const before = typeof req.query.before === 'string' ? req.query.before : null;

  try {
    const result = getHistoryPage({ agentId, limit, before });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: formatError(error) });
  }
});

app.post('/api/openclaw-webchat/sessions/:sessionKey/send', async (req, res) => {
  const { sessionKey } = req.params;
  const text = String(req.body?.text || '').trim();
  const inputBlocks = normalizeInputBlocks(req.body?.blocks);
  const sessionBinding = getBindingBySessionKey(sessionKey);

  if (!sessionBinding) return res.status(404).json({ error: 'Session not found.' });
  if (!text && !inputBlocks.length) return res.status(400).json({ error: 'Message is empty.' });

  try {
    const result = await runUserTurn(sessionBinding, { text, inputBlocks });
    res.json({ ok: true, message: result.message });
  } catch (error) {
    res.status(500).json({ ok: false, error: formatError(error) });
  }
});

app.post('/api/openclaw-webchat/sessions/:sessionKey/command', async (req, res) => {
  const { sessionKey } = req.params;
  const command = String(req.body?.command || '').trim();
  const sessionBinding = getBindingBySessionKey(sessionKey);

  if (!sessionBinding) return res.status(404).json({ error: 'Session not found.' });
  if (!command.startsWith('/')) return res.status(400).json({ error: 'Invalid slash command.' });

  try {
    const result = await runSlashCommand(sessionBinding, command);
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ error: formatError(error) });
  }
});

app.patch('/api/openclaw-webchat/agents/:agentId/profile', (req, res) => {
  const { agentId } = req.params;
  const displayName = normalizeOptionalString(req.body?.displayName);
  const avatarUrl = normalizeOptionalString(req.body?.avatarUrl);

  try {
    const profiles = readJson(PROFILES_FILE);
    const current = profiles[agentId] || {};
    profiles[agentId] = {
      ...current,
      agentId,
      displayName,
      avatarUrl,
      updatedAt: new Date().toISOString()
    };
    writeJson(PROFILES_FILE, profiles);
    res.json({ ok: true, profile: profiles[agentId] });
  } catch (error) {
    res.status(500).json({ error: formatError(error) });
  }
});

app.get('/api/openclaw-webchat/settings', (_req, res) => {
  try {
    const userProfile = readJson(USER_PROFILE_FILE);
    res.json({ userProfile });
  } catch (error) {
    res.status(500).json({ error: formatError(error) });
  }
});

app.patch('/api/openclaw-webchat/settings/user-profile', (req, res) => {
  const displayName = normalizeOptionalString(req.body?.displayName) || '我';
  const avatarUrl = normalizeOptionalString(req.body?.avatarUrl);

  try {
    const next = {
      displayName,
      avatarUrl,
      updatedAt: new Date().toISOString()
    };
    writeJson(USER_PROFILE_FILE, next);
    res.json({ ok: true, userProfile: next });
  } catch (error) {
    res.status(500).json({ error: formatError(error) });
  }
});

app.get('/api/openclaw-webchat/media', (req, res) => {
  const token = String(req.query.token || '');
  const payload = verifyMediaToken(token);
  if (!payload) return res.status(403).send('Invalid or expired token');
  if (!isAllowedMediaPath(payload.path)) return res.status(403).send('Path not allowed');
  if (!fs.existsSync(payload.path)) return res.status(404).send('Not found');
  res.sendFile(payload.path);
});

app.get('*', (_req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`[openclaw-webchat] listening on http://localhost:${PORT}`);
});

async function runUserTurn(binding, { text, inputBlocks }) {
  const userBlocks = [];
  if (text) userBlocks.push({ type: 'text', text });
  userBlocks.push(...inputBlocks);

  const userMessage = {
    id: cryptoId(),
    role: 'user',
    createdAt: new Date().toISOString(),
    blocks: userBlocks
  };

  appendHistory(binding.agentId, binding.sessionKey, userMessage);
  patchBinding(binding.agentId, {
    replyState: 'running',
    lastUserAt: userMessage.createdAt,
    updatedAt: new Date().toISOString()
  });

  try {
    await ensureBootstrapInjected(binding);

    const idempotencyKey = `openclaw-webchat-${Date.now()}-${cryptoId()}`;
    const startedAt = Date.now();
    const upstreamMessage = buildUpstreamMessage(userBlocks);

    await gatewayCall('chat.send', {
      sessionKey: binding.upstreamSessionKey,
      message: upstreamMessage,
      deliver: false,
      idempotencyKey
    });

    const assistantRaw = await waitForAssistantReply(binding.upstreamSessionKey, {
      minTimestampMs: startedAt,
      expectedUserText: upstreamMessage,
      timeoutMs: ASSISTANT_WAIT_TIMEOUT_MS
    });

    const assistantBlocks = assistantRaw ? normalizeGatewayMessageToBlocks(assistantRaw) : [];
    const assistantMessage = normalizeHistoryRow({
      id: cryptoId(),
      agentId: binding.agentId,
      sessionKey: binding.sessionKey,
      role: 'assistant',
      createdAt: assistantRaw?.createdAt || assistantRaw?.timestamp || new Date().toISOString(),
      blocks: assistantBlocks.length
        ? assistantBlocks
        : [{ type: 'text', text: '（收到，但未拉取到可展示回复）' }]
    });

    appendHistory(binding.agentId, binding.sessionKey, assistantMessage);
    patchBinding(binding.agentId, {
      replyState: 'idle',
      lastAssistantAt: assistantMessage.createdAt,
      lastSummary: buildMessageSummary(assistantMessage),
      updatedAt: new Date().toISOString()
    });

    return { message: presentHistoryEntry(assistantMessage) };
  } catch (error) {
    patchBinding(binding.agentId, {
      replyState: 'idle',
      updatedAt: new Date().toISOString()
    });
    throw error;
  }
}

async function runSlashCommand(binding, command) {
  const [nameRaw] = command.split(/\s+/, 1);
  const name = String(nameRaw || '').toLowerCase();

  if (name !== '/new') {
    throw new Error(`Unsupported slash command: ${command}`);
  }

  await gatewayCall('sessions.reset', { key: binding.upstreamSessionKey });
  patchBinding(binding.agentId, {
    bootstrapVersion: null,
    replyState: 'idle',
    updatedAt: new Date().toISOString()
  });

  await ensureBootstrapInjected(getBinding(binding.agentId));

  const marker = normalizeHistoryRow({
    id: cryptoId(),
    agentId: binding.agentId,
    sessionKey: binding.sessionKey,
    role: 'marker',
    createdAt: new Date().toISOString(),
    markerType: 'context-reset',
    label: '已重置上下文'
  });
  appendHistory(binding.agentId, binding.sessionKey, marker);
  patchBinding(binding.agentId, {
    lastSummary: '已重置上下文',
    updatedAt: new Date().toISOString()
  });

  return {
    command,
    message: presentHistoryEntry(marker)
  };
}

function ensureBinding(agentId) {
  const bindings = readJson(BINDINGS_FILE);
  const existing = bindings[agentId];
  if (existing) return existing;

  const now = new Date().toISOString();
  const created = {
    agentId,
    namespace: NAMESPACE,
    sessionKey: `${NAMESPACE}:${agentId}`,
    upstreamSessionKey: buildUpstreamSessionKey(agentId),
    bootstrapVersion: null,
    replyState: 'idle',
    createdAt: now,
    updatedAt: now,
    lastSummary: ''
  };

  bindings[agentId] = created;
  writeJson(BINDINGS_FILE, bindings);
  return created;
}

function getBinding(agentId) {
  const bindings = readJson(BINDINGS_FILE);
  return bindings[agentId] || null;
}

function getBindingBySessionKey(sessionKey) {
  const bindings = readJson(BINDINGS_FILE);
  return Object.values(bindings).find((item) => item.sessionKey === sessionKey) || null;
}

function patchBinding(agentId, patch) {
  const bindings = readJson(BINDINGS_FILE);
  if (!bindings[agentId]) throw new Error(`Binding not found: ${agentId}`);
  bindings[agentId] = { ...bindings[agentId], ...patch };
  writeJson(BINDINGS_FILE, bindings);
  return bindings[agentId];
}

async function ensureBootstrapInjected(binding) {
  const latest = getBinding(binding.agentId) || binding;
  if (latest.bootstrapVersion === BOOTSTRAP_VERSION) return latest;

  await gatewayCall('chat.send', {
    sessionKey: latest.upstreamSessionKey,
    message: BOOTSTRAP_TEXT,
    deliver: false,
    idempotencyKey: `openclaw-webchat-bootstrap-${latest.agentId}-${Date.now()}`
  });

  return patchBinding(latest.agentId, {
    bootstrapVersion: BOOTSTRAP_VERSION,
    bootstrapUpdatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

function buildUpstreamSessionKey(agentId) {
  return `agent:${agentId}:${NAMESPACE}:main`;
}

function buildUpstreamMessage(blocks) {
  const textParts = [];
  const attachmentHints = [];

  for (const block of blocks) {
    if (block.type === 'text' && block.text) {
      textParts.push(String(block.text).trim());
      continue;
    }

    if (['image', 'audio', 'video', 'file'].includes(block.type)) {
      const source = String(block.source || '').trim();
      if (!source) continue;
      attachmentHints.push(`- ${block.type}: ${source}`);
    }
  }

  if (!attachmentHints.length) return textParts.join('\n\n').trim();

  return [
    textParts.join('\n\n').trim(),
    '[openclaw-webchat user attachments]',
    'The user uploaded the following files. Use them as input context if relevant, but do not mention this wrapper format unless needed.',
    ...attachmentHints
  ].filter(Boolean).join('\n');
}

async function waitForAssistantReply(sessionKey, { minTimestampMs, expectedUserText, timeoutMs }) {
  const deadline = Date.now() + timeoutMs;
  const expected = canonicalizeText(expectedUserText);

  while (Date.now() < deadline) {
    const history = await gatewayCall('chat.history', { sessionKey, limit: 120 });
    const messages = Array.isArray(history?.messages) ? history.messages : [];
    const userIndex = findMatchingUserMessageIndex(messages, expected, minTimestampMs);
    const scanStart = userIndex >= 0 ? userIndex + 1 : 0;

    for (let index = messages.length - 1; index >= scanStart; index -= 1) {
      const message = messages[index];
      if (String(message?.role || '').toLowerCase() !== 'assistant') continue;
      if (getMessageTimestampMs(message) < minTimestampMs) continue;

      const blocks = normalizeGatewayMessageToBlocks(message);
      if (!blocks.length) continue;
      if (isNoReplyOnly(blocks)) continue;
      return message;
    }

    await sleep(800);
  }

  return null;
}

function findMatchingUserMessageIndex(messages, expectedUserText, minTimestampMs) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (String(message?.role || '').toLowerCase() !== 'user') continue;
    if (getMessageTimestampMs(message) < minTimestampMs) continue;
    const actual = canonicalizeText(extractTextFromGatewayMessage(message));
    if (actual && actual === expectedUserText) return index;
  }
  return -1;
}

function normalizeGatewayMessageToBlocks(message) {
  const blocks = [];
  const content = Array.isArray(message?.content) ? message.content : [];

  for (const item of content) {
    if (!item || typeof item !== 'object') continue;

    if (item.type === 'text' && item.text) {
      blocks.push(...parseTextIntoBlocks(String(item.text)));
      continue;
    }

    const mediaBlock = normalizeMediaLikeItem(item);
    if (mediaBlock) blocks.push(mediaBlock);
  }

  const topLevelAttachments = Array.isArray(message?.attachments) ? message.attachments : [];
  for (const attachment of topLevelAttachments) {
    const mediaBlock = normalizeMediaLikeItem(attachment);
    if (mediaBlock) blocks.push(mediaBlock);
  }

  return dedupeBlocks(blocks);
}

function normalizeMediaLikeItem(item) {
  const directType = String(item?.type || '').toLowerCase();
  const hintedType = String(item?.mimeType || item?.contentType || '').toLowerCase();
  const source = firstNonEmpty(
    item?.mediaUrl,
    item?.url,
    item?.source?.url,
    item?.source?.path,
    item?.path,
    item?.filePath,
    item?.href
  );

  if (!source) return null;

  let type = null;
  if (['image', 'audio', 'video', 'file'].includes(directType)) {
    type = directType;
  } else if (hintedType.startsWith('image/')) {
    type = 'image';
  } else if (hintedType.startsWith('audio/')) {
    type = 'audio';
  } else if (hintedType.startsWith('video/')) {
    type = 'video';
  } else {
    type = guessMediaTypeByPath(source);
  }

  return {
    type,
    source: cleanMediaValue(source),
    name: normalizeOptionalString(item?.name || item?.filename || item?.fileName) || undefined
  };
}

function parseTextIntoBlocks(rawText) {
  const text = String(rawText || '').trim();
  if (!text) return [];

  const mediaValues = [];
  const textLines = [];

  for (const originalLine of text.split('\n')) {
    const line = String(originalLine || '').trim();
    if (!line) continue;

    const unbulleted = line.replace(/^[-*•]\s*/, '').trim();
    const mediaMatch = unbulleted.match(/^mediaUrl\s*[:：]\s*(.+)$/i);
    if (mediaMatch?.[1]) {
      mediaValues.push(cleanMediaValue(mediaMatch[1]));
      continue;
    }

    const mediaDirective = unbulleted.match(/^MEDIA\s*:\s*(.+)$/);
    if (mediaDirective?.[1]) {
      mediaValues.push(cleanMediaValue(mediaDirective[1]));
      continue;
    }

    const textMatch = unbulleted.match(/^text\s*[:：]\s*(.+)$/i);
    if (textMatch?.[1]) {
      textLines.push(textMatch[1].trim());
      continue;
    }

    const mixedMedia = unbulleted.match(/^(.*?)(?:\s+)?mediaUrl\s*[:：]\s*(.+)$/i);
    if (mixedMedia?.[2]) {
      const maybeText = mixedMedia[1].trim();
      if (maybeText) textLines.push(maybeText);
      mediaValues.push(cleanMediaValue(mixedMedia[2]));
      continue;
    }

    const mixedDirective = unbulleted.match(/^(.*?)(?:\s+)?MEDIA\s*:\s*(.+)$/);
    if (mixedDirective?.[2]) {
      const maybeText = mixedDirective[1].trim();
      if (maybeText) textLines.push(maybeText);
      mediaValues.push(cleanMediaValue(mixedDirective[2]));
      continue;
    }

    textLines.push(unbulleted.replace(/^[\]\s]+/, '').trim());
  }

  const blocks = [];
  const cleanText = textLines.join('\n').trim();
  if (cleanText) blocks.push({ type: 'text', text: cleanText });

  for (const mediaValue of mediaValues.filter(Boolean)) {
    blocks.push({ type: guessMediaTypeByPath(mediaValue), source: mediaValue, name: path.basename(mediaValue) });
  }

  return dedupeBlocks(blocks);
}

function normalizeInputBlocks(value) {
  if (!Array.isArray(value)) return [];
  const blocks = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const type = String(item.type || '').toLowerCase();
    if (!['image', 'audio', 'video', 'file'].includes(type)) continue;
    const source = normalizeOptionalString(item.source || item.url || item.path || item.filePath);
    if (!source) continue;
    blocks.push({
      type,
      source,
      name: normalizeOptionalString(item.name || item.filename || item.fileName) || path.basename(source)
    });
  }

  return dedupeBlocks(blocks);
}

function appendHistory(agentId, sessionKey, message) {
  const row = normalizeHistoryRow({
    agentId,
    sessionKey,
    ...message
  });

  fs.appendFileSync(historyFile(agentId), `${JSON.stringify(row)}\n`, 'utf8');
}

function getHistoryPage({ agentId, limit, before }) {
  const rows = loadHistory(agentId).sort(compareHistoryAsc);
  const cursor = before ? decodeCursor(before) : null;
  const filtered = cursor ? rows.filter((row) => compareHistoryKey(row, cursor) < 0) : rows;
  const start = Math.max(0, filtered.length - limit);
  const page = filtered.slice(start);
  const hasMore = start > 0;
  const nextBefore = hasMore && page[0] ? encodeCursor(page[0]) : null;

  return {
    messages: page.map(presentHistoryEntry),
    hasMore,
    nextBefore
  };
}

function loadHistory(agentId) {
  const filePath = historyFile(agentId);
  if (!fs.existsSync(filePath)) return [];

  const rows = [];
  const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
  for (let index = 0; index < lines.length; index += 1) {
    try {
      const parsed = JSON.parse(lines[index]);
      const normalized = normalizeHistoryRow(parsed);
      normalized._seq = index;
      rows.push(normalized);
    } catch {
      // ignore malformed line
    }
  }
  return rows;
}

function getLatestHistoryEntry(agentId) {
  const rows = loadHistory(agentId);
  if (!rows.length) return null;
  rows.sort(compareHistoryAsc);
  return rows[rows.length - 1] || null;
}

function normalizeHistoryRow(row) {
  const role = String(row?.role || '').toLowerCase();
  if (role === 'marker') {
    return {
      id: String(row.id || cryptoId()),
      agentId: String(row.agentId || ''),
      sessionKey: String(row.sessionKey || ''),
      role: 'marker',
      createdAt: toIsoString(row.createdAt),
      markerType: String(row.markerType || 'generic'),
      label: String(row.label || '标记')
    };
  }

  return {
    id: String(row?.id || cryptoId()),
    agentId: String(row?.agentId || ''),
    sessionKey: String(row?.sessionKey || ''),
    role: role === 'assistant' ? 'assistant' : 'user',
    createdAt: toIsoString(row?.createdAt),
    blocks: dedupeBlocks(Array.isArray(row?.blocks) ? row.blocks : [])
  };
}

function presentHistoryEntry(row) {
  if (row.role === 'marker') {
    return {
      id: row.id,
      role: 'marker',
      createdAt: row.createdAt,
      markerType: row.markerType,
      label: row.label
    };
  }

  return {
    id: row.id,
    role: row.role,
    createdAt: row.createdAt,
    blocks: row.blocks.map(presentBlock)
  };
}

function presentBlock(block) {
  if (block.type === 'text') {
    return { type: 'text', text: String(block.text || '') };
  }

  const source = normalizeOptionalString(block.source);
  if (!source) {
    return {
      type: block.type,
      invalid: true,
      invalidReason: '文件丢失',
      name: block.name || null
    };
  }

  if (source.startsWith('/')) {
    const resolved = path.resolve(source);
    if (!fs.existsSync(resolved)) {
      return {
        type: block.type,
        invalid: true,
        invalidReason: '文件丢失',
        name: block.name || path.basename(source)
      };
    }

    const token = signMediaToken(resolved);
    return {
      type: block.type,
      url: `/api/openclaw-webchat/media?token=${encodeURIComponent(token)}`,
      name: block.name || path.basename(source)
    };
  }

  return {
    type: block.type,
    url: source,
    name: block.name || null
  };
}

function buildMessageSummary(row) {
  if (!row) return '';
  if (row.role === 'marker') return row.label || '已重置上下文';

  const blocks = Array.isArray(row.blocks) ? row.blocks : [];
  const textBlock = blocks.find((block) => block.type === 'text' && String(block.text || '').trim());
  if (textBlock) return summarizeText(textBlock.text);

  const firstMedia = blocks.find((block) => ['image', 'audio', 'video', 'file'].includes(block.type));
  if (!firstMedia) return '';

  if (firstMedia.type === 'image') return '[图片]';
  if (firstMedia.type === 'audio') return '[音频]';
  if (firstMedia.type === 'video') return '[视频]';
  return '[文件]';
}

function summarizeText(text) {
  const singleLine = String(text || '').replace(/\s+/g, ' ').trim();
  if (!singleLine) return '';
  return singleLine.length > 48 ? `${singleLine.slice(0, 47)}…` : singleLine;
}

async function listAgents() {
  const bindings = readJson(BINDINGS_FILE);
  const ids = new Set(Object.keys(bindings));
  const root = path.resolve(process.env.HOME || '', '.openclaw/agents');

  if (fs.existsSync(root)) {
    for (const entry of fs.readdirSync(root)) {
      const fullPath = path.join(root, entry);
      try {
        if (fs.statSync(fullPath).isDirectory()) ids.add(entry);
      } catch {
        // ignore bad entries
      }
    }
  }

  return [...ids].filter(Boolean);
}

async function gatewayCall(method, params) {
  const args = [
    'gateway',
    'call',
    method,
    '--json',
    '--timeout',
    '120000',
    '--params',
    JSON.stringify(params || {})
  ];

  const { stdout, stderr } = await execFileAsync(OPENCLAW_BIN, args, {
    cwd: process.cwd(),
    maxBuffer: 5 * 1024 * 1024
  });

  const raw = String(stdout || '').trim() || '{}';
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`gateway ${method} returned non-JSON: ${stderr || raw.slice(0, 300)}`);
  }
}

function extractTextFromGatewayMessage(message) {
  const content = Array.isArray(message?.content) ? message.content : [];
  return content
    .filter((item) => item?.type === 'text' && item?.text)
    .map((item) => String(item.text))
    .join('\n')
    .trim();
}

function getMessageTimestampMs(message) {
  return normalizeEpochToMs(message?.timestamp || message?.createdAt);
}

function normalizeEpochToMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 10_000_000_000 ? value : value * 1000;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
      return normalizeEpochToMs(Number(trimmed));
    }
    const parsed = Date.parse(trimmed);
    if (Number.isFinite(parsed)) return parsed;
  }

  return 0;
}

function canonicalizeText(value) {
  return String(value || '').replace(/\r\n/g, '\n').trim();
}

function isNoReplyOnly(blocks) {
  return blocks.length === 1 && blocks[0].type === 'text' && String(blocks[0].text || '').trim() === 'NO_REPLY';
}

function dedupeBlocks(blocks) {
  const out = [];
  const seen = new Set();

  for (const block of blocks || []) {
    const normalized = normalizeBlock(block);
    if (!normalized) continue;
    const key = JSON.stringify(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }

  return out;
}

function normalizeBlock(block) {
  if (!block || typeof block !== 'object') return null;
  if (block.type === 'text') {
    const text = String(block.text || '').trim();
    if (!text) return null;
    return { type: 'text', text };
  }

  const type = String(block.type || '').toLowerCase();
  if (!['image', 'audio', 'video', 'file'].includes(type)) return null;
  const source = normalizeOptionalString(block.source || block.url || block.path || block.filePath);
  return {
    type,
    source: source || null,
    name: normalizeOptionalString(block.name) || undefined
  };
}

function guessMediaTypeByPath(value) {
  const lower = String(value || '').split('?')[0].toLowerCase();
  if (/\.(png|jpg|jpeg|gif|webp|bmp|svg)$/.test(lower)) return 'image';
  if (/\.(mp3|wav|m4a|aac|ogg|flac|opus)$/.test(lower)) return 'audio';
  if (/\.(mp4|mov|webm|m4v|mkv)$/.test(lower)) return 'video';
  return 'file';
}

function cleanMediaValue(value) {
  return String(value || '')
    .trim()
    .replace(/^['"`“”‘’]+|['"`“”‘’]+$/g, '')
    .replace(/[。！!，,；;]+$/g, '');
}

function signMediaToken(filePath) {
  const payload = { path: path.resolve(filePath), exp: Date.now() + 15 * 60 * 1000 };
  const payloadJson = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', MEDIA_SECRET).update(payloadJson).digest('hex');
  return Buffer.from(JSON.stringify({ payload, sig })).toString('base64url');
}

function verifyMediaToken(token) {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    const payloadJson = JSON.stringify(decoded.payload);
    const expectedSig = crypto.createHmac('sha256', MEDIA_SECRET).update(payloadJson).digest('hex');
    if (decoded.sig !== expectedSig) return null;
    if (!decoded.payload?.exp || Date.now() > decoded.payload.exp) return null;
    return decoded.payload;
  } catch {
    return null;
  }
}

function isAllowedMediaPath(filePath) {
  const normalized = path.resolve(filePath);
  const home = path.resolve(process.env.HOME || '/');
  const allowedRoots = [
    path.resolve(process.env.HOME || '', '.openclaw'),
    home
  ];
  return allowedRoots.some((root) => normalized.startsWith(root));
}

function historyFile(agentId) {
  return path.join(HISTORY_DIR, `${String(agentId).replace(/[^a-zA-Z0-9._-]/g, '_')}.jsonl`);
}

function encodeCursor(row) {
  return Buffer.from(JSON.stringify({ createdAt: row.createdAt, id: row.id, seq: row._seq ?? null })).toString('base64url');
}

function decodeCursor(value) {
  try {
    return JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function compareHistoryAsc(a, b) {
  const tsDiff = Date.parse(a.createdAt) - Date.parse(b.createdAt);
  if (tsDiff !== 0) return tsDiff;
  const seqA = Number.isFinite(Number(a._seq)) ? Number(a._seq) : null;
  const seqB = Number.isFinite(Number(b._seq)) ? Number(b._seq) : null;
  if (seqA !== null && seqB !== null && seqA !== seqB) return seqA - seqB;
  return String(a.id || '').localeCompare(String(b.id || ''));
}

function compareHistoryKey(row, cursor) {
  if (!cursor) return 0;
  const tsDiff = Date.parse(row.createdAt) - Date.parse(cursor.createdAt);
  if (tsDiff !== 0) return tsDiff;
  const seqRow = Number.isFinite(Number(row._seq)) ? Number(row._seq) : null;
  const seqCursor = Number.isFinite(Number(cursor.seq)) ? Number(cursor.seq) : null;
  if (seqRow !== null && seqCursor !== null && seqRow !== seqCursor) return seqRow - seqCursor;
  return String(row.id || '').localeCompare(String(cursor.id || ''));
}

function compareAgentListItems(a, b) {
  const tsA = Date.parse(a.lastMessageAt || 0) || 0;
  const tsB = Date.parse(b.lastMessageAt || 0) || 0;
  if (tsA !== tsB) return tsB - tsA;
  return String(a.agentId).localeCompare(String(b.agentId));
}

function isTimestampRecent(value, windowMs) {
  const ts = Date.parse(String(value || ''));
  return Number.isFinite(ts) && Date.now() - ts <= windowMs;
}

function normalizeOptionalString(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const normalized = normalizeOptionalString(value);
    if (normalized) return normalized;
  }
  return null;
}

function toIsoString(value) {
  if (!value) return new Date().toISOString();
  const numeric = normalizeEpochToMs(value);
  if (numeric) return new Date(numeric).toISOString();
  const parsed = Date.parse(String(value));
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  return new Date().toISOString();
}

function clampInt(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function ensureJsonFile(filePath, fallbackText) {
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, fallbackText, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function cryptoId() {
  return crypto.randomBytes(6).toString('hex');
}

function formatError(error) {
  return String(error?.message || error || 'Unknown error');
}
