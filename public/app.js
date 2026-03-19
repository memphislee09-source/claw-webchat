import { groupMessageBlocksForRender } from './message-blocks.js';

const THEME_STORAGE_KEY = 'openclaw-webchat-theme-choice';
const LEGACY_THEME_MODE_STORAGE_KEY = 'openclaw-webchat-theme-mode';
const HISTORY_SEARCH_RECENTS_STORAGE_KEY = 'openclaw-webchat-history-search-recents';
const HISTORY_SEARCH_MAX_RECENTS = 8;
const THEME_PRESETS = {
  dark: { name: '深色', mode: 'dark', hint: '夜间更稳，更适合低光环境。' },
  'light-paper': { name: 'Dawn Peach', mode: 'light', hint: '顶部带一点杏桃暖光，保留轻微色彩变化。' },
  'light-gray': { name: 'Soft Gray', mode: 'light', hint: '中性浅灰，更安静，几乎不带额外色偏。' },
  'light-linen': { name: 'Warm Linen', mode: 'light', hint: '微暖的亚麻纸感，柔和但不显脏。' },
  'light-mist': { name: 'Mist Blue', mode: 'light', hint: '偏冷静的蓝灰，工具感更强。' },
  'light-sand': { name: 'Soft Sand', mode: 'light', hint: '最放松的浅暖中性，存在感很轻。' }
};

const state = {
  conversations: [],
  agents: [],
  archivedGroups: [],
  activeConversationId: null,
  activeConversationKind: null,
  activeAgentId: null,
  activeSessionKey: null,
  activeConversationCanSend: false,
  activeGroupDetail: null,
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
  historySearchOpen: false,
  historySearchQuery: '',
  historySearchResults: [],
  historySearchTotal: 0,
  historySearchLoading: false,
  historySearchError: '',
  historySearchActiveMessageId: null,
  historySearchRequestId: 0,
  historySearchRecentQueries: [],
  historySearchShowingRecents: false,
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
  groupModalOpen: false,
  groupModalMode: 'create',
  groupModalGroupId: null,
  groupModalName: '',
  groupModalSelectedAgentIds: new Set(),
  mentionMenuOpen: false,
  mentionQuery: '',
  mentionCandidates: [],
  mentionSelectedIndex: 0,
  composerMentions: [],
  composerPreviousValue: '',
  themeChoice: 'dark',
  autoScrollPinned: true,
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
const historySearchShellEl = document.getElementById('historySearchShell');
const historySearchPanelEl = document.getElementById('historySearchPanel');
const historySearchFormEl = document.getElementById('historySearchForm');
const historySearchInputEl = document.getElementById('historySearchInput');
const historySearchSubmitButtonEl = document.getElementById('historySearchSubmitButton');
const historySearchMetaEl = document.getElementById('historySearchMeta');
const historySearchResultsEl = document.getElementById('historySearchResults');
const composerFormEl = document.getElementById('composerForm');
const composerInputEl = document.getElementById('composerInput');
const mentionMenuEl = document.getElementById('mentionMenu');
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
const createGroupButtonEl = document.getElementById('createGroupButton');
const manageGroupButtonEl = document.getElementById('manageGroupButton');
const settingsButtonEl = document.getElementById('settingsButton');
const settingsBackdropEl = document.getElementById('settingsBackdrop');
const settingsPanelEl = document.getElementById('settingsPanel');
const closeSettingsButtonEl = document.getElementById('closeSettingsButton');
const settingsContactsTabEl = document.getElementById('settingsContactsTab');
const settingsGroupsTabEl = document.getElementById('settingsGroupsTab');
const settingsPreferencesTabEl = document.getElementById('settingsPreferencesTab');
const settingsContactsSectionEl = document.getElementById('settingsContactsSection');
const settingsGroupsSectionEl = document.getElementById('settingsGroupsSection');
const settingsPreferencesSectionEl = document.getElementById('settingsPreferencesSection');
const settingsActiveGroupListEl = document.getElementById('settingsActiveGroupList');
const settingsArchivedGroupListEl = document.getElementById('settingsArchivedGroupList');
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
const settingsThemePresetButtonsEl = document.getElementById('settingsThemePresetButtons');
const settingsThemeHintEl = document.getElementById('settingsThemeHint');
const mediaViewerEl = document.getElementById('mediaViewer');
const mediaViewerImageEl = document.getElementById('mediaViewerImage');
const mediaZoomOutButtonEl = document.getElementById('mediaZoomOutButton');
const mediaResetZoomButtonEl = document.getElementById('mediaResetZoomButton');
const mediaZoomInButtonEl = document.getElementById('mediaZoomInButton');
const groupModalBackdropEl = document.getElementById('groupModalBackdrop');
const groupModalEl = document.getElementById('groupModal');
const closeGroupModalButtonEl = document.getElementById('closeGroupModalButton');
const groupModalTitleEl = document.getElementById('groupModalTitle');
const groupNameInputEl = document.getElementById('groupNameInput');
const groupMemberPickerEl = document.getElementById('groupMemberPicker');
const groupCurrentMembersFieldEl = document.getElementById('groupCurrentMembersField');
const groupCurrentMembersEl = document.getElementById('groupCurrentMembers');
const createGroupSubmitButtonEl = document.getElementById('createGroupSubmitButton');
const renameGroupButtonEl = document.getElementById('renameGroupButton');
const inviteGroupMembersButtonEl = document.getElementById('inviteGroupMembersButton');
const leaveGroupButtonEl = document.getElementById('leaveGroupButton');
const dissolveGroupButtonEl = document.getElementById('dissolveGroupButton');
const appShellEl = document.querySelector('.app-shell');

state.themeChoice = getStoredThemeChoice();
applyThemeChoice(state.themeChoice);

boot().catch((error) => showStatus(`初始化失败：${formatError(error)}`, 'error'));

async function boot() {
  bindEvents();
  autoResizeComposer();
  await Promise.all([
    loadSettings(),
    loadCommandCatalog()
  ]);
  await refreshConversations({ autoOpen: true });
  startPolling();
}

function bindEvents() {
  composerFormEl.addEventListener('submit', handleSendSubmit);
  newContextButtonEl.addEventListener('click', toggleCommandMenu);
  commandMenuEl?.addEventListener('click', handleCommandMenuClick);
  document.addEventListener('click', handleGlobalDocumentClick);
  historySearchFormEl?.addEventListener('submit', handleHistorySearchSubmit);
  historySearchInputEl?.addEventListener('focus', handleHistorySearchFocus);
  historySearchInputEl?.addEventListener('input', handleHistorySearchInput);
  headerRefreshButtonEl.addEventListener('click', () => refreshConversations({ autoOpen: false, refreshCurrent: true }));
  refreshAgentsButtonEl?.addEventListener('click', () => refreshConversations({ autoOpen: false, refreshCurrent: true }));
  createGroupButtonEl?.addEventListener('click', openCreateGroupModal);
  manageGroupButtonEl?.addEventListener('click', openManageCurrentGroup);
  attachButtonEl.addEventListener('click', () => mediaUploadInputEl.click());
  mediaUploadInputEl.addEventListener('change', handleFileSelection);
  composerInputEl.addEventListener('input', handleComposerInput);
  composerInputEl.addEventListener('keydown', handleComposerKeydown);
  composerInputEl.addEventListener('click', updateMentionMenuFromSelection);
  messageListEl.addEventListener('scroll', async () => {
    state.autoScrollPinned = isNearBottom();
    if (messageListEl.scrollTop > 64) return;
    if (!state.activeConversationId || !state.hasMore || state.loadingHistory) return;
    await loadOlderHistory();
  });

  openSidebarButtonEl.addEventListener('click', () => toggleSidebar(true));
  closeSidebarButtonEl.addEventListener('click', () => toggleSidebar(false));
  sidebarBackdropEl.addEventListener('click', () => toggleSidebar(false));

  settingsButtonEl.addEventListener('click', () => toggleSettingsPanel(true));
  closeSettingsButtonEl.addEventListener('click', () => toggleSettingsPanel(false));
  settingsBackdropEl.addEventListener('click', () => toggleSettingsPanel(false));
  settingsContactsTabEl.addEventListener('click', () => switchSettingsTab('contacts'));
  settingsGroupsTabEl?.addEventListener('click', () => switchSettingsTab('groups'));
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
  settingsThemePresetButtonsEl?.addEventListener('click', handleThemePresetClick);
  closeGroupModalButtonEl?.addEventListener('click', () => toggleGroupModal(false));
  groupModalBackdropEl?.addEventListener('click', () => toggleGroupModal(false));
  groupNameInputEl?.addEventListener('input', () => {
    state.groupModalName = groupNameInputEl.value;
  });
  createGroupSubmitButtonEl?.addEventListener('click', submitCreateGroup);
  renameGroupButtonEl?.addEventListener('click', submitRenameGroup);
  inviteGroupMembersButtonEl?.addEventListener('click', submitInviteGroupMembers);
  leaveGroupButtonEl?.addEventListener('click', leaveCurrentGroup);
  dissolveGroupButtonEl?.addEventListener('click', dissolveCurrentGroup);
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

function normalizeThemeChoice(choice) {
  if (choice === 'dark') return 'dark';
  if (choice === 'light-paper' || choice === 'light-gray' || choice === 'light-linen' || choice === 'light-mist' || choice === 'light-sand') {
    return choice;
  }
  if (choice === 'light') return 'light-paper';
  return 'dark';
}

function getStoredThemeChoice() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) || localStorage.getItem(LEGACY_THEME_MODE_STORAGE_KEY);
    return normalizeThemeChoice(stored);
  } catch {
    // ignore storage errors
  }

  return normalizeThemeChoice(document.documentElement.dataset.theme);
}

