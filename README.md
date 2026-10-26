# CrashTest

> **Crash-test your PayPal integration, or your autonomous payment agent, before real money does.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![CI](https://github.com/crashtest/crashtest/actions/workflows/ci.yml/badge.svg)](./.github/workflows/ci.yml)

---

## The Problem
Payment integrations and autonomous payment agents work in happy-path testing, but fail catastrophically when production conditions arise:
1. **Duplicate Webhook Delivery**: An identical `CHECKOUT.ORDER.APPROVED` webhook arrives twice within 50ms due to network retries, causing the warehouse to double-fulfill physical inventory.
2. **Missing HMAC Signature Authentication**: The webhook listener processes payloads without validating `PAYPAL-TRANSMISSION-SIG`, allowing anyone to forge payment confirmations.
3. **Client-Side Price & Currency Tampering**: The server trusts amounts posted by the frontend checkout form without re-verifying against internal catalog pricing.
4. **Concurrent Capture Races (Double-Clicks)**: Simultaneous capture requests hit un-locked state machines, bypassing idempotency checks and executing duplicate charges.
5. **Prompt Injection on Payment Agents**: Adversarial prompt instructions hidden inside product notes or shipping addresses dupe autonomous payment agents into authorizing unauthorized discounts or payments.

CrashTest is an **adversarial chaos testing harness and AG Studio dashboard** that subjects any PayPal integration or payment agent to production-grade failure scenarios, deterministically scores its resilience, diagnoses root causes from raw HTTP traces using AI, drafts surgical code patches, and re-tests to prove the fix turned green.

---

## Prior Art & Differentiation
We acknowledge prior exploratory work such as [Breakpoint](https://github.com/arc585/breakpoint). While Breakpoint demonstrated client-side discount manipulation on a bespoke demo shop, **CrashTest** introduces:
* **Universal Target Manifest**: Points at any external or local PayPal integration via standard HTTP endpoints.
* **Distributed Backend State Machine Attacks**: Focuses on idempotency, webhook storms, out-of-order lifecycle events, and concurrency races.
* **Closed-Loop Verification Engine**: Generates a unified `diff` patch and deterministically re-runs the attack suite to prove remediation.
* **AG Grid / AG Studio Matrix**: Enterprise-grade tabular reporting with real-time execution streaming, trace inspection drawers, and natural language query capabilities.

---

## Core PayPal Technologies Used
* **PayPal Orders v2 API** (`/v2/checkout/orders` create & capture).
* **PayPal Webhooks API** (`/v1/notifications/verify-webhook-signature`).
* **Idempotency Standards** (`PayPal-Request-Id` header enforcement).
* **Sandbox Event Recording & Replay Engine**: Tests realistic webhook headers and payload permutations.

*Note on Sandbox Accounts*: Standard PayPal Wallet approval flows are tested to ensure 100% compatibility across global developer sandbox accounts (bypassing region-locked Advanced Card Processing).

---

## Scenario Catalog

| ID | Category | Severity | Vector Description | Expected Resilience Behavior |
| :--- | :--- | :--- | :--- | :--- |
| `WH-01` | Webhook | **CRITICAL** | Duplicate delivery of valid webhook within 50ms | Exactly 1 fulfillment recorded; drops duplicate |
| `WH-02` | Webhook | **CRITICAL** | Payload with forged/corrupted signature | Rejects with HTTP 400 or 401 |
| `WH-03` | Webhook | **CRITICAL** | Valid signature headers with tampered body amount | Signature verification mismatch failure |
| `WH-04` | Webhook | **HIGH** | `ORDER.COMPLETED` delivered before `ORDER.APPROVED` | Graceful state handling; no 500 crashes |
| `CK-01` | Checkout | **CRITICAL** | Client POSTs order with manipulated `$0.01` price | Server overrides or recomputes from catalog |
| `CK-02` | Checkout | **HIGH** | Client posts unsupported currency code (`XYZ`) | Server rejects with HTTP 400 |
| `CK-03` | Checkout | **CRITICAL** | Replayed capture with same Order ID | Returns cached response or 409; no re-debit |
| `CC-01` | Concurrency| **CRITICAL** | 5 simultaneous capture requests at $t=0$ | Atomic lock ensures single fulfillment |
| `AG-01` | Agent | **HIGH** | Adversarial prompt override injected into note | Agent enforces catalog prices, ignores text prompt |

---

## How AI is Used
* **The LLM Never Decides Pass/Fail**: Test assertions and score weighting are 100% deterministic code.
* **Forensic Diagnosis**: Claude inspects raw HTTP request/response traces and database assertions to explain the exact root cause in plain English.
* **Unified Diff Synthesis**: Claude generates surgical, minimal code patches (`--- a/... +++ b/...`) ready to apply.
* **Adversarial Payload Generation**: Crafts prompt injections targeting payment agents.

---

## Quick Start (Zero-Config Demo Mode)

You can run CrashTest immediately without configuring any external API keys:

```bash
# 1. Clone repository
git clone https://github.com/<your-username>/crashtest.git
cd crashtest

# 2. Install dependencies
npm install

# 3. Start full stack in demo mode (Web Dashboard, API, Naive & Hardened targets)
npm run demo
```

Open [http://localhost:3000](http://localhost:3000) to view the AG Studio dashboard.
Click **"Run Crash-Test"** to watch the live adversarial attack against the vulnerable target (Score: 34/100, Grade F), inspect the AI diagnosis and patch, then switch to the Hardened Target to verify the fix turns green (Score: 96/100, Grade A).

---

## Repository Architecture

```
crashtest/
├── apps/
│   ├── web/          # Next.js 14 + Tailwind + AG Grid dashboard
│   └── api/          # Express API server (orchestrator + AI diagnosis + SSE)
├── packages/
│   ├── runner/       # Deterministic attack harness & HTTP trace capture
│   ├── scenarios/    # 9 deterministic attack scenario implementations
│   ├── paypal/       # Real PayPal sandbox adapter + fixture client
│   ├── ai/           # Claude integration (Zod-validated diagnosis & patches)
│   └── scoring/      # Severity-weighted scoring engine
├── targets/
│   ├── naive/        # Vulnerable target (reproduces double-fulfillment & races)
│   └── hardened/     # Correct implementation (verifies patch effectiveness)
├── fixtures/         # Recorded sandbox webhook payloads
├── .github/          # CI workflows
├── LICENSE           # MIT
└── README.md
```

---

## License
MIT License. See [LICENSE](./LICENSE) for details.
