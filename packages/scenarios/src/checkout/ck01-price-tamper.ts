import { Scenario, TargetManifest, HttpClient, ScenarioResult } from '@crashtest/runner';
import { passResult, failResult, buildTraceEntry, getTargetState } from '../helpers.js';

export const ck01PriceTamper: Scenario = {
  id: 'CK-01',
  name: 'Client-Side Price Tampering',
  category: 'checkout',
  severity: 'CRITICAL',
  description: 'POSTs an order creation request with a manipulated amount ($0.01) for an item that costs $49.99. The server must recompute the price from its own catalog and reject or override the client-supplied amount.',

  async run(target: TargetManifest, http: HttpClient, _mockMode: boolean): Promise<ScenarioResult> {
    const start = Date.now();

    const tamperedPayload = {
      items: [{ sku: 'DEMO-001', quantity: 1 }],
      amount: { value: '0.01', currency_code: 'USD' }, // TAMPERED
    };

    const res = await http.post(target.createOrderUrl, tamperedPayload);
    const durationMs = Date.now() - start;

    const traces = [
      buildTraceEntry('POST', target.createOrderUrl, { 'content-type': 'application/json' }, tamperedPayload, res, 'Tampered Price Order Creation Request'),
    ];

    // Pass if: 400 rejection OR if the created order amount is the catalog price (not $0.01)
    const body = res.body as Record<string, unknown>;
    if (res.status >= 400) {
      return passResult('CK-01', ck01PriceTamper.name, 'checkout', 'CRITICAL', traces, durationMs);
    }

    // Check if server overrode the price correctly
    const orderAmount = (body as any)?.purchase_units?.[0]?.amount?.value;
    if (orderAmount && parseFloat(orderAmount) > 1.00) {
      return passResult('CK-01', ck01PriceTamper.name, 'checkout', 'CRITICAL', traces, durationMs);
    }

    return failResult(
      'CK-01', ck01PriceTamper.name, 'checkout', 'CRITICAL', traces,
      `Server accepted a client-supplied price of $0.01 and created a PayPal order for that amount (order amount: ${orderAmount ?? 'unknown'}). The server must compute prices from its own product catalog, never trust client-submitted amounts.`,
      durationMs
    );
  },
};
