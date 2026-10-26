import { Scenario, TargetManifest, HttpClient, ScenarioResult } from '@crashtest/runner';
import { passResult, failResult, buildTraceEntry } from '../helpers.js';

export const ck02CurrencyMismatch: Scenario = {
  id: 'CK-02',
  name: 'Currency Mismatch',
  category: 'checkout',
  severity: 'HIGH',
  description: 'Sends an order creation request with an unsupported or unexpected currency code. The server must validate and reject it.',

  async run(target: TargetManifest, http: HttpClient, _mockMode: boolean): Promise<ScenarioResult> {
    const start = Date.now();
    const payload = {
      items: [{ sku: 'DEMO-001', quantity: 1 }],
      amount: { value: '49.99', currency_code: 'XYZ' }, // Invalid currency
    };

    const res = await http.post(target.createOrderUrl, payload);
    const durationMs = Date.now() - start;
    const traces = [buildTraceEntry('POST', target.createOrderUrl, { 'content-type': 'application/json' }, payload, res, 'Invalid Currency Code Request')];

    if (res.status >= 400) {
      return passResult('CK-02', ck02CurrencyMismatch.name, 'checkout', 'HIGH', traces, durationMs);
    }

    return failResult(
      'CK-02', ck02CurrencyMismatch.name, 'checkout', 'HIGH', traces,
      `Server accepted an order creation request with currency code 'XYZ' (responded ${res.status}). The server must validate currency codes against its accepted list before forwarding to PayPal.`,
      durationMs
    );
  },
};
