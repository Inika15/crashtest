import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// In-memory state (resets on restart or via /api/debug/reset)
const state = {
  fulfillmentCount: 0,
  processedEventIds: [] as string[],
  capturedOrders: {} as Record<string, number>, // orderId -> capture count
};

const CATALOG: Record<string, { name: string; price: string; currency: string }> = {
  'DEMO-001': { name: 'CrashTest Widget', price: '49.99', currency: 'USD' },
};

// POST /api/orders — BUG CK-01: trusts client-supplied amount
app.post('/api/orders', (req, res) => {
  const { items, amount } = req.body as { items: Array<{ sku: string; quantity: number }>; amount?: { value: string; currency_code: string } };
  
  // BUG: uses client-supplied amount without verifying against catalog
  const orderAmount = amount ?? { value: '49.99', currency_code: 'USD' };
  
  res.json({
    id: `ORDER-${Date.now()}`,
    status: 'CREATED',
    purchase_units: [{ amount: orderAmount }],
  });
});

// POST /api/capture — BUG CK-03 + CC-01: no idempotency, no lock
app.post('/api/capture', async (req, res) => {
  const { orderId } = req.body as { orderId: string };
  
  // BUG CC-01: No mutex or database lock here — concurrent requests all pass through
  // BUG CK-03: No check for prior capture of this orderId
  
  state.capturedOrders[orderId] = (state.capturedOrders[orderId] ?? 0) + 1;
  state.fulfillmentCount++; // BUG: increments on every call, not just first
  
  res.json({ id: orderId, status: 'COMPLETED', captureCount: state.capturedOrders[orderId] });
});

// POST /api/webhook — BUG WH-01, WH-02, WH-03: no sig check, no idempotency
app.post('/api/webhook', (req, res) => {
  const event = req.body as { id: string; event_type: string; resource: Record<string, unknown> };
  
  // BUG WH-02/WH-03: No signature verification at all
  
  if (event.event_type === 'CHECKOUT.ORDER.APPROVED') {
    // BUG WH-01: No idempotency check on event.id
    state.fulfillmentCount++;
    state.processedEventIds.push(event.id); // just logs it, doesn't prevent re-processing
  }
  
  res.status(200).json({ status: 'ok' });
});

// Debug endpoints for CrashTest runner assertions
app.get('/api/debug/state', (_req, res) => {
  res.json({
    fulfillmentCount: state.fulfillmentCount,
    processedEventIds: state.processedEventIds,
    capturedOrders: state.capturedOrders,
  });
});

app.post('/api/debug/reset', (_req, res) => {
  state.fulfillmentCount = 0;
  state.processedEventIds = [];
  state.capturedOrders = {};
  res.json({ status: 'reset', state });
});

app.get('/health', (_req, res) => res.json({ status: 'ok', target: 'naive', version: '1.0.0' }));

const PORT = process.env.PORT ?? 3002;
app.listen(PORT, () => console.log(`[naive] Vulnerable target running on :${PORT}`));