function applyThemeChoice(choice) {
  const next = normalizeThemeChoice(choice);
  state.themeChoice = next;
  document.documentElement.dataset.theme = next;
  document.documentElement.style.colorScheme = THEME_PRESETS[next]?.mode === 'light' ? 'light' : 'dark';
  renderThemePresetControls();
}

function persistThemeChoice(choice) {
  applyThemeChoice(choice);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, state.themeChoice);
    localStorage.removeItem(LEGACY_THEME_MODE_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

function getStoredHistorySearchRecentStore() {
  try {
    const raw = localStorage.getItem(HISTORY_SEARCH_RECENTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function persistHistorySearchRecentStore(store) {
  try {
    localStorage.setItem(HISTORY_SEARCH_RECENTS_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore storage errors
  }
}

function normalizeHistorySearchRecentQueries(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, HISTORY_SEARCH_MAX_RECENTS);
}

function syncHistorySearchRecentQueries(scopeKey = getActiveHistorySearchScopeKey()) {
  if (!scopeKey) {
    state.historySearchRecentQueries = [];
    return;
  }

  const store = getStoredHistorySearchRecentStore();
  state.historySearchRecentQueries = normalizeHistorySearchRecentQueries(store[scopeKey]);
}

function recordHistorySearchRecentQuery(scopeKey, query) {
  const normalized = String(query || '').trim();
  if (!scopeKey || !normalized) return;

  const store = getStoredHistorySearchRecentStore();
  const existing = normalizeHistorySearchRecentQueries(store[scopeKey]);
  const next = [
    normalized,
    ...existing.filter((item) => item.toLowerCase() !== normalized.toLowerCase())
  ].slice(0, HISTORY_SEARCH_MAX_RECENTS);

  store[scopeKey] = next;
  persistHistorySearchRecentStore(store);

  if (getActiveHistorySearchScopeKey() === scopeKey) {
    state.historySearchRecentQueries = next;
  }
}

function handleThemePresetClick(event) {
  const button = event.target.closest('[data-theme-choice]');
  if (!button) return;
  persistThemeChoice(button.dataset.themeChoice);
}

function renderThemePresetControls() {
  if (!settingsThemePresetButtonsEl) return;

  settingsThemePresetButtonsEl.querySelectorAll('[data-theme-choice]').forEach((button) => {
    const active = button.dataset.themeChoice === state.themeChoice;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  if (settingsThemeHintEl) {
    const theme = THEME_PRESETS[state.themeChoice] || THEME_PRESETS.dark;
    settingsThemeHintEl.textContent = `当前使用 ${theme.name}。${theme.hint} 主题偏好会保存在当前浏览器。`;
  }
}

async function refreshConversations({ autoOpen = false, refreshCurrent = false } = {}) {
  const previousActiveKind = state.activeConversationKind;
  const previousActiveId = state.activeConversationId;
  const previousActive = getActiveConversation();
  const data = await apiGet('/api/openclaw-webchat/conversations');
  state.conversations = Array.isArray(data.items) ? data.items : [];
  state.agents = Array.isArray(data.agents) ? data.agents : [];
  state.archivedGroups = Array.isArray(data.archivedGroups) ? data.archivedGroups : [];
  renderConversationList({ refreshIdentity: false });
  updateHeader();
  populateSettingsForm();
  renderSettingsGroupLists();

  const activeStillVisible = previousActiveId && state.conversations.some((item) => item.kind === previousActiveKind && item.id === previousActiveId);

  if (refreshCurrent && previousActiveId) {
    await openConversation(previousActiveKind, previousActiveId, { forceReload: true, preserveScrollBottom: true });
    return;
  }

  const nextItem = activeStillVisible
    ? state.conversations.find((item) => item.kind === previousActiveKind && item.id === previousActiveId) || null
    : state.conversations[0] || null;

  if (
    !autoOpen
    && previousActive
    && nextItem
    && shouldRefreshCurrentConversation(previousActive, nextItem)
  ) {
    await openConversation(nextItem.kind, nextItem.id, { forceReload: true, preserveScrollBottom: true });
    return;
  }

  if (autoOpen && nextItem) {
    await openConversation(nextItem.kind, nextItem.id, {
      forceReload: previousActiveId !== nextItem.id || previousActiveKind !== nextItem.kind || !state.activeSessionKey
    });
  }
}

async function refreshAgents(options = {}) {
  return refreshConversations(options);
}

function shouldRefreshCurrentConversation(previousItem, nextItem) {
  if (!previousItem || !nextItem) return false;
  if (previousItem.kind !== nextItem.kind || previousItem.id !== nextItem.id) return false;
  if (isActiveSessionBusy()) return false;

  return previousItem.lastMessageAt !== nextItem.lastMessageAt
    || previousItem.summary !== nextItem.summary
    || previousItem.presence !== nextItem.presence;
}

function renderConversationList({ refreshIdentity = true } = {}) {
  if (!state.conversations.length) {
    agentListEl.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'empty-tip';
    empty.textContent = '暂时还没有会话。';
    agentListEl.append(empty);
    return;
  }

  agentListEl.querySelectorAll('.empty-tip').forEach((node) => node.remove());
  const existing = new Map(Array.from(agentListEl.querySelectorAll('.agent-card')).map((button) => [button.dataset.itemKey, button]));

  for (const item of state.conversations) {
    const itemKey = toConversationKey(item.kind, item.id);
    const button = existing.get(itemKey) || createConversationCardElement(item);
    existing.delete(itemKey);
    updateConversationCardElement(button, item, {
      refreshIdentity: refreshIdentity || !button.isConnected
    });
    agentListEl.append(button);
  }

  existing.forEach((button) => button.remove());
}

function createConversationCardElement(item) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.itemKey = toConversationKey(item.kind, item.id);
  button.className = 'agent-card';
  button.addEventListener('click', () => openConversation(item.kind, item.id, { forceReload: item.id !== state.activeConversationId || item.kind !== state.activeConversationKind }));

  const avatar = createConversationAvatar(item);

  const content = document.createElement('div');
  content.className = 'agent-content';

  const topRow = document.createElement('div');
  topRow.className = 'agent-top-row';

  const name = document.createElement('div');
  name.className = 'agent-name';

  const meta = document.createElement('div');
  meta.className = 'agent-meta';

  const presence = document.createElement('span');
  presence.className = 'presence-dot idle';

  const presenceLabel = document.createElement('span');
  presenceLabel.className = 'agent-presence-label';

  meta.append(presence, presenceLabel);

  const summary = document.createElement('div');
  summary.className = 'agent-summary';

  const bottomRow = document.createElement('div');
  bottomRow.className = 'agent-bottom-row';

  const time = document.createElement('div');
  time.className = 'agent-time';

  bottomRow.append(summary, time);
  topRow.append(name, meta);
  content.append(topRow, bottomRow);
  button.append(avatar, content);
  button._agentRefs = { avatar, name, presence, presenceLabel, summary, time };
  updateConversationCardElement(button, item, { refreshIdentity: true });
  return button;
}

function updateConversationCardElement(button, item, { refreshIdentity = true } = {}) {
  const refs = button._agentRefs;
  if (!refs) return;

  button.classList.toggle('active', item.kind === state.activeConversationKind && item.id === state.activeConversationId);
  button.dataset.itemKey = toConversationKey(item.kind, item.id);

  if (refreshIdentity) {
    updateConversationCardIdentity(button, item);
  }

  const presenceState = normalizePresence(item.presence);
  refs.presence.className = `presence-dot ${presenceState}`;
  refs.presence.title = formatPresenceLabel(item.presence);
  refs.presenceLabel.textContent = item.kind === 'group'
    ? `${item.memberCount || 0} 人 · ${formatPresenceLabel(item.presence)}`
    : formatPresenceLabel(item.presence);
  refs.summary.textContent = item.summary || (item.kind === 'group' ? '点击进入群聊' : '点击进入会话');
  refs.time.textContent = formatAgentTimestamp(item.lastMessageAt);
}

function updateConversationCardIdentity(button, item) {
  const refs = button._agentRefs;
  if (!refs) return;

  const nextLabel = item.name || item.title || item.id;
  const nextAvatarUrl = item.avatarUrl || '';
  const nextFallback = item.kind === 'group' ? '群' : (nextLabel || '?').slice(0, 1).toUpperCase();

  refs.name.textContent = nextLabel;

  if (button.dataset.avatarUrl === nextAvatarUrl && button.dataset.agentLabel === nextLabel) {
    return;
  }

  const nextAvatar = createConversationAvatar(item);
  refs.avatar.replaceWith(nextAvatar);
  refs.avatar = nextAvatar;
  button.dataset.avatarUrl = nextAvatarUrl;
  button.dataset.agentLabel = nextLabel;
}

function createConversationAvatar(item) {
  if (item.kind === 'group') {
    const avatar = document.createElement('div');
    avatar.className = 'agent-avatar group-avatar';
    avatar.textContent = '群';
    return avatar;
  }

  return createAvatarElement({
    className: 'agent-avatar',
    avatarUrl: item.avatarUrl,
    label: item.name || item.id,
    fallbackText: (item.name || item.id || '?').slice(0, 1).toUpperCase()
  });
}

async function openConversation(kind, id, { forceReload = false, preserveScrollBottom = false } = {}) {
  if (!id || !kind) return;
  if (state.selectedOpenPromise && state.activeConversationKind === kind && state.activeConversationId === id && !forceReload) {
    return state.selectedOpenPromise;
  }
  if (state.activeConversationKind !== kind || state.activeConversationId !== id) {
    resetHistorySearch({ keepOpen: false });
    closeMentionMenu();
  }

  const requestId = state.openRequestId + 1;
  state.openRequestId = requestId;
  state.activeConversationKind = kind;
  state.activeConversationId = id;
  state.activeAgentId = kind === 'agent' ? id : null;
  syncHistorySearchRecentQueries();
  renderConversationList({ refreshIdentity: false });
  updateHeader();
  populateSettingsForm();
  showStatus(kind === 'group' ? '正在打开群聊…' : '正在打开会话…', 'info');
  toggleSidebar(false);

  const promise = (async () => {
    const response = kind === 'group'
      ? await apiPost(`/api/openclaw-webchat/groups/${encodeURIComponent(id)}/open`, {})
      : await apiPost(`/api/openclaw-webchat/agents/${encodeURIComponent(id)}/open`, {});
    if (requestId !== state.openRequestId || state.activeConversationKind !== kind || state.activeConversationId !== id) return;
    state.activeSessionKey = response.sessionKey;
    state.activeConversationCanSend = response?.group ? response.group.canSend !== false : true;
    state.activeGroupDetail = kind === 'group' ? (response.group || null) : null;
    state.messages = Array.isArray(response.history?.messages) ? response.history.messages : [];
    state.nextBefore = response.history?.nextBefore || null;
    state.hasMore = Boolean(response.history?.hasMore);
    renderMessages();
    syncComposerInteractivity();
    updateHeader();
    populateSettingsForm();
    if (!preserveScrollBottom) {
      maybeScrollMessagesToBottom(true);
    } else {
      maybeScrollMessagesToBottom();
    }
    showStatus(kind === 'group'
      ? '群聊已打开。'
      : (response.created ? '已创建并进入该 agent 的长期主时间线。' : '会话已恢复。'), 'success');
  })();

  state.selectedOpenPromise = promise;

  try {
    await promise;
  } finally {
    state.selectedOpenPromise = null;
  }
}

async function openAgent(agentId, options = {}) {
  return openConversation('agent', agentId, options);
}

function setHistorySearchOpen(open) {
  state.historySearchOpen = Boolean(open);
  renderHistorySearchPanel();
}

function resetHistorySearch({ keepOpen = false } = {}) {
  state.historySearchRequestId += 1;
  state.historySearchQuery = '';
  state.historySearchResults = [];
  state.historySearchTotal = 0;
  state.historySearchLoading = false;
  state.historySearchError = '';
  state.historySearchActiveMessageId = null;
  state.historySearchShowingRecents = false;
  state.historySearchOpen = keepOpen ? state.historySearchOpen : false;
  if (historySearchInputEl) {
    historySearchInputEl.value = '';
  }
  renderHistorySearchPanel();
}

function renderHistorySearchPanel() {
  if (!historySearchPanelEl) return;

  historySearchShellEl?.classList.toggle('active', state.historySearchOpen);
  historySearchPanelEl.classList.toggle('hidden', !state.historySearchOpen);

  if (historySearchInputEl && historySearchInputEl.value !== state.historySearchQuery) {
    historySearchInputEl.value = state.historySearchQuery;
  }

  if (historySearchInputEl) {
    historySearchInputEl.disabled = !state.activeConversationId;
    historySearchInputEl.placeholder = state.activeConversationId ? '搜索当前会话历史' : '先打开一个会话再搜索';
  }

  historySearchSubmitButtonEl.disabled = !state.activeConversationId || state.historySearchLoading;

  if (!state.historySearchOpen) return;

  if (!state.activeConversationId) {
    historySearchMetaEl.textContent = '请先打开一个会话，再搜索该时间线中的历史消息。';
  } else if (state.historySearchLoading) {
    historySearchMetaEl.textContent = '正在搜索当前会话的历史消息…';
  } else if (state.historySearchError) {
    historySearchMetaEl.textContent = state.historySearchError;
  } else if (state.historySearchShowingRecents && state.historySearchRecentQueries.length) {
    historySearchMetaEl.textContent = '';
  } else if (!state.historySearchQuery) {
    historySearchMetaEl.textContent = state.historySearchRecentQueries.length
      ? ''
      : '输入关键词后即可搜索当前 agent 的主时间线。';
  } else {
    historySearchMetaEl.textContent = `已找到 ${state.historySearchTotal} 条命中结果${state.historySearchTotal > state.historySearchResults.length ? `，当前显示前 ${state.historySearchResults.length} 条。` : '。'}`;
  }

  historySearchResultsEl.innerHTML = '';

  if (state.historySearchShowingRecents && state.historySearchRecentQueries.length) {
    for (const query of state.historySearchRecentQueries) {
      historySearchResultsEl.append(createHistorySearchRecentItem(query));
    }
    return;
  }

  if (!state.historySearchQuery) {
    if (!state.historySearchRecentQueries.length) return;
    for (const query of state.historySearchRecentQueries) {
      historySearchResultsEl.append(createHistorySearchRecentItem(query));
    }
    return;
  }

  if (!state.historySearchLoading && !state.historySearchResults.length) {
    const empty = document.createElement('div');
    empty.className = 'history-search-empty';
    empty.textContent = '没有找到匹配的历史消息。';
    historySearchResultsEl.append(empty);
    return;
  }

  for (const result of state.historySearchResults) {
    historySearchResultsEl.append(createHistorySearchResultItem(result));
  }
}

function createHistorySearchResultItem(result) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `history-search-result${result.id === state.historySearchActiveMessageId ? ' active' : ''}`;
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    jumpToHistorySearchResult(result.id);
  });

  const top = document.createElement('div');
  top.className = 'history-search-result-top';

  const role = document.createElement('div');
  role.className = 'history-search-role';
  role.textContent = result.speakerName || getHistorySearchResultSpeakerName(result.role);

  const time = document.createElement('div');
  time.className = 'history-search-time';
  time.textContent = formatSearchTimestamp(result.createdAt);

  top.append(role, time);

  const excerpt = document.createElement('div');
  excerpt.className = 'history-search-excerpt';
  excerpt.textContent = result.excerpt || result.summary || '命中消息';

  button.append(top, excerpt);
  return button;
}

function createHistorySearchRecentItem(query) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'history-search-result recent';
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    applyHistorySearchRecentQuery(query);
  });

  const excerpt = document.createElement('div');
  excerpt.className = 'history-search-excerpt';
  excerpt.textContent = query;

  button.append(excerpt);
  return button;
}

