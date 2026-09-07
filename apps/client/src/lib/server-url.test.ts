import { describe, expect, it } from 'vitest';
import { resolveServerUrl } from './server-url.js';

describe('deployment backend URL', () => {
  it('keeps local and all-in-one builds on the same origin', () => {
    expect(resolveServerUrl(undefined)).toBe('');
    expect(resolveServerUrl('  ')).toBe('');
  });
  it('disables network services for a Vercel build without a backend', () => {
    expect(resolveServerUrl(undefined, true)).toBeNull();
    expect(resolveServerUrl('  ', true)).toBeNull();
  });
  it('normalizes a backend origin for both sockets and profile requests', () => {
    expect(resolveServerUrl(' https://uno.example.com/ ', true)).toBe('https://uno.example.com');
    expect(resolveServerUrl('http://127.0.0.1:4000/', true)).toBe('http://127.0.0.1:4000');
  });
  it.each([
    '/api', 'not-a-url', 'wss://uno.example.com', 'https://uno.example.com/api',
    'https://uno.example.com/socket.io', 'https://user:password@uno.example.com',
    'https://uno.example.com?token=secret', 'https://uno.example.com#room',
    'http://uno.example.com'
  ])('rejects an invalid or insecure hosted backend: %s', (url) => {
    expect(() => resolveServerUrl(url, true)).toThrow(/VITE_SERVER_URL/);
  });
});
