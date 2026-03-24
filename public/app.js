import { groupMessageBlocksForRender } from './message-blocks.js';

const BRAND_NAME = 'Claw WebChat';
const THEME_STORAGE_KEY = 'openclaw-webchat-theme-choice';
const LEGACY_THEME_MODE_STORAGE_KEY = 'openclaw-webchat-theme-mode';
const LANGUAGE_STORAGE_KEY = 'openclaw-webchat-language';
const HISTORY_SEARCH_RECENTS_STORAGE_KEY = 'openclaw-webchat-history-search-recents';
const HISTORY_SEARCH_MAX_RECENTS = 8;
const DEFAULT_HISTORY_SEARCH_LIMIT = 50;
const SETTINGS_SECTIONS = ['contacts', 'preferences', 'access', 'about', 'manual-start'];
const SUPPORTED_LANGUAGES = ['zh-CN', 'en'];
const THEME_PRESETS = {
  dark: {
    mode: 'dark',
    tag: { 'zh-CN': '默认', en: 'Default' },
    name: { 'zh-CN': '深色', en: 'Dark' },
    hint: { 'zh-CN': '夜间更稳，更适合低光环境。', en: 'More stable at night and better in low-light environments.' }
  },
  'light-paper': {
    mode: 'light',
    tag: { 'zh-CN': 'A', en: 'A' },
    name: { 'zh-CN': 'Dawn Peach', en: 'Dawn Peach' },
    hint: { 'zh-CN': '顶部带一点杏桃暖光，保留轻微色彩变化。', en: 'A touch of peach warmth near the top with subtle color variation.' }
  },
  'light-gray': {
    mode: 'light',
    tag: { 'zh-CN': 'E', en: 'E' },
    name: { 'zh-CN': 'Soft Gray', en: 'Soft Gray' },
    hint: { 'zh-CN': '中性浅灰，更安静，几乎不带额外色偏。', en: 'A quieter neutral gray with almost no extra color cast.' }
  },
  'light-linen': {
    mode: 'light',
    tag: { 'zh-CN': 'B', en: 'B' },
    name: { 'zh-CN': 'Warm Linen', en: 'Warm Linen' },
    hint: { 'zh-CN': '微暖的亚麻纸感，柔和但不显脏。', en: 'A soft warm linen-paper feel without looking muddy.' }
  },
  'light-mist': {
    mode: 'light',
    tag: { 'zh-CN': 'C', en: 'C' },
    name: { 'zh-CN': 'Mist Blue', en: 'Mist Blue' },
    hint: { 'zh-CN': '偏冷静的蓝灰，工具感更强。', en: 'A calmer blue-gray with a more tool-like feel.' }
  },
  'light-sand': {
    mode: 'light',
    tag: { 'zh-CN': 'D', en: 'D' },
    name: { 'zh-CN': 'Soft Sand', en: 'Soft Sand' },
    hint: { 'zh-CN': '最放松的浅暖中性，存在感很轻。', en: 'The softest warm neutral with a very light presence.' }
  }
};