function getHistorySearchResultSpeakerName(role) {
  const activeConversation = getActiveConversation();
  if (role === 'user') {
    return state.userProfile.displayName || '我';
  }

  if (role === 'assistant') {
    if (activeConversation?.kind === 'group') return '群成员';
    const active = getActiveAgent();
    return active?.name || active?.agentId || 'Assistant';
  }

  if (role === 'marker') {
    return '系统标记';
  }

  return String(role || '消息');
}

function handleHistorySearchFocus() {
  if (!state.activeConversationId) return;
  syncHistorySearchRecentQueries();
  state.historySearchShowingRecents = state.historySearchRecentQueries.length > 0;
  setHistorySearchOpen(true);
}

function applyHistorySearchRecentQuery(query) {
  if (!historySearchInputEl) return;
  historySearchInputEl.value = query;
  state.historySearchQuery = query;
  state.historySearchShowingRecents = false;
  executeHistorySearch(query);
}

function handleHistorySearchInput() {
  if (!state.activeConversationId) return;

  const query = historySearchInputEl?.value || '';
  state.historySearchQuery = query;
  state.historySearchShowingRecents = !query.trim();
  setHistorySearchOpen(true);

  if (query.trim()) return;

  state.historySearchRequestId += 1;
  state.historySearchQuery = '';
  state.historySearchResults = [];
  state.historySearchTotal = 0;
  state.historySearchLoading = false;
  state.historySearchError = '';

  if (state.historySearchActiveMessageId) {
    state.historySearchActiveMessageId = null;
    renderMessages();
  }

  renderHistorySearchPanel();
}

