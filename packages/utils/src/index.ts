/** wait async for a given number of milliseconds */
export async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** retry a function a given number of times with a given delay */
export async function retry<T>(
  fn: (count: number, max: number) => Promise<T>,
  { retries, delay }: { retries: number; delay: number } = {
    retries: 3,
    delay: 1000,
  }
): Promise<T> {
  let lastError: Error | undefined;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn(i, retries);
    } catch (error) {
      lastError = error as Error;
    }
    await wait(delay);
  }
  throw lastError;
}
