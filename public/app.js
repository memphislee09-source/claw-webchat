import { groupMessageBlocksForRender } from './message-blocks.js';

const state = {
  agents: [],
  activeAgentId: null,
  activeSessionKey: null,
  messages: [],
  pendingUploads: [],
  nextBefore: null,
  hasMore: false,
  loadingHistory: false,
  sendingSessionKeys: new Set(),
  pollingTimer: null,
  selectedOpenPromise: null,
  openRequestId: 0,
  commandCatalog: [],
  allowedCommands: new Set(),
  settingsOpen: false,
  settingsExpandedSection: null,
  settingsSelectedContactKey: null,
  settingsDraftDisplayName: '',
  settingsDraftAvatarUrl: null,
  settingsDraftAvatarFile: null,
  settingsDraftAvatarPreviewUrl: null,
  settingsAvatarRemoved: false,
  mediaViewerOpen: false,
  mediaViewerScale: 1,
  mediaViewerOffsetX: 0,
  mediaViewerOffsetY: 0,
  mediaViewerDragging: false,
  mediaViewerPointerId: null,
  mediaViewerDragStartX: 0,
  mediaViewerDragStartY: 0,
  mediaViewerMoved: false,
  userProfile: {
    displayName: '我',
    avatarUrl: null
  }
};

const agentListEl = document.getElementById('agentList');
const messageListEl = document.getElementById('messageList');
const chatTitleEl = document.getElementById('chatTitle');
const chatSubtitleEl = document.getElementById('chatSubtitle');
const chatStatusEl = document.getElementById('chatStatus');
const headerPresenceEl = document.getElementById('headerPresence');
const composerFormEl = document.getElementById('composerForm');
const composerInputEl = document.getElementById('composerInput');
const sendButtonEl = document.getElementById('sendButton');
const newContextButtonEl = document.getElementById('newContextButton');
const commandMenuEl = document.getElementById('commandMenu');
const attachButtonEl = document.getElementById('attachButton');
const mediaUploadInputEl = document.getElementById('mediaUploadInput');
const pendingUploadsEl = document.getElementById('pendingUploads');
const openSidebarButtonEl = document.getElementById('openSidebarButton');
const closeSidebarButtonEl = document.getElementById('closeSidebarButton');
const sidebarBackdropEl = document.getElementById('sidebarBackdrop');
const headerRefreshButtonEl = document.getElementById('headerRefreshButton');
const refreshAgentsButtonEl = document.getElementById('refreshAgentsButton');
const settingsButtonEl = document.getElementById('settingsButton');
const settingsBackdropEl = document.getElementById('settingsBackdrop');
const settingsPanelEl = document.getElementById('settingsPanel');
const closeSettingsButtonEl = document.getElementById('closeSettingsButton');
const settingsContactsTabEl = document.getElementById('settingsContactsTab');
const settingsPreferencesTabEl = document.getElementById('settingsPreferencesTab');
const settingsContactsSectionEl = document.getElementById('settingsContactsSection');
const settingsPreferencesSectionEl = document.getElementById('settingsPreferencesSection');
const settingsAvatarPreviewEl = document.getElementById('settingsAvatarPreview');
const settingsPreviewTitleEl = document.getElementById('settingsPreviewTitle');
const settingsPreviewSubtitleEl = document.getElementById('settingsPreviewSubtitle');
const settingsContactSelectEl = document.getElementById('settingsContactSelect');
const settingsDisplayNameInputEl = document.getElementById('settingsDisplayNameInput');
const settingsAvatarFileInputEl = document.getElementById('settingsAvatarFileInput');
const settingsChooseAvatarButtonEl = document.getElementById('settingsChooseAvatarButton');
const settingsClearAvatarButtonEl = document.getElementById('settingsClearAvatarButton');
const settingsAvatarHintEl = document.getElementById('settingsAvatarHint');
const saveSettingsButtonEl = document.getElementById('saveSettingsButton');
const mediaViewerEl = document.getElementById('mediaViewer');
const mediaViewerImageEl = document.getElementById('mediaViewerImage');
const mediaZoomOutButtonEl = document.getElementById('mediaZoomOutButton');
const mediaResetZoomButtonEl = document.getElementById('mediaResetZoomButton');
const mediaZoomInButtonEl = document.getElementById('mediaZoomInButton');
const appShellEl = document.querySelector('.app-shell');

boot().catch((error) => showStatus(`初始化失败：${formatError(error)}`, 'error'));

async function boot() {
  bindEvents();
  autoResizeComposer();
  await Promise.all([
    loadSettings(),
    loadCommandCatalog()
  ]);
  await refreshAgents({ autoOpen: true });
  startPolling();
}

function bindEvents() {
  composerFormEl.addEventListener('submit', handleSendSubmit);
  newContextButtonEl.addEventListener('click', toggleCommandMenu);
  commandMenuEl?.addEventListener('click', handleCommandMenuClick);
  document.addEventListener('click', handleOutsideCommandMenuClick);
  headerRefreshButtonEl.addEventListener('click', () => refreshAgents({ autoOpen: false, refreshCurrent: true }));
  refreshAgentsButtonEl?.addEventListener('click', () => refreshAgents({ autoOpen: false, refreshCurrent: true }));
  attachButtonEl.addEventListener('click', () => mediaUploadInputEl.click());
  mediaUploadInputEl.addEventListener('change', handleFileSelection);
  composerInputEl.addEventListener('input', autoResizeComposer);
  messageListEl.addEventListener('scroll', async () => {
    if (messageListEl.scrollTop > 64) return;
    if (!state.activeAgentId || !state.hasMore || state.loadingHistory) return;
    await loadOlderHistory();
  });

  openSidebarButtonEl.addEventListener('click', () => toggleSidebar(true));
  closeSidebarButtonEl.addEventListener('click', () => toggleSidebar(false));
  sidebarBackdropEl.addEventListener('click', () => toggleSidebar(false));

  settingsButtonEl.addEventListener('click', () => toggleSettingsPanel(true));
  closeSettingsButtonEl.addEventListener('click', () => toggleSettingsPanel(false));
  settingsBackdropEl.addEventListener('click', () => toggleSettingsPanel(false));
  settingsContactsTabEl.addEventListener('click', () => switchSettingsTab('contacts'));
  settingsPreferencesTabEl.addEventListener('click', () => switchSettingsTab('preferences'));
  settingsContactSelectEl.addEventListener('change', () => loadSettingsDraft(settingsContactSelectEl.value));
  settingsDisplayNameInputEl.addEventListener('input', () => {
    state.settingsDraftDisplayName = settingsDisplayNameInputEl.value;
    renderSettingsPreview();
  });
  settingsChooseAvatarButtonEl.addEventListener('click', () => settingsAvatarFileInputEl.click());
  settingsClearAvatarButtonEl.addEventListener('click', clearSettingsAvatarDraft);
  settingsAvatarFileInputEl.addEventListener('change', handleSettingsAvatarSelection);
  saveSettingsButtonEl.addEventListener('click', saveSettingsContact);
  mediaViewerEl.addEventListener('click', closeMediaViewer);
  mediaViewerEl.addEventListener('wheel', handleMediaViewerWheel, { passive: false });
  mediaViewerImageEl.addEventListener('click', handleMediaViewerImageClick);
  mediaViewerImageEl.addEventListener('pointerdown', handleMediaViewerPointerDown);
  mediaViewerImageEl.addEventListener('pointermove', handleMediaViewerPointerMove);
  mediaViewerImageEl.addEventListener('pointerup', handleMediaViewerPointerUp);
  mediaViewerImageEl.addEventListener('pointercancel', handleMediaViewerPointerUp);
  mediaZoomOutButtonEl.addEventListener('click', (event) => {
    event.stopPropagation();
    adjustMediaViewerScale(-0.2);
  });
  mediaResetZoomButtonEl.addEventListener('click', (event) => {
    event.stopPropagation();
    setMediaViewerScale(1);
  });
  mediaZoomInButtonEl.addEventListener('click', (event) => {
    event.stopPropagation();
    adjustMediaViewerScale(0.2);
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) toggleSidebar(false);
    syncAllVisualBubbleWidths();
  });
  window.addEventListener('keydown', handleWindowKeydown);
}

