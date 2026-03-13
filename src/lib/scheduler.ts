// Task scheduling utilities for better performance and responsiveness

/**
 * Yields control to the browser for better responsiveness
 */
export function yieldToMain(): Promise<void> {
  return new Promise(resolve => {
    // Use scheduler.postTask if available (Chrome 94+), otherwise fallback to setTimeout
    if ('scheduler' in window && 'postTask' in (window as any).scheduler) {
      (window as any).scheduler.postTask(resolve, { priority: 'user-blocking' })
    } else {
      setTimeout(resolve, 0)
    }
  })
}

/**
 * Process a large array in chunks to avoid blocking the main thread
 */
export async function processInChunks<T, R>(
  items: T[],
  processor: (item: T, index: number) => R,
  chunkSize = 50
): Promise<R[]> {
  const results: R[] = []
  
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize)
    
    // Process the chunk
    for (let j = 0; j < chunk.length; j++) {
      results.push(processor(chunk[j], i + j))
    }
    
    // Yield control after processing each chunk
    if (i + chunkSize < items.length) {
      await yieldToMain()
    }
  }
  
  return results
}

/**
 * Execute a callback with idle time scheduling
 */
export function scheduleIdleWork<T>(
  callback: () => T,
  options?: { timeout?: number }
): Promise<T> {
  return new Promise((resolve) => {
    const wrappedCallback = (_deadline?: IdleDeadline) => {
      try {
        const result = callback()
        resolve(result)
      } catch (error) {
        throw error
      }
    }
    
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(wrappedCallback, {
        timeout: options?.timeout ?? 5000
      })
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(() => wrappedCallback(), 0)
    }
  })
}

/**
 * Debounce a function to prevent excessive calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeoutId: ReturnType<typeof setTimeout>
  let lastReject: ((reason: any) => void) | null = null

  return (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return new Promise((resolve, reject) => {
      // Cancel previous timeout
      if (timeoutId) {
        clearTimeout(timeoutId)
        if (lastReject) {
          lastReject(new Error('Debounced call cancelled'))
        }
      }

      lastReject = reject

      timeoutId = setTimeout(async () => {
        try {
          const result = await func(...args)
          resolve(result)
        } catch (error) {
          reject(error)
        }
      }, delay)
    })
  }
}

/**
 * Throttle a function to limit execution frequency
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

/**
 * Time-slice a CPU-intensive operation
 */
export async function timeSlice<T>(
  operation: () => T,
  sliceTime = 5 // milliseconds per slice
): Promise<T> {
  
  return new Promise((resolve, reject) => {
    function executeSlice() {
      const sliceStart = performance.now()
      
      try {
        while (performance.now() - sliceStart < sliceTime) {
          const result = operation()
          
          // If operation completed, resolve
          if (result !== undefined) {
            resolve(result)
            return
          }
        }
        
        // Continue in next frame
        yieldToMain().then(executeSlice)
      } catch (error) {
        reject(error)
      }
    }
    
    executeSlice()
  })
}

/**
 * Measure and log performance of an operation
 */
export async function measurePerformance<T>(
  name: string,
  operation: () => Promise<T> | T
): Promise<T> {
  const start = performance.now()
  
  try {
    const result = await operation()
    const duration = performance.now() - start
    
    if (import.meta.env.DEV && duration > 100) {
      console.log(`[Performance] ${name}: ${Math.round(duration)}ms`)
    }
    
    return result
  } catch (error) {
    const duration = performance.now() - start
    if (import.meta.env.DEV) {
      console.warn(`[Performance] ${name} failed after ${Math.round(duration)}ms:`, error)
    }
    throw error
  }
}