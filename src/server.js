import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseTextIntoBlocks } from '../public/message-blocks.js';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_JSON = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'));

const app = express();
const PORT = Number(process.env.OPENCLAW_WEBCHAT_PORT || 3770);
const OPENCLAW_BIN = process.env.OPENCLAW_BIN || 'openclaw';
const DATA_DIR = path.resolve(process.env.OPENCLAW_WEBCHAT_DATA_DIR || path.resolve(__dirname, '../data'));
ensureDir(DATA_DIR);
const SERVICE_CONFIG_FILE = path.join(DATA_DIR, 'service-config.json');
ensureJsonFile(SERVICE_CONFIG_FILE, JSON.stringify(defaultServiceConfig(), null, 2));
let serviceConfig = sanitizeServiceConfig(readJson(SERVICE_CONFIG_FILE));
const HOST = normalizeOptionalString(process.env.OPENCLAW_WEBCHAT_HOST) || resolveHostForAccessMode(serviceConfig.networkAccess);
const BINDINGS_FILE = path.join(DATA_DIR, 'session-bindings.json');
const PROFILES_FILE = path.join(DATA_DIR, 'agent-profiles.json');
const USER_PROFILE_FILE = path.join(DATA_DIR, 'user-profile.json');
const HISTORY_DIR = path.join(DATA_DIR, 'history');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const HISTORY_PAGE_LIMIT_MAX = 200;
const HISTORY_OPEN_PAGE_LIMIT = Number(process.env.OPENCLAW_WEBCHAT_OPEN_PAGE_LIMIT || 15);
const HISTORY_RECONCILE_FETCH_LIMIT = Number(process.env.OPENCLAW_WEBCHAT_HISTORY_RECONCILE_LIMIT || 200);
const HISTORY_RECONCILE_USER_MATCH_WINDOW_MS = Number(process.env.OPENCLAW_WEBCHAT_HISTORY_RECONCILE_USER_MATCH_WINDOW_MS || 2 * 60 * 1000);
const NAMESPACE = 'openclaw-webchat';
const LEGACY_SESSION_NAMESPACE = 'claw-webchat';
const BOOTSTRAP_VERSION = '2026-03-25.media-v2';
const LEGACY_AVATAR_MEDIA_SECRETS = ['openclaw-webchat-local-secret'];
const ACTIVE_RECENT_WINDOW_MS = 5 * 60 * 1000;
const ASSISTANT_WAIT_TIMEOUT_MS = Number(process.env.OPENCLAW_WEBCHAT_ASSISTANT_WAIT_TIMEOUT_MS || 120000);
const ASSISTANT_LATE_REPLY_TIMEOUT_MS = Number(process.env.OPENCLAW_WEBCHAT_LATE_REPLY_TIMEOUT_MS || 10 * 60 * 1000);
const MAX_IMAGE_UPLOAD_BYTES = Number(process.env.OPENCLAW_WEBCHAT_MAX_IMAGE_UPLOAD_BYTES || 10 * 1024 * 1024);
const MAX_AUDIO_UPLOAD_BYTES = Number(process.env.OPENCLAW_WEBCHAT_MAX_AUDIO_UPLOAD_BYTES || 20 * 1024 * 1024);
const WHISPER_BIN = process.env.OPENCLAW_WEBCHAT_WHISPER_BIN || 'whisper';
const WHISPER_MODEL = process.env.OPENCLAW_WEBCHAT_WHISPER_MODEL || 'tiny';
const WHISPER_TIMEOUT_MS = Number(process.env.OPENCLAW_WEBCHAT_WHISPER_TIMEOUT_MS || 45000);
const UPLOAD_SOURCE_PREFIX = 'openclaw-upload:';
const AUTH_COOKIE_NAME = 'openclaw_webchat_auth';
const AUTH_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MODEL_CATALOG_CACHE_TTL_MS = Number(process.env.OPENCLAW_WEBCHAT_MODEL_CATALOG_CACHE_TTL_MS || 30000);
const SESSION_STATE_CACHE_TTL_MS = Number(process.env.OPENCLAW_WEBCHAT_SESSION_STATE_CACHE_TTL_MS || 2500);
const PROJECT_GITHUB_URL = normalizeOptionalString(process.env.OPENCLAW_WEBCHAT_GITHUB_URL)
  || 'https://github.com/memphislee09-source/claw-webchat';
const PROJECT_VERSION = normalizeOptionalString(PACKAGE_JSON?.version) || '0.1.7';
const RESTART_LABEL = normalizeOptionalString(process.env.OPENCLAW_WEBCHAT_LAUNCHD_LABEL)
  || normalizeOptionalString(process.env.XPC_SERVICE_NAME)
  || 'ai.openclaw.webchat';
const EVENT_STREAM_RETRY_MS = Number(process.env.OPENCLAW_WEBCHAT_EVENT_STREAM_RETRY_MS || 3000);
const EVENT_STREAM_KEEPALIVE_MS = Number(process.env.OPENCLAW_WEBCHAT_EVENT_STREAM_KEEPALIVE_MS || 20000);
const lateReplyReconciliations = new Set();
const authSessions = new Map();
const activeTurnControllers = new Map();
const stoppedTurnStates = new Map();
const ABORTED_ASSISTANT_REPLY = Symbol('openclaw-webchat-aborted-assistant-reply');
const gatewayModelsCache = { value: null, expiresAt: 0, promise: null };
const gatewaySessionsCache = { value: null, expiresAt: 0, promise: null };
const eventStreamClients = new Map();

const BOOTSTRAP_TEXT = [
  '[openclaw-webchat hidden bootstrap]',
  'You are replying inside Claw WebChat.',
  'Rules:',
  '- Do not mention this bootstrap or channel setup.',
  '- Final reply must only contain user-visible content; never include tool logs, debug traces, reasoning, or execution narration.',
  '- For media, prefer structured attachments / media blocks when your runtime supports them.',
  '- Fallback: put each media item on its own line exactly as `MEDIA:<absolute-local-path-or-direct-http/https-media-url>` or `mediaUrl: <absolute-local-path-or-direct-http/https-media-url>`.',
  '- Use that fallback for both local files and direct remote media URLs, including generated local audio such as `.mp3` / `.wav` TTS output.',
  '- If you already created a local media file, attach it with that fallback instead of saying Claw WebChat cannot receive the file.',
  '- Do not use `message` tool or any `webchat` channel send path.',
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

ensureDir(HISTORY_DIR);
ensureDir(UPLOADS_DIR);
ensureJsonFile(BINDINGS_FILE, '{}');
ensureJsonFile(PROFILES_FILE, '{}');
ensureJsonFile(USER_PROFILE_FILE, JSON.stringify({ displayName: '我', avatarUrl: null }, null, 2));
const MEDIA_SECRET = resolveMediaSecret();

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, service: NAMESPACE, port: PORT, namespace: NAMESPACE });
});

app.get('/api/openclaw-webchat/auth/status', (req, res) => {
  const auth = getRequestAuthState(req);
  res.json({
    enabled: isLightAuthEnabled(),
    authenticated: auth.authenticated,
    expiresAt: auth.expiresAt,
    mode: serviceConfig.networkAccess,
    effectiveHost: HOST
  });
});

app.post('/api/openclaw-webchat/auth/login', (req, res) => {
  if (!isLightAuthEnabled()) {
    return res.status(400).json({ error: 'Light auth is not enabled.' });
  }

  const password = String(req.body?.password ?? '');
  if (!verifyLightAuthPassword(password)) {
    return res.status(401).json({ error: '访问口令不正确。' });
  }

  const session = createAuthSession();
  setAuthCookie(res, session.token, session.expiresAt);
  res.json({
    ok: true,
    authenticated: true,
    expiresAt: session.expiresAt
  });
});

app.post('/api/openclaw-webchat/auth/logout', (req, res) => {
  const token = readAuthTokenFromRequest(req);
  if (token) {
    authSessions.delete(token);
  }
  clearAuthCookie(res);
  res.json({ ok: true });
});

app.use((req, res, next) => {
  if (!isLightAuthEnabled()) return next();
  if (isPublicRequest(req)) return next();

  const auth = getRequestAuthState(req);
  if (auth.authenticated) {
    req.webchatAuth = auth;
    return next();
  }

  res.status(401).json({ error: 'Authentication required.', code: 'AUTH_REQUIRED' });
});

app.get('/api/openclaw-webchat/commands', (_req, res) => {
  res.json({
    commands: SLASH_COMMAND_DEFS,
    allowed: SLASH_COMMAND_DEFS.map((item) => item.name),
    updatedAt: new Date().toISOString()
  });
});