async function loadSettings() {
  try {
    const payload = await apiGet('/api/openclaw-webchat/settings');
    state.userProfile = {
      displayName: payload?.userProfile?.displayName || '我',
      avatarUrl: payload?.userProfile?.avatarUrl || null
    };
  } catch {
    state.userProfile = { displayName: '我', avatarUrl: null };
  }

  populateSettingsForm();
}

async function refreshAgents({ autoOpen = false, refreshCurrent = false } = {}) {
  const previousActive = state.activeAgentId;
  const previousActiveAgent = previousActive
    ? state.agents.find((item) => item.agentId === previousActive) || null
    : null;
  const data = await apiGet('/api/openclaw-webchat/agents');
  state.agents = Array.isArray(data.agents) ? data.agents : [];
  renderAgentList();
  updateHeader();
  populateSettingsForm();

  const nextAgentId = previousActive && state.agents.some((item) => item.agentId === previousActive)
    ? previousActive
    : state.agents[0]?.agentId || null;

  if (refreshCurrent && previousActive) {
    await openAgent(previousActive, { forceReload: true, preserveScrollBottom: true });
    return;
  }

  const nextActiveAgent = nextAgentId
    ? state.agents.find((item) => item.agentId === nextAgentId) || null
    : null;

  if (
    !autoOpen
    && previousActive
    && nextActiveAgent
    && shouldRefreshCurrentConversation(previousActiveAgent, nextActiveAgent)
  ) {
    await openAgent(previousActive, { forceReload: true, preserveScrollBottom: true });
    return;
  }

  if (autoOpen && nextAgentId) {
    await openAgent(nextAgentId, { forceReload: previousActive !== nextAgentId || !state.activeSessionKey });
  }
}

function shouldRefreshCurrentConversation(previousAgent, nextAgent) {
  if (!previousAgent || !nextAgent) return false;
  if (previousAgent.agentId !== nextAgent.agentId) return false;
  if (isActiveSessionBusy()) return false;

  return previousAgent.lastMessageAt !== nextAgent.lastMessageAt
    || previousAgent.summary !== nextAgent.summary
    || previousAgent.presence !== nextAgent.presence;
}

function renderAgentList() {
  agentListEl.innerHTML = '';

  if (!state.agents.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-tip';
    empty.textContent = '暂未发现 agent。';
    agentListEl.append(empty);
    return;
  }

  for (const agent of state.agents) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `agent-card${agent.agentId === state.activeAgentId ? ' active' : ''}`;
    button.addEventListener('click', () => openAgent(agent.agentId, { forceReload: agent.agentId !== state.activeAgentId }));

    const avatar = createAvatarElement({
      className: 'agent-avatar',
      avatarUrl: agent.avatarUrl,
      label: agent.name || agent.agentId,
      fallbackText: (agent.name || agent.agentId || '?').slice(0, 1).toUpperCase()
    });

    const content = document.createElement('div');
    content.className = 'agent-content';

    const topRow = document.createElement('div');
    topRow.className = 'agent-top-row';

    const name = document.createElement('div');
    name.className = 'agent-name';
    name.textContent = agent.name || agent.agentId;

    const meta = document.createElement('div');
    meta.className = 'agent-meta';

    const presence = document.createElement('span');
    presence.className = `presence-dot ${normalizePresence(agent.presence)}`;
    presence.title = formatPresenceLabel(agent.presence);

    const presenceLabel = document.createElement('span');
    presenceLabel.className = 'agent-presence-label';
    presenceLabel.textContent = formatPresenceLabel(agent.presence);

    meta.append(presence, presenceLabel);

    const summary = document.createElement('div');
    summary.className = 'agent-summary';
    summary.textContent = agent.summary || '点击进入会话';

    const bottomRow = document.createElement('div');
    bottomRow.className = 'agent-bottom-row';

    const time = document.createElement('div');
    time.className = 'agent-time';
    time.textContent = formatAgentTimestamp(agent.lastMessageAt);

    bottomRow.append(summary, time);
    topRow.append(name, meta);
    content.append(topRow, bottomRow);
    button.append(avatar, content);
    agentListEl.append(button);
  }
}

async function openAgent(agentId, { forceReload = false, preserveScrollBottom = false } = {}) {
  if (!agentId) return;
  if (state.selectedOpenPromise && state.activeAgentId === agentId && !forceReload) return state.selectedOpenPromise;

  const requestId = state.openRequestId + 1;
  state.openRequestId = requestId;
  state.activeAgentId = agentId;
  renderAgentList();
  updateHeader();
  populateSettingsForm();
  showStatus('正在打开会话…', 'info');
  toggleSidebar(false);

  const promise = (async () => {
    const response = await apiPost(`/api/openclaw-webchat/agents/${encodeURIComponent(agentId)}/open`, {});
    if (requestId !== state.openRequestId || state.activeAgentId !== agentId) return;
    state.activeSessionKey = response.sessionKey;
    state.messages = Array.isArray(response.history?.messages) ? response.history.messages : [];
    state.nextBefore = response.history?.nextBefore || null;
    state.hasMore = Boolean(response.history?.hasMore);
    renderMessages();
    syncComposerInteractivity();
    updateHeader();
    populateSettingsForm();
    if (!preserveScrollBottom) scrollMessagesToBottom();
    showStatus(response.created ? '已创建并进入该 agent 的长期主时间线。' : '会话已恢复。', 'success');
  })();

  state.selectedOpenPromise = promise;

  try {
    await promise;
  } finally {
    state.selectedOpenPromise = null;
  }
}

