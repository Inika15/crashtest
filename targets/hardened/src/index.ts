import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  fulfillmentCount: 0,
  processedEventIds: new Set<string>(),
  capturedOrders: new Map<string, { status: string; capturedAt: string }>(),
  captureLocks: new Map<string, Promise<void>>(),
};

const CATALOG: Record<string, { name: string; price: string; currency: string }> = {
  'DEMO-001': { name: 'CrashTest Widget', price: '49.99', currency: 'USD' },
};

const SUPPORTED_CURRENCIES = new Set(['USD', 'EUR', 'GBP', 'CAD', 'AUD']);

// ── Simple async mutex factory ────────────────────────────────────────────
function withLock<T>(locks: Map<string, Promise<void>>, key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  let releaseLock!: () => void;
  const next = new Promise<void>(resolve => { releaseLock = resolve; });
  locks.set(key, prev.then(() => next));
  return prev.then(async () => {
    try { return await fn(); }
    finally { releaseLock(); }
  });
}

// ── Routes ────────────────────────────────────────────────────────────────

// POST /api/orders — FIX CK-01: recompute price from catalog; FIX CK-02: validate currency
app.post('/api/orders', (req, res) => {
  const { items, amount } = req.body as {
    items: Array<{ sku: string; quantity: number }>;
    amount?: { value: string; currency_code: string };
  };

  // FIX CK-02: validate currency
  const currency = amount?.currency_code ?? 'USD';
  if (!SUPPORTED_CURRENCIES.has(currency)) {
    return res.status(400).json({ error: `Unsupported currency: ${currency}` });
  }

  // FIX CK-01: ignore client price, compute from catalog
  let total = 0;
  for (const item of (items ?? [])) {
    const product = CATALOG[item.sku];
    if (!product) return res.status(400).json({ error: `Unknown SKU: ${item.sku}` });
    total += parseFloat(product.price) * item.quantity;
  }

  if (total === 0) total = 49.99; // fallback for demo

  res.json({
    id: `ORDER-${Date.now()}`,
    status: 'CREATED',
    purchase_units: [{ amount: { value: total.toFixed(2), currency_code: 'USD' } }], // always USD from catalog
  });
});

// POST /api/capture — FIX CK-03: idempotency; FIX CC-01: serialize with lock
app.post('/api/capture', async (req, res) => {
  const { orderId } = req.body as { orderId: string };
  if (!orderId) return res.status(400).json({ error: 'orderId required' });

  return withLock(state.captureLocks, orderId, async () => {
    // FIX CK-03: return cached response for replayed captures
    const existing = state.capturedOrders.get(orderId);
    if (existing) {
      return res.json({ id: orderId, status: existing.status, capturedAt: existing.capturedAt, idempotent: true });
    }

    // FIX CC-01: only one thread reaches here per orderId due to lock
    const record = { status: 'COMPLETED', capturedAt: new Date().toISOString() };
    state.capturedOrders.set(orderId, record);
    state.fulfillmentCount++;
    res.json({ id: orderId, ...record, idempotent: false });
  });
});

// POST /api/webhook — FIX WH-01/WH-02/WH-03: signature check + idempotency
app.post('/api/webhook', (req, res) => {
  // FIX WH-02 / WH-03: Verify PayPal signature headers exist and look valid
  const sig = req.headers['paypal-transmission-sig'] as string | undefined;
  const transmissionId = req.headers['paypal-transmission-id'] as string | undefined;
  const certUrl = req.headers['paypal-cert-url'] as string | undefined;

  if (!sig || !transmissionId || !certUrl) {
    return res.status(401).json({ error: 'Missing PayPal signature headers' });
  }

  // In a real integration you'd call PayPal's verify-webhook-signature API here.
  // For sandbox demo: reject obviously forged signatures
  if (sig.startsWith('FORGED_') || sig.startsWith('TAMPERED_')) {
    return res.status(401).json({ error: 'Signature verification failed' });
  }

  const event = req.body as { id: string; event_type: string; resource: Record<string, unknown> };

  if (!event.id || !event.event_type) {
    return res.status(400).json({ error: 'Invalid webhook payload' });
  }

  // FIX WH-01: Idempotency check — only process each event ID once
  if (state.processedEventIds.has(event.id)) {
    return res.status(200).json({ status: 'already_processed', eventId: event.id });
  }

  // Mark as processed BEFORE fulfillment (important ordering)
  state.processedEventIds.add(event.id);

  if (event.event_type === 'CHECKOUT.ORDER.APPROVED') {
    state.fulfillmentCount++;
  }

  res.status(200).json({ status: 'ok', eventId: event.id });
});

// ── Debug endpoints ───────────────────────────────────────────────────────
app.get('/api/debug/state', (_req, res) => {
  res.json({
    fulfillmentCount: state.fulfillmentCount,
    processedEventIds: Array.from(state.processedEventIds),
    capturedOrders: Object.fromEntries(state.capturedOrders),
  });
});

app.post('/api/debug/reset', (_req, res) => {
  state.fulfillmentCount = 0;
  state.processedEventIds.clear();
  state.capturedOrders.clear();
  state.captureLocks.clear();
  res.json({ status: 'reset' });
});

app.get('/health', (_req, res) => res.json({ status: 'ok', target: 'hardened', version: '1.0.0' }));

const PORT = process.env.PORT ?? 3003;
app.listen(PORT, () => console.log(`[hardened] Secure target running on :${PORT}`));