const I18N = {
  'zh-CN': {
    ui: {
      closeSidebar: '关闭侧栏',
      refresh: '刷新',
      openSettings: '打开设置',
      openSidebar: '打开侧栏',
      selectAgent: '选择 agent 开始聊天',
      searchHistory: '搜索当前会话历史',
      search: '搜索',
      historySearch: '历史搜索',
      searchDateFrom: '起始日期',
      searchDateTo: '结束日期',
      searchResultLimit: '结果数',
      composerPlaceholder: '输入消息，Enter 换行；点 / 按钮或直接输入 slash 命令可执行本地命令',
      attachMedia: '上传图片或音频',
      openSlashMenu: '打开 slash 命令菜单',
      send: '发送',
      stopReply: '停止当前回复',
      workspaceSettings: 'Workspace Settings',
      settings: '设置',
      closeSettings: '关闭设置',
      contacts: '联系人',
      appearance: '外观',
      accessAndSecurity: '访问与安全',
      about: '关于',
      manualStart: '手动启动服务',
      language: '界面语种',
      languageHint: '语种偏好会保存在当前浏览器。',
      themeHintStored: '主题偏好会保存在当前浏览器。',
      comingSoonStructure: '设置面板已按展开式分区组织，后续继续加项目时不需要再重做结构。',
      localOnly: '仅本机',
      lanTailscale: '局域网 / Tailscale',
      enableLightAuth: '启用可选轻认证',
      accessPassword: '访问口令',
      confirmAccessPassword: '确认访问口令',
      saveAccessSettings: '保存访问设置',
      logoutAuth: '当前浏览器退出认证',
      restartService: '重启服务',
      projectLinks: '项目链接',
      githubRepo: 'GitHub 仓库',
      manualStartTitle: '手动启动服务',
      stepProjectDir: '1. 项目目录',
      stepInstall: '2. 首次安装依赖',
      stepStart: '3. 启动服务',
      stepRestart: '4. 已注册 LaunchAgent 时可直接重启',
      zoomOut: '缩小',
      resetZoom: '重置缩放',
      zoomIn: '放大',
      imagePreview: '图片预览',
      accessGate: 'Access Gate',
      enterPassword: '输入访问口令',
      enterWebChat: '进入 WebChat',
      serviceRestart: 'Service Restart',
      serviceRestarting: '服务正在重启',
      theme: '界面主题',
      modelPicker: '切换模型',
      closeModelPicker: '关闭模型切换',
      currentModel: '当前模型',
      availableModels: '可用模型'
    },
    text: {
      contactsIntro: '统一管理用户自己和所有 agent 的显示名称与头像。头像选择本地图片后会自动裁成正方形，点击保存后才生效。',
      contactPreview: '联系人预览',
      contactPreviewSubtitle: '左栏、顶部标题和消息头像会同步更新',
      contactField: '联系人',
      displayName: '显示名称',
      displayNamePlaceholder: '输入显示名称',
      avatar: '头像',
      chooseLocalImage: '选择本地图片',
      clearAvatar: '清除头像',
      avatarUploadHint: '支持本地图片，保存时自动裁成正方形并上传。',
      saveContactSettings: '保存联系人设置',
      appearanceIntro: '这里管理当前浏览器里的界面主题和显示风格。主题模式已经可用，后续可以继续接入语种、消息密度等外观项。',
      accessIntro: '这里管理本机 / 局域网访问方式，以及局域网模式下可选的轻认证。Tailscale 访问沿用同一服务地址，只需要保证你的 Tailnet 已能访问当前主机。',
      accessMode: '访问方式',
      documentAccessTitle: '文档访问范围',
      aboutTitle: '关于 Claw WebChat',
      shareRepoHint: '如果你在社区里分享这个项目，优先把这里的仓库链接发出去即可。',
      selfManageTitle: '手动启动服务',
      authGateCopy: '当前实例已开启轻认证。输入访问口令后继续使用 WebChat。'
      ,
      projectSummary: '一个面向个人使用的 Claw WebChat，强调本地优先、长历史、媒体上传和更顺手的 agent 交流体验。',
      modelPickerIntro: '下面列出当前可用模型，选择后会直接切换这个 agent 的上游会话模型。',
      modelPickerCurrentMissing: '当前模型未出现在可用列表里，你仍然可以从下面选择新模型。'
    },
    status: {
      initFailed: '初始化失败：{error}',
      authRequired: '已开启访问口令，请先完成认证。',
      authLoginHint: '如果你通过 Tailscale 访问，这里的口令仍由当前实例单独控制。',
      passwordRequired: '请输入访问口令。',
      authSuccess: '认证成功。',
      noAgents: '暂未发现 agent。',
      clickToOpen: '点击进入会话',
      openingSession: '正在打开会话…',
      createdTimeline: '已创建并进入该 agent 的长期主时间线。',
      restoredSession: '会话已恢复。',
      searchNeedAgent: '请先打开一个 agent 会话，再搜索该时间线中的历史消息。',
      searchingHistory: '正在搜索当前 agent 的历史消息…',
      searchPrompt: '输入关键词后即可搜索当前 agent 的主时间线，也可叠加日期筛选。',
      searchResultsSummary: '已找到 {total} 条命中结果{overflow}',
      searchResultsOverflow: '，当前显示前 {shown} 条。',
      searchResultsEnd: '。',
      searchFiltersActive: '当前筛选：{filters}',
      searchDateRangeInvalid: '起始日期不能晚于结束日期。',
      noSearchResults: '没有找到匹配的历史消息。',
      searchHitMessage: '命中消息',
      systemMarker: '系统标记',
      messageFallback: '消息',
      searchFailed: '搜索失败：{error}',
      locatingHit: '正在定位命中消息…',
      locateFailed: '未能定位到该条历史消息。',
      locateSuccess: '已跳转到历史命中消息。',
      emptyTimelineTitle: '当前时间线还没有消息',
      emptyTimelineTip: '点输入框左侧的 + 可上传图片或音频；音频默认转写后发给 agent，同时保留原始文件引用。',
      contextReset: '已重置上下文',
      fileMissing: '文件丢失',
      viewImage: '查看图片',
      imageLoadFailed: '图片加载失败',
      audioLabel: '音频',
      audioLoadFailed: '音频加载失败',
      transcriptText: '转写文本',
      transcriptStatus: '转写状态',
      transcriptFailedKeepAudio: '转写失败，已保留原始音频',
      videoLabel: '视频',
      playVideo: '播放视频',
      videoLoadFailed: '视频加载失败',
      fileLabel: '文件',
      clickToOpenFile: '点击打开',
      attachmentFailed: '附件处理失败：{error}',
      sendDone: '发送完成。',
      sendFailed: '发送失败：{error}',
      stoppingReply: '正在停止当前回复…',
      replyStopped: '已停止当前回复。',
      replyStopFailed: '停止当前回复失败：{error}',
      uploadOnlyImageAudio: '仅支持图片或音频上传：{name}',
      noLocalCommands: '当前没有可用本地命令',
      executingCommand: '正在执行 {name}…',
      commandFailed: '命令失败：{error}',
      commandResetDone: '上游上下文已重置，本地历史已保留。',
      commandCompactDone: '压缩命令已执行。',
      commandDone: '{name} 已执行。',
      loadingModelOptions: '正在加载可用模型…',
      modelOptionsFailed: '加载可用模型失败：{error}',
      noAvailableModels: '当前没有可切换的模型。',
      switchingModel: '正在切换模型到 {model}…',
      modelSwitchDone: '模型已切换到 {model}。',
      modelSwitchFailed: '模型切换失败：{error}',
      currentModelUnavailable: '当前模型不在可用列表里。',
      timelineLongLived: '长期主时间线',
      clickToCreate: '点击后自动创建',
      noSummary: '暂无摘要',
      processingAgent: 'agent 正在处理',
      unnamedAudio: '未命名音频',
      unnamedImage: '未命名图片',
      remove: '移除',
      uploadReadyWithMessage: '已就绪，发送时会一并带上',
      uploadAutoImage: '发送时自动上传',
      uploadAutoAudio: '发送时自动上传并转写',
      transcriptReady: '转写完成 · {summary}',
      transcriptFailedSendAudio: '转写失败，仍会发送原音频',
      uploadFailed: '上传失败：{name}',
      uploadingAudio: '正在上传并转写音频 {index}/{total}…',
      uploadingImage: '正在上传图片 {index}/{total}…',
      readFileFailed: '读取文件失败：{name}',
      cropUnsupported: '浏览器不支持头像裁剪。',
      imageCropLoadFailed: '图片加载失败，无法裁剪头像。',
      avatarExportFailed: '头像导出失败。',
      networkHint: '{mode} 模式启动时会绑定 {targetHost}。当前生效地址是 {effectiveHost}，{manager}{restart}',
      networkHintRestart: '，保存后需重启服务。',
      networkManagerEnv: '环境变量覆盖中',
      networkManagerConfig: '当前由设置文件管理',
      lightAuthEnabledHint: '轻认证已启用。留空表示保持当前口令；修改访问口令会立即刷新当前浏览器会话。',
      lightAuthFirstHint: '首次启用轻认证时必须设置访问口令。',
      lightAuthOffHint: '默认关闭。建议在局域网访问模式下按需开启；Tailscale 环境也可额外叠加这一层。',
      documentAccessFollow: '文档访问范围目前与 OpenClaw 中的设定保持相同，WebChat 不再额外限制。',
      documentAccessOpenClaw: '文档访问范围由 OpenClaw 自身决定。',
      restartHintSupported: '监听地址切换必须重启后才会真正重新绑定；访问口令开关和口令修改可即时生效。可用重启命令：{hint}',
      restartHintManual: '当前环境不支持从设置页自动重启。监听地址切换必须手动重启；访问口令开关和口令修改可即时生效。',
      manualStartIntroSupported: '如果你需要手动启动或恢复服务，可以按下面的步骤操作；已注册 LaunchAgent 时也可以直接执行重启命令。',
      manualStartIntro: '如果你需要手动启动或恢复服务，可以按下面的步骤操作。',
      manualRestartFallback: '如果你使用自己的进程管理器，请按当前方式重启 Claw WebChat。',
      selfSubtitle: '用户自己',
      syncUserAvatar: '会同步到消息区里“我”的头像与名称',
      syncAgentAvatar: '会同步到 {agent} 的左栏、顶部标题和消息头像',
      avatarCropped: '头像已自动裁成正方形，点击保存后生效。',
      avatarWillRemove: '头像将在保存后移除。',
      avatarOnlyImage: '头像仅支持图片文件。',
      avatarProcessFailed: '头像处理失败：{error}',
      uploadingAvatar: '正在上传头像…',
      contactSettingsSaved: '联系人设置已保存。',
      saveFailed: '保存失败：{error}',
      accessSettingsSaved: '访问设置已保存。',
      accessSettingsSaveFailed: '访问设置保存失败：{error}',
      loggedOut: '当前浏览器已退出认证。',
      logoutFailed: '退出认证失败：{error}',
      restartingService: '服务正在重启，前端会自动等待恢复。',
      restartingServiceShort: '服务正在重启…',
      restartFailed: '重启服务失败：{error}',
      serviceRecoveredSync: '服务已恢复，正在重新同步状态…',
      serviceRestartDone: '服务重启完成，已重新连接。',
      serviceRestartTimeout: '等待服务恢复超时，请手动刷新页面或稍后重试。',
      sendingMessage: '消息发送中…',
      sendingAttachments: '正在上传附件并发送…',
      sendingAudioAttachments: '正在处理附件并发送…',
      authRequiredInline: '当前访问需要先完成认证。',
      presenceRunning: '处理中',
      presenceRecent: '刚回复',
      presenceIdle: '待命'
    },
    command: {
      session: 'Session',
      model: 'Model',
      tools: 'Tools',
      '/new': '重置上游上下文并保留本地历史',
      '/reset': '等同 /new',
      '/model': '查看或设置当前模型',
      '/models': '查看可用模型列表（/model 别名）',
      '/think': '查看或设置 thinking level',
      '/fast': '查看或设置 fast mode',
      '/verbose': '查看或设置 verbose level',
      '/compact': '压缩当前上游 session transcript',
      '/help': '显示本地 slash 命令帮助'
    }
  },
  en: {
    ui: {
      closeSidebar: 'Close sidebar',
      refresh: 'Refresh',
      openSettings: 'Open settings',
      openSidebar: 'Open sidebar',
      selectAgent: 'Select an agent to start chatting',
      searchHistory: 'Search this conversation history',
      search: 'Search',
      historySearch: 'History Search',
      searchDateFrom: 'From',
      searchDateTo: 'To',
      searchResultLimit: 'Limit',
      composerPlaceholder: 'Type a message. Enter inserts a newline. Use the / button or type a slash command to run local commands.',
      attachMedia: 'Upload image or audio',
      openSlashMenu: 'Open slash command menu',
      send: 'Send',
      stopReply: 'Stop current reply',
      workspaceSettings: 'Workspace Settings',
      settings: 'Settings',
      closeSettings: 'Close settings',
      contacts: 'Contacts',
      appearance: 'Appearance',
      accessAndSecurity: 'Access & Security',
      about: 'About',
      manualStart: 'Manual Start',
      language: 'Interface Language',
      languageHint: 'Language preference is stored in this browser.',
      themeHintStored: 'Theme preference is stored in this browser.',
      comingSoonStructure: 'The settings panel now uses expandable sections so more items can be added without reworking the layout.',
      localOnly: 'Local Only',
      lanTailscale: 'LAN / Tailscale',
      enableLightAuth: 'Enable optional light authentication',
      accessPassword: 'Access Password',
      confirmAccessPassword: 'Confirm Access Password',
      saveAccessSettings: 'Save Access Settings',
      logoutAuth: 'Log Out This Browser',
      restartService: 'Restart Service',
      projectLinks: 'Project Links',
      githubRepo: 'GitHub Repository',
      manualStartTitle: 'Manual Start',
      stepProjectDir: '1. Project Directory',
      stepInstall: '2. Install Dependencies',
      stepStart: '3. Start Service',
      stepRestart: '4. Restart When LaunchAgent Is Registered',
      zoomOut: 'Zoom out',
      resetZoom: 'Reset zoom',
      zoomIn: 'Zoom in',
      imagePreview: 'Image preview',
      accessGate: 'Access Gate',
      enterPassword: 'Enter Access Password',
      enterWebChat: 'Enter WebChat',
      serviceRestart: 'Service Restart',
      serviceRestarting: 'Service Restarting',
      theme: 'Theme',
      modelPicker: 'Switch Model',
      closeModelPicker: 'Close model picker',
      currentModel: 'Current Model',
      availableModels: 'Available Models'
    },
    text: {
      contactsIntro: 'Manage display names and avatars for yourself and all agents. Local avatar images are cropped to a square and only apply after you save.',
      contactPreview: 'Contact Preview',
      contactPreviewSubtitle: 'The sidebar, title bar, and message avatars will update together.',
      contactField: 'Contact',
      displayName: 'Display Name',
      displayNamePlaceholder: 'Enter a display name',
      avatar: 'Avatar',
      chooseLocalImage: 'Choose Local Image',
      clearAvatar: 'Clear Avatar',
      avatarUploadHint: 'Local images are supported and cropped to a square before upload when saved.',
      saveContactSettings: 'Save Contact Settings',
      appearanceIntro: 'Manage this browser\'s interface theme and visual style here. Theme switching is available now, and language or message-density options can continue to land here.',
      accessIntro: 'Manage local / LAN access modes here, along with optional light authentication for LAN-style access. Tailscale uses the same service address as long as your Tailnet can already reach this host.',
      accessMode: 'Access Mode',
      documentAccessTitle: 'Document Access Scope',
      aboutTitle: 'About Claw WebChat',
      shareRepoHint: 'If you share this project in the community, sending the repository link here is usually enough.',
      selfManageTitle: 'Manual Start',
      authGateCopy: 'Light authentication is enabled for this instance. Enter the access password to continue.'
      ,
      projectSummary: 'A personal-use Claw WebChat focused on local-first usage, long-lived history, media uploads, and smoother agent conversations.',
      modelPickerIntro: 'Available models are listed below. Selecting one switches the upstream model for this agent immediately.',
      modelPickerCurrentMissing: 'The current model is not in the available list, but you can still switch to one below.'
    },
    status: {
      initFailed: 'Initialization failed: {error}',
      authRequired: 'An access password is enabled. Please authenticate first.',
      authLoginHint: 'If you access through Tailscale, this password is still controlled by the current instance.',
      passwordRequired: 'Please enter the access password.',
      authSuccess: 'Authentication succeeded.',
      noAgents: 'No agents found yet.',
      clickToOpen: 'Click to open',
      openingSession: 'Opening conversation…',
      createdTimeline: 'Created and entered this agent\'s long-lived main timeline.',
      restoredSession: 'Session restored.',
      searchNeedAgent: 'Open an agent session first, then search within that timeline.',
      searchingHistory: 'Searching the current agent history…',
      searchPrompt: 'Enter keywords to search the current agent main timeline, with optional date filters.',
      searchResultsSummary: 'Found {total} matches{overflow}',
      searchResultsOverflow: ', showing the first {shown}.',
      searchResultsEnd: '.',
      searchFiltersActive: 'Filters: {filters}',
      searchDateRangeInvalid: 'The start date must not be later than the end date.',
      noSearchResults: 'No matching history messages found.',
      searchHitMessage: 'Matched message',
      systemMarker: 'System Marker',
      messageFallback: 'Message',
      searchFailed: 'Search failed: {error}',
      locatingHit: 'Locating the matched message…',
      locateFailed: 'Could not locate that history message.',
      locateSuccess: 'Jumped to the matched history message.',
      emptyTimelineTitle: 'This timeline has no messages yet',
      emptyTimelineTip: 'Use the + button next to the composer to upload images or audio. Audio is transcribed before being sent to the agent while preserving the original file reference.',
      contextReset: 'Context reset',
      fileMissing: 'File missing',
      viewImage: 'View image',
      imageLoadFailed: 'Image failed to load',
      audioLabel: 'Audio',
      audioLoadFailed: 'Audio failed to load',
      transcriptText: 'Transcript',
      transcriptStatus: 'Transcript Status',
      transcriptFailedKeepAudio: 'Transcription failed. The original audio was kept.',
      videoLabel: 'Video',
      playVideo: 'Play video',
      videoLoadFailed: 'Video failed to load',
      fileLabel: 'File',
      clickToOpenFile: 'Click to open',
      attachmentFailed: 'Attachment processing failed: {error}',
      sendDone: 'Message sent.',
      sendFailed: 'Send failed: {error}',
      stoppingReply: 'Stopping the current reply…',
      replyStopped: 'Stopped the current reply.',
      replyStopFailed: 'Failed to stop the current reply: {error}',
      uploadOnlyImageAudio: 'Only image or audio uploads are supported: {name}',
      noLocalCommands: 'No local commands are currently available.',
      executingCommand: 'Running {name}…',
      commandFailed: 'Command failed: {error}',
      commandResetDone: 'Upstream context was reset while local history was kept.',
      commandCompactDone: 'Compact command completed.',
      commandDone: '{name} completed.',
      loadingModelOptions: 'Loading available models…',
      modelOptionsFailed: 'Failed to load available models: {error}',
      noAvailableModels: 'No switchable models are available right now.',
      switchingModel: 'Switching model to {model}…',
      modelSwitchDone: 'Model switched to {model}.',
      modelSwitchFailed: 'Failed to switch model: {error}',
      currentModelUnavailable: 'The current model is not in the available list.',
      timelineLongLived: 'Long-lived main timeline',
      clickToCreate: 'Click to create automatically',
      noSummary: 'No summary yet',
      processingAgent: 'agent is processing',
      unnamedAudio: 'Untitled audio',
      unnamedImage: 'Untitled image',
      remove: 'Remove',
      uploadReadyWithMessage: 'Ready and will be included when sent',
      uploadAutoImage: 'Will upload when sent',
      uploadAutoAudio: 'Will upload and transcribe when sent',
      transcriptReady: 'Transcript ready · {summary}',
      transcriptFailedSendAudio: 'Transcription failed, but the original audio will still be sent',
      uploadFailed: 'Upload failed: {name}',
      uploadingAudio: 'Uploading and transcribing audio {index}/{total}…',
      uploadingImage: 'Uploading image {index}/{total}…',
      readFileFailed: 'Failed to read file: {name}',
      cropUnsupported: 'This browser does not support avatar cropping.',
      imageCropLoadFailed: 'The image failed to load and could not be cropped.',
      avatarExportFailed: 'Failed to export avatar.',
      networkHint: '{mode} binds to {targetHost} at startup. The current effective address is {effectiveHost}, {manager}{restart}',
      networkHintRestart: ', and a service restart is required after saving.',
      networkManagerEnv: 'currently overridden by environment variables',
      networkManagerConfig: 'currently managed by the settings file',
      lightAuthEnabledHint: 'Light authentication is enabled. Leave the fields empty to keep the current password. Updating it refreshes this browser session immediately.',
      lightAuthFirstHint: 'You must set an access password when enabling light authentication for the first time.',
      lightAuthOffHint: 'Disabled by default. It is recommended for LAN mode when needed, and it can also be layered on top of Tailscale access.',
      documentAccessFollow: 'Document access scope currently follows the OpenClaw configuration. WebChat does not apply an extra restriction here.',
      documentAccessOpenClaw: 'Document access scope is determined by OpenClaw itself.',
      restartHintSupported: 'Changing the bind address still requires a restart to rebind the listener. Light-auth toggles and password changes take effect immediately. Available restart command: {hint}',
      restartHintManual: 'Automatic restart is not available in the current environment. Bind-address changes must be restarted manually, while light-auth toggles and password changes still apply immediately.',
      manualStartIntroSupported: 'If you need to start or recover the service manually, follow the steps below. When LaunchAgent is registered, you can also run the restart command directly.',
      manualStartIntro: 'If you need to start or recover the service manually, follow the steps below.',
      manualRestartFallback: 'If you use your own process manager, restart Claw WebChat the same way you normally do.',
      selfSubtitle: 'You',
      syncUserAvatar: 'This updates the avatar and display name used for "Me" in the message area.',
      syncAgentAvatar: 'This updates the sidebar, title bar, and message avatar for {agent}.',
      avatarCropped: 'The avatar has been cropped to a square and will apply after saving.',
      avatarWillRemove: 'The avatar will be removed after saving.',
      avatarOnlyImage: 'Avatar uploads only support image files.',
      avatarProcessFailed: 'Avatar processing failed: {error}',
      uploadingAvatar: 'Uploading avatar…',
      contactSettingsSaved: 'Contact settings saved.',
      saveFailed: 'Save failed: {error}',
      accessSettingsSaved: 'Access settings saved.',
      accessSettingsSaveFailed: 'Failed to save access settings: {error}',
      loggedOut: 'This browser has logged out.',
      logoutFailed: 'Failed to log out: {error}',
      restartingService: 'The service is restarting and the frontend will wait for recovery automatically.',
      restartingServiceShort: 'Restarting service…',
      restartFailed: 'Failed to restart service: {error}',
      serviceRecoveredSync: 'The service is back. Resynchronizing state…',
      serviceRestartDone: 'Service restart completed and the connection has been restored.',
      serviceRestartTimeout: 'Timed out waiting for the service to recover. Please refresh the page manually or try again later.',
      sendingMessage: 'Sending message…',
      sendingAttachments: 'Uploading attachments and sending…',
      sendingAudioAttachments: 'Processing attachments and sending…',
      authRequiredInline: 'Authentication is required before you can continue.',
      presenceRunning: 'Processing',
      presenceRecent: 'Just replied',
      presenceIdle: 'Idle'
    },
    command: {
      session: 'Session',
      model: 'Model',
      tools: 'Tools',
      '/new': 'Reset the upstream context while keeping local history',
      '/reset': 'Alias for /new',
      '/model': 'View or set the current model',
      '/models': 'View the available model list (alias for /model)',
      '/think': 'View or set the thinking level',
      '/fast': 'View or set fast mode',
      '/verbose': 'View or set verbose level',
      '/compact': 'Compact the current upstream session transcript',
      '/help': 'Show local slash command help'
    }
  }
};

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
  stoppingSessionKeys: new Set(),
  stopRequestedSessionKeys: new Set(),
  pollingTimer: null,
  selectedOpenPromise: null,
  openRequestId: 0,
  commandCatalog: [],
  allowedCommands: new Set(),
  modelPickerOpen: false,
  modelPickerLoading: false,
  modelPickerError: '',
  modelPickerCurrent: null,
  modelPickerOptions: [],
  modelPickerSwitchingLabel: '',
  historySearchOpen: false,
  historySearchQuery: '',
  historySearchResults: [],
  historySearchTotal: 0,
  historySearchLoading: false,
  historySearchError: '',
  historySearchFromDate: '',
  historySearchToDate: '',
  historySearchLimit: DEFAULT_HISTORY_SEARCH_LIMIT,
  historySearchActiveMessageId: null,
  historySearchRequestId: 0,
  historySearchRecentQueries: [],
  historySearchShowingRecents: false,
  appReady: false,
  authEnabled: false,
  authenticated: true,
  authBusy: false,
  authError: '',
  restartingService: false,
  serviceRestartMessage: '',
  language: 'zh-CN',
  settingsOpen: false,
  settingsExpandedSection: null,
  settingsSelectedContactKey: null,
  settingsDraftDisplayName: '',
  settingsDraftAvatarUrl: null,
  settingsDraftAvatarFile: null,
  settingsDraftAvatarPreviewUrl: null,
  settingsAvatarRemoved: false,
  settingsNetworkAccess: 'local',
  settingsLightAuthEnabled: false,
  settingsLightAuthPassword: '',
  settingsLightAuthPasswordConfirm: '',
  mediaViewerOpen: false,
  mediaViewerScale: 1,
  mediaViewerOffsetX: 0,
  mediaViewerOffsetY: 0,
  mediaViewerDragging: false,
  mediaViewerPointerId: null,
  mediaViewerDragStartX: 0,
  mediaViewerDragStartY: 0,
  mediaViewerMoved: false,
  themeChoice: 'dark',
  autoScrollPinned: true,
  userProfile: {
    displayName: '我',
    avatarUrl: null
  },
  projectInfo: {
    name: BRAND_NAME,
    summary: '一个面向个人使用的 Claw WebChat，强调本地优先、长历史、媒体上传和更顺手的 agent 交流体验。',
    githubUrl: 'https://github.com/memphislee09-source/claw-webchat'
  },
  serviceSettings: {
    networkAccess: 'local',
    effectiveHost: '127.0.0.1',
    nextHost: '127.0.0.1',
    hostManagedBy: 'config',
    authEnabled: false,
    authConfigured: false,
    documentAccessMode: 'follow-openclaw',
    restartRequired: false,
    restartSupported: false,
    restartHint: null,
    manualStart: {
      projectDirectoryHint: '先进入 Claw WebChat 项目目录',
      installCommand: 'npm install',
      startCommand: 'npm start',
      restartCommand: null
    }
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
const historySearchFromLabelEl = document.getElementById('historySearchFromLabel');
const historySearchFromInputEl = document.getElementById('historySearchFromInput');
const historySearchToLabelEl = document.getElementById('historySearchToLabel');
const historySearchToInputEl = document.getElementById('historySearchToInput');
const historySearchLimitLabelEl = document.getElementById('historySearchLimitLabel');
const historySearchLimitSelectEl = document.getElementById('historySearchLimitSelect');
const historySearchMetaEl = document.getElementById('historySearchMeta');
const historySearchResultsEl = document.getElementById('historySearchResults');
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
const settingsAccessTabEl = document.getElementById('settingsAccessTab');
const settingsAboutTabEl = document.getElementById('settingsAboutTab');
const settingsManualStartTabEl = document.getElementById('settingsManualStartTab');
const settingsContactsSectionEl = document.getElementById('settingsContactsSection');
const settingsPreferencesSectionEl = document.getElementById('settingsPreferencesSection');
const settingsAccessSectionEl = document.getElementById('settingsAccessSection');
const settingsAboutSectionEl = document.getElementById('settingsAboutSection');
const settingsManualStartSectionEl = document.getElementById('settingsManualStartSection');
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
const settingsLanguageSelectEl = document.getElementById('settingsLanguageSelect');
const settingsNetworkAccessSelectEl = document.getElementById('settingsNetworkAccessSelect');
const settingsNetworkHintEl = document.getElementById('settingsNetworkHint');
const settingsLightAuthToggleEl = document.getElementById('settingsLightAuthToggle');
const settingsLightAuthPasswordInputEl = document.getElementById('settingsLightAuthPasswordInput');
const settingsLightAuthPasswordConfirmInputEl = document.getElementById('settingsLightAuthPasswordConfirmInput');
const settingsLightAuthHintEl = document.getElementById('settingsLightAuthHint');
const saveServiceSettingsButtonEl = document.getElementById('saveServiceSettingsButton');
const settingsLogoutButtonEl = document.getElementById('settingsLogoutButton');
const restartServiceButtonEl = document.getElementById('restartServiceButton');
const settingsRestartHintEl = document.getElementById('settingsRestartHint');
const settingsDocumentAccessCopyEl = document.getElementById('settingsDocumentAccessCopy');
const settingsAboutSummaryEl = document.getElementById('settingsAboutSummary');
const settingsGithubLinkEl = document.getElementById('settingsGithubLink');
const settingsManualStartIntroEl = document.getElementById('settingsManualStartIntro');
const settingsManualStartProjectDirEl = document.getElementById('settingsManualStartProjectDir');
const settingsManualInstallCommandEl = document.getElementById('settingsManualInstallCommand');
const settingsManualStartCommandEl = document.getElementById('settingsManualStartCommand');
const settingsManualRestartCommandEl = document.getElementById('settingsManualRestartCommand');
const mediaViewerEl = document.getElementById('mediaViewer');
const mediaViewerImageEl = document.getElementById('mediaViewerImage');
const mediaZoomOutButtonEl = document.getElementById('mediaZoomOutButton');
const mediaResetZoomButtonEl = document.getElementById('mediaResetZoomButton');
const mediaZoomInButtonEl = document.getElementById('mediaZoomInButton');
const modelPickerEl = document.getElementById('modelPicker');
const modelPickerTitleEl = document.getElementById('modelPickerTitle');
const modelPickerCopyEl = document.getElementById('modelPickerCopy');
const modelPickerCurrentLabelEl = document.getElementById('modelPickerCurrentLabel');
const modelPickerCurrentEl = document.getElementById('modelPickerCurrent');
const modelPickerMessageEl = document.getElementById('modelPickerMessage');
const modelPickerListEl = document.getElementById('modelPickerList');
const closeModelPickerButtonEl = document.getElementById('closeModelPickerButton');
const authGateEl = document.getElementById('authGate');
const authGateCopyEl = document.getElementById('authGateCopy');
const authLoginFormEl = document.getElementById('authLoginForm');
const authPasswordInputEl = document.getElementById('authPasswordInput');
const authLoginButtonEl = document.getElementById('authLoginButton');
const authLoginMessageEl = document.getElementById('authLoginMessage');
const serviceRestartGateEl = document.getElementById('serviceRestartGate');
const serviceRestartMessageEl = document.getElementById('serviceRestartMessage');
const appShellEl = document.querySelector('.app-shell');

state.language = getStoredLanguage();
applyLanguage(state.language);
state.themeChoice = getStoredThemeChoice();
applyThemeChoice(state.themeChoice);

boot().catch((error) => showStatus(`初始化失败：${formatError(error)}`, 'error'));

async function boot() {
  bindEvents();
  renderLocalizedChrome();
  autoResizeComposer();
  await refreshAuthStatus();
  if (state.authEnabled && !state.authenticated) {
    lockAppForAuth();
    return;
  }
  await loadAuthenticatedApp();
}

function bindEvents() {
  composerFormEl.addEventListener('submit', handleSendSubmit);
  newContextButtonEl.addEventListener('click', toggleCommandMenu);
  commandMenuEl?.addEventListener('click', handleCommandMenuClick);
  document.addEventListener('click', handleGlobalDocumentClick);
  historySearchFormEl?.addEventListener('submit', handleHistorySearchSubmit);
  historySearchInputEl?.addEventListener('focus', handleHistorySearchFocus);
  historySearchInputEl?.addEventListener('input', handleHistorySearchInput);
  historySearchFromInputEl?.addEventListener('input', handleHistorySearchFiltersChange);
  historySearchToInputEl?.addEventListener('input', handleHistorySearchFiltersChange);
  historySearchLimitSelectEl?.addEventListener('change', handleHistorySearchFiltersChange);
  headerRefreshButtonEl.addEventListener('click', () => refreshAgents({ autoOpen: false, refreshCurrent: true }));
  refreshAgentsButtonEl?.addEventListener('click', () => refreshAgents({ autoOpen: false, refreshCurrent: true }));
  attachButtonEl.addEventListener('click', () => mediaUploadInputEl.click());
  mediaUploadInputEl.addEventListener('change', handleFileSelection);
  composerInputEl.addEventListener('input', autoResizeComposer);
  messageListEl.addEventListener('scroll', async () => {
    state.autoScrollPinned = isNearBottom();
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
  settingsAccessTabEl?.addEventListener('click', () => switchSettingsTab('access'));
  settingsAboutTabEl?.addEventListener('click', () => switchSettingsTab('about'));
  settingsManualStartTabEl?.addEventListener('click', () => switchSettingsTab('manual-start'));
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
  settingsLanguageSelectEl?.addEventListener('change', handleLanguageChange);
  settingsNetworkAccessSelectEl?.addEventListener('change', handleServiceSettingsDraftChange);
  settingsLightAuthToggleEl?.addEventListener('change', handleServiceSettingsDraftChange);
  settingsLightAuthPasswordInputEl?.addEventListener('input', handleServiceSettingsDraftChange);
  settingsLightAuthPasswordConfirmInputEl?.addEventListener('input', handleServiceSettingsDraftChange);
  saveServiceSettingsButtonEl?.addEventListener('click', saveServiceSettings);
  settingsLogoutButtonEl?.addEventListener('click', logoutLightAuthSession);
  restartServiceButtonEl?.addEventListener('click', restartServiceFromSettings);
  authLoginFormEl?.addEventListener('submit', handleAuthLoginSubmit);
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
  closeModelPickerButtonEl?.addEventListener('click', () => closeModelPicker());
  modelPickerEl?.addEventListener('click', handleModelPickerBackdropClick);
  modelPickerListEl?.addEventListener('click', handleModelPickerOptionClick);

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) toggleSidebar(false);
    syncAllVisualBubbleWidths();
  });
  window.addEventListener('keydown', handleWindowKeydown);
}

