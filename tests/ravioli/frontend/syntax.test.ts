import { expect, test } from 'vitest';
import { api } from '../../../src/ravioli/frontend/src/services/api';
import { highlightSQL } from '../../../src/ravioli/frontend/src/components/analysis/notebook/utils';

test('api service is syntactically valid and exportable', () => {
  expect(api).toBeDefined();
  expect(typeof api.listAnalyses).toBe('function');
  expect(typeof api.generateQuickInsight).toBe('function');
});

test('highlightSQL highlights keywords, numbers, and comments without corrupting HTML tags', () => {
  const sql = 'SELECT * FROM table LIMIT 11 -- comment';
  const highlighted = highlightSQL(sql);
  
  expect(highlighted).toContain('<span class="text-sky-400 font-bold">SELECT</span>');
  expect(highlighted).toContain('<span class="text-sky-400 font-bold">FROM</span>');
  expect(highlighted).toContain('<span class="text-sky-400 font-bold">LIMIT</span>');
  expect(highlighted).toContain('<span class="text-amber-400">11</span>');
  expect(highlighted).toContain('<span class="text-neutral-500 italic">-- comment</span>');
  
  // Verify that the generated HTML tags are NOT nested or broken by the number highlights (like "400" inside class names)
  expect(highlighted).not.toContain('text-sky-<span');
  expect(highlighted).not.toContain('text-neutral-<span');
});