async function handleHistorySearchSubmit(event) {
  event.preventDefault();
  if (!state.activeConversationId) return;
  setHistorySearchOpen(true);

  const query = historySearchInputEl?.value.trim() || '';
  state.historySearchShowingRecents = false;
  await executeHistorySearch(query);
}

async function executeHistorySearch(query) {
  const normalizedQuery = String(query || '').trim();
  state.historySearchQuery = normalizedQuery;
  state.historySearchError = '';
  state.historySearchActiveMessageId = null;
  state.historySearchShowingRecents = false;

  if (!normalizedQuery) {
    syncHistorySearchRecentQueries();
    state.historySearchResults = [];
    state.historySearchTotal = 0;
    renderHistorySearchPanel();
    renderMessages();
    return;
  }

  const requestId = state.historySearchRequestId + 1;
  state.historySearchRequestId = requestId;
  state.historySearchResults = [];
  state.historySearchTotal = 0;
  state.historySearchLoading = true;
  renderHistorySearchPanel();

  try {
    const payload = await apiGet(buildHistorySearchUrl(normalizedQuery));
    if (requestId !== state.historySearchRequestId || !state.activeConversationId) return;
    state.historySearchResults = Array.isArray(payload?.results) ? payload.results : [];
    state.historySearchTotal = Number(payload?.total) || state.historySearchResults.length;
    recordHistorySearchRecentQuery(getActiveHistorySearchScopeKey(), normalizedQuery);
  } catch (error) {
    if (requestId !== state.historySearchRequestId) return;
    state.historySearchResults = [];
    state.historySearchTotal = 0;
    state.historySearchError = `搜索失败：${formatError(error)}`;
  } finally {
    if (requestId === state.historySearchRequestId) {
      state.historySearchLoading = false;
      renderHistorySearchPanel();
    }
  }
}

async function jumpToHistorySearchResult(messageId) {
  if (!messageId || !state.activeConversationId) return;
  showStatus('正在定位命中消息…', 'info');

  const found = await ensureHistoryMessageLoaded(messageId);
  if (!found) {
    showStatus('未能定位到该条历史消息。', 'error');
    return;
  }

  state.autoScrollPinned = false;
  state.historySearchActiveMessageId = messageId;
  renderHistorySearchPanel();
  renderMessages();
  requestAnimationFrame(() => {
    scrollToHistoryMessage(messageId);
    requestAnimationFrame(() => scrollToHistoryMessage(messageId));
  });
  showStatus('已跳转到历史命中消息。', 'success');
}

async function ensureHistoryMessageLoaded(messageId) {
  if (state.messages.some((item) => item.id === messageId)) return true;
  if (!state.activeConversationId) return false;

  const targetConversationKind = state.activeConversationKind;
  const targetConversationId = state.activeConversationId;
  const targetSessionKey = state.activeSessionKey;

  while (!state.messages.some((item) => item.id === messageId) && state.hasMore && state.nextBefore) {
    const data = await apiGet(buildHistoryPageUrl(targetConversationKind, targetConversationId, state.nextBefore));
    if (!isOperationContextActive({ kind: targetConversationKind, id: targetConversationId, sessionKey: targetSessionKey })) return false;
    const incoming = Array.isArray(data.messages) ? data.messages : [];
    state.messages = [...incoming, ...state.messages];
    state.nextBefore = data.nextBefore || null;
    state.hasMore = Boolean(data.hasMore);
  }

  return state.messages.some((item) => item.id === messageId);
}

function scrollToHistoryMessage(messageId) {
  const node = Array.from(messageListEl.querySelectorAll('[data-message-id]'))
    .find((element) => element.dataset.messageId === messageId);
  if (!node) return;
  node.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function renderMessages() {
  messageListEl.classList.toggle('showing-history-target', Boolean(state.historySearchActiveMessageId));
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
    row.className = `message-row ${message.role}${message.id === state.historySearchActiveMessageId ? ' search-target' : ''}`;
    row.dataset.messageId = message.id;

    let avatar = createMessageAvatar(message.role);
    if (getActiveConversation()?.kind === 'group' && message.role === 'assistant') {
      const speaker = findAgentById(message.speakerId);
      avatar = createAvatarElement({
        className: 'message-avatar assistant',
        avatarUrl: speaker?.avatarUrl,
        label: message.speakerName || speaker?.name || message.speakerId || 'A',
        fallbackText: (message.speakerName || speaker?.name || message.speakerId || 'A').slice(0, 1).toUpperCase()
      });
    }
    const body = document.createElement('div');
    body.className = 'message-body';

    if (getActiveConversation()?.kind === 'group' && message.role === 'assistant') {
      const sender = document.createElement('div');
      sender.className = 'message-sender';
      sender.textContent = message.speakerName || findAgentById(message.speakerId)?.name || '群成员';
      body.append(sender);
    }

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

    if (message.id === state.historySearchActiveMessageId && state.historySearchQuery) {
      highlightSearchTextInElement(bubble, state.historySearchQuery);
    }

    const time = document.createElement('div');
    time.className = 'message-time';
    time.textContent = formatTime(message.createdAt);

    if (message.late || message.replyToPreview) {
      const meta = document.createElement('div');
      meta.className = 'message-meta-row';
      if (message.late) {
        const badge = document.createElement('span');
        badge.className = 'message-badge late';
        badge.textContent = '迟到回复';
        meta.append(badge);
      }
      if (message.replyToPreview) {
        const reply = document.createElement('span');
        reply.className = 'message-reply-target';
        reply.textContent = `回应：${message.replyToPreview}`;
        meta.append(reply);
      }
      body.append(meta);
    }

    body.append(bubble, time);
    row.append(avatar, body);
    messageListEl.append(row);
  }

  const processingRows = createConversationProcessingRows();
  if (processingRows.length) {
    processingRows.forEach((row) => messageListEl.append(row));
  } else if (shouldShowConversationProcessing()) {
    messageListEl.append(createAssistantProcessingRow());
  }
}

