import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ClipboardList, CheckCircle2, Clock, AlertTriangle, XCircle, Car } from "lucide-react";

async function getStats() {
  const [total, pending, approved, rejected, alertCount] = await Promise.all([
    prisma.inspection.count(),
    prisma.inspection.count({ where: { status: "PENDING" } }),
    prisma.inspection.count({ where: { status: "APPROVED" } }),
    prisma.inspection.count({ where: { status: "REJECTED" } }),
    prisma.inspection.count({
      where: {
        items: {
          some: { status: { in: ["ALERT", "DEFECT"] } },
        },
      },
    }),
  ]);
  return { total, pending, approved, rejected, alertCount };
}

async function getInspections() {
  return prisma.inspection.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      vehicle: true,
      inspector: true,
      items: { include: { photos: true } },
    },
  });
}

const statusConfig = {
  PENDING: { label: "Pendente", icon: Clock, color: "text-[var(--color-status-alert)]", bg: "bg-[var(--color-status-alert-muted)]", border: "border-[var(--color-status-alert)]/30" },
  APPROVED: { label: "Aprovada", icon: CheckCircle2, color: "text-[var(--color-status-ok)]", bg: "bg-[var(--color-status-ok-muted)]", border: "border-[var(--color-status-ok)]/30" },
  REJECTED: { label: "Rejeitada", icon: XCircle, color: "text-[var(--color-status-defect)]", bg: "bg-[var(--color-status-defect-muted)]", border: "border-[var(--color-status-defect)]/30" },
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(date));
}

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  let stats = { total: 0, pending: 0, approved: 0, rejected: 0, alertCount: 0 };
  let inspections: Awaited<ReturnType<typeof getInspections>> = [];
  let dbError: string | null = null;

  try {
    [stats, inspections] = await Promise.all([getStats(), getInspections()]);
  } catch (err) {
    console.error("Admin DB error:", err);
    dbError = err instanceof Error ? err.message : "Erro ao conectar com o banco de dados.";
  }

  const statCards = [
    { label: "Total de Vistorias", value: stats.total, icon: ClipboardList, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "Pendentes de Revisão", value: stats.pending, icon: Clock, color: "text-[var(--color-status-alert)]", bg: "bg-[var(--color-status-alert-muted)]" },
    { label: "Aprovadas", value: stats.approved, icon: CheckCircle2, color: "text-[var(--color-status-ok)]", bg: "bg-[var(--color-status-ok-muted)]" },
    { label: "Veículos com Alerta", value: stats.alertCount, icon: AlertTriangle, color: "text-orange-400", bg: "bg-orange-500/10" },
  ];

  return (
    <div className="min-h-screen bg-[#09090b]">
      {/* Header */}
      <header className="glass-panel border-b border-zinc-800/50 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <Car size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">GRF AUTO CAR</h1>
            <p className="text-xs text-zinc-400">Painel de Auditoria</p>
          </div>
        </div>
        <Link
          href="/inspector"
          className="flex items-center gap-2 text-sm bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg btn-interactive transition-colors"
        >
          + Nova Vistoria
        </Link>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white">Dashboard</h2>
          <p className="text-zinc-400 mt-1">Visão geral das vistorias automotivas</p>
        </div>

        {dbError && (
          <div className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
            <strong>Erro de banco de dados:</strong> {dbError}
          </div>
        )}

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {statCards.map((card) => (
            <div key={card.label} className="glass-card p-5 flex flex-col gap-3">
              <div className={`w-10 h-10 ${card.bg} rounded-lg flex items-center justify-center`}>
                <card.icon size={22} className={card.color} />
              </div>
              <div>
                <div className={`text-3xl font-bold ${card.color}`}>{card.value}</div>
                <div className="text-xs text-zinc-500 mt-1">{card.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Inspections Table */}
        <div className="glass-card overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800/50 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Vistorias Recentes</h3>
            <span className="text-xs text-zinc-500">{inspections.length} registro(s)</span>
          </div>

          {inspections.length === 0 ? (
            <div className="py-16 text-center text-zinc-500">
              <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
              <p>Nenhuma vistoria encontrada.</p>
              <Link href="/inspector" className="text-blue-400 hover:text-blue-300 text-sm mt-2 block">
                Criar primeira vistoria →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/40">
              {inspections.map((inspection) => {
                const cfg = statusConfig[inspection.status as keyof typeof statusConfig];
                const alertItems = inspection.items.filter((i) => i.status === "ALERT" || i.status === "DEFECT");
                const hasIssues = alertItems.length > 0;
                const StatusIcon = cfg.icon;

                return (
                  <Link
                    key={inspection.id}
                    href={`/admin/inspection/${inspection.id}`}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-zinc-800/30 transition-colors group"
                  >
                    {/* Plate */}
                    <div className="w-28 flex-shrink-0">
                      <div className="bg-white rounded-md border-2 border-zinc-700 text-zinc-900 font-mono font-bold text-center py-1 text-sm tracking-widest">
                        {inspection.vehicle.licensePlate}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-medium">{inspection.vehicle.licensePlate}</span>
                        {hasIssues && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-status-alert-muted)] text-[var(--color-status-alert)] border border-[var(--color-status-alert)]/30">
                            {alertItems.length} problema(s)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">
                        {inspection.inspector.name} · {formatCurrency(inspection.value)} · {inspection.km.toLocaleString()} km
                      </div>
                      <div className="text-xs text-zinc-600 mt-0.5">{formatDate(inspection.createdAt)}</div>
                    </div>

                    {/* Status Badge */}
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${cfg.color} ${cfg.bg} border ${cfg.border} flex-shrink-0`}>
                      <StatusIcon size={13} />
                      {cfg.label}
                    </div>

                    <span className="text-zinc-700 group-hover:text-zinc-400 transition-colors text-sm">→</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
