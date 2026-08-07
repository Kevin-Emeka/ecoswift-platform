export interface RetryOptions {
  retries?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
}

/** Retries an async operation with exponential backoff. */
export async function retry<T>(
  fn: () => Promise<T>,
  { retries = 3, minDelayMs = 100, maxDelayMs = 2000 }: RetryOptions = {},
): Promise<T> {
  let attempt = 0;
   
  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt += 1;
      if (attempt > retries) throw error;
      const delay = Math.min(minDelayMs * 2 ** (attempt - 1), maxDelayMs);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