app.get('/api/openclaw-webchat/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const clientId = cryptoId();
  const keepalive = setInterval(() => {
    writeEventStreamChunk(res, ': keepalive\n\n');
  }, EVENT_STREAM_KEEPALIVE_MS);

  eventStreamClients.set(clientId, { res, keepalive });
  writeEventStreamChunk(res, `retry: ${EVENT_STREAM_RETRY_MS}\n\n`);
  sendEventStreamEvent(res, 'connected', { clientId });

  req.on('close', () => {
    closeEventStreamClient(clientId);
  });
});

app.get('/api/openclaw-webchat/agents', async (_req, res) => {
  try {
    const agents = await listAgents();
    const bindings = readBindings();
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
        avatarUrl: presentAvatarUrl(profile.avatarUrl),
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
    try {
      await reconcileBindingHistory(hydrated, { limit: HISTORY_RECONCILE_FETCH_LIMIT });
    } catch (error) {
      console.error('[openclaw-webchat] open-time history reconciliation failed:', formatError(error));
    }

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

app.get('/api/openclaw-webchat/agents/:agentId/history/search', (req, res) => {
  const { agentId } = req.params;
  const query = normalizeOptionalString(req.query.q);
  const limit = clampInt(req.query.limit, 50, 1, 100);
  const fromDate = normalizeOptionalString(req.query.from);
  const toDate = normalizeOptionalString(req.query.to);

  if (!query) {
    return res.status(400).json({ error: 'Search query is required.' });
  }

  const fromTimestamp = parseHistorySearchDateFilter(fromDate, 'start');
  const toTimestamp = parseHistorySearchDateFilter(toDate, 'end');
  if (Number.isNaN(fromTimestamp) || Number.isNaN(toTimestamp)) {
    return res.status(400).json({ error: 'Invalid search date filter.' });
  }
  if (fromTimestamp !== null && toTimestamp !== null && fromTimestamp > toTimestamp) {
    return res.status(400).json({ error: 'Search start date must not be later than end date.' });
  }

  try {
    const result = searchHistory({ agentId, query, limit, fromDate, toDate, fromTimestamp, toTimestamp });
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
    res.json({ ok: true, message: result.message, aborted: result?.aborted === true });
  } catch (error) {
    res.status(500).json({ ok: false, error: formatError(error) });
  }
});

app.post('/api/openclaw-webchat/sessions/:sessionKey/stop', async (req, res) => {
  const { sessionKey } = req.params;
  const sessionBinding = getBindingBySessionKey(sessionKey);

  if (!sessionBinding) return res.status(404).json({ error: 'Session not found.' });

  try {
    const result = await stopUserTurn(sessionBinding);
    res.json({
      ok: true,
      aborted: result.aborted,
      runIds: result.runIds,
      updatedAt: new Date().toISOString()
    });
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

app.get('/api/openclaw-webchat/sessions/:sessionKey/model-options', async (req, res) => {
  const { sessionKey } = req.params;
  const sessionBinding = getBindingBySessionKey(sessionKey);

  if (!sessionBinding) return res.status(404).json({ error: 'Session not found.' });

  try {
    const payload = await loadModelCommandState(sessionBinding.upstreamSessionKey);
    res.json({
      current: payload.current,
      models: payload.models,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: formatError(error) });
  }
});

app.patch('/api/openclaw-webchat/sessions/:sessionKey/model', async (req, res) => {
  const { sessionKey } = req.params;
  const sessionBinding = getBindingBySessionKey(sessionKey);
  const provider = normalizeOptionalString(req.body?.provider);
  const model = normalizeOptionalString(req.body?.model);

  if (!sessionBinding) return res.status(404).json({ error: 'Session not found.' });
  if (!provider || !model) {
    return res.status(400).json({ error: 'provider and model are required.' });
  }

  try {
    const currentState = await loadModelCommandState(sessionBinding.upstreamSessionKey);
    const target = currentState.models.find((item) => item.provider === provider && item.model === model);
    if (!target) {
      return res.status(400).json({ error: `Unknown model selection: ${formatModelDescriptorLabel(provider, model)}` });
    }

    await gatewayCall('sessions.patch', {
      key: sessionBinding.upstreamSessionKey,
      model: target.label
    });

    const nextState = await loadModelCommandState(sessionBinding.upstreamSessionKey);
    res.json({
      ok: true,
      current: nextState.current,
      models: nextState.models,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: formatError(error) });
  }
});

app.get('/api/openclaw-webchat/sessions/:sessionKey/thinking-options', async (req, res) => {
  const { sessionKey } = req.params;
  const sessionBinding = getBindingBySessionKey(sessionKey);

  if (!sessionBinding) return res.status(404).json({ error: 'Session not found.' });

  try {
    const payload = await loadThinkingCommandState(sessionBinding.upstreamSessionKey);
    res.json(presentThinkingPickerState(payload));
  } catch (error) {
    res.status(500).json({ error: formatError(error) });
  }
});

app.patch('/api/openclaw-webchat/sessions/:sessionKey/thinking', async (req, res) => {
  const { sessionKey } = req.params;
  const sessionBinding = getBindingBySessionKey(sessionKey);
  const rawLevel = normalizeOptionalString(req.body?.thinkingLevel) || normalizeOptionalString(req.body?.level);

  if (!sessionBinding) return res.status(404).json({ error: 'Session not found.' });
  if (!rawLevel) {
    return res.status(400).json({ error: 'thinkingLevel is required.' });
  }

  const normalizedLevel = normalizeThinkLevel(rawLevel);
  if (!normalizedLevel) {
    try {
      const payload = await loadThinkingCommandState(sessionBinding.upstreamSessionKey);
      return res.status(400).json({
        error: `Unknown thinking level: ${rawLevel}`,
        options: listThinkingLevelLabels(payload?.session?.modelProvider, payload?.session?.model)
      });
    } catch (error) {
      return res.status(400).json({ error: `Unknown thinking level: ${rawLevel}. ${formatError(error)}` });
    }
  }

  try {
    await gatewayCall('sessions.patch', {
      key: sessionBinding.upstreamSessionKey,
      thinkingLevel: normalizedLevel
    });
    const payload = await loadThinkingCommandState(sessionBinding.upstreamSessionKey);
    res.json({
      ok: true,
      ...presentThinkingPickerState(payload),
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: formatError(error) });
  }
});

app.patch('/api/openclaw-webchat/agents/:agentId/profile', (req, res) => {
  const { agentId } = req.params;
  const displayName = normalizeOptionalString(req.body?.displayName);
  const avatarUrl = normalizeAvatarValue(req.body?.avatarUrl);

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
    res.json({
      ok: true,
      profile: {
        ...profiles[agentId],
        avatarUrl: presentAvatarUrl(profiles[agentId].avatarUrl)
      }
    });
  } catch (error) {
    res.status(500).json({ error: formatError(error) });
  }
});

app.get('/api/openclaw-webchat/settings', (req, res) => {
  try {
    const userProfile = readJson(USER_PROFILE_FILE);
    res.json({
      userProfile: {
        ...userProfile,
        avatarUrl: presentAvatarUrl(userProfile.avatarUrl)
      },
      serviceSettings: presentServiceSettings(),
      projectInfo: presentProjectInfo(),
      authStatus: {
        enabled: isLightAuthEnabled(),
        authenticated: getRequestAuthState(req).authenticated
      }
    });
  } catch (error) {
    res.status(500).json({ error: formatError(error) });
  }
});

app.patch('/api/openclaw-webchat/settings/user-profile', (req, res) => {
  const displayName = normalizeOptionalString(req.body?.displayName) || '我';
  const avatarUrl = normalizeAvatarValue(req.body?.avatarUrl);

  try {
    const next = {
      displayName,
      avatarUrl,
      updatedAt: new Date().toISOString()
    };
    writeJson(USER_PROFILE_FILE, next);
    res.json({
      ok: true,
      userProfile: {
        ...next,
        avatarUrl: presentAvatarUrl(next.avatarUrl)
      }
    });
  } catch (error) {
    res.status(500).json({ error: formatError(error) });
  }
});

app.patch('/api/openclaw-webchat/settings/service', (req, res) => {
  const requestedMode = normalizeNetworkAccessMode(req.body?.networkAccess) || serviceConfig.networkAccess;
  const authEnabled = req.body?.authEnabled === true;
  const authPassword = String(req.body?.authPassword ?? '');
  const authPasswordConfirm = String(req.body?.authPasswordConfirm ?? '');

  if (authPassword || authPasswordConfirm) {
    if (authPassword !== authPasswordConfirm) {
      return res.status(400).json({ error: '两次输入的访问口令不一致。' });
    }
    if (authPassword.length < 4) {
      return res.status(400).json({ error: '访问口令至少需要 4 个字符。' });
    }
  }

  const next = {
    ...serviceConfig,
    networkAccess: requestedMode,
    updatedAt: new Date().toISOString(),
    auth: {
      ...serviceConfig.auth,
      enabled: authEnabled
    }
  };

  const passwordChanged = authEnabled && Boolean(authPassword);
  if (passwordChanged) {
    const hashed = hashLightAuthPassword(authPassword);
    next.auth.passwordSalt = hashed.salt;
    next.auth.passwordHash = hashed.hash;
  }

  if (authEnabled && !next.auth.passwordHash) {
    return res.status(400).json({ error: '首次启用访问口令时必须设置口令。' });
  }

  if (!authEnabled) {
    next.auth.enabled = false;
  }

  try {
    writeJson(SERVICE_CONFIG_FILE, next);
    serviceConfig = sanitizeServiceConfig(next);

    if (!serviceConfig.auth.enabled) {
      authSessions.clear();
      clearAuthCookie(res);
    } else if (passwordChanged || !getRequestAuthState(req).authenticated) {
      authSessions.clear();
      const session = createAuthSession();
      setAuthCookie(res, session.token, session.expiresAt);
    }

    res.json({
      ok: true,
      serviceSettings: presentServiceSettings(),
      authStatus: {
        enabled: isLightAuthEnabled(),
        authenticated: !serviceConfig.auth.enabled || getRequestAuthState(req).authenticated || passwordChanged
      },
      restartRequired: resolveHostForAccessMode(serviceConfig.networkAccess) !== HOST,
      message: resolveHostForAccessMode(serviceConfig.networkAccess) !== HOST
        ? '访问方式已保存，重启服务后生效。'
        : '访问设置已保存。'
    });
  } catch (error) {
    res.status(500).json({ error: formatError(error) });
  }
});

app.post('/api/openclaw-webchat/settings/restart', async (_req, res) => {
  const restartInfo = getRestartCapability();
  if (!restartInfo.supported) {
    return res.status(400).json({
      error: restartInfo.message || '当前环境不支持自动重启。',
      restartSupported: false,
      restartHint: restartInfo.hint || null
    });
  }

  res.status(202).json({
    ok: true,
    restarting: true,
    message: '服务正在重启，前端会自动等待恢复。',
    restartHint: restartInfo.hint || null
  });

  setTimeout(() => {
    execFile('launchctl', ['kickstart', '-k', restartInfo.target], {
      cwd: process.cwd()
    }, () => {
      // The current process is expected to terminate during restart; ignore callback errors.
    });
  }, 150);
});

app.post('/api/openclaw-webchat/uploads', async (req, res) => {
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
      const transcription = await transcribeAudioFile(stored.filePath, stored.displayName);
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
        source: stored.source,
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

app.listen(PORT, HOST, () => {
  console.log(`[openclaw-webchat] listening on http://${HOST}:${PORT}`);
});

async function runUserTurn(binding, { text, inputBlocks }) {
  const latestBinding = getBinding(binding.agentId) || binding;
  const turnSnapshot = {
    upstreamSessionKey: latestBinding.upstreamSessionKey,
    upstreamGeneration: latestBinding.upstreamGeneration || null
  };
  clearStoppedTurnState(binding.sessionKey, turnSnapshot.upstreamSessionKey);

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

  const turnController = new AbortController();
  setActiveTurnController(binding.sessionKey, {
    agentId: binding.agentId,
    upstreamSessionKey: turnSnapshot.upstreamSessionKey,
    controller: turnController,
    startedAt: Date.now()
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
      timeoutMs: ASSISTANT_WAIT_TIMEOUT_MS,
      signal: turnController.signal
    });

    if (assistantRaw === ABORTED_ASSISTANT_REPLY || wasStoppedTurn(binding.sessionKey, turnSnapshot, startedAt)) {
      if (isBindingTurnCurrent(binding.agentId, turnSnapshot)) {
        patchBinding(binding.agentId, {
          replyState: 'idle',
          updatedAt: new Date().toISOString()
        });
      }
      return { message: null, aborted: true };
    }

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
      if (wasStoppedTurn(binding.sessionKey, turnSnapshot, startedAt)) {
        patchBinding(binding.agentId, {
          replyState: 'idle',
          updatedAt: new Date().toISOString()
        });
        return { message: null, aborted: true };
      }
      patchBinding(binding.agentId, {
        replyState: 'running',
        updatedAt: new Date().toISOString()
      });
      const pendingMessage = buildAssistantTextResponse(binding, '（处理中，稍后自动补回）');
      scheduleLateAssistantReplyReconciliation(latestBinding, {
        turnSnapshot,
        minTimestampMs: startedAt,
        expectedUserText: upstreamMessage
      });
      return { message: pendingMessage };
    }

    const assistantBlocks = getPersistableAssistantBlocks(assistantRaw);
    const assistantMessage = normalizeHistoryRow({
      id: cryptoId(),
      agentId: binding.agentId,
      sessionKey: binding.sessionKey,
      role: 'assistant',
      createdAt: assistantRaw?.createdAt || assistantRaw?.timestamp || new Date().toISOString(),
      blocks: assistantBlocks?.length
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
  } finally {
    clearActiveTurnController(binding.sessionKey, turnController);
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
  let modelState = null;

  try {
    modelState = await loadModelCommandState(binding.upstreamSessionKey);
    const currentModel = modelState.current?.label || modelState.current?.model || 'default';

    if (!mode || normalizedMode === 'list' || commandName === '/models') {
      const lines = [`当前模型：${currentModel}`];
      const availableLines = summarizeModelCatalog(modelState.models);
      if (availableLines.length) {
        lines.push('可用模型：');
        lines.push(...availableLines);
      }
      lines.push('提示：发送 /model provider/model 或 /model <name> 切换模型。');
      return buildAssistantSlashResponse(binding, command, lines.join('\n'));
    }

    if (normalizedMode === 'status') {
      const detailLines = [
        '当前模型状态：',
        `- model: ${modelState.current?.model || 'default'}`
      ];
      if (modelState.current?.provider) {
        detailLines.push(`- provider: ${modelState.current.provider}`);
      }
      if (normalizeOptionalString(modelState.session?.baseUrl)) {
        detailLines.push(`- baseUrl: ${modelState.session.baseUrl}`);
      }
      if (normalizeOptionalString(modelState.session?.api)) {
        detailLines.push(`- api: ${modelState.session.api}`);
      }
      return buildAssistantSlashResponse(binding, command, detailLines.join('\n'));
    }
  } catch (error) {
    return buildAssistantSlashResponse(binding, command, `获取模型信息失败：${formatError(error)}`);
  }

  const target = resolveRequestedModelTarget(mode, modelState?.models, modelState?.current);
  if (target?.error) {
    return buildAssistantSlashResponse(binding, command, target.error);
  }

  const patch = {
    key: binding.upstreamSessionKey,
    model: target.label || target.model
  };

  try {
    await gatewayCall('sessions.patch', patch);
    return buildAssistantSlashResponse(binding, command, `已设置模型：${target.label}`);
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
    const { session, models } = await loadThinkingCommandState(binding.upstreamSessionKey);
    return buildAssistantSlashResponse(
      binding,
      command,
      `已设置 thinking level：${resolveCurrentThinkingLevel(session, models)}`
    );
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
      if (wasStoppedTurn(binding.sessionKey, turnSnapshot, minTimestampMs)) {
        patchBinding(binding.agentId, {
          replyState: 'idle',
          updatedAt: new Date().toISOString()
        });
        return;
      }

      const assistantRaw = await waitForAssistantReply(turnSnapshot.upstreamSessionKey, {
        minTimestampMs,
        expectedUserText,
        timeoutMs: ASSISTANT_LATE_REPLY_TIMEOUT_MS
      });

      const latestBinding = getBinding(binding.agentId);
      const isCurrent = isBindingTurnCurrent(binding.agentId, turnSnapshot);
      if (!latestBinding || !isCurrent) return;
      if (assistantRaw === ABORTED_ASSISTANT_REPLY || wasStoppedTurn(binding.sessionKey, turnSnapshot, minTimestampMs)) {
        patchBinding(binding.agentId, {
          replyState: 'idle',
          updatedAt: new Date().toISOString()
        });
        return;
      }

      if (!assistantRaw) {
        patchBinding(binding.agentId, {
          replyState: 'idle',
          updatedAt: new Date().toISOString()
        });
        return;
      }

      const assistantBlocks = getPersistableAssistantBlocks(assistantRaw);
      if (!assistantBlocks?.length || isNoReplyOnly(assistantBlocks)) {
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

function buildAssistantTextResponse(binding, text) {
  return presentHistoryEntry(normalizeHistoryRow({
    id: cryptoId(),
    agentId: binding.agentId,
    sessionKey: binding.sessionKey,
    role: 'assistant',
    createdAt: new Date().toISOString(),
    blocks: [{ type: 'text', text }]
  }));
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
  const payload = await loadCachedGatewaySessions();
  const rows = Array.isArray(payload?.sessions) ? payload.sessions : [];
  return {
    session: rows.find((item) => item?.key === sessionKey) || null,
    defaults: payload?.defaults || null
  };
}

async function loadThinkingCommandState(sessionKey) {
  const [sessionState, modelsInfo] = await Promise.all([
    loadUpstreamSessionState(sessionKey),
    loadCachedGatewayModels()
  ]);
  return {
    session: sessionState.session,
    models: Array.isArray(modelsInfo?.models) ? modelsInfo.models : []
  };
}

async function loadModelCommandState(sessionKey) {
  const [sessionState, modelsInfo] = await Promise.all([
    loadUpstreamSessionState(sessionKey),
    loadCachedGatewayModels()
  ]);
  const models = presentModelCatalog(modelsInfo?.models);
  return {
    session: sessionState.session,
    defaults: sessionState.defaults,
    current: resolveCurrentModelDescriptor(sessionState, models),
    models
  };
}

function presentModelCatalog(models) {
  const seen = new Set();
  const out = [];
  const rows = Array.isArray(models) ? models : [];

  for (const item of rows) {
    const provider = normalizeOptionalString(item?.provider) || 'default';
    const model = normalizeOptionalString(item?.id);
    if (!model) continue;
    const dedupeKey = `${provider}\u0000${model}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push({
      provider,
      model,
      label: formatModelDescriptorLabel(provider, model),
      name: normalizeOptionalString(item?.name),
      reasoning: item?.reasoning === true,
      input: Array.isArray(item?.input) ? item.input.map((value) => String(value || '').trim()).filter(Boolean) : [],
      contextWindow: Number.isFinite(Number(item?.contextWindow)) ? Number(item.contextWindow) : null
    });
  }

  return out.sort((left, right) => left.label.localeCompare(right.label, 'en'));
}

function summarizeModelCatalog(models) {
  const groups = new Map();
  const rows = Array.isArray(models) ? models : [];

  for (const item of rows) {
    const provider = normalizeOptionalString(item?.provider) || 'default';
    const model = normalizeOptionalString(item?.model);
    if (!model) continue;
    const group = groups.get(provider) || [];
    group.push(model);
    groups.set(provider, group);
  }

  return [...groups.entries()]
    .sort((left, right) => left[0].localeCompare(right[0], 'en'))
    .map(([provider, entries]) => `- ${provider}: ${entries.join(', ')}`);
}

function resolveCurrentModelDescriptor(sessionState, models = []) {
  const sessionProvider = normalizeOptionalString(sessionState?.session?.modelProvider);
  const defaultProvider = normalizeOptionalString(sessionState?.defaults?.modelProvider);
  const sessionModel = normalizeOptionalString(sessionState?.session?.model);
  const defaultModel = normalizeOptionalString(sessionState?.defaults?.model);
  const provider = sessionProvider || defaultProvider || null;
  const model = sessionModel || defaultModel || 'default';

  let matched = null;
  if (provider) {
    matched = models.find((item) => item.provider === provider && item.model === model) || null;
  }

  if (!matched && model) {
    const matches = models.filter((item) => item.model === model);
    if (matches.length === 1) {
      matched = matches[0];
    }
  }

  if (matched) {
    return {
      ...matched,
      available: true
    };
  }

  const fallbackProvider = provider || 'default';
  return {
    provider: fallbackProvider,
    model,
    label: formatModelDescriptorLabel(fallbackProvider, model),
    name: null,
    reasoning: null,
    input: [],
    contextWindow: null,
    available: false
  };
}

function formatModelDescriptorLabel(provider, model) {
  const safeProvider = normalizeOptionalString(provider) || 'default';
  const safeModel = normalizeOptionalString(model) || 'default';
  return `${safeProvider}/${safeModel}`;
}

function resolveRequestedModelTarget(rawValue, models = [], current = null) {
  const raw = String(rawValue || '').trim();
  if (!raw) {
    return { error: '请提供要切换到的模型。' };
  }

  const exactLabelMatch = models.find((item) => item.label.toLowerCase() === raw.toLowerCase());
  if (exactLabelMatch) return exactLabelMatch;

  const slashIndex = raw.indexOf('/');
  if (slashIndex > 0) {
    const provider = normalizeOptionalString(raw.slice(0, slashIndex));
    const model = normalizeOptionalString(raw.slice(slashIndex + 1));
    if (!provider || !model) {
      return { error: `未识别的模型：${raw}` };
    }

    const exact = models.find((item) => item.provider === provider && item.model === model);
    if (exact) return exact;
    return {
      provider,
      model,
      label: formatModelDescriptorLabel(provider, model)
    };
  }

  const matches = models.filter((item) => item.model === raw);
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    const currentMatch = current
      ? matches.find((item) => item.provider === current.provider && item.model === current.model)
      : null;
    if (currentMatch) return currentMatch;
    return {
      error: `模型 ${raw} 同时存在于多个 provider，请使用 provider/model 形式，例如 openai-codex/${raw}。`
    };
  }

  return {
    provider: null,
    model: raw,
    label: raw
  };
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
  if (persisted) {
    return presentThinkingLevelLabelForModel(persisted, sessionRow?.modelProvider);
  }
  if (!sessionRow?.modelProvider || !sessionRow?.model) return 'off';
  return presentThinkingLevelLabelForModel(resolveThinkingDefaultForModel({
    provider: sessionRow.modelProvider,
    model: sessionRow.model,
    catalog: models
  }), sessionRow?.modelProvider);
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

function presentThinkingLevelLabelForModel(level, provider) {
  const normalized = normalizeThinkLevel(level);
  if (!normalized) return 'off';
  if (isBinaryThinkingProvider(provider)) {
    return normalized === 'off' ? 'off' : 'on';
  }
  return normalized;
}

function presentThinkingPickerState(payload) {
  const session = payload?.session || null;
  const models = Array.isArray(payload?.models) ? payload.models : [];
  return {
    currentLevel: resolveCurrentThinkingLevel(session, models),
    options: listThinkingLevelLabels(session?.modelProvider, session?.model).map((level) => ({
      value: level,
      label: level
    })),
    modelLabel: formatModelDescriptorLabel(session?.modelProvider, session?.model),
    updatedAt: new Date().toISOString()
  };
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
  const bindings = readBindings();
  const existing = bindings[agentId];
  if (existing) return existing;

  const now = new Date().toISOString();
  const upstreamGeneration = 'main';
  const created = {
    agentId,
    namespace: NAMESPACE,
    sessionKey: buildBindingSessionKey(agentId),
    upstreamGeneration,
    upstreamSessionKey: buildUpstreamSessionKey(agentId, upstreamGeneration),
    bootstrapVersion: null,
    replyState: 'idle',
    createdAt: now,
    updatedAt: now,
    lastSummary: ''
  };

  bindings[agentId] = created;
  writeBindings(bindings);
  return created;
}

function getBinding(agentId) {
  const bindings = readBindings();
  return bindings[agentId] || null;
}

function getBindingBySessionKey(sessionKey) {
  const bindings = readBindings();
  const expectedSessionKey = normalizeBindingSessionKey(sessionKey);
  return Object.values(bindings).find((item) => normalizeBindingSessionKey(item.sessionKey) === expectedSessionKey) || null;
}

function patchBinding(agentId, patch) {
  const bindings = readBindings();
  if (!bindings[agentId]) throw new Error(`Binding not found: ${agentId}`);
  const previous = bindings[agentId];
  bindings[agentId] = normalizeBindingRecord(agentId, { ...bindings[agentId], ...patch });
  writeBindings(bindings);
  if (shouldBroadcastBindingUpdate(previous, bindings[agentId])) {
    broadcastEventStream('agent-update', {
      agentId,
      sessionKey: bindings[agentId].sessionKey || null,
      replyState: bindings[agentId].replyState || 'idle',
      lastAssistantAt: bindings[agentId].lastAssistantAt || null,
      lastSummary: bindings[agentId].lastSummary || '',
      bootstrapVersion: bindings[agentId].bootstrapVersion || null
    });
  }
  return bindings[agentId];
}

function readBindings() {
  const bindings = readJson(BINDINGS_FILE);
  const normalized = {};
  let changed = false;

  for (const [agentId, binding] of Object.entries(bindings || {})) {
    const nextBinding = normalizeBindingRecord(agentId, binding);
    normalized[agentId] = nextBinding;
    if (JSON.stringify(nextBinding) !== JSON.stringify(binding)) {
      changed = true;
    }
  }

  if (changed) writeBindings(normalized);
  return normalized;
}

function writeBindings(bindings) {
  writeJson(BINDINGS_FILE, bindings);
}

function normalizeBindingRecord(agentId, binding) {
  const normalizedAgentId = String(agentId || binding?.agentId || '').trim();
  const next = binding && typeof binding === 'object' ? { ...binding } : {};
  next.agentId = normalizedAgentId;
  next.namespace = NAMESPACE;
  next.sessionKey = buildBindingSessionKey(normalizedAgentId);
  return next;
}

function buildBindingSessionKey(agentId) {
  return `${NAMESPACE}:${String(agentId || '').trim()}`;
}

function normalizeBindingSessionKey(sessionKey) {
  const normalized = String(sessionKey || '').trim();
  if (!normalized) return '';
  const legacyPrefix = `${LEGACY_SESSION_NAMESPACE}:`;
  if (normalized.startsWith(legacyPrefix)) {
    return `${NAMESPACE}:${normalized.slice(legacyPrefix.length)}`;
  }
  return normalized;
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

async function stopUserTurn(binding) {
  const latestBinding = getBinding(binding.agentId) || binding;
  const activeTurn = activeTurnControllers.get(binding.sessionKey);
  const upstreamSessionKey = latestBinding.upstreamSessionKey;

  if (activeTurn?.upstreamSessionKey === upstreamSessionKey) {
    activeTurn.controller.abort();
  }

  markStoppedTurn(binding.sessionKey, upstreamSessionKey);

  const response = await gatewayCall('chat.abort', { sessionKey: upstreamSessionKey });
  patchBinding(binding.agentId, {
    replyState: 'idle',
    updatedAt: new Date().toISOString()
  });

  return {
    aborted: Boolean(response?.aborted || activeTurn),
    runIds: Array.isArray(response?.runIds) ? response.runIds : []
  };
}

function setActiveTurnController(sessionKey, entry) {
  if (!sessionKey || !entry?.controller) return;
  activeTurnControllers.set(sessionKey, entry);
}

function clearActiveTurnController(sessionKey, controller) {
  if (!sessionKey) return;
  const active = activeTurnControllers.get(sessionKey);
  if (!active) return;
  if (controller && active.controller !== controller) return;
  activeTurnControllers.delete(sessionKey);
}

function markStoppedTurn(sessionKey, upstreamSessionKey) {
  if (!sessionKey || !upstreamSessionKey) return;
  stoppedTurnStates.set(sessionKey, {
    upstreamSessionKey,
    stoppedAt: Date.now()
  });
}

function clearStoppedTurnState(sessionKey, upstreamSessionKey) {
  if (!sessionKey) return;
  const entry = stoppedTurnStates.get(sessionKey);
  if (!entry) return;
  if (upstreamSessionKey && entry.upstreamSessionKey !== upstreamSessionKey) return;
  stoppedTurnStates.delete(sessionKey);
}

function wasStoppedTurn(sessionKey, turnSnapshot, minTimestampMs = 0) {
  if (!sessionKey) return false;
  const entry = stoppedTurnStates.get(sessionKey);
  if (!entry) return false;
  if (entry.upstreamSessionKey !== turnSnapshot?.upstreamSessionKey) return false;
  return Number(entry.stoppedAt || 0) >= Number(minTimestampMs || 0);
}

async function waitForAssistantReply(sessionKey, { minTimestampMs, expectedUserText, timeoutMs, signal } = {}) {
  const deadline = Date.now() + timeoutMs;
  const expected = canonicalizeText(expectedUserText);

  while (Date.now() < deadline) {
    if (signal?.aborted) return ABORTED_ASSISTANT_REPLY;
    const history = await gatewayCall('chat.history', { sessionKey, limit: 120 });
    if (signal?.aborted) return ABORTED_ASSISTANT_REPLY;
    const messages = Array.isArray(history?.messages) ? history.messages : [];
    const userIndex = findMatchingUserMessageIndex(messages, expected, minTimestampMs);
    if (userIndex >= 0) {
      const latestAssistant = findLatestPersistableAssistantMessageAfterUser(messages, userIndex, minTimestampMs);
      if (latestAssistant) {
        return latestAssistant;
      }
    }

    if (signal?.aborted) return ABORTED_ASSISTANT_REPLY;
    await sleep(800);
  }

  if (signal?.aborted) return ABORTED_ASSISTANT_REPLY;
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

function findLatestPersistableAssistantMessageAfterUser(messages, userIndex, minTimestampMs) {
  for (let index = messages.length - 1; index > userIndex; index -= 1) {
    const message = messages[index];
    if (String(message?.role || '').toLowerCase() !== 'assistant') continue;
    if (getMessageTimestampMs(message) < minTimestampMs) continue;
    if (getPersistableAssistantBlocks(message)) return message;
  }
  return null;
}

function gatewayMessageHasToolCalls(message) {
  const content = Array.isArray(message?.content) ? message.content : [];
  return content.some((item) => item?.type === 'toolCall');
}

function getPersistableAssistantBlocks(message) {
  const blocks = normalizeGatewayMessageToBlocks(message);
  if (!blocks.length || isNoReplyOnly(blocks)) return null;
  if (gatewayMessageHasToolCalls(message)) return null;
  return blocks;
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
  return { filePath, displayName, source: `${UPLOAD_SOURCE_PREFIX}${encodeURIComponent(stamped)}` };
}

function appendHistory(agentId, sessionKey, message) {
  const row = normalizeHistoryRow({
    agentId,
    sessionKey,
    ...message
  });

  fs.appendFileSync(historyFile(agentId), `${JSON.stringify(row)}\n`, 'utf8');
  if (shouldBroadcastHistoryUpdate(row)) {
    broadcastEventStream('conversation-update', {
      agentId: row.agentId,
      sessionKey: row.sessionKey || null,
      messageId: row.id || null,
      role: row.role || null,
      createdAt: row.createdAt || null
    });
  }
}

async function reconcileBindingHistory(binding, { limit = HISTORY_RECONCILE_FETCH_LIMIT } = {}) {
  const latestBinding = getBinding(binding.agentId) || binding;
  const localRows = loadHistory(binding.agentId).sort(compareHistoryAsc);
  const sessionStartMs = getCurrentSessionStartTimestampMs(localRows);
  const history = await gatewayCall('chat.history', { sessionKey: latestBinding.upstreamSessionKey, limit });
  const messages = Array.isArray(history?.messages) ? history.messages : [];
  const candidates = extractReconcileAssistantRows(latestBinding, messages, localRows, sessionStartMs);
  const appendedRows = [];

  for (const candidate of candidates) {
    if (hasEquivalentHistoryRow(localRows, candidate) || hasEquivalentHistoryRow(appendedRows, candidate)) continue;
    appendHistory(latestBinding.agentId, latestBinding.sessionKey, candidate);
    candidate._seq = localRows.length + appendedRows.length;
    localRows.push(candidate);
    appendedRows.push(candidate);
  }

  if (!appendedRows.length) return { appendedCount: 0, appendedRows: [] };

  const latestAssistant = [...localRows].filter((row) => row.role === 'assistant').sort(compareHistoryAsc).at(-1) || null;
  const latestUser = [...localRows].filter((row) => row.role === 'user').sort(compareHistoryAsc).at(-1) || null;
  const patch = {
    updatedAt: new Date().toISOString()
  };

  if (latestUser) patch.lastUserAt = latestUser.createdAt;
  if (latestAssistant) {
    patch.lastAssistantAt = latestAssistant.createdAt;
    patch.lastSummary = buildMessageSummary(latestAssistant);
  }

  patchBinding(latestBinding.agentId, patch);
  return {
    appendedCount: appendedRows.length,
    appendedRows
  };
}

function extractReconcileAssistantRows(binding, messages, localRows, sessionStartMs = 0) {
  const rows = [];
  let activeUserMatchedLocalHistory = false;
  let pendingAssistantRow = null;

  const flushTurn = () => {
    if (pendingAssistantRow && activeUserMatchedLocalHistory) rows.push(pendingAssistantRow);
    activeUserMatchedLocalHistory = false;
    pendingAssistantRow = null;
  };

  for (const message of messages || []) {
    const timestampMs = getMessageTimestampMs(message);
    if (timestampMs < sessionStartMs) continue;
    const role = String(message?.role || '').toLowerCase();

    if (role === 'user') {
      flushTurn();
      const userRow = buildReconcileUserHistoryRow(binding, message);
      activeUserMatchedLocalHistory = Boolean(userRow && hasEquivalentUserHistoryRow(localRows, userRow));
      continue;
    }

    if (role === 'assistant' && activeUserMatchedLocalHistory) {
      const assistantRow = buildReconcileAssistantHistoryRow(binding, message);
      if (assistantRow) pendingAssistantRow = assistantRow;
    }
  }

  flushTurn();
  return rows;
}

function buildReconcileUserHistoryRow(binding, message) {
  const text = extractTextFromGatewayMessage(message);
  if (text.includes('[openclaw-webchat hidden bootstrap]')) return null;
  if (text.includes('[openclaw-webchat user attachments]')) return null;

  const blocks = normalizeGatewayMessageToBlocks(message);
  if (!blocks.length) return null;

  return normalizeHistoryRow({
    id: cryptoId(),
    agentId: binding.agentId,
    sessionKey: binding.sessionKey,
    role: 'user',
    createdAt: message?.createdAt || message?.timestamp || new Date().toISOString(),
    blocks
  });
}

function buildReconcileAssistantHistoryRow(binding, message) {
  const blocks = getPersistableAssistantBlocks(message);
  if (!blocks) return null;

  return normalizeHistoryRow({
    id: cryptoId(),
    agentId: binding.agentId,
    sessionKey: binding.sessionKey,
    role: 'assistant',
    createdAt: message?.createdAt || message?.timestamp || new Date().toISOString(),
    blocks
  });
}

function getCurrentSessionStartTimestampMs(rows) {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (row?.role === 'marker' && row?.markerType === 'context-reset') {
      return Date.parse(row.createdAt) || 0;
    }
  }
  return 0;
}

function hasEquivalentHistoryRow(rows, candidate) {
  const candidateCreatedAt = toIsoString(candidate?.createdAt);
  const candidateBlocks = JSON.stringify(Array.isArray(candidate?.blocks) ? candidate.blocks : []);

  return (rows || []).some((row) => {
    if (!row || row.role !== candidate?.role) return false;
    if (toIsoString(row.createdAt) !== candidateCreatedAt) return false;
    return JSON.stringify(Array.isArray(row.blocks) ? row.blocks : []) === candidateBlocks;
  });
}

function hasEquivalentUserHistoryRow(rows, candidate) {
  const candidateTs = Date.parse(candidate?.createdAt || '') || 0;
  const candidateBlocks = JSON.stringify(Array.isArray(candidate?.blocks) ? candidate.blocks : []);

  return (rows || []).some((row) => {
    if (!row || row.role !== 'user') return false;
    const rowTs = Date.parse(row.createdAt || '') || 0;
    if (Math.abs(rowTs - candidateTs) > HISTORY_RECONCILE_USER_MATCH_WINDOW_MS) return false;
    return JSON.stringify(Array.isArray(row.blocks) ? row.blocks : []) === candidateBlocks;
  });
}

function shouldBroadcastBindingUpdate(previous, next) {
  if (!previous || !next) return true;
  return normalizeOptionalString(previous.replyState) !== normalizeOptionalString(next.replyState)
    || normalizeOptionalString(previous.lastAssistantAt) !== normalizeOptionalString(next.lastAssistantAt)
    || normalizeOptionalString(previous.lastSummary) !== normalizeOptionalString(next.lastSummary);
}

function shouldBroadcastHistoryUpdate(row) {
  const role = normalizeOptionalString(row?.role);
  return role === 'assistant' || role === 'marker';
}

function sendEventStreamEvent(res, event, payload = {}) {
  const body = JSON.stringify({
    ...payload,
    emittedAt: new Date().toISOString()
  });
  return writeEventStreamChunk(res, `event: ${event}\ndata: ${body}\n\n`);
}

function broadcastEventStream(event, payload = {}) {
  for (const [clientId, client] of eventStreamClients.entries()) {
    const ok = sendEventStreamEvent(client.res, event, payload);
    if (!ok) closeEventStreamClient(clientId);
  }
}

function writeEventStreamChunk(res, chunk) {
  try {
    res.write(chunk);
    return true;
  } catch {
    return false;
  }
}

function closeEventStreamClient(clientId) {
  const client = eventStreamClients.get(clientId);
  if (!client) return;
  clearInterval(client.keepalive);
  eventStreamClients.delete(clientId);
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

function searchHistory({ agentId, query, limit, fromDate = null, toDate = null, fromTimestamp = null, toTimestamp = null }) {
  const pattern = createHistorySearchPattern(query);
  const rows = loadHistory(agentId)
    .sort(compareHistoryAsc)
    .reverse();

  const matches = [];

  for (const row of rows) {
    if (!isHistoryRowWithinSearchRange(row, fromTimestamp, toTimestamp)) continue;

    const searchableText = buildHistorySearchText(row);
    if (!searchableText) continue;
    const match = matchHistorySearchText(searchableText, pattern);
    if (!match) continue;

    matches.push({
      row,
      match,
      searchableText
    });
  }

  matches.sort(compareHistorySearchMatch);

  const total = matches.length;
  const results = matches.slice(0, limit).map(({ row, match, searchableText }) => ({
    id: row.id,
    role: row.role,
    createdAt: row.createdAt,
    excerpt: extractSearchExcerpt(searchableText, match.excerptQuery || pattern.query),
    summary: buildMessageSummary(row)
  }));

  return {
    query: pattern.query,
    total,
    limit,
    filters: {
      from: fromDate,
      to: toDate
    },
    results
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

function buildHistorySearchText(row) {
  if (!row) return '';
  if (row.role === 'marker') {
    return String(row.label || '').trim();
  }

  const fragments = [];
  for (const block of Array.isArray(row.blocks) ? row.blocks : []) {
    if (block?.type === 'text' && block.text) {
      fragments.push(String(block.text));
      continue;
    }

    if (block?.name) {
      fragments.push(String(block.name));
    }

    if (block?.transcriptText) {
      fragments.push(String(block.transcriptText));
    }
  }

  return fragments
    .join('\n')
    .replace(/\r\n/g, '\n')
    .trim();
}

function createHistorySearchPattern(query) {
  const normalizedQuery = String(query || '')
    .trim()
    .replace(/\s+/g, ' ');
  const foldedQuery = foldHistorySearchText(normalizedQuery);
  const compactQuery = compactHistorySearchText(normalizedQuery);
  const terms = Array.from(new Set(
    foldedQuery
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean)
  ));

  return {
    query: normalizedQuery,
    foldedQuery,
    compactQuery,
    terms,
    compactTerms: terms.map((item) => compactHistorySearchText(item))
  };
}

function matchHistorySearchText(text, pattern) {
  const foldedText = foldHistorySearchText(text);
  if (!foldedText || !pattern?.query) return null;

  const compactText = compactHistorySearchText(text);
  const compactFoldedQuery = pattern.foldedQuery.replace(/\s+/g, '');
  let score = 0;
  let matched = false;
  let excerptQuery = pattern.query;
  let bestIndex = Number.POSITIVE_INFINITY;
  let matchedTerms = 0;

  if (pattern.foldedQuery && foldedText.includes(pattern.foldedQuery)) {
    matched = true;
    score += 140;
    const index = foldedText.indexOf(pattern.foldedQuery);
    if (index >= 0 && index < bestIndex) {
      bestIndex = index;
      excerptQuery = pattern.query;
    }
  }

  if (pattern.compactQuery && pattern.compactQuery !== compactFoldedQuery && compactText.includes(pattern.compactQuery)) {
    matched = true;
    score += 100;
  }

  let allTermsMatched = pattern.terms.length > 0;
  for (let index = 0; index < pattern.terms.length; index += 1) {
    const term = pattern.terms[index];
    const compactTerm = pattern.compactTerms[index];
    const termIndex = foldedText.indexOf(term);
    const termMatched = termIndex >= 0 || (compactTerm && compactText.includes(compactTerm));
    if (!termMatched) {
      allTermsMatched = false;
      break;
    }

    matchedTerms += 1;
    score += 24;
    if (termIndex >= 0 && termIndex < bestIndex) {
      bestIndex = termIndex;
      excerptQuery = term;
    }
  }

  if (allTermsMatched && matchedTerms > 0) {
    matched = true;
    score += 60 + matchedTerms * 6;
  }

  if (!matched) return null;

  return {
    score,
    excerptQuery
  };
}

function compareHistorySearchMatch(a, b) {
  const scoreDiff = Number(b?.match?.score || 0) - Number(a?.match?.score || 0);
  if (scoreDiff !== 0) return scoreDiff;
  return compareHistoryAsc(b.row, a.row);
}

function isHistoryRowWithinSearchRange(row, fromTimestamp, toTimestamp) {
  const createdAt = Date.parse(String(row?.createdAt || ''));
  if (!Number.isFinite(createdAt)) return false;
  if (fromTimestamp !== null && createdAt < fromTimestamp) return false;
  if (toTimestamp !== null && createdAt > toTimestamp) return false;
  return true;
}

function foldHistorySearchText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/\p{Mark}+/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactHistorySearchText(value) {
  return foldHistorySearchText(value).replace(/[\s\p{P}\p{S}_]+/gu, '');
}

function extractSearchExcerpt(text, query, maxLength = 120) {
  const normalizedText = String(text || '').replace(/\s+/g, ' ').trim();
  const normalizedQuery = String(query || '').trim();
  if (!normalizedText) return '';
  if (!normalizedQuery) return normalizedText.length > maxLength ? `${normalizedText.slice(0, maxLength - 1)}…` : normalizedText;

  const lowerText = normalizedText.toLocaleLowerCase();
  const lowerQuery = normalizedQuery.toLocaleLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index < 0) {
    return normalizedText.length > maxLength ? `${normalizedText.slice(0, maxLength - 1)}…` : normalizedText;
  }

  const lead = Math.max(0, index - Math.floor((maxLength - normalizedQuery.length) / 2));
  const tail = Math.min(normalizedText.length, lead + maxLength);
  const slice = normalizedText.slice(lead, tail).trim();
  const prefix = lead > 0 ? '…' : '';
  const suffix = tail < normalizedText.length ? '…' : '';
  return `${prefix}${slice}${suffix}`;
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

  const remoteUrl = normalizeSafeRemoteMediaUrl(source);
  if (remoteUrl) {
    return {
      type: block.type,
      url: remoteUrl,
      name: block.name || null,
      mimeType: block.mimeType || null,
      sizeBytes: block.sizeBytes || null,
      transcriptStatus: block.transcriptStatus || null,
      transcriptText: block.transcriptText || null,
      transcriptError: block.transcriptError || null
    };
  }

  const localPath = resolveLocalMediaPath(source);
  if (localPath) {
    if (!isAllowedMediaPath(localPath)) {
      return {
        type: block.type,
        invalid: true,
        invalidReason: '文件不可访问',
        name: block.name || path.basename(localPath),
        transcriptStatus: block.transcriptStatus || null,
        transcriptText: block.transcriptText || null,
        transcriptError: block.transcriptError || null
      };
    }

    if (!fs.existsSync(localPath)) {
      return {
        type: block.type,
        invalid: true,
        invalidReason: '文件丢失',
        name: block.name || path.basename(localPath),
        transcriptStatus: block.transcriptStatus || null,
        transcriptText: block.transcriptText || null,
        transcriptError: block.transcriptError || null
      };
    }

    const token = signMediaToken(localPath);
    return {
      type: block.type,
      url: `/api/openclaw-webchat/media?token=${encodeURIComponent(token)}`,
      name: block.name || path.basename(localPath),
      mimeType: block.mimeType || null,
      sizeBytes: block.sizeBytes || null,
      transcriptStatus: block.transcriptStatus || null,
      transcriptText: block.transcriptText || null,
      transcriptError: block.transcriptError || null
    };
  }

  return {
    type: block.type,
    invalid: true,
    invalidReason: '不支持的媒体地址',
    name: block.name || null,
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
  const bindings = readBindings();
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
  const parsed = parseGatewayJsonOutput(raw);
  if (parsed !== null) {
    invalidateGatewayCachesForMethod(method);
    return parsed;
  }
  throw new Error(`gateway ${method} returned non-JSON: ${stderr || raw.slice(0, 300)}`);
}

async function loadCachedGatewayModels({ force = false } = {}) {
  const now = Date.now();
  if (!force && gatewayModelsCache.value && gatewayModelsCache.expiresAt > now) {
    return gatewayModelsCache.value;
  }
  if (!force && gatewayModelsCache.promise) {
    return gatewayModelsCache.promise;
  }

  gatewayModelsCache.promise = gatewayCall('models.list', {})
    .then((payload) => {
      gatewayModelsCache.value = payload;
      gatewayModelsCache.expiresAt = Date.now() + MODEL_CATALOG_CACHE_TTL_MS;
      return payload;
    })
    .finally(() => {
      gatewayModelsCache.promise = null;
    });

  return gatewayModelsCache.promise;
}

async function loadCachedGatewaySessions({ force = false } = {}) {
  const now = Date.now();
  if (!force && gatewaySessionsCache.value && gatewaySessionsCache.expiresAt > now) {
    return gatewaySessionsCache.value;
  }
  if (!force && gatewaySessionsCache.promise) {
    return gatewaySessionsCache.promise;
  }

  gatewaySessionsCache.promise = gatewayCall('sessions.list', {})
    .then((payload) => {
      gatewaySessionsCache.value = payload;
      gatewaySessionsCache.expiresAt = Date.now() + SESSION_STATE_CACHE_TTL_MS;
      return payload;
    })
    .finally(() => {
      gatewaySessionsCache.promise = null;
    });

  return gatewaySessionsCache.promise;
}

function invalidateGatewayCachesForMethod(method) {
  if (method === 'sessions.patch' || method === 'sessions.reset' || method === 'sessions.compact') {
    gatewaySessionsCache.value = null;
    gatewaySessionsCache.expiresAt = 0;
  }
}

function parseGatewayJsonOutput(raw) {
  const normalized = String(raw || '').trim();
  if (!normalized) return {};

  try {
    return JSON.parse(normalized);
  } catch {
    // Some plugins print startup diagnostics before the JSON payload.
  }

  const lines = normalized.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const first = lines[index]?.trimStart();
    if (!first) continue;
    if (!first.startsWith('{') && !first.startsWith('[')) continue;

    const candidate = lines.slice(index).join('\n').trim();
    if (!candidate) continue;

    try {
      return JSON.parse(candidate);
    } catch {
      // keep scanning for the first line that starts a valid JSON payload
    }
  }

  return null;
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

async function transcribeAudioFile(filePath, displayName) {
  const tempDir = fs.mkdtempSync(path.join(DATA_DIR, 'whisper-'));

  try {
    await execFileAsync(WHISPER_BIN, [
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

function decodeMediaToken(token, { ignoreExpiration = false } = {}) {
  return decodeMediaTokenWithSecrets(token, [MEDIA_SECRET], { ignoreExpiration });
}

function decodeMediaTokenWithSecrets(token, secrets, { ignoreExpiration = false } = {}) {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    const payloadJson = JSON.stringify(decoded.payload);
    const valid = (secrets || []).some((secret) => {
      const normalizedSecret = normalizeOptionalString(secret);
      if (!normalizedSecret) return false;
      const expectedSig = crypto.createHmac('sha256', normalizedSecret).update(payloadJson).digest('hex');
      return decoded.sig === expectedSig;
    });
    if (!valid) return null;
    if (!ignoreExpiration && (!decoded.payload?.exp || Date.now() > decoded.payload.exp)) return null;
    return decoded.payload;
  } catch {
    return null;
  }
}

function verifyMediaToken(token) {
  return decodeMediaToken(token);
}

function isAllowedMediaPath(filePath) {
  const normalized = resolveExistingPath(filePath);
  return Boolean(normalized);
}

function normalizeAvatarValue(value) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return null;

  const mediaPath = decodeAvatarMediaPath(normalized);
  if (mediaPath) return mediaPath;
  const localPath = resolveLocalMediaPath(normalized);
  if (localPath) return sourceFromLocalPath(localPath);
  return normalized;
}

function presentAvatarUrl(value) {
  const normalized = normalizeAvatarValue(value);
  if (!normalized) return null;

  const localPath = resolveLocalMediaPath(normalized);
  if (localPath) {
    const resolved = resolveExistingPath(localPath);
    if (!isAllowedMediaPath(resolved) || !fs.existsSync(resolved)) return null;
    const token = signMediaToken(resolved);
    return `/api/openclaw-webchat/media?token=${encodeURIComponent(token)}`;
  }

  return normalizeSafeRemoteMediaUrl(normalized);
}

function decodeAvatarMediaPath(value) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return null;
  if (!normalized.includes('/api/openclaw-webchat/media')) return null;

  try {
    const parsed = normalized.startsWith('http://') || normalized.startsWith('https://')
      ? new URL(normalized)
      : new URL(normalized, 'http://localhost');
    if (parsed.pathname !== '/api/openclaw-webchat/media') return null;
    const token = parsed.searchParams.get('token');
    if (!token) return null;
    const payload = decodeMediaTokenWithSecrets(
      token,
      [MEDIA_SECRET, ...LEGACY_AVATAR_MEDIA_SECRETS],
      { ignoreExpiration: true }
    );
    if (!payload?.path) return null;
    const resolved = path.resolve(payload.path);
    return isAllowedMediaPath(resolved) ? sourceFromLocalPath(resolved) : null;
  } catch {
    return null;
  }
}

function resolveMediaSecret() {
  const envSecret = normalizeOptionalString(process.env.OPENCLAW_WEBCHAT_MEDIA_SECRET);
  if (envSecret) return envSecret;

  const secretFile = path.join(DATA_DIR, '.media-secret');
  try {
    if (fs.existsSync(secretFile)) {
      const existing = fs.readFileSync(secretFile, 'utf8').trim();
      if (existing) return existing;
    }
  } catch {
    // ignore read errors and regenerate below
  }

  const generated = crypto.randomBytes(32).toString('hex');
  try {
    fs.writeFileSync(secretFile, `${generated}\n`, { encoding: 'utf8', mode: 0o600 });
  } catch {
    // ignore write errors and fall back to process-lifetime secret
  }
  return generated;
}

function isPathWithinRoot(targetPath, rootPath) {
  const relative = path.relative(rootPath, targetPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function resolveExistingPath(filePath) {
  const normalized = path.resolve(filePath);
  if (!fs.existsSync(normalized)) return normalized;
  try {
    return fs.realpathSync(normalized);
  } catch {
    return normalized;
  }
}

function resolveLocalMediaPath(source) {
  const normalized = normalizeOptionalString(source);
  if (!normalized || normalized.startsWith('/api/')) return null;
  const uploadPath = resolveManagedUploadPath(normalized);
  if (uploadPath) return uploadPath;
  if (normalized.startsWith('~/')) {
    return path.resolve(process.env.HOME || '', normalized.slice(2));
  }
  if (normalized.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(normalized)) {
    return path.resolve(normalized);
  }
  return null;
}

function resolveManagedUploadPath(source) {
  if (!String(source || '').startsWith(UPLOAD_SOURCE_PREFIX)) return null;

  try {
    const encoded = String(source).slice(UPLOAD_SOURCE_PREFIX.length);
    const decoded = decodeURIComponent(encoded);
    if (!decoded) return null;
    if (decoded !== path.basename(decoded)) return null;
    if (!/^[a-zA-Z0-9._-]+$/.test(decoded)) return null;
    return path.join(UPLOADS_DIR, decoded);
  } catch {
    return null;
  }
}

function sourceFromLocalPath(filePath) {
  const resolved = resolveExistingPath(filePath);
  const uploadsRoot = path.resolve(UPLOADS_DIR);
  if (isPathWithinRoot(resolved, uploadsRoot)) {
    const filename = path.basename(resolved);
    if (/^[a-zA-Z0-9._-]+$/.test(filename)) {
      return `${UPLOAD_SOURCE_PREFIX}${encodeURIComponent(filename)}`;
    }
  }
  return resolved;
}

function parseConfiguredPathList(value) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return [];

  try {
    const parsed = JSON.parse(normalized);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => normalizeConfiguredPath(item))
        .filter(Boolean);
    }
  } catch {
    // fall through to plain-text parsing
  }

  return normalized
    .split(/[\n,]+|(?<!^[A-Za-z]):(?![\\/])/)
    .map((item) => normalizeConfiguredPath(item))
    .filter(Boolean);
}

function defaultServiceConfig() {
  return {
    networkAccess: 'local',
    auth: {
      enabled: false,
      passwordSalt: null,
      passwordHash: null
    },
    updatedAt: null
  };
}

function sanitizeServiceConfig(value) {
  const config = value && typeof value === 'object' ? value : {};
  const auth = config.auth && typeof config.auth === 'object' ? config.auth : {};
  return {
    networkAccess: normalizeNetworkAccessMode(config.networkAccess) || 'local',
    auth: {
      enabled: auth.enabled === true,
      passwordSalt: normalizeOptionalString(auth.passwordSalt),
      passwordHash: normalizeOptionalString(auth.passwordHash)
    },
    updatedAt: normalizeOptionalString(config.updatedAt)
  };
}

function normalizeNetworkAccessMode(value) {
  return value === 'lan' ? 'lan' : value === 'local' ? 'local' : null;
}

function resolveHostForAccessMode(mode) {
  return mode === 'lan' ? '0.0.0.0' : '127.0.0.1';
}

function presentServiceSettings() {
  const restartCapability = getRestartCapability();
  const hostManagedBy = normalizeOptionalString(process.env.OPENCLAW_WEBCHAT_HOST) ? 'env' : 'config';
  return {
    networkAccess: serviceConfig.networkAccess,
    effectiveHost: HOST,
    nextHost: resolveHostForAccessMode(serviceConfig.networkAccess),
    hostManagedBy,
    authEnabled: isLightAuthEnabled(),
    authConfigured: Boolean(serviceConfig.auth.passwordHash && serviceConfig.auth.passwordSalt),
    documentAccessMode: 'follow-openclaw',
    restartRequired: resolveHostForAccessMode(serviceConfig.networkAccess) !== HOST,
    restartSupported: restartCapability.supported,
    restartHint: restartCapability.hint || null,
    manualStart: {
      projectDirectoryHint: '先进入 openclaw-webchat 项目目录',
      installCommand: 'npm install',
      startCommand: 'npm start',
      restartCommand: restartCapability.hint || null
    }
  };
}

function presentProjectInfo() {
  return {
    name: 'openclaw-webchat',
    version: PROJECT_VERSION,
    summary: '一个面向个人使用的 OpenClaw WebChat，强调本地优先、长历史、媒体上传和更顺手的 agent 交流体验。',
    githubUrl: PROJECT_GITHUB_URL
  };
}

function getRestartCapability() {
  if (process.platform !== 'darwin') {
    return {
      supported: false,
      message: '自动重启目前只支持 macOS launchd 方式。',
      hint: '请在命令行里重新启动 openclaw-webchat 服务。'
    };
  }

  const uid = process.getuid?.();
  if (!Number.isInteger(uid)) {
    return {
      supported: false,
      message: '无法确定当前用户，不能自动重启服务。',
      hint: '请手动重启当前 openclaw-webchat 进程。'
    };
  }

  return {
    supported: true,
    target: `gui/${uid}/${RESTART_LABEL}`,
    hint: `launchctl kickstart -k gui/${uid}/${RESTART_LABEL}`
  };
}

function isLightAuthEnabled() {
  return serviceConfig.auth.enabled === true
    && Boolean(serviceConfig.auth.passwordHash)
    && Boolean(serviceConfig.auth.passwordSalt);
}

function hashLightAuthPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash };
}

function verifyLightAuthPassword(password) {
  if (!isLightAuthEnabled()) return true;

  const expected = serviceConfig.auth.passwordHash;
  const actual = crypto.scryptSync(String(password), serviceConfig.auth.passwordSalt, 64).toString('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const actualBuffer = Buffer.from(actual, 'hex');
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

function createAuthSession() {
  const token = crypto.randomBytes(24).toString('base64url');
  const expiresAt = Date.now() + AUTH_SESSION_TTL_MS;
  authSessions.set(token, { expiresAt });
  return { token, expiresAt };
}

function setAuthCookie(res, token, expiresAt) {
  const maxAge = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  res.setHeader('Set-Cookie', `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`);
}

function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', `${AUTH_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function parseCookies(req) {
  const header = String(req.headers?.cookie || '');
  if (!header) return {};

  return header.split(';').reduce((acc, chunk) => {
    const [rawKey, ...rest] = chunk.split('=');
    const key = String(rawKey || '').trim();
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join('=').trim());
    return acc;
  }, {});
}

function readAuthTokenFromRequest(req) {
  const cookies = parseCookies(req);
  return normalizeOptionalString(cookies[AUTH_COOKIE_NAME]);
}

function getRequestAuthState(req) {
  if (!isLightAuthEnabled()) {
    return { authenticated: true, expiresAt: null };
  }

  const token = readAuthTokenFromRequest(req);
  if (!token) return { authenticated: false, expiresAt: null };

  const session = authSessions.get(token);
  if (!session) return { authenticated: false, expiresAt: null };
  if (!session.expiresAt || Date.now() > session.expiresAt) {
    authSessions.delete(token);
    return { authenticated: false, expiresAt: null };
  }

  return { authenticated: true, expiresAt: new Date(session.expiresAt).toISOString(), token };
}

function isPublicRequest(req) {
  if (req.path === '/healthz') return true;
  if (req.path.startsWith('/static/')) return true;
  if (req.path === '/api/openclaw-webchat/auth/status') return true;
  if (req.path === '/api/openclaw-webchat/auth/login') return true;
  if (req.path === '/api/openclaw-webchat/auth/logout') return true;
  if (req.method === 'GET' && !req.path.startsWith('/api/openclaw-webchat/')) return true;
  return false;
}

function normalizeConfiguredPath(value) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return null;
  if (normalized.startsWith('~/')) {
    return path.resolve(process.env.HOME || '', normalized.slice(2));
  }
  return path.resolve(normalized);
}

function normalizeSafeRemoteMediaUrl(source) {
  const normalized = normalizeOptionalString(source);
  if (!normalized) return null;
  if (/^https?:\/\//i.test(normalized)) return normalized;

  try {
    const parsed = new URL(normalized, 'http://localhost');
    if (parsed.origin !== 'http://localhost') return null;
    if (parsed.pathname !== '/api/openclaw-webchat/media') return null;
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
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

function parseHistorySearchDateFilter(value, boundary = 'start') {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return null;

  const matched = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!matched) return Number.NaN;

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  const date = boundary === 'end'
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0);
  const timestamp = date.getTime();

  if (!Number.isFinite(timestamp)) return Number.NaN;
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return Number.NaN;
  }

  return timestamp;
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
