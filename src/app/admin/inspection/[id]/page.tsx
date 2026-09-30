import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Car, CheckCircle2, Clock, XCircle, AlertTriangle, Gauge, DollarSign, CalendarDays, User } from "lucide-react";
import { InspectionPdfButton } from "@/components/InspectionPdfButton";

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

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(date));
}

export default async function InspectionDetailPage({ params }: PageProps) {
  const { id } = await params;

  const inspection = await prisma.inspection.findUnique({
    where: { id },
    include: {
      vehicle: true,
      inspector: true,
      items: {
        include: { photos: true },
        orderBy: { category: "asc" },
      },
    },
  }).catch(() => null);

  if (!inspection) notFound();

  const categories = [...new Set(inspection.items.map((i) => i.category))];
  const ok = inspection.items.filter((i) => i.status === "OK").length;
  const alert = inspection.items.filter((i) => i.status === "ALERT").length;
  const defect = inspection.items.filter((i) => i.status === "DEFECT").length;

  const statusCfg = INSPECTION_STATUS[inspection.status as keyof typeof INSPECTION_STATUS] ?? INSPECTION_STATUS.PENDING;
  const StatusIcon = statusCfg.icon;

  return (
    <div className="min-h-screen bg-[#09090b]">
      {/* Header */}
      <header className="glass-panel border-b border-zinc-800/50 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <Car size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white font-mono tracking-widest">{inspection.vehicle.licensePlate}</h1>
              <p className="text-xs text-zinc-400">Detalhe da Vistoria</p>
            </div>
          </div>
        </div>

        <InspectionPdfButton inspection={inspection} label="Baixar PDF" />
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">

        {/* Info Card */}
        <div className="glass-card p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0">
              <Gauge size={18} className="text-zinc-300" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">KM</p>
              <p className="text-white font-semibold">{inspection.km.toLocaleString("pt-BR")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0">
              <DollarSign size={18} className="text-zinc-300" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Valor</p>
              <p className="text-white font-semibold">{formatCurrency(inspection.value)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0">
              <User size={18} className="text-zinc-300" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Vistoriador</p>
              <p className="text-white font-semibold">{inspection.inspector.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0">
              <CalendarDays size={18} className="text-zinc-300" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Data</p>
              <p className="text-white font-semibold text-sm">{formatDate(inspection.createdAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 col-span-2 sm:col-span-1">
            <div className={`w-9 h-9 ${statusCfg.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
              <StatusIcon size={18} className={statusCfg.color} />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Status</p>
              <p className={`font-semibold ${statusCfg.color}`}>{statusCfg.label}</p>
            </div>
          </div>
        </div>

        {/* Summary Counters */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { count: ok, label: "OK", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: CheckCircle2 },
            { count: alert, label: "Atenção", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", icon: AlertTriangle },
            { count: defect, label: "Defeito", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", icon: XCircle },
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
                          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${cfg.color} ${cfg.bg} ${cfg.border} flex-shrink-0`}>
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
            <h3 className="text-sm font-semibold text-zinc-300 mb-3">Assinatura do Vistoriador</h3>
            <div className="bg-zinc-100 rounded-lg p-3 inline-block">
              <img src={inspection.signature} alt="Assinatura" className="max-h-24 object-contain" />
            </div>
            <p className="text-xs text-zinc-500 mt-2">{inspection.inspector.name}</p>
          </div>
        )}

        {/* Bottom PDF button */}
        <div className="flex justify-center pb-4">
          <InspectionPdfButton inspection={inspection} label="Baixar Laudo em PDF" />
        </div>
      </main>
    </div>
  );
}