function normalizeLanguage(value) {
  return SUPPORTED_LANGUAGES.includes(value) ? value : 'zh-CN';
}

function getStoredLanguage() {
  try {
    return normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return normalizeLanguage(document.documentElement.lang);
  }
}

function persistLanguage(language) {
  state.language = normalizeLanguage(language);
  applyLanguage(state.language);
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, state.language);
  } catch {
    // ignore storage errors
  }
}

function applyLanguage(language) {
  state.language = normalizeLanguage(language);
  document.documentElement.lang = state.language;
}

function t(key, replacements = {}) {
  const locale = I18N[state.language] || I18N['zh-CN'];
  const fallback = I18N['zh-CN'];
  const parts = String(key || '').split('.');
  let value = locale;
  let fallbackValue = fallback;
  for (const part of parts) {
    value = value?.[part];
    fallbackValue = fallbackValue?.[part];
  }
  const template = typeof value === 'string' ? value : typeof fallbackValue === 'string' ? fallbackValue : key;
  return template.replace(/\{(\w+)\}/g, (_match, name) => String(replacements[name] ?? ''));
}

function themeText(choice, field) {
  const preset = THEME_PRESETS[choice] || THEME_PRESETS.dark;
  const value = preset?.[field];
  return value?.[state.language] || value?.['zh-CN'] || '';
}

function handleLanguageChange() {
  persistLanguage(settingsLanguageSelectEl?.value || 'zh-CN');
  renderLocalizedChrome();
  renderModelPicker();
  renderThemePresetControls();
  renderAgentList({ refreshIdentity: false });
  updateHeader();
  renderHistorySearchPanel();
  renderMessages();
  renderPendingUploads();
  renderCommandMenu();
  renderSettingsPreview();
  renderServiceSettingsForm();
  renderProjectInfo();
  renderManualStartGuide();
}

function setAccordionButtonLabel(button, label) {
  const labelSpan = button?.querySelector('span');
  if (labelSpan) labelSpan.textContent = label;
}

