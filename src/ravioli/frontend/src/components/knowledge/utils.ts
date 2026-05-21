// --- Safety Helpers ---
export function escapeHTML(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function sanitizeImageUrl(input: string): string | null {
  const value = input.trim();
  if (!value) return null;

  if (/[<>"'\u0000-\u001F\u007F]/.test(value)) {
    return null;
  }

  try {
    const parsed = new URL(value, window.location.origin);

    if (value.startsWith('//')) {
      return null;
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    if (value.startsWith('/')) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

// --- Notion compatibility helpers ---
export function getBlocksPreview(blocks?: any[]): string {
  if (!blocks || blocks.length === 0) return 'No content codified.';
  const firstBlock = blocks.find(b => b.type === 'paragraph');
  if (!firstBlock) return 'Abstract block data...';
  const rt = firstBlock.paragraph?.rich_text?.[0];
  if (!rt) return 'Empty block...';
  return rt.plain_text || rt.text?.content || 'Empty block...';
}

export function textToBlocks(text: string): any[] {
  return [{
    type: 'paragraph',
    paragraph: {
      rich_text: [{ type: 'text', text: { content: text }, plain_text: text }]
    }
  }];
}

export function getIconDisplay(icon?: any): string {
  if (!icon) return '📄';
  if (icon.type === 'emoji') return icon.emoji;
  return '📄';
}

export function getCoverUrl(cover?: any): string {
  if (!cover) return '';
  if (cover.type === 'external') return cover.external.url;
  if (cover.type === 'file') return cover.file.url;
  return '';
}
