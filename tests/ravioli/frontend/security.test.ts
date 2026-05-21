import { describe, it, expect } from 'vitest';
import { escapeHTML, sanitizeImageUrl } from '../../../src/ravioli/frontend/src/components/utils/security';

describe('Security Utils', () => {
  describe('escapeHTML', () => {
    it('should escape HTML characters correctly', () => {
      expect(escapeHTML('<script>alert("test & pass \'")</script>')).toBe('&lt;script&gt;alert(&quot;test &amp; pass &#039;&quot;)&lt;/script&gt;');
    });

    it('should return empty string for falsy values', () => {
      expect(escapeHTML('')).toBe('');
      expect(escapeHTML(null as unknown as string)).toBe('');
    });
  });

  describe('sanitizeImageUrl', () => {
    it('should allow valid http/https urls', () => {
      expect(sanitizeImageUrl('https://example.com/image.png')).toBe('https://example.com/image.png');
      expect(sanitizeImageUrl('http://example.com/image.png')).toBe('http://example.com/image.png');
    });

    it('should allow absolute paths and resolve them', () => {
      // JSDOM default origin is http://localhost:3000
      expect(sanitizeImageUrl('/images/test.png')).toBe('http://localhost:3000/images/test.png');
    });

    it('should reject javascript protocols', () => {
      expect(sanitizeImageUrl('javascript:alert(1)')).toBeNull();
      expect(sanitizeImageUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    });

    it('should reject invalid characters', () => {
      expect(sanitizeImageUrl('https://example.com/img" onerror="alert(1)')).toBeNull();
      expect(sanitizeImageUrl('https://example.com/img<script>')).toBeNull();
    });

    it('should reject protocol relative urls', () => {
      expect(sanitizeImageUrl('//example.com/image.png')).toBeNull();
    });

    it('should return null for empty values', () => {
      expect(sanitizeImageUrl('   ')).toBeNull();
      expect(sanitizeImageUrl('')).toBeNull();
    });
  });
});