function renderMessages() {
  messageListEl.innerHTML = '';

  if (!state.messages.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <div class="eyebrow">openclaw-webchat</div>
      <h3>当前时间线还没有消息</h3>
      <p class="empty-tip">点输入框左侧的 + 可上传图片或音频；音频默认转写后发给 agent，同时保留原始文件引用。</p>
    `;
    messageListEl.append(empty);
    return;
  }

  for (const message of state.messages) {
    if (message.role === 'marker') {
      const row = document.createElement('div');
      row.className = 'marker-row';
      const chip = document.createElement('div');
      chip.className = 'marker-chip';
      chip.textContent = message.label || '已重置上下文';
      row.append(chip);
      messageListEl.append(row);
      continue;
    }

    const row = document.createElement('div');
    row.className = `message-row ${message.role}`;

    const avatar = createMessageAvatar(message.role);
    const body = document.createElement('div');
    body.className = 'message-body';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    const blocks = Array.isArray(message.blocks) ? message.blocks : [];
    const useVisualMediaBubble = shouldUseVisualMediaBubble(blocks);
    if (useVisualMediaBubble) {
      row.classList.add('visual-media-row');
      bubble.classList.add('visual-media-bubble');
    }

    for (const group of groupMessageBlocksForRender(blocks)) {
      if (group.kind === 'text') {
        const textWrap = document.createElement('div');
        textWrap.className = 'message-text-stack';
        group.blocks.forEach((block) => {
          textWrap.append(renderMarkdownBlock(block.text || ''));
        });
        bubble.append(textWrap);
        continue;
      }

      const mediaNode = renderMediaBlock(group.block, bubble);
      if (!mediaNode) continue;

      if (group.block.type === 'image' || group.block.type === 'video') {
        const mediaWrap = document.createElement('div');
        mediaWrap.className = 'message-media visual-media';
        mediaWrap.append(mediaNode);
        bubble.append(mediaWrap);
        continue;
      }

      bubble.append(mediaNode);
    }

    const time = document.createElement('div');
    time.className = 'message-time';
    time.textContent = formatTime(message.createdAt);

    body.append(bubble, time);
    row.append(avatar, body);
    messageListEl.append(row);
  }

  if (isActiveSessionBusy()) {
    messageListEl.append(createAssistantProcessingRow());
  }
}

function renderMediaBlock(block, bubble = null) {
  if (block.invalid) {
    return createInvalidMediaCard(block.name || block.type || '文件', block.invalidReason || '文件丢失');
  }

  if (block.type === 'image') {
    const wrapper = document.createElement('button');
    wrapper.type = 'button';
    wrapper.className = 'message-image-button';
    wrapper.setAttribute('aria-label', '查看图片');
    wrapper.addEventListener('click', () => openMediaViewer(block));

    const image = document.createElement('img');
    image.className = 'message-image';
    image.src = block.url;
    image.alt = block.name || '图片';
    image.loading = 'lazy';
    keepMessagesPinnedOnMediaLoad(image, 'load');
    bindVisualMediaWidth(bubble, wrapper, image, 'load');
    image.addEventListener('error', () => wrapper.replaceWith(createInvalidMediaCard(block.name || '图片', '图片加载失败')));
    wrapper.append(image);
    return wrapper;
  }

  if (block.type === 'audio') {
    const wrapper = createMediaCard(block, '音频');
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.preload = 'metadata';
    audio.src = block.url;
    keepMessagesPinnedOnMediaLoad(audio, 'loadedmetadata');
    audio.addEventListener('error', () => wrapper.replaceWith(createInvalidMediaCard(block.name || '音频', '音频加载失败')));
    wrapper.append(audio);

    if (block.transcriptStatus === 'ready' && block.transcriptText) {
      wrapper.append(createMediaNote('转写文本', block.transcriptText));
    } else if (block.transcriptStatus === 'failed') {
      wrapper.append(createMediaNote('转写状态', block.transcriptError || '转写失败，已保留原始音频', true));
    }

    return wrapper;
  }

  if (block.type === 'video') {
    const wrapper = document.createElement('div');
    wrapper.className = 'message-video-shell';

    const video = document.createElement('video');
    video.className = 'message-video';
    video.controls = true;
    video.preload = 'metadata';
    video.src = block.url;
    keepMessagesPinnedOnMediaLoad(video, 'loadedmetadata');
    bindVisualMediaWidth(bubble, wrapper, video, 'loadedmetadata');
    video.addEventListener('error', () => wrapper.replaceWith(createInvalidMediaCard(block.name || '视频', '视频加载失败')));
    wrapper.append(video);
    return wrapper;
  }

  const link = document.createElement('a');
  link.className = 'file-card';
  link.href = block.url;
  link.target = '_blank';
  link.rel = 'noreferrer';

  const title = document.createElement('div');
  title.className = 'file-title';
  title.textContent = block.name || '文件';

  const meta = document.createElement('div');
  meta.className = 'file-meta';
  meta.textContent = `点击打开${block.sizeBytes ? ` · ${formatBytes(block.sizeBytes)}` : ''}`;

  link.append(title, meta);
  return link;
}

function createMediaCard(block, label) {
  const wrapper = document.createElement('article');
  wrapper.className = `media-card ${block.type}`;

  const header = document.createElement('div');
  header.className = 'media-card-header';

  const title = document.createElement('div');
  title.className = 'media-card-title';
  title.textContent = block.name || label;

  const meta = document.createElement('div');
  meta.className = 'media-card-meta';
  meta.textContent = [label, block.sizeBytes ? formatBytes(block.sizeBytes) : '']
    .filter(Boolean)
    .join(' · ');

  header.append(title, meta);
  wrapper.append(header);
  return wrapper;
}

function createMediaNote(label, content, warning = false) {
  const note = document.createElement('div');
  note.className = `media-note${warning ? ' warning' : ''}`;

  const heading = document.createElement('div');
  heading.className = 'media-note-label';
  heading.textContent = label;

  const body = document.createElement('div');
  body.className = 'media-note-body';
  body.textContent = content || '';

  note.append(heading, body);
  return note;
}

function createInvalidMediaCard(titleText, reasonText) {
  const invalid = document.createElement('div');
  invalid.className = 'invalid-card';

  const title = document.createElement('div');
  title.className = 'file-title';
  title.textContent = titleText;

  const reason = document.createElement('div');
  reason.className = 'file-meta';
  reason.textContent = reasonText;

  invalid.append(title, reason);
  return invalid;
}

function bindVisualMediaWidth(bubble, wrapper, mediaElement, eventName) {
  if (!bubble || !wrapper) return;

  const applyWidth = () => {
    requestAnimationFrame(() => {
      syncVisualBubbleWidth(bubble);
      requestAnimationFrame(() => syncVisualBubbleWidth(bubble));
    });
  };

  if (mediaElement.complete || mediaElement.readyState >= 1) {
    applyWidth();
  }

  mediaElement.addEventListener(eventName, applyWidth, { once: true });
}

function syncAllVisualBubbleWidths() {
  document.querySelectorAll('.message-bubble.visual-media-bubble').forEach((bubble) => {
    syncVisualBubbleWidth(bubble);
  });
}

function syncVisualBubbleWidth(bubble) {
  if (!bubble) return;
  const mediaElements = Array.from(bubble.querySelectorAll('.message-image, .message-video'));
  let width = 0;

  for (const mediaElement of mediaElements) {
    const nextWidth = Math.round(mediaElement.getBoundingClientRect().width);
    if (nextWidth > width) width = nextWidth;
  }

  if (width <= 0) return;

  bubble.dataset.mediaMeasured = 'true';
  bubble.dataset.visualMediaWidth = String(width);
  bubble.style.setProperty('--visual-media-width', `${width}px`);
  bubble.querySelectorAll('.message-image-button, .message-video-shell').forEach((wrapper) => {
    wrapper.style.setProperty('--visual-media-width', `${width}px`);
  });
}

function shouldUseVisualMediaBubble(blocks) {
  const normalizedBlocks = Array.isArray(blocks) ? blocks : [];
  const visualMediaCount = normalizedBlocks.filter((block) => block?.type === 'image' || block?.type === 'video').length;
  if (!visualMediaCount) return false;

  const totalTextLength = normalizedBlocks.reduce((sum, block) => {
    if (block?.type !== 'text') return sum;
    return sum + String(block.text || '').trim().length;
  }, 0);

  if (totalTextLength === 0) return true;

  return totalTextLength <= 220;
}

async function loadOlderHistory() {
  if (!state.activeAgentId || !state.nextBefore || state.loadingHistory) return;
  const targetAgentId = state.activeAgentId;
  const targetSessionKey = state.activeSessionKey;
  const targetBefore = state.nextBefore;
  state.loadingHistory = true;
  const previousHeight = messageListEl.scrollHeight;

  try {
    const data = await apiGet(`/api/openclaw-webchat/agents/${encodeURIComponent(targetAgentId)}/history?limit=30&before=${encodeURIComponent(targetBefore)}`);
    if (!isOperationContextActive({ agentId: targetAgentId, sessionKey: targetSessionKey })) return;
    const incoming = Array.isArray(data.messages) ? data.messages : [];
    state.messages = [...incoming, ...state.messages];
    state.nextBefore = data.nextBefore || null;
    state.hasMore = Boolean(data.hasMore);
    renderMessages();
    const nextHeight = messageListEl.scrollHeight;
    messageListEl.scrollTop = Math.max(0, nextHeight - previousHeight);
  } finally {
    state.loadingHistory = false;
  }
}

async function handleSendSubmit(event) {
  event.preventDefault();
  if (!state.activeSessionKey || isActiveSessionBusy()) return;

  const targetSessionKey = state.activeSessionKey;
  const targetAgentId = state.activeAgentId;
  const context = { agentId: targetAgentId, sessionKey: targetSessionKey };

  const text = composerInputEl.value.trim();
  if (!text && !state.pendingUploads.length) return;

  const slashName = getSlashCommandName(text);
  if (text && !state.pendingUploads.length && isWhitelistedSlash(slashName)) {
    composerInputEl.value = '';
    autoResizeComposer();
    closeCommandMenu();
    await executeSlashCommand(text);
    return;
  }

  beginSessionActivity(targetSessionKey);
  showContextStatus(context, getSendingStatusMessage(), 'info');

  let uploadedBlocks = [];

  try {
    uploadedBlocks = await ensurePendingUploadsReady();
  } catch (error) {
    endSessionActivity(targetSessionKey);
    showContextStatus(context, `附件处理失败：${formatError(error)}`, 'error');
    return;
  }

  const optimistic = {
    id: `local-${Date.now()}`,
    role: 'user',
    createdAt: new Date().toISOString(),
    blocks: buildOptimisticBlocks(text, state.pendingUploads)
  };
  const draftText = text;
  const draftAttachments = state.pendingUploads;
  state.messages.push(optimistic);
  composerInputEl.value = '';
  mediaUploadInputEl.value = '';
  state.pendingUploads = [];
  renderPendingUploads();
  autoResizeComposer();
  renderMessages();
  scrollMessagesToBottom();

  try {
    const response = await apiPost(`/api/openclaw-webchat/sessions/${encodeURIComponent(targetSessionKey)}/send`, {
      text,
      blocks: uploadedBlocks
    });
    if (response?.message && isOperationContextActive(context)) state.messages.push(response.message);
    releasePendingUploads(draftAttachments);
    if (isOperationContextActive(context)) {
      renderMessages();
      scrollMessagesToBottom();
    }
    showContextStatus(context, '发送完成。', 'success');
    await refreshAgents({ autoOpen: false });
  } catch (error) {
    if (isOperationContextActive(context)) {
      state.messages = state.messages.filter((item) => item.id !== optimistic.id);
      composerInputEl.value = draftText;
      state.pendingUploads = draftAttachments;
      renderPendingUploads();
      autoResizeComposer();
      renderMessages();
    }
    showContextStatus(context, `发送失败：${formatError(error)}`, 'error');
  } finally {
    endSessionActivity(targetSessionKey);
    if (isOperationContextActive(context)) {
      renderMessages();
      scrollMessagesToBottom();
    }
  }
}

async function handleFileSelection(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  const additions = [];
  for (const file of files) {
    const kind = detectAttachmentKind(file);
    if (!kind) {
      showStatus(`仅支持图片或音频上传：${file.name}`, 'error');
      continue;
    }

    additions.push({
      id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      kind,
      name: file.name,
      mimeType: file.type || (kind === 'audio' ? 'audio/m4a' : 'image/png'),
      previewUrl: kind === 'image' ? URL.createObjectURL(file) : null,
      source: null,
      uploadedUrl: null,
      transcriptStatus: null,
      transcriptText: null,
      transcriptError: null,
      sizeBytes: file.size || null
    });
  }

  state.pendingUploads.push(...additions);
  renderPendingUploads();
  event.target.value = '';
  scrollMessagesToBottom();
}

async function loadCommandCatalog() {
  try {
    const payload = await apiGet('/api/openclaw-webchat/commands');
    state.commandCatalog = Array.isArray(payload?.commands) ? payload.commands : [];
    const allowed = Array.isArray(payload?.allowed) && payload.allowed.length
      ? payload.allowed
      : state.commandCatalog.map((item) => item?.name);
    state.allowedCommands = new Set(allowed.map(normalizeSlashCommandName).filter(Boolean));
  } catch {
    state.commandCatalog = getDefaultCommandCatalog();
    state.allowedCommands = new Set(state.commandCatalog.map((item) => normalizeSlashCommandName(item.name)).filter(Boolean));
  }

  renderCommandMenu();
}

function getDefaultCommandCatalog() {
  return [
    { name: '/new', description: '重置上游上下文并保留本地历史' },
    { name: '/reset', description: '等同 /new' },
    { name: '/model', description: '查看或设置当前模型', args: '<name>' },
    { name: '/models', description: '查看可用模型列表（/model 别名）', args: '<name>' },
    { name: '/think', description: '查看或设置 thinking level', args: '<level>' },
    { name: '/fast', description: '查看或设置 fast mode', args: '<status|on|off>' },
    { name: '/verbose', description: '查看或设置 verbose level', args: '<on|off|full>' },
    { name: '/compact', description: '压缩当前上游 session transcript' },
    { name: '/help', description: '显示本地 slash 命令帮助' }
  ];
}

function renderCommandMenu() {
  if (!commandMenuEl) return;
  commandMenuEl.innerHTML = '';

  const commands = sortCommandCatalog(state.commandCatalog.length ? state.commandCatalog : getDefaultCommandCatalog());
  const visibleCommands = commands.filter((item) => isWhitelistedSlash(item?.name));

  if (!visibleCommands.length) {
    const empty = document.createElement('div');
    empty.className = 'command-menu-empty';
    empty.textContent = '当前没有可用本地命令';
    commandMenuEl.append(empty);
    return;
  }

  for (const [category, items] of Object.entries(groupCommandCatalog(visibleCommands))) {
    if (!items.length) continue;

    const section = document.createElement('section');
    section.className = 'command-menu-section';

    const title = document.createElement('div');
    title.className = 'command-menu-title';
    title.textContent = getCommandCategoryLabel(category);
    section.append(title);

    for (const item of items) {
      section.append(createCommandMenuItem(item));
    }

    commandMenuEl.append(section);
  }
}

function toggleCommandMenu(event) {
  event?.stopPropagation?.();
  setCommandMenuOpen(commandMenuEl?.classList.contains('hidden'));
}

function closeCommandMenu() {
  setCommandMenuOpen(false);
}

async function handleCommandMenuClick(event) {
  const button = event.target.closest('[data-command]');
  if (!button) return;
  const command = button.dataset.command;
  if (!command) return;
  closeCommandMenu();
  await executeSlashCommand(command);
}

function handleOutsideCommandMenuClick(event) {
  if (!commandMenuEl || commandMenuEl.classList.contains('hidden')) return;
  if (commandMenuEl.contains(event.target) || newContextButtonEl.contains(event.target)) return;
  closeCommandMenu();
}

function setCommandMenuOpen(open) {
  if (!commandMenuEl) return;
  commandMenuEl.classList.toggle('hidden', !open);
  newContextButtonEl?.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function createCommandMenuItem(item) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'command-item';
  button.dataset.command = item.name;

  const title = document.createElement('span');
  title.className = 'command-item-command';
  title.textContent = item.args ? `${item.name} ${item.args}` : item.name;

  const desc = document.createElement('span');
  desc.className = 'command-item-desc';
  desc.textContent = item.description || '';

  button.append(title, desc);
  return button;
}

function groupCommandCatalog(commands) {
  const grouped = {
    session: [],
    model: [],
    tools: []
  };

  for (const item of commands) {
    const category = grouped[item?.category] ? item.category : 'tools';
    grouped[category].push(item);
  }

  return grouped;
}

function sortCommandCatalog(commands) {
  const categoryWeight = { session: 0, model: 1, tools: 2 };
  return [...commands].sort((left, right) => {
    const leftWeight = categoryWeight[left?.category] ?? 9;
    const rightWeight = categoryWeight[right?.category] ?? 9;
    if (leftWeight !== rightWeight) return leftWeight - rightWeight;
    return String(left?.name || '').localeCompare(String(right?.name || ''));
  });
}

function getCommandCategoryLabel(category) {
  if (category === 'session') return 'Session';
  if (category === 'model') return 'Model';
  return 'Tools';
}

async function executeSlashCommand(command) {
  if (!state.activeSessionKey || isActiveSessionBusy()) return;
  const targetSessionKey = state.activeSessionKey;
  const targetAgentId = state.activeAgentId;
  const context = { agentId: targetAgentId, sessionKey: targetSessionKey };
  beginSessionActivity(targetSessionKey);
  showContextStatus(context, `正在执行 ${command.split(/\s+/, 1)[0]}…`, 'info');

  try {
    const response = await apiPost(`/api/openclaw-webchat/sessions/${encodeURIComponent(targetSessionKey)}/command`, { command });
    if (response?.message && isOperationContextActive(context)) state.messages.push(response.message);
    if (isOperationContextActive(context)) {
      renderMessages();
      scrollMessagesToBottom();
    }
    showContextStatus(context, buildSlashCommandSuccessMessage(command), 'success');
    await refreshAgents({ autoOpen: false });
  } catch (error) {
    showContextStatus(context, `命令失败：${formatError(error)}`, 'error');
  } finally {
    endSessionActivity(targetSessionKey);
    if (isOperationContextActive(context)) {
      renderMessages();
    }
  }
}

function buildSlashCommandSuccessMessage(command) {
  const name = getSlashCommandName(command);
  if (name === '/new' || name === '/reset') return '上游上下文已重置，本地历史已保留。';
  if (name === '/compact') return '压缩命令已执行。';
  return `${name} 已执行。`;
}

function normalizeSlashCommandName(command) {
  const raw = String(command || '').trim().toLowerCase();
  if (!raw) return '';
  return raw.startsWith('/') ? raw : `/${raw}`;
}

function getSlashCommandName(text) {
  const parsed = String(text || '').trim().match(/^\/([^\s:]+)(?:\s*:?\s*.*)?$/u);
  if (!parsed) return '';
  return normalizeSlashCommandName(parsed[1]);
}

function isWhitelistedSlash(commandName) {
  return state.allowedCommands.has(normalizeSlashCommandName(commandName));
}

function updateHeader() {
  const active = getActiveAgent();
  chatTitleEl.textContent = active?.name || 'openclaw-webchat';
  chatSubtitleEl.textContent = active
    ? `${active.hasSession ? '长期主时间线' : '点击后自动创建'} · ${active.summary || '暂无摘要'}`
    : '选择 agent 开始聊天';
  headerPresenceEl.className = `presence-dot ${normalizePresence(active?.presence || 'idle')}`;
}

function createAvatarElement({ className, avatarUrl, label, fallbackText }) {
  const avatar = document.createElement('div');
  avatar.className = className;
  if (avatarUrl) {
    const image = document.createElement('img');
    image.src = avatarUrl;
    image.alt = label || fallbackText || 'avatar';
    image.addEventListener('error', () => {
      avatar.innerHTML = '';
      avatar.textContent = fallbackText || (label || '?').slice(0, 1).toUpperCase();
    }, { once: true });
    avatar.append(image);
  } else {
    avatar.textContent = fallbackText || (label || '?').slice(0, 1).toUpperCase();
  }
  return avatar;
}

function createMessageAvatar(role) {
  if (role === 'user') {
    return createAvatarElement({
      className: 'message-avatar user',
      avatarUrl: state.userProfile.avatarUrl,
      label: state.userProfile.displayName || '我',
      fallbackText: (state.userProfile.displayName || '我').slice(0, 1)
    });
  }

  const active = getActiveAgent();
  return createAvatarElement({
    className: 'message-avatar assistant',
    avatarUrl: active?.avatarUrl,
    label: active?.name || active?.agentId || 'A',
    fallbackText: (active?.name || active?.agentId || 'A').slice(0, 1).toUpperCase()
  });
}

function createAssistantProcessingRow() {
  const row = document.createElement('div');
  row.className = 'message-row assistant processing';

  const avatar = createMessageAvatar('assistant');
  const indicator = document.createElement('div');
  indicator.className = 'processing-indicator';
  indicator.setAttribute('aria-label', 'agent 正在处理');

  for (let index = 0; index < 3; index += 1) {
    const dot = document.createElement('span');
    dot.className = 'processing-indicator-dot';
    dot.style.animationDelay = `${index * 0.14}s`;
    indicator.append(dot);
  }

  row.append(avatar, indicator);
  return row;
}

function renderMarkdownBlock(text) {
  const wrapper = document.createElement('div');
  wrapper.className = 'message-text markdown-content';
  appendMarkdownBlocks(wrapper, String(text || ''));
  return wrapper;
}

function appendMarkdownBlocks(container, source) {
  const lines = String(source || '').replace(/\r\n?/g, '\n').split('\n');

  for (let index = 0; index < lines.length;) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fenceMatch = line.match(/^```([\w-]+)?\s*$/);
    if (fenceMatch) {
      const language = fenceMatch[1] || '';
      const codeLines = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      container.append(createMarkdownCodeBlock(codeLines.join('\n'), language));
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const heading = document.createElement(`h${headingMatch[1].length}`);
      appendInlineMarkdown(heading, headingMatch[2]);
      container.append(heading);
      index += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      container.append(document.createElement('hr'));
      index += 1;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quoteLines = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^\s*>\s?/, ''));
        index += 1;
      }
      const quote = document.createElement('blockquote');
      appendMarkdownBlocks(quote, quoteLines.join('\n'));
      container.append(quote);
      continue;
    }

    const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      const ordered = /\d+\./.test(listMatch[2]);
      const list = document.createElement(ordered ? 'ol' : 'ul');
      while (index < lines.length) {
        const itemMatch = lines[index].match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
        if (!itemMatch || /\d+\./.test(itemMatch[2]) !== ordered) break;
        const item = document.createElement('li');
        appendInlineMarkdown(item, itemMatch[3]);
        list.append(item);
        index += 1;
      }
      container.append(list);
      continue;
    }

    const paragraphLines = [];
    while (index < lines.length && lines[index].trim() && !isMarkdownBlockStarter(lines[index])) {
      paragraphLines.push(lines[index]);
      index += 1;
    }

    const paragraph = document.createElement('p');
    paragraphLines.forEach((paragraphLine, lineIndex) => {
      if (lineIndex > 0) paragraph.append(document.createElement('br'));
      appendInlineMarkdown(paragraph, paragraphLine);
    });
    container.append(paragraph);
  }
}

