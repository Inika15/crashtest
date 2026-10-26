import { Scenario, TargetManifest, HttpClient, ScenarioResult } from '@crashtest/runner';
import { passResult, failResult, buildTraceEntry } from '../helpers.js';
import { loadFixture } from '../fixtures.js';

export const wh03PayloadTamper: Scenario = {
  id: 'WH-03',
  name: 'Payload Tampering',
  category: 'webhook',
  severity: 'CRITICAL',
  description: 'Sends an otherwise-valid PayPal webhook with the payment amount changed from the original value. The HMAC signature will no longer match, so the target must reject it.',

  async run(target: TargetManifest, http: HttpClient, mockMode: boolean): Promise<ScenarioResult> {
    const start = Date.now();
    const fixture = await loadFixture('checkout-order-approved', mockMode);

    // Tamper: change amount inside the body (signature stays original — will mismatch)
    const tamperedBody = JSON.parse(JSON.stringify(fixture.body));
    if (tamperedBody?.resource?.purchase_units?.[0]?.amount?.value) {
      tamperedBody.resource.purchase_units[0].amount.value = '9999.99';
    }

    const headers = { ...fixture.headers, 'content-type': 'application/json' };
    const res = await http.postRaw(target.webhookUrl, JSON.stringify(tamperedBody), headers);
    const durationMs = Date.now() - start;

    const traces = [buildTraceEntry('POST', target.webhookUrl, headers, tamperedBody, res, 'Tampered Amount Delivery')];

    if (res.status === 400 || res.status === 401 || res.status === 403) {
      return passResult('WH-03', wh03PayloadTamper.name, 'webhook', 'CRITICAL', traces, durationMs);
    }

    return failResult(
      'WH-03', wh03PayloadTamper.name, 'webhook', 'CRITICAL', traces,
      `Target accepted a webhook whose body was tampered (amount changed to $9999.99) but whose signature was not updated. This means the handler is not verifying HMAC signatures against the payload body.`,
      durationMs
    );
  },
};
