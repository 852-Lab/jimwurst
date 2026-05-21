import { describe, it, expect } from 'vitest';
import { withButtonLoading, createModal, showInlineModal, hideInlineModal } from '../../../src/ravioli/frontend/src/components/utils/dom';

describe('DOM Utils', () => {
  describe('withButtonLoading', () => {
    it('should set loading state, run async function, and restore state', async () => {
      const btn = document.createElement('button');
      btn.innerHTML = '<span>Submit</span>';
      
      const callback = async () => {
        expect(btn.disabled).toBe(true);
        expect(btn.innerHTML).toBe('Loading...');
      };

      await withButtonLoading(btn, 'Loading...', callback);
      
      expect(btn.disabled).toBe(false);
      expect(btn.innerHTML).toBe('<span>Submit</span>');
    });

    it('should restore button state even if callback throws an error', async () => {
      const btn = document.createElement('button');
      btn.innerHTML = 'Submit';
      
      const callback = async () => {
        throw new Error('Test Error');
      };

      await expect(withButtonLoading(btn, 'Loading...', callback)).rejects.toThrow('Test Error');
      
      expect(btn.disabled).toBe(false);
      expect(btn.innerHTML).toBe('Submit');
    });
  });

  describe('createModal', () => {
    it('should create and append a modal to the document body', () => {
      const modal = createModal('<div id="test-modal-content"></div>');
      expect(document.body.contains(modal)).toBe(true);
      expect(modal.querySelector('#test-modal-content')).not.toBeNull();
      
      // cleanup
      document.body.removeChild(modal);
    });
  });

  describe('showInlineModal / hideInlineModal', () => {
    it('should toggle appropriate CSS classes', async () => {
      const modal = document.createElement('div');
      modal.classList.add('hidden', 'opacity-0');
      const child = document.createElement('div');
      child.classList.add('translate-y-4');
      modal.appendChild(child);

      showInlineModal(modal);
      expect(modal.classList.contains('hidden')).toBe(false);
      
      // wait for requestAnimationFrame
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      expect(modal.classList.contains('opacity-0')).toBe(false);
      expect(child.classList.contains('translate-y-4')).toBe(false);

      hideInlineModal(modal, 0); // test with 0 delay
      expect(modal.classList.contains('opacity-0')).toBe(true);
      expect(child.classList.contains('translate-y-4')).toBe(true);
      
      // wait for setTimeout
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(modal.classList.contains('hidden')).toBe(true);
    });
  });
});
