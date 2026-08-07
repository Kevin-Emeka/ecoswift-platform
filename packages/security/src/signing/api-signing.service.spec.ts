import { ApiSigningService } from './api-signing.service';

describe('ApiSigningService', () => {
  let service: ApiSigningService;
  const secret = 'a-shared-webhook-secret';

  beforeEach(() => {
    service = new ApiSigningService();
  });

  it('produces a signature that verifies against the same body/timestamp/secret', () => {
    const now = Math.floor(Date.now() / 1000);
    const signature = service.sign('{"amount":100}', now, secret);
    expect(service.verify({ rawBody: '{"amount":100}', timestamp: now, signature, secret })).toBe(true);
  });

  it('rejects a signature if the body was tampered with after signing', () => {
    const now = Math.floor(Date.now() / 1000);
    const signature = service.sign('{"amount":100}', now, secret);
    expect(service.verify({ rawBody: '{"amount":999}', timestamp: now, signature, secret })).toBe(false);
  });

  it('rejects a signature signed with a different secret', () => {
    const now = Math.floor(Date.now() / 1000);
    const signature = service.sign('{"amount":100}', now, secret);
    expect(service.verify({ rawBody: '{"amount":100}', timestamp: now, signature, secret: 'wrong-secret' })).toBe(false);
  });

  it('rejects a stale timestamp beyond the tolerance window', () => {
    const now = Math.floor(Date.now() / 1000);
    const staleTimestamp = now - 3600; // 1 hour old
    const signature = service.sign('{"amount":100}', staleTimestamp, secret);
    expect(service.verify({ rawBody: '{"amount":100}', timestamp: staleTimestamp, signature, secret })).toBe(false);
  });

  it('accepts a timestamp within a custom tolerance window', () => {
    const now = Math.floor(Date.now() / 1000);
    const timestamp = now - 100;
    const signature = service.sign('{"amount":100}', timestamp, secret);
    expect(service.verify({ rawBody: '{"amount":100}', timestamp, signature, secret }, 200)).toBe(true);
  });

  it('rejects a replayed signature paired with a different timestamp', () => {
    const now = Math.floor(Date.now() / 1000);
    const signature = service.sign('{"amount":100}', now, secret);
    // Same signature, but presented with a different (still-fresh) timestamp — the signature was computed over the original timestamp, so this must fail.
    expect(service.verify({ rawBody: '{"amount":100}', timestamp: now + 1, signature, secret })).toBe(false);
  });

  it('rejects a malformed/wrong-length signature without throwing', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(service.verify({ rawBody: '{}', timestamp: now, signature: 'not-hex-and-wrong-length', secret })).toBe(false);
  });
});
