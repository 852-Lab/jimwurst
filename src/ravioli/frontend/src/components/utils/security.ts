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
