import { ok, err } from './result';

describe('Result', () => {
  it('ok() produces a success result carrying the value', () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 });
  });

  it('err() produces a failure result carrying the error', () => {
    const error = new Error('boom');
    expect(err(error)).toEqual({ ok: false, error });
  });
});
