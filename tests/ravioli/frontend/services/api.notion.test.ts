import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncNotionPages, pushNotionPages } from '../../../../src/ravioli/frontend/src/services/api';

// Mock the global fetch function
global.fetch = vi.fn();

describe('Notion API Services', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('syncNotionPages', () => {
    it('should send a POST request with sync_all = true', async () => {
      // Arrange
      const mockResponse = { status: 'success', synced_count: 5 };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      // Act
      const result = await syncNotionPages(true);

      // Assert
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/knowledge/notion/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sync_all: true }),
      });
      expect(result).toEqual(mockResponse);
    });

    it('should throw an error on non-ok response', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      await expect(syncNotionPages(true)).rejects.toThrow('Failed to sync with Notion');
    });
  });

  describe('pushNotionPages', () => {
    it('should send a POST request with sync_all = true', async () => {
      // Arrange
      const mockResponse = { status: 'success', pushed_count: 3 };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      // Act
      const result = await pushNotionPages(true);

      // Assert
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/knowledge/notion/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sync_all: true }),
      });
      expect(result).toEqual(mockResponse);
    });

    it('should send a POST request with specific page_ids', async () => {
      // Arrange
      const mockResponse = { status: 'success', pushed_count: 1 };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      // Act
      const result = await pushNotionPages(false, ['id-1']);

      // Assert
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/knowledge/notion/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sync_all: false, page_ids: ['id-1'] }),
      });
      expect(result).toEqual(mockResponse);
    });
  });
});