function isMarkdownBlockStarter(line) {
  const value = String(line || '');
  return /^```/.test(value)
    || /^(#{1,6})\s+/.test(value)
    || /^(-{3,}|\*{3,}|_{3,})\s*$/.test(value.trim())
    || /^\s*>\s?/.test(value)
    || /^(\s*)([-*+]|\d+\.)\s+/.test(value);
}

function createMarkdownCodeBlock(text, language) {
  const pre = document.createElement('pre');
  const code = document.createElement('code');
  if (language) code.dataset.language = language;
  code.textContent = text || '';
  pre.append(code);
  return pre;
}

function appendInlineMarkdown(parent, source) {
  const text = String(source || '');
  const pattern = /(`([^`]+)`)|(\[([^\]]+)\]\(([^)\s]+)\))|(\*\*([^*]+)\*\*)|(__(.+?)__)|(~~(.+?)~~)|(\*([^*]+)\*)|(_([^_]+)_)/g;
  let cursor = 0;
  let match;

  while ((match = pattern.exec(text))) {
    if (match.index > cursor) {
      parent.append(document.createTextNode(text.slice(cursor, match.index)));
    }

    if (match[1]) {
      const code = document.createElement('code');
      code.textContent = match[2] || '';
      parent.append(code);
    } else if (match[3]) {
      const href = sanitizeMarkdownHref(match[5]);
      if (!href) {
        parent.append(document.createTextNode(match[0]));
      } else {
        const link = document.createElement('a');
        link.href = href;
        link.target = '_blank';
        link.rel = 'noreferrer';
        appendInlineMarkdown(link, match[4] || href);
        parent.append(link);
      }
    } else if (match[6] || match[8]) {
      const strong = document.createElement('strong');
      appendInlineMarkdown(strong, match[7] || match[9] || '');
      parent.append(strong);
    } else if (match[10]) {
      const strike = document.createElement('s');
      appendInlineMarkdown(strike, match[11] || '');
      parent.append(strike);
    } else if (match[12] || match[14]) {
      const em = document.createElement('em');
      appendInlineMarkdown(em, match[13] || match[15] || '');
      parent.append(em);
    }

    cursor = pattern.lastIndex;
  }

  if (cursor < text.length) {
    parent.append(document.createTextNode(text.slice(cursor)));
  }
}

