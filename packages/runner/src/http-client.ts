import { HttpClient } from './types.js';

export function createHttpClient(): HttpClient {
  async function timed(fn: () => Promise<Response>): Promise<{ status: number; headers: Record<string, string>; body: unknown; durationMs: number }> {
    const start = Date.now();
    const res = await fn();
    const durationMs = Date.now() - start;
    const headersObj: Record<string, string> = {};
    res.headers.forEach((v, k) => { headersObj[k] = v; });
    let body: unknown;
    const ct = res.headers.get('content-type') ?? '';
    try {
      body = ct.includes('json') ? await res.json() : await res.text();
    } catch {
      body = null;
    }
    return { status: res.status, headers: headersObj, body, durationMs };
  }

  return {
    async get(url, headers = {}) {
      return timed(() => fetch(url, { method: 'GET', headers }));
    },
    async post(url, body, headers = {}) {
      return timed(() => fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      }));
    },
    async postRaw(url, rawBody, headers = {}) {
      return timed(() => fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: rawBody,
      }));
    },
  };
}
