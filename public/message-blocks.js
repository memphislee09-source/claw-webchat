export function parseTextIntoBlocks(rawText) {
  const text = String(rawText || '').trim();
  if (!text) return [];

  const blocks = [];
  const pendingTextLines = [];
  const flushPendingText = () => {
    const cleanText = pendingTextLines.join('\n').trim();
    pendingTextLines.length = 0;
    if (cleanText) blocks.push({ type: 'text', text: cleanText });
  };

  for (const originalLine of text.split('\n')) {
    const line = String(originalLine || '').trim();
    if (!line) {
      pendingTextLines.push('');
      continue;
    }

    const unbulleted = line.replace(/^[-*•]\s*/, '').trim();
    const textDirective = unbulleted.match(/^text\s*[:：]\s*(.+)$/i);
    if (textDirective?.[1]) {
      pendingTextLines.push(textDirective[1].trim());
      continue;
    }

    const directiveMedia = parseStandaloneMediaDirective(unbulleted);
    if (directiveMedia) {
      flushPendingText();
      blocks.push(buildMediaBlock(directiveMedia));
      continue;
    }

    const mixedDirective = parseMixedMediaDirective(unbulleted);
    if (mixedDirective) {
      const before = mixedDirective.before.trim();
      if (before) pendingTextLines.push(before);
      flushPendingText();
      blocks.push(buildMediaBlock(mixedDirective.source));
      continue;
    }

    const segments = extractMarkdownImageSegments(unbulleted);
    if (!segments.length) {
      pendingTextLines.push(unbulleted.replace(/^[\]\s]+/, '').trim());
      continue;
    }

    for (const segment of segments) {
      if (segment.type === 'text') {
        if (segment.text) pendingTextLines.push(segment.text);
        continue;
      }
      flushPendingText();
      blocks.push(buildMediaBlock(segment.source, segment.alt));
    }
  }

  flushPendingText();
  return dedupeBlocks(blocks);
}

export function groupMessageBlocksForRender(blocks) {
  const groups = [];
  let pendingTextBlocks = [];

  const flushPendingTextBlocks = () => {
    if (!pendingTextBlocks.length) return;
    groups.push({
      kind: 'text',
      blocks: pendingTextBlocks.map((block) => ({ type: 'text', text: String(block.text || '') }))
    });
    pendingTextBlocks = [];
  };

  for (const block of Array.isArray(blocks) ? blocks : []) {
    if (!block || typeof block !== 'object') continue;

    if (block.type === 'text') {
      const text = String(block.text || '');
      if (!text.trim()) continue;
      pendingTextBlocks.push({ type: 'text', text });
      continue;
    }

    flushPendingTextBlocks();
    groups.push({ kind: 'media', block });
  }

  flushPendingTextBlocks();
  return groups;
}

function parseStandaloneMediaDirective(line) {
  const mediaMatch = line.match(/^mediaUrl\s*[:：]\s*(.+)$/i);
  if (mediaMatch?.[1]) {
    const source = cleanMediaValue(mediaMatch[1]);
    return isLikelyMediaSource(source) ? source : null;
  }

  const mediaDirective = line.match(/^MEDIA\s*:\s*(.+)$/);
  if (mediaDirective?.[1]) {
    const source = cleanMediaValue(mediaDirective[1]);
    return isLikelyMediaSource(source) ? source : null;
  }

  return null;
}

function parseMixedMediaDirective(line) {
  const mixedMedia = line.match(/^(.*?)(?:\s+)?mediaUrl\s*[:：]\s*(.+)$/i);
  if (mixedMedia?.[2]) {
    const source = cleanMediaValue(mixedMedia[2]);
    if (isLikelyMediaSource(source)) {
      return { before: mixedMedia[1] || '', source };
    }
  }

  const mixedDirective = line.match(/^(.*?)(?:\s+)?MEDIA\s*:\s*(.+)$/);
  if (mixedDirective?.[2]) {
    const source = cleanMediaValue(mixedDirective[2]);
    if (isLikelyMediaSource(source)) {
      return { before: mixedDirective[1] || '', source };
    }
  }

  return null;
}

function extractMarkdownImageSegments(line) {
  const pattern = /!\[([^\]]*)\]\(([^)\s]+)\)/g;
  const segments = [];
  let cursor = 0;
  let match;

  while ((match = pattern.exec(line))) {
    const before = line.slice(cursor, match.index).trim();
    if (before) segments.push({ type: 'text', text: before });

    const source = cleanMediaValue(match[2]);
    if (isLikelyMediaSource(source)) {
      segments.push({ type: 'media', source, alt: normalizeOptionalString(match[1]) || undefined });
    } else {
      segments.push({ type: 'text', text: match[0] });
    }
    cursor = pattern.lastIndex;
  }

  const after = line.slice(cursor).trim();
  if (after) segments.push({ type: 'text', text: after });

  return segments;
}

function buildMediaBlock(source, name) {
  return {
    type: guessMediaTypeByPath(source),
    source,
    name: normalizeOptionalString(name) || basenameFromSource(source)
  };
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
    sizeBytes: Number.isFinite(Number(block.sizeBytes || block.size)) ? Number(block.sizeBytes || block.size) : undefined,
    durationMs: Number.isFinite(Number(block.durationMs)) ? Number(block.durationMs) : undefined
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

function isLikelyMediaSource(value) {
  const source = String(value || '').trim();
  if (!source) return false;
  if (/^https?:\/\//i.test(source)) return true;
  if (/^(\/|\.{1,2}\/|~\/)/.test(source)) return true;
  if (/^[a-zA-Z]:[\\/]/.test(source)) return true;
  return false;
}

function basenameFromSource(source) {
  const normalized = String(source || '')
    .split('#')[0]
    .split('?')[0]
    .replace(/\\/g, '/')
    .replace(/\/+$/g, '');
  const basename = normalized.split('/').pop();
  return basename || 'file';
}

function normalizeOptionalString(value) {
  const text = String(value ?? '').trim();
  return text || null;
}
