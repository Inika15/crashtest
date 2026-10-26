import { Scenario, TargetManifest, HttpClient, ScenarioResult } from '@crashtest/runner';
import { passResult, failResult, buildTraceEntry, getTargetState } from '../helpers.js';

export const cc01DoubleClickRace: Scenario = {
  id: 'CC-01',
  name: 'Concurrent Capture Race (Double-Click)',
  category: 'concurrency',
  severity: 'CRITICAL',
  description: 'Fires 5 simultaneous capture requests for the same order at t=0, simulating a double-click or network retry storm. Target must fulfill exactly once.',

  async run(target: TargetManifest, http: HttpClient, mockMode: boolean): Promise<ScenarioResult> {
    const start = Date.now();
    const orderId = mockMode ? 'MOCK-ORDER-RACE-001' : '5O190127TN364715T';
    const N = 5;

    // Fire all N requests simultaneously
    const requests = Array.from({ length: N }, (_, i) =>
      http.post(target.captureUrl, { orderId }, {
        'PayPal-Request-Id': `crashtest-cc01-attempt-${i}`, // intentionally different keys
        'X-Concurrent-Test': 'true',
      })
    );

    const responses = await Promise.all(requests);
    await new Promise(r => setTimeout(r, 300)); // let async processing settle
    const state = await getTargetState(target, http);
    const durationMs = Date.now() - start;

    const traces = responses.map((res, i) =>
      buildTraceEntry('POST', target.captureUrl,
        { 'PayPal-Request-Id': `crashtest-cc01-attempt-${i}` },
        { orderId }, res, `Concurrent Request #${i + 1} of ${N}`)
    );

    if (state.fulfillmentCount === 1) {
      return passResult('CC-01', cc01DoubleClickRace.name, 'concurrency', 'CRITICAL', traces, durationMs);
    }

    return failResult(
      'CC-01', cc01DoubleClickRace.name, 'concurrency', 'CRITICAL', traces,
      `${N} concurrent capture requests resulted in ${state.fulfillmentCount} fulfillments. Expected exactly 1. The capture handler lacks a database-level lock or atomic idempotency check. Multiple requests raced past the check-then-act gap.`,
      durationMs,
      [{ field: 'fulfillmentCount', expected: 1, actual: state.fulfillmentCount, passed: false }]
    );
  },
};
