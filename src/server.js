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

const app = express();
const PORT = Number(process.env.OPENCLAW_WEBCHAT_PORT || 3770);
const OPENCLAW_BIN = process.env.OPENCLAW_BIN || 'openclaw';
const DATA_DIR = path.resolve(process.env.OPENCLAW_WEBCHAT_DATA_DIR || path.resolve(__dirname, '../data'));
const BINDINGS_FILE = path.join(DATA_DIR, 'session-bindings.json');
const GROUPS_FILE = path.join(DATA_DIR, 'groups.json');
const GROUP_MEMBER_BINDINGS_FILE = path.join(DATA_DIR, 'group-member-bindings.json');
const PROFILES_FILE = path.join(DATA_DIR, 'agent-profiles.json');
const USER_PROFILE_FILE = path.join(DATA_DIR, 'user-profile.json');
const HISTORY_DIR = path.join(DATA_DIR, 'history');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const HISTORY_PAGE_LIMIT_MAX = 200;
const HISTORY_OPEN_PAGE_LIMIT = Number(process.env.OPENCLAW_WEBCHAT_OPEN_PAGE_LIMIT || 15);
const NAMESPACE = 'openclaw-webchat';
const BOOTSTRAP_VERSION = '2026-03-16.phase2';
const LEGACY_AVATAR_MEDIA_SECRETS = ['openclaw-webchat-local-secret'];
const ACTIVE_RECENT_WINDOW_MS = 5 * 60 * 1000;
const ASSISTANT_WAIT_TIMEOUT_MS = Number(process.env.OPENCLAW_WEBCHAT_ASSISTANT_WAIT_TIMEOUT_MS || 120000);
const ASSISTANT_LATE_REPLY_TIMEOUT_MS = Number(process.env.OPENCLAW_WEBCHAT_LATE_REPLY_TIMEOUT_MS || 10 * 60 * 1000);
const MAX_IMAGE_UPLOAD_BYTES = Number(process.env.OPENCLAW_WEBCHAT_MAX_IMAGE_UPLOAD_BYTES || 10 * 1024 * 1024);
const MAX_AUDIO_UPLOAD_BYTES = Number(process.env.OPENCLAW_WEBCHAT_MAX_AUDIO_UPLOAD_BYTES || 20 * 1024 * 1024);
const WHISPER_BIN = process.env.OPENCLAW_WEBCHAT_WHISPER_BIN || 'whisper';
const WHISPER_MODEL = process.env.OPENCLAW_WEBCHAT_WHISPER_MODEL || 'tiny';
const WHISPER_TIMEOUT_MS = Number(process.env.OPENCLAW_WEBCHAT_WHISPER_TIMEOUT_MS || 45000);
const lateReplyReconciliations = new Set();
const groupDispatchQueues = new Map();

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
ensureJsonFile(GROUPS_FILE, '{}');
ensureJsonFile(GROUP_MEMBER_BINDINGS_FILE, '{}');
ensureJsonFile(PROFILES_FILE, '{}');
ensureJsonFile(USER_PROFILE_FILE, JSON.stringify({ displayName: '我', avatarUrl: null }, null, 2));
const MEDIA_SECRET = resolveMediaSecret();

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

app.get('/api/openclaw-webchat/conversations', async (_req, res) => {
  try {
    const [agentIds, groups] = await Promise.all([
      listAgents(),
      listAllGroups()
    ]);
    const agents = buildAgentIdentityList(agentIds);
    const items = [
      ...buildAgentConversationItems(agentIds),
      ...groups
        .filter((group) => group.status === 'active')
        .map((group) => buildGroupConversationItem(group))
    ].sort(compareConversationListItems);

    const archivedGroups = groups
      .filter((group) => group.status !== 'active')
      .map((group) => buildGroupConversationItem(group));

    res.json({
      items,
      agents,
      archivedGroups
    });
  } catch (error) {
    res.status(500).json({ error: formatError(error) });
  }
});

