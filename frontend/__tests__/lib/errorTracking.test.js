/**
 * Error tracking must actually deliver.
 *
 * This module was a stub: every Sentry call commented out, @sentry/* never a
 * dependency, initErrorTracking() never called. A production exception reached
 * stdout and nowhere else, which is how a failing report intake and a dead
 * Alerts feature could have run unnoticed. These tests assert on delivery, not
 * on the shape of the returned object.
 */

const logEvent = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/logging', () => ({ __esModule: true, logEvent }));

import { captureException, assertProductionErrorSink } from '@/app/lib/errorTracking';

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('captureException', () => {
  beforeEach(() => { jest.clearAllMocks(); delete process.env.ERROR_WEBHOOK_URL; });

  it('writes a failure row to EventLog', async () => {
    captureException(new Error('kaboom'), { eventType: 'app.route_error', resourceType: 'app' });
    await flush();

    expect(logEvent).toHaveBeenCalledTimes(1);
    expect(logEvent.mock.calls[0][0]).toMatchObject({
      event_type: 'app.route_error',
      result: 'failure',
      error_message: 'kaboom',
    });
  });

  it('does not put the stack trace in the log message', async () => {
    const err = new Error('boom');
    err.stack = 'Error: boom\n  at /srv/app/secret/path.js:1:1';
    captureException(err);
    await flush();

    expect(logEvent.mock.calls[0][0].error_message).toBe('boom');
    expect(JSON.stringify(logEvent.mock.calls[0][0])).not.toContain('secret/path.js');
  });

  it('posts to ERROR_WEBHOOK_URL when one is configured', async () => {
    process.env.ERROR_WEBHOOK_URL = 'https://example.test/hook';
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    captureException(new Error('kaboom'));
    await flush();

    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.test/hook',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('never throws when a destination fails', async () => {
    process.env.ERROR_WEBHOOK_URL = 'https://example.test/hook';
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));
    logEvent.mockRejectedValueOnce(new Error('db down'));

    expect(() => captureException(new Error('kaboom'))).not.toThrow();
    await flush();
  });
});

describe('assertProductionErrorSink', () => {
  const realEnv = process.env.NODE_ENV;
  afterEach(() => { Object.defineProperty(process.env, 'NODE_ENV', { value: realEnv, configurable: true }); });

  it('passes outside production', () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', configurable: true });
    expect(assertProductionErrorSink()).toBe(true);
  });

  it('fails in production with no push destination', () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true });
    delete process.env.ERROR_WEBHOOK_URL;
    expect(assertProductionErrorSink()).toBe(false);
  });

  it('passes in production once a webhook is set', () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true });
    process.env.ERROR_WEBHOOK_URL = 'https://example.test/hook';
    expect(assertProductionErrorSink()).toBe(true);
  });
});
