export { wh01DuplicateReplay } from './webhook/wh01-duplicate-replay.js';
export { wh02SignatureForgery } from './webhook/wh02-signature-forgery.js';
export { wh03PayloadTamper } from './webhook/wh03-payload-tamper.js';
export { wh04LifecycleInversion } from './webhook/wh04-lifecycle-inversion.js';
export { ck01PriceTamper } from './checkout/ck01-price-tamper.js';
export { ck02CurrencyMismatch } from './checkout/ck02-currency-mismatch.js';
export { ck03ReplayCapture } from './checkout/ck03-replay-capture.js';
export { cc01DoubleClickRace } from './concurrency/cc01-double-click-race.js';
export { ag01PromptOverride } from './agent/ag01-prompt-override.js';

import { Scenario } from '@crashtest/runner';
import { wh01DuplicateReplay } from './webhook/wh01-duplicate-replay.js';
import { wh02SignatureForgery } from './webhook/wh02-signature-forgery.js';
import { wh03PayloadTamper } from './webhook/wh03-payload-tamper.js';
import { wh04LifecycleInversion } from './webhook/wh04-lifecycle-inversion.js';
import { ck01PriceTamper } from './checkout/ck01-price-tamper.js';
import { ck02CurrencyMismatch } from './checkout/ck02-currency-mismatch.js';
import { ck03ReplayCapture } from './checkout/ck03-replay-capture.js';
import { cc01DoubleClickRace } from './concurrency/cc01-double-click-race.js';
import { ag01PromptOverride } from './agent/ag01-prompt-override.js';

export const ALL_SCENARIOS: Scenario[] = [
  wh01DuplicateReplay,
  wh02SignatureForgery,
  wh03PayloadTamper,
  wh04LifecycleInversion,
  ck01PriceTamper,
  ck02CurrencyMismatch,
  ck03ReplayCapture,
  cc01DoubleClickRace,
  ag01PromptOverride,
];