function highlightSearchTextInElement(element, query) {
  const normalizedQuery = String(query || '').trim();
  if (!element || !normalizedQuery) return;

  const escapedQuery = escapeRegExp(normalizedQuery);
  const splitMatcher = new RegExp(`(${escapedQuery})`, 'giu');
  const testMatcher = new RegExp(escapedQuery, 'iu');
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest('code, pre, mark')) return NodeFilter.FILTER_REJECT;
      return testMatcher.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });

  const textNodes = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  for (const textNode of textNodes) {
    const fragment = document.createDocumentFragment();
    const parts = textNode.nodeValue.split(splitMatcher);
    parts.forEach((part, index) => {
      if (!part) return;
      if (index % 2 === 1) {
        const mark = document.createElement('mark');
        mark.className = 'history-search-highlight';
        mark.textContent = part;
        fragment.append(mark);
        return;
      }
      fragment.append(document.createTextNode(part));
    });
    textNode.parentNode?.replaceChild(fragment, textNode);
  }
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
  if (!state.activeConversationId || !state.nextBefore || state.loadingHistory) return;
  const targetConversationKind = state.activeConversationKind;
  const targetConversationId = state.activeConversationId;
  const targetSessionKey = state.activeSessionKey;
  const targetBefore = state.nextBefore;
  state.loadingHistory = true;
  const previousHeight = messageListEl.scrollHeight;

  try {
    const data = await apiGet(buildHistoryPageUrl(targetConversationKind, targetConversationId, targetBefore));
    if (!isOperationContextActive({ kind: targetConversationKind, id: targetConversationId, sessionKey: targetSessionKey })) return;
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
  const context = {
    kind: state.activeConversationKind,
    id: state.activeConversationId,
    agentId: state.activeAgentId,
    sessionKey: targetSessionKey
  };

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

  const mentionAgentIds = collectMentionAgentIdsFromComposer(text);
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
    speakerName: state.userProfile.displayName || '我',
    mentionAgentIds,
    blocks: buildOptimisticBlocks(text, state.pendingUploads)
  };
  const draftText = text;
  const draftAttachments = state.pendingUploads;
  const draftMentions = [...state.composerMentions];
  state.messages.push(optimistic);
  composerInputEl.value = '';
  state.composerPreviousValue = '';
  state.composerMentions = [];
  closeMentionMenu();
  mediaUploadInputEl.value = '';
  state.pendingUploads = [];
  renderPendingUploads();
  autoResizeComposer();
  renderMessages();
  maybeScrollMessagesToBottom(true);

  try {
    const response = await apiPost(`/api/openclaw-webchat/sessions/${encodeURIComponent(targetSessionKey)}/send`, {
      text,
      blocks: uploadedBlocks,
      mentionAgentIds
    });
    releasePendingUploads(draftAttachments);
    if (isOperationContextActive(context)) {
      await syncCurrentConversation({ preserveScrollBottom: true });
    }
    showContextStatus(context, '发送完成。', 'success');
    await refreshConversations({ autoOpen: false });
  } catch (error) {
    if (isOperationContextActive(context)) {
      state.messages = state.messages.filter((item) => item.id !== optimistic.id);
      composerInputEl.value = draftText;
      state.composerPreviousValue = draftText;
      state.pendingUploads = draftAttachments;
      state.composerMentions = draftMentions;
      renderPendingUploads();
      autoResizeComposer();
      renderMessages();
    }
    showContextStatus(context, `发送失败：${formatError(error)}`, 'error');
  } finally {
    endSessionActivity(targetSessionKey);
    if (isOperationContextActive(context)) {
      renderMessages();
      maybeScrollMessagesToBottom();
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
  maybeScrollMessagesToBottom(true);
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

function handleGlobalDocumentClick(event) {
  const target = event.target;
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];

  if (commandMenuEl && !commandMenuEl.classList.contains('hidden')) {
    if (!commandMenuEl.contains(target) && !newContextButtonEl.contains(target)) {
      closeCommandMenu();
    }
  }

  if (state.historySearchOpen && historySearchShellEl && !historySearchShellEl.contains(target) && !path.includes(historySearchShellEl)) {
    setHistorySearchOpen(false);
  }

  if (state.mentionMenuOpen && mentionMenuEl && !mentionMenuEl.contains(target) && target !== composerInputEl) {
    closeMentionMenu();
  }
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
  const context = {
    kind: state.activeConversationKind,
    id: state.activeConversationId,
    agentId: state.activeAgentId,
    sessionKey: targetSessionKey
  };
  beginSessionActivity(targetSessionKey);
  showContextStatus(context, `正在执行 ${command.split(/\s+/, 1)[0]}…`, 'info');

  try {
    await apiPost(`/api/openclaw-webchat/sessions/${encodeURIComponent(targetSessionKey)}/command`, { command });
    if (isOperationContextActive(context)) {
      await syncCurrentConversation({ preserveScrollBottom: false });
    }
    showContextStatus(context, buildSlashCommandSuccessMessage(command), 'success');
    await refreshConversations({ autoOpen: false });
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
  const active = getActiveConversation();
  chatTitleEl.textContent = active?.title || active?.name || 'openclaw-webchat';
  if (active?.kind === 'group') {
    const statusText = active?.archived ? '只读群历史' : `${active.memberCount || 0} 位成员`;
    chatSubtitleEl.textContent = `${statusText} · ${active.summary || '暂无摘要'}`;
  } else {
    chatSubtitleEl.textContent = active
      ? `${active.hasSession ? '长期主时间线' : '点击后自动创建'} · ${active.summary || '暂无摘要'}`
      : '选择会话开始聊天';
  }
  headerPresenceEl.className = `presence-dot ${normalizePresence(active?.presence || 'idle')}`;
  manageGroupButtonEl?.classList.toggle('hidden', !(active?.kind === 'group'));
  if (!active) {
    state.historySearchOpen = false;
    state.historySearchRecentQueries = [];
    state.historySearchShowingRecents = false;
  }
  renderHistorySearchPanel();
  syncComposerInteractivity();
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

function createConversationProcessingRows() {
  const activeConversation = getActiveConversation();
  if (activeConversation?.kind !== 'group') return [];
  const members = Array.isArray(state.activeGroupDetail?.currentMembers) ? state.activeGroupDetail.currentMembers : [];
  return members
    .filter((member) => member.replyState === 'running')
    .map((member) => createGroupMemberProcessingRow(member));
}

function createGroupMemberProcessingRow(member) {
  const row = document.createElement('div');
  row.className = 'message-row assistant processing';

  const avatar = createAvatarElement({
    className: 'message-avatar assistant',
    avatarUrl: member.avatarUrl,
    label: member.name || member.agentId || 'A',
    fallbackText: (member.name || member.agentId || 'A').slice(0, 1).toUpperCase()
  });

  const body = document.createElement('div');
  body.className = 'message-body';

  const sender = document.createElement('div');
  sender.className = 'message-sender';
  sender.textContent = member.name || member.agentId || '群成员';

  const indicator = document.createElement('div');
  indicator.className = 'processing-indicator';
  indicator.setAttribute('aria-label', `${member.name || member.agentId || '群成员'} 正在处理`);

  for (let index = 0; index < 3; index += 1) {
    const dot = document.createElement('span');
    dot.className = 'processing-indicator-dot';
    dot.style.animationDelay = `${index * 0.14}s`;
    indicator.append(dot);
  }

  body.append(sender, indicator);
  row.append(avatar, body);
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
    if (state.groupModalOpen) {
      toggleGroupModal(false);
      return;
    }
    if (state.mentionMenuOpen) {
      closeMentionMenu();
      return;
    }
    if (state.historySearchOpen) {
      setHistorySearchOpen(false);
      historySearchInputEl?.blur();
      return;
    }
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
    renderThemePresetControls();
    populateSettingsForm({ resetDraft: true });
  } else {
    resetSettingsAvatarDraft();
  }
}

function populateSettingsForm({ resetDraft = false } = {}) {
  renderSettingsTabs();
  renderThemePresetControls();
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
  const isGroups = state.settingsExpandedSection === 'groups';
  const isPreferences = state.settingsExpandedSection === 'preferences';
  settingsContactsTabEl.classList.toggle('active', isContacts);
  settingsGroupsTabEl?.classList.toggle('active', isGroups);
  settingsPreferencesTabEl.classList.toggle('active', isPreferences);
  settingsContactsTabEl.setAttribute('aria-expanded', isContacts ? 'true' : 'false');
  settingsGroupsTabEl?.setAttribute('aria-expanded', isGroups ? 'true' : 'false');
  settingsPreferencesTabEl.setAttribute('aria-expanded', isPreferences ? 'true' : 'false');
  settingsContactsSectionEl.hidden = !isContacts;
  settingsGroupsSectionEl.hidden = !isGroups;
  settingsPreferencesSectionEl.hidden = !isPreferences;
}

function switchSettingsTab(tab) {
  const next = tab === 'preferences' ? 'preferences' : tab === 'groups' ? 'groups' : 'contacts';
  state.settingsExpandedSection = state.settingsExpandedSection === next ? null : next;
  if (state.settingsExpandedSection === 'contacts' && !state.settingsSelectedContactKey) {
    loadSettingsDraft(getDefaultSettingsContactKey());
  }
  if (state.settingsExpandedSection === 'groups') {
    renderSettingsGroupLists();
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
      avatarUrl = upload?.upload?.source || avatarUrl;
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

    renderConversationList({ refreshIdentity: true });
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
    agent.agentId === agentId ? { ...agent, ...patch } : agent
  ));
  state.conversations = state.conversations.map((item) => (
    item.kind === 'agent' && item.agentId === agentId ? { ...item, ...patch, title: patch.name || item.title } : item
  ));
}

function getActiveAgent() {
  return state.activeConversationKind === 'agent'
    ? findAgentById(state.activeConversationId)
    : null;
}

function getActiveConversation() {
  if (!state.activeConversationKind || !state.activeConversationId) return null;
  const item = findConversationItem(state.activeConversationKind, state.activeConversationId);
  if (item) return item;

  if (state.activeConversationKind === 'group' && state.activeGroupDetail?.groupId === state.activeConversationId) {
    return {
      kind: 'group',
      id: state.activeGroupDetail.groupId,
      groupId: state.activeGroupDetail.groupId,
      name: state.activeGroupDetail.name,
      title: state.activeGroupDetail.name,
      sessionKey: state.activeGroupDetail.sessionKey,
      memberCount: state.activeGroupDetail.memberCount,
      status: state.activeGroupDetail.status,
      archived: state.activeGroupDetail.status !== 'active',
      presence: 'idle',
      summary: ''
    };
  }

  return null;
}

function findConversationItem(kind, id) {
  const activeItem = state.conversations.find((item) => item.kind === kind && item.id === id);
  if (activeItem) return activeItem;
  if (kind === 'group') {
    return state.archivedGroups.find((item) => item.kind === 'group' && item.id === id) || null;
  }
  return null;
}

function findAgentById(agentId) {
  return state.agents.find((item) => item.agentId === agentId) || null;
}

function toConversationKey(kind, id) {
  return `${kind}:${id}`;
}

function getActiveHistorySearchScopeKey() {
  return state.activeConversationKind && state.activeConversationId
    ? toConversationKey(state.activeConversationKind, state.activeConversationId)
    : '';
}

function buildHistorySearchUrl(query) {
  if (state.activeConversationKind === 'group') {
    return `/api/openclaw-webchat/groups/${encodeURIComponent(state.activeConversationId)}/history/search?q=${encodeURIComponent(query)}&limit=20`;
  }
  return `/api/openclaw-webchat/agents/${encodeURIComponent(state.activeConversationId)}/history/search?q=${encodeURIComponent(query)}&limit=20`;
}

function buildHistoryPageUrl(kind, id, before) {
  const prefix = kind === 'group'
    ? `/api/openclaw-webchat/groups/${encodeURIComponent(id)}/history`
    : `/api/openclaw-webchat/agents/${encodeURIComponent(id)}/history`;
  return `${prefix}?limit=30&before=${encodeURIComponent(before)}`;
}

function shouldShowConversationProcessing() {
  if (isActiveSessionBusy()) return true;
  const active = getActiveConversation();
  return Boolean(active && active.presence === 'running');
}

async function syncCurrentConversation({ preserveScrollBottom = true, silent = false } = {}) {
  if (!state.activeSessionKey || !state.activeConversationId || !state.activeConversationKind) return;
  const context = {
    kind: state.activeConversationKind,
    id: state.activeConversationId,
    sessionKey: state.activeSessionKey
  };

  const payload = await apiGet(`/api/openclaw-webchat/sessions/${encodeURIComponent(state.activeSessionKey)}/snapshot?limit=200`);
  if (!isOperationContextActive(context)) return;

  state.messages = Array.isArray(payload?.history?.messages) ? payload.history.messages : [];
  state.nextBefore = payload?.history?.nextBefore || null;
  state.hasMore = Boolean(payload?.history?.hasMore);
  if (payload?.group && state.activeConversationKind === 'group') {
    state.activeGroupDetail = payload.group;
    state.activeConversationCanSend = payload.group.canSend !== false;
  }
  mergeConversationItem(payload?.item);
  renderConversationList({ refreshIdentity: false });
  renderMessages();
  updateHeader();
  if (preserveScrollBottom) {
    maybeScrollMessagesToBottom();
  } else {
    maybeScrollMessagesToBottom(true);
  }
  if (!silent) {
    showStatus('会话已同步。', 'success');
  }
}

function mergeConversationItem(item) {
  if (!item?.kind || !item?.id) return;
  const replaceInList = (list) => list.map((entry) => (
    entry.kind === item.kind && entry.id === item.id ? { ...entry, ...item } : entry
  ));
  if (state.conversations.some((entry) => entry.kind === item.kind && entry.id === item.id)) {
    state.conversations = replaceInList(state.conversations);
  }
  if (item.kind === 'group' && state.archivedGroups.some((entry) => entry.kind === item.kind && entry.id === item.id)) {
    state.archivedGroups = replaceInList(state.archivedGroups);
  }
}

function renderSettingsGroupLists() {
  if (!settingsActiveGroupListEl || !settingsArchivedGroupListEl) return;
  settingsActiveGroupListEl.innerHTML = '';
  settingsArchivedGroupListEl.innerHTML = '';

  const activeGroups = state.conversations.filter((item) => item.kind === 'group');
  const archivedGroups = state.archivedGroups;

  if (!activeGroups.length) {
    settingsActiveGroupListEl.append(createSettingsGroupEmpty('当前没有可管理的群聊。'));
  } else {
    activeGroups.forEach((group) => settingsActiveGroupListEl.append(createSettingsGroupRow(group, { archived: false })));
  }

  if (!archivedGroups.length) {
    settingsArchivedGroupListEl.append(createSettingsGroupEmpty('还没有已退出或已解散的群聊。'));
  } else {
    archivedGroups.forEach((group) => settingsArchivedGroupListEl.append(createSettingsGroupRow(group, { archived: true })));
  }
}

function createSettingsGroupEmpty(text) {
  const empty = document.createElement('div');
  empty.className = 'settings-group-empty';
  empty.textContent = text;
  return empty;
}

function createSettingsGroupRow(group, { archived }) {
  const row = document.createElement('div');
  row.className = 'settings-group-row';

  const copy = document.createElement('div');
  copy.className = 'settings-group-copy';

  const title = document.createElement('div');
  title.className = 'settings-group-name';
  title.textContent = group.name || group.title || '群聊';

  const meta = document.createElement('div');
  meta.className = 'settings-group-meta';
  meta.textContent = archived
    ? `${group.memberCount || 0} 人 · ${group.status === 'dissolved' ? '已解散' : '已退出'}`
    : `${group.memberCount || 0} 人 · ${group.summary || '暂无摘要'}`;

  const actions = document.createElement('div');
  actions.className = 'settings-group-actions';

  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'ghost-button';
  open.textContent = archived ? '查看历史' : '打开';
  open.addEventListener('click', async () => {
    toggleSettingsPanel(false);
    await openConversation('group', group.groupId || group.id, { forceReload: true });
  });

  actions.append(open);
  if (!archived) {
    const manage = document.createElement('button');
    manage.type = 'button';
    manage.className = 'ghost-button';
    manage.textContent = '管理';
    manage.addEventListener('click', async () => {
      await openConversation('group', group.groupId || group.id, { forceReload: false });
      openManageCurrentGroup();
    });
    actions.append(manage);
  }

  copy.append(title, meta);
  row.append(copy, actions);
  return row;
}

function openCreateGroupModal() {
  state.groupModalMode = 'create';
  state.groupModalGroupId = null;
  state.groupModalName = '';
  state.groupModalSelectedAgentIds = new Set();
  renderGroupModal();
  toggleGroupModal(true);
}

async function openManageCurrentGroup() {
  if (state.activeConversationKind !== 'group' || !state.activeConversationId) return;
  const payload = await apiGet(`/api/openclaw-webchat/groups/${encodeURIComponent(state.activeConversationId)}`);
  state.activeGroupDetail = payload?.group || state.activeGroupDetail;
  state.groupModalMode = 'manage';
  state.groupModalGroupId = state.activeConversationId;
  state.groupModalName = state.activeGroupDetail?.name || '';
  state.groupModalSelectedAgentIds = new Set();
  renderGroupModal();
  toggleGroupModal(true);
}

function toggleGroupModal(open) {
  state.groupModalOpen = Boolean(open);
  groupModalEl?.classList.toggle('hidden', !state.groupModalOpen);
  groupModalBackdropEl?.classList.toggle('hidden', !state.groupModalOpen);
  groupModalEl?.setAttribute('aria-hidden', state.groupModalOpen ? 'false' : 'true');
  if (!state.groupModalOpen) {
    state.groupModalSelectedAgentIds = new Set();
  }
}

function renderGroupModal() {
  if (!groupModalEl) return;
  const detail = state.groupModalMode === 'manage' ? state.activeGroupDetail : null;
  const canManage = state.groupModalMode === 'manage' && detail;

  groupModalTitleEl.textContent = canManage ? `管理群聊 · ${detail.name}` : '新建群聊';
  groupNameInputEl.value = state.groupModalName;
  groupCurrentMembersFieldEl.classList.toggle('hidden', !canManage);
  createGroupSubmitButtonEl.classList.toggle('hidden', canManage);
  renameGroupButtonEl.classList.toggle('hidden', !canManage || detail?.status !== 'active');
  inviteGroupMembersButtonEl.classList.toggle('hidden', !canManage || detail?.status !== 'active');
  leaveGroupButtonEl.classList.toggle('hidden', !canManage || detail?.status !== 'active');
  dissolveGroupButtonEl.classList.toggle('hidden', !canManage || detail?.status !== 'active');

  renderGroupMemberPicker();
  renderGroupCurrentMembers();
}

function renderGroupMemberPicker() {
  if (!groupMemberPickerEl) return;
  groupMemberPickerEl.innerHTML = '';
  const currentMemberIds = new Set((state.activeGroupDetail?.currentMembers || []).map((item) => item.agentId));
  const availableAgents = state.agents.filter((agent) => (
    state.groupModalMode === 'create' || !currentMemberIds.has(agent.agentId)
  ));

  if (!availableAgents.length) {
    const empty = document.createElement('div');
    empty.className = 'settings-group-empty';
    empty.textContent = state.groupModalMode === 'create' ? '当前没有可邀请的 agent。' : '所有 agent 都已在群里。';
    groupMemberPickerEl.append(empty);
    return;
  }

  availableAgents.forEach((agent) => {
    const label = document.createElement('label');
    label.className = 'group-member-option';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'group-member-checkbox';
    input.checked = state.groupModalSelectedAgentIds.has(agent.agentId);
    const syncSelectedState = () => {
      if (input.checked) {
        state.groupModalSelectedAgentIds.add(agent.agentId);
      } else {
        state.groupModalSelectedAgentIds.delete(agent.agentId);
      }
      label.classList.toggle('selected', input.checked);
    };
    input.addEventListener('change', syncSelectedState);

    const main = document.createElement('div');
    main.className = 'group-member-main';

    const avatar = createAvatarElement({
      className: 'group-member-avatar',
      avatarUrl: agent.avatarUrl,
      label: agent.name || agent.agentId,
      fallbackText: (agent.name || agent.agentId || '?').slice(0, 1).toUpperCase()
    });

    const copy = document.createElement('div');
    copy.className = 'group-member-copy';

    const name = document.createElement('div');
    name.className = 'group-member-name';
    name.textContent = agent.name || agent.agentId;

    const meta = document.createElement('div');
    meta.className = 'group-member-id';
    meta.textContent = agent.agentId;

    copy.append(name, meta);
    main.append(avatar, copy);
    label.append(input, main);
    label.classList.toggle('selected', input.checked);
    label.addEventListener('click', (event) => {
      if (event.target === input) return;
      event.preventDefault();
      input.checked = !input.checked;
      syncSelectedState();
    });
    groupMemberPickerEl.append(label);
  });
}

function renderGroupCurrentMembers() {
  if (!groupCurrentMembersEl) return;
  groupCurrentMembersEl.innerHTML = '';
  const members = state.activeGroupDetail?.currentMembers || [];
  if (!members.length) {
    groupCurrentMembersEl.append(createSettingsGroupEmpty('当前群聊还没有成员。'));
    return;
  }

  members.forEach((member) => {
    const row = document.createElement('div');
    row.className = 'group-current-member-row';

    const main = document.createElement('div');
    main.className = 'group-current-member-main';

    const avatar = createAvatarElement({
      className: 'group-member-avatar',
      avatarUrl: member.avatarUrl,
      label: member.name || member.agentId,
      fallbackText: (member.name || member.agentId || '?').slice(0, 1).toUpperCase()
    });

    const copy = document.createElement('div');
    copy.className = 'group-current-member-copy';
    const name = document.createElement('div');
    name.className = 'group-member-name';
    name.textContent = member.name || member.agentId;

    const meta = document.createElement('div');
    meta.className = 'group-member-id';
    meta.textContent = member.agentId;

    copy.append(name, meta);
    main.append(avatar, copy);

    row.append(main);
    if (state.activeGroupDetail?.status === 'active') {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'ghost-button';
      remove.textContent = '移除';
      remove.addEventListener('click', () => removeGroupMemberFromCurrent(member.agentId));
      row.append(remove);
    }
    groupCurrentMembersEl.append(row);
  });
}

async function submitCreateGroup() {
  const name = groupNameInputEl.value.trim();
  if (!name) {
    showStatus('群名不能为空。', 'error');
    return;
  }
  const memberAgentIds = [...state.groupModalSelectedAgentIds];
  const payload = await apiPost('/api/openclaw-webchat/groups', { name, memberAgentIds });
  toggleGroupModal(false);
  await refreshConversations({ autoOpen: false });
  await openConversation('group', payload?.group?.groupId || payload?.group?.id, { forceReload: true });
}

async function submitRenameGroup() {
  if (!state.activeConversationId) return;
  const name = groupNameInputEl.value.trim();
  if (!name) {
    showStatus('群名不能为空。', 'error');
    return;
  }
  await apiPatch(`/api/openclaw-webchat/groups/${encodeURIComponent(state.activeConversationId)}`, { name });
  state.groupModalName = name;
  await refreshConversations({ autoOpen: false });
  await openConversation('group', state.activeConversationId, { forceReload: true, preserveScrollBottom: true });
  renderGroupModal();
}

async function submitInviteGroupMembers() {
  if (!state.activeConversationId || !state.groupModalSelectedAgentIds.size) return;
  await apiPost(`/api/openclaw-webchat/groups/${encodeURIComponent(state.activeConversationId)}/members`, {
    agentIds: [...state.groupModalSelectedAgentIds]
  });
  state.groupModalSelectedAgentIds = new Set();
  await refreshConversations({ autoOpen: false });
  await openConversation('group', state.activeConversationId, { forceReload: true, preserveScrollBottom: true });
  await openManageCurrentGroup();
}

async function removeGroupMemberFromCurrent(agentId) {
  if (!state.activeConversationId) return;
  await apiDelete(`/api/openclaw-webchat/groups/${encodeURIComponent(state.activeConversationId)}/members/${encodeURIComponent(agentId)}`);
  await refreshConversations({ autoOpen: false });
  await openConversation('group', state.activeConversationId, { forceReload: true, preserveScrollBottom: true });
  await openManageCurrentGroup();
}

async function leaveCurrentGroup() {
  if (!state.activeConversationId || !window.confirm('退出后该群会从左侧列表移除，确定继续吗？')) return;
  await apiPost(`/api/openclaw-webchat/groups/${encodeURIComponent(state.activeConversationId)}/leave`, {});
  toggleGroupModal(false);
  await refreshConversations({ autoOpen: true });
}

async function dissolveCurrentGroup() {
  if (!state.activeConversationId || !window.confirm('解散后群聊会从左侧消失，但历史仍可在设置里查看，确定继续吗？')) return;
  await apiPost(`/api/openclaw-webchat/groups/${encodeURIComponent(state.activeConversationId)}/dissolve`, {});
  toggleGroupModal(false);
  await refreshConversations({ autoOpen: true });
}

function handleComposerInput() {
  const nextValue = composerInputEl.value;
  state.composerMentions = reconcileComposerMentions(state.composerPreviousValue, nextValue, state.composerMentions);
  state.composerPreviousValue = nextValue;
  autoResizeComposer();
  updateMentionMenuFromSelection();
}

function handleComposerKeydown(event) {
  if (!state.mentionMenuOpen) return;
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    state.mentionSelectedIndex = Math.min(state.mentionCandidates.length - 1, state.mentionSelectedIndex + 1);
    renderMentionMenu();
    return;
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    state.mentionSelectedIndex = Math.max(0, state.mentionSelectedIndex - 1);
    renderMentionMenu();
    return;
  }
  if (event.key === 'Enter' || event.key === 'Tab') {
    event.preventDefault();
    const target = state.mentionCandidates[state.mentionSelectedIndex];
    if (target) applyMentionCandidate(target);
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    closeMentionMenu();
  }
}

