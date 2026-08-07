import { buildCorsOptions } from './cors.util';

describe('buildCorsOptions', () => {
  it('allows a request with no Origin header (same-origin / non-browser callers)', () => {
    const options = buildCorsOptions('https://app.ecoswiftbank.com');
    const callback = jest.fn();
    options.origin(undefined, callback);
    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it('allows an origin present in the allow-list', () => {
    const options = buildCorsOptions('https://app.ecoswiftbank.com,https://admin.ecoswiftbank.com');
    const callback = jest.fn();
    options.origin('https://admin.ecoswiftbank.com', callback);
    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it('denies an origin not in the allow-list without throwing an error', () => {
    const options = buildCorsOptions('https://app.ecoswiftbank.com');
    const callback = jest.fn();
    options.origin('https://evil.example.com', callback);
    expect(callback).toHaveBeenCalledWith(null, false);
  });

  it('denies every cross-origin request when the allow-list is unset (default-deny)', () => {
    const options = buildCorsOptions(undefined);
    const callback = jest.fn();
    options.origin('https://anything.example.com', callback);
    expect(callback).toHaveBeenCalledWith(null, false);
  });

  it('denies every cross-origin request when the allow-list is an empty string', () => {
    const options = buildCorsOptions('');
    const callback = jest.fn();
    options.origin('https://anything.example.com', callback);
    expect(callback).toHaveBeenCalledWith(null, false);
  });

  it('tolerates whitespace around comma-separated origins', () => {
    const options = buildCorsOptions(' https://app.ecoswiftbank.com , https://admin.ecoswiftbank.com ');
    const callback = jest.fn();
    options.origin('https://admin.ecoswiftbank.com', callback);
    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it('always sets credentials: true (cookie-based refresh flow needs it)', () => {
    expect(buildCorsOptions('https://app.ecoswiftbank.com').credentials).toBe(true);
  });
});
