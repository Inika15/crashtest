import { Scenario, TargetManifest, HttpClient, ScenarioResult } from '@crashtest/runner';
import { passResult, failResult, buildTraceEntry, getTargetState } from '../helpers.js';
import { loadFixture } from '../fixtures.js';

export const wh01DuplicateReplay: Scenario = {
  id: 'WH-01',
  name: 'Duplicate Webhook Replay',
  category: 'webhook',
  severity: 'CRITICAL',
  description: 'Fires the same valid CHECKOUT.ORDER.APPROVED webhook twice within 50ms. The target must fulfill exactly once.',

  async run(target: TargetManifest, http: HttpClient, mockMode: boolean): Promise<ScenarioResult> {
    const start = Date.now();
    const fixture = await loadFixture('checkout-order-approved', mockMode);
    const body = JSON.stringify(fixture.body);
    const headers = { ...fixture.headers, 'content-type': 'application/json' };

    // Fire both requests concurrently (simulating duplicate delivery)
    const [res1, res2] = await Promise.all([
      http.postRaw(target.webhookUrl, body, headers),
      http.postRaw(target.webhookUrl, body, headers),
    ]);

    const traces = [
      buildTraceEntry('POST', target.webhookUrl, headers, fixture.body, res1, 'Webhook Delivery #1'),
      buildTraceEntry('POST', target.webhookUrl, headers, fixture.body, res2, 'Webhook Delivery #2'),
    ];

    // Small delay to let async processing complete
    await new Promise(r => setTimeout(r, 200));

    const state = await getTargetState(target, http);
    const durationMs = Date.now() - start;

    if (state.fulfillmentCount === 1) {
      return passResult('WH-01', wh01DuplicateReplay.name, 'webhook', 'CRITICAL', traces, durationMs);
    }

    return failResult(
      'WH-01', wh01DuplicateReplay.name, 'webhook', 'CRITICAL', traces,
      `Target fulfilled the order ${state.fulfillmentCount} times for a single payment. Expected exactly 1 fulfillment. The handler lacks an idempotency check on the event ID.`,
      durationMs,
      [{ field: 'fulfillmentCount', expected: 1, actual: state.fulfillmentCount, passed: false }]
    );
  },
};