function sanitizeMarkdownHref(href) {
  const value = String(href || '').trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return null;
}

function renderPendingUploads() {
  pendingUploadsEl.innerHTML = '';
  pendingUploadsEl.hidden = state.pendingUploads.length === 0;

  for (const attachment of state.pendingUploads) {
    const item = document.createElement('div');
    item.className = `pending-upload ${attachment.kind}`;

    const preview = attachment.kind === 'image'
      ? createPendingImagePreview(attachment)
      : createPendingAudioPreview();

    const meta = document.createElement('div');
    meta.className = 'pending-upload-meta';

    const title = document.createElement('div');
    title.className = 'pending-upload-name';
    title.textContent = attachment.name || (attachment.kind === 'audio' ? '未命名音频' : '未命名图片');

    const subtitle = document.createElement('div');
    subtitle.className = 'pending-upload-hint';
    subtitle.textContent = buildPendingUploadHint(attachment);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'pending-upload-remove';
    remove.textContent = '移除';
    remove.disabled = isActiveSessionBusy();
    remove.addEventListener('click', () => removePendingUpload(attachment.id));

    meta.append(title, subtitle);
    item.append(preview, meta, remove);
    pendingUploadsEl.append(item);
  }
}

function createPendingImagePreview(attachment) {
  const preview = document.createElement('img');
  preview.className = 'pending-upload-preview';
  preview.src = attachment.previewUrl || attachment.uploadedUrl || '';
  preview.alt = attachment.name || '图片预览';
  return preview;
}

