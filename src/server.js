import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFile, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import { parseTextIntoBlocks } from '../public/message-blocks.js';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.OPENCLAW_WEBCHAT_PORT || 3770);
const OPENCLAW_BIN = process.env.OPENCLAW_BIN || 'openclaw';
const DATA_DIR = path.resolve(process.env.OPENCLAW_WEBCHAT_DATA_DIR || path.resolve(__dirname, '../data'));
const BINDINGS_FILE = path.join(DATA_DIR, 'session-bindings.json');
const PROFILES_FILE = path.join(DATA_DIR, 'agent-profiles.json');
const USER_PROFILE_FILE = path.join(DATA_DIR, 'user-profile.json');
const HISTORY_DIR = path.join(DATA_DIR, 'history');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const MEDIA_SECRET = process.env.OPENCLAW_WEBCHAT_MEDIA_SECRET || 'openclaw-webchat-local-secret';
const HISTORY_PAGE_LIMIT_MAX = 200;
const HISTORY_OPEN_PAGE_LIMIT = Number(process.env.OPENCLAW_WEBCHAT_OPEN_PAGE_LIMIT || 15);
const NAMESPACE = 'openclaw-webchat';
const BOOTSTRAP_VERSION = '2026-03-16.phase2';
const ACTIVE_RECENT_WINDOW_MS = 5 * 60 * 1000;
const ASSISTANT_WAIT_TIMEOUT_MS = Number(process.env.OPENCLAW_WEBCHAT_ASSISTANT_WAIT_TIMEOUT_MS || 120000);
const ASSISTANT_LATE_REPLY_TIMEOUT_MS = Number(process.env.OPENCLAW_WEBCHAT_LATE_REPLY_TIMEOUT_MS || 10 * 60 * 1000);
const MAX_IMAGE_UPLOAD_BYTES = Number(process.env.OPENCLAW_WEBCHAT_MAX_IMAGE_UPLOAD_BYTES || 10 * 1024 * 1024);
const MAX_AUDIO_UPLOAD_BYTES = Number(process.env.OPENCLAW_WEBCHAT_MAX_AUDIO_UPLOAD_BYTES || 20 * 1024 * 1024);
const WHISPER_BIN = process.env.OPENCLAW_WEBCHAT_WHISPER_BIN || 'whisper';
const WHISPER_MODEL = process.env.OPENCLAW_WEBCHAT_WHISPER_MODEL || 'tiny';
const WHISPER_TIMEOUT_MS = Number(process.env.OPENCLAW_WEBCHAT_WHISPER_TIMEOUT_MS || 45000);
const lateReplyReconciliations = new Set();

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


const SLASH_COMMAND_DEFS = [
  { name: '/new', description: '重置上游上下文并保留本地历史', category: 'session' },
  { name: '/reset', description: '等同 /new', category: 'session' },
  { name: '/model', description: '查看或设置当前模型', args: '<name>', category: 'model' },
  { name: '/models', description: '查看可用模型列表（/model 别名）', args: '<name>', category: 'model' },
  { name: '/think', description: '查看或设置 thinking level', args: '<level>', category: 'model' },
  { name: '/fast', description: '查看或设置 fast mode', args: '<status|on|off>', category: 'model' },
  { name: '/verbose', description: '查看或设置 verbose level', args: '<on|off|full>', category: 'model' },
  { name: '/compact', description: '压缩当前上游 session transcript', category: 'session' },
  { name: '/help', description: '显示本地 slash 命令帮助', category: 'tools' }
];

app.use(express.json({ limit: '25mb' }));
app.use('/static', express.static(path.resolve(__dirname, '../public'), {
  etag: true,
  setHeaders(res) {
    res.setHeader('Cache-Control', 'no-store, must-revalidate');
  }
}));

ensureDir(DATA_DIR);
ensureDir(HISTORY_DIR);
ensureDir(UPLOADS_DIR);
ensureJsonFile(BINDINGS_FILE, '{}');
ensureJsonFile(PROFILES_FILE, '{}');
ensureJsonFile(USER_PROFILE_FILE, JSON.stringify({ displayName: '我', avatarUrl: null }, null, 2));

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, service: NAMESPACE, port: PORT, namespace: NAMESPACE });
});

