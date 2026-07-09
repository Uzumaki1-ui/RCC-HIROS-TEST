"use client";

import { useEffect, useState, useMemo, useCallback, type ReactNode } from "react";
import {
  Plus, Search, ArrowLeft, Save, AlertTriangle, Power, ClipboardList,
  CheckCircle2, FileText, Info, Trash2,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { usePermissions } from "@/hooks/use-permissions";
import {
  usePagination,
  PaginationControls,
} from "@/components/shared/table-pagination-v2";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface EvalCriterion {
  id: string;
  category: string;
  description: string;
  maxScore: number;
  weight: number;
  sortOrder: number;
}

interface EvalForm {
  id: string;
  name: string;
  version: number;
  active: boolean;
  criteria?: EvalCriterion[]; // Only present when fetched from /api/evaluation-forms/[id]
  criteriaCount?: number; // Present when fetched from /api/evaluation-forms (list)
}

interface EvalPeriod {
  id: string;
  formId: string;
  form?: { id: string; name: string; active: boolean };
  name: string;
  startDate: string;
  endDate: string;
  status: "open" | "closed" | "archived";
  createdAt: string;
  evaluationsCount?: number;
}

interface EvalResponse {
  id: string;
  criterionId: string;
  score: number;
  comments: string | null;
  criterion?: { id: string; category: string; description: string; maxScore: number; weight: number; sortOrder: number };
}

interface Evaluation {
  id: string;
  periodId: string;
  formId: string;
  evaluatorId: string;
  evaluator: { id: string; name: string } | null;
  employeeId: string;
  employee: { id: string; name: string; employeeId: string; groupId: string | null } | null;
  status: "draft" | "submitted" | "acknowledged";
  totalScore: number | null;
  remarks: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  form: { id: string; name: string } | null;
  period: { id: string; name: string; status: string } | null;
  responses: EvalResponse[];
}

interface EmployeeBrief {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  groupId: string | null;
}

const inputClass =
  "w-full px-3 py-2 bg-rcc-bg border border-rcc-border rounded-md text-sm text-rcc-text-primary focus:outline-none focus:ring-2 focus:ring-rcc-accent/40";

// 5 categories × 2 criteria each = 10 fixed criteria
const EVAL_CATEGORIES = [
  "Teaching Competence",
  "Professionalism",
  "Student Engagement",
  "Administrative Duties",
  "Continuous Improvement",
];

// ═══════════════════════════════════════════════════════════════
// EvaluationFormsPage — simplified to just period management
// ═══════════════════════════════════════════════════════════════

export function EvaluationFormsPage() {
  const { has } = usePermissions();
  const { setCurrentPage } = useAuthStore();
  const [periods, setPeriods] = useState<EvalPeriod[]>([]);
  const [forms, setForms] = useState<EvalForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resettingPeriodId, setResettingPeriodId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [retentionMonths, setRetentionMonths] = useState(12);
  const [retentionSaving, setRetentionSaving] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, f, r] = await Promise.all([
        apiFetch<{ periods: EvalPeriod[] }>("/api/evaluation-periods"),
        apiFetch<{ forms: EvalForm[] }>("/api/evaluation-forms"),
        apiFetch<{ retentionMonths: number }>("/api/evaluations/cleanup").catch(() => ({ retentionMonths: 12 })),
      ]);
      setPeriods(p.periods ?? []);
      setForms(f.forms ?? []);
      setRetentionMonths(r.retentionMonths ?? 12);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeForm = forms.find((f) => f.active) ?? forms[0];

  const handleToggle = async (p: EvalPeriod) => {
    setTogglingId(p.id);
    const next = p.status === "open" ? "closed" : "open";
    try {
      await apiFetch(`/api/evaluation-periods/${p.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Toggle failed.");
    } finally {
      setTogglingId(null);
    }
  };

  const handleReset = async () => {
    if (!confirm("WARNING: This will permanently delete ALL submitted evaluations. This cannot be undone. Are you sure?")) return;
    if (!confirm("Last chance — this deletes every evaluation response in the system. Continue?")) return;
    setResetting(true);
    setError(null);
    try {
      await apiFetch("/api/evaluations/reset", {
        method: "POST",
        body: JSON.stringify({ confirm: true }),
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed.");
    } finally {
      setResetting(false);
    }
  };

  const handleAddPeriod = async () => {
    if (!newName.trim()) return setError("Period name is required.");
    if (!activeForm) return setError("No active evaluation form found.");
    setSaving(true);
    setError(null);
    try {
      const today = new Date();
      const end = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
      await apiFetch("/api/evaluation-periods", {
        method: "POST",
        body: JSON.stringify({
          formId: activeForm.id,
          name: newName.trim(),
          startDate: today.toISOString(),
          endDate: end.toISOString(),
          status: "closed",
        }),
      });
      setNewName("");
      setShowAdd(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create period.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetPeriod = async (periodId: string, periodName: string) => {
    if (!confirm(`Delete all evaluations for "${periodName}"? This cannot be undone.`)) return;
    setResettingPeriodId(periodId);
    setError(null);
    try {
      await apiFetch(`/api/evaluation-periods/${periodId}/reset`, { method: "POST" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed.");
    } finally {
      setResettingPeriodId(null);
    }
  };

  const handleSaveRetention = async () => {
    setRetentionSaving(true);
    setError(null);
    try {
      await apiFetch("/api/evaluations/cleanup", {
        method: "PATCH",
        body: JSON.stringify({ retentionMonths }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save retention setting.");
    } finally {
      setRetentionSaving(false);
    }
  };

  const handleCleanup = async () => {
    if (!confirm(`Delete all evaluations older than ${retentionMonths} months? This cannot be undone.`)) return;
    setCleaningUp(true);
    setCleanupResult(null);
    setError(null);
    try {
      const result = await apiFetch<{ deletedEvaluations: number; retentionMonths: number }>("/api/evaluations/cleanup", { method: "POST" });
      setCleanupResult(`Deleted ${result.deletedEvaluations} evaluation(s) older than ${result.retentionMonths} months.`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cleanup failed.");
    } finally {
      setCleaningUp(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-rcc-text-primary">Evaluation Management</h1>
          <p className="text-sm text-rcc-text-muted mt-0.5">
            Toggle evaluation periods on/off. When ON, Deans can evaluate. When OFF, evaluation is closed.
          </p>
        </div>
        {has("evaluation.manage_forms") && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="inline-flex items-center gap-2 bg-rcc-primary text-rcc-primary-foreground px-4 py-2 rounded-md text-sm font-semibold hover:bg-rcc-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" /> {showAdd ? "Cancel" : "New Period"}
          </button>
        )}
      </div>

      {showAdd && (
        <div className="bg-rcc-surface rounded-lg border border-rcc-border p-4 flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Period name (e.g., 2nd Semester 2026)"
            className={inputClass}
            onKeyDown={(e) => e.key === "Enter" && handleAddPeriod()}
          />
          <button
            onClick={handleAddPeriod}
            disabled={saving || !newName.trim()}
            className="px-4 py-2 rounded-md text-sm font-semibold bg-rcc-primary text-rcc-primary-foreground hover:bg-rcc-primary/90 disabled:opacity-50 shrink-0"
          >
            {saving ? "Creating..." : "Create"}
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-rcc-error">{error}</div>
      )}

      {/* Info card */}
      <div className="bg-rcc-surface rounded-lg border border-rcc-border p-5 flex items-start gap-3">
        <div className="w-9 h-9 rounded-md bg-rcc-accent/10 text-rcc-accent flex items-center justify-center shrink-0">
          <Info className="h-5 w-5" />
        </div>
        <div className="text-sm">
          <p className="font-semibold text-rcc-text-primary">Fixed 10-Criteria Evaluation Form</p>
          <p className="text-rcc-text-muted mt-1">
            All evaluations use the same fixed 10-criteria form across 5 categories:
            <span className="text-rcc-text-secondary"> {EVAL_CATEGORIES.join(" · ")}</span>.
            Each criterion is scored 1–5. The total score is a weighted average.
          </p>
          {activeForm && (
            <p className="text-xs text-rcc-text-muted mt-2">
              Active form: <span className="font-mono">{activeForm.name}</span> (v{activeForm.version}) · {activeForm.criteriaCount ?? 0} criteria
            </p>
          )}
        </div>
      </div>

      {/* Period cards — simple toggle design */}
      {loading ? (
        <div className="text-center py-12 text-rcc-text-muted">Loading...</div>
      ) : periods.length === 0 ? (
        <div className="bg-rcc-surface rounded-lg border border-rcc-border p-8 text-center text-rcc-text-muted">
          No evaluation periods found.
        </div>
      ) : (
        <div className="space-y-4">
          {periods.map((p) => (
            <div key={p.id} className="bg-rcc-surface rounded-lg border border-rcc-border p-6 flex items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-rcc-text-primary">{p.name}</h3>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    p.status === "open" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${p.status === "open" ? "bg-green-500" : "bg-gray-400"}`}></span>
                    {p.status === "open" ? "Open" : "Closed"}
                  </span>
                </div>
                <p className="text-sm text-rcc-text-muted mt-1">
                  {p.status === "open"
                    ? "Evaluation is active — Deans can submit evaluations."
                    : "Evaluation is closed — Deans cannot submit."}
                </p>
                {p.evaluationsCount !== undefined && p.evaluationsCount > 0 && (
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-xs text-rcc-text-muted">{p.evaluationsCount} evaluation(s) submitted</p>
                    {has("evaluation.reset") && (
                      <button
                        onClick={() => handleResetPeriod(p.id, p.name)}
                        disabled={resettingPeriodId === p.id}
                        className="text-xs text-red-600 hover:underline disabled:opacity-50"
                      >
                        {resettingPeriodId === p.id ? "Clearing..." : "Clear this period"}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleToggle(p)}
                disabled={togglingId === p.id}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors shrink-0 disabled:opacity-50 ${
                  p.status === "open" ? "bg-green-500" : "bg-gray-300"
                }`}
                title={p.status === "open" ? "Click to close evaluation" : "Click to open evaluation"}
              >
                <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
                  p.status === "open" ? "translate-x-7" : "translate-x-1"
                }`} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Reset all evaluations — only for roles with evaluation.reset permission */}
      {has("evaluation.reset") && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-5 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-red-800">Reset All Evaluations</h3>
            <p className="text-xs text-red-600 mt-1">Permanently deletes ALL submitted evaluations across ALL periods. Use "Clear this period" above for targeted deletion. This cannot be undone.</p>
          </div>
          <button
            onClick={handleReset}
            disabled={resetting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 shrink-0"
          >
            <Trash2 className="h-4 w-4" />
            {resetting ? "Resetting..." : "Reset All"}
          </button>
        </div>
      )}

      {/* Retention settings — only for roles with evaluation.manage_forms */}
      {has("evaluation.manage_forms") && (
        <div className="bg-rcc-surface rounded-lg border border-rcc-border p-5 space-y-3">
          <h3 className="text-sm font-semibold text-rcc-text-primary">Retention Policy</h3>
          <p className="text-xs text-rcc-text-muted">Automatically delete evaluations after a set number of months from their submission date. Old evaluations are cleaned up when you click "Run Cleanup" or can be triggered by a scheduled task.</p>
          <div className="flex items-center gap-3">
            <span className="text-sm text-rcc-text-secondary">Delete evaluations older than</span>
            <input
              type="number"
              min="1"
              max="120"
              value={retentionMonths}
              onChange={(e) => setRetentionMonths(Number(e.target.value))}
              className="w-20 px-2 py-1 bg-rcc-bg border border-rcc-border rounded-md text-sm text-rcc-text-primary text-center"
            />
            <span className="text-sm text-rcc-text-secondary">months</span>
            <button
              onClick={handleSaveRetention}
              disabled={retentionSaving}
              className="px-3 py-1.5 rounded-md text-xs font-semibold bg-rcc-primary text-rcc-primary-foreground hover:bg-rcc-primary/90 disabled:opacity-50"
            >
              {retentionSaving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={handleCleanup}
              disabled={cleaningUp}
              className="px-3 py-1.5 rounded-md text-xs font-semibold border border-rcc-border text-rcc-text-secondary hover:bg-rcc-bg disabled:opacity-50"
            >
              {cleaningUp ? "Cleaning..." : "Run Cleanup Now"}
            </button>
          </div>
          {cleanupResult && (
            <p className="text-xs text-green-700 font-medium">{cleanupResult}</p>
          )}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: "bg-green-50 text-green-700 border-green-200",
    closed: "bg-amber-50 text-amber-700 border-amber-200",
    archived: "bg-rcc-bg text-rcc-text-muted border-rcc-border",
  };
  const label: Record<string, string> = { open: "Open", closed: "Closed", archived: "Archived" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${map[status] ?? map.archived}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === "open" ? "bg-green-500" : status === "closed" ? "bg-amber-500" : "bg-rcc-text-muted"}`} />
      {label[status] ?? status}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
// SubmitEvaluationPage
// ═══════════════════════════════════════════════════════════════

export function SubmitEvaluationPage() {
  const [periods, setPeriods] = useState<EvalPeriod[]>([]);
  const [employees, setEmployees] = useState<EmployeeBrief[]>([]);
  const [forms, setForms] = useState<EvalForm[]>([]);
  const [activeForm, setActiveForm] = useState<EvalForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [periodId, setPeriodId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState("");
  const [existingEval, setExistingEval] = useState<Evaluation | null>(null);

  // Load open periods + employees (group-scoped by API)
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [p, e, f] = await Promise.all([
          apiFetch<{ periods: EvalPeriod[] }>("/api/evaluation-periods"),
          apiFetch<{ employees: EmployeeBrief[] }>("/api/employees?active=true"),
          apiFetch<{ forms: EvalForm[] }>("/api/evaluation-forms"),
        ]);
        const openPeriods = (p.periods ?? []).filter((x) => x.status === "open");
        setPeriods(openPeriods);
        setEmployees(e.employees ?? []);
        setForms(f.forms ?? []);

        // Fetch the FULL form with criteria from the detail endpoint
        const formList = f.forms ?? [];
        const activeFormSummary = formList.find((x) => x.active) ?? formList[0];
        if (activeFormSummary) {
          const fullForm = await apiFetch<{ form: EvalForm }>(`/api/evaluation-forms/${activeFormSummary.id}`);
          setActiveForm(fullForm.form);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selectedPeriod = periods.find((p) => p.id === periodId);

  // Group criteria by category
  const criteriaByCategory = useMemo(() => {
    if (!activeForm?.criteria) return [] as { category: string; items: EvalCriterion[] }[];
    const map = new Map<string, EvalCriterion[]>();
    for (const c of activeForm.criteria) {
      if (!map.has(c.category)) map.set(c.category, []);
      map.get(c.category)!.push(c);
    }
    return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
  }, [activeForm]);

  // Load existing evaluation (draft or submitted) for the chosen period+employee
  useEffect(() => {
    if (!periodId || !employeeId) {
      setExistingEval(null);
      setScores({});
      setComments({});
      setRemarks("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<{ evaluations: Evaluation[] }>(
          `/api/evaluations?scope=submitted_by_me&periodId=${periodId}`
        );
        const existing = (data.evaluations ?? []).find((e) => e.employeeId === employeeId);
        if (cancelled) return;
        if (existing) {
          setExistingEval(existing);
          const s: Record<string, number> = {};
          const c: Record<string, string> = {};
          for (const r of existing.responses) {
            s[r.criterionId] = r.score;
            if (r.comments) c[r.criterionId] = r.comments;
          }
          setScores(s);
          setComments(c);
          setRemarks(existing.remarks ?? "");
        } else {
          setExistingEval(null);
          setScores({});
          setComments({});
          setRemarks("");
        }
      } catch {
        // ignore — treat as no existing
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [periodId, employeeId]);

  const handleSubmit = async (status: "draft" | "submitted") => {
    setError(null);
    if (!periodId) return setError("Please select a period.");
    if (!employeeId) return setError("Please select an employee.");
    if (!activeForm?.criteria) return setError("No active evaluation form configured.");
    if (status === "submitted") {
      const missing = activeForm.criteria.filter((c) => !scores[c.id]);
      if (missing.length > 0) {
        return setError(`Please score all ${activeForm.criteria.length} criteria before submitting. ${missing.length} missing.`);
      }
    }
    setSaving(true);
    try {
      const responses = activeForm.criteria
        .filter((c) => scores[c.id] !== undefined)
        .map((c) => ({
          criterionId: c.id,
          score: scores[c.id],
          comments: comments[c.id]?.trim() || undefined,
        }));
      await apiFetch("/api/evaluations", {
        method: "POST",
        body: JSON.stringify({
          periodId,
          formId: activeForm.id,
          employeeId,
          responses,
          remarks: remarks.trim() || undefined,
          status,
        }),
      });
      setError(null);
      // reset on success
      if (status === "submitted") {
        setEmployeeId("");
        setScores({});
        setComments({});
        setRemarks("");
        setExistingEval(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-rcc-text-muted">Loading evaluation form...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-rcc-text-primary">Submit Evaluation</h1>
        <p className="text-sm text-rcc-text-muted mt-0.5">
          Score each criterion 1–5. You can save a draft and return later, or submit when complete.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-rcc-error">{error}</div>
      )}

      {existingEval && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p>
              An existing <strong>{existingEval.status}</strong> evaluation for this employee was found.
              Saving will overwrite it. {existingEval.submittedAt && `Last submitted: ${new Date(existingEval.submittedAt).toLocaleString()}.`}
            </p>
          </div>
        </div>
      )}

      {/* Selectors */}
      <div className="bg-rcc-surface rounded-lg border border-rcc-border p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Evaluation Period" required>
            <select value={periodId} onChange={(e) => setPeriodId(e.target.value)} className={inputClass}>
              <option value="">— Select period —</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Employee" required hint="Limited to your group.">
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={inputClass}>
              <option value="">— Select employee —</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} ({emp.employeeId})
                </option>
              ))}
            </select>
          </Field>
        </div>
        {!selectedPeriod && (
          <p className="text-xs text-rcc-text-muted">
            Select an open period to begin scoring.
          </p>
        )}
      </div>

      {/* Criteria */}
      {selectedPeriod && activeForm && (
        <div className="space-y-4">
          {criteriaByCategory.map((group) => (
            <div key={group.category} className="bg-rcc-surface rounded-lg border border-rcc-border p-6">
              <h3 className="text-sm font-semibold text-rcc-text-primary uppercase tracking-wide mb-4">
                {group.category}
              </h3>
              <div className="space-y-4">
                {group.items.map((crit) => (
                  <div key={crit.id} className="border-b border-rcc-border last:border-0 last:pb-0 pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-rcc-text-primary">{crit.description}</p>
                        <p className="text-xs text-rcc-text-muted mt-0.5">Max {crit.maxScore} · Weight {crit.weight}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <label
                            key={n}
                            className={`w-8 h-8 rounded-md border cursor-pointer flex items-center justify-center text-xs font-bold transition-colors ${
                              scores[crit.id] === n
                                ? "bg-rcc-primary text-rcc-primary-foreground border-rcc-primary"
                                : "border-rcc-border text-rcc-text-secondary hover:bg-rcc-bg"
                            }`}
                          >
                            <input
                              type="radio"
                              name={`crit-${crit.id}`}
                              value={n}
                              checked={scores[crit.id] === n}
                              onChange={() => setScores((prev) => ({ ...prev, [crit.id]: n }))}
                              className="sr-only"
                            />
                            {n}
                          </label>
                        ))}
                      </div>
                    </div>
                    <input
                      type="text"
                      value={comments[crit.id] ?? ""}
                      onChange={(e) => setComments((prev) => ({ ...prev, [crit.id]: e.target.value }))}
                      placeholder="Optional comment..."
                      className={inputClass}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Textual remarks */}
          <div className="bg-rcc-surface rounded-lg border border-rcc-border p-6 space-y-3">
            <h3 className="text-sm font-semibold text-rcc-text-primary uppercase tracking-wide">
              Textual Evaluation
            </h3>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={4}
              placeholder="Overall remarks, strengths, areas for improvement..."
              className={`${inputClass} resize-y`}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => handleSubmit("draft")}
              disabled={saving || !employeeId}
              className="px-4 py-2 rounded-md text-sm font-semibold border border-rcc-border text-rcc-text-secondary hover:bg-rcc-bg transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Draft"}
            </button>
            <button
              onClick={() => handleSubmit("submitted")}
              disabled={saving || !employeeId}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold bg-rcc-primary text-rcc-primary-foreground hover:bg-rcc-primary/90 transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {saving ? "Submitting..." : "Submit Evaluation"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// EvaluationResultsPage — dynamic tabs based on permissions
// ═══════════════════════════════════════════════════════════════

export function EvaluationResultsPage() {
  const { has, scopeAllEvaluation, isSystemAdmin } = usePermissions();
  const { setCurrentPage } = useAuthStore();

  // Determine available tabs based on permissions
  const tabs = useMemo(() => {
    const out: { key: string; label: string; scope: string }[] = [];
    if (has("evaluation.submit")) {
      out.push({ key: "submitted_by_me", label: "Submitted by Me", scope: "submitted_by_me" });
    }
    if (has("evaluation.view_results")) {
      out.push({ key: "for_me", label: "For Me", scope: "for_me" });
    }
    if (has("evaluation.view") || scopeAllEvaluation || isSystemAdmin) {
      const label = scopeAllEvaluation || isSystemAdmin ? "Institution" : "My Department";
      out.push({ key: "all", label, scope: "all" });
    }
    return out;
  }, [has, scopeAllEvaluation, isSystemAdmin]);

  const [activeTab, setActiveTab] = useState(tabs[0]?.key ?? "");

  useEffect(() => {
    if (!tabs.find((t) => t.key === activeTab) && tabs.length > 0) {
      setActiveTab(tabs[0].key);
    }
  }, [tabs, activeTab]);

  const active = tabs.find((t) => t.key === activeTab);

  if (tabs.length === 0) {
    return (
      <div className="bg-rcc-surface rounded-lg border border-rcc-border p-8 text-center text-sm text-rcc-text-muted">
        You do not have permission to view evaluation results.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-rcc-text-primary">Evaluation Results</h1>
          <p className="text-sm text-rcc-text-muted mt-0.5">
            Browse submitted evaluations across the available scopes.
          </p>
        </div>
        {has("evaluation.manage_forms") && (
          <button
            onClick={() => setCurrentPage("evaluation", "manage")}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-rcc-text-secondary bg-rcc-surface border border-rcc-border rounded-md hover:bg-rcc-bg transition-colors"
          >
            <Power className="h-3.5 w-3.5" /> Manage Periods
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-rcc-border overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
              activeTab === t.key ? "border-rcc-accent text-rcc-accent" : "border-transparent text-rcc-text-muted hover:text-rcc-text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active && <ResultsTable key={active.key} scope={active.scope} />}
    </div>
  );
}

function ResultsTable({ scope }: { scope: string }) {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Evaluation | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ evaluations: Evaluation[] }>(`/api/evaluations?scope=${scope}`);
      setEvaluations(data.evaluations ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load evaluations.");
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    load();
  }, [load]);

  // Build dynamic columns based on scope
  const showEvaluator = scope === "for_me" || scope === "all";
  const showEmployee = scope === "submitted_by_me" || scope === "all";

  // Pagination must be called unconditionally at the top of the component —
  // but we need to call it before any early return. The hook above is already unconditional.
  const { currentData, controls } = usePagination(evaluations, { defaultPageSize: 15 });

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-rcc-error">{error}</div>
      )}

      <div className="bg-rcc-surface rounded-lg border border-rcc-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-rcc-bg/50 border-b border-rcc-border">
              <tr>
                <th className="text-left text-xs font-semibold text-rcc-text-muted uppercase tracking-wide px-4 py-3">Period</th>
                {showEmployee && (
                  <th className="text-left text-xs font-semibold text-rcc-text-muted uppercase tracking-wide px-4 py-3">Employee</th>
                )}
                {showEvaluator && (
                  <th className="text-left text-xs font-semibold text-rcc-text-muted uppercase tracking-wide px-4 py-3">Evaluator</th>
                )}
                <th className="text-left text-xs font-semibold text-rcc-text-muted uppercase tracking-wide px-4 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-rcc-text-muted uppercase tracking-wide px-4 py-3">Score</th>
                <th className="text-left text-xs font-semibold text-rcc-text-muted uppercase tracking-wide px-4 py-3">Submitted</th>
                <th className="text-right text-xs font-semibold text-rcc-text-muted uppercase tracking-wide px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rcc-border">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-rcc-text-muted">Loading...</td></tr>
              ) : currentData.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-rcc-text-muted">No evaluations found.</td></tr>
              ) : (
                currentData.map((ev) => (
                  <tr key={ev.id} className="hover:bg-rcc-bg/30 transition-colors">
                    <td className="px-4 py-3 text-rcc-text-secondary">{ev.period?.name ?? "—"}</td>
                    {showEmployee && (
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-rcc-text-primary">{ev.employee?.name ?? "—"}</p>
                          <p className="text-xs text-rcc-text-muted font-mono">{ev.employee?.employeeId ?? ""}</p>
                        </div>
                      </td>
                    )}
                    {showEvaluator && (
                      <td className="px-4 py-3 text-rcc-text-secondary">{ev.evaluator?.name ?? "—"}</td>
                    )}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                        ev.status === "submitted" ? "bg-green-50 text-green-700 border-green-200"
                        : ev.status === "acknowledged" ? "bg-rcc-accent/10 text-rcc-accent border-rcc-accent/20"
                        : "bg-rcc-bg text-rcc-text-muted border-rcc-border"
                      }`}>
                        {ev.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {ev.totalScore !== null ? (
                        <span className="font-bold text-rcc-text-primary tabular-nums">{ev.totalScore.toFixed(2)}</span>
                      ) : (
                        <span className="text-rcc-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-rcc-text-muted">
                      {ev.submittedAt ? new Date(ev.submittedAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelected(ev)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-rcc-accent hover:underline"
                      >
                        <FileText className="h-3 w-3" /> View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationControls {...controls} />
      </div>

      {/* Evaluation Remarks / Details Modal */}
      {selected && (
        <EvaluationDetailsModal evaluation={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function EvaluationDetailsModal({ evaluation, onClose }: { evaluation: Evaluation; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-rcc-surface rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-rcc-border">
          <div>
            <h3 className="text-base font-semibold text-rcc-text-primary">Evaluation Details</h3>
            <p className="text-xs text-rcc-text-muted">
              {evaluation.period?.name ?? "—"} · {evaluation.form?.name ?? "—"}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-rcc-text-muted hover:bg-rcc-bg hover:text-rcc-text-primary transition-colors" aria-label="Close">
            <ArrowLeft className="h-4 w-4 rotate-180" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-rcc-text-muted uppercase">Employee</p>
              <p className="text-rcc-text-primary font-medium">{evaluation.employee?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-rcc-text-muted uppercase">Evaluator</p>
              <p className="text-rcc-text-primary font-medium">{evaluation.evaluator?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-rcc-text-muted uppercase">Status</p>
              <p className="text-rcc-text-primary font-medium capitalize">{evaluation.status}</p>
            </div>
            <div>
              <p className="text-xs text-rcc-text-muted uppercase">Total Score</p>
              <p className="text-rcc-text-primary font-bold tabular-nums">
                {evaluation.totalScore !== null ? evaluation.totalScore.toFixed(2) : "—"}
              </p>
            </div>
          </div>

          {/* Evaluation Remarks */}
          <div>
            <h4 className="text-xs font-semibold text-rcc-text-muted uppercase tracking-wide mb-2">Evaluation Remarks</h4>
            <div className="bg-rcc-bg/40 border border-rcc-border rounded-md p-3 text-sm text-rcc-text-secondary whitespace-pre-wrap min-h-[80px]">
              {evaluation.remarks || <span className="text-rcc-text-muted italic">No remarks provided.</span>}
            </div>
          </div>

          {/* Responses — if any */}
          {evaluation.responses.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-rcc-text-muted uppercase tracking-wide mb-2">Criterion Responses</h4>
              <ul className="space-y-2">
                {evaluation.responses.map((r) => (
                  <li key={r.id} className="border border-rcc-border rounded-md p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        {r.criterion ? (
                          <>
                            <span className="text-[10px] text-rcc-text-muted uppercase tracking-wide">{r.criterion.category}</span>
                            <p className="text-xs text-rcc-text-primary">{r.criterion.description}</p>
                          </>
                        ) : (
                          <code className="text-[10px] text-rcc-text-muted">{r.criterionId}</code>
                        )}
                      </div>
                      <span className="text-sm font-bold text-rcc-text-primary tabular-nums shrink-0">{r.score} / 5</span>
                    </div>
                    {r.comments && <p className="text-xs text-rcc-text-secondary mt-1">{r.comments}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-rcc-text-secondary mb-1.5">
        {label}
        {required && <span className="text-rcc-error ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-rcc-text-muted mt-1">{hint}</p>}
    </div>
  );
}

// Suppress unused-import warnings
void Search;
void ClipboardList;