function createPendingAudioPreview() {
  const badge = document.createElement('div');
  badge.className = 'pending-upload-audio';
  badge.textContent = '音频';
  return badge;
}

function buildPendingUploadHint(attachment) {
  if (attachment.kind === 'image') {
    return attachment.source ? '已就绪，发送时会一并带上' : '发送时自动上传';
  }

  if (!attachment.source) return '发送时自动上传并转写';
  if (attachment.transcriptStatus === 'ready' && attachment.transcriptText) {
    return `转写完成 · ${summarizeText(attachment.transcriptText, 32)}`;
  }
  if (attachment.transcriptStatus === 'failed') {
    return attachment.transcriptError || '转写失败，仍会发送原音频';
  }
  return '已就绪，发送时会一并带上';
}

function removePendingUpload(uploadId) {
  const target = state.pendingUploads.find((item) => item.id === uploadId);
  if (target?.previewUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(target.previewUrl);
  }

  state.pendingUploads = state.pendingUploads.filter((item) => item.id !== uploadId);
  renderPendingUploads();
}

function clearPendingUploads() {
  releasePendingUploads(state.pendingUploads);
  state.pendingUploads = [];
  renderPendingUploads();
}

function releasePendingUploads(attachments) {
  for (const attachment of attachments || []) {
    if (attachment?.previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(attachment.previewUrl);
    }
  }
}

async function ensurePendingUploadsReady() {
  const blocks = [];

  for (let index = 0; index < state.pendingUploads.length; index += 1) {
    const attachment = state.pendingUploads[index];

    if (!attachment.source) {
      showStatus(buildUploadProgressMessage(attachment, index), 'info');
      const payload = await uploadPendingAttachment(attachment);
      attachment.source = payload?.upload?.source || null;
      attachment.uploadedUrl = payload?.block?.url || null;
      attachment.transcriptStatus = payload?.upload?.transcriptStatus || null;
      attachment.transcriptText = payload?.upload?.transcriptText || null;
      attachment.transcriptError = payload?.upload?.transcriptError || null;
      attachment.sizeBytes = payload?.upload?.size || attachment.sizeBytes;
      if (!attachment.source) {
        throw new Error(`上传失败：${attachment.name || '附件'}`);
      }
    }

    blocks.push(...buildSendBlocksForAttachment(attachment));
  }

  return blocks;
}

function buildUploadProgressMessage(attachment, index) {
  if (attachment.kind === 'audio') {
    return `正在上传并转写音频 ${index + 1}/${state.pendingUploads.length}…`;
  }
  return `正在上传图片 ${index + 1}/${state.pendingUploads.length}…`;
}

async function uploadPendingAttachment(attachment) {
  const contentBase64 = await readFileAsBase64(attachment.file);
  return apiPost('/api/openclaw-webchat/uploads', {
    kind: attachment.kind,
    filename: attachment.name,
    mimeType: attachment.mimeType,
    contentBase64
  });
}

function buildSendBlocksForAttachment(attachment) {
  return [{
    type: attachment.kind,
    source: attachment.source,
    name: attachment.name,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    transcriptStatus: attachment.transcriptStatus,
    transcriptText: attachment.transcriptText,
    transcriptError: attachment.transcriptError
  }];
}

function buildOptimisticBlocks(text, attachments) {
  const blocks = [];
  if (text) {
    blocks.push({ type: 'text', text });
  }

  for (const attachment of attachments) {
    blocks.push({
      type: attachment.kind,
      url: attachment.uploadedUrl || attachment.previewUrl || '',
      name: attachment.name,
      sizeBytes: attachment.sizeBytes,
      transcriptStatus: attachment.transcriptStatus,
      transcriptText: attachment.transcriptText,
      transcriptError: attachment.transcriptError
    });
  }

  return blocks;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`读取文件失败：${file?.name || 'unknown'}`));
    reader.onload = () => {
      const result = String(reader.result || '');
      const [, base64 = ''] = result.split(',', 2);
      if (!base64) {
        reject(new Error(`读取文件失败：${file?.name || 'unknown'}`));
        return;
      }
      resolve(base64);
    };
    reader.readAsDataURL(file);
  });
}

async function cropAvatarToSquare(file, outputSize = 512) {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const side = Math.min(image.naturalWidth || image.width, image.naturalHeight || image.height);
  const sourceX = Math.max(0, ((image.naturalWidth || image.width) - side) / 2);
  const sourceY = Math.max(0, ((image.naturalHeight || image.height) - side) / 2);
  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('浏览器不支持头像裁剪。');
  }

  context.drawImage(image, sourceX, sourceY, side, side, 0, 0, outputSize, outputSize);
  const blob = await canvasToBlob(canvas, 'image/png', 0.92);
  const filename = toAvatarFilename(file.name);
  return new File([blob], filename, { type: 'image/png' });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`读取文件失败：${file?.name || 'unknown'}`));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片加载失败，无法裁剪头像。'));
    image.src = src;
  });
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('头像导出失败。'));
        return;
      }
      resolve(blob);
    }, mimeType, quality);
  });
}

function toAvatarFilename(name) {
  const base = String(name || 'avatar').replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '');
  return `${base || 'avatar'}-square.png`;
}

async function uploadSettingsAvatar(file, target) {
  const contentBase64 = await readFileAsBase64(file);
  return apiPost('/api/openclaw-webchat/uploads', {
    kind: 'image',
    filename: `${target.kind}-${target.id}-${file.name}`,
    mimeType: file.type || 'image/png',
    contentBase64
  });
}

function openMediaViewer(block) {
  if (!block?.url) return;
  state.mediaViewerOpen = true;
  state.mediaViewerScale = 1;
  state.mediaViewerOffsetX = 0;
  state.mediaViewerOffsetY = 0;
  state.mediaViewerDragging = false;
  state.mediaViewerPointerId = null;
  state.mediaViewerMoved = false;
  mediaViewerImageEl.src = block.url;
  mediaViewerImageEl.alt = block.name || '图片预览';
  mediaViewerEl.hidden = false;
  mediaViewerEl.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  applyMediaViewerTransform();
}

function closeMediaViewer() {
  if (!state.mediaViewerOpen) return;
  state.mediaViewerOpen = false;
  state.mediaViewerScale = 1;
  state.mediaViewerOffsetX = 0;
  state.mediaViewerOffsetY = 0;
  state.mediaViewerDragging = false;
  state.mediaViewerPointerId = null;
  state.mediaViewerMoved = false;
  mediaViewerEl.hidden = true;
  mediaViewerEl.setAttribute('aria-hidden', 'true');
  mediaViewerImageEl.removeAttribute('src');
  document.body.style.overflow = '';
}

function handleMediaViewerWheel(event) {
  if (!state.mediaViewerOpen) return;
  event.preventDefault();
  adjustMediaViewerScale(event.deltaY < 0 ? 0.12 : -0.12);
}

function adjustMediaViewerScale(delta) {
  setMediaViewerScale(state.mediaViewerScale + delta);
}

function setMediaViewerScale(nextScale) {
  state.mediaViewerScale = Math.min(4, Math.max(0.6, Number(nextScale) || 1));
  if (state.mediaViewerScale <= 1) {
    state.mediaViewerOffsetX = 0;
    state.mediaViewerOffsetY = 0;
  }
  applyMediaViewerTransform();
}

function applyMediaViewerTransform() {
  mediaViewerImageEl.style.transform = `translate(${state.mediaViewerOffsetX}px, ${state.mediaViewerOffsetY}px) scale(${state.mediaViewerScale})`;
  mediaViewerImageEl.classList.toggle('is-draggable', state.mediaViewerScale > 1);
  mediaViewerImageEl.classList.toggle('is-dragging', state.mediaViewerDragging);
}

function handleMediaViewerImageClick(event) {
  event.stopPropagation();
  if (state.mediaViewerMoved) {
    state.mediaViewerMoved = false;
    return;
  }
  closeMediaViewer();
}

