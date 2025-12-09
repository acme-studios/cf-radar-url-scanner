/**
 * Retry utility with exponential backoff
 */

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: (error: unknown) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableErrors: () => true, // Retry all errors by default
};

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      if (!opts.retryableErrors(error)) {
        throw error;
      }

      // Don't wait after last attempt
      if (attempt === opts.maxAttempts) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt - 1),
        opts.maxDelayMs
      );

      console.log(`[Retry] Attempt ${attempt}/${opts.maxAttempts} failed, retrying in ${delay}ms...`, error);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Check if an error is retryable (network/temporary errors)
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Network errors
    if (message.includes('network') || 
        message.includes('timeout') || 
        message.includes('econnreset') ||
        message.includes('enotfound')) {
      return true;
    }
  }

  // HTTP status codes that are retryable
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status: number }).status;
    // Retry on 5xx server errors and 429 rate limit
    return status >= 500 || status === 429;
  }

  return false;
}

/**
 * Check if a D1 error is retryable
 */
export function isRetryableD1Error(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // D1 specific retryable errors
    if (message.includes('database is locked') ||
        message.includes('busy') ||
        message.includes('timeout') ||
        message.includes('too many requests')) {
      return true;
    }
  }

  return isRetryableError(error);
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
