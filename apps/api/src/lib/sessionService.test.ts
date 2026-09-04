import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDeviceName,
  resolveLocationLabel,
  toPublicSession,
} from './sessionService';

describe('parseDeviceName', () => {
  it('prefers explicit device name', () => {
    assert.equal(parseDeviceName('Mozilla/5.0', 'Work laptop'), 'Work laptop');
  });

  it('detects iPhone from user agent', () => {
    assert.equal(
      parseDeviceName('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'),
      'iPhone',
    );
  });

  it('falls back to Web browser', () => {
    assert.equal(parseDeviceName(undefined), 'Web browser');
  });
});

describe('resolveLocationLabel', () => {
  it('labels localhost as This device', () => {
    assert.equal(resolveLocationLabel('127.0.0.1'), 'This device');
    assert.equal(resolveLocationLabel('::1'), 'This device');
  });

  it('labels private ranges as Local network', () => {
    assert.equal(resolveLocationLabel('192.168.1.42'), 'Local network');
    assert.equal(resolveLocationLabel('10.0.0.5'), 'Local network');
  });

  it('uses DEFAULT_SESSION_LOCATION when set', () => {
    const prev = process.env.DEFAULT_SESSION_LOCATION;
    process.env.DEFAULT_SESSION_LOCATION = 'United States';
    assert.equal(resolveLocationLabel('8.8.8.8'), 'United States');
    if (prev === undefined) delete process.env.DEFAULT_SESSION_LOCATION;
    else process.env.DEFAULT_SESSION_LOCATION = prev;
  });
});

describe('toPublicSession', () => {
  const base = {
    id: 'sess_1',
    jti: 'jti_1',
    tokenHash: 'hash',
    userId: 'user_1',
    deviceName: 'Mac',
    userAgent: 'ua',
    ipAddress: '127.0.0.1',
    locationLabel: 'This device',
    lastActiveAt: new Date('2026-08-13T10:00:00.000Z'),
    expiresAt: new Date('2026-10-12T10:00:00.000Z'),
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    revokedAt: null,
    adminConsoleSession: false,
  };

  it('marks current session', () => {
    const pub = toPublicSession(base, 'sess_1');
    assert.equal(pub.isCurrent, true);
    assert.equal(pub.deviceName, 'Mac');
    assert.equal(pub.lastActiveAt, '2026-08-13T10:00:00.000Z');
  });

  it('does not mark other sessions as current', () => {
    const pub = toPublicSession(base, 'sess_other');
    assert.equal(pub.isCurrent, false);
  });
});
