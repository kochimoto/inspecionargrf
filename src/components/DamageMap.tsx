"use client";

import React, { useState, useRef } from "react";
import { Camera, Edit2, Trash2, X, PlusCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { compressImageFile } from "@/lib/image";

export type DamageTypeKey = "SCRATCH" | "DENT" | "CRACK" | "MISSING_PART" | "OTHER";

export interface DamageItem {
  id: string;
  area: string;
  x: number; // 0 to 100
  y: number; // 0 to 100
  type: DamageTypeKey;
  notes?: string;
  photoUrl?: string | null;
}

export const DAMAGE_TYPE_LABELS: Record<DamageTypeKey, string> = {
  SCRATCH: "Risco / Arranhão",
  DENT: "Amassado",
  CRACK: "Trinca / Quebrado",
  MISSING_PART: "Peça Faltando",
  OTHER: "Outro",
};

export const DAMAGE_TYPE_COLORS: Record<DamageTypeKey, string> = {
  SCRATCH: "#f59e0b", // amber
  DENT: "#ef4444",    // red
  CRACK: "#ec4899",   // pink
  MISSING_PART: "#8b5cf6", // violet
  OTHER: "#3b82f6",   // blue
};

const VEHICLE_AREAS = [
  "Para-choque Dianteiro",
  "Capô",
  "Para-brisa",
  "Teto",
  "Vidro Traseiro",
  "Porta-malas / Tampa Traseira",
  "Para-choque Traseiro",
  "Para-lama Dianteiro Esquerdo",
  "Porta Dianteira Esquerda",
  "Porta Traseira Esquerda",
  "Lateral Traseira Esquerda",
  "Para-lama Dianteiro Direito",
  "Porta Dianteira Direita",
  "Porta Traseira Direita",
  "Lateral Traseira Direita",
  "Retrovisor Esquerdo",
  "Retrovisor Direito",
  "Roda / Pneu",
];

function guessAreaFromCoords(x: number, y: number): string {
  // Top-down car: y: 0 (Front) -> 100 (Rear), x: 0 (Left) -> 100 (Right)
  if (y < 16) return "Para-choque Dianteiro";
  if (y >= 16 && y < 32) {
    if (x < 28) return "Para-lama Dianteiro Esquerdo";
    if (x > 72) return "Para-lama Dianteiro Direito";
    return "Capô";
  }
  if (y >= 32 && y < 44) {
    if (x < 22) return "Retrovisor Esquerdo";
    if (x > 78) return "Retrovisor Direito";
    return "Para-brisa";
  }
  if (y >= 44 && y < 58) {
    if (x < 30) return "Porta Dianteira Esquerda";
    if (x > 70) return "Porta Dianteira Direita";
    return "Teto";
  }
  if (y >= 58 && y < 72) {
    if (x < 30) return "Porta Traseira Esquerda";
    if (x > 70) return "Porta Traseira Direita";
    return "Teto";
  }
  if (y >= 72 && y < 86) {
    if (x < 30) return "Lateral Traseira Esquerda";
    if (x > 70) return "Lateral Traseira Direita";
    return "Porta-malas / Tampa Traseira";
  }
  return "Para-choque Traseiro";
}

interface DamageMapProps {
  damages: DamageItem[];
  onChange?: (damages: DamageItem[]) => void;
  readOnly?: boolean;
  highlightedIds?: Set<string>;
}

export function DamageMap({
  damages,
  onChange,
  readOnly = false,
  highlightedIds,
}: DamageMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [editingDamage, setEditingDamage] = useState<DamageItem | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [compressing, setCompressing] = useState(false);

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (readOnly || !onChange || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = Math.max(2, Math.min(98, Number((((e.clientX - rect.left) / rect.width) * 100).toFixed(1))));
    const y = Math.max(2, Math.min(98, Number((((e.clientY - rect.top) / rect.height) * 100).toFixed(1))));

    const newItem: DamageItem = {
      id: `dmg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      area: guessAreaFromCoords(x, y),
      x,
      y,
      type: "SCRATCH",
      notes: "",
      photoUrl: null,
    };
    setEditingDamage(newItem);
    setIsNew(true);
  };

  const handleSaveModal = () => {
    if (!editingDamage || !onChange) return;
    if (isNew) {
      onChange([...damages, editingDamage]);
    } else {
      onChange(damages.map((d) => (d.id === editingDamage.id ? editingDamage : d)));
    }
    setEditingDamage(null);
    setIsNew(false);
  };

  const handleDelete = (id: string) => {
    if (!onChange) return;
    onChange(damages.filter((d) => d.id !== id));
    if (editingDamage?.id === id) {
      setEditingDamage(null);
      setIsNew(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingDamage) return;
    setCompressing(true);
    try {
      const compressed = await compressImageFile(file, 1600, 0.7);
      setEditingDamage({ ...editingDamage, photoUrl: compressed });
    } catch (err) {
      console.error("Failed to compress damage photo:", err);
    } finally {
      setCompressing(false);
      e.target.value = "";
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* Top-down SVG Vehicle Map */}
      <div className="w-full lg:w-[340px] flex-shrink-0 flex flex-col items-center">
        <div className="glass-card p-4 w-full flex flex-col items-center">
          {!readOnly && (
            <p className="text-xs text-zinc-400 text-center mb-3">
              Toque em qualquer ponto do veículo para marcar uma avaria
            </p>
          )}

          <div className="relative w-full max-w-[260px] aspect-[2/3] select-none touch-manipulation">
            <svg
              ref={svgRef}
              viewBox="0 0 200 300"
              onClick={handleSvgClick}
              className={cn(
                "w-full h-full rounded-xl bg-zinc-950/90 border border-zinc-800",
                !readOnly && "cursor-crosshair"
              )}
            >
              {/* Direction labels */}
              <text x="100" y="16" textAnchor="middle" fill="#71717a" fontSize="9" fontWeight="bold">
                FRENTE
              </text>
              <text x="100" y="293" textAnchor="middle" fill="#71717a" fontSize="9" fontWeight="bold">
                TRASEIRA
              </text>
              <text
                x="11"
                y="150"
                textAnchor="middle"
                fill="#52525b"
                fontSize="8"
                fontWeight="bold"
                transform="rotate(-90 11 150)"
              >
                ESQUERDA (MOTORISTA)
              </text>
              <text
                x="189"
                y="150"
                textAnchor="middle"
                fill="#52525b"
                fontSize="8"
                fontWeight="bold"
                transform="rotate(90 189 150)"
              >
                DIREITA (PASSAGEIRO)
              </text>

              {/* Wheels */}
              <rect x="30" y="55" width="12" height="36" rx="4" fill="#27272a" stroke="#52525b" strokeWidth="1.5" />
              <rect x="158" y="55" width="12" height="36" rx="4" fill="#27272a" stroke="#52525b" strokeWidth="1.5" />
              <rect x="30" y="205" width="12" height="36" rx="4" fill="#27272a" stroke="#52525b" strokeWidth="1.5" />
              <rect x="158" y="205" width="12" height="36" rx="4" fill="#27272a" stroke="#52525b" strokeWidth="1.5" />

              {/* Side Mirrors */}
              <path d="M 38 102 L 24 106 L 26 116 L 38 114 Z" fill="#27272a" stroke="#71717a" strokeWidth="1.5" />
              <path d="M 162 102 L 176 106 L 174 116 L 162 114 Z" fill="#27272a" stroke="#71717a" strokeWidth="1.5" />

              {/* Car Body Outer Silhouette */}
              <path
                d="M 55 28 C 75 22, 125 22, 145 28 C 158 34, 162 50, 162 75 L 162 230 C 162 255, 156 270, 142 274 C 120 278, 80 278, 58 274 C 44 270, 38 255, 38 230 L 38 75 C 38 50, 42 34, 55 28 Z"
                fill="#18181b"
                stroke="#71717a"
                strokeWidth="2"
              />

              {/* Front Bumper line */}
              <path d="M 44 42 Q 100 35 156 42" fill="none" stroke="#52525b" strokeWidth="1.5" />
              {/* Headlights */}
              <path d="M 45 34 Q 55 30 65 34" fill="none" stroke="#fde047" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M 135 34 Q 145 30 155 34" fill="none" stroke="#fde047" strokeWidth="2.5" strokeLinecap="round" />

              {/* Hood lines */}
              <path d="M 52 42 L 56 92" fill="none" stroke="#3f3f46" strokeWidth="1" />
              <path d="M 148 42 L 144 92" fill="none" stroke="#3f3f46" strokeWidth="1" />

              {/* Windshield */}
              <path
                d="M 48 94 Q 100 86 152 94 L 144 124 Q 100 120 56 124 Z"
                fill="#27272a"
                stroke="#71717a"
                strokeWidth="1.5"
              />

              {/* Roof */}
              <rect
                x="56"
                y="124"
                width="88"
                height="74"
                rx="6"
                fill="#1f1f23"
                stroke="#52525b"
                strokeWidth="1.5"
              />

              {/* Door separator lines (left & right) */}
              <line x1="38" y1="160" x2="56" y2="160" stroke="#52525b" strokeWidth="1.5" />
              <line x1="144" y1="160" x2="162" y2="160" stroke="#52525b" strokeWidth="1.5" />

              {/* Rear Window */}
              <path
                d="M 56 198 Q 100 202 144 198 L 150 226 Q 100 232 50 226 Z"
                fill="#27272a"
                stroke="#71717a"
                strokeWidth="1.5"
              />

              {/* Trunk & Rear Bumper */}
              <path d="M 42 260 Q 100 266 158 260" fill="none" stroke="#52525b" strokeWidth="1.5" />
              {/* Taillights */}
              <path d="M 45 270 Q 56 273 66 271" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
              <path d="M 134 271 Q 144 273 155 270" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />

              {/* Numbered Damage Markers */}
              {damages.map((dmg, index) => {
                const cx = (dmg.x / 100) * 200;
                const cy = (dmg.y / 100) * 300;
                const color = DAMAGE_TYPE_COLORS[dmg.type] || "#ef4444";
                const isHighlighted = highlightedIds?.has(dmg.id);

                return (
                  <g
                    key={dmg.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!readOnly) {
                        setEditingDamage(dmg);
                        setIsNew(false);
                      }
                    }}
                    className={cn(!readOnly && "cursor-pointer")}
                  >
                    {isHighlighted && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r="16"
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="2.5"
                        strokeDasharray="3 2"
                      />
                    )}
                    <circle
                      cx={cx}
                      cy={cy}
                      r="11"
                      fill={color}
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                    <text
                      x={cx}
                      y={cy + 3.5}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="10"
                      fontWeight="bold"
                    >
                      {index + 1}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-2 justify-center mt-3">
            {(Object.keys(DAMAGE_TYPE_LABELS) as DamageTypeKey[]).map((key) => (
              <span key={key} className="flex items-center gap-1 text-[11px] text-zinc-400">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: DAMAGE_TYPE_COLORS[key] }}
                />
                {DAMAGE_TYPE_LABELS[key]}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Damages List */}
      <div className="flex-1 w-full flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">
            Avarias Registradas ({damages.length})
          </h3>
          {!readOnly && (
            <button
              type="button"
              onClick={() => {
                setEditingDamage({
                  id: `dmg-${Date.now()}`,
                  area: "Para-choque Dianteiro",
                  x: 50,
                  y: 12,
                  type: "SCRATCH",
                  notes: "",
                  photoUrl: null,
                });
                setIsNew(true);
              }}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold"
            >
              <PlusCircle size={15} /> Adicionar manualmente
            </button>
          )}
        </div>

        {damages.length === 0 ? (
          <div className="glass-card p-6 text-center text-zinc-400 text-sm">
            Nenhuma avaria marcada neste veículo.
            {!readOnly && (
              <p className="text-xs text-zinc-500 mt-1">
                Se houver riscos, amassados ou trincas, toque no desenho do carro para registrar.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {damages.map((dmg, idx) => {
              const isHighlighted = highlightedIds?.has(dmg.id);
              return (
                <div
                  key={dmg.id}
                  className={cn(
                    "glass-card p-3.5 flex items-start gap-3 border",
                    isHighlighted
                      ? "border-red-500/60 bg-red-500/10"
                      : "border-zinc-800"
                  )}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: DAMAGE_TYPE_COLORS[dmg.type] }}
                  >
                    {idx + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-white">{dmg.area}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-medium">
                        {DAMAGE_TYPE_LABELS[dmg.type]}
                      </span>
                      {isHighlighted && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-bold flex items-center gap-1">
                          <AlertTriangle size={11} /> NOVA NA SAÍDA
                        </span>
                      )}
                    </div>
                    {dmg.notes && (
                      <p className="text-xs text-zinc-300 mt-1">{dmg.notes}</p>
                    )}
                    {dmg.photoUrl && (
                      <div className="mt-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={dmg.photoUrl}
                          alt={`Avaria ${dmg.area}`}
                          className="w-24 h-16 object-cover rounded-md border border-zinc-700"
                        />
                      </div>
                    )}
                  </div>

                  {!readOnly && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDamage(dmg);
                          setIsNew(false);
                        }}
                        className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
                        title="Editar avaria"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(dmg.id)}
                        className="p-2 text-red-400 hover:text-red-300 rounded-lg hover:bg-zinc-800"
                        title="Remover avaria"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Damage Modal */}
      {editingDamage && !readOnly && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-t-2xl sm:rounded-2xl w-full max-w-md p-5 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-bold text-white">
                {isNew ? "Registrar Avaria" : "Editar Avaria"}
              </h4>
              <button
                type="button"
                onClick={() => {
                  setEditingDamage(null);
                  setIsNew(false);
                }}
                className="p-1.5 text-zinc-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Area Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">Peça / Região do Veículo</label>
              <select
                value={editingDamage.area}
                onChange={(e) => setEditingDamage({ ...editingDamage, area: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                {VEHICLE_AREAS.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </div>

            {/* Type Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">Tipo de Avaria</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(DAMAGE_TYPE_LABELS) as DamageTypeKey[]).map((key) => {
                  const active = editingDamage.type === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setEditingDamage({ ...editingDamage, type: key })}
                      className={cn(
                        "py-2.5 px-3 rounded-xl border text-xs font-semibold text-left flex items-center gap-2 transition-colors",
                        active
                          ? "bg-blue-600/20 border-blue-500 text-white"
                          : "bg-zinc-950 border-zinc-800 text-zinc-400"
                      )}
                    >
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: DAMAGE_TYPE_COLORS[key] }}
                      />
                      {DAMAGE_TYPE_LABELS[key]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">Observação (Opcional)</label>
              <input
                type="text"
                placeholder="Ex.: Risco profundo de 10cm..."
                value={editingDamage.notes || ""}
                onChange={(e) => setEditingDamage({ ...editingDamage, notes: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Photo attachment */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-zinc-300">Foto da Avaria (Opcional)</label>
              {editingDamage.photoUrl ? (
                <div className="relative h-36 rounded-xl overflow-hidden border border-zinc-700">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={editingDamage.photoUrl}
                    alt="Foto da avaria"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setEditingDamage({ ...editingDamage, photoUrl: null })}
                    className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-full"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer py-3 px-4 rounded-xl border border-dashed border-zinc-700 hover:border-blue-500 bg-zinc-950 flex items-center justify-center gap-2 text-sm text-zinc-300 font-medium">
                  <Camera size={18} className="text-blue-400" />
                  {compressing ? "Processando foto..." : "Tirar Foto da Avaria"}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                </label>
              )}
            </div>

            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => {
                  setEditingDamage(null);
                  setIsNew(false);
                }}
                className="flex-1 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveModal}
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm"
              >
                Salvar Avaria
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
