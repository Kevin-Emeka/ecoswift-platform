import { ConsoleEmailAdapter } from './console-email.adapter';

describe('ConsoleEmailAdapter', () => {
  it('never sends anything real and always resolves with a sandbox provider message id', async () => {
    const adapter = new ConsoleEmailAdapter();
    const result = await adapter.send({ toAddress: 'a@example.com', fromAddress: 'noreply@ecoswiftbank.com', subject: 'Hi' });
    expect(result.providerMessageId).toMatch(/^sandbox-/);
  });
});