function updateMentionMenuFromSelection() {
  if (getActiveConversation()?.kind !== 'group' || !state.activeConversationCanSend) {
    closeMentionMenu();
    return;
  }

  const cursor = composerInputEl.selectionStart || 0;
  const before = composerInputEl.value.slice(0, cursor);
  const match = before.match(/(?:^|\s)@([^\s@]*)$/u);
  if (!match) {
    closeMentionMenu();
    return;
  }

  const query = match[1] || '';
  const rangeEnd = cursor;
  const rangeStart = rangeEnd - query.length - 1;
  const candidates = getGroupMentionCandidates(query);
  if (!candidates.length) {
    closeMentionMenu();
    return;
  }

  state.mentionQuery = query;
  state.mentionCandidates = candidates;
  state.mentionSelectedIndex = Math.min(state.mentionSelectedIndex, candidates.length - 1);
  state.mentionRange = { start: rangeStart, end: rangeEnd };
  state.mentionMenuOpen = true;
  renderMentionMenu();
}

function getGroupMentionCandidates(query) {
  const members = state.activeGroupDetail?.currentMembers || [];
  const normalized = String(query || '').trim().toLowerCase();
  return members.filter((member) => {
    if (!normalized) return true;
    return String(member.name || '').toLowerCase().includes(normalized)
      || String(member.agentId || '').toLowerCase().includes(normalized);
  });
}

