import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  XCircle,
  Car,
  ArrowDownCircle,
  ArrowUpCircle,
  Package,
  Filter,
  GitCompare,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Prisma, MovementType, MovementReason, InspectionStatus } from "@prisma/client";

const REASON_LABELS: Record<string, string> = {
  PURCHASE: "Compra",
  CONSIGNMENT: "Consignação",
  TRADE_IN: "Troca",
  SALE: "Venda",
  RETURN: "Devolução",
  WORKSHOP: "Oficina",
  OTHER: "Outro",
};

const statusConfig = {
  PENDING: {
    label: "Pendente",
    icon: Clock,
    color: "text-[var(--color-status-alert)]",
    bg: "bg-[var(--color-status-alert-muted)]",
    border: "border-[var(--color-status-alert)]/30",
  },
  APPROVED: {
    label: "Aprovada",
    icon: CheckCircle2,
    color: "text-[var(--color-status-ok)]",
    bg: "bg-[var(--color-status-ok-muted)]",
    border: "border-[var(--color-status-ok)]/30",
  },
  REJECTED: {
    label: "Rejeitada",
    icon: XCircle,
    color: "text-[var(--color-status-defect)]",
    bg: "bg-[var(--color-status-defect-muted)]",
    border: "border-[var(--color-status-defect)]/30",
  },
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export const dynamic = "force-dynamic";

interface AdminPageProps {
  searchParams: Promise<{
    tab?: string;
    plate?: string;
    type?: string;
    reason?: string;
    inspectorId?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 15;

export default async function AdminDashboard({ searchParams }: AdminPageProps) {
  const sp = await searchParams;
  const activeTab = sp.tab === "stock" ? "stock" : "history";
  const plateFilter = (sp.plate || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const typeFilter = sp.type === "ENTRY" || sp.type === "EXIT" ? sp.type : "";
  const reasonFilter = sp.reason || "";
  const inspectorFilter = sp.inspectorId || "";
  const statusFilter =
    sp.status === "PENDING" || sp.status === "APPROVED" || sp.status === "REJECTED"
      ? sp.status
      : "";
  const fromFilter = sp.from || "";
  const toFilter = sp.to || "";
  const currentPage = Math.max(1, parseInt(sp.page || "1", 10) || 1);

  let dbError: string | null = null;
  let stats = { total: 0, pending: 0, approved: 0, inStock: 0 };
  let inspectors: { id: string; name: string }[] = [];
  let inStockVehicles: {
    id: string;
    licensePlate: string;
    make: string | null;
    model: string | null;
    year: number | null;
    color: string | null;
    lastEntry: {
      id: string;
      km: number;
      fuelLevel: number;
      reason: string;
      personName: string;
      createdAt: Date;
      inspectionId: string | null;
    };
  }[] = [];

  // Build Where clause for Inspections / Movements
  const whereClause: Prisma.InspectionWhereInput = {};
  if (plateFilter) {
    whereClause.vehicle = {
      licensePlate: { contains: plateFilter, mode: "insensitive" },
    };
  }
  if (statusFilter) {
    whereClause.status = statusFilter as InspectionStatus;
  }
  if (inspectorFilter) {
    whereClause.inspectorId = inspectorFilter;
  }
  if (fromFilter || toFilter) {
    whereClause.createdAt = {};
    if (fromFilter) whereClause.createdAt.gte = new Date(`${fromFilter}T00:00:00`);
    if (toFilter) whereClause.createdAt.lte = new Date(`${toFilter}T23:59:59`);
  }
  if (typeFilter || reasonFilter) {
    whereClause.movement = {};
    if (typeFilter) whereClause.movement.type = typeFilter as MovementType;
    if (reasonFilter) whereClause.movement.reason = reasonFilter as MovementReason;
  }

  let inspections: Awaited<ReturnType<typeof fetchInspections>> = [];
  let totalFiltered = 0;

  async function fetchInspections() {
    return prisma.inspection.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        vehicle: true,
        inspector: true,
        movement: {
          include: {
            damages: true,
          },
        },
        items: true,
      },
    });
  }

  try {
    const [
      totalCount,
      pendingCount,
      approvedCount,
      allVehiclesWithMovements,
      inspectorList,
      filteredList,
      filteredCount,
    ] = await Promise.all([
      prisma.inspection.count(),
      prisma.inspection.count({ where: { status: "PENDING" } }),
      prisma.inspection.count({ where: { status: "APPROVED" } }),
      prisma.vehicle.findMany({
        where: plateFilter
          ? { licensePlate: { contains: plateFilter, mode: "insensitive" } }
          : undefined,
        include: {
          movements: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { inspection: { select: { id: true } } },
          },
        },
      }),
      prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
      fetchInspections(),
      prisma.inspection.count({ where: whereClause }),
    ]);

    inspectors = inspectorList;
    inspections = filteredList;
    totalFiltered = filteredCount;

    inStockVehicles = allVehiclesWithMovements
      .filter((v) => v.movements[0]?.type === "ENTRY")
      .map((v) => {
        const m = v.movements[0]!;
        return {
          id: v.id,
          licensePlate: v.licensePlate,
          make: v.make,
          model: v.model,
          year: v.year,
          color: v.color,
          lastEntry: {
            id: m.id,
            km: m.km,
            fuelLevel: m.fuelLevel,
            reason: m.reason,
            personName: m.personName,
            createdAt: m.createdAt,
            inspectionId: m.inspection?.id ?? null,
          },
        };
      });

    stats = {
      total: totalCount,
      pending: pendingCount,
      approved: approvedCount,
      inStock: inStockVehicles.length,
    };
  } catch (err) {
    console.error("Admin DB error:", err);
    dbError = err instanceof Error ? err.message : "Erro ao conectar com o banco de dados.";
  }

  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));

  const buildPageHref = (pageNum: number) => {
    const params = new URLSearchParams();
    if (activeTab) params.set("tab", activeTab);
    if (plateFilter) params.set("plate", plateFilter);
    if (typeFilter) params.set("type", typeFilter);
    if (reasonFilter) params.set("reason", reasonFilter);
    if (inspectorFilter) params.set("inspectorId", inspectorFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (fromFilter) params.set("from", fromFilter);
    if (toFilter) params.set("to", toFilter);
    params.set("page", String(pageNum));
    return `/admin?${params.toString()}`;
  };

  const statCards = [
    {
      label: "Veículos em Estoque",
      value: stats.inStock,
      icon: Package,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Total de Vistorias",
      value: stats.total,
      icon: ClipboardList,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "Pendentes de Revisão",
      value: stats.pending,
      icon: Clock,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      label: "Aprovadas",
      value: stats.approved,
      icon: CheckCircle2,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
  ];

  return (
    <div className="min-h-screen bg-[#09090b] pb-16">
      {/* Header */}
      <header className="glass-panel border-b border-zinc-800/50 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <Car size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">GRF AUTO CAR</h1>
            <p className="text-xs text-zinc-400">Estoque e Auditoria de Movimentações</p>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/inspector?type=ENTRY"
            className="flex items-center gap-1.5 text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-lg font-semibold transition-colors"
          >
            <ArrowDownCircle size={16} /> + Entrada
          </Link>
          <Link
            href="/inspector?type=EXIT"
            className="flex items-center gap-1.5 text-xs sm:text-sm bg-amber-600 hover:bg-amber-500 text-white px-3.5 py-2 rounded-lg font-semibold transition-colors"
          >
            <ArrowUpCircle size={16} /> + Saída
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {dbError && (
          <div className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
            <strong>Erro de banco de dados:</strong> {dbError}
          </div>
        )}

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((card) => (
            <div key={card.label} className="glass-card p-5 flex flex-col gap-3">
              <div className={`w-10 h-10 ${card.bg} rounded-lg flex items-center justify-center`}>
                <card.icon size={22} className={card.color} />
              </div>
              <div>
                <div className={`text-3xl font-bold ${card.color}`}>{card.value}</div>
                <div className="text-xs text-zinc-400 mt-1">{card.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Navigation Tabs: Histórico vs Em Estoque */}
        <div className="flex gap-2 mb-6">
          <Link
            href="/admin?tab=history"
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 ${
              activeTab === "history"
                ? "bg-blue-600 text-white"
                : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
            }`}
          >
            <ClipboardList size={16} />
            Histórico de Movimentações ({totalFiltered})
          </Link>
          <Link
            href="/admin?tab=stock"
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 ${
              activeTab === "stock"
                ? "bg-emerald-600 text-white"
                : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
            }`}
          >
            <Package size={16} />
            Veículos em Estoque ({inStockVehicles.length})
          </Link>
        </div>

        {/* Filters Form */}
        <form method="GET" action="/admin" className="glass-card p-4 mb-6">
          <input type="hidden" name="tab" value={activeTab} />
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-300 mb-3">
            <Filter size={14} className="text-blue-400" /> Filtros de Busca
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">Placa</label>
              <input
                type="text"
                name="plate"
                defaultValue={plateFilter}
                placeholder="Ex: ABC1D23"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-white uppercase font-mono"
              />
            </div>

            {activeTab === "history" && (
              <>
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Tipo</label>
                  <select
                    name="type"
                    defaultValue={typeFilter}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-white"
                  >
                    <option value="">Todos</option>
                    <option value="ENTRY">Entrada</option>
                    <option value="EXIT">Saída</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Motivo</label>
                  <select
                    name="reason"
                    defaultValue={reasonFilter}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-white"
                  >
                    <option value="">Todos</option>
                    {Object.entries(REASON_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Status</label>
                  <select
                    name="status"
                    defaultValue={statusFilter}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-white"
                  >
                    <option value="">Todos</option>
                    <option value="PENDING">Pendente</option>
                    <option value="APPROVED">Aprovada</option>
                    <option value="REJECTED">Rejeitada</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Vistoriador</label>
                  <select
                    name="inspectorId"
                    defaultValue={inspectorFilter}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-white"
                  >
                    <option value="">Todos</option>
                    {inspectors.map((ins) => (
                      <option key={ins.id} value={ins.id}>
                        {ins.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">De</label>
                  <input
                    type="date"
                    name="from"
                    defaultValue={fromFilter}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Até</label>
                  <input
                    type="date"
                    name="to"
                    defaultValue={toFilter}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-2 text-xs text-white"
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 mt-3">
            <Link
              href={`/admin?tab=${activeTab}`}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs"
            >
              Limpar
            </Link>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
            >
              Filtrar
            </button>
          </div>
        </form>

        {/* TAB: EM ESTOQUE */}
        {activeTab === "stock" && (
          <div className="glass-card overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800/50 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                Veículos Atualmente em Estoque (Última movimentação = ENTRADA)
              </h3>
              <span className="text-xs text-zinc-400">{inStockVehicles.length} veículo(s)</span>
            </div>

            {inStockVehicles.length === 0 ? (
              <div className="py-16 text-center text-zinc-500">
                <Package size={40} className="mx-auto mb-3 opacity-30" />
                <p>Nenhum veículo em estoque encontrado.</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/40">
                {inStockVehicles.map((v) => (
                  <div
                    key={v.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 hover:bg-zinc-800/20"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-28 flex-shrink-0">
                        <div className="bg-white rounded-md border-2 border-zinc-700 text-zinc-900 font-mono font-bold text-center py-1 text-sm tracking-widest">
                          {v.licensePlate}
                        </div>
                      </div>
                      <div>
                        <div className="text-white font-semibold text-sm">
                          {[v.make, v.model, v.year].filter(Boolean).join(" ") || "Veículo sem modelo informado"}
                          {v.color ? ` · ${v.color}` : ""}
                        </div>
                        <div className="text-xs text-zinc-400 mt-0.5">
                          Entrada em {formatDate(v.lastEntry.createdAt)} ·{" "}
                          {REASON_LABELS[v.lastEntry.reason] ?? v.lastEntry.reason} ·{" "}
                          {v.lastEntry.km.toLocaleString("pt-BR")} km · Combustível:{" "}
                          {v.lastEntry.fuelLevel}%
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {v.lastEntry.inspectionId && (
                        <Link
                          href={`/admin/inspection/${v.lastEntry.inspectionId}`}
                          className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-2 rounded-lg font-medium"
                        >
                          Ver Vistoria de Entrada
                        </Link>
                      )}
                      <Link
                        href={`/admin?tab=history&plate=${v.licensePlate}`}
                        className="text-xs bg-zinc-800 hover:bg-zinc-700 text-blue-400 px-3 py-2 rounded-lg font-medium"
                      >
                        Histórico da Placa
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: HISTÓRICO DE MOVIMENTAÇÕES E VISTORIAS */}
        {activeTab === "history" && (
          <div className="glass-card overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800/50 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Movimentações e Vistorias</h3>
              <span className="text-xs text-zinc-400">
                Página {currentPage} de {totalPages} ({totalFiltered} registro(s))
              </span>
            </div>

            {inspections.length === 0 ? (
              <div className="py-16 text-center text-zinc-500">
                <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
                <p>Nenhuma movimentação encontrada para os filtros selecionados.</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/40">
                {inspections.map((inspection) => {
                  const cfg =
                    statusConfig[inspection.status as keyof typeof statusConfig] ??
                    statusConfig.PENDING;
                  const alertItems = inspection.items.filter(
                    (i) => i.status === "ALERT" || i.status === "DEFECT"
                  );
                  const StatusIcon = cfg.icon;
                  const mov = inspection.movement;

                  return (
                    <div
                      key={inspection.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-4 px-6 py-4 hover:bg-zinc-800/30 transition-colors"
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
                          {mov ? (
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                mov.type === "ENTRY"
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : "bg-amber-500/20 text-amber-400"
                              }`}
                            >
                              {mov.type === "ENTRY" ? "ENTRADA" : "SAÍDA"} ·{" "}
                              {REASON_LABELS[mov.reason] ?? mov.reason}
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                              VISTORIA LEGADA
                            </span>
                          )}

                          <span className="text-white font-medium text-sm">
                            {[
                              inspection.vehicle.make,
                              inspection.vehicle.model,
                              inspection.vehicle.year,
                            ]
                              .filter(Boolean)
                              .join(" ") || inspection.vehicle.licensePlate}
                          </span>

                          {alertItems.length > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                              {alertItems.length} alerta(s)/defeito(s)
                            </span>
                          )}

                          {mov && mov.damages.length > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
                              {mov.damages.length} avaria(s)
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-zinc-400 mt-1">
                          Vistoriador: <strong>{inspection.inspector.name}</strong> ·{" "}
                          {inspection.km.toLocaleString("pt-BR")} km
                          {mov ? ` · Combustível: ${mov.fuelLevel}% · Resp.: ${mov.personName}` : ""}
                        </div>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          {formatDate(inspection.createdAt)}
                        </div>
                      </div>

                      {/* Actions & Status */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <div
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${cfg.color} ${cfg.bg} border ${cfg.border}`}
                        >
                          <StatusIcon size={13} />
                          {cfg.label}
                        </div>

                        {mov && mov.type === "EXIT" && (
                          <Link
                            href={`/admin/movements/${mov.id}/compare`}
                            className="flex items-center gap-1 text-xs bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 px-3 py-1.5 rounded-lg font-semibold"
                          >
                            <GitCompare size={14} /> Comparar
                          </Link>
                        )}

                        <Link
                          href={`/admin/inspection/${inspection.id}`}
                          className="text-xs bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded-lg font-semibold"
                        >
                          Abrir Laudo →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination Footer */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-zinc-800/50 flex items-center justify-between">
                <Link
                  href={buildPageHref(Math.max(1, currentPage - 1))}
                  className={`flex items-center gap-1 text-xs px-3 py-2 rounded-lg border ${
                    currentPage <= 1
                      ? "pointer-events-none opacity-40 border-zinc-800 text-zinc-600"
                      : "border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                  }`}
                >
                  <ChevronLeft size={14} /> Anterior
                </Link>
                <span className="text-xs text-zinc-400">
                  Página {currentPage} de {totalPages}
                </span>
                <Link
                  href={buildPageHref(Math.min(totalPages, currentPage + 1))}
                  className={`flex items-center gap-1 text-xs px-3 py-2 rounded-lg border ${
                    currentPage >= totalPages
                      ? "pointer-events-none opacity-40 border-zinc-800 text-zinc-600"
                      : "border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                  }`}
                >
                  Próxima <ChevronRight size={14} />
                </Link>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
