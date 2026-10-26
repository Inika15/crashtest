import { Scenario, TargetManifest, HttpClient, ScenarioResult } from '@crashtest/runner';
import { passResult, failResult, buildTraceEntry } from '../helpers.js';
import { loadFixture } from '../fixtures.js';

export const wh04LifecycleInversion: Scenario = {
  id: 'WH-04',
  name: 'Lifecycle Event Inversion',
  category: 'webhook',
  severity: 'HIGH',
  description: 'Delivers CHECKOUT.ORDER.COMPLETED before CHECKOUT.ORDER.APPROVED. Target must handle this gracefully without crashing or entering an invalid state.',

  async run(target: TargetManifest, http: HttpClient, mockMode: boolean): Promise<ScenarioResult> {
    const start = Date.now();
    const approved = await loadFixture('checkout-order-approved', mockMode);
    const completed = await loadFixture('checkout-order-completed', mockMode);

    const headers = { ...approved.headers, 'content-type': 'application/json' };

    // Deliberately invert order: COMPLETED first
    const res1 = await http.postRaw(target.webhookUrl, JSON.stringify(completed.body), {
      ...completed.headers, 'content-type': 'application/json',
    });
    await new Promise(r => setTimeout(r, 100));
    const res2 = await http.postRaw(target.webhookUrl, JSON.stringify(approved.body), headers);
    const durationMs = Date.now() - start;

    const traces = [
      buildTraceEntry('POST', target.webhookUrl, completed.headers, completed.body, res1, 'COMPLETED (sent first — out of order)'),
      buildTraceEntry('POST', target.webhookUrl, headers, approved.body, res2, 'APPROVED (sent second — correct order)'),
    ];

    const crashed = res1.status >= 500 || res2.status >= 500;
    if (crashed) {
      return failResult(
        'WH-04', wh04LifecycleInversion.name, 'webhook', 'HIGH', traces,
        `Target returned HTTP ${res1.status >= 500 ? res1.status : res2.status} when events arrived out of order. A robust handler must accept out-of-order events gracefully (return 200) and rely on order status from PayPal's API rather than local event sequencing.`,
        durationMs
      );
    }

    return passResult('WH-04', wh04LifecycleInversion.name, 'webhook', 'HIGH', traces, durationMs);
  },
};
