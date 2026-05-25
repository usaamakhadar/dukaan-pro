/**
 * DUKAAN PRO BARCODE ENGINE - BARCODE SERVICE
 * Handles product caching, sequential scan queuing, API lookups, and retries.
 */

import { sanitizeBarcode } from './barcode-utils';

export interface BarcodeProduct {
  id: string;
  sku: string;
  name: string;
  price: string | number;
  stock: number;
  barcode: string;
  image_url?: string;
  [key: string]: unknown; // Allow other product attributes
}

// Development-only logger helper
const isDev = process.env.NODE_ENV === 'development';

export function debugLog(message: string, ...optionalParams: unknown[]) {
  if (isDev) {
    console.log(`[BarcodeEngine DEBUG] ${message}`, ...optionalParams);
  }
}

class BarcodeService {
  // In-memory cache map: barcode (normalized & uppercase) -> product
  private cache = new Map<string, BarcodeProduct>();
  
  // Sequential Promise chain for scan queuing (high-speed race condition prevention)
  private scanQueue = Promise.resolve();
  
  // Track ongoing fetches to avoid parallel requests for the same barcode
  private activeFetches = new Map<string, Promise<BarcodeProduct | null>>();

  /**
   * Populates or rebuilds the local cache map from a list of products.
   */
  public rebuildCache(products: BarcodeProduct[]): void {
    const startTime = performance.now();
    this.cache.clear();
    
    let count = 0;
    products.forEach(p => {
      if (p.barcode) {
        const key = p.barcode.trim().toUpperCase();
        this.cache.set(key, p);
        count++;
      }
      // Also index by SKU as fallback for hardware scanning internal codes
      if (p.sku) {
        const key = p.sku.trim().toUpperCase();
        if (!this.cache.has(key)) {
          this.cache.set(key, p);
        }
      }
    });

    const duration = performance.now() - startTime;
    debugLog(`Cache rebuilt in ${duration.toFixed(2)}ms. Loaded ${count} barcode entries.`);
  }

  /**
   * Adds an entry to the cache. Useful after adding a product in inventory.
   */
  public updateCacheEntry(product: BarcodeProduct): void {
    if (product.barcode) {
      this.cache.set(product.barcode.trim().toUpperCase(), product);
    }
    if (product.sku) {
      this.cache.set(product.sku.trim().toUpperCase(), product);
    }
    debugLog(`Cache updated for barcode/sku: ${product.barcode || product.sku}`);
  }

  /**
   * Removes an entry from the cache.
   */
  public removeCacheEntry(barcode?: string, sku?: string): void {
    if (barcode) this.cache.delete(barcode.trim().toUpperCase());
    if (sku) this.cache.delete(sku.trim().toUpperCase());
    debugLog(`Cache entry removed: ${barcode || sku}`);
  }

  /**
   * Fast local lookup (<1ms).
   */
  public lookupLocal(barcode: string): BarcodeProduct | null {
    const key = barcode.trim().toUpperCase();
    const hit = this.cache.get(key) || null;
    debugLog(`Local cache lookup for: ${barcode} - Result: ${hit ? 'HIT ✅' : 'MISS ❌'}`);
    return hit;
  }

  /**
   * Performs an API lookup with silent retry behavior.
   * Fallbacks to local cache on failure.
   */
  public async lookupAPI(barcode: string, retries = 2): Promise<BarcodeProduct | null> {
    const cleanBarcode = sanitizeBarcode(barcode);
    if (!cleanBarcode) return null;

    // Check if there is already an active fetch for this barcode
    if (this.activeFetches.has(cleanBarcode)) {
      return this.activeFetches.get(cleanBarcode)!;
    }

    const fetchPromise = (async () => {
      let lastError: Error | null = null;
      
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const startTime = performance.now();
          if (attempt > 0) {
            debugLog(`Retrying API lookup for barcode: ${cleanBarcode} (Attempt ${attempt}/${retries})`);
          }
          
          const response = await fetch(`/api/products/barcode/${encodeURIComponent(cleanBarcode)}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(4000) // 4 seconds timeout
          });

          if (!response.ok) {
            if (response.status === 404) {
              debugLog(`API lookup: Barcode ${cleanBarcode} not found in database (404).`);
              return null;
            }
            throw new Error(`HTTP Error ${response.status}`);
          }

          const product = await response.json();
          const duration = performance.now() - startTime;
          debugLog(`API Lookup succeeded in ${duration.toFixed(2)}ms for barcode: ${cleanBarcode}`);
          
          if (product) {
            this.updateCacheEntry(product);
          }
          return product;
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          lastError = err instanceof Error ? err : new Error(errMsg);
          debugLog(`API attempt ${attempt} failed: ${errMsg}`);
          // Wait slightly before retrying
          if (attempt < retries) {
            await new Promise(resolve => setTimeout(resolve, 300 * attempt));
          }
        }
      }

      // If all retries failed, log warning and attempt local cache fallback
      console.warn(`Barcode API lookup failed for ${cleanBarcode}:`, lastError);
      const localFallback = this.lookupLocal(cleanBarcode);
      if (localFallback) {
        debugLog(`Offline recovery: Fallback to local cache succeeded for ${cleanBarcode}`);
        return localFallback;
      }
      
      throw new Error(`Failed to lookup barcode offline or online after retries: ${lastError?.message}`);
    })();

    // Store in active fetches map
    this.activeFetches.set(cleanBarcode, fetchPromise);
    
    try {
      return await fetchPromise;
    } finally {
      this.activeFetches.delete(cleanBarcode);
    }
  }

  /**
   * Enqueues a scanned barcode to be processed sequentially.
   * Prevents double-scans and race conditions during rapid supermarket scanning.
   */
  public enqueueScan(
    barcode: string,
    onSuccess: (product: BarcodeProduct) => void | Promise<void>,
    onNotFound: (barcode: string) => void | Promise<void>,
    onError: (error: Error, barcode: string) => void | Promise<void>
  ): void {
    const cleanBarcode = sanitizeBarcode(barcode);
    if (!cleanBarcode) return;

    this.scanQueue = this.scanQueue.then(async () => {
      try {
        // 1. Check local cache first for instant checkout feel (<1ms)
        const localProduct = this.lookupLocal(cleanBarcode);
        if (localProduct) {
          await onSuccess(localProduct);
          return;
        }

        // 2. Fetch from API if cache misses
        const apiProduct = await this.lookupAPI(cleanBarcode);
        if (apiProduct) {
          await onSuccess(apiProduct);
        } else {
          await onNotFound(cleanBarcode);
        }
      } catch (err: unknown) {
        const errorInstance = err instanceof Error ? err : new Error(String(err));
        await onError(errorInstance, cleanBarcode);
      }
    });
  }
}

export const barcodeService = new BarcodeService();
