import { ConsoleSmsAdapter } from './console-sms.adapter';

describe('ConsoleSmsAdapter', () => {
  it('never sends anything real and always resolves with a sandbox provider message id', async () => {
    const adapter = new ConsoleSmsAdapter();
    const result = await adapter.send({ toNumber: '+15551234567', message: 'test' });
    expect(result.providerMessageId).toMatch(/^sandbox-/);
  });
});
