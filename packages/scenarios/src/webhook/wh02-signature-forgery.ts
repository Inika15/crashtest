import { Scenario, TargetManifest, HttpClient, ScenarioResult } from '@crashtest/runner';
import { passResult, failResult, buildTraceEntry } from '../helpers.js';
import { loadFixture } from '../fixtures.js';

export const wh02SignatureForgery: Scenario = {
  id: 'WH-02',
  name: 'Signature Forgery',
  category: 'webhook',
  severity: 'CRITICAL',
  description: 'Sends a valid webhook body with a corrupted PAYPAL-TRANSMISSION-SIG. Target must reject it with 400 or 401.',

  async run(target: TargetManifest, http: HttpClient, mockMode: boolean): Promise<ScenarioResult> {
    const start = Date.now();
    const fixture = await loadFixture('checkout-order-approved', mockMode);

    const tamperedHeaders = {
      ...fixture.headers,
      'paypal-transmission-sig': 'FORGED_' + (fixture.headers['paypal-transmission-sig'] ?? 'invalid'),
      'content-type': 'application/json',
    };
    const body = JSON.stringify(fixture.body);
    const res = await http.postRaw(target.webhookUrl, body, tamperedHeaders);
    const durationMs = Date.now() - start;

    const traces = [buildTraceEntry('POST', target.webhookUrl, tamperedHeaders, fixture.body, res, 'Forged Signature Delivery')];

    if (res.status === 400 || res.status === 401 || res.status === 403) {
      return passResult('WH-02', wh02SignatureForgery.name, 'webhook', 'CRITICAL', traces, durationMs);
    }

    return failResult(
      'WH-02', wh02SignatureForgery.name, 'webhook', 'CRITICAL', traces,
      `Target accepted a webhook with a forged signature (responded ${res.status} instead of 400/401). The handler does not call PayPal's verify-webhook-signature endpoint before processing events.`,
      durationMs
    );
  },
};