function renderLocalizedChrome() {
  const closeSidebarLabel = t('ui.closeSidebar');
  const refreshLabel = t('ui.refresh');
  const openSettingsLabel = t('ui.openSettings');
  const openSidebarLabel = t('ui.openSidebar');
  const searchLabel = t('ui.search');

  closeSidebarButtonEl?.setAttribute('aria-label', closeSidebarLabel);
  refreshAgentsButtonEl?.setAttribute('aria-label', refreshLabel);
  openSidebarButtonEl?.setAttribute('aria-label', openSidebarLabel);
  headerRefreshButtonEl.textContent = refreshLabel;
  if (!state.activeAgentId) chatSubtitleEl.textContent = t('ui.selectAgent');
  historySearchInputEl.placeholder = state.activeAgentId ? t('ui.searchHistory') : t('ui.searchHistory');
  historySearchSubmitButtonEl.textContent = searchLabel;
  historySearchFromLabelEl.textContent = t('ui.searchDateFrom');
  historySearchToLabelEl.textContent = t('ui.searchDateTo');
  historySearchLimitLabelEl.textContent = t('ui.searchResultLimit');
  historySearchPanelEl?.setAttribute('aria-label', t('ui.historySearch'));
  composerInputEl.placeholder = t('ui.composerPlaceholder');
  attachButtonEl?.setAttribute('aria-label', t('ui.attachMedia'));
  attachButtonEl?.setAttribute('title', t('ui.attachMedia'));
  newContextButtonEl?.setAttribute('aria-label', t('ui.openSlashMenu'));
  renderSendButtonState();
  closeSettingsButtonEl?.setAttribute('aria-label', t('ui.closeSettings'));
  authPasswordInputEl?.setAttribute('placeholder', t('ui.enterPassword'));
  authLoginButtonEl.textContent = t('ui.enterWebChat');
  if (authGateCopyEl) authGateCopyEl.textContent = t('text.authGateCopy');
  authLoginMessageEl.textContent = state.authError || t('status.authLoginHint');
  if (authGateEl?.querySelector('.eyebrow')) authGateEl.querySelector('.eyebrow').textContent = t('ui.accessGate');
  if (authGateEl?.querySelector('h2')) authGateEl.querySelector('h2').textContent = t('ui.enterPassword');
  if (serviceRestartGateEl?.querySelector('.eyebrow')) serviceRestartGateEl.querySelector('.eyebrow').textContent = t('ui.serviceRestart');
  if (serviceRestartGateEl?.querySelector('h2')) serviceRestartGateEl.querySelector('h2').textContent = t('ui.serviceRestarting');
  if (mediaZoomOutButtonEl) mediaZoomOutButtonEl.setAttribute('aria-label', t('ui.zoomOut'));
  renderMediaViewerZoomReadout();
  if (mediaZoomInButtonEl) mediaZoomInButtonEl.setAttribute('aria-label', t('ui.zoomIn'));
  if (mediaViewerImageEl && !state.mediaViewerOpen) mediaViewerImageEl.alt = t('ui.imagePreview');
  if (modelPickerEl) modelPickerEl.setAttribute('aria-label', t('ui.modelPicker'));
  if (modelPickerTitleEl) modelPickerTitleEl.textContent = t('ui.modelPicker');
  if (modelPickerCopyEl) modelPickerCopyEl.textContent = t('text.modelPickerIntro');
  if (modelPickerCurrentLabelEl) modelPickerCurrentLabelEl.textContent = t('ui.currentModel');
  if (closeModelPickerButtonEl) closeModelPickerButtonEl.setAttribute('aria-label', t('ui.closeModelPicker'));
  settingsButtonEl?.querySelectorAll('span')?.[1] && (settingsButtonEl.querySelectorAll('span')[1].textContent = openSettingsLabel);
  settingsPanelEl?.querySelector('.eyebrow') && (settingsPanelEl.querySelector('.eyebrow').textContent = t('ui.workspaceSettings'));
  settingsPanelEl?.querySelector('h3') && (settingsPanelEl.querySelector('h3').textContent = t('ui.settings'));
  setAccordionButtonLabel(settingsContactsTabEl, t('ui.contacts'));
  setAccordionButtonLabel(settingsPreferencesTabEl, t('ui.appearance'));
  setAccordionButtonLabel(settingsAccessTabEl, t('ui.accessAndSecurity'));
  setAccordionButtonLabel(settingsAboutTabEl, t('ui.about'));
  setAccordionButtonLabel(settingsManualStartTabEl, t('ui.manualStart'));

  const appearanceSection = settingsPreferencesSectionEl;
  appearanceSection?.querySelector('.settings-section-title') && (appearanceSection.querySelector('.settings-section-title').textContent = t('ui.appearance'));
  const appearanceCopy = appearanceSection?.querySelector('.settings-section-copy');
  if (appearanceCopy) appearanceCopy.textContent = t('text.appearanceIntro');
  const appearanceLabels = appearanceSection?.querySelectorAll('.settings-field > span');
  if (appearanceLabels?.[0]) appearanceLabels[0].textContent = t('ui.theme');
  if (appearanceLabels?.[1]) appearanceLabels[1].textContent = t('ui.language');
  const appearanceHint = appearanceSection?.querySelector('.settings-field-hint:last-of-type');
  if (appearanceHint) appearanceHint.textContent = t('ui.comingSoonStructure');

  const contactSection = settingsContactsSectionEl;
  contactSection?.querySelector('.settings-section-title') && (contactSection.querySelector('.settings-section-title').textContent = t('ui.contacts'));
  const contactCopy = contactSection?.querySelector('.settings-section-copy');
  if (contactCopy) contactCopy.textContent = t('text.contactsIntro');
  if (settingsPreviewTitleEl && !state.settingsSelectedContactKey) settingsPreviewTitleEl.textContent = t('text.contactPreview');
  if (settingsPreviewSubtitleEl && !state.settingsSelectedContactKey) settingsPreviewSubtitleEl.textContent = t('text.contactPreviewSubtitle');
  if (settingsChooseAvatarButtonEl) settingsChooseAvatarButtonEl.textContent = t('text.chooseLocalImage');
  if (settingsClearAvatarButtonEl) settingsClearAvatarButtonEl.textContent = t('text.clearAvatar');
  if (saveSettingsButtonEl) saveSettingsButtonEl.textContent = t('text.saveContactSettings');

  const contactLabels = contactSection?.querySelectorAll('.settings-field > span');
  if (contactLabels?.[0]) contactLabels[0].textContent = t('text.contactField');
  if (contactLabels?.[1]) contactLabels[1].textContent = t('text.displayName');
  if (contactLabels?.[2]) contactLabels[2].textContent = t('text.avatar');
  settingsDisplayNameInputEl.placeholder = t('text.displayNamePlaceholder');

  const accessSection = settingsAccessSectionEl;
  accessSection?.querySelector('.settings-section-title') && (accessSection.querySelector('.settings-section-title').textContent = t('ui.accessAndSecurity'));
  const accessCopy = accessSection?.querySelector('.settings-section-copy');
  if (accessCopy) accessCopy.textContent = t('text.accessIntro');
  const accessLabels = accessSection?.querySelectorAll('.settings-field > span');
  if (accessLabels?.[0]) accessLabels[0].textContent = t('text.accessMode');
  if (accessLabels?.[2]) accessLabels[2].textContent = t('ui.accessPassword');
  if (accessLabels?.[3]) accessLabels[3].textContent = t('ui.confirmAccessPassword');
  const accessCheckbox = settingsLightAuthToggleEl?.parentElement?.querySelector('span:last-child');
  if (accessCheckbox) accessCheckbox.textContent = t('ui.enableLightAuth');
  settingsLightAuthPasswordInputEl.placeholder = state.language === 'en' ? 'Leave empty to keep the current password' : '留空表示保持当前口令';
  settingsLightAuthPasswordConfirmInputEl.placeholder = state.language === 'en' ? 'Enter the access password again' : '再次输入访问口令';
  settingsNetworkAccessSelectEl?.querySelector('option[value="local"]') && (settingsNetworkAccessSelectEl.querySelector('option[value="local"]').textContent = t('ui.localOnly'));
  settingsNetworkAccessSelectEl?.querySelector('option[value="lan"]') && (settingsNetworkAccessSelectEl.querySelector('option[value="lan"]').textContent = t('ui.lanTailscale'));
  if (saveServiceSettingsButtonEl) saveServiceSettingsButtonEl.textContent = t('ui.saveAccessSettings');
  if (settingsLogoutButtonEl) settingsLogoutButtonEl.textContent = t('ui.logoutAuth');
  if (restartServiceButtonEl) restartServiceButtonEl.textContent = t('ui.restartService');
  const docTitle = settingsAccessSectionEl?.querySelector('.settings-card-muted .settings-section-title');
  if (docTitle) docTitle.textContent = t('text.documentAccessTitle');

  const aboutSection = settingsAboutSectionEl;
  aboutSection?.querySelector('.settings-section-title') && (aboutSection.querySelector('.settings-section-title').textContent = t('text.aboutTitle'));
  const projectLinksTitle = aboutSection?.querySelector('.settings-card .settings-section-title');
  if (projectLinksTitle) projectLinksTitle.textContent = t('ui.projectLinks');
  const aboutHint = aboutSection?.querySelector('.settings-field-hint');
  if (aboutHint) aboutHint.textContent = t('text.shareRepoHint');

  const manualSection = settingsManualStartSectionEl;
  manualSection?.querySelector('.settings-section-title') && (manualSection.querySelector('.settings-section-title').textContent = t('ui.manualStart'));
  const startupLabels = manualSection?.querySelectorAll('.settings-startup-label');
  if (startupLabels?.[0]) startupLabels[0].textContent = t('ui.stepProjectDir');
  if (startupLabels?.[1]) startupLabels[1].textContent = t('ui.stepInstall');
  if (startupLabels?.[2]) startupLabels[2].textContent = t('ui.stepStart');
  if (startupLabels?.[3]) startupLabels[3].textContent = t('ui.stepRestart');

  settingsLanguageSelectEl.value = state.language;
}

async function loadSettings() {
  try {
    const payload = await apiGet('/api/openclaw-webchat/settings');
    state.userProfile = {
      displayName: payload?.userProfile?.displayName || (state.language === 'en' ? 'Me' : '我'),
      avatarUrl: payload?.userProfile?.avatarUrl || null
    };
    state.serviceSettings = normalizeServiceSettings(payload?.serviceSettings);
    state.projectInfo = normalizeProjectInfo(payload?.projectInfo);
    state.authEnabled = Boolean(payload?.authStatus?.enabled || state.serviceSettings.authEnabled);
    state.authenticated = payload?.authStatus?.authenticated !== false;
  } catch {
    state.userProfile = { displayName: state.language === 'en' ? 'Me' : '我', avatarUrl: null };
    state.serviceSettings = normalizeServiceSettings(null);
    state.projectInfo = normalizeProjectInfo(null);
  }

  populateSettingsForm();
}

function renderSendButtonState() {
  if (!sendButtonEl) return;
  const stopping = isActiveSessionStopping();
  const busy = isActiveSessionBusy();
  const stopMode = busy;
  const label = stopMode ? t('ui.stopReply') : t('ui.send');

  sendButtonEl.classList.toggle('stop-state', stopMode);
  sendButtonEl.classList.toggle('busy-state', stopping);
  sendButtonEl.setAttribute('aria-label', label);
  sendButtonEl.setAttribute('title', label);
  sendButtonEl.innerHTML = stopMode ? getStopButtonIconMarkup() : getSendButtonIconMarkup();
}

function getSendButtonIconMarkup() {
  return `
    <svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4.5 11.25L19.5 4.5L14.625 19.5L10.5 13.875L4.5 11.25Z"></path>
      <path d="M10.5 13.875L19.5 4.5"></path>
    </svg>
  `;
}

function getStopButtonIconMarkup() {
  return `
    <svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8.5"></circle>
      <rect x="9" y="9" width="6" height="6" rx="1.6"></rect>
    </svg>
  `;
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

function syncHistorySearchRecentQueries(agentId = state.activeAgentId) {
  if (!agentId) {
    state.historySearchRecentQueries = [];
    return;
  }

  const store = getStoredHistorySearchRecentStore();
  state.historySearchRecentQueries = normalizeHistorySearchRecentQueries(store[agentId]);
}

function recordHistorySearchRecentQuery(agentId, query) {
  const normalized = String(query || '').trim();
  if (!agentId || !normalized) return;

  const store = getStoredHistorySearchRecentStore();
  const existing = normalizeHistorySearchRecentQueries(store[agentId]);
  const next = [
    normalized,
    ...existing.filter((item) => item.toLowerCase() !== normalized.toLowerCase())
  ].slice(0, HISTORY_SEARCH_MAX_RECENTS);

  store[agentId] = next;
  persistHistorySearchRecentStore(store);

  if (state.activeAgentId === agentId) {
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
    const choice = button.dataset.themeChoice || 'dark';
    const theme = THEME_PRESETS[choice] || THEME_PRESETS.dark;
    const nameEl = button.querySelector('.theme-preset-name');
    const tagEl = button.querySelector('.theme-preset-tag');
    const copyEl = button.querySelector('.theme-preset-copy');
    if (nameEl) nameEl.textContent = themeText(choice, 'name');
    if (tagEl) tagEl.textContent = theme?.tag?.[state.language] || theme?.tag?.['zh-CN'] || '';
    if (copyEl) copyEl.textContent = themeText(choice, 'hint');
  });

  if (settingsThemeHintEl) {
    const themeName = themeText(state.themeChoice, 'name');
    const themeHint = themeText(state.themeChoice, 'hint');
    settingsThemeHintEl.textContent = state.language === 'en'
      ? `Current theme: ${themeName}. ${themeHint} ${t('ui.themeHintStored')}`
      : `当前使用 ${themeName}。${themeHint} ${t('ui.themeHintStored')}`;
  }
}

function normalizeServiceSettings(payload) {
  return {
    networkAccess: payload?.networkAccess === 'lan' ? 'lan' : 'local',
    effectiveHost: payload?.effectiveHost || '127.0.0.1',
    nextHost: payload?.nextHost || payload?.effectiveHost || '127.0.0.1',
    hostManagedBy: payload?.hostManagedBy || 'config',
    authEnabled: payload?.authEnabled === true,
    authConfigured: payload?.authConfigured === true,
    documentAccessMode: payload?.documentAccessMode === 'follow-openclaw' ? 'follow-openclaw' : 'follow-openclaw',
    restartRequired: payload?.restartRequired === true,
    restartSupported: payload?.restartSupported === true,
    restartHint: payload?.restartHint || null,
    manualStart: {
      projectDirectoryHint: payload?.manualStart?.projectDirectoryHint || '先进入 Claw WebChat 项目目录',
      installCommand: payload?.manualStart?.installCommand || 'npm install',
      startCommand: payload?.manualStart?.startCommand || 'npm start',
      restartCommand: payload?.manualStart?.restartCommand || null
    }
  };
}

function normalizeProjectInfo(payload) {
  return {
    name: BRAND_NAME,
    summary: payload?.summary || '一个面向个人使用的 Claw WebChat，强调本地优先、长历史、媒体上传和更顺手的 agent 交流体验。',
    githubUrl: payload?.githubUrl || 'https://github.com/memphislee09-source/claw-webchat'
  };
}

async function refreshAuthStatus() {
  try {
    const payload = await apiGetPublic('/api/openclaw-webchat/auth/status');
    state.authEnabled = payload?.enabled === true;
    state.authenticated = payload?.authenticated !== false;
    if (payload?.mode) {
      state.serviceSettings = {
        ...state.serviceSettings,
        networkAccess: payload.mode === 'lan' ? 'lan' : 'local',
        effectiveHost: payload?.effectiveHost || state.serviceSettings.effectiveHost
      };
    }
    state.authError = '';
  } catch (error) {
    state.authEnabled = false;
    state.authenticated = true;
    state.authError = formatError(error);
  }

  renderAuthGate();
}

async function loadAuthenticatedApp({ force = false } = {}) {
  if (state.appReady && !force) return;

  await Promise.all([
    loadSettings(),
    loadCommandCatalog()
  ]);
  await refreshAgents({ autoOpen: true });
  startPolling();
  state.appReady = true;
  renderAuthGate();
  syncComposerInteractivity();
}

function lockAppForAuth() {
  state.appReady = false;
  closeModelPicker({ preserveData: false });
  releasePendingUploads(state.pendingUploads);
  state.agents = [];
  state.activeAgentId = null;
  state.activeSessionKey = null;
  state.messages = [];
  state.pendingUploads = [];
  state.nextBefore = null;
  state.hasMore = false;
  clearInterval(state.pollingTimer);
  state.pollingTimer = null;
  renderAgentList({ refreshIdentity: false });
  renderMessages();
  updateHeader();
  renderAuthGate();
  renderServiceRestartGate();
  syncComposerInteractivity();
  showStatus('已开启访问口令，请先完成认证。', 'info');
}

function renderAuthGate() {
  const open = state.authEnabled && !state.authenticated;
  authGateEl?.classList.toggle('hidden', !open);
  authGateEl?.setAttribute('aria-hidden', open ? 'false' : 'true');
  appShellEl?.classList.toggle('auth-locked', open);

  if (!authLoginButtonEl || !authLoginMessageEl) return;
  authLoginButtonEl.disabled = state.authBusy;
  authPasswordInputEl.disabled = state.authBusy;
  authLoginMessageEl.textContent = state.authError || t('status.authLoginHint');
}

function renderServiceRestartGate() {
  const open = state.restartingService;
  serviceRestartGateEl?.classList.toggle('hidden', !open);
  serviceRestartGateEl?.setAttribute('aria-hidden', open ? 'false' : 'true');
  appShellEl?.classList.toggle('service-restarting', open);
  if (serviceRestartMessageEl) {
    serviceRestartMessageEl.textContent = state.serviceRestartMessage || t('status.restartingService');
  }
}

async function handleAuthLoginSubmit(event) {
  event.preventDefault();
  const password = authPasswordInputEl?.value || '';
  if (!password) {
    state.authError = t('status.passwordRequired');
    renderAuthGate();
    return;
  }

  state.authBusy = true;
  state.authError = '';
  renderAuthGate();

  try {
    await apiPostPublic('/api/openclaw-webchat/auth/login', { password });
    if (authPasswordInputEl) authPasswordInputEl.value = '';
    state.authBusy = false;
    await refreshAuthStatus();
    await loadAuthenticatedApp({ force: true });
    showStatus(t('status.authSuccess'), 'success');
  } catch (error) {
    state.authBusy = false;
    state.authError = formatError(error);
    renderAuthGate();
  }
}

