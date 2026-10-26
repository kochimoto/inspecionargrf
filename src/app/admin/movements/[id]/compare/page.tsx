import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Car,
  Gauge,
  Fuel,
  AlertTriangle,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import { PhotoCompareGrid } from "@/components/PhotoCompareGrid";
import { DamageMap, DamageItem, DAMAGE_TYPE_LABELS } from "@/components/DamageMap";

interface PageProps {
  params: Promise<{ id: string }>;
}

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

export default async function MovementComparePage({ params }: PageProps) {
  const { id } = await params;

  const currentMovement = await prisma.movement
    .findUnique({
      where: { id },
      include: {
        vehicle: true,
        inspector: true,
        inspection: true,
        photos: true,
        damages: { include: { photo: true } },
      },
    })
    .catch(() => null);

  if (!currentMovement) notFound();

  // Find the most recent ENTRY prior to (or latest ENTRY for) this vehicle
  const previousEntry = await prisma.movement.findFirst({
    where: {
      vehicleId: currentMovement.vehicleId,
      type: "ENTRY",
      id: { not: currentMovement.id },
      createdAt: { lte: currentMovement.createdAt },
    },
    orderBy: { createdAt: "desc" },
    include: {
      inspector: true,
      inspection: true,
      photos: true,
      damages: { include: { photo: true } },
    },
  });

  const entryMovement =
    currentMovement.type === "EXIT" ? previousEntry : currentMovement;
  const exitMovement =
    currentMovement.type === "EXIT" ? currentMovement : null;

  const entryPhotosByAngle: Record<string, string> = {};
  if (entryMovement) {
    for (const p of entryMovement.photos) {
      if (p.angle !== "EXTRA" && !entryPhotosByAngle[p.angle]) {
        entryPhotosByAngle[p.angle] = p.url;
      }
    }
  }

  const exitPhotosByAngle: Record<string, string> = {};
  if (exitMovement) {
    for (const p of exitMovement.photos) {
      if (p.angle !== "EXTRA" && !exitPhotosByAngle[p.angle]) {
        exitPhotosByAngle[p.angle] = p.url;
      }
    }
  }

  const entryDamages: DamageItem[] = (entryMovement?.damages ?? []).map((d) => ({
    id: d.id,
    area: d.area,
    x: d.x,
    y: d.y,
    type: d.type,
    notes: d.notes ?? "",
    photoUrl: d.photo?.url ?? null,
  }));

  const exitDamages: DamageItem[] = (exitMovement?.damages ?? []).map((d) => ({
    id: d.id,
    area: d.area,
    x: d.x,
    y: d.y,
    type: d.type,
    notes: d.notes ?? "",
    photoUrl: d.photo?.url ?? null,
  }));

  // Detect NEW damages in exit that were not present in entry (by area + type + proximity)
  const newDamageIds = new Set<string>();
  for (const exitDmg of exitDamages) {
    const existedInEntry = entryDamages.some(
      (entryDmg) =>
        entryDmg.area === exitDmg.area &&
        entryDmg.type === exitDmg.type &&
        Math.hypot(entryDmg.x - exitDmg.x, entryDmg.y - exitDmg.y) < 18
    );
    if (!existedInEntry) {
      newDamageIds.add(exitDmg.id);
    }
  }

  const newDamagesList = exitDamages.filter((d) => newDamageIds.has(d.id));
  const kmDiff =
    entryMovement && exitMovement ? exitMovement.km - entryMovement.km : null;
  const fuelDiff =
    entryMovement && exitMovement
      ? exitMovement.fuelLevel - entryMovement.fuelLevel
      : null;

  return (
    <div className="min-h-screen bg-[#09090b] pb-16">
      <header className="glass-panel border-b border-zinc-800/50 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-600 rounded-xl flex items-center justify-center">
              <Car size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white font-mono tracking-widest">
                {currentMovement.vehicle.licensePlate}
              </h1>
              <p className="text-xs text-zinc-400">Comparativo Entrada × Saída</p>
            </div>
          </div>
        </div>

        {currentMovement.inspection && (
          <Link
            href={`/admin/inspection/${currentMovement.inspection.id}`}
            className="text-xs bg-zinc-800 hover:bg-zinc-700 text-white px-3.5 py-2 rounded-lg font-semibold"
          >
            Ver Laudo da Vistoria →
          </Link>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-6">
        {/* Warning if no previous entry */}
        {!entryMovement && (
          <div className="p-5 rounded-2xl border border-amber-500/40 bg-amber-500/10 flex items-start gap-3 text-amber-300">
            <AlertTriangle size={24} className="flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-base text-white">
                Nenhuma ENTRADA anterior encontrada para este veículo
              </h3>
              <p className="text-sm mt-1">
                Esta saída foi registrada sem uma movimentação de entrada prévia para a placa{" "}
                <strong className="font-mono">{currentMovement.vehicle.licensePlate}</strong>. Os
                dados abaixo mostram apenas os registros da saída.
              </p>
            </div>
          </div>
        )}

        {/* Side-by-Side Metrics Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Entry Card */}
          <div className="glass-card p-5 border border-emerald-500/30">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400">
                ENTRADA
              </span>
              {entryMovement && (
                <span className="text-xs text-zinc-400 flex items-center gap-1">
                  <Calendar size={12} /> {formatDate(entryMovement.createdAt)}
                </span>
              )}
            </div>
            {entryMovement ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-zinc-500 flex items-center gap-1">
                    <Gauge size={13} /> KM Entrada
                  </span>
                  <p className="text-lg font-bold text-white">
                    {entryMovement.km.toLocaleString("pt-BR")} km
                  </p>
                </div>
                <div>
                  <span className="text-xs text-zinc-500 flex items-center gap-1">
                    <Fuel size={13} /> Combustível
                  </span>
                  <p className="text-lg font-bold text-white">{entryMovement.fuelLevel}%</p>
                </div>
                <div className="col-span-2 text-xs text-zinc-400">
                  Entregue por: <strong className="text-zinc-200">{entryMovement.personName}</strong> ·
                  Vistoriador: <strong className="text-zinc-200">{entryMovement.inspector.name}</strong>
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500 py-4">Sem registro de entrada anterior.</p>
            )}
          </div>

          {/* Exit Card */}
          <div className="glass-card p-5 border border-amber-500/30">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400">
                SAÍDA
              </span>
              {exitMovement && (
                <span className="text-xs text-zinc-400 flex items-center gap-1">
                  <Calendar size={12} /> {formatDate(exitMovement.createdAt)}
                </span>
              )}
            </div>
            {exitMovement ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-zinc-500 flex items-center gap-1">
                    <Gauge size={13} /> KM Saída
                  </span>
                  <p className="text-lg font-bold text-white">
                    {exitMovement.km.toLocaleString("pt-BR")} km
                  </p>
                </div>
                <div>
                  <span className="text-xs text-zinc-500 flex items-center gap-1">
                    <Fuel size={13} /> Combustível
                  </span>
                  <p className="text-lg font-bold text-white">{exitMovement.fuelLevel}%</p>
                </div>
                <div className="col-span-2 text-xs text-zinc-400">
                  Retirado por: <strong className="text-zinc-200">{exitMovement.personName}</strong> ·
                  Vistoriador: <strong className="text-zinc-200">{exitMovement.inspector.name}</strong>
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500 py-4">
                Esta movimentação é uma ENTRADA. Registre uma saída para comparar.
              </p>
            )}
          </div>

          {/* Differences Card */}
          <div className="glass-card p-5 border border-blue-500/30 flex flex-col justify-between">
            <span className="text-xs font-bold text-blue-400 uppercase">
              Diferenças no Período
            </span>
            <div className="grid grid-cols-3 gap-2 my-2 text-center">
              <div className="bg-zinc-900 rounded-xl p-2.5">
                <span className="text-[11px] text-zinc-400 block">KM Rodados</span>
                <strong className="text-base text-white">
                  {kmDiff !== null ? `${kmDiff >= 0 ? "+" : ""}${kmDiff.toLocaleString("pt-BR")}` : "—"}
                </strong>
              </div>
              <div className="bg-zinc-900 rounded-xl p-2.5">
                <span className="text-[11px] text-zinc-400 block">Combustível</span>
                <strong className="text-base text-white">
                  {fuelDiff !== null ? `${fuelDiff >= 0 ? "+" : ""}${fuelDiff}%` : "—"}
                </strong>
              </div>
              <div className="bg-zinc-900 rounded-xl p-2.5">
                <span className="text-[11px] text-zinc-400 block">Novas Avarias</span>
                <strong
                  className={`text-base ${
                    newDamagesList.length > 0 ? "text-red-400" : "text-emerald-400"
                  }`}
                >
                  {newDamagesList.length}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* New Damages Highlight Box */}
        {exitMovement && (
          <div
            className={`glass-card p-5 border ${
              newDamagesList.length > 0
                ? "border-red-500/40 bg-red-500/10"
                : "border-emerald-500/30 bg-emerald-500/5"
            }`}
          >
            {newDamagesList.length > 0 ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-red-400 font-bold text-base">
                  <AlertTriangle size={20} />
                  <span>
                    {newDamagesList.length} Nova(s) Avaria(s) Identificada(s) na Saída!
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {newDamagesList.map((dmg) => (
                    <div
                      key={dmg.id}
                      className="bg-zinc-950/80 border border-red-500/40 rounded-xl p-3 flex items-center justify-between gap-3"
                    >
                      <div>
                        <span className="font-bold text-sm text-white block">{dmg.area}</span>
                        <span className="text-xs text-red-300">
                          {DAMAGE_TYPE_LABELS[dmg.type]}
                          {dmg.notes ? ` — ${dmg.notes}` : ""}
                        </span>
                      </div>
                      {dmg.photoUrl && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={dmg.photoUrl}
                          alt={dmg.area}
                          className="w-16 h-12 object-cover rounded border border-zinc-700"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                <CheckCircle2 size={18} />
                Nenhuma avaria nova registrada na saída em relação à entrada.
              </div>
            )}
          </div>
        )}

        {/* Damage Maps Side by Side */}
        {exitMovement && (
          <div className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-white">Mapa de Avarias na Saída</h2>
            <DamageMap
              damages={exitDamages}
              readOnly
              highlightedIds={newDamageIds}
            />
          </div>
        )}

        {/* Side-by-Side Photos by Angle */}
        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-bold text-white">
            Comparativo Fotográfico por Ângulo (Toque para Zoom)
          </h2>
          <PhotoCompareGrid
            entryPhotosByAngle={entryPhotosByAngle}
            exitPhotosByAngle={exitPhotosByAngle}
          />
        </div>
      </main>
    </div>
  );
}
