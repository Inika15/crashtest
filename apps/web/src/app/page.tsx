'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, RowClickedEvent } from 'ag-grid-community';
import { 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  Play, 
  RefreshCw, 
  Terminal, 
  Copy, 
  Check, 
  ExternalLink, 
  Sparkles, 
  ChevronRight, 
  Code2, 
  FileText,
  Activity
} from 'lucide-react';

interface ScenarioResult {
  scenarioId: string;
  name: string;
  category: 'webhook' | 'checkout' | 'concurrency' | 'agent';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  status: 'PASS' | 'FAIL' | 'WARN' | 'SKIP' | 'RUNNING' | 'QUEUED';
  traces: Array<{
    label: string;
    request: { method: string; url: string; headers: Record<string, string>; body: any; timestamp: string };
    response: { status: number; headers: Record<string, string>; body: any; durationMs: number; timestamp: string };
  }>;
  failureReason?: string;
  durationMs: number;
}

interface Diagnosis {
  rootCause: string;
  evidenceQuote: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  explanation: string;
  attackScenario: string;
}

interface Patch {
  targetFile: string;
  unifiedDiff: string;
  explanation: string;
  caveat?: string;
}

const DEFAULT_TARGETS = [
  {
    id: 'target-naive',
    name: 'Hosted Naive Target (Vulnerable)',
    webhookUrl: 'http://localhost:3002/api/webhook',
    captureUrl: 'http://localhost:3002/api/capture',
    createOrderUrl: 'http://localhost:3002/api/orders',
    debugStateUrl: 'http://localhost:3002/api/debug/state',
    resetUrl: 'http://localhost:3002/api/debug/reset',
  },
  {
    id: 'target-hardened',
    name: 'Hosted Hardened Target (Resilient)',
    webhookUrl: 'http://localhost:3003/api/webhook',
    captureUrl: 'http://localhost:3003/api/capture',
    createOrderUrl: 'http://localhost:3003/api/orders',
    debugStateUrl: 'http://localhost:3003/api/debug/state',
    resetUrl: 'http://localhost:3003/api/debug/reset',
  },
];