async function refreshAgents({ autoOpen = false, refreshCurrent = false } = {}) {
  const previousActive = state.activeAgentId;
  const previousActiveAgent = previousActive
    ? state.agents.find((item) => item.agentId === previousActive) || null
    : null;
  const data = await apiGet('/api/openclaw-webchat/agents');
  state.agents = Array.isArray(data.agents) ? data.agents : [];
  renderAgentList({ refreshIdentity: false });
  updateHeader();
  populateSettingsForm();
  syncComposerInteractivity();

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

function renderAgentList({ refreshIdentity = true } = {}) {
  if (!state.agents.length) {
    agentListEl.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'empty-tip';
    empty.textContent = t('status.noAgents');
    agentListEl.append(empty);
    return;
  }

  agentListEl.querySelectorAll('.empty-tip').forEach((node) => node.remove());
  const existing = new Map(Array.from(agentListEl.querySelectorAll('.agent-card')).map((button) => [button.dataset.agentId, button]));

  for (const agent of state.agents) {
    const button = existing.get(agent.agentId) || createAgentCardElement(agent);
    existing.delete(agent.agentId);
    updateAgentCardElement(button, agent, {
      refreshIdentity: refreshIdentity || !button.isConnected
    });
    agentListEl.append(button);
  }

  existing.forEach((button) => button.remove());
}

function createAgentCardElement(agent) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.agentId = agent.agentId;
  button.className = 'agent-card';
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
  updateAgentCardElement(button, agent, { refreshIdentity: true });
  return button;
}

function updateAgentCardElement(button, agent, { refreshIdentity = true } = {}) {
  const refs = button._agentRefs;
  if (!refs) return;

  button.classList.toggle('active', agent.agentId === state.activeAgentId);
  button.dataset.agentId = agent.agentId;

  if (refreshIdentity) {
    updateAgentCardIdentity(button, agent);
  }

  const presenceState = normalizePresence(agent.presence);
  refs.presence.className = `presence-dot ${presenceState}`;
  refs.presence.title = formatPresenceLabel(agent.presence);
  refs.presenceLabel.textContent = formatPresenceLabel(agent.presence);
  refs.summary.textContent = agent.summary || t('status.clickToOpen');
  refs.time.textContent = formatAgentTimestamp(agent.lastMessageAt);
}

function updateAgentCardIdentity(button, agent) {
  const refs = button._agentRefs;
  if (!refs) return;

  const nextLabel = agent.name || agent.agentId;
  const nextAvatarUrl = agent.avatarUrl || '';
  const nextFallback = (nextLabel || '?').slice(0, 1).toUpperCase();

  refs.name.textContent = nextLabel;

  if (button.dataset.avatarUrl === nextAvatarUrl && button.dataset.agentLabel === nextLabel) {
    return;
  }

  const nextAvatar = createAvatarElement({
    className: 'agent-avatar',
    avatarUrl: agent.avatarUrl,
    label: nextLabel,
    fallbackText: nextFallback
  });
  refs.avatar.replaceWith(nextAvatar);
  refs.avatar = nextAvatar;
  button.dataset.avatarUrl = nextAvatarUrl;
  button.dataset.agentLabel = nextLabel;
}

