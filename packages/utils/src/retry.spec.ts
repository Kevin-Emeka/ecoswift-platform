import { retry } from './retry';

describe('retry', () => {
  it('returns the result on the first successful attempt', async () => {
    const fn = jest.fn().mockResolvedValue('done');
    await expect(retry(fn, { minDelayMs: 1, maxDelayMs: 1 })).resolves.toBe('done');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and eventually succeeds', async () => {
    const fn = jest.fn().mockRejectedValueOnce(new Error('fail once')).mockResolvedValue('recovered');
    await expect(retry(fn, { retries: 2, minDelayMs: 1, maxDelayMs: 1 })).resolves.toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws the last error once retries are exhausted', async () => {
    const error = new Error('always fails');
    const fn = jest.fn().mockRejectedValue(error);
    await expect(retry(fn, { retries: 2, minDelayMs: 1, maxDelayMs: 1 })).rejects.toThrow(error);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
