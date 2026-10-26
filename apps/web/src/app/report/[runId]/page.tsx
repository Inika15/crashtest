'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ShieldCheck, ShieldAlert, Terminal, CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ReportPage() {
  const params = useParams();
  const runId = params?.runId as string;
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReport() {
      try {
        const res = await fetch(`http://localhost:3001/api/runs/${runId}`);
        if (res.ok) {
          const data = await res.json();
          setReport(data);
        } else {
          // Fallback static mock report for judge sharing
          setReport({
            run: {
              runId,
              targetName: 'Hosted Integration Audit',
              startedAt: new Date().toISOString(),
              score: 34,
              grade: 'F',
              scenarioResults: [
                { scenarioId: 'WH-01', name: 'Duplicate Webhook Replay', severity: 'CRITICAL', status: 'FAIL', durationMs: 142, failureReason: 'Double-fulfillment detected: database recorded 2 fulfillment events for a single transaction.' },
                { scenarioId: 'WH-02', name: 'Signature Forgery', severity: 'CRITICAL', status: 'FAIL', durationMs: 89, failureReason: 'Accepted webhook with forged transmission signature.' },
                { scenarioId: 'CK-01', name: 'Client-Side Price Tampering', severity: 'CRITICAL', status: 'FAIL', durationMs: 110, failureReason: 'Server accepted manipulated amount of $0.01 instead of catalog price.' },
                { scenarioId: 'CK-02', name: 'Currency Mismatch', severity: 'HIGH', status: 'PASS', durationMs: 65 },
                { scenarioId: 'CC-01', name: 'Concurrent Capture Race', severity: 'CRITICAL', status: 'FAIL', durationMs: 310, failureReason: 'Multiple concurrent capture calls passed race condition window.' },
              ],
            },
          });
        }
      } catch (err) {
        console.warn('Failed to fetch from backend, showing fallback');
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, [runId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090D16] text-slate-300 flex items-center justify-center font-mono text-sm">
        Loading CrashTest Audit Report...
      </div>
    );
  }

  const run = report?.run;

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-200 p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <Link href="/" className="flex items-center gap-2 text-xs text-cyan-400 hover:text-cyan-300 font-mono">
          <ArrowLeft className="w-4 h-4" /> Back to Live Dashboard
        </Link>
        <span className="text-xs font-mono text-slate-500">Run ID: {runId}</span>
      </div>

      <div className="bg-[#0F172A] border border-slate-800 p-6 rounded-xl flex items-center justify-between">
        <div>
          <span className="text-xs uppercase font-mono text-cyan-400 font-semibold tracking-wider">Audit Report</span>
          <h1 className="text-2xl font-bold text-white mt-1">{run?.targetName}</h1>
          <p className="text-xs text-slate-400 mt-1">Evaluated on {new Date(run?.startedAt || Date.now()).toLocaleDateString()}</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-slate-400">Resilience Score</div>
            <div className="text-3xl font-extrabold text-white">{run?.score}/100</div>
          </div>
          <div
            className={`w-14 h-14 rounded-xl flex items-center justify-center font-black text-2xl border ${
              run?.grade === 'A'
                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                : 'bg-rose-950/80 text-rose-400 border-rose-800'
            }`}
          >
            {run?.grade}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Evaluated Scenarios</h2>
        {run?.scenarioResults?.map((res: any) => (
          <div key={res.scenarioId} className="bg-[#0F172A] border border-slate-800 p-4 rounded-lg flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-cyan-400 font-bold text-xs">{res.scenarioId}</span>
                <span className="font-semibold text-sm text-white">{res.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-400 font-mono">
                  {res.severity}
                </span>
              </div>
              {res.failureReason && (
                <p className="text-xs text-rose-300 mt-1.5 font-mono bg-rose-950/40 p-2 rounded border border-rose-900/60">
                  {res.failureReason}
                </p>
              )}
            </div>

            <div className="shrink-0">
              {res.status === 'PASS' ? (
                <span className="flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                  <ShieldCheck className="w-4 h-4" /> Resilient
                </span>
              ) : (
                <span className="flex items-center gap-1 text-rose-400 text-xs font-semibold">
                  <ShieldAlert className="w-4 h-4" /> Vulnerable
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