function renderMentionMenu() {
  if (!mentionMenuEl) return;
  mentionMenuEl.innerHTML = '';
  mentionMenuEl.classList.toggle('hidden', !state.mentionMenuOpen);
  if (!state.mentionMenuOpen) return;

  state.mentionCandidates.forEach((candidate, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `mention-menu-item${index === state.mentionSelectedIndex ? ' active' : ''}`;
    button.textContent = `${candidate.name} · ${candidate.agentId}`;
    button.addEventListener('mousedown', (event) => {
      event.preventDefault();
      applyMentionCandidate(candidate);
    });
    mentionMenuEl.append(button);
  });
}

function applyMentionCandidate(candidate) {
  if (!state.mentionRange) return;
  const token = `@${candidate.name}`;
  const value = composerInputEl.value;
  const nextValue = `${value.slice(0, state.mentionRange.start)}${token} ${value.slice(state.mentionRange.end)}`;
  composerInputEl.value = nextValue;
  const mention = {
    agentId: candidate.agentId,
    displayName: candidate.name,
    start: state.mentionRange.start,
    end: state.mentionRange.start + token.length
  };
  state.composerMentions = reconcileComposerMentions(state.composerPreviousValue, nextValue, state.composerMentions);
  state.composerMentions.push(mention);
  state.composerPreviousValue = nextValue;
  const caret = mention.end + 1;
  composerInputEl.setSelectionRange(caret, caret);
  closeMentionMenu();
  autoResizeComposer();
}