function handleMediaViewerPointerDown(event) {
  if (!state.mediaViewerOpen || state.mediaViewerScale <= 1) return;
  event.preventDefault();
  event.stopPropagation();
  state.mediaViewerDragging = true;
  state.mediaViewerPointerId = event.pointerId;
  state.mediaViewerDragStartX = event.clientX - state.mediaViewerOffsetX;
  state.mediaViewerDragStartY = event.clientY - state.mediaViewerOffsetY;
  state.mediaViewerMoved = false;
  mediaViewerImageEl.setPointerCapture(event.pointerId);
  applyMediaViewerTransform();
}

function handleMediaViewerPointerMove(event) {
  if (!state.mediaViewerDragging || state.mediaViewerPointerId !== event.pointerId) return;
  event.preventDefault();
  const nextX = event.clientX - state.mediaViewerDragStartX;
  const nextY = event.clientY - state.mediaViewerDragStartY;
  if (Math.abs(nextX - state.mediaViewerOffsetX) > 1 || Math.abs(nextY - state.mediaViewerOffsetY) > 1) {
    state.mediaViewerMoved = true;
  }
  state.mediaViewerOffsetX = nextX;
  state.mediaViewerOffsetY = nextY;
  applyMediaViewerTransform();
}

function handleMediaViewerPointerUp(event) {
  if (state.mediaViewerPointerId !== event.pointerId) return;
  if (mediaViewerImageEl.hasPointerCapture?.(event.pointerId)) {
    mediaViewerImageEl.releasePointerCapture(event.pointerId);
  }
  state.mediaViewerDragging = false;
  state.mediaViewerPointerId = null;
  applyMediaViewerTransform();
}

function handleWindowKeydown(event) {
  if (event.key === 'Escape' && state.mediaViewerOpen) {
    closeMediaViewer();
    return;
  }

  if (event.key === 'Escape') {
    closeCommandMenu();
  }
}

function detectAttachmentKind(file) {
  const mimeType = String(file?.type || '').toLowerCase();
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';

  const filename = String(file?.name || '').toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp|svg|heic|heif|avif)$/i.test(filename)) return 'image';
  if (/\.(m4a|mp3|wav|aac|ogg|opus|flac|webm)$/i.test(filename)) return 'audio';
  return null;
}

function toggleSettingsPanel(open) {
  state.settingsOpen = Boolean(open);
  appShellEl.classList.toggle('settings-open', state.settingsOpen);
  settingsPanelEl.setAttribute('aria-hidden', state.settingsOpen ? 'false' : 'true');
  if (state.settingsOpen) {
    state.settingsExpandedSection = null;
    populateSettingsForm({ resetDraft: true });
  } else {
    resetSettingsAvatarDraft();
  }
}

function populateSettingsForm({ resetDraft = false } = {}) {
  renderSettingsTabs();
  renderSettingsContactOptions();

  const currentKey = resolveValidSettingsContactKey(state.settingsSelectedContactKey);
  if (resetDraft || currentKey !== state.settingsSelectedContactKey) {
    loadSettingsDraft(currentKey);
    return;
  }

  settingsContactSelectEl.value = currentKey;
  settingsDisplayNameInputEl.value = state.settingsDraftDisplayName;
  renderSettingsPreview();
}

function renderSettingsTabs() {
  const isContacts = state.settingsExpandedSection === 'contacts';
  const isPreferences = state.settingsExpandedSection === 'preferences';
  settingsContactsTabEl.classList.toggle('active', isContacts);
  settingsPreferencesTabEl.classList.toggle('active', isPreferences);
  settingsContactsTabEl.setAttribute('aria-expanded', isContacts ? 'true' : 'false');
  settingsPreferencesTabEl.setAttribute('aria-expanded', isPreferences ? 'true' : 'false');
  settingsContactsSectionEl.hidden = !isContacts;
  settingsPreferencesSectionEl.hidden = !isPreferences;
}

function switchSettingsTab(tab) {
  const next = tab === 'preferences' ? 'preferences' : 'contacts';
  state.settingsExpandedSection = state.settingsExpandedSection === next ? null : next;
  if (state.settingsExpandedSection === 'contacts' && !state.settingsSelectedContactKey) {
    loadSettingsDraft(getDefaultSettingsContactKey());
  }
  renderSettingsTabs();
}

function getSettingsContacts() {
  return [
    {
      key: 'user:self',
      kind: 'user',
      id: 'self',
      name: state.userProfile.displayName || '我',
      avatarUrl: state.userProfile.avatarUrl || null,
      subtitle: '用户自己'
    },
    ...state.agents.map((agent) => ({
      key: `agent:${agent.agentId}`,
      kind: 'agent',
      id: agent.agentId,
      name: agent.name || agent.agentId,
      avatarUrl: agent.avatarUrl || null,
      subtitle: `Agent · ${agent.agentId}`
    }))
  ];
}

function getDefaultSettingsContactKey() {
  const active = getActiveAgent();
  return active ? `agent:${active.agentId}` : 'user:self';
}

function resolveValidSettingsContactKey(key) {
  const contacts = getSettingsContacts();
  if (contacts.some((item) => item.key === key)) return key;
  return getDefaultSettingsContactKey();
}

function resolveSettingsContact(key) {
  return getSettingsContacts().find((item) => item.key === key) || null;
}

function renderSettingsContactOptions() {
  const contacts = getSettingsContacts();
  const selectedKey = resolveValidSettingsContactKey(state.settingsSelectedContactKey);
  settingsContactSelectEl.innerHTML = '';

  for (const contact of contacts) {
    const option = document.createElement('option');
    option.value = contact.key;
    option.textContent = `${contact.name}${contact.kind === 'user' ? ' · 我' : ` · ${contact.id}`}`;
    settingsContactSelectEl.append(option);
  }

  settingsContactSelectEl.value = selectedKey;
}

function loadSettingsDraft(contactKey) {
  const target = resolveSettingsContact(resolveValidSettingsContactKey(contactKey));
  if (!target) return;

  resetSettingsAvatarDraft();
  state.settingsSelectedContactKey = target.key;
  state.settingsDraftDisplayName = target.name || (target.kind === 'user' ? '我' : target.id);
  state.settingsDraftAvatarUrl = target.avatarUrl || null;
  state.settingsAvatarRemoved = false;
  settingsContactSelectEl.value = target.key;
  settingsDisplayNameInputEl.value = state.settingsDraftDisplayName;
  renderSettingsPreview();
}

function renderSettingsPreview() {
  const target = resolveSettingsContact(state.settingsSelectedContactKey) || resolveSettingsContact(getDefaultSettingsContactKey());
  const displayName = state.settingsDraftDisplayName.trim() || (target?.kind === 'user' ? '我' : target?.id || '联系人');
  const avatarUrl = state.settingsDraftAvatarPreviewUrl || (state.settingsAvatarRemoved ? null : state.settingsDraftAvatarUrl);

  settingsAvatarPreviewEl.classList.toggle('agent', target?.kind === 'agent');
  renderAvatarPreview(settingsAvatarPreviewEl, avatarUrl, displayName);
  settingsPreviewTitleEl.textContent = displayName;
  settingsPreviewSubtitleEl.textContent = target?.kind === 'user'
    ? '会同步到消息区里“我”的头像与名称'
    : `会同步到 ${target?.id || 'agent'} 的左栏、顶部标题和消息头像`;
  settingsAvatarHintEl.textContent = state.settingsDraftAvatarPreviewUrl
    ? '头像已自动裁成正方形，点击保存后生效。'
    : state.settingsAvatarRemoved
      ? '头像将在保存后移除。'
      : '支持本地图片，保存时自动裁成正方形并上传。';
}

function renderAvatarPreview(element, avatarUrl, label) {
  element.innerHTML = '';
  element.textContent = '';
  element.classList.toggle('has-image', Boolean(avatarUrl));

  if (avatarUrl) {
    const image = document.createElement('img');
    image.src = avatarUrl;
    image.alt = label || 'avatar';
    image.addEventListener('error', () => {
      element.classList.remove('has-image');
      element.innerHTML = '';
      element.textContent = (label || '?').slice(0, 1).toUpperCase();
    }, { once: true });
    element.append(image);
    return;
  }

  element.textContent = (label || '?').slice(0, 1).toUpperCase();
}

