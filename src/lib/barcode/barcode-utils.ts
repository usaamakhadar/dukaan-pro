/**
 * DUKAAN PRO BARCODE ENGINE - UTILS
 * Utilities for barcode processing, validation, and EAN-13 generation.
 */

/**
 * Normalizes barcode input by trimming spaces, removing line breaks, 
 * carriage returns, tab characters, and non-printable control characters.
 */
export function normalizeBarcode(barcode: string): string {
  if (!barcode) return '';
  return barcode
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove ASCII control characters
    .replace(/\s+/g, '')                  // Remove all spaces (tabs, newlines, etc.)
    .trim();
}

/**
 * Sanitizes input to allow only alphanumeric characters, dashes, and underscores.
 * Protects against SQL/HTML/Script injection.
 */
export function sanitizeBarcode(barcode: string): string {
  const normalized = normalizeBarcode(barcode);
  return normalized.replace(/[^A-Za-z0-9-_]/g, '');
}

/**
 * Calculates the EAN-13 check digit (the 13th digit) for a given 12-digit string.
 */
export function calculateEAN13CheckDigit(digits12: string): number {
  if (!/^\d{12}$/.test(digits12)) {
    throw new Error('EAN-13 check digit calculation requires exactly 12 numeric digits');
  }

  let oddSum = 0;
  let evenSum = 0;

  for (let i = 0; i < 12; i++) {
    const digit = parseInt(digits12[i], 10);
    if (i % 2 === 0) {
      oddSum += digit; // 1st, 3rd, 5th, 7th, 9th, 11th digit (0-indexed even positions)
    } else {
      evenSum += digit; // 2nd, 4th, 6th, 8th, 10th, 12th digit (0-indexed odd positions)
    }
  }

  const total = oddSum + evenSum * 3;
  const remainder = total % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

/**
 * Validates whether a barcode is a valid EAN-13 barcode.
 */
export function isValidEAN13(barcode: string): boolean {
  const normalized = normalizeBarcode(barcode);
  if (!/^\d{13}$/.test(normalized)) return false;

  const digits12 = normalized.substring(0, 12);
  const expectedCheckDigit = calculateEAN13CheckDigit(digits12);
  const actualCheckDigit = parseInt(normalized[12], 10);

  return expectedCheckDigit === actualCheckDigit;
}

/**
 * Auto-generates a valid, unique EAN-13 barcode using prefix "20" (for local/in-store use).
 * 
 * EAN-13 structure:
 * 20 (2 digits) + random/unique serial (10 digits) + check digit (1 digit) = 13 digits
 */
export function generateEAN13(existingBarcodes: string[] = []): string {
  const prefix = '20';
  let attempts = 0;
  const maxAttempts = 1000;

  const normalizedExisting = new Set(
    existingBarcodes.map(b => normalizeBarcode(b).toUpperCase())
  );

  while (attempts < maxAttempts) {
    attempts++;
    
    // Generate 10 random digits for the serial number
    let serial = '';
    for (let i = 0; i < 10; i++) {
      serial += Math.floor(Math.random() * 10).toString();
    }

    const candidate12 = prefix + serial;
    const checkDigit = calculateEAN13CheckDigit(candidate12);
    const candidateEAN13 = candidate12 + checkDigit.toString();

    // Ensure it does not collide with existing barcodes
    if (!normalizedExisting.has(candidateEAN13)) {
      return candidateEAN13;
    }
  }

  // Fallback to timestamp + random if we hit max attempts
  const timestamp = Date.now().toString().slice(-10); // Last 10 digits of timestamp
  const candidate12 = prefix + timestamp;
  const checkDigit = calculateEAN13CheckDigit(candidate12);
  return candidate12 + checkDigit.toString();
}