app.get('/api/openclaw-webchat/agents', async (_req, res) => {
  try {
    const agents = await listAgents();
    res.json({ agents: buildAgentConversationItems(agents) });
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

app.get('/api/openclaw-webchat/agents/:agentId/history/search', (req, res) => {
  const { agentId } = req.params;
  const query = normalizeOptionalString(req.query.q);
  const limit = clampInt(req.query.limit, 20, 1, 50);

  if (!query) {
    return res.status(400).json({ error: 'Search query is required.' });
  }

  try {
    const result = searchHistory({ agentId, query, limit });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: formatError(error) });
  }
});

app.post('/api/openclaw-webchat/groups', async (req, res) => {
  const name = normalizeOptionalString(req.body?.name);
  const memberAgentIds = normalizeAgentIdList(req.body?.memberAgentIds);

  if (!name) {
    return res.status(400).json({ error: 'Group name is required.' });
  }

  try {
    const group = createGroup({ name, memberAgentIds });
    await broadcastGroupSystemNote(group.groupId, `你已加入群聊「${group.name}」。`);
    const opened = buildGroupOpenPayload(group.groupId);
    res.json({
      ok: true,
      group: buildGroupDetail(group),
      ...opened
    });
  } catch (error) {
    res.status(500).json({ error: formatError(error) });
  }
});

app.get('/api/openclaw-webchat/groups/:groupId', (req, res) => {
  const group = getGroup(req.params.groupId);
  if (!group) return res.status(404).json({ error: 'Group not found.' });

  res.json({ group: buildGroupDetail(group) });
});

app.post('/api/openclaw-webchat/groups/:groupId/open', (req, res) => {
  const group = getGroup(req.params.groupId);
  if (!group) return res.status(404).json({ error: 'Group not found.' });

  try {
    res.json(buildGroupOpenPayload(group.groupId));
  } catch (error) {
    res.status(500).json({ error: formatError(error) });
  }
});

app.patch('/api/openclaw-webchat/groups/:groupId', async (req, res) => {
  const group = getGroup(req.params.groupId);
  if (!group) return res.status(404).json({ error: 'Group not found.' });
  const name = normalizeOptionalString(req.body?.name);
  if (!name) return res.status(400).json({ error: 'Group name is required.' });

  try {
    const updated = patchGroup(group.groupId, {
      name,
      updatedAt: new Date().toISOString()
    });
    invalidateGroupMemberBootstraps(updated.groupId);
    appendGroupSystemMessage(updated.groupId, `群名已修改为「${updated.name}」`, 'group-rename');
    await broadcastGroupSystemNote(updated.groupId, `群名已修改为「${updated.name}」。`);
    res.json({ ok: true, group: buildGroupDetail(updated) });
  } catch (error) {
    res.status(500).json({ error: formatError(error) });
  }
});

app.post('/api/openclaw-webchat/groups/:groupId/members', async (req, res) => {
  const group = getGroup(req.params.groupId);
  if (!group) return res.status(404).json({ error: 'Group not found.' });
  const agentIds = normalizeAgentIdList(req.body?.agentIds);
  if (!agentIds.length) return res.status(400).json({ error: 'At least one agent is required.' });

  try {
    const added = addGroupMembers(group.groupId, agentIds);
    if (!added.length) {
      return res.json({ ok: true, group: buildGroupDetail(getGroup(group.groupId)), added: [] });
    }
    const labels = added.map((agentId) => presentAgentIdentity(agentId).name).join('、');
    appendGroupSystemMessage(group.groupId, `已邀请 ${labels} 加入群聊`, 'group-member-added');
    for (const agentId of added) {
      ensureGroupMemberBinding(group.groupId, agentId);
      await broadcastGroupSystemNote(group.groupId, `${presentAgentIdentity(agentId).name} 已加入群聊。`, {
        targetAgentIds: [agentId]
      });
    }
    await broadcastGroupSystemNote(group.groupId, `${labels} 已加入群聊。`, {
      excludeAgentIds: added
    });
    res.json({
      ok: true,
      added,
      group: buildGroupDetail(getGroup(group.groupId))
    });
  } catch (error) {
    res.status(500).json({ error: formatError(error) });
  }
});

app.delete('/api/openclaw-webchat/groups/:groupId/members/:agentId', async (req, res) => {
  const group = getGroup(req.params.groupId);
  if (!group) return res.status(404).json({ error: 'Group not found.' });

  try {
    const removed = removeGroupMember(group.groupId, req.params.agentId);
    if (!removed) {
      return res.status(404).json({ error: 'Group member not found.' });
    }
    const label = presentAgentIdentity(req.params.agentId).name;
    appendGroupSystemMessage(group.groupId, `已将 ${label} 移出群聊`, 'group-member-removed');
    await broadcastGroupSystemNote(group.groupId, `${label} 已被移出群聊。`);
    res.json({ ok: true, group: buildGroupDetail(getGroup(group.groupId)) });
  } catch (error) {
    res.status(500).json({ error: formatError(error) });
  }
});

app.post('/api/openclaw-webchat/groups/:groupId/leave', (req, res) => {
  const group = getGroup(req.params.groupId);
  if (!group) return res.status(404).json({ error: 'Group not found.' });

  try {
    const updated = patchGroup(group.groupId, {
      status: 'left',
      updatedAt: new Date().toISOString()
    });
    appendGroupSystemMessage(group.groupId, '你已退出群聊', 'group-left');
    clearGroupDispatchQueues(group.groupId);
    res.json({ ok: true, group: buildGroupDetail(updated) });
  } catch (error) {
    res.status(500).json({ error: formatError(error) });
  }
});

app.post('/api/openclaw-webchat/groups/:groupId/dissolve', async (req, res) => {
  const group = getGroup(req.params.groupId);
  if (!group) return res.status(404).json({ error: 'Group not found.' });

  try {
    const updated = patchGroup(group.groupId, {
      status: 'dissolved',
      updatedAt: new Date().toISOString()
    });
    appendGroupSystemMessage(group.groupId, '群聊已解散', 'group-dissolved');
    await broadcastGroupSystemNote(group.groupId, '群聊已解散。');
    clearGroupDispatchQueues(group.groupId);
    res.json({ ok: true, group: buildGroupDetail(updated) });
  } catch (error) {
    res.status(500).json({ error: formatError(error) });
  }
});

app.get('/api/openclaw-webchat/groups/:groupId/history', (req, res) => {
  const group = getGroup(req.params.groupId);
  if (!group) return res.status(404).json({ error: 'Group not found.' });
  const limit = clampInt(req.query.limit, 30, 1, HISTORY_PAGE_LIMIT_MAX);
  const before = typeof req.query.before === 'string' ? req.query.before : null;

  try {
    res.json(getGroupHistoryPage({ groupId: group.groupId, limit, before }));
  } catch (error) {
    res.status(500).json({ error: formatError(error) });
  }
});

app.get('/api/openclaw-webchat/groups/:groupId/history/search', (req, res) => {
  const group = getGroup(req.params.groupId);
  if (!group) return res.status(404).json({ error: 'Group not found.' });
  const query = normalizeOptionalString(req.query.q);
  const limit = clampInt(req.query.limit, 20, 1, 50);
  if (!query) return res.status(400).json({ error: 'Search query is required.' });

  try {
    res.json(searchGroupHistory({ groupId: group.groupId, query, limit }));
  } catch (error) {
    res.status(500).json({ error: formatError(error) });
  }
});

app.get('/api/openclaw-webchat/sessions/:sessionKey/snapshot', (req, res) => {
  const sessionKey = String(req.params.sessionKey || '');
  const session = getSessionResourceBySessionKey(sessionKey);
  if (!session) return res.status(404).json({ error: 'Session not found.' });
  const limit = clampInt(req.query.limit, 200, 1, HISTORY_PAGE_LIMIT_MAX);

  try {
    const history = session.kind === 'group'
      ? getGroupHistoryPage({ groupId: session.group.groupId, limit, before: null })
      : getHistoryPage({ agentId: session.binding.agentId, limit, before: null });
    res.json({
      kind: session.kind,
      item: session.kind === 'group'
        ? buildGroupConversationItem(session.group)
        : buildAgentConversationItem(session.binding.agentId),
      group: session.kind === 'group' ? buildGroupDetail(session.group) : null,
      history
    });
  } catch (error) {
    res.status(500).json({ error: formatError(error) });
  }
});

app.post('/api/openclaw-webchat/sessions/:sessionKey/send', async (req, res) => {
  const { sessionKey } = req.params;
  const text = String(req.body?.text || '').trim();
  const inputBlocks = normalizeInputBlocks(req.body?.blocks);
  const mentionAgentIds = normalizeAgentIdList(req.body?.mentionAgentIds);
  const session = getSessionResourceBySessionKey(sessionKey);

  if (!session) return res.status(404).json({ error: 'Session not found.' });
  if (!text && !inputBlocks.length) return res.status(400).json({ error: 'Message is empty.' });

  try {
    const result = session.kind === 'group'
      ? await runGroupUserTurn(session.group, { text, inputBlocks, mentionAgentIds })
      : await runUserTurn(session.binding, { text, inputBlocks });
    res.json({ ok: true, message: result.message });
  } catch (error) {
    res.status(500).json({ ok: false, error: formatError(error) });
  }
});

app.post('/api/openclaw-webchat/sessions/:sessionKey/command', async (req, res) => {
  const { sessionKey } = req.params;
  const command = String(req.body?.command || '').trim();
  const session = getSessionResourceBySessionKey(sessionKey);

  if (!session) return res.status(404).json({ error: 'Session not found.' });
  if (!command.startsWith('/')) return res.status(400).json({ error: 'Invalid slash command.' });

  try {
    const result = session.kind === 'group'
      ? await runGroupSlashCommand(session.group, command)
      : await runSlashCommand(session.binding, command);
    res.json({ ok: true, ...result });
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

app.get('/api/openclaw-webchat/settings', (_req, res) => {
  try {
    const userProfile = readJson(USER_PROFILE_FILE);
    res.json({
      userProfile: {
        ...userProfile,
        avatarUrl: presentAvatarUrl(userProfile.avatarUrl)
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

async function runGroupSlashCommand(group, command) {
  const parsed = parseSlashCommand(command);
  if (!parsed) {
    throw new Error(`Invalid slash command: ${command}`);
  }

  const { name } = parsed;
  if (name === '/new' || name === '/reset') {
    return runGroupContextResetSlashCommand(group, command);
  }

  if (name === '/help') {
    return {
      command,
      message: appendGroupSystemMessage(group.groupId, buildSlashHelpText(), 'group-help')
    };
  }

  return {
    command,
    message: appendGroupSystemMessage(group.groupId, '当前群聊只支持 /new、/reset、/help。', 'group-command-info')
  };
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

async function runGroupContextResetSlashCommand(group, command) {
  const members = getCurrentGroupMembers(group.groupId);

  for (const member of members) {
    const binding = ensureGroupMemberBinding(group.groupId, member.agentId);
    const nextGeneration = createUpstreamGeneration();
    await gatewayCall('sessions.reset', { key: binding.upstreamSessionKey });
    patchGroupMemberBinding(group.groupId, member.agentId, {
      upstreamGeneration: nextGeneration,
      upstreamSessionKey: buildGroupMemberUpstreamSessionKey(group.groupId, member.agentId, nextGeneration),
      bootstrapVersion: null,
      replyState: 'idle',
      updatedAt: new Date().toISOString()
    });
  }

  for (const member of members) {
    await ensureGroupBootstrapInjected(group.groupId, member.agentId);
  }

  return {
    command,
    message: appendGroupSystemMessage(group.groupId, '已重置上下文', 'context-reset')
  };
}

async function runGroupUserTurn(group, { text, inputBlocks, mentionAgentIds }) {
  if (group.status !== 'active') {
    throw new Error('This group is read-only.');
  }

  const currentMembers = getCurrentGroupMembers(group.groupId);
  const validMentions = normalizeGroupMentionAgentIds(group.groupId, mentionAgentIds);
  const userBlocks = [];
  if (text) userBlocks.push({ type: 'text', text });
  userBlocks.push(...inputBlocks);

  const userMessage = normalizeHistoryRow({
    id: cryptoId(),
    conversationType: 'group',
    conversationId: group.groupId,
    sessionKey: group.sessionKey,
    role: 'user',
    createdAt: new Date().toISOString(),
    mentionAgentIds: validMentions,
    blocks: userBlocks
  });

  appendGroupHistory(group.groupId, userMessage);
  patchGroup(group.groupId, { updatedAt: new Date().toISOString() });

  for (const member of currentMembers) {
    ensureGroupMemberBinding(group.groupId, member.agentId);
    patchGroupMemberBinding(group.groupId, member.agentId, {
      replyState: 'running',
      updatedAt: new Date().toISOString()
    });
    enqueueGroupDispatchTask(group.groupId, member.agentId, {
      type: 'user-turn',
      createdAt: userMessage.createdAt,
      userMessageId: userMessage.id,
      mentionAgentIds: validMentions,
      blocks: userBlocks
    });
  }

  return {
    message: presentHistoryEntry(userMessage)
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

function searchHistory({ agentId, query, limit }) {
  const normalizedQuery = String(query || '').trim();
  const rows = loadHistory(agentId)
    .sort(compareHistoryAsc)
    .reverse();

  const results = [];
  let total = 0;

  for (const row of rows) {
    const searchableText = buildHistorySearchText(row);
    if (!searchableText) continue;
    if (!matchesSearchQuery(searchableText, normalizedQuery)) continue;

    total += 1;
    if (results.length >= limit) continue;

    results.push({
      id: row.id,
      role: row.role,
      speakerId: row.speakerId || null,
      speakerName: resolveHistorySpeakerName(row),
      createdAt: row.createdAt,
      excerpt: extractSearchExcerpt(searchableText, normalizedQuery),
      summary: buildMessageSummary(row)
    });
  }

  return {
    query: normalizedQuery,
    total,
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
      conversationType: String(row.conversationType || (row.groupId ? 'group' : 'agent')),
      conversationId: String(row.conversationId || row.groupId || row.agentId || ''),
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
    conversationType: String(row?.conversationType || (row?.speakerId ? 'group' : 'agent')),
    conversationId: String(row?.conversationId || row?.groupId || row?.agentId || ''),
    agentId: String(row?.agentId || ''),
    speakerId: normalizeOptionalString(row?.speakerId) || undefined,
    sessionKey: String(row?.sessionKey || ''),
    role: role === 'assistant' ? 'assistant' : 'user',
    createdAt: toIsoString(row?.createdAt),
    late: row?.late === true,
    replyToMessageId: normalizeOptionalString(row?.replyToMessageId) || undefined,
    replyToPreview: normalizeOptionalString(row?.replyToPreview) || undefined,
    mentionAgentIds: normalizeAgentIdList(row?.mentionAgentIds),
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
      label: row.label,
      conversationType: row.conversationType,
      conversationId: row.conversationId
    };
  }

  return {
    id: row.id,
    role: row.role,
    createdAt: row.createdAt,
    conversationType: row.conversationType,
    conversationId: row.conversationId,
    speakerId: row.speakerId || null,
    speakerName: resolveHistorySpeakerName(row),
    late: row.late === true,
    replyToMessageId: row.replyToMessageId || null,
    replyToPreview: row.replyToPreview || null,
    mentionAgentIds: row.mentionAgentIds || [],
    blocks: row.blocks.map(presentBlock)
  };
}

function buildHistorySearchText(row) {
  if (!row) return '';
  if (row.role === 'marker') {
    return String(row.label || '').trim();
  }

  const fragments = [];
  if (row.replyToPreview) {
    fragments.push(String(row.replyToPreview));
  }
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

function matchesSearchQuery(text, query) {
  const haystack = String(text || '').toLocaleLowerCase();
  const needle = String(query || '').trim().toLocaleLowerCase();
  if (!needle) return false;
  return haystack.includes(needle);
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

async function listAllGroups() {
  const groups = readJson(GROUPS_FILE);
  return Object.values(groups || {}).map(normalizeGroupRecord);
}

function normalizeGroupRecord(group) {
  const normalizedMembers = Array.isArray(group?.members)
    ? group.members
      .filter((item) => normalizeOptionalString(item?.agentId))
      .map((item) => ({
        agentId: String(item.agentId),
        joinedAt: toIsoString(item.joinedAt),
        removedAt: item.removedAt ? toIsoString(item.removedAt) : null
      }))
    : [];
  return {
    groupId: String(group?.groupId || cryptoId()),
    name: String(group?.name || '群聊'),
    sessionKey: String(group?.sessionKey || buildGroupSessionKey(group?.groupId || cryptoId())),
    status: normalizeGroupStatus(group?.status),
    createdAt: toIsoString(group?.createdAt),
    updatedAt: toIsoString(group?.updatedAt),
    members: normalizedMembers
  };
}

function normalizeGroupStatus(value) {
  const status = String(value || '').toLowerCase();
  if (status === 'dissolved' || status === 'left') return status;
  return 'active';
}

function normalizeAgentIdList(value) {
  const out = [];
  const seen = new Set();
  const values = Array.isArray(value) ? value : [];
  for (const item of values) {
    const normalized = normalizeOptionalString(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function buildGroupSessionKey(groupId) {
  return `${NAMESPACE}:group:${sanitizeSessionKeyPart(groupId)}`;
}

function buildGroupMemberBindingKey(groupId, agentId) {
  return `${String(groupId)}::${String(agentId)}`;
}

function buildGroupMemberUpstreamSessionKey(groupId, agentId, generation = 'main') {
  return `group:${sanitizeSessionKeyPart(groupId)}:agent:${sanitizeSessionKeyPart(agentId)}:${NAMESPACE}:${sanitizeSessionKeyPart(generation)}`;
}

function getGroup(groupId) {
  const groups = readJson(GROUPS_FILE);
  const raw = groups?.[groupId];
  return raw ? normalizeGroupRecord(raw) : null;
}

function patchGroup(groupId, patch) {
  const groups = readJson(GROUPS_FILE);
  const current = groups?.[groupId];
  if (!current) throw new Error(`Group not found: ${groupId}`);
  groups[groupId] = {
    ...normalizeGroupRecord(current),
    ...patch,
    groupId,
    sessionKey: current.sessionKey || buildGroupSessionKey(groupId)
  };
  writeJson(GROUPS_FILE, groups);
  return normalizeGroupRecord(groups[groupId]);
}

function createGroup({ name, memberAgentIds }) {
  const groupId = `group-${Date.now()}-${cryptoId()}`;
  const now = new Date().toISOString();
  const groups = readJson(GROUPS_FILE);
  groups[groupId] = {
    groupId,
    name,
    sessionKey: buildGroupSessionKey(groupId),
    status: 'active',
    createdAt: now,
    updatedAt: now,
    members: normalizeAgentIdList(memberAgentIds).map((agentId) => ({
      agentId,
      joinedAt: now,
      removedAt: null
    }))
  };
  writeJson(GROUPS_FILE, groups);

  const created = normalizeGroupRecord(groups[groupId]);
  appendGroupSystemMessage(created.groupId, `已创建群聊「${created.name}」`, 'group-created');

  for (const agentId of memberAgentIds) {
    ensureGroupMemberBinding(created.groupId, agentId);
  }

  return created;
}

function getCurrentGroupMembers(groupId) {
  const group = getGroup(groupId);
  if (!group) return [];
  return group.members.filter((item) => !item.removedAt);
}

function addGroupMembers(groupId, agentIds) {
  const group = getGroup(groupId);
  if (!group) throw new Error('Group not found.');
  if (group.status !== 'active') throw new Error('This group is read-only.');

  const existing = new Set(getCurrentGroupMembers(groupId).map((item) => item.agentId));
  const added = [];
  const groups = readJson(GROUPS_FILE);
  const target = normalizeGroupRecord(groups[groupId]);
  const now = new Date().toISOString();

  for (const agentId of normalizeAgentIdList(agentIds)) {
    if (existing.has(agentId)) continue;
    target.members.push({ agentId, joinedAt: now, removedAt: null });
    added.push(agentId);
  }

  target.updatedAt = now;
  groups[groupId] = target;
  writeJson(GROUPS_FILE, groups);
  return added;
}

function removeGroupMember(groupId, agentId) {
  const group = getGroup(groupId);
  if (!group) throw new Error('Group not found.');
  if (group.status !== 'active') throw new Error('This group is read-only.');

  const groups = readJson(GROUPS_FILE);
  const target = normalizeGroupRecord(groups[groupId]);
  const member = target.members.find((item) => item.agentId === agentId && !item.removedAt);
  if (!member) return false;
  member.removedAt = new Date().toISOString();
  target.updatedAt = new Date().toISOString();
  groups[groupId] = target;
  writeJson(GROUPS_FILE, groups);
  clearGroupDispatchQueueForAgent(groupId, agentId);
  return true;
}

function getGroupMemberBindings() {
  return readJson(GROUP_MEMBER_BINDINGS_FILE);
}

function ensureGroupMemberBinding(groupId, agentId) {
  const bindings = getGroupMemberBindings();
  const key = buildGroupMemberBindingKey(groupId, agentId);
  if (bindings[key]) return bindings[key];

  const now = new Date().toISOString();
  const upstreamGeneration = 'main';
  bindings[key] = {
    groupId,
    agentId,
    namespace: NAMESPACE,
    upstreamGeneration,
    upstreamSessionKey: buildGroupMemberUpstreamSessionKey(groupId, agentId, upstreamGeneration),
    bootstrapVersion: null,
    replyState: 'idle',
    createdAt: now,
    updatedAt: now
  };
  writeJson(GROUP_MEMBER_BINDINGS_FILE, bindings);
  return bindings[key];
}

function getGroupMemberBinding(groupId, agentId) {
  const bindings = getGroupMemberBindings();
  return bindings[buildGroupMemberBindingKey(groupId, agentId)] || null;
}

function patchGroupMemberBinding(groupId, agentId, patch) {
  const bindings = getGroupMemberBindings();
  const key = buildGroupMemberBindingKey(groupId, agentId);
  if (!bindings[key]) throw new Error(`Group member binding not found: ${groupId}/${agentId}`);
  bindings[key] = {
    ...bindings[key],
    ...patch,
    groupId,
    agentId
  };
  writeJson(GROUP_MEMBER_BINDINGS_FILE, bindings);
  return bindings[key];
}

function invalidateGroupMemberBootstraps(groupId) {
  const bindings = getGroupMemberBindings();
  let changed = false;
  for (const [key, binding] of Object.entries(bindings)) {
    if (binding?.groupId !== groupId) continue;
    bindings[key] = {
      ...binding,
      bootstrapVersion: null,
      updatedAt: new Date().toISOString()
    };
    changed = true;
  }
  if (changed) writeJson(GROUP_MEMBER_BINDINGS_FILE, bindings);
}

function getSessionResourceBySessionKey(sessionKey) {
  const binding = getBindingBySessionKey(sessionKey);
  if (binding) return { kind: 'agent', binding };

  const groups = readJson(GROUPS_FILE);
  for (const group of Object.values(groups || {})) {
    const normalized = normalizeGroupRecord(group);
    if (normalized.sessionKey === sessionKey) {
      return { kind: 'group', group: normalized };
    }
  }

  return null;
}

function buildAgentIdentityList(agentIds) {
  return [...agentIds]
    .filter(Boolean)
    .sort((left, right) => String(left).localeCompare(String(right)))
    .map((agentId) => presentAgentIdentity(agentId));
}

function presentAgentIdentity(agentId) {
  const profiles = readJson(PROFILES_FILE);
  const profile = profiles[agentId] || {};
  return {
    agentId,
    name: profile.displayName || agentId,
    avatarUrl: presentAvatarUrl(profile.avatarUrl)
  };
}

function buildAgentConversationItems(agentIds) {
  return [...agentIds].map((agentId) => buildAgentConversationItem(agentId)).sort(compareAgentListItems);
}

function buildAgentConversationItem(agentId) {
  const binding = getBinding(agentId);
  const identity = presentAgentIdentity(agentId);
  const latest = binding ? getLatestHistoryEntry(agentId) : null;
  const summary = latest ? buildMessageSummary(latest) : '';
  const lastAssistantAt = binding?.lastAssistantAt || (latest?.role === 'assistant' ? latest?.createdAt : null);
  const isRunning = Boolean(binding?.replyState === 'running');
  const isRecent = !isRunning && isTimestampRecent(lastAssistantAt, ACTIVE_RECENT_WINDOW_MS);
  return {
    kind: 'agent',
    id: agentId,
    agentId,
    name: identity.name,
    title: identity.name,
    avatarUrl: identity.avatarUrl,
    sessionKey: binding?.sessionKey || null,
    hasSession: Boolean(binding),
    summary,
    lastMessageAt: latest?.createdAt || binding?.updatedAt || null,
    presence: isRunning ? 'running' : isRecent ? 'recent' : 'idle'
  };
}

function buildGroupConversationItem(group) {
  const normalized = normalizeGroupRecord(group);
  const latest = getLatestGroupHistoryEntry(normalized.groupId);
  const currentMembers = getCurrentGroupMembers(normalized.groupId);
  const bindings = currentMembers.map((member) => getGroupMemberBinding(normalized.groupId, member.agentId)).filter(Boolean);
  const isRunning = bindings.some((binding) => binding?.replyState === 'running');
  const lastAssistantAt = latest?.role === 'assistant'
    ? latest.createdAt
    : bindings
      .map((binding) => binding?.lastAssistantAt)
      .filter(Boolean)
      .sort()
      .slice(-1)[0] || null;
  const isRecent = !isRunning && isTimestampRecent(lastAssistantAt, ACTIVE_RECENT_WINDOW_MS);
  return {
    kind: 'group',
    id: normalized.groupId,
    groupId: normalized.groupId,
    name: normalized.name,
    title: normalized.name,
    summary: latest ? buildMessageSummary(latest) : '',
    sessionKey: normalized.sessionKey,
    hasSession: true,
    lastMessageAt: latest?.createdAt || normalized.updatedAt || normalized.createdAt,
    presence: normalized.status !== 'active'
      ? 'idle'
      : isRunning ? 'running' : isRecent ? 'recent' : 'idle',
    memberCount: currentMembers.length,
    status: normalized.status,
    archived: normalized.status !== 'active'
  };
}

function compareConversationListItems(a, b) {
  return compareAgentListItems(a, b);
}

function buildGroupDetail(group) {
  const normalized = normalizeGroupRecord(group);
  const members = normalized.members.map((member) => ({
    ...member,
    ...presentAgentIdentity(member.agentId),
    replyState: getGroupMemberBinding(normalized.groupId, member.agentId)?.replyState || 'idle',
    presence: getGroupMemberBinding(normalized.groupId, member.agentId)?.replyState === 'running' ? 'running' : 'idle'
  }));
  return {
    groupId: normalized.groupId,
    name: normalized.name,
    sessionKey: normalized.sessionKey,
    status: normalized.status,
    memberCount: members.filter((item) => !item.removedAt).length,
    currentMembers: members.filter((item) => !item.removedAt),
    pastMembers: members.filter((item) => item.removedAt),
    canSend: normalized.status === 'active',
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt
  };
}

function buildGroupOpenPayload(groupId) {
  const group = getGroup(groupId);
  if (!group) throw new Error('Group not found.');
  const { messages, nextBefore, hasMore } = getGroupHistoryPage({ groupId, limit: HISTORY_OPEN_PAGE_LIMIT, before: null });
  return {
    kind: 'group',
    group: buildGroupDetail(group),
    sessionKey: group.sessionKey,
    history: { messages, nextBefore, hasMore }
  };
}

function normalizeGroupMentionAgentIds(groupId, mentionAgentIds) {
  const memberSet = new Set(getCurrentGroupMembers(groupId).map((item) => item.agentId));
  return normalizeAgentIdList(mentionAgentIds).filter((agentId) => memberSet.has(agentId));
}

function appendGroupHistory(groupId, message) {
  const group = getGroup(groupId);
  if (!group) throw new Error('Group not found.');
  const row = normalizeHistoryRow({
    conversationType: 'group',
    conversationId: groupId,
    sessionKey: group.sessionKey,
    ...message
  });
  fs.appendFileSync(groupHistoryFile(groupId), `${JSON.stringify(row)}\n`, 'utf8');
}

function appendGroupSystemMessage(groupId, label, markerType = 'group-system') {
  const group = getGroup(groupId);
  if (!group) throw new Error('Group not found.');
  const marker = normalizeHistoryRow({
    id: cryptoId(),
    conversationType: 'group',
    conversationId: groupId,
    sessionKey: group.sessionKey,
    role: 'marker',
    createdAt: new Date().toISOString(),
    markerType,
    label
  });
  appendGroupHistory(groupId, marker);
  patchGroup(groupId, { updatedAt: marker.createdAt });
  return presentHistoryEntry(marker);
}

function loadGroupHistory(groupId) {
  const filePath = groupHistoryFile(groupId);
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

function getLatestGroupHistoryEntry(groupId) {
  const rows = loadGroupHistory(groupId);
  if (!rows.length) return null;
  rows.sort(compareHistoryAsc);
  return rows[rows.length - 1] || null;
}

function getGroupHistoryPage({ groupId, limit, before }) {
  const rows = loadGroupHistory(groupId).sort(compareHistoryAsc);
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

function searchGroupHistory({ groupId, query, limit }) {
  const normalizedQuery = String(query || '').trim();
  const rows = loadGroupHistory(groupId).sort(compareHistoryAsc).reverse();
  const results = [];
  let total = 0;

  for (const row of rows) {
    const searchableText = buildHistorySearchText(row);
    if (!searchableText) continue;
    if (!matchesSearchQuery(searchableText, normalizedQuery)) continue;
    total += 1;
    if (results.length >= limit) continue;
    results.push({
      id: row.id,
      role: row.role,
      speakerId: row.speakerId || null,
      speakerName: resolveHistorySpeakerName(row),
      createdAt: row.createdAt,
      excerpt: extractSearchExcerpt(searchableText, normalizedQuery),
      summary: buildMessageSummary(row)
    });
  }

  return { query: normalizedQuery, total, results };
}

function resolveHistorySpeakerName(row) {
  if (!row) return '消息';
  if (row.role === 'marker') return '系统消息';
  if (row.role === 'user') return readJson(USER_PROFILE_FILE)?.displayName || '我';
  if (row.speakerId) return presentAgentIdentity(row.speakerId).name;
  if (row.agentId) return presentAgentIdentity(row.agentId).name;
  return 'Assistant';
}

function groupHistoryFile(groupId) {
  return path.join(HISTORY_DIR, `group-${String(groupId).replace(/[^a-zA-Z0-9._-]/g, '_')}.jsonl`);
}

function clearGroupDispatchQueues(groupId) {
  for (const key of [...groupDispatchQueues.keys()]) {
    if (key.startsWith(`${groupId}::`)) {
      groupDispatchQueues.delete(key);
    }
  }
}

function clearGroupDispatchQueueForAgent(groupId, agentId) {
  groupDispatchQueues.delete(buildGroupMemberBindingKey(groupId, agentId));
}

function enqueueGroupDispatchTask(groupId, agentId, task) {
  const queueKey = buildGroupMemberBindingKey(groupId, agentId);
  const queue = groupDispatchQueues.get(queueKey) || { running: false, items: [] };
  queue.items.push({ ...task, groupId, agentId });
  groupDispatchQueues.set(queueKey, queue);
  if (!queue.running) {
    void processGroupDispatchQueue(queueKey);
  }
}

async function processGroupDispatchQueue(queueKey) {
  const queue = groupDispatchQueues.get(queueKey);
  if (!queue || queue.running) return;
  queue.running = true;

  try {
    while (queue.items.length) {
      const task = queue.items.shift();
      if (!task) continue;
      try {
        await processGroupDispatchTask(task);
      } catch (error) {
        console.error('[openclaw-webchat] group dispatch failed:', formatError(error));
      }
    }
  } finally {
    const latest = groupDispatchQueues.get(queueKey);
    if (latest) {
      latest.running = false;
      if (!latest.items.length) {
        groupDispatchQueues.delete(queueKey);
      }
    }
  }
}

async function processGroupDispatchTask(task) {
  const group = getGroup(task.groupId);
  if (!group) return;
  if (group.status !== 'active' && task.type !== 'note') return;

  const memberRecord = getCurrentGroupMembers(task.groupId).find((item) => item.agentId === task.agentId);
  if (!memberRecord && task.type === 'user-turn') return;

  const binding = ensureGroupMemberBinding(task.groupId, task.agentId);
  await ensureGroupBootstrapInjected(task.groupId, task.agentId);

  if (task.type === 'note') {
    await sendGroupNoteToMember(binding, task);
    if (!groupDispatchQueues.get(buildGroupMemberBindingKey(task.groupId, task.agentId))?.items.length) {
      patchGroupMemberBinding(task.groupId, task.agentId, {
        replyState: 'idle',
        updatedAt: new Date().toISOString()
      });
    }
    return;
  }

  const userBlocks = Array.isArray(task.blocks) ? task.blocks : [];
  const upstreamMessage = buildGroupUpstreamUserMessage({
    group,
    agentId: task.agentId,
    userMessageId: task.userMessageId,
    mentionAgentIds: task.mentionAgentIds || [],
    blocks: userBlocks
  });
  const startedAt = Date.now();

  await gatewayCall('chat.send', {
    sessionKey: binding.upstreamSessionKey,
    message: upstreamMessage,
    deliver: false,
    idempotencyKey: `group-turn-${task.groupId}-${task.agentId}-${task.userMessageId}`
  });

  const assistantRaw = await waitForAssistantReply(binding.upstreamSessionKey, {
    minTimestampMs: startedAt,
    expectedUserText: upstreamMessage,
    timeoutMs: ASSISTANT_LATE_REPLY_TIMEOUT_MS
  });

  const remainingQueue = groupDispatchQueues.get(buildGroupMemberBindingKey(task.groupId, task.agentId));

  if (!assistantRaw) {
    patchGroupMemberBinding(task.groupId, task.agentId, {
      replyState: remainingQueue?.items?.length ? 'running' : 'idle',
      updatedAt: new Date().toISOString()
    });
    return;
  }

  const assistantBlocks = normalizeGatewayMessageToBlocks(assistantRaw);
  if (!assistantBlocks.length || isNoReplyOnly(assistantBlocks)) {
    patchGroupMemberBinding(task.groupId, task.agentId, {
      replyState: remainingQueue?.items?.length ? 'running' : 'idle',
      updatedAt: new Date().toISOString()
    });
    return;
  }

  const late = isLateGroupReply(task.groupId, task.userMessageId);
  const assistantMessage = normalizeHistoryRow({
    id: cryptoId(),
    conversationType: 'group',
    conversationId: task.groupId,
    sessionKey: group.sessionKey,
    role: 'assistant',
    speakerId: task.agentId,
    createdAt: assistantRaw?.createdAt || assistantRaw?.timestamp || new Date().toISOString(),
    replyToMessageId: task.userMessageId,
    replyToPreview: summarizeText(extractTextFromBlocks(userBlocks), 28),
    late,
    blocks: assistantBlocks
  });

  appendGroupHistory(task.groupId, assistantMessage);
  patchGroup(task.groupId, { updatedAt: assistantMessage.createdAt });
  patchGroupMemberBinding(task.groupId, task.agentId, {
    replyState: remainingQueue?.items?.length ? 'running' : 'idle',
    lastAssistantAt: assistantMessage.createdAt,
    updatedAt: new Date().toISOString()
  });

  await broadcastGroupAssistantReply(task.groupId, task.agentId, assistantMessage);
}

function isLateGroupReply(groupId, userMessageId) {
  const rows = loadGroupHistory(groupId).sort(compareHistoryAsc);
  const userRow = rows.find((row) => row.id === userMessageId);
  if (!userRow) return false;
  return rows.some((row) => row.role === 'user' && compareHistoryAsc(row, userRow) > 0);
}

function extractTextFromBlocks(blocks) {
  return (Array.isArray(blocks) ? blocks : [])
    .filter((block) => block?.type === 'text' && block?.text)
    .map((block) => String(block.text))
    .join('\n')
    .trim();
}

function buildGroupUpstreamUserMessage({ group, agentId, userMessageId, mentionAgentIds, blocks }) {
  const memberNames = getCurrentGroupMembers(group.groupId).map((member) => presentAgentIdentity(member.agentId).name).join('、');
  const mustReply = mentionAgentIds.includes(agentId);
  const payload = buildUpstreamMessage(blocks);
  return [
    '[openclaw-webchat group user turn]',
    `Group: ${group.name}`,
    `You are: ${presentAgentIdentity(agentId).name} (${agentId})`,
    `Current members: ${memberNames || 'none'}`,
    `Turn ID: ${userMessageId}`,
    `Mentioned agents: ${mentionAgentIds.length ? mentionAgentIds.join(', ') : 'none'}`,
    mustReply
      ? 'You were explicitly mentioned. You MUST reply exactly once.'
      : 'You were not explicitly mentioned. Decide whether you have a useful contribution. If not, reply exactly NO_REPLY.',
    'Only respond to this group user turn. Do not reply to mirrored group notes or system notices.',
    '',
    payload || '（空消息）'
  ].join('\n');
}

async function broadcastGroupSystemNote(groupId, text, { targetAgentIds = null, excludeAgentIds = [] } = {}) {
  const group = getGroup(groupId);
  if (!group || group.status !== 'active') return;
  const excludeSet = new Set(normalizeAgentIdList(excludeAgentIds));
  const targets = (targetAgentIds ? normalizeAgentIdList(targetAgentIds) : getCurrentGroupMembers(groupId).map((item) => item.agentId))
    .filter((agentId) => !excludeSet.has(agentId));
  for (const agentId of targets) {
    enqueueGroupDispatchTask(groupId, agentId, {
      type: 'note',
      createdAt: new Date().toISOString(),
      note: [
        '[openclaw-webchat group note]',
        `Group: ${group.name}`,
        'This is a context-only system note. Do not reply with user-visible content.',
        'Reply exactly NO_REPLY.',
        '',
        text
      ].join('\n')
    });
  }
}

async function broadcastGroupAssistantReply(groupId, speakerAgentId, assistantMessage) {
  const group = getGroup(groupId);
  if (!group || group.status !== 'active') return;
  const speakerName = presentAgentIdentity(speakerAgentId).name;
  const content = buildUpstreamMessage(assistantMessage.blocks || []);
  const note = [
    '[openclaw-webchat group note]',
    `Group: ${group.name}`,
    `Speaker: ${speakerName} (${speakerAgentId})`,
    `Reply target: ${assistantMessage.replyToPreview || '上一轮用户消息'}`,
    'This is group history context only. Do not reply.',
    'Reply exactly NO_REPLY.',
    '',
    content || '（空回复）'
  ].join('\n');
  for (const member of getCurrentGroupMembers(groupId)) {
    if (member.agentId === speakerAgentId) continue;
    enqueueGroupDispatchTask(groupId, member.agentId, {
      type: 'note',
      createdAt: new Date().toISOString(),
      note
    });
  }
}

async function sendGroupNoteToMember(binding, task) {
  const note = String(task.note || '').trim();
  if (!note) return;
  const startedAt = Date.now();
  await gatewayCall('chat.send', {
    sessionKey: binding.upstreamSessionKey,
    message: note,
    deliver: false,
    idempotencyKey: `group-note-${task.groupId}-${task.agentId}-${startedAt}-${cryptoId()}`
  });
  await waitForAssistantReply(binding.upstreamSessionKey, {
    minTimestampMs: startedAt,
    expectedUserText: note,
    timeoutMs: ASSISTANT_WAIT_TIMEOUT_MS
  });
}

async function ensureGroupBootstrapInjected(groupId, agentId) {
  const group = getGroup(groupId);
  if (!group) throw new Error('Group not found.');
  const binding = ensureGroupMemberBinding(groupId, agentId);
  const version = `group:${BOOTSTRAP_VERSION}:${group.name}`;
  if (binding.bootstrapVersion === version) return binding;

  const message = [
    '[openclaw-webchat hidden group bootstrap]',
    `You are ${presentAgentIdentity(agentId).name} (${agentId}) in the group "${group.name}".`,
    'Behavior contract for this group session:',
    '- The local webchat keeps the visible group timeline.',
    '- You receive user turns and mirrored group notes in this dedicated session.',
    '- When a user turn explicitly mentions you, you must reply once.',
    '- When not explicitly mentioned, reply only if you have meaningful value to add; otherwise reply exactly `NO_REPLY`.',
    '- Mirrored group notes and system notices are context only. Reply exactly `NO_REPLY` to those notes.',
    '- Never speak as another participant.',
    '- Do not mention this bootstrap or wrapper format.'
  ].join('\n');

  await gatewayCall('chat.send', {
    sessionKey: binding.upstreamSessionKey,
    message,
    deliver: false,
    idempotencyKey: `group-bootstrap-${groupId}-${agentId}-${Date.now()}`
  });

  return patchGroupMemberBinding(groupId, agentId, {
    bootstrapVersion: version,
    updatedAt: new Date().toISOString()
  });
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
  return getAllowedMediaRoots().some((root) => isPathWithinRoot(normalized, root));
}

function normalizeAvatarValue(value) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return null;

  const mediaPath = decodeAvatarMediaPath(normalized);
  if (mediaPath) return mediaPath;
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
    return isAllowedMediaPath(resolved) ? resolved : null;
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

function getAllowedMediaRoots() {
  const roots = [
    path.resolve(UPLOADS_DIR),
    path.resolve(process.env.HOME || '', '.openclaw')
  ];
  return roots.filter(Boolean);
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
  if (normalized.startsWith('~/')) {
    return path.resolve(process.env.HOME || '', normalized.slice(2));
  }
  if (normalized.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(normalized)) {
    return path.resolve(normalized);
  }
  return null;
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
  return String(a.agentId || a.id || '').localeCompare(String(b.agentId || b.id || ''));
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