function reconcileComposerMentions(previousValue, nextValue, mentions) {
  const prev = String(previousValue || '');
  const next = String(nextValue || '');
  const currentMentions = Array.isArray(mentions) ? mentions : [];
  if (!currentMentions.length) return [];
  if (prev === next) {
    return currentMentions.filter((mention) => next.slice(mention.start, mention.end) === `@${mention.displayName}`);
  }

  let prefix = 0;
  while (prefix < prev.length && prefix < next.length && prev[prefix] === next[prefix]) prefix += 1;

  let suffix = 0;
  while (
    suffix < prev.length - prefix
    && suffix < next.length - prefix
    && prev[prev.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const delta = next.length - prev.length;
  return currentMentions.flatMap((mention) => {
    let start = mention.start;
    let end = mention.end;
    if (end <= prefix) {
      // unchanged before the edit
    } else if (start >= prev.length - suffix) {
      start += delta;
      end += delta;
    } else {
      return [];
    }
    return next.slice(start, end) === `@${mention.displayName}` ? [{ ...mention, start, end }] : [];
  });
}

function closeMentionMenu() {
  state.mentionMenuOpen = false;
  state.mentionQuery = '';
  state.mentionCandidates = [];
  state.mentionSelectedIndex = 0;
  state.mentionRange = null;
  renderMentionMenu();
}

function collectMentionAgentIdsFromComposer(text) {
  const explicit = state.composerMentions
    .filter((mention) => String(text).slice(mention.start, mention.end) === `@${mention.displayName}`)
    .map((mention) => mention.agentId);

  const members = state.activeGroupDetail?.currentMembers || [];
  const implicit = [];
  const matcher = /@([^\s@]+)/gu;
  let match;
  while ((match = matcher.exec(String(text || '')))) {
    const token = String(match[1] || '').trim().toLowerCase();
    if (!token) continue;
    const exactMatches = members.filter((member) => (
      String(member.name || '').toLowerCase() === token || String(member.agentId || '').toLowerCase() === token
    ));
    if (exactMatches.length === 1) {
      implicit.push(exactMatches[0].agentId);
    }
  }

  return [...new Set([...explicit, ...implicit])];
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

function maybeScrollMessagesToBottom(force = false) {
  if (!force && !state.autoScrollPinned) return;
  scrollMessagesToBottom();
}

function keepMessagesPinnedOnMediaLoad(element, eventName) {
  const shouldStickToBottom = state.autoScrollPinned || isNearBottom();
  element.addEventListener(eventName, () => {
    if (!shouldStickToBottom && !state.autoScrollPinned && !isNearBottom()) return;
    maybeScrollMessagesToBottom();
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
  setComposerEnabled(Boolean(state.activeSessionKey) && state.activeConversationCanSend !== false && !isActiveSessionBusy());
}

function setComposerEnabled(enabled) {
  composerInputEl.disabled = !enabled;
  sendButtonEl.disabled = !enabled;
  newContextButtonEl.disabled = !enabled;
  attachButtonEl.disabled = !enabled;
  mediaUploadInputEl.disabled = !enabled;
  if (!enabled && state.activeConversationCanSend === false) {
    composerInputEl.placeholder = '当前群聊为只读历史，不能继续发送消息';
  } else if (getActiveConversation()?.kind === 'group') {
    composerInputEl.placeholder = '输入消息，Enter 换行；群聊里输入 @ 可点名成员';
  } else {
    composerInputEl.placeholder = '输入消息，Enter 换行；点 / 按钮或直接输入 slash 命令可执行本地命令';
  }
  if (!enabled) closeCommandMenu();
  renderPendingUploads();
}

function beginSessionActivity(sessionKey) {
  if (!sessionKey) return;
  state.sendingSessionKeys.add(sessionKey);
  if (state.activeSessionKey === sessionKey) {
    state.autoScrollPinned = true;
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
  if (context.kind && state.activeConversationKind !== context.kind) return false;
  if (context.id && state.activeConversationId !== context.id) return false;
  if (context.agentId && state.activeAgentId !== context.agentId) return false;
  if (context.sessionKey && state.activeSessionKey !== context.sessionKey) return false;
  return true;
}

function startPolling() {
  clearInterval(state.pollingTimer);
  state.pollingTimer = setInterval(async () => {
    try {
      await refreshConversations({ autoOpen: false });
      if (!isActiveSessionBusy()) {
        await syncCurrentConversation({ preserveScrollBottom: true, silent: true });
      }
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

async function apiDelete(url) {
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      accept: 'application/json'
    }
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

function formatSearchTimestamp(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
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
