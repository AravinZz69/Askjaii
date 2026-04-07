/**
 * High-Octane Engine Performance Utilities
 * GPU acceleration helpers and performance monitoring
 */

/**
 * Force GPU rendering on an element
 */
export function enableGPUAcceleration(element: HTMLElement) {
  element.style.willChange = 'transform';
  element.style.transform = 'translateZ(0)';
}

/**
 * Disable GPU acceleration (cleanup)
 */
export function disableGPUAcceleration(element: HTMLElement) {
  element.style.willChange = 'auto';
  element.style.transform = '';
}

/**
 * Measure First Contentful Paint
 */
export function measureFCP(): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      resolve(null);
      return;
    }

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const fcpEntry = entries.find((entry) => entry.name === 'first-contentful-paint');
        if (fcpEntry) {
          resolve(fcpEntry.startTime);
          observer.disconnect();
        }
      });
      observer.observe({ type: 'paint', buffered: true });

      // Timeout after 10s
      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, 10000);
    } catch (e) {
      resolve(null);
    }
  });
}

/**
 * Measure Largest Contentful Paint
 */
export function measureLCP(): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      resolve(null);
      return;
    }

    try {
      let lcpValue = 0;
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as PerformanceEntry & {
          renderTime?: number;
          loadTime?: number;
        };
        lcpValue = lastEntry.renderTime || lastEntry.loadTime || 0;
      });
      observer.observe({ type: 'largest-contentful-paint', buffered: true });

      // Report LCP after 5s
      setTimeout(() => {
        observer.disconnect();
        resolve(lcpValue);
      }, 5000);
    } catch (e) {
      resolve(null);
    }
  });
}

/**
 * Measure Cumulative Layout Shift
 */
export function measureCLS(): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      resolve(null);
      return;
    }

    try {
      let clsValue = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const layoutShiftEntry = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
          if (!layoutShiftEntry.hadRecentInput) {
            clsValue += layoutShiftEntry.value || 0;
          }
        }
      });
      observer.observe({ type: 'layout-shift', buffered: true });

      // Report CLS after 5s
      setTimeout(() => {
        observer.disconnect();
        resolve(clsValue);
      }, 5000);
    } catch (e) {
      resolve(null);
    }
  });
}

/**
 * Report Web Vitals to console (dev only)
 */
export async function reportWebVitals() {
  if (process.env.NODE_ENV !== 'development') return;

  const fcp = await measureFCP();
  const lcp = await measureLCP();
  const cls = await measureCLS();

  console.group('🚀 AskJaY Performance Metrics');
  console.log(`FCP (First Contentful Paint): ${fcp ? `${fcp.toFixed(0)}ms` : 'N/A'}`);
  console.log(`LCP (Largest Contentful Paint): ${lcp ? `${lcp.toFixed(0)}ms` : 'N/A'}`);
  console.log(`CLS (Cumulative Layout Shift): ${cls !== null ? cls.toFixed(3) : 'N/A'}`);
  console.groupEnd();
}
