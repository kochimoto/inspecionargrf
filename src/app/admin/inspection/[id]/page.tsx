import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Car,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Gauge,
  Fuel,
  CalendarDays,
  User,
  GitCompare,
  FileText,
} from "lucide-react";
import { InspectionPdfButton } from "@/components/InspectionPdfButton";
import { InspectionReviewActions } from "@/components/InspectionReviewActions";
import { DamageMap, DamageItem } from "@/components/DamageMap";
import { PHOTO_ANGLE_LABELS } from "@/components/RequiredPhotos";

interface PageProps {
  params: Promise<{ id: string }>;
}

const STATUS_CONFIG = {
  OK: { label: "OK", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  ALERT: { label: "Atenção", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  DEFECT: { label: "Defeito", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" },
};

const INSPECTION_STATUS = {
  PENDING: { label: "Pendente", icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  APPROVED: { label: "Aprovada", icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  REJECTED: { label: "Rejeitada", icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" },
};

const REASON_LABELS: Record<string, string> = {
  PURCHASE: "Compra",
  CONSIGNMENT: "Consignação",
  TRADE_IN: "Troca",
  SALE: "Venda",
  RETURN: "Devolução",
  WORKSHOP: "Oficina",
  OTHER: "Outro",
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

export default async function InspectionDetailPage({ params }: PageProps) {
  const { id } = await params;

  const inspection = await prisma.inspection
    .findUnique({
      where: { id },
      include: {
        vehicle: true,
        inspector: true,
        approvedBy: true,
        movement: {
          include: {
            photos: true,
            damages: {
              include: { photo: true },
            },
          },
        },
        items: {
          include: { photos: true },
          orderBy: { category: "asc" },
        },
      },
    })
    .catch(() => null);

  if (!inspection) notFound();

  // If EXIT movement, fetch previous ENTRY for comparative summary in PDF & view
  const previousEntry =
    inspection.movement?.type === "EXIT"
      ? await prisma.movement.findFirst({
          where: {
            vehicleId: inspection.vehicleId,
            type: "ENTRY",
            id: { not: inspection.movement.id },
            createdAt: { lte: inspection.movement.createdAt },
          },
          orderBy: { createdAt: "desc" },
          include: {
            damages: true,
          },
        })
      : null;

  const categories = [...new Set(inspection.items.map((i) => i.category))];
  const ok = inspection.items.filter((i) => i.status === "OK").length;
  const alert = inspection.items.filter((i) => i.status === "ALERT").length;
  const defect = inspection.items.filter((i) => i.status === "DEFECT").length;

  const statusCfg =
    INSPECTION_STATUS[inspection.status as keyof typeof INSPECTION_STATUS] ??
    INSPECTION_STATUS.PENDING;
  const StatusIcon = statusCfg.icon;

  const mov = inspection.movement;
  const movementPhotos = mov?.photos ?? [];
  const damages: DamageItem[] = (mov?.damages ?? []).map((d) => ({
    id: d.id,
    area: d.area,
    x: d.x,
    y: d.y,
    type: d.type,
    notes: d.notes ?? "",
    photoUrl: d.photo?.url ?? null,
  }));

  const pdfPayload = {
    ...inspection,
    previousEntry: previousEntry
      ? {
          id: previousEntry.id,
          createdAt: previousEntry.createdAt,
          km: previousEntry.km,
          fuelLevel: previousEntry.fuelLevel,
          damagesCount: previousEntry.damages.length,
        }
      : null,
  };

  return (
    <div className="min-h-screen bg-[#09090b] pb-16">
      {/* Header */}
      <header className="glass-panel border-b border-zinc-800/50 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <Car size={18} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white font-mono tracking-widest">
                  {inspection.vehicle.licensePlate}
                </h1>
                {mov && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      mov.type === "ENTRY"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-amber-500/20 text-amber-400"
                    }`}
                  >
                    {mov.type === "ENTRY" ? "ENTRADA" : "SAÍDA"} ·{" "}
                    {REASON_LABELS[mov.reason] ?? mov.reason}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400">
                {[inspection.vehicle.make, inspection.vehicle.model, inspection.vehicle.year]
                  .filter(Boolean)
                  .join(" ") || "Detalhe da Vistoria"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {mov && mov.type === "EXIT" && (
            <Link
              href={`/admin/movements/${mov.id}/compare`}
              className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white px-3.5 py-2 rounded-lg text-xs font-bold"
            >
              <GitCompare size={15} /> Comparar Entrada × Saída
            </Link>
          )}
          <InspectionPdfButton inspection={pdfPayload} label="Baixar PDF" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">
        {/* Approval / Rejection Controls */}
        <InspectionReviewActions
          inspectionId={inspection.id}
          currentStatus={inspection.status}
          rejectionReason={inspection.rejectionReason}
        />

        {/* Info Card */}
        <div className="glass-card p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0">
              <Gauge size={18} className="text-zinc-300" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">KM</p>
              <p className="text-white font-semibold">{inspection.km.toLocaleString("pt-BR")} km</p>
            </div>
          </div>

          {mov && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0">
                <Fuel size={18} className="text-zinc-300" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">Combustível</p>
                <p className="text-white font-semibold">{mov.fuelLevel}%</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0">
              <User size={18} className="text-zinc-300" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Vistoriador</p>
              <p className="text-white font-semibold">{inspection.inspector.name}</p>
            </div>
          </div>

          {mov && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText size={18} className="text-zinc-300" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">
                  {mov.type === "ENTRY" ? "Entregue por" : "Retirado por"}
                </p>
                <p className="text-white font-semibold text-sm">
                  {mov.personName}
                  {mov.personDoc ? ` (${mov.personDoc})` : ""}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0">
              <CalendarDays size={18} className="text-zinc-300" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Data e Hora</p>
              <p className="text-white font-semibold text-sm">{formatDate(inspection.createdAt)}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 ${statusCfg.bg} rounded-lg flex items-center justify-center flex-shrink-0`}
            >
              <StatusIcon size={18} className={statusCfg.color} />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Status</p>
              <p className={`font-semibold ${statusCfg.color}`}>{statusCfg.label}</p>
            </div>
          </div>
        </div>

        {/* Movement Photos Gallery */}
        {movementPhotos.length > 0 && (
          <div className="glass-card p-5 flex flex-col gap-4">
            <h3 className="text-base font-bold text-white">
              Galeria de Fotos por Ângulo ({movementPhotos.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {movementPhotos.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col gap-1 bg-zinc-900/70 rounded-xl p-2 border border-zinc-800"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={PHOTO_ANGLE_LABELS[p.angle] ?? p.angle}
                    className="w-full h-28 object-cover rounded-lg"
                  />
                  <span className="text-[11px] text-zinc-300 font-medium text-center truncate">
                    {PHOTO_ANGLE_LABELS[p.angle] ?? p.angle}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Damage Map */}
        {mov && (
          <div className="flex flex-col gap-3">
            <h3 className="text-base font-bold text-white">Mapa de Avarias</h3>
            <DamageMap damages={damages} readOnly />
          </div>
        )}

        {/* Summary Counters */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              count: ok,
              label: "OK",
              color: "text-emerald-400",
              bg: "bg-emerald-500/10",
              border: "border-emerald-500/20",
              icon: CheckCircle2,
            },
            {
              count: alert,
              label: "Atenção",
              color: "text-amber-400",
              bg: "bg-amber-500/10",
              border: "border-amber-500/20",
              icon: AlertTriangle,
            },
            {
              count: defect,
              label: "Defeito",
              color: "text-red-400",
              bg: "bg-red-500/10",
              border: "border-red-500/20",
              icon: XCircle,
            },
          ].map((s) => (
            <div key={s.label} className={`glass-card p-4 text-center border ${s.border}`}>
              <div className={`text-3xl font-bold ${s.color}`}>{s.count}</div>
              <div className="text-xs text-zinc-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Checklist by Category */}
        {categories.map((cat) => {
          const items = inspection.items.filter((i) => i.category === cat);
          return (
            <div key={cat} className="glass-card overflow-hidden">
              <div className="px-5 py-3 bg-zinc-800/50 border-b border-zinc-700/50">
                <h3 className="font-semibold text-zinc-100 text-sm">{cat}</h3>
              </div>
              <div className="divide-y divide-zinc-800/40">
                {items.map((item) => {
                  const cfg = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG];
                  return (
                    <div key={item.id} className="px-5 py-4 flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-zinc-200 font-medium">{item.name}</span>
                        {cfg && (
                          <span
                            className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${cfg.color} ${cfg.bg} ${cfg.border} flex-shrink-0`}
                          >
                            {cfg.label}
                          </span>
                        )}
                      </div>
                      {item.observation && (
                        <p className="text-xs text-zinc-400 italic">Obs: {item.observation}</p>
                      )}
                      {item.photos.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {item.photos.map((photo, idx) => (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              key={idx}
                              src={photo.url}
                              alt={`Foto ${item.name}`}
                              className="w-28 h-20 object-cover rounded-lg border border-zinc-700"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Signature */}
        {inspection.signature && (
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-zinc-300 mb-3">
              Assinatura ({mov?.personName || inspection.inspector.name})
            </h3>
            <div className="bg-zinc-100 rounded-lg p-3 inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={inspection.signature}
                alt="Assinatura"
                className="max-h-24 object-contain"
              />
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              Vistoriador: {inspection.inspector.name}
            </p>
          </div>
        )}

        {/* Bottom PDF button */}
        <div className="flex justify-center pb-4">
          <InspectionPdfButton inspection={pdfPayload} label="Baixar Laudo em PDF" />
        </div>
      </main>
    </div>
  );
}