function resetSettingsAvatarDraft() {
  if (state.settingsDraftAvatarPreviewUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(state.settingsDraftAvatarPreviewUrl);
  }
  state.settingsDraftAvatarPreviewUrl = null;
  state.settingsDraftAvatarFile = null;
  settingsAvatarFileInputEl.value = '';
}

function clearSettingsAvatarDraft() {
  resetSettingsAvatarDraft();
  state.settingsAvatarRemoved = true;
  renderSettingsPreview();
}

async function handleSettingsAvatarSelection(event) {
  const [file] = Array.from(event.target.files || []);
  event.target.value = '';
  if (!file) return;

  if (!String(file.type || '').startsWith('image/')) {
    showStatus('头像仅支持图片文件。', 'error');
    return;
  }

  try {
    const avatarFile = await cropAvatarToSquare(file);
    resetSettingsAvatarDraft();
    state.settingsDraftAvatarFile = avatarFile;
    state.settingsDraftAvatarPreviewUrl = URL.createObjectURL(avatarFile);
    state.settingsAvatarRemoved = false;
    renderSettingsPreview();
  } catch (error) {
    showStatus(`头像处理失败：${formatError(error)}`, 'error');
  }
}

async function saveSettingsContact() {
  const target = resolveSettingsContact(state.settingsSelectedContactKey);
  if (!target) return;

  saveSettingsButtonEl.disabled = true;
  settingsContactSelectEl.disabled = true;
  settingsDisplayNameInputEl.disabled = true;
  settingsChooseAvatarButtonEl.disabled = true;
  settingsClearAvatarButtonEl.disabled = true;

  try {
    let avatarUrl = state.settingsAvatarRemoved ? null : state.settingsDraftAvatarUrl;
    if (state.settingsDraftAvatarFile) {
      showStatus('正在上传头像…', 'info');
      const upload = await uploadSettingsAvatar(state.settingsDraftAvatarFile, target);
      avatarUrl = upload?.block?.url || avatarUrl;
    }

    if (target.kind === 'user') {
      const payload = await apiPatch('/api/openclaw-webchat/settings/user-profile', {
        displayName: state.settingsDraftDisplayName.trim() || '我',
        avatarUrl
      });
      state.userProfile = {
        displayName: payload?.userProfile?.displayName || '我',
        avatarUrl: payload?.userProfile?.avatarUrl || null
      };
    } else {
      const payload = await apiPatch(`/api/openclaw-webchat/agents/${encodeURIComponent(target.id)}/profile`, {
        displayName: state.settingsDraftDisplayName.trim() || null,
        avatarUrl
      });
      updateLocalAgentProfile(target.id, {
        name: payload?.profile?.displayName || target.id,
        avatarUrl: payload?.profile?.avatarUrl || null
      });
    }

    renderAgentList();
    updateHeader();
    renderMessages();
    loadSettingsDraft(target.key);
    showStatus('联系人设置已保存。', 'success');
  } catch (error) {
    showStatus(`保存失败：${formatError(error)}`, 'error');
  } finally {
    saveSettingsButtonEl.disabled = false;
    settingsContactSelectEl.disabled = false;
    settingsDisplayNameInputEl.disabled = false;
    settingsChooseAvatarButtonEl.disabled = false;
    settingsClearAvatarButtonEl.disabled = false;
  }
}

function updateLocalAgentProfile(agentId, patch) {
  state.agents = state.agents.map((agent) => (
    agent.agentId === agentId
      ? { ...agent, ...patch }
      : agent
  ));
}

function getActiveAgent() {
  return state.agents.find((item) => item.agentId === state.activeAgentId) || null;
}

function getSendingStatusMessage() {
  if (!state.pendingUploads.length) return '消息发送中…';
  if (state.pendingUploads.some((item) => item.kind === 'audio')) return '正在处理附件并发送…';
  return '正在上传附件并发送…';
}

function showContextStatus(context, message, tone = 'info') {
  if (!isOperationContextActive(context)) return;
  showStatus(message, tone);
}

function showStatus(message, tone = 'info') {
  chatStatusEl.textContent = message || '';
  chatStatusEl.style.color = tone === 'error' ? '#fca5a5' : tone === 'success' ? '#86efac' : '';
}

function scrollMessagesToBottom() {
  const applyScroll = () => {
    messageListEl.scrollTo({
      top: messageListEl.scrollHeight,
      behavior: 'auto'
    });
  };

  applyScroll();
  requestAnimationFrame(() => {
    applyScroll();
    requestAnimationFrame(applyScroll);
  });
}

function keepMessagesPinnedOnMediaLoad(element, eventName) {
  const shouldStickToBottom = isNearBottom();
  element.addEventListener(eventName, () => {
    if (!shouldStickToBottom && !isNearBottom()) return;
    scrollMessagesToBottom();
  }, { once: true });
}

function isNearBottom() {
  const remaining = messageListEl.scrollHeight - messageListEl.clientHeight - messageListEl.scrollTop;
  return remaining < 96;
}

function autoResizeComposer() {
  composerInputEl.style.height = 'auto';
  composerInputEl.style.height = `${Math.min(composerInputEl.scrollHeight, 180)}px`;
}

function syncComposerInteractivity() {
  setComposerEnabled(Boolean(state.activeSessionKey) && !isActiveSessionBusy());
}

function setComposerEnabled(enabled) {
  composerInputEl.disabled = !enabled;
  sendButtonEl.disabled = !enabled;
  newContextButtonEl.disabled = !enabled;
  attachButtonEl.disabled = !enabled;
  mediaUploadInputEl.disabled = !enabled;
  if (!enabled) closeCommandMenu();
  renderPendingUploads();
}

function beginSessionActivity(sessionKey) {
  if (!sessionKey) return;
  state.sendingSessionKeys.add(sessionKey);
  if (state.activeSessionKey === sessionKey) {
    syncComposerInteractivity();
  }
}

function endSessionActivity(sessionKey) {
  if (!sessionKey) return;
  state.sendingSessionKeys.delete(sessionKey);
  if (state.activeSessionKey === sessionKey) {
    syncComposerInteractivity();
  }
}

function isSessionBusy(sessionKey) {
  return Boolean(sessionKey) && state.sendingSessionKeys.has(sessionKey);
}

function isActiveSessionBusy() {
  return isSessionBusy(state.activeSessionKey);
}

function isOperationContextActive(context) {
  if (!context) return false;
  if (context.agentId && state.activeAgentId !== context.agentId) return false;
  if (context.sessionKey && state.activeSessionKey !== context.sessionKey) return false;
  return true;
}

function startPolling() {
  clearInterval(state.pollingTimer);
  state.pollingTimer = setInterval(async () => {
    try {
      await refreshAgents({ autoOpen: false });
    } catch {
      // silent background refresh
    }
  }, 10000);
}

function toggleSidebar(open) {
  if (window.innerWidth > 900) {
    appShellEl.classList.remove('sidebar-open');
    return;
  }
  appShellEl.classList.toggle('sidebar-open', open);
}

async function apiGet(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  return handleResponse(response);
}

async function apiPost(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json'
    },
    body: JSON.stringify(body || {})
  });
  return handleResponse(response);
}

async function apiPatch(url, body) {
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json'
    },
    body: JSON.stringify(body || {})
  });
  return handleResponse(response);
}

async function handleResponse(response) {
  const text = await response.text();
  const data = text ? safeJsonParse(text) : null;
  if (!response.ok) {
    throw new Error(data?.error || response.statusText || 'Request failed');
  }
  return data;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizePresence(value) {
  return value === 'running' || value === 'recent' ? value : 'idle';
}

function formatPresenceLabel(value) {
  if (value === 'running') return '处理中';
  if (value === 'recent') return '刚回复';
  return '待命';
}

function formatTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function formatAgentTimestamp(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';

  const now = new Date();
  const sameDay = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();

  if (sameDay) {
    return formatTime(value);
  }

  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatBytes(value) {
  const size = Number(value) || 0;
  if (!size) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function summarizeText(text, maxLength = 48) {
  const singleLine = String(text || '').replace(/\s+/g, ' ').trim();
  if (!singleLine) return '';
  return singleLine.length > maxLength ? `${singleLine.slice(0, maxLength - 1)}…` : singleLine;
}

function formatError(error) {
  return error?.message || String(error || 'Unknown error');
}
