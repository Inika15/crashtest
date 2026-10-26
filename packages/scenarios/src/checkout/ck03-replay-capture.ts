import { Scenario, TargetManifest, HttpClient, ScenarioResult } from '@crashtest/runner';
import { passResult, failResult, buildTraceEntry } from '../helpers.js';

export const ck03ReplayCapture: Scenario = {
  id: 'CK-03',
  name: 'Replayed Capture',
  category: 'checkout',
  severity: 'CRITICAL',
  description: 'Calls the capture endpoint twice with the same PayPal Order ID. The second call must return an idempotent cached response or 409, never re-capture.',

  async run(target: TargetManifest, http: HttpClient, mockMode: boolean): Promise<ScenarioResult> {
    const start = Date.now();
    const orderId = mockMode ? 'MOCK-ORDER-12345' : '5O190127TN364715T'; // Fixture order ID
    const requestId = 'crashtest-idempotency-ck03';

    const res1 = await http.post(target.captureUrl, { orderId }, {
      'PayPal-Request-Id': requestId,
    });
    const res2 = await http.post(target.captureUrl, { orderId }, {
      'PayPal-Request-Id': requestId,
    });
    const durationMs = Date.now() - start;

    const traces = [
      buildTraceEntry('POST', target.captureUrl, { 'PayPal-Request-Id': requestId }, { orderId }, res1, 'Capture Request #1 (original)'),
      buildTraceEntry('POST', target.captureUrl, { 'PayPal-Request-Id': requestId }, { orderId }, res2, 'Capture Request #2 (replay)'),
    ];

    // Pass if second returns 200 with same data OR 409 conflict
    if (res2.status === 409 || res2.status === 200) {
      // But if both returned 200 and the server didn't use idempotency keys properly, check body
      if (res1.status === 200 && res2.status === 200) {
        const b1 = JSON.stringify(res1.body);
        const b2 = JSON.stringify(res2.body);
        if (b1 === b2) {
          return passResult('CK-03', ck03ReplayCapture.name, 'checkout', 'CRITICAL', traces, durationMs);
        }
      } else {
        return passResult('CK-03', ck03ReplayCapture.name, 'checkout', 'CRITICAL', traces, durationMs);
      }
    }

    return failResult(
      'CK-03', ck03ReplayCapture.name, 'checkout', 'CRITICAL', traces,
      `Replay capture returned status ${res2.status}. The capture endpoint must use PayPal-Request-Id idempotency headers and cache the first response, returning it for duplicate requests rather than attempting a second capture.`,
      durationMs
    );
  },
};
