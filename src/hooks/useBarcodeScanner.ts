import { useEffect, useRef, useCallback } from 'react';
import { debugLog } from '../lib/barcode/barcode-service';

interface UseBarcodeScannerProps {
  onScan: (barcode: string) => void;
  isEnabled: boolean;
}

export function useBarcodeScanner({ onScan, isEnabled }: UseBarcodeScannerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const refocus = useCallback(() => {
    if (!isEnabled || !inputRef.current) return;

    // Check if any other editable element is focused
    const activeEl = document.activeElement;
    if (activeEl) {
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName);
      const isContentEditable = activeEl.getAttribute('contenteditable') === 'true';
      const isInsideModal = activeEl.closest('[role="dialog"]') || activeEl.closest('.modal');

      if (isInput || isContentEditable || isInsideModal) {
        // User is editing something else, do not steal focus
        return;
      }
    }

    try {
      inputRef.current.focus();
    } catch (err) {
      console.warn('Failed to refocus barcode hidden input:', err);
    }
  }, [isEnabled]);

  useEffect(() => {
    if (!isEnabled) return;

    // Initial focus delay to let page settle
    const initialTimer = setTimeout(refocus, 500);

    // Click listener to restore focus when clicking outside inputs
    const handleDocumentClick = (e: MouseEvent) => {
      // Small timeout to allow activeElement to update
      setTimeout(() => {
        const target = e.target as HTMLElement;
        if (target) {
          // If clicked on an input, modal button, or active form, don't steal focus
          const clickedInput = target.closest('input, textarea, select, [contenteditable="true"]');
          const clickedInteractive = target.closest('button, a, [role="button"], [role="dialog"]');
          if (clickedInput || clickedInteractive) {
            return;
          }
        }
        refocus();
      }, 50);
    };

    // Interval to check and restore focus (focus stability daemon)
    const intervalTimer = setInterval(() => {
      if (document.activeElement !== inputRef.current) {
        refocus();
      }
    }, 1500);

    // Keydown listener for the hidden input to capture scanner submissions
    const handleInputKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const value = inputRef.current?.value || '';
        if (value.trim()) {
          debugLog(`Hardware scanner scanned: "${value}"`);
          onScan(value);
          if (inputRef.current) {
            inputRef.current.value = '';
          }
        }
      }
    };

    document.addEventListener('click', handleDocumentClick);
    
    // Attach event listeners directly to the input if it's rendered
    const inputEl = inputRef.current;
    if (inputEl) {
      inputEl.addEventListener('keydown', handleInputKeyDown);
    }

    // Cleanup all listeners and timers
    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
      document.removeEventListener('click', handleDocumentClick);
      if (inputEl) {
        inputEl.removeEventListener('keydown', handleInputKeyDown);
      }
    };
  }, [isEnabled, onScan, refocus]);

  return { inputRef, refocus };
}
export default useBarcodeScanner;
