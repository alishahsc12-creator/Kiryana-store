import { useEffect, useRef } from 'react';

interface UseBarcodeScannerOptions {
  enabled: boolean;
  onScan: (barcode: string) => void;
}

/**
 * Listens for hardware USB barcode scanner keyboard-wedge bursts.
 * USB scanners type digits rapidly (<60ms between characters) and end with Enter.
 */
export function useBarcodeScanner({ enabled, onScan }: UseBarcodeScannerOptions): void {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditable =
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target?.isContentEditable;

      // Allow scanning inside the dedicated barcode input, skip other form fields
      if (isEditable && target?.getAttribute('data-barcode-input') !== 'true') {
        return;
      }

      // If user is typing inside data-barcode-input, let the input handle Enter itself
      if (target?.getAttribute('data-barcode-input') === 'true') {
        return;
      }

      const now = Date.now();
      if (now - lastKeyTimeRef.current > 80) {
        bufferRef.current = '';
      }
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        const scanned = bufferRef.current.trim();
        bufferRef.current = '';
        if (scanned.length >= 4) {
          e.preventDefault();
          onScanRef.current(scanned);
        }
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);
}