app.get('/api/openclaw-webchat/commands', (_req, res) => {
  res.json({
    commands: SLASH_COMMAND_DEFS,
    allowed: SLASH_COMMAND_DEFS.map((item) => item.name),
    updatedAt: new Date().toISOString()
  });
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

    const { messages, nextBefore, hasMore } = getHistoryPage({ agentId, limit: HISTORY_OPEN_PAGE_LIMIT, before: null });
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

app.post('/api/openclaw-webchat/uploads', (req, res) => {
  const kind = String(req.body?.kind || '').toLowerCase();
  const filename = normalizeOptionalString(req.body?.filename) || 'upload';
  const mimeType = normalizeOptionalString(req.body?.mimeType) || 'application/octet-stream';
  const contentBase64 = normalizeOptionalString(req.body?.contentBase64);
  const transcribe = req.body?.transcribe !== false;

  if (!['image', 'audio'].includes(kind)) {
    return res.status(400).json({ error: 'Only image and audio uploads are supported right now.' });
  }

  if (!contentBase64) {
    return res.status(400).json({ error: 'Upload content is empty.' });
  }

  if (!isSupportedUploadMime(kind, mimeType) && !isUploadFilenameKind(kind, filename)) {
    return res.status(400).json({ error: `Unsupported ${kind} type.` });
  }

  try {
    const buffer = Buffer.from(contentBase64, 'base64');
    if (!buffer.length) {
      return res.status(400).json({ error: 'Upload content is empty.' });
    }

    const maxBytes = kind === 'audio' ? MAX_AUDIO_UPLOAD_BYTES : MAX_IMAGE_UPLOAD_BYTES;
    if (buffer.byteLength > maxBytes) {
      return res.status(413).json({ error: `${kind === 'audio' ? 'Audio' : 'Image'} is too large. Limit is ${Math.floor(maxBytes / (1024 * 1024))} MB.` });
    }

    const stored = persistUpload({ kind, filename, mimeType, buffer });
    const block = {
      type: kind,
      source: stored.filePath,
      name: stored.displayName,
      mimeType,
      sizeBytes: buffer.byteLength
    };

    if (kind === 'audio' && transcribe) {
      const transcription = transcribeAudioFile(stored.filePath, stored.displayName);
      if (transcription.ok) {
        block.transcriptStatus = 'ready';
        block.transcriptText = transcription.text;
      } else {
        block.transcriptStatus = 'failed';
        block.transcriptError = transcription.error;
      }
    }

    res.json({
      ok: true,
      upload: {
        kind,
        source: stored.filePath,
        name: stored.displayName,
        size: buffer.byteLength,
        mimeType,
        transcriptStatus: block.transcriptStatus || null,
        transcriptText: block.transcriptText || null,
        transcriptError: block.transcriptError || null
      },
      block: presentBlock(block)
    });
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
  res.setHeader('Cache-Control', 'no-store, must-revalidate');
  res.sendFile(path.resolve(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`[openclaw-webchat] listening on http://localhost:${PORT}`);
});

async function runUserTurn(binding, { text, inputBlocks }) {
  const latestBinding = getBinding(binding.agentId) || binding;
  const turnSnapshot = {
    upstreamSessionKey: latestBinding.upstreamSessionKey,
    upstreamGeneration: latestBinding.upstreamGeneration || null
  };

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
    await ensureBootstrapInjected(latestBinding);

    const idempotencyKey = `openclaw-webchat-${Date.now()}-${cryptoId()}`;
    const startedAt = Date.now();
    const upstreamMessage = buildUpstreamMessage(userBlocks);

    await gatewayCall('chat.send', {
      sessionKey: turnSnapshot.upstreamSessionKey,
      message: upstreamMessage,
      deliver: false,
      idempotencyKey
    });

    const assistantRaw = await waitForAssistantReply(turnSnapshot.upstreamSessionKey, {
      minTimestampMs: startedAt,
      expectedUserText: upstreamMessage,
      timeoutMs: ASSISTANT_WAIT_TIMEOUT_MS
    });

    if (!isBindingTurnCurrent(binding.agentId, turnSnapshot)) {
      return {
        message: presentHistoryEntry(normalizeHistoryRow({
          id: cryptoId(),
          agentId: binding.agentId,
          sessionKey: binding.sessionKey,
          role: 'assistant',
          createdAt: new Date().toISOString(),
          blocks: [{ type: 'text', text: '（上一轮回复已因上下文重置而忽略）' }]
        }))
      };
    }

    if (!assistantRaw) {
      const pendingMessage = recordAssistantTextMessage(latestBinding, '（处理中，稍后自动补回）', {
        replyState: 'running'
      });
      scheduleLateAssistantReplyReconciliation(latestBinding, {
        turnSnapshot,
        minTimestampMs: startedAt,
        expectedUserText: upstreamMessage
      });
      return { message: pendingMessage };
    }

    const assistantBlocks = normalizeGatewayMessageToBlocks(assistantRaw);
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
    if (isBindingTurnCurrent(binding.agentId, turnSnapshot)) {
      patchBinding(binding.agentId, {
        replyState: 'idle',
        updatedAt: new Date().toISOString()
      });
    }
    throw error;
  }
}

async function runSlashCommand(binding, command) {
  const parsed = parseSlashCommand(command);
  if (!parsed) {
    throw new Error(`Invalid slash command: ${command}`);
  }

  const latestBinding = getBinding(binding.agentId) || binding;
  const { name, args } = parsed;

  if (name === '/new' || name === '/reset') {
    return runContextResetSlashCommand(latestBinding, command);
  }

  if (name === '/help') {
    return buildAssistantSlashResponse(latestBinding, command, buildSlashHelpText());
  }

  if (name === '/model' || name === '/models') {
    return runModelSlashCommand(latestBinding, command, name, args);
  }

  if (name === '/think') {
    return runThinkSlashCommand(latestBinding, command, args);
  }

  if (name === '/fast') {
    return runFastSlashCommand(latestBinding, command, args);
  }

  if (name === '/verbose') {
    return runVerboseSlashCommand(latestBinding, command, args);
  }

  if (name === '/compact') {
    return runCompactSlashCommand(latestBinding, command);
  }

  throw new Error(`Unsupported slash command: ${command}`);
}

async function runContextResetSlashCommand(binding, command) {
  const previousUpstreamSessionKey = binding.upstreamSessionKey;
  await gatewayCall('sessions.reset', { key: previousUpstreamSessionKey });

  const nextGeneration = createUpstreamGeneration();
  patchBinding(binding.agentId, {
    upstreamGeneration: nextGeneration,
    upstreamSessionKey: buildUpstreamSessionKey(binding.agentId, nextGeneration),
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

function buildAssistantSlashResponse(binding, command, text) {
  return {
    command,
    message: recordAssistantTextMessage(binding, text)
  };
}

async function runModelSlashCommand(binding, command, commandName, args) {
  const mode = String(args || '').trim();
  const normalizedMode = mode.toLowerCase();

  try {
    const [sessionState, modelsInfo] = await Promise.all([
      loadUpstreamSessionState(binding.upstreamSessionKey),
      gatewayCall('models.list', {})
    ]);
    const currentModel = normalizeOptionalString(sessionState?.session?.model)
      || normalizeOptionalString(sessionState?.defaults?.model)
      || 'default';
    const catalogModelIds = collectCatalogModelIds(modelsInfo?.models);
    const available = catalogModelIds.slice(0, 10);

    if (!mode || normalizedMode === 'list' || commandName === '/models') {
      const lines = [`当前模型：${currentModel}`];
      if (available.length) {
        lines.push(`可用模型：${available.join(', ')}${catalogModelIds.length > available.length ? ` +${catalogModelIds.length - available.length} more` : ''}`);
      }
      lines.push('提示：发送 /model <name> 切换模型。');
      return buildAssistantSlashResponse(binding, command, lines.join('\n'));
    }

    if (normalizedMode === 'status') {
      const detailLines = [
        '当前模型状态：',
        `- model: ${currentModel}`
      ];
      if (normalizeOptionalString(sessionState?.session?.modelProvider)) {
        detailLines.push(`- provider: ${sessionState.session.modelProvider}`);
      }
      if (normalizeOptionalString(sessionState?.session?.baseUrl)) {
        detailLines.push(`- baseUrl: ${sessionState.session.baseUrl}`);
      }
      if (normalizeOptionalString(sessionState?.session?.api)) {
        detailLines.push(`- api: ${sessionState.session.api}`);
      }
      return buildAssistantSlashResponse(binding, command, detailLines.join('\n'));
    }
  } catch (error) {
    return buildAssistantSlashResponse(binding, command, `获取模型信息失败：${formatError(error)}`);
  }

  const targetModel = mode;
  try {
    await gatewayCall('sessions.patch', { key: binding.upstreamSessionKey, model: targetModel });
    return buildAssistantSlashResponse(binding, command, `已设置模型：${targetModel}`);
  } catch (error) {
    return buildAssistantSlashResponse(binding, command, `设置模型失败：${formatError(error)}`);
  }
}

async function runThinkSlashCommand(binding, command, args) {
  const rawLevel = String(args || '').trim();

  if (!rawLevel) {
    try {
      const { session, models } = await loadThinkingCommandState(binding.upstreamSessionKey);
      const currentLevel = resolveCurrentThinkingLevel(session, models);
      const options = formatThinkingLevels(session?.modelProvider, session?.model);
      return buildAssistantSlashResponse(binding, command, `当前 thinking level：${currentLevel}\n可选：${options}`);
    } catch (error) {
      return buildAssistantSlashResponse(binding, command, `获取 thinking level 失败：${formatError(error)}`);
    }
  }

  const level = normalizeThinkLevel(rawLevel);
  if (!level) {
    try {
      const { session } = await loadThinkingCommandState(binding.upstreamSessionKey);
      return buildAssistantSlashResponse(
        binding,
        command,
        `未识别的 thinking level：${rawLevel}\n可选：${formatThinkingLevels(session?.modelProvider, session?.model)}`
      );
    } catch (error) {
      return buildAssistantSlashResponse(binding, command, `校验 thinking level 失败：${formatError(error)}`);
    }
  }

  try {
    await gatewayCall('sessions.patch', { key: binding.upstreamSessionKey, thinkingLevel: level });
    return buildAssistantSlashResponse(binding, command, `已设置 thinking level：${level}`);
  } catch (error) {
    return buildAssistantSlashResponse(binding, command, `设置 thinking level 失败：${formatError(error)}`);
  }
}

async function runFastSlashCommand(binding, command, args) {
  const mode = String(args || '').trim().toLowerCase();
  if (!mode || mode === 'status') {
    try {
      const sessionRow = await loadUpstreamSessionRow(binding.upstreamSessionKey);
      return buildAssistantSlashResponse(
        binding,
        command,
        `当前 fast mode：${resolveCurrentFastMode(sessionRow)}\n可选：status, on, off`
      );
    } catch (error) {
      return buildAssistantSlashResponse(binding, command, `获取 fast mode 失败：${formatError(error)}`);
    }
  }

  if (mode !== 'on' && mode !== 'off') {
    return buildAssistantSlashResponse(binding, command, `未识别的 fast mode：${args}\n可选：status, on, off`);
  }

  try {
    await gatewayCall('sessions.patch', { key: binding.upstreamSessionKey, fastMode: mode === 'on' });
    return buildAssistantSlashResponse(binding, command, `Fast mode 已${mode === 'on' ? '开启' : '关闭'}`);
  } catch (error) {
    return buildAssistantSlashResponse(binding, command, `设置 fast mode 失败：${formatError(error)}`);
  }
}

async function runVerboseSlashCommand(binding, command, args) {
  const rawLevel = String(args || '').trim();

  if (!rawLevel) {
    try {
      const sessionRow = await loadUpstreamSessionRow(binding.upstreamSessionKey);
      const currentLevel = normalizeVerboseLevel(sessionRow?.verboseLevel) || 'off';
      return buildAssistantSlashResponse(binding, command, `当前 verbose level：${currentLevel}\n可选：on, full, off`);
    } catch (error) {
      return buildAssistantSlashResponse(binding, command, `获取 verbose level 失败：${formatError(error)}`);
    }
  }

  const level = normalizeVerboseLevel(rawLevel);
  if (!level) {
    return buildAssistantSlashResponse(binding, command, `未识别的 verbose level：${rawLevel}\n可选：on, full, off`);
  }

  try {
    await gatewayCall('sessions.patch', { key: binding.upstreamSessionKey, verboseLevel: level });
    return buildAssistantSlashResponse(binding, command, `已设置 verbose level：${level}`);
  } catch (error) {
    return buildAssistantSlashResponse(binding, command, `设置 verbose level 失败：${formatError(error)}`);
  }
}

async function runCompactSlashCommand(binding, command) {
  try {
    const compactResult = await gatewayCall('sessions.compact', { key: binding.upstreamSessionKey });
    const compacted = compactResult?.compacted === true;
    const text = compacted
      ? `已压缩当前上游会话，上次保留 ${compactResult?.kept ?? 'unknown'} 行 transcript。`
      : `当前无需压缩：${compactResult?.reason || `已保留 ${compactResult?.kept ?? 'unknown'} 行`}`;
    return buildAssistantSlashResponse(binding, command, text);
  } catch (error) {
    return buildAssistantSlashResponse(binding, command, `压缩失败：${formatError(error)}`);
  }
}

function scheduleLateAssistantReplyReconciliation(binding, { turnSnapshot, minTimestampMs, expectedUserText }) {
  const key = `${binding.agentId}:${turnSnapshot.upstreamSessionKey}:${minTimestampMs}`;
  if (lateReplyReconciliations.has(key)) return;
  lateReplyReconciliations.add(key);

  void (async () => {
    try {
      const assistantRaw = await waitForAssistantReply(turnSnapshot.upstreamSessionKey, {
        minTimestampMs,
        expectedUserText,
        timeoutMs: ASSISTANT_LATE_REPLY_TIMEOUT_MS
      });

      const latestBinding = getBinding(binding.agentId);
      const isCurrent = isBindingTurnCurrent(binding.agentId, turnSnapshot);
      if (!latestBinding || !isCurrent) return;

      if (!assistantRaw) {
        patchBinding(binding.agentId, {
          replyState: 'idle',
          updatedAt: new Date().toISOString()
        });
        return;
      }

      const assistantBlocks = normalizeGatewayMessageToBlocks(assistantRaw);
      if (!assistantBlocks.length || isNoReplyOnly(assistantBlocks)) {
        patchBinding(binding.agentId, {
          replyState: 'idle',
          updatedAt: new Date().toISOString()
        });
        return;
      }

      const assistantMessage = normalizeHistoryRow({
        id: cryptoId(),
        agentId: binding.agentId,
        sessionKey: binding.sessionKey,
        role: 'assistant',
        createdAt: assistantRaw?.createdAt || assistantRaw?.timestamp || new Date().toISOString(),
        blocks: assistantBlocks
      });

      appendHistory(binding.agentId, binding.sessionKey, assistantMessage);
      patchBinding(binding.agentId, {
        replyState: 'idle',
        lastAssistantAt: assistantMessage.createdAt,
        lastSummary: buildMessageSummary(assistantMessage),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      if (isBindingTurnCurrent(binding.agentId, turnSnapshot)) {
        patchBinding(binding.agentId, {
          replyState: 'idle',
          updatedAt: new Date().toISOString()
        });
      }
      console.error('[openclaw-webchat] late reply reconciliation failed:', formatError(error));
    } finally {
      lateReplyReconciliations.delete(key);
    }
  })();
}

function parseSlashCommand(command) {
  const trimmed = String(command || '').trim();
  if (!trimmed.startsWith('/')) return null;
  const body = trimmed.slice(1);
  const firstSeparator = body.search(/[\s:]/u);
  const rawName = firstSeparator === -1 ? body : body.slice(0, firstSeparator);
  let remainder = firstSeparator === -1 ? '' : body.slice(firstSeparator).trimStart();
  if (remainder.startsWith(':')) remainder = remainder.slice(1).trimStart();
  const name = `/${String(rawName || '').trim().toLowerCase()}`;
  if (!name || name === '/') return null;
  return { name, args: remainder.trim() };
}

function buildSlashHelpText() {
  return [
    '可用本地命令：',
    ...SLASH_COMMAND_DEFS.map((item) => `- ${item.name}${item.args ? ` ${item.args}` : ''}：${item.description}`),
    '',
    '说明：这些命令在 openclaw-webchat 内本地执行，不会作为普通消息发给 agent。'
  ].join('\n');
}

function recordAssistantTextMessage(binding, text, patch = {}) {
  const message = normalizeHistoryRow({
    id: cryptoId(),
    agentId: binding.agentId,
    sessionKey: binding.sessionKey,
    role: 'assistant',
    createdAt: new Date().toISOString(),
    blocks: [{ type: 'text', text }]
  });
  appendHistory(binding.agentId, binding.sessionKey, message);
  patchBinding(binding.agentId, {
    replyState: 'idle',
    lastAssistantAt: message.createdAt,
    lastSummary: buildMessageSummary(message),
    updatedAt: new Date().toISOString(),
    ...patch
  });
  return presentHistoryEntry(message);
}

async function loadUpstreamSessionRow(sessionKey) {
  const state = await loadUpstreamSessionState(sessionKey);
  return state.session;
}

async function loadUpstreamSessionState(sessionKey) {
  const payload = await gatewayCall('sessions.list', {});
  const rows = Array.isArray(payload?.sessions) ? payload.sessions : [];
  return {
    session: rows.find((item) => item?.key === sessionKey) || null,
    defaults: payload?.defaults || null
  };
}

async function loadThinkingCommandState(sessionKey) {
  const [sessionState, modelsInfo] = await Promise.all([
    loadUpstreamSessionState(sessionKey),
    gatewayCall('models.list', {})
  ]);
  return {
    session: sessionState.session,
    models: Array.isArray(modelsInfo?.models) ? modelsInfo.models : []
  };
}

function collectCatalogModelIds(models) {
  const seen = new Set();
  const out = [];
  const rows = Array.isArray(models) ? models : [];

  for (const item of rows) {
    const modelId = normalizeOptionalString(item?.id);
    if (!modelId || seen.has(modelId)) continue;
    seen.add(modelId);
    out.push(modelId);
  }

  return out;
}

function normalizeThinkLevel(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return null;
  const collapsed = raw.replace(/[\s_-]+/g, '');
  if (collapsed === 'adaptive' || collapsed === 'auto') return 'adaptive';
  if (collapsed === 'xhigh' || collapsed === 'extrahigh') return 'xhigh';
  if (raw === 'off') return 'off';
  if (['on', 'enable', 'enabled'].includes(raw)) return 'low';
  if (['min', 'minimal', 'think'].includes(raw)) return 'minimal';
  if (['low', 'thinkhard', 'think-hard', 'think_hard'].includes(raw)) return 'low';
  if (['mid', 'med', 'medium', 'thinkharder', 'think-harder', 'harder'].includes(raw)) return 'medium';
  if (['high', 'ultra', 'ultrathink', 'think-hard', 'thinkhardest', 'highest', 'max'].includes(raw)) return 'high';
  return null;
}

function normalizeVerboseLevel(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return null;
  if (['off', 'false', 'no', '0'].includes(raw)) return 'off';
  if (['full', 'all', 'everything'].includes(raw)) return 'full';
  if (['on', 'minimal', 'true', 'yes', '1'].includes(raw)) return 'on';
  return null;
}

function resolveCurrentThinkingLevel(sessionRow, models = []) {
  const persisted = normalizeThinkLevel(sessionRow?.thinkingLevel);
  if (persisted) return persisted;
  if (!sessionRow?.modelProvider || !sessionRow?.model) return 'off';
  return resolveThinkingDefaultForModel({
    provider: sessionRow.modelProvider,
    model: sessionRow.model,
    catalog: models
  });
}

function resolveCurrentFastMode(sessionRow) {
  return sessionRow?.fastMode === true ? 'on' : 'off';
}

function formatThinkingLevels(provider, model) {
  return listThinkingLevelLabels(provider, model).join(', ');
}

function listThinkingLevelLabels(provider, model) {
  if (isBinaryThinkingProvider(provider)) {
    return ['off', 'on'];
  }
  return listThinkingLevels(provider, model);
}

function listThinkingLevels(provider, model) {
  const levels = ['off', 'minimal', 'low', 'medium', 'high'];
  if (supportsXHighThinking(provider, model)) {
    levels.push('xhigh');
  }
  levels.push('adaptive');
  return levels;
}

function supportsXHighThinking(provider, model) {
  const modelKey = String(model || '').trim().toLowerCase();
  if (!modelKey) return false;
  const providerKey = String(provider || '').trim().toLowerCase();
  const refs = new Set([
    'openai/gpt-5.4',
    'openai/gpt-5.4-pro',
    'openai/gpt-5.2',
    'openai-codex/gpt-5.4',
    'openai-codex/gpt-5.3-codex',
    'openai-codex/gpt-5.3-codex-spark',
    'openai-codex/gpt-5.2-codex',
    'openai-codex/gpt-5.1-codex',
    'github-copilot/gpt-5.2-codex',
    'github-copilot/gpt-5.2'
  ]);
  const modelIds = new Set([...refs].map((entry) => entry.split('/')[1]));
  return providerKey ? refs.has(`${providerKey}/${modelKey}`) : modelIds.has(modelKey);
}

function isBinaryThinkingProvider(provider) {
  return normalizeThinkingProvider(provider) === 'zai';
}

function normalizeThinkingProvider(provider) {
  const normalized = String(provider || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'z.ai' || normalized === 'z-ai') return 'zai';
  if (normalized === 'bedrock' || normalized === 'aws-bedrock') return 'amazon-bedrock';
  return normalized;
}

function resolveThinkingDefaultForModel({ provider, model, catalog = [] }) {
  const normalizedProvider = normalizeThinkingProvider(provider);
  const modelLower = String(model || '').trim().toLowerCase();
  const isAnthropicFamilyModel = normalizedProvider === 'anthropic'
    || normalizedProvider === 'amazon-bedrock'
    || modelLower.includes('anthropic/')
    || modelLower.includes('.anthropic.');
  if (isAnthropicFamilyModel && /claude-(?:opus|sonnet)-4(?:\.|-)6(?:$|[-.])/i.test(modelLower)) {
    return 'adaptive';
  }

  const candidate = Array.isArray(catalog)
    ? catalog.find((entry) =>
      normalizeThinkingProvider(entry?.provider) === normalizedProvider
      && String(entry?.id || '').trim().toLowerCase() === modelLower)
    : null;

  return candidate?.reasoning === true ? 'low' : 'off';
}

function ensureBinding(agentId) {
  const bindings = readJson(BINDINGS_FILE);
  const existing = bindings[agentId];
  if (existing) return existing;

  const now = new Date().toISOString();
  const upstreamGeneration = 'main';
  const created = {
    agentId,
    namespace: NAMESPACE,
    sessionKey: `${NAMESPACE}:${agentId}`,
    upstreamGeneration,
    upstreamSessionKey: buildUpstreamSessionKey(agentId, upstreamGeneration),
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

function buildUpstreamSessionKey(agentId, generation = 'main') {
  return `agent:${agentId}:${NAMESPACE}:${sanitizeSessionKeyPart(generation)}`;
}

function createUpstreamGeneration() {
  return `reset-${Date.now()}-${cryptoId()}`;
}

function sanitizeSessionKeyPart(value) {
  const normalized = String(value || 'main').trim().replace(/[^a-zA-Z0-9._-]+/g, '-');
  return normalized || 'main';
}

function isBindingTurnCurrent(agentId, turnSnapshot) {
  const latest = getBinding(agentId);
  if (!latest) return false;
  const latestGeneration = sanitizeSessionKeyPart(latest.upstreamGeneration || latest.upstreamSessionKey || 'main');
  const expectedGeneration = sanitizeSessionKeyPart(turnSnapshot?.upstreamGeneration || turnSnapshot?.upstreamSessionKey || 'main');
  return latest.upstreamSessionKey === turnSnapshot?.upstreamSessionKey && latestGeneration === expectedGeneration;
}

function buildUpstreamMessage(blocks) {
  const textParts = [];
  const attachmentHints = [];
  const transcriptHints = [];

  for (const block of blocks) {
    if (block.type === 'text' && block.text) {
      textParts.push(String(block.text).trim());
      continue;
    }

    if (['image', 'audio', 'video', 'file'].includes(block.type)) {
      const source = String(block.source || '').trim();
      if (!source) continue;
      const displayName = normalizeOptionalString(block.name) || path.basename(source);
      attachmentHints.push(`- ${block.type}: ${displayName} (${source})`);
      if (block.type === 'audio' && block.transcriptStatus === 'ready' && block.transcriptText) {
        transcriptHints.push(`- ${displayName}:\n${indentText(String(block.transcriptText), '  ')}`);
      } else if (block.type === 'audio' && block.transcriptStatus === 'failed') {
        transcriptHints.push(`- ${displayName}: transcript unavailable`);
      }
    }
  }

  if (!attachmentHints.length) return textParts.join('\n\n').trim();

  return [
    textParts.join('\n\n').trim(),
    '[openclaw-webchat user attachments]',
    'The user uploaded the following files. Use them as input context if relevant, but do not mention this wrapper format unless needed.',
    ...attachmentHints,
    transcriptHints.length ? '[openclaw-webchat audio transcripts]' : '',
    ...transcriptHints
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

function normalizeInputBlocks(value) {
  if (!Array.isArray(value)) return [];
  const blocks = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const type = String(item.type || '').toLowerCase();
    if (type === 'text') {
      const text = normalizeOptionalString(item.text);
      if (text) blocks.push({ type: 'text', text });
      continue;
    }
    if (!['image', 'audio', 'video', 'file'].includes(type)) continue;
    const source = normalizeOptionalString(item.source || item.url || item.path || item.filePath);
    if (!source) continue;
    blocks.push({
      type,
      source,
      name: normalizeOptionalString(item.name || item.filename || item.fileName) || path.basename(source),
      mimeType: normalizeOptionalString(item.mimeType || item.contentType) || undefined,
      transcriptStatus: normalizeOptionalString(item.transcriptStatus) || undefined,
      transcriptText: normalizeOptionalString(item.transcriptText || item.transcript) || undefined,
      transcriptError: normalizeOptionalString(item.transcriptError) || undefined,
      sizeBytes: Number.isFinite(Number(item.sizeBytes || item.size)) ? Number(item.sizeBytes || item.size) : undefined
    });
  }

  return dedupeBlocks(blocks);
}

function persistUpload({ kind, filename, mimeType, buffer }) {
  const safeBase = sanitizeUploadBaseName(filename);
  const extension = inferUploadExtension(filename, mimeType, kind);
  const displayName = safeBase.endsWith(extension) ? safeBase : `${safeBase}${extension}`;
  const stamped = `${Date.now()}-${cryptoId()}-${displayName}`;
  const filePath = path.join(UPLOADS_DIR, stamped);
  fs.writeFileSync(filePath, buffer);
  return { filePath, displayName };
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
        name: block.name || path.basename(source),
        transcriptStatus: block.transcriptStatus || null,
        transcriptText: block.transcriptText || null,
        transcriptError: block.transcriptError || null
      };
    }

    const token = signMediaToken(resolved);
    return {
      type: block.type,
      url: `/api/openclaw-webchat/media?token=${encodeURIComponent(token)}`,
      name: block.name || path.basename(source),
      mimeType: block.mimeType || null,
      sizeBytes: block.sizeBytes || null,
      transcriptStatus: block.transcriptStatus || null,
      transcriptText: block.transcriptText || null,
      transcriptError: block.transcriptError || null
    };
  }

  return {
    type: block.type,
    url: source,
    name: block.name || null,
    mimeType: block.mimeType || null,
    sizeBytes: block.sizeBytes || null,
    transcriptStatus: block.transcriptStatus || null,
    transcriptText: block.transcriptText || null,
    transcriptError: block.transcriptError || null
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
    name: normalizeOptionalString(block.name) || undefined,
    mimeType: normalizeOptionalString(block.mimeType || block.contentType) || undefined,
    transcriptStatus: normalizeOptionalString(block.transcriptStatus) || undefined,
    transcriptText: normalizeOptionalString(block.transcriptText || block.transcript) || undefined,
    transcriptError: normalizeOptionalString(block.transcriptError) || undefined,
    sizeBytes: Number.isFinite(Number(block.sizeBytes || block.size)) ? Number(block.sizeBytes || block.size) : undefined
  };
}

function guessMediaTypeByPath(value) {
  const lower = String(value || '').split('?')[0].toLowerCase();
  if (/\.(png|jpg|jpeg|gif|webp|bmp|svg)$/.test(lower)) return 'image';
  if (/\.(mp3|wav|m4a|aac|ogg|flac|opus)$/.test(lower)) return 'audio';
  if (/\.(mp4|mov|webm|m4v|mkv)$/.test(lower)) return 'video';
  return 'file';
}

function isSupportedUploadMime(kind, mimeType) {
  const mime = String(mimeType || '').toLowerCase();
  if (kind === 'image') return /^image\/(png|jpeg|jpg|gif|webp|bmp|svg\+xml)$/.test(mime);
  if (kind === 'audio') return /^audio\/(mpeg|mp3|wav|x-wav|wave|mp4|x-m4a|aac|ogg|opus|flac|webm)$/.test(mime);
  return false;
}

function isUploadFilenameKind(kind, filename) {
  return guessMediaTypeByPath(filename) === kind;
}

function sanitizeUploadBaseName(filename) {
  const parsed = path.parse(String(filename || 'upload').trim() || 'upload');
  const normalized = `${parsed.name || 'upload'}${parsed.ext || ''}`
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/\.{2,}/g, '.');
  return normalized || 'upload';
}

function inferUploadExtension(filename, mimeType, kind) {
  const parsed = path.parse(String(filename || '').trim());
  if (parsed.ext) return parsed.ext.toLowerCase();

  const mime = String(mimeType || '').toLowerCase();
  if (kind === 'image') {
    if (mime === 'image/png') return '.png';
    if (mime === 'image/jpeg' || mime === 'image/jpg') return '.jpg';
    if (mime === 'image/gif') return '.gif';
    if (mime === 'image/webp') return '.webp';
    if (mime === 'image/bmp') return '.bmp';
    if (mime === 'image/svg+xml') return '.svg';
    return '.png';
  }

  if (kind === 'audio') {
    if (mime === 'audio/mpeg' || mime === 'audio/mp3') return '.mp3';
    if (mime === 'audio/wav' || mime === 'audio/x-wav' || mime === 'audio/wave') return '.wav';
    if (mime === 'audio/mp4' || mime === 'audio/x-m4a') return '.m4a';
    if (mime === 'audio/aac') return '.aac';
    if (mime === 'audio/ogg') return '.ogg';
    if (mime === 'audio/opus') return '.opus';
    if (mime === 'audio/flac') return '.flac';
    if (mime === 'audio/webm') return '.webm';
    return '.m4a';
  }

  return '.bin';
}

function transcribeAudioFile(filePath, displayName) {
  const tempDir = fs.mkdtempSync(path.join(DATA_DIR, 'whisper-'));

  try {
    const result = spawnSync(WHISPER_BIN, [
      filePath,
      '--model',
      WHISPER_MODEL,
      '--output_format',
      'txt',
      '--output_dir',
      tempDir,
      '--verbose',
      'False'
    ], {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: WHISPER_TIMEOUT_MS,
      maxBuffer: 8 * 1024 * 1024
    });

    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(String(result.stderr || result.stdout || `${WHISPER_BIN} exited with ${result.status}`).trim());
    }

    const transcriptPath = path.join(tempDir, `${path.parse(filePath).name}.txt`);
    if (!fs.existsSync(transcriptPath)) {
      return { ok: false, error: `转写失败：${displayName || '音频'} 未生成文本结果` };
    }

    const text = fs.readFileSync(transcriptPath, 'utf8').replace(/\r\n/g, '\n').trim();
    if (!text) {
      return { ok: false, error: '转写失败：未识别到文本' };
    }

    return { ok: true, text };
  } catch (error) {
    return { ok: false, error: `转写失败：${formatError(error)}` };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function indentText(text, indent) {
  return String(text || '')
    .split('\n')
    .map((line) => `${indent}${line}`)
    .join('\n');
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
