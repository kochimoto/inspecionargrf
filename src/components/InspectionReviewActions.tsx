"use client";

import React, { useState } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { reviewInspection } from "@/app/actions";

interface InspectionReviewActionsProps {
  inspectionId: string;
  currentStatus: string;
  rejectionReason?: string | null;
}

export function InspectionReviewActions({
  inspectionId,
  currentStatus,
  rejectionReason: initialReason,
}: InspectionReviewActionsProps) {
  const [status, setStatus] = useState(currentStatus);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [reason, setReason] = useState(initialReason || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    setLoading(true);
    setError(null);
    const res = await reviewInspection({
      inspectionId,
      status: "APPROVED",
    });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setStatus("APPROVED");
    setShowRejectModal(false);
  };

  const handleReject = async () => {
    if (!reason || reason.trim().length < 3) {
      setError("Informe o motivo da rejeição (mínimo 3 caracteres).");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await reviewInspection({
      inspectionId,
      status: "REJECTED",
      rejectionReason: reason.trim(),
    });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setStatus("REJECTED");
    setShowRejectModal(false);
  };

  return (
    <div className="glass-card p-5 flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white">Auditoria da Vistoria</h3>
          <p className="text-xs text-zinc-400">
            Status atual:{" "}
            <strong
              className={
                status === "APPROVED"
                  ? "text-emerald-400"
                  : status === "REJECTED"
                  ? "text-red-400"
                  : "text-amber-400"
              }
            >
              {status === "APPROVED"
                ? "Aprovada"
                : status === "REJECTED"
                ? "Rejeitada"
                : "Pendente de Revisão"}
            </strong>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={loading || status === "APPROVED"}
            onClick={handleApprove}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-colors"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            Aprovar Vistoria
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setError(null);
              setShowRejectModal(true);
            }}
            className="flex items-center gap-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors"
          >
            <XCircle size={15} />
            Rejeitar
          </button>
        </div>
      </div>

      {status === "REJECTED" && reason && !showRejectModal && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">
          <strong>Motivo da Rejeição:</strong> {reason}
        </div>
      )}

      {showRejectModal && (
        <div className="mt-2 p-4 rounded-xl bg-zinc-900 border border-zinc-700 flex flex-col gap-3">
          <label className="text-xs font-bold text-zinc-200">
            Motivo da Rejeição (Obrigatório) *
          </label>
          <textarea
            rows={2}
            placeholder="Descreva por que a vistoria foi rejeitada..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowRejectModal(false)}
              className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-semibold"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleReject}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold"
            >
              Confirmar Rejeição
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
