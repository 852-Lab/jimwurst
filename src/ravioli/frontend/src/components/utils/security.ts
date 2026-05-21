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
    if (value.startsWith('//')) {
      return null;
    }

    const parsed = new URL(value, window.location.origin);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    if (parsed.username || parsed.password) {
      return null;
    }

    return parsed.href;
  } catch {
    return null;
  }
}