async function openAgent(agentId, { forceReload = false, preserveScrollBottom = false } = {}) {
  if (!agentId) return;
  if (state.selectedOpenPromise && state.activeAgentId === agentId && !forceReload) return state.selectedOpenPromise;
  if (state.activeAgentId !== agentId) {
    closeModelPicker({ preserveData: false });
    resetHistorySearch({ keepOpen: false });
  }

  const requestId = state.openRequestId + 1;
  state.openRequestId = requestId;
  state.activeAgentId = agentId;
  syncHistorySearchRecentQueries(agentId);
  renderAgentList({ refreshIdentity: false });
  updateHeader();
  populateSettingsForm();
  showStatus(t('status.openingSession'), 'info');
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
    if (!preserveScrollBottom) {
      maybeScrollMessagesToBottom(true);
    } else {
      maybeScrollMessagesToBottom();
    }
    showStatus(response.created ? t('status.createdTimeline') : t('status.restoredSession'), 'success');
  })();

  state.selectedOpenPromise = promise;

  try {
    await promise;
  } finally {
    state.selectedOpenPromise = null;
  }
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
  state.historySearchFromDate = '';
  state.historySearchToDate = '';
  state.historySearchActiveMessageId = null;
  state.historySearchShowingRecents = false;
  state.historySearchOpen = keepOpen ? state.historySearchOpen : false;
  if (historySearchInputEl) {
    historySearchInputEl.value = '';
  }
  if (historySearchFromInputEl) {
    historySearchFromInputEl.value = '';
  }
  if (historySearchToInputEl) {
    historySearchToInputEl.value = '';
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
  if (historySearchFromInputEl && historySearchFromInputEl.value !== state.historySearchFromDate) {
    historySearchFromInputEl.value = state.historySearchFromDate;
  }
  if (historySearchToInputEl && historySearchToInputEl.value !== state.historySearchToDate) {
    historySearchToInputEl.value = state.historySearchToDate;
  }
  if (historySearchLimitSelectEl && String(historySearchLimitSelectEl.value) !== String(state.historySearchLimit)) {
    historySearchLimitSelectEl.value = String(state.historySearchLimit);
  }

  if (historySearchInputEl) {
    historySearchInputEl.disabled = !state.activeAgentId;
    historySearchInputEl.placeholder = t('ui.searchHistory');
  }
  historySearchFromInputEl.disabled = !state.activeAgentId || state.historySearchLoading;
  historySearchToInputEl.disabled = !state.activeAgentId || state.historySearchLoading;
  historySearchLimitSelectEl.disabled = !state.activeAgentId || state.historySearchLoading;

  historySearchSubmitButtonEl.disabled = !state.activeAgentId || state.historySearchLoading;

  if (!state.historySearchOpen) return;

  if (!state.activeAgentId) {
    historySearchMetaEl.textContent = t('status.searchNeedAgent');
  } else if (state.historySearchLoading) {
    historySearchMetaEl.textContent = t('status.searchingHistory');
  } else if (state.historySearchError) {
    historySearchMetaEl.textContent = state.historySearchError;
  } else if (state.historySearchShowingRecents && state.historySearchRecentQueries.length) {
    historySearchMetaEl.textContent = '';
  } else if (!state.historySearchQuery) {
    historySearchMetaEl.textContent = state.historySearchRecentQueries.length
      ? ''
      : t('status.searchPrompt');
  } else {
    const summary = t('status.searchResultsSummary', {
      total: state.historySearchTotal,
      overflow: state.historySearchTotal > state.historySearchResults.length
        ? t('status.searchResultsOverflow', { shown: state.historySearchResults.length })
        : t('status.searchResultsEnd')
    });
    const filters = describeHistorySearchFilters();
    historySearchMetaEl.textContent = filters ? `${summary} ${t('status.searchFiltersActive', { filters })}` : summary;
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
    empty.textContent = t('status.noSearchResults');
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
  role.textContent = getHistorySearchResultSpeakerName(result.role);

  const time = document.createElement('div');
  time.className = 'history-search-time';
  time.textContent = formatSearchTimestamp(result.createdAt);

  top.append(role, time);

  const excerpt = document.createElement('div');
  excerpt.className = 'history-search-excerpt';
  excerpt.textContent = result.excerpt || result.summary || t('status.searchHitMessage');

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
  if (role === 'user') {
    return state.userProfile.displayName || (state.language === 'en' ? 'Me' : '我');
  }

  if (role === 'assistant') {
    const active = getActiveAgent();
    return active?.name || active?.agentId || 'Assistant';
  }

  if (role === 'marker') {
    return t('status.systemMarker');
  }

  return String(role || t('status.messageFallback'));
}

function handleHistorySearchFocus() {
  if (!state.activeAgentId) return;
  syncHistorySearchRecentQueries();
  state.historySearchShowingRecents = state.historySearchRecentQueries.length > 0;
  setHistorySearchOpen(true);
}

function handleHistorySearchFiltersChange() {
  if (!state.activeAgentId) return;

  state.historySearchFromDate = normalizeHistorySearchDateValue(historySearchFromInputEl?.value);
  state.historySearchToDate = normalizeHistorySearchDateValue(historySearchToInputEl?.value);
  state.historySearchLimit = readHistorySearchLimit(historySearchLimitSelectEl?.value);
  state.historySearchShowingRecents = !String(state.historySearchQuery || '').trim();
  setHistorySearchOpen(true);

  if (!isHistorySearchDateRangeValid(state.historySearchFromDate, state.historySearchToDate)) {
    state.historySearchRequestId += 1;
    state.historySearchLoading = false;
    state.historySearchResults = [];
    state.historySearchTotal = 0;
    state.historySearchError = t('status.searchDateRangeInvalid');
    renderHistorySearchPanel();
    return;
  }

  state.historySearchError = '';
  if (!state.historySearchQuery) {
    renderHistorySearchPanel();
    return;
  }

  void executeHistorySearch(state.historySearchQuery);
}

function applyHistorySearchRecentQuery(query) {
  if (!historySearchInputEl) return;
  historySearchInputEl.value = query;
  state.historySearchQuery = query;
  state.historySearchShowingRecents = false;
  executeHistorySearch(query);
}

function handleHistorySearchInput() {
  if (!state.activeAgentId) return;

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
  if (!state.activeAgentId) return;
  setHistorySearchOpen(true);

  const query = historySearchInputEl?.value.trim() || '';
  state.historySearchShowingRecents = false;
  await executeHistorySearch(query);
}

async function executeHistorySearch(query) {
  const normalizedQuery = String(query || '').trim();
  const fromDate = normalizeHistorySearchDateValue(historySearchFromInputEl?.value ?? state.historySearchFromDate);
  const toDate = normalizeHistorySearchDateValue(historySearchToInputEl?.value ?? state.historySearchToDate);
  const limit = readHistorySearchLimit(historySearchLimitSelectEl?.value ?? state.historySearchLimit);
  state.historySearchQuery = normalizedQuery;
  state.historySearchError = '';
  state.historySearchFromDate = fromDate;
  state.historySearchToDate = toDate;
  state.historySearchLimit = limit;
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

  if (!isHistorySearchDateRangeValid(fromDate, toDate)) {
    state.historySearchResults = [];
    state.historySearchTotal = 0;
    state.historySearchLoading = false;
    state.historySearchError = t('status.searchDateRangeInvalid');
    renderHistorySearchPanel();
    return;
  }

  const requestId = state.historySearchRequestId + 1;
  state.historySearchRequestId = requestId;
  state.historySearchResults = [];
  state.historySearchTotal = 0;
  state.historySearchLoading = true;
  renderHistorySearchPanel();

  try {
    const params = new URLSearchParams({
      q: normalizedQuery,
      limit: String(limit)
    });
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    const payload = await apiGet(`/api/openclaw-webchat/agents/${encodeURIComponent(state.activeAgentId)}/history/search?${params.toString()}`);
    if (requestId !== state.historySearchRequestId || !state.activeAgentId) return;
    state.historySearchResults = Array.isArray(payload?.results) ? payload.results : [];
    state.historySearchTotal = Number(payload?.total) || state.historySearchResults.length;
    recordHistorySearchRecentQuery(state.activeAgentId, normalizedQuery);
  } catch (error) {
    if (requestId !== state.historySearchRequestId) return;
    state.historySearchResults = [];
    state.historySearchTotal = 0;
    state.historySearchError = t('status.searchFailed', { error: formatError(error) });
  } finally {
    if (requestId === state.historySearchRequestId) {
      state.historySearchLoading = false;
      renderHistorySearchPanel();
    }
  }
}

async function jumpToHistorySearchResult(messageId) {
  if (!messageId || !state.activeAgentId) return;
  showStatus(t('status.locatingHit'), 'info');

  const found = await ensureHistoryMessageLoaded(messageId);
  if (!found) {
    showStatus(t('status.locateFailed'), 'error');
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
  showStatus(t('status.locateSuccess'), 'success');
}

async function ensureHistoryMessageLoaded(messageId) {
  if (state.messages.some((item) => item.id === messageId)) return true;
  if (!state.activeAgentId) return false;

  const targetAgentId = state.activeAgentId;
  const targetSessionKey = state.activeSessionKey;

  while (!state.messages.some((item) => item.id === messageId) && state.hasMore && state.nextBefore) {
    const data = await apiGet(`/api/openclaw-webchat/agents/${encodeURIComponent(targetAgentId)}/history?limit=30&before=${encodeURIComponent(state.nextBefore)}`);
    if (!isOperationContextActive({ agentId: targetAgentId, sessionKey: targetSessionKey })) return false;
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
  const shouldStickToBottom = shouldKeepConversationPinnedAfterRender();
  messageListEl.classList.toggle('showing-history-target', Boolean(state.historySearchActiveMessageId));
  messageListEl.innerHTML = '';

  if (!state.messages.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <div class="eyebrow">${BRAND_NAME}</div>
      <h3>${t('status.emptyTimelineTitle')}</h3>
      <p class="empty-tip">${t('status.emptyTimelineTip')}</p>
    `;
    messageListEl.append(empty);
    if (shouldStickToBottom) {
      scheduleConversationPinnedBottomSync();
    }
    return;
  }

  for (const message of state.messages) {
    if (message.role === 'marker') {
      const row = document.createElement('div');
      row.className = 'marker-row';
      const chip = document.createElement('div');
      chip.className = 'marker-chip';
      chip.textContent = message.label || t('status.contextReset');
      row.append(chip);
      messageListEl.append(row);
      continue;
    }

    const row = document.createElement('div');
    row.className = `message-row ${message.role}${message.id === state.historySearchActiveMessageId ? ' search-target' : ''}`;
    row.dataset.messageId = message.id;

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

    if (message.id === state.historySearchActiveMessageId && state.historySearchQuery) {
      highlightSearchTextInElement(bubble, state.historySearchQuery);
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

  if (shouldStickToBottom) {
    scheduleConversationPinnedBottomSync();
  }
}

function highlightSearchTextInElement(element, query) {
  const terms = collectHistorySearchHighlightTerms(query);
  if (!element || !terms.length) return;

  const matcher = terms
    .map((item) => escapeRegExp(item))
    .sort((a, b) => b.length - a.length)
    .join('|');
  if (!matcher) return;

  const splitMatcher = new RegExp(`(${matcher})`, 'giu');
  const testMatcher = new RegExp(matcher, 'iu');
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

function collectHistorySearchHighlightTerms(query) {
  const normalizedQuery = String(query || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!normalizedQuery) return [];

  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  return Array.from(new Set([normalizedQuery, ...terms]));
}

function normalizeHistorySearchDateValue(value) {
  const normalized = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
}

function readHistorySearchLimit(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_HISTORY_SEARCH_LIMIT;
  if (parsed <= 20) return 20;
  if (parsed >= 100) return 100;
  return 50;
}

function isHistorySearchDateRangeValid(fromDate, toDate) {
  if (!fromDate || !toDate) return true;
  return fromDate <= toDate;
}

function describeHistorySearchFilters() {
  const parts = [];
  if (state.historySearchFromDate && state.historySearchToDate) {
    parts.push(`${t('ui.searchDateFrom')} ${state.historySearchFromDate} - ${state.historySearchToDate}`);
  } else if (state.historySearchFromDate) {
    parts.push(`${t('ui.searchDateFrom')} ${state.historySearchFromDate}`);
  } else if (state.historySearchToDate) {
    parts.push(`${t('ui.searchDateTo')} ${state.historySearchToDate}`);
  }
  parts.push(`${t('ui.searchResultLimit')} ${state.historySearchLimit}`);
  return parts.join(' · ');
}

function renderMediaBlock(block, bubble = null) {
  if (block.invalid) {
    return createInvalidMediaCard(block.name || block.type || t('status.fileLabel'), block.invalidReason || t('status.fileMissing'));
  }

  if (block.type === 'image') {
    const wrapper = document.createElement('button');
    wrapper.type = 'button';
    wrapper.className = 'message-image-button';
    wrapper.setAttribute('aria-label', t('status.viewImage'));
    wrapper.addEventListener('click', () => openMediaViewer(block));

    const image = document.createElement('img');
    image.className = 'message-image';
    image.src = block.url;
    image.alt = block.name || t('ui.imagePreview');
    image.loading = 'lazy';
    keepMessagesPinnedOnMediaLoad(image, 'load');
    bindVisualMediaWidth(bubble, wrapper, image, 'load');
    image.addEventListener('error', () => wrapper.replaceWith(createInvalidMediaCard(block.name || t('ui.imagePreview'), t('status.imageLoadFailed'))));
    wrapper.append(image);
    return wrapper;
  }

  if (block.type === 'audio') {
    const wrapper = createMediaCard(block, t('status.audioLabel'));
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.preload = 'metadata';
    audio.src = block.url;
    keepMessagesPinnedOnMediaLoad(audio, 'loadedmetadata');
    audio.addEventListener('error', () => wrapper.replaceWith(createInvalidMediaCard(block.name || t('status.audioLabel'), t('status.audioLoadFailed'))));
    wrapper.append(audio);

    if (block.transcriptStatus === 'ready' && block.transcriptText) {
      wrapper.append(createMediaNote(t('status.transcriptText'), block.transcriptText));
    } else if (block.transcriptStatus === 'failed') {
      wrapper.append(createMediaNote(t('status.transcriptStatus'), block.transcriptError || t('status.transcriptFailedKeepAudio'), true));
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
    video.playsInline = true;
    video.src = block.url;
    keepMessagesPinnedOnMediaLoad(video, 'loadedmetadata');
    bindVisualMediaWidth(bubble, wrapper, video, 'loadedmetadata');
    video.addEventListener('error', () => wrapper.replaceWith(createInvalidMediaCard(block.name || t('status.videoLabel'), t('status.videoLoadFailed'))));
    wrapper.append(video);
    attachVideoPreview(wrapper, video, block);
    return wrapper;
  }

  const link = document.createElement('a');
  link.className = 'file-card';
  link.href = block.url;
  link.target = '_blank';
  link.rel = 'noreferrer';

  const title = document.createElement('div');
  title.className = 'file-title';
  title.textContent = block.name || t('status.fileLabel');

  const meta = document.createElement('div');
  meta.className = 'file-meta';
  meta.textContent = `${t('status.clickToOpenFile')}${block.sizeBytes ? ` · ${formatBytes(block.sizeBytes)}` : ''}`;

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

function attachVideoPreview(wrapper, video, block) {
  if (!wrapper || !video) return;

  const previewButton = document.createElement('button');
  previewButton.type = 'button';
  previewButton.className = 'message-video-preview';
  previewButton.setAttribute('aria-label', `${t('status.playVideo')} ${block?.name || t('status.videoLabel')}`.trim());

  const previewImage = document.createElement('img');
  previewImage.className = 'message-video-preview-image';
  previewImage.alt = block?.name || t('status.videoLabel');
  previewImage.hidden = true;

  const previewOverlay = document.createElement('div');
  previewOverlay.className = 'message-video-preview-overlay';

  const previewMeta = document.createElement('div');
  previewMeta.className = 'message-video-preview-meta';

  const previewTitle = document.createElement('div');
  previewTitle.className = 'message-video-preview-title';
  previewTitle.textContent = block?.name || t('status.videoLabel');

  const previewAction = document.createElement('div');
  previewAction.className = 'message-video-preview-action';
  previewAction.textContent = t('status.playVideo');

  previewMeta.append(previewTitle, previewAction);
  previewButton.append(previewImage, previewOverlay, previewMeta);
  wrapper.append(previewButton);

  let dismissed = false;
  let previewReady = false;

  const hidePreview = () => {
    dismissed = true;
    wrapper.classList.add('preview-dismissed');
  };

  const showPreview = () => {
    if (dismissed) return;
    wrapper.classList.remove('preview-dismissed');
  };

  previewButton.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    hidePreview();
    try {
      await video.play();
    } catch {
      dismissed = false;
      showPreview();
    }
  });

  video.addEventListener('play', hidePreview);
  video.addEventListener('seeking', () => {
    if (!dismissed && video.currentTime > 0.01) hidePreview();
  });

  const applyPreviewFrame = () => {
    if (previewReady) return;
    const snapshot = captureVideoFrameDataUrl(video);
    if (!snapshot) return;
    previewReady = true;
    previewImage.src = snapshot;
    previewImage.hidden = false;
    wrapper.classList.add('has-preview-image');
    showPreview();
  };

  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    requestAnimationFrame(applyPreviewFrame);
  } else {
    video.addEventListener('loadeddata', applyPreviewFrame, { once: true });
  }
}

function captureVideoFrameDataUrl(video) {
  const width = Number(video?.videoWidth) || 0;
  const height = Number(video?.videoHeight) || 0;
  if (!width || !height) return null;

  const maxEdge = 960;
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const context = canvas.getContext('2d');
  if (!context) return null;

  try {
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch {
    return null;
  }
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
  if (!state.activeSessionKey) return;
  if (isActiveSessionBusy()) {
    if (!isActiveSessionStopping()) {
      await stopActiveSessionReply();
    }
    return;
  }

  const targetSessionKey = state.activeSessionKey;
  const targetAgentId = state.activeAgentId;
  const context = { agentId: targetAgentId, sessionKey: targetSessionKey };
  state.stopRequestedSessionKeys.delete(targetSessionKey);

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
    if (isSessionStopRequested(targetSessionKey)) {
      state.stopRequestedSessionKeys.delete(targetSessionKey);
      endSessionActivity(targetSessionKey);
      showContextStatus(context, t('status.replyStopped'), 'success');
      return;
    }
  } catch (error) {
    state.stopRequestedSessionKeys.delete(targetSessionKey);
    endSessionActivity(targetSessionKey);
    showContextStatus(context, t('status.attachmentFailed', { error: formatError(error) }), 'error');
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
  maybeScrollMessagesToBottom(true);

  try {
    const response = await apiPost(`/api/openclaw-webchat/sessions/${encodeURIComponent(targetSessionKey)}/send`, {
      text,
      blocks: uploadedBlocks
    });
    if (response?.message && isOperationContextActive(context)) state.messages.push(response.message);
    releasePendingUploads(draftAttachments);
    if (isOperationContextActive(context)) {
      renderMessages();
      maybeScrollMessagesToBottom();
    }
    showContextStatus(context, response?.aborted ? t('status.replyStopped') : t('status.sendDone'), 'success');
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
    showContextStatus(context, t('status.sendFailed', { error: formatError(error) }), 'error');
  } finally {
    state.stopRequestedSessionKeys.delete(targetSessionKey);
    endSessionActivity(targetSessionKey);
    if (isOperationContextActive(context)) {
      renderMessages();
      maybeScrollMessagesToBottom();
    }
  }
}

async function stopActiveSessionReply() {
  const targetSessionKey = state.activeSessionKey;
  if (!targetSessionKey || isActiveSessionStopping()) return;

  const context = { agentId: state.activeAgentId, sessionKey: targetSessionKey };
  state.stopRequestedSessionKeys.add(targetSessionKey);
  state.stoppingSessionKeys.add(targetSessionKey);
  syncComposerInteractivity();
  showContextStatus(context, t('status.stoppingReply'), 'info');

  try {
    await apiPost(`/api/openclaw-webchat/sessions/${encodeURIComponent(targetSessionKey)}/stop`, {});
    endSessionActivity(targetSessionKey);
    setSessionPresenceLocally(targetSessionKey, 'idle');
    renderMessages();
    maybeScrollMessagesToBottom();
    showContextStatus(context, t('status.replyStopped'), 'success');
    await refreshAgents({ autoOpen: false });
  } catch (error) {
    showContextStatus(context, t('status.replyStopFailed', { error: formatError(error) }), 'error');
  } finally {
    state.stoppingSessionKeys.delete(targetSessionKey);
    syncComposerInteractivity();
  }
}

async function handleFileSelection(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  const additions = [];
  for (const file of files) {
    const kind = detectAttachmentKind(file);
    if (!kind) {
      showStatus(t('status.uploadOnlyImageAudio', { name: file.name }), 'error');
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
    { name: '/new', description: t('command./new') },
    { name: '/reset', description: t('command./reset') },
    { name: '/model', description: t('command./model'), args: '<name>' },
    { name: '/models', description: t('command./models'), args: '<name>' },
    { name: '/think', description: t('command./think'), args: '<level>' },
    { name: '/fast', description: t('command./fast'), args: '<status|on|off>' },
    { name: '/verbose', description: t('command./verbose'), args: '<on|off|full>' },
    { name: '/compact', description: t('command./compact') },
    { name: '/help', description: t('command./help') }
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
    empty.textContent = t('status.noLocalCommands');
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
      section.append(createCommandMenuItem(localizeCommandItem(item)));
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
  if (category === 'session') return t('command.session');
  if (category === 'model') return t('command.model');
  return t('command.tools');
}

function localizeCommandItem(item) {
  if (!item) return item;
  return {
    ...item,
    description: t(`command.${item.name}`) || item.description || ''
  };
}

async function executeSlashCommand(command) {
  if (!state.activeSessionKey || isActiveSessionBusy()) return;
  if (shouldOpenModelPicker(command)) {
    await openModelPicker();
    return;
  }
  const targetSessionKey = state.activeSessionKey;
  const targetAgentId = state.activeAgentId;
  const context = { agentId: targetAgentId, sessionKey: targetSessionKey };
  beginSessionActivity(targetSessionKey);
  showContextStatus(context, t('status.executingCommand', { name: command.split(/\s+/, 1)[0] }), 'info');

  try {
    const response = await apiPost(`/api/openclaw-webchat/sessions/${encodeURIComponent(targetSessionKey)}/command`, { command });
    if (response?.message && isOperationContextActive(context)) state.messages.push(response.message);
    if (isOperationContextActive(context)) {
      renderMessages();
      maybeScrollMessagesToBottom(true);
    }
    showContextStatus(context, buildSlashCommandSuccessMessage(command), 'success');
    await refreshAgents({ autoOpen: false });
  } catch (error) {
    showContextStatus(context, t('status.commandFailed', { error: formatError(error) }), 'error');
  } finally {
    endSessionActivity(targetSessionKey);
    if (isOperationContextActive(context)) {
      renderMessages();
    }
  }
}

function buildSlashCommandSuccessMessage(command) {
  const name = getSlashCommandName(command);
  if (name === '/new' || name === '/reset') return t('status.commandResetDone');
  if (name === '/compact') return t('status.commandCompactDone');
  return t('status.commandDone', { name });
}

function normalizeSlashCommandName(command) {
  const raw = String(command || '').trim().toLowerCase();
  if (!raw) return '';
  return raw.startsWith('/') ? raw : `/${raw}`;
}

function parseSlashCommandInput(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed.startsWith('/')) return null;
  const body = trimmed.slice(1);
  const firstSeparator = body.search(/[\s:]/u);
  const rawName = firstSeparator === -1 ? body : body.slice(0, firstSeparator);
  let remainder = firstSeparator === -1 ? '' : body.slice(firstSeparator).trimStart();
  if (remainder.startsWith(':')) remainder = remainder.slice(1).trimStart();
  const name = normalizeSlashCommandName(rawName);
  if (!name || name === '/') return null;
  return {
    name,
    args: remainder.trim()
  };
}

function getSlashCommandName(text) {
  return parseSlashCommandInput(text)?.name || '';
}

function isWhitelistedSlash(commandName) {
  return state.allowedCommands.has(normalizeSlashCommandName(commandName));
}

function shouldOpenModelPicker(command) {
  const parsed = parseSlashCommandInput(command);
  if (!parsed) return false;
  if (parsed.name !== '/model' && parsed.name !== '/models') return false;
  return !parsed.args;
}

function updateHeader() {
  const active = getActiveAgent();
  chatTitleEl.textContent = active?.name || BRAND_NAME;
  chatSubtitleEl.textContent = active
    ? `${active.hasSession ? t('status.timelineLongLived') : t('status.clickToCreate')} · ${active.summary || t('status.noSummary')}`
    : t('ui.selectAgent');
  headerPresenceEl.className = `presence-dot ${normalizePresence(active?.presence || 'idle')}`;
  if (!active) {
    if (state.modelPickerOpen) {
      closeModelPicker({ preserveData: false });
    }
    state.historySearchOpen = false;
    state.historySearchRecentQueries = [];
    state.historySearchShowingRecents = false;
  }
  renderHistorySearchPanel();
}

function normalizeModelOption(option) {
  const model = String(option?.model || '').trim();
  if (!model) return null;
  const provider = String(option?.provider || '').trim() || 'default';
  const name = String(option?.name || '').trim();
  return {
    provider,
    model,
    label: String(option?.label || `${provider}/${model}`).trim() || `${provider}/${model}`,
    name: name || null,
    reasoning: option?.reasoning === true,
    input: Array.isArray(option?.input) ? option.input.map((item) => String(item || '').trim()).filter(Boolean) : [],
    available: option?.available !== false
  };
}

function isSameModelOption(left, right) {
  if (!left || !right) return false;
  return left.provider === right.provider && left.model === right.model;
}

function closeModelPicker({ preserveData = true } = {}) {
  state.modelPickerOpen = false;
  state.modelPickerLoading = false;
  state.modelPickerSwitchingLabel = '';
  if (!preserveData) {
    state.modelPickerError = '';
    state.modelPickerCurrent = null;
    state.modelPickerOptions = [];
  }
  renderModelPicker();
}

async function openModelPicker() {
  if (!state.activeSessionKey || isActiveSessionBusy()) return;
  const targetSessionKey = state.activeSessionKey;

  state.modelPickerOpen = true;
  state.modelPickerLoading = true;
  state.modelPickerError = '';
  state.modelPickerCurrent = null;
  state.modelPickerOptions = [];
  state.modelPickerSwitchingLabel = '';
  renderModelPicker();
  showStatus(t('status.loadingModelOptions'), 'info');

  try {
    const payload = await apiGet(`/api/openclaw-webchat/sessions/${encodeURIComponent(targetSessionKey)}/model-options`);
    if (state.activeSessionKey !== targetSessionKey) return;
    state.modelPickerCurrent = normalizeModelOption(payload?.current);
    state.modelPickerOptions = Array.isArray(payload?.models)
      ? payload.models.map(normalizeModelOption).filter(Boolean)
      : [];
    state.modelPickerLoading = false;
    state.modelPickerError = state.modelPickerOptions.length ? '' : t('status.noAvailableModels');
    renderModelPicker();
  } catch (error) {
    if (state.activeSessionKey !== targetSessionKey) return;
    state.modelPickerLoading = false;
    state.modelPickerError = t('status.modelOptionsFailed', { error: formatError(error) });
    renderModelPicker();
    showStatus(state.modelPickerError, 'error');
  }
}

function renderModelPicker() {
  if (!modelPickerEl || !modelPickerCurrentEl || !modelPickerListEl || !modelPickerMessageEl) return;

  const open = state.modelPickerOpen;
  modelPickerEl.hidden = !open;
  modelPickerEl.classList.toggle('hidden', !open);
  modelPickerEl.setAttribute('aria-hidden', open ? 'false' : 'true');

  const currentLabel = state.modelPickerCurrent?.label
    || (state.modelPickerLoading ? t('status.loadingModelOptions') : '—');
  modelPickerCurrentEl.textContent = currentLabel;
  modelPickerCurrentEl.classList.toggle('muted', state.modelPickerCurrent?.available === false);

  const message = state.modelPickerError
    || (state.modelPickerCurrent?.available === false ? t('text.modelPickerCurrentMissing') : '')
    || (state.modelPickerSwitchingLabel ? t('status.switchingModel', { model: state.modelPickerSwitchingLabel }) : '')
    || (state.modelPickerLoading ? t('status.loadingModelOptions') : t('text.modelPickerIntro'));
  modelPickerMessageEl.textContent = message;
  modelPickerMessageEl.classList.toggle('error', Boolean(state.modelPickerError));

  if (closeModelPickerButtonEl) {
    closeModelPickerButtonEl.disabled = Boolean(state.modelPickerSwitchingLabel);
  }
  modelPickerListEl.innerHTML = '';

  if (!state.modelPickerOptions.length) {
    const empty = document.createElement('div');
    empty.className = 'model-picker-empty';
    empty.textContent = state.modelPickerLoading ? t('status.loadingModelOptions') : (state.modelPickerError || t('status.noAvailableModels'));
    modelPickerListEl.append(empty);
    return;
  }

  for (const option of state.modelPickerOptions) {
    modelPickerListEl.append(createModelPickerOption(option));
  }
}

function createModelPickerOption(option) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'model-picker-option';
  button.dataset.provider = option.provider;
  button.dataset.model = option.model;

  const isCurrent = isSameModelOption(option, state.modelPickerCurrent);
  const isSwitching = Boolean(state.modelPickerSwitchingLabel) && state.modelPickerSwitchingLabel === option.label;
  button.classList.toggle('active', isCurrent);
  button.disabled = state.modelPickerLoading || Boolean(state.modelPickerSwitchingLabel);
  button.setAttribute('aria-pressed', isCurrent ? 'true' : 'false');

  const textWrap = document.createElement('span');
  textWrap.className = 'model-picker-option-text';

  const label = document.createElement('span');
  label.className = 'model-picker-option-label';
  label.textContent = option.label;

  const meta = document.createElement('span');
  meta.className = 'model-picker-option-meta';
  meta.textContent = option.name && option.name !== option.label ? option.name : option.model;

  const badge = document.createElement('span');
  badge.className = 'model-picker-option-badge';
  badge.textContent = isSwitching
    ? (state.language === 'en' ? 'Switching' : '切换中')
    : (isCurrent ? t('ui.currentModel') : (state.language === 'en' ? 'Available' : '可切换'));

  textWrap.append(label, meta);
  button.append(textWrap, badge);
  return button;
}

function handleModelPickerBackdropClick(event) {
  if (event.target !== modelPickerEl) return;
  if (state.modelPickerSwitchingLabel) return;
  closeModelPicker();
}

async function handleModelPickerOptionClick(event) {
  const button = event.target.closest('.model-picker-option');
  if (!button || !state.modelPickerOpen) return;
  const provider = button.dataset.provider;
  const model = button.dataset.model;
  const option = state.modelPickerOptions.find((item) => item.provider === provider && item.model === model);
  if (!option || isSameModelOption(option, state.modelPickerCurrent)) return;
  await switchSessionModel(option);
}

async function switchSessionModel(option) {
  if (!state.activeSessionKey) return;
  const targetSessionKey = state.activeSessionKey;
  const targetLabel = option.label || `${option.provider}/${option.model}`;

  state.modelPickerError = '';
  state.modelPickerSwitchingLabel = targetLabel;
  renderModelPicker();
  showStatus(t('status.switchingModel', { model: targetLabel }), 'info');

  try {
    const payload = await apiPatch(`/api/openclaw-webchat/sessions/${encodeURIComponent(targetSessionKey)}/model`, {
      provider: option.provider,
      model: option.model
    });
    if (state.activeSessionKey !== targetSessionKey) return;
    state.modelPickerCurrent = normalizeModelOption(payload?.current) || option;
    state.modelPickerOptions = Array.isArray(payload?.models)
      ? payload.models.map(normalizeModelOption).filter(Boolean)
      : state.modelPickerOptions;
    state.modelPickerSwitchingLabel = '';
    renderModelPicker();
    closeModelPicker();
    showStatus(t('status.modelSwitchDone', { model: state.modelPickerCurrent?.label || targetLabel }), 'success');
  } catch (error) {
    if (state.activeSessionKey !== targetSessionKey) return;
    state.modelPickerSwitchingLabel = '';
    state.modelPickerError = t('status.modelSwitchFailed', { error: formatError(error) });
    renderModelPicker();
    showStatus(state.modelPickerError, 'error');
  }
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
      label: state.userProfile.displayName || (state.language === 'en' ? 'Me' : '我'),
      fallbackText: (state.userProfile.displayName || (state.language === 'en' ? 'Me' : '我')).slice(0, 1)
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
  indicator.setAttribute('aria-label', t('status.processingAgent'));

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
    title.textContent = attachment.name || (attachment.kind === 'audio' ? t('status.unnamedAudio') : t('status.unnamedImage'));

    const subtitle = document.createElement('div');
    subtitle.className = 'pending-upload-hint';
    subtitle.textContent = buildPendingUploadHint(attachment);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'pending-upload-remove';
    remove.textContent = t('status.remove');
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
  preview.alt = attachment.name || t('ui.imagePreview');
  return preview;
}

function createPendingAudioPreview() {
  const badge = document.createElement('div');
  badge.className = 'pending-upload-audio';
  badge.textContent = t('status.audioLabel');
  return badge;
}

function buildPendingUploadHint(attachment) {
  if (attachment.kind === 'image') {
    return attachment.source ? t('status.uploadReadyWithMessage') : t('status.uploadAutoImage');
  }

  if (!attachment.source) return t('status.uploadAutoAudio');
  if (attachment.transcriptStatus === 'ready' && attachment.transcriptText) {
    return t('status.transcriptReady', { summary: summarizeText(attachment.transcriptText, 32) });
  }
  if (attachment.transcriptStatus === 'failed') {
    return attachment.transcriptError || t('status.transcriptFailedSendAudio');
  }
  return t('status.uploadReadyWithMessage');
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
        throw new Error(t('status.uploadFailed', { name: attachment.name || t('status.fileLabel') }));
      }
    }

    blocks.push(...buildSendBlocksForAttachment(attachment));
  }

  return blocks;
}

function buildUploadProgressMessage(attachment, index) {
  if (attachment.kind === 'audio') {
    return t('status.uploadingAudio', { index: index + 1, total: state.pendingUploads.length });
  }
  return t('status.uploadingImage', { index: index + 1, total: state.pendingUploads.length });
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
    reader.onerror = () => reject(new Error(t('status.readFileFailed', { name: file?.name || 'unknown' })));
    reader.onload = () => {
      const result = String(reader.result || '');
      const [, base64 = ''] = result.split(',', 2);
      if (!base64) {
        reject(new Error(t('status.readFileFailed', { name: file?.name || 'unknown' })));
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
    throw new Error(t('status.cropUnsupported'));
  }

  context.drawImage(image, sourceX, sourceY, side, side, 0, 0, outputSize, outputSize);
  const blob = await canvasToBlob(canvas, 'image/png', 0.92);
  const filename = toAvatarFilename(file.name);
  return new File([blob], filename, { type: 'image/png' });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(t('status.readFileFailed', { name: file?.name || 'unknown' })));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(t('status.imageCropLoadFailed')));
    image.src = src;
  });
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error(t('status.avatarExportFailed')));
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
  mediaViewerImageEl.alt = block.name || t('ui.imagePreview');
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

function formatMediaViewerScaleLabel() {
  return `${Math.round(state.mediaViewerScale * 100)}%`;
}

function renderMediaViewerZoomReadout() {
  if (!mediaResetZoomButtonEl) return;
  const zoomLabel = formatMediaViewerScaleLabel();
  mediaResetZoomButtonEl.textContent = zoomLabel;
  mediaResetZoomButtonEl.setAttribute('aria-label', `${t('ui.resetZoom')} (${zoomLabel})`);
  mediaResetZoomButtonEl.setAttribute('title', t('ui.resetZoom'));
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
  renderMediaViewerZoomReadout();
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
    if (state.modelPickerOpen) {
      closeModelPicker();
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
  renderProjectInfo();
  if (resetDraft) {
    loadServiceSettingsDraft();
  } else {
    renderServiceSettingsForm();
  }

  const currentKey = resolveValidSettingsContactKey(state.settingsSelectedContactKey);
  if (resetDraft || currentKey !== state.settingsSelectedContactKey) {
    loadSettingsDraft(currentKey);
    return;
  }

  settingsContactSelectEl.value = currentKey;
  settingsDisplayNameInputEl.value = state.settingsDraftDisplayName;
  renderSettingsPreview();
}

function loadServiceSettingsDraft() {
  settingsLanguageSelectEl.value = state.language;
  state.settingsNetworkAccess = state.serviceSettings.networkAccess || 'local';
  state.settingsLightAuthEnabled = Boolean(state.serviceSettings.authEnabled);
  state.settingsLightAuthPassword = '';
  state.settingsLightAuthPasswordConfirm = '';
  renderServiceSettingsForm();
}

function handleServiceSettingsDraftChange() {
  state.settingsNetworkAccess = settingsNetworkAccessSelectEl?.value === 'lan' ? 'lan' : 'local';
  state.settingsLightAuthEnabled = Boolean(settingsLightAuthToggleEl?.checked);
  state.settingsLightAuthPassword = settingsLightAuthPasswordInputEl?.value || '';
  state.settingsLightAuthPasswordConfirm = settingsLightAuthPasswordConfirmInputEl?.value || '';
  renderServiceSettingsForm();
}

function renderServiceSettingsForm() {
  if (!settingsNetworkAccessSelectEl) return;

  settingsNetworkAccessSelectEl.value = state.settingsNetworkAccess;
  settingsLightAuthToggleEl.checked = state.settingsLightAuthEnabled;
  settingsLightAuthPasswordInputEl.value = state.settingsLightAuthPassword;
  settingsLightAuthPasswordConfirmInputEl.value = state.settingsLightAuthPasswordConfirm;

  const targetHost = state.settingsNetworkAccess === 'lan' ? '0.0.0.0' : '127.0.0.1';
  const needsRestart = targetHost !== state.serviceSettings.effectiveHost;
  const modeLabel = state.settingsNetworkAccess === 'lan' ? t('ui.lanTailscale') : t('ui.localOnly');
  const managerLabel = state.serviceSettings.hostManagedBy === 'env' ? t('status.networkManagerEnv') : t('status.networkManagerConfig');
  settingsNetworkHintEl.textContent = t('status.networkHint', {
    mode: modeLabel,
    targetHost,
    effectiveHost: state.serviceSettings.effectiveHost,
    manager: managerLabel,
    restart: needsRestart ? t('status.networkHintRestart') : '.'
  });

  const hasExistingPassword = Boolean(state.serviceSettings.authConfigured);
  settingsLightAuthHintEl.textContent = state.settingsLightAuthEnabled
    ? hasExistingPassword
      ? t('status.lightAuthEnabledHint')
      : t('status.lightAuthFirstHint')
    : t('status.lightAuthOffHint');

  settingsLightAuthPasswordInputEl.disabled = !state.settingsLightAuthEnabled;
  settingsLightAuthPasswordConfirmInputEl.disabled = !state.settingsLightAuthEnabled;
  settingsLogoutButtonEl.disabled = !state.authEnabled || !state.authenticated;
  restartServiceButtonEl.disabled = !state.serviceSettings.restartSupported || state.restartingService;
  if (settingsDocumentAccessCopyEl) {
    settingsDocumentAccessCopyEl.textContent = state.serviceSettings.documentAccessMode === 'follow-openclaw'
      ? t('status.documentAccessFollow')
      : t('status.documentAccessOpenClaw');
  }
  settingsRestartHintEl.textContent = state.serviceSettings.restartSupported
    ? t('status.restartHintSupported', { hint: state.serviceSettings.restartHint || 'n/a' })
    : t('status.restartHintManual');
  renderManualStartGuide();
}

function renderSettingsTabs() {
  const tabs = {
    contacts: settingsContactsTabEl,
    preferences: settingsPreferencesTabEl,
    access: settingsAccessTabEl,
    about: settingsAboutTabEl,
    'manual-start': settingsManualStartTabEl
  };
  const panels = {
    contacts: settingsContactsSectionEl,
    preferences: settingsPreferencesSectionEl,
    access: settingsAccessSectionEl,
    about: settingsAboutSectionEl,
    'manual-start': settingsManualStartSectionEl
  };

  for (const section of SETTINGS_SECTIONS) {
    const active = state.settingsExpandedSection === section;
    tabs[section]?.classList.toggle('active', active);
    tabs[section]?.setAttribute('aria-expanded', active ? 'true' : 'false');
    if (panels[section]) panels[section].hidden = !active;
  }
}

function switchSettingsTab(tab) {
  const next = SETTINGS_SECTIONS.includes(tab) ? tab : 'contacts';
  state.settingsExpandedSection = state.settingsExpandedSection === next ? null : next;
  if (state.settingsExpandedSection === 'contacts' && !state.settingsSelectedContactKey) {
    loadSettingsDraft(getDefaultSettingsContactKey());
  }
  renderSettingsTabs();
}

function renderProjectInfo() {
  if (settingsAboutSummaryEl) {
    settingsAboutSummaryEl.textContent = t('text.projectSummary');
  }
  if (settingsGithubLinkEl) {
    settingsGithubLinkEl.href = state.projectInfo.githubUrl;
    settingsGithubLinkEl.textContent = state.language === 'en'
      ? `${BRAND_NAME} GitHub Repository`
      : `${BRAND_NAME} GitHub 仓库`;
  }
}

function renderManualStartGuide() {
  if (settingsManualStartIntroEl) {
    settingsManualStartIntroEl.textContent = state.serviceSettings.restartSupported
      ? t('status.manualStartIntroSupported')
      : t('status.manualStartIntro');
  }
  if (settingsManualStartProjectDirEl) {
    settingsManualStartProjectDirEl.textContent = state.language === 'en'
      ? 'Enter the Claw WebChat project directory first'
      : '先进入 Claw WebChat 项目目录';
  }
  if (settingsManualInstallCommandEl) {
    settingsManualInstallCommandEl.textContent = state.serviceSettings.manualStart.installCommand;
  }
  if (settingsManualStartCommandEl) {
    settingsManualStartCommandEl.textContent = state.serviceSettings.manualStart.startCommand;
  }
  if (settingsManualRestartCommandEl) {
    settingsManualRestartCommandEl.textContent = state.serviceSettings.manualStart.restartCommand || t('status.manualRestartFallback');
  }
}

function getSettingsContacts() {
  return [
    {
      key: 'user:self',
      kind: 'user',
      id: 'self',
      name: state.userProfile.displayName || (state.language === 'en' ? 'Me' : '我'),
      avatarUrl: state.userProfile.avatarUrl || null,
      subtitle: t('status.selfSubtitle')
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
    option.textContent = `${contact.name}${contact.kind === 'user' ? ` · ${state.language === 'en' ? 'Me' : '我'}` : ` · ${contact.id}`}`;
    settingsContactSelectEl.append(option);
  }

  settingsContactSelectEl.value = selectedKey;
}

function loadSettingsDraft(contactKey) {
  const target = resolveSettingsContact(resolveValidSettingsContactKey(contactKey));
  if (!target) return;

  resetSettingsAvatarDraft();
  state.settingsSelectedContactKey = target.key;
  state.settingsDraftDisplayName = target.name || (target.kind === 'user' ? (state.language === 'en' ? 'Me' : '我') : target.id);
  state.settingsDraftAvatarUrl = target.avatarUrl || null;
  state.settingsAvatarRemoved = false;
  settingsContactSelectEl.value = target.key;
  settingsDisplayNameInputEl.value = state.settingsDraftDisplayName;
  renderSettingsPreview();
}

function renderSettingsPreview() {
  const target = resolveSettingsContact(state.settingsSelectedContactKey) || resolveSettingsContact(getDefaultSettingsContactKey());
  const displayName = state.settingsDraftDisplayName.trim() || (target?.kind === 'user' ? (state.language === 'en' ? 'Me' : '我') : target?.id || t('ui.contacts'));
  const avatarUrl = state.settingsDraftAvatarPreviewUrl || (state.settingsAvatarRemoved ? null : state.settingsDraftAvatarUrl);

  settingsAvatarPreviewEl.classList.toggle('agent', target?.kind === 'agent');
  renderAvatarPreview(settingsAvatarPreviewEl, avatarUrl, displayName);
  settingsPreviewTitleEl.textContent = displayName;
  settingsPreviewSubtitleEl.textContent = target?.kind === 'user'
    ? t('status.syncUserAvatar')
    : t('status.syncAgentAvatar', { agent: target?.id || 'agent' });
  settingsAvatarHintEl.textContent = state.settingsDraftAvatarPreviewUrl
    ? t('status.avatarCropped')
    : state.settingsAvatarRemoved
      ? t('status.avatarWillRemove')
      : t('text.avatarUploadHint');
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
    showStatus(t('status.avatarOnlyImage'), 'error');
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
    showStatus(t('status.avatarProcessFailed', { error: formatError(error) }), 'error');
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
      showStatus(t('status.uploadingAvatar'), 'info');
      const upload = await uploadSettingsAvatar(state.settingsDraftAvatarFile, target);
      avatarUrl = upload?.upload?.source || avatarUrl;
    }

    if (target.kind === 'user') {
      const payload = await apiPatch('/api/openclaw-webchat/settings/user-profile', {
        displayName: state.settingsDraftDisplayName.trim() || (state.language === 'en' ? 'Me' : '我'),
        avatarUrl
      });
      state.userProfile = {
        displayName: payload?.userProfile?.displayName || (state.language === 'en' ? 'Me' : '我'),
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

    renderAgentList({ refreshIdentity: true });
    updateHeader();
    renderMessages();
    loadSettingsDraft(target.key);
    showStatus(t('status.contactSettingsSaved'), 'success');
  } catch (error) {
    showStatus(t('status.saveFailed', { error: formatError(error) }), 'error');
  } finally {
    saveSettingsButtonEl.disabled = false;
    settingsContactSelectEl.disabled = false;
    settingsDisplayNameInputEl.disabled = false;
    settingsChooseAvatarButtonEl.disabled = false;
    settingsClearAvatarButtonEl.disabled = false;
  }
}

async function saveServiceSettings() {
  saveServiceSettingsButtonEl.disabled = true;
  settingsNetworkAccessSelectEl.disabled = true;
  settingsLightAuthToggleEl.disabled = true;
  settingsLightAuthPasswordInputEl.disabled = true;
  settingsLightAuthPasswordConfirmInputEl.disabled = true;

  try {
    const payload = await apiPatch('/api/openclaw-webchat/settings/service', {
      networkAccess: state.settingsNetworkAccess,
      authEnabled: state.settingsLightAuthEnabled,
      authPassword: state.settingsLightAuthPassword,
      authPasswordConfirm: state.settingsLightAuthPasswordConfirm
    });

    state.serviceSettings = normalizeServiceSettings(payload?.serviceSettings);
    state.authEnabled = payload?.authStatus?.enabled === true;
    state.authenticated = payload?.authStatus?.authenticated !== false;
    loadServiceSettingsDraft();
    renderAuthGate();
    showStatus(
      payload?.restartRequired
        ? (state.language === 'en' ? 'Access settings saved. Restart the service for the bind-address change to take effect.' : '访问方式已保存，重启服务后生效。')
        : t('status.accessSettingsSaved'),
      payload?.restartRequired ? 'info' : 'success'
    );
  } catch (error) {
    showStatus(t('status.accessSettingsSaveFailed', { error: formatError(error) }), 'error');
  } finally {
    saveServiceSettingsButtonEl.disabled = false;
    settingsNetworkAccessSelectEl.disabled = false;
    settingsLightAuthToggleEl.disabled = false;
    renderServiceSettingsForm();
  }
}

async function logoutLightAuthSession() {
  settingsLogoutButtonEl.disabled = true;
  try {
    await apiPostPublic('/api/openclaw-webchat/auth/logout', {});
    await refreshAuthStatus();
    if (state.authEnabled && !state.authenticated) {
      lockAppForAuth();
    }
    showStatus(t('status.loggedOut'), 'success');
  } catch (error) {
    showStatus(t('status.logoutFailed', { error: formatError(error) }), 'error');
  } finally {
    renderServiceSettingsForm();
  }
}

async function restartServiceFromSettings() {
  restartServiceButtonEl.disabled = true;
  try {
    const payload = await apiPost('/api/openclaw-webchat/settings/restart', {});
    state.restartingService = true;
    state.serviceRestartMessage = t('status.restartingService');
    renderServiceRestartGate();
    showStatus(t('status.restartingServiceShort'), 'info');
    await waitForServiceRecovery();
  } catch (error) {
    state.restartingService = false;
    state.serviceRestartMessage = '';
    renderServiceRestartGate();
    renderServiceSettingsForm();
    showStatus(t('status.restartFailed', { error: formatError(error) }), 'error');
  }
}

async function waitForServiceRecovery() {
  const timeoutMs = 45000;
  const intervalMs = 1200;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    await delay(intervalMs);

    try {
      const response = await fetch('/healthz', { cache: 'no-store' });
      if (!response.ok) continue;

      state.serviceRestartMessage = t('status.serviceRecoveredSync');
      renderServiceRestartGate();
      await refreshAuthStatus();

      if (state.authEnabled && !state.authenticated) {
        state.restartingService = false;
        state.serviceRestartMessage = '';
        renderServiceRestartGate();
        lockAppForAuth();
        return;
      }

      await loadAuthenticatedApp({ force: true });
      state.restartingService = false;
      state.serviceRestartMessage = '';
      renderServiceRestartGate();
      populateSettingsForm({ resetDraft: true });
      showStatus(t('status.serviceRestartDone'), 'success');
      return;
    } catch {
      // still restarting
    }
  }

  state.restartingService = false;
  state.serviceRestartMessage = '';
  renderServiceRestartGate();
  showStatus(t('status.serviceRestartTimeout'), 'error');
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
  if (!state.pendingUploads.length) return t('status.sendingMessage');
  if (state.pendingUploads.some((item) => item.kind === 'audio')) return t('status.sendingAudioAttachments');
  return t('status.sendingAttachments');
}

function setSessionPresenceLocally(sessionKey, presence) {
  const agent = state.agents.find((item) => item.sessionKey === sessionKey);
  if (!agent) return;
  agent.presence = presence;
  renderAgentList({ refreshIdentity: false });
  updateHeader();
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

function shouldKeepConversationPinnedAfterRender() {
  if (state.historySearchActiveMessageId) return false;
  return state.autoScrollPinned || isActiveSessionBusy();
}

function scheduleConversationPinnedBottomSync() {
  requestAnimationFrame(() => {
    if (!shouldKeepConversationPinnedAfterRender()) return;
    scrollMessagesToBottom();
    requestAnimationFrame(() => {
      if (!shouldKeepConversationPinnedAfterRender()) return;
      scrollMessagesToBottom();
    });
  });
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
  setComposerEnabled({
    canAccess: Boolean(state.activeSessionKey) && (!state.authEnabled || state.authenticated),
    busy: isActiveSessionBusy(),
    stopping: isActiveSessionStopping()
  });
}

function setComposerEnabled({ canAccess, busy, stopping }) {
  const composerLocked = !canAccess || busy;
  composerInputEl.disabled = composerLocked;
  sendButtonEl.disabled = !canAccess || stopping;
  newContextButtonEl.disabled = composerLocked;
  attachButtonEl.disabled = composerLocked;
  mediaUploadInputEl.disabled = composerLocked;
  if (composerLocked) closeCommandMenu();
  renderSendButtonState();
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
  return Boolean(sessionKey) && (
    state.sendingSessionKeys.has(sessionKey)
    || hasRunningPresenceForSession(sessionKey)
  );
}

function isSessionStopping(sessionKey) {
  return Boolean(sessionKey) && state.stoppingSessionKeys.has(sessionKey);
}

function isSessionStopRequested(sessionKey) {
  return Boolean(sessionKey) && state.stopRequestedSessionKeys.has(sessionKey);
}

function isActiveSessionBusy() {
  return isSessionBusy(state.activeSessionKey);
}

function isActiveSessionStopping() {
  return isSessionStopping(state.activeSessionKey);
}

function hasRunningPresenceForSession(sessionKey) {
  const agent = state.agents.find((item) => item.sessionKey === sessionKey);
  return normalizePresence(agent?.presence || 'idle') === 'running';
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

async function apiGetPublic(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  return handleResponse(response, { allowAuthFailure: true });
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

async function apiPostPublic(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json'
    },
    body: JSON.stringify(body || {})
  });
  return handleResponse(response, { allowAuthFailure: true });
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

async function handleResponse(response, { allowAuthFailure = false } = {}) {
  const text = await response.text();
  const data = text ? safeJsonParse(text) : null;
  if (!response.ok) {
    if (response.status === 401 && !allowAuthFailure) {
      state.authenticated = false;
      state.authError = t('status.authRequiredInline');
      lockAppForAuth();
    }
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePresence(value) {
  return value === 'running' || value === 'recent' ? value : 'idle';
}

function formatPresenceLabel(value) {
  if (value === 'running') return t('status.presenceRunning');
  if (value === 'recent') return t('status.presenceRecent');
  return t('status.presenceIdle');
}

function formatTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleTimeString(state.language === 'en' ? 'en-US' : 'zh-CN', { hour: '2-digit', minute: '2-digit' });
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
  return date.toLocaleString(state.language === 'en' ? 'en-US' : 'zh-CN', {
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
  return localizeErrorMessage(error?.message || String(error || 'Unknown error'));
}

function localizeErrorMessage(message) {
  const raw = String(message || '').trim();
  if (!raw || state.language !== 'en') return raw;

  const known = new Map([
    ['访问口令不正确。', 'The access password is incorrect.'],
    ['两次输入的访问口令不一致。', 'The two access passwords do not match.'],
    ['访问口令至少需要 4 个字符。', 'The access password must be at least 4 characters long.'],
    ['首次启用访问口令时必须设置口令。', 'You must set a password when enabling access protection for the first time.'],
    ['Authentication required.', 'Authentication required.'],
    ['Invalid or expired token', 'Invalid or expired token.'],
    ['Not found', 'Not found.']
  ]);
  return known.get(raw) || raw;
}
