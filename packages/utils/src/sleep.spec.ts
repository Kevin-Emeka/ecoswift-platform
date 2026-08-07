import { sleep } from './sleep';

describe('sleep', () => {
  it('resolves after roughly the requested delay', async () => {
    jest.useFakeTimers();
    const promise = sleep(1000);
    jest.advanceTimersByTime(1000);
    await expect(promise).resolves.toBeUndefined();
    jest.useRealTimers();
  });
});