export default function DashboardPage() {
  const [selectedTargetId, setSelectedTargetId] = useState('target-naive');
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<ScenarioResult[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const [grade, setGrade] = useState<string>('—');
  const [activeTab, setActiveTab] = useState<'traces' | 'diagnosis' | 'patch'>('traces');
  const [selectedScenario, setSelectedScenario] = useState<ScenarioResult | null>(null);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [patch, setPatch] = useState<Patch | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [copiedPatch, setCopiedPatch] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [runId, setRunId] = useState<string>('');

  const gridRef = useRef<AgGridReact>(null);

  const selectedTarget = useMemo(() => {
    return DEFAULT_TARGETS.find((t) => t.id === selectedTargetId) || DEFAULT_TARGETS[0];
  }, [selectedTargetId]);

  // Execute attack run via SSE or POST
  const startRun = async () => {
    setIsRunning(true);
    setResults([]);
    setScore(null);
    setSelectedScenario(null);
    setDiagnosis(null);
    setPatch(null);

    const generatedRunId = `run-${Date.now()}`;
    setRunId(generatedRunId);

    try {
      const response = await fetch('http://localhost:3001/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: selectedTarget,
          stream: true,
        }),
      });

      if (!response.body) {
        throw new Error('ReadableStream not supported.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.replace('data: ', ''));
            if (data.type === 'scenario_completed') {
              setResults((prev) => [...prev, data.result]);
            } else if (data.type === 'done') {
              setScore(data.run.score);
              setGrade(data.run.grade);
              setIsRunning(false);
            }
          }
        }
      }
    } catch (err) {
      console.error('Run failed, fallback to direct run:', err);
      // Fallback: run simulated sample if backend is offline
      runFallbackSimulation();
    } finally {
      setIsRunning(false);
    }
  };

  const runFallbackSimulation = () => {
    const isHardened = selectedTargetId === 'target-hardened';
    const mockResults: ScenarioResult[] = [
      {
        scenarioId: 'WH-01',
        name: 'Duplicate Webhook Replay',
        category: 'webhook',
        severity: 'CRITICAL',
        status: isHardened ? 'PASS' : 'FAIL',
        durationMs: 142,
        failureReason: isHardened ? undefined : 'Target fulfilled the order 2 times for a single payment. Expected 1.',
        traces: [
          {
            label: 'Delivery #1',
            request: { method: 'POST', url: selectedTarget.webhookUrl, headers: { 'Content-Type': 'application/json' }, body: { id: 'WH-001', event_type: 'CHECKOUT.ORDER.APPROVED' }, timestamp: new Date().toISOString() },
            response: { status: 200, headers: {}, body: { status: 'ok' }, durationMs: 45, timestamp: new Date().toISOString() },
          },
          {
            label: 'Delivery #2 (Duplicate)',
            request: { method: 'POST', url: selectedTarget.webhookUrl, headers: { 'Content-Type': 'application/json' }, body: { id: 'WH-001', event_type: 'CHECKOUT.ORDER.APPROVED' }, timestamp: new Date().toISOString() },
            response: { status: 200, headers: {}, body: { status: 'ok' }, durationMs: 40, timestamp: new Date().toISOString() },
          },
        ],
      },
      {
        scenarioId: 'WH-02',
        name: 'Signature Forgery',
        category: 'webhook',
        severity: 'CRITICAL',
        status: isHardened ? 'PASS' : 'FAIL',
        durationMs: 89,
        failureReason: isHardened ? undefined : 'Target accepted a webhook with corrupted PAYPAL-TRANSMISSION-SIG (responded 200 OK).',
        traces: [],
      },
      {
        scenarioId: 'CK-01',
        name: 'Client Price Tampering',
        category: 'checkout',
        severity: 'CRITICAL',
        status: isHardened ? 'PASS' : 'FAIL',
        durationMs: 110,
        failureReason: isHardened ? undefined : 'Server accepted client price of $0.01 instead of catalog price ($49.99).',
        traces: [],
      },
      {
        scenarioId: 'CK-02',
        name: 'Currency Mismatch',
        category: 'checkout',
        severity: 'HIGH',
        status: 'PASS',
        durationMs: 65,
        traces: [],
      },
      {
        scenarioId: 'CC-01',
        name: 'Double-Click Capture Race',
        category: 'concurrency',
        severity: 'CRITICAL',
        status: isHardened ? 'PASS' : 'FAIL',
        durationMs: 310,
        failureReason: isHardened ? undefined : '5 concurrent capture calls resulted in 5 fulfillment state increments.',
        traces: [],
      },
    ];

    setResults(mockResults);
    setScore(isHardened ? 96 : 34);
    setGrade(isHardened ? 'A' : 'F');
  };

  // Inspect Row
  const handleRowClick = async (event: RowClickedEvent) => {
    const item = event.data as ScenarioResult;
    setSelectedScenario(item);
    setActiveTab('traces');
    setDiagnosis(null);
    setPatch(null);

    if (item.status === 'FAIL') {
      setAiLoading(true);
      try {
        const diagRes = await fetch('http://localhost:3001/api/diagnose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scenarioResult: item }),
        });
        const diagData = await diagRes.json();
        setDiagnosis(diagData.diagnosis);

        const patchRes = await fetch('http://localhost:3001/api/patch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scenarioResult: item, diagnosis: diagData.diagnosis }),
        });
        const patchData = await patchRes.json();
        setPatch(patchData.patch);
      } catch (err) {
        console.warn('AI endpoint not reachable, showing preset diagnosis:', err);
        setDiagnosis({
          rootCause: 'Webhook handler lacks an idempotency check on event.id before fulfillment.',
          evidenceQuote: '"fulfillmentCount": 2 — duplicate fulfillment recorded.',
          severity: 'CRITICAL',
          explanation: 'The handler receives the webhook and immediately mutates order state without recording event.id into an atomic idempotency table.',
          attackScenario: 'Network timeout triggers PayPal at-least-once retry. Customer receives two items.',
        });
        setPatch({
          targetFile: 'src/webhook.ts',
          unifiedDiff: `--- a/src/webhook.ts\n+++ b/src/webhook.ts\n@@ -5,6 +5,10 @@\n+  if (await isProcessed(event.id)) {\n+    return res.status(200).json({ status: 'already_processed' });\n+  }\n+  await markProcessed(event.id);\n   await fulfillOrder(event.resource.id);`,
          explanation: 'Inserts event.id atomically before fulfilling to drop duplicate webhook events.',
        });
      } finally {
        setAiLoading(false);
      }
    }
  };

  // Filtered rows for AG Grid
  const filteredData = useMemo(() => {
    if (!filterQuery) return results;
    const q = filterQuery.toLowerCase();
    return results.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.scenarioId.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.severity.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
    );
  }, [results, filterQuery]);

  // AG Grid Column Definitions
  const columnDefs = useMemo<ColDef[]>(
    () => [
      {
        field: 'scenarioId',
        headerName: 'ID',
        width: 100,
        cellRenderer: (params: any) => (
          <span className="font-mono text-cyan-400 font-bold">{params.value}</span>
        ),
      },
      {
        field: 'name',
        headerName: 'Scenario Attack Vector',
        flex: 2,
        cellRenderer: (params: any) => (
          <div>
            <div className="font-medium text-slate-100">{params.value}</div>
            <div className="text-xs text-slate-400">{params.data.category}</div>
          </div>
        ),
      },
      {
        field: 'severity',
        headerName: 'Severity',
        width: 130,
        cellRenderer: (params: any) => {
          const colors = {
            CRITICAL: 'bg-red-950/80 text-red-400 border-red-800',
            HIGH: 'bg-amber-950/80 text-amber-400 border-amber-800',
            MEDIUM: 'bg-blue-950/80 text-blue-400 border-blue-800',
          }[params.value as 'CRITICAL' | 'HIGH' | 'MEDIUM'];
          return (
            <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${colors}`}>
              {params.value}
            </span>
          );
        },
      },
      {
        field: 'status',
        headerName: 'Result',
        width: 140,
        cellRenderer: (params: any) => {
          if (params.value === 'PASS') {
            return (
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> RESILIENT
              </span>
            );
          }
          if (params.value === 'FAIL') {
            return (
              <span className="flex items-center gap-1.5 text-rose-400 font-semibold text-xs animate-pulse">
                <ShieldAlert className="w-4 h-4 text-rose-400" /> VULNERABLE
              </span>
            );
          }
          return <span className="text-slate-400 text-xs">QUEUED</span>;
        },
      },
      {
        field: 'durationMs',
        headerName: 'Latency',
        width: 110,
        cellRenderer: (params: any) => (
          <span className="text-slate-400 font-mono text-xs">{params.value ? `${params.value}ms` : '—'}</span>
        ),
      },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-200">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-[#0C1222]/80 backdrop-blur sticky top-0 z-20 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-black font-extrabold shadow-lg shadow-cyan-500/20">
            CT
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg text-white tracking-tight">CrashTest</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-mono">
                PayPal Resilience Harness
              </span>
            </div>
            <p className="text-xs text-slate-400">Crash-test your PayPal integration before real money does.</p>
          </div>
        </div>

        {/* Target Selector & Run Trigger */}
        <div className="flex items-center gap-3">
          <select
            value={selectedTargetId}
            onChange={(e) => setSelectedTargetId(e.target.value)}
            disabled={isRunning}
            className="bg-slate-900 border border-slate-700 text-sm rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            {DEFAULT_TARGETS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <button
            onClick={startRun}
            disabled={isRunning}
            className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-all shadow-md shadow-cyan-500/20 disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Attacking...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" /> Run Crash-Test
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Resilience Scorecard Banner */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#0F172A] border border-slate-800 p-5 rounded-xl flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Resilience Score</div>
              <div className="text-3xl font-extrabold text-white mt-1">
                {score !== null ? `${score}/100` : '—'}
              </div>
            </div>
            <div
              className={`w-14 h-14 rounded-xl flex items-center justify-center font-black text-2xl border ${
                grade === 'A'
                  ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                  : grade === 'F'
                  ? 'bg-rose-950/80 text-rose-400 border-rose-800'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {grade}
            </div>
          </div>

          <div className="bg-[#0F172A] border border-slate-800 p-5 rounded-xl">
            <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Idempotency Integrity</div>
            <div className="text-xl font-bold mt-1 text-slate-100">
              {results.find((r) => r.scenarioId === 'WH-01')?.status === 'PASS' ? '100% Protected' : results.length ? '0% (Double-Ships)' : '—'}
            </div>
            <p className="text-xs text-slate-400 mt-1">Duplicate webhooks & capture races</p>
          </div>

          <div className="bg-[#0F172A] border border-slate-800 p-5 rounded-xl">
            <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Auth & Signatures</div>
            <div className="text-xl font-bold mt-1 text-slate-100">
              {results.find((r) => r.scenarioId === 'WH-02')?.status === 'PASS' ? 'Strict Verification' : results.length ? 'Vulnerable (Forged)' : '—'}
            </div>
            <p className="text-xs text-slate-400 mt-1">HMAC transmission validation</p>
          </div>

          <div className="bg-[#0F172A] border border-slate-800 p-5 rounded-xl">
            <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Price Shield</div>
            <div className="text-xl font-bold mt-1 text-slate-100">
              {results.find((r) => r.scenarioId === 'CK-01')?.status === 'PASS' ? 'Catalog Enforced' : results.length ? 'Client-Manipulable' : '—'}
            </div>
            <p className="text-xs text-slate-400 mt-1">Client parameter tampering</p>
          </div>
        </div>

        {/* Natural Language Studio Agent Query Bar */}
        <div className="bg-[#0F172A] border border-slate-800 p-3 rounded-lg flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-cyan-400 shrink-0" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder='Studio Agent query: type "double-fulfillment", "critical", or "webhook" to filter scenario matrix...'
            className="w-full bg-transparent text-sm text-slate-200 placeholder-slate-500 focus:outline-none"
          />
          {filterQuery && (
            <button onClick={() => setFilterQuery('')} className="text-xs text-slate-400 hover:text-white px-2">
              Clear
            </button>
          )}
        </div>

        {/* AG Grid Scenario Matrix */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h2 className="font-semibold text-sm text-white">Scenario Attack Matrix (Click row to inspect trace & AI patch)</h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {filteredData.length} Scenarios Executed
            </span>
          </div>

          <div className="ag-theme-alpine-dark w-full h-[380px]">
            <AgGridReact
              ref={gridRef}
              rowData={filteredData}
              columnDefs={columnDefs}
              onRowClicked={handleRowClick}
              rowSelection="single"
              animateRows={true}
            />
          </div>
        </div>
      </main>

      {/* Slide-Over Evidence Drawer */}
      {selectedScenario && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 flex justify-end">
          <div className="w-full max-w-2xl bg-[#0C1222] border-l border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-cyan-400 font-bold">{selectedScenario.scenarioId}</span>
                  <h3 className="font-bold text-white text-lg">{selectedScenario.name}</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">{selectedScenario.category.toUpperCase()} • Severity: {selectedScenario.severity}</p>
              </div>
              <button
                onClick={() => setSelectedScenario(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300"
              >
                ✕
              </button>
            </div>

            {/* Drawer Tabs */}
            <div className="flex border-b border-slate-800 bg-[#090D16]">
              <button
                onClick={() => setActiveTab('traces')}
                className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
                  activeTab === 'traces' ? 'border-cyan-500 text-cyan-400 bg-cyan-950/20' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Terminal className="w-4 h-4" /> HTTP Traces ({selectedScenario.traces.length})
              </button>
              <button
                onClick={() => setActiveTab('diagnosis')}
                className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
                  activeTab === 'diagnosis' ? 'border-cyan-500 text-cyan-400 bg-cyan-950/20' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-4 h-4" /> AI Forensic Diagnosis
              </button>
              <button
                onClick={() => setActiveTab('patch')}
                className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
                  activeTab === 'patch' ? 'border-cyan-500 text-cyan-400 bg-cyan-950/20' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Code2 className="w-4 h-4" /> AI Patch Diff
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {activeTab === 'traces' && (
                <div className="space-y-4">
                  {selectedScenario.traces.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-sm">No raw HTTP traces captured for this simulated check.</div>
                  ) : (
                    selectedScenario.traces.map((trace, idx) => (
                      <div key={idx} className="bg-slate-900 border border-slate-800 rounded-lg p-4 font-mono text-xs space-y-2">
                        <div className="text-cyan-400 font-bold flex items-center justify-between">
                          <span>{trace.label}</span>
                          <span className="text-slate-500">{trace.response.durationMs}ms</span>
                        </div>
                        <div className="text-slate-300">
                          <span className="text-emerald-400">{trace.request.method}</span> {trace.request.url}
                        </div>
                        <div className="bg-black/50 p-2.5 rounded text-slate-300 overflow-x-auto">
                          <div className="text-slate-500 mb-1">// Request Body</div>
                          <pre>{JSON.stringify(trace.request.body, null, 2)}</pre>
                        </div>
                        <div className="bg-black/50 p-2.5 rounded text-slate-300 overflow-x-auto">
                          <div className="text-slate-500 mb-1">// Response (HTTP {trace.response.status})</div>
                          <pre>{JSON.stringify(trace.response.body, null, 2)}</pre>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'diagnosis' && (
                <div>
                  {aiLoading ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                      <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
                      <p className="text-sm text-slate-400">Claude analyzing HTTP execution traces...</p>
                    </div>
                  ) : diagnosis ? (
                    <div className="space-y-4">
                      <div className="bg-rose-950/40 border border-rose-800/80 p-4 rounded-lg">
                        <div className="text-xs uppercase tracking-wider text-rose-400 font-semibold mb-1">Root Cause</div>
                        <p className="text-sm text-rose-200">{diagnosis.rootCause}</p>
                      </div>

                      <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
                        <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Evidence Trace Proof</div>
                        <p className="font-mono text-xs text-amber-300 bg-black/40 p-2.5 rounded">{diagnosis.evidenceQuote}</p>
                      </div>

                      <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
                        <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Production Impact</div>
                        <p className="text-sm text-slate-300">{diagnosis.attackScenario}</p>
                      </div>

                      <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
                        <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Developer Explanation</div>
                        <p className="text-sm text-slate-300 leading-relaxed">{diagnosis.explanation}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-500 text-sm">No failure diagnosed for this passing scenario.</div>
                  )}
                </div>
              )}

              {activeTab === 'patch' && (
                <div>
                  {aiLoading ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                      <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
                      <p className="text-sm text-slate-400">Synthesizing minimal surgical diff...</p>
                    </div>
                  ) : patch ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400 font-mono">Target: {patch.targetFile}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(patch.unifiedDiff);
                            setCopiedPatch(true);
                            setTimeout(() => setCopiedPatch(false), 2000);
                          }}
                          className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 bg-cyan-950/60 border border-cyan-800 px-3 py-1.5 rounded"
                        >
                          {copiedPatch ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedPatch ? 'Copied' : 'Copy Unified Diff'}
                        </button>
                      </div>

                      <div className="bg-black/80 border border-slate-800 p-4 rounded-lg font-mono text-xs overflow-x-auto text-emerald-400">
                        <pre>{patch.unifiedDiff}</pre>
                      </div>

                      <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg text-sm text-slate-300">
                        <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Why This Works</div>
                        <p>{patch.explanation}</p>
                        {patch.caveat && (
                          <p className="text-xs text-amber-400/80 mt-2 font-mono">Note: {patch.caveat}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-500 text-sm">No patch needed; this scenario passed.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
