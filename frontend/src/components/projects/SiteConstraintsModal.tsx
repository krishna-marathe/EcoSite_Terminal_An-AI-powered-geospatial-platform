import React from 'react';
import type { CandidateSite } from '../../services/projects';
import type { Observation } from '../../services/observations';
import type { Assertion } from '../../types/evidence';
import { evaluateSiteConstraints, type ConstraintStatus } from '../../domain/constraints';
import { Button } from '../ui/Button';

interface SiteConstraintsModalProps {
  isOpen: boolean;
  onClose: () => void;
  site: CandidateSite;
  observations?: Observation[];
  assertions?: Assertion[];
}

function renderStatusBadge(status: ConstraintStatus) {
  switch (status) {
    case 'BLOCKED':
      return (
        <span className="rounded bg-rose-500/15 border border-rose-500/40 px-2 py-0.5 text-micro font-mono font-bold text-rose-300">
          BLOCKED
        </span>
      );
    case 'ATTENTION_REQUIRED':
      return (
        <span className="rounded bg-amber-500/15 border border-amber-500/40 px-2 py-0.5 text-micro font-mono font-bold text-amber-300">
          ATTENTION REQUIRED
        </span>
      );
    case 'CLEAR':
      return (
        <span className="rounded bg-emerald-500/15 border border-emerald-500/40 px-2 py-0.5 text-micro font-mono font-bold text-emerald-300">
          CLEAR
        </span>
      );
    case 'UNKNOWN':
      return (
        <span className="rounded bg-slate-500/15 border border-slate-500/40 px-2 py-0.5 text-micro font-mono font-bold text-slate-400">
          UNKNOWN
        </span>
      );
    default:
      return null;
  }
}

export function SiteConstraintsModal({
  isOpen,
  onClose,
  site,
  observations = [],
  assertions = [],
}: SiteConstraintsModalProps) {
  if (!isOpen) return null;

  const evaluation = evaluateSiteConstraints(site, observations, assertions);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="constraints-modal-title"
    >
      <div className="w-full max-w-4xl rounded-lg border border-eco-border bg-eco-surface shadow-2xl p-6 space-y-5 my-8">
        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-eco-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-eco-primary">
                Site Eligibility Gate Engine
              </span>
              <span className="text-xs text-eco-muted font-mono">
                Site ID: {site.id.substring(0, 8)}…
              </span>
            </div>
            <h2 id="constraints-modal-title" className="text-xl font-bold text-slate-100 tracking-tight mt-1">
              Explainable Hard Constraints: {site.name}
            </h2>
            <p className="text-xs text-eco-muted mt-0.5">
              {site.area_ha.toFixed(2)} ha · {site.state_code}
              {site.district ? ` · ${site.district}` : ''} · Boundary: {site.boundary_source}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] text-eco-muted uppercase block">Overall Status</span>
              {renderStatusBadge(evaluation.overall_status)}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close constraints modal"
              className="text-slate-400 hover:text-slate-100 text-lg p-1 ml-2"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Epistemic Rationale Banner */}
        <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          <p className="font-semibold uppercase tracking-wider text-[11px] text-amber-400">
            ⚠️ Grounded Pre-Investment Screening Criteria
          </p>
          <p className="mt-1 leading-relaxed">
            Hard constraints evaluate binary disqualifiers and supply bottlenecks. Substation proximity <strong>never</strong> guarantees available line MW. Missing data evaluates strictly to <strong>UNKNOWN</strong>, never to zero flood risk or synthetic safety.
          </p>
        </div>

        {/* Gate Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
          <div className="p-2 rounded bg-eco-surface-2 border border-eco-border">
            <span className="text-eco-muted text-[10px] uppercase block">Blocked Gates</span>
            <strong className={`text-base font-mono ${evaluation.blocked_count > 0 ? 'text-rose-400 font-bold' : 'text-slate-300'}`}>
              {evaluation.blocked_count}
            </strong>
          </div>
          <div className="p-2 rounded bg-eco-surface-2 border border-eco-border">
            <span className="text-eco-muted text-[10px] uppercase block">Attention Needed</span>
            <strong className={`text-base font-mono ${evaluation.attention_count > 0 ? 'text-amber-400 font-bold' : 'text-slate-300'}`}>
              {evaluation.attention_count}
            </strong>
          </div>
          <div className="p-2 rounded bg-eco-surface-2 border border-eco-border">
            <span className="text-eco-muted text-[10px] uppercase block">Clear Gates</span>
            <strong className="text-base font-mono text-emerald-400 font-bold">
              {evaluation.clear_count}
            </strong>
          </div>
          <div className="p-2 rounded bg-eco-surface-2 border border-eco-border">
            <span className="text-eco-muted text-[10px] uppercase block">Unknown / Unrun</span>
            <strong className={`text-base font-mono ${evaluation.unknown_count > 0 ? 'text-slate-400' : 'text-slate-500'}`}>
              {evaluation.unknown_count}
            </strong>
          </div>
        </div>

        {/* Rule Evaluation Table */}
        <div className="overflow-x-auto rounded border border-eco-border">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-eco-surface-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-eco-border">
              <tr>
                <th className="p-2.5">Gate / Rule</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5">Observed Input</th>
                <th className="p-2.5">Threshold</th>
                <th className="p-2.5">Authoritative Rationale & Provenance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-eco-border/60">
              {evaluation.rules.map((rule) => (
                <tr key={rule.rule_id} className="hover:bg-eco-surface-2/40">
                  <td className="p-2.5">
                    <strong className="text-slate-100 block">{rule.rule_name}</strong>
                    <span className="text-[10px] font-mono text-eco-muted">
                      {rule.rule_id} · {rule.category}
                    </span>
                  </td>

                  <td className="p-2.5 whitespace-nowrap">
                    {renderStatusBadge(rule.status)}
                  </td>

                  <td className="p-2.5 font-mono text-[11px] text-slate-200">
                    {rule.input_value}
                  </td>

                  <td className="p-2.5 font-mono text-[11px] text-eco-muted">
                    {rule.threshold}
                  </td>

                  <td className="p-2.5 max-w-sm">
                    <p className="text-slate-200 text-[11px]">{rule.rationale}</p>
                    <p className="text-[10px] text-eco-muted mt-1 font-mono">
                      Source: {rule.source}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modal Actions */}
        <div className="flex justify-end pt-2 border-t border-eco-border">
          <Button type="button" onClick={onClose} className="border-eco-border text-xs px-4">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

