"use client";

import React, { useState } from "react";
import { Camera, CheckCircle2, RefreshCw, Plus, Trash2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { compressImageFile } from "@/lib/image";

export type RequiredPhotoAngle =
  | "FRONT"
  | "REAR"
  | "LEFT"
  | "RIGHT"
  | "FRONT_LEFT"
  | "FRONT_RIGHT"
  | "REAR_LEFT"
  | "REAR_RIGHT"
  | "DASHBOARD"
  | "INTERIOR";

export interface AngleDefinition {
  angle: RequiredPhotoAngle;
  label: string;
  hint: string;
}

export const REQUIRED_PHOTO_ANGLES: AngleDefinition[] = [
  { angle: "FRONT", label: "1. Frente", hint: "Visão frontal centralizada mostrando a placa" },
  { angle: "REAR", label: "2. Traseira", hint: "Visão traseira centralizada mostrando a placa" },
  { angle: "LEFT", label: "3. Lateral Esquerda", hint: "Lado do motorista por inteiro" },
  { angle: "RIGHT", label: "4. Lateral Direita", hint: "Lado do passageiro por inteiro" },
  { angle: "FRONT_LEFT", label: "5. Diagonal Dianteira Esq.", hint: "Frente + lateral esquerda (45°)" },
  { angle: "FRONT_RIGHT", label: "6. Diagonal Dianteira Dir.", hint: "Frente + lateral direita (45°)" },
  { angle: "REAR_LEFT", label: "7. Diagonal Traseira Esq.", hint: "Traseira + lateral esquerda (45°)" },
  { angle: "REAR_RIGHT", label: "8. Diagonal Traseira Dir.", hint: "Traseira + lateral direita (45°)" },
  { angle: "DASHBOARD", label: "9. Painel (KM aceso)", hint: "Hodômetro e luzes do painel visíveis" },
  { angle: "INTERIOR", label: "10. Interior Geral", hint: "Bancos dianteiros, volante e console" },
];

export const PHOTO_ANGLE_LABELS: Record<string, string> = {
  FRONT: "Frente",
  REAR: "Traseira",
  LEFT: "Lateral Esquerda",
  RIGHT: "Lateral Direita",
  FRONT_LEFT: "Diagonal Dianteira Esq.",
  FRONT_RIGHT: "Diagonal Dianteira Dir.",
  REAR_LEFT: "Diagonal Traseira Esq.",
  REAR_RIGHT: "Diagonal Traseira Dir.",
  DASHBOARD: "Painel (KM)",
  INTERIOR: "Interior",
  TRUNK: "Porta-malas",
  CHASSIS_PLATE: "Chassi / Plaqueta",
  EXTRA: "Foto Extra",
};

export interface ExtraPhotoItem {
  id: string;
  url: string;
}

interface RequiredPhotosProps {
  photosByAngle: Partial<Record<RequiredPhotoAngle, string>>;
  onPhotoChange: (angle: RequiredPhotoAngle, dataUrl: string | null) => void;
  extraPhotos: ExtraPhotoItem[];
  onAddExtraPhoto: (dataUrl: string) => void;
  onRemoveExtraPhoto: (id: string) => void;
}

export function RequiredPhotos({
  photosByAngle,
  onPhotoChange,
  extraPhotos,
  onAddExtraPhoto,
  onRemoveExtraPhoto,
}: RequiredPhotosProps) {
  const [loadingAngle, setLoadingAngle] = useState<string | null>(null);

  const completedCount = REQUIRED_PHOTO_ANGLES.filter((a) => Boolean(photosByAngle[a.angle])).length;
  const totalRequired = REQUIRED_PHOTO_ANGLES.length;
  const allCompleted = completedCount === totalRequired;

  const handleCapture = async (angle: RequiredPhotoAngle, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadingAngle(angle);
    try {
      const compressed = await compressImageFile(file, 1600, 0.7);
      onPhotoChange(angle, compressed);
    } catch (err) {
      console.error("Failed to compress photo:", err);
      alert("Não foi possível processar a foto. Tente novamente.");
    } finally {
      setLoadingAngle(null);
      e.target.value = "";
    }
  };

  const handleExtraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadingAngle("EXTRA");
    try {
      const compressed = await compressImageFile(file, 1600, 0.7);
      onAddExtraPhoto(compressed);
    } catch (err) {
      console.error("Failed to compress extra photo:", err);
      alert("Não foi possível processar a foto extra.");
    } finally {
      setLoadingAngle(null);
      e.target.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Progress Banner */}
      <div
        className={cn(
          "glass-card p-4 flex items-center justify-between border",
          allCompleted
            ? "border-emerald-500/40 bg-emerald-500/10"
            : "border-amber-500/30 bg-amber-500/10"
        )}
      >
        <div className="flex items-center gap-3">
          {allCompleted ? (
            <CheckCircle2 className="text-emerald-400 flex-shrink-0" size={24} />
          ) : (
            <AlertCircle className="text-amber-400 flex-shrink-0" size={24} />
          )}
          <div>
            <p className="text-sm font-bold text-white">
              {allCompleted
                ? "Todas as 10 fotos obrigatórias registradas!"
                : `Faltam ${totalRequired - completedCount} foto(s) obrigatória(s)`}
            </p>
            <p className="text-xs text-zinc-300">
              Toque em cada ângulo para abrir a câmera traseira
            </p>
          </div>
        </div>
        <span
          className={cn(
            "px-3 py-1 rounded-full text-xs font-bold",
            allCompleted ? "bg-emerald-500 text-zinc-950" : "bg-zinc-800 text-zinc-200"
          )}
        >
          {completedCount}/{totalRequired}
        </span>
      </div>

      {/* 10 Required Angles Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {REQUIRED_PHOTO_ANGLES.map((item) => {
          const url = photosByAngle[item.angle];
          const isLoading = loadingAngle === item.angle;

          return (
            <div
              key={item.angle}
              className={cn(
                "glass-card p-3.5 flex flex-col gap-3 border transition-all",
                url ? "border-emerald-500/40 bg-zinc-900/50" : "border-zinc-800"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-white">{item.label}</span>
                    {url ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold">
                        Feita
                      </span>
                    ) : (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-semibold">
                        Pendente
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">{item.hint}</p>
                </div>
              </div>

              {url ? (
                <div className="relative w-full h-44 rounded-lg overflow-hidden border border-zinc-700 bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={item.label} className="w-full h-full object-cover" />
                  <div className="absolute bottom-2 right-2 flex gap-2">
                    <label className="cursor-pointer bg-zinc-900/90 hover:bg-zinc-800 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 border border-zinc-600 shadow-lg">
                      <RefreshCw size={14} />
                      {isLoading ? "Processando..." : "Refazer"}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => handleCapture(item.angle, e)}
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <label className="cursor-pointer w-full h-32 rounded-xl border-2 border-dashed border-zinc-700 hover:border-blue-500 bg-zinc-900/60 hover:bg-zinc-900 transition-colors flex flex-col items-center justify-center gap-2 text-zinc-300 active:scale-[0.99]">
                  <div className="w-11 h-11 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center">
                    <Camera size={22} />
                  </div>
                  <span className="text-sm font-semibold">
                    {isLoading ? "Comprimindo foto..." : "Tirar Foto"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => handleCapture(item.angle, e)}
                  />
                </label>
              )}
            </div>
          );
        })}
      </div>

      {/* Extra Photos Section */}
      <div className="glass-card p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Fotos Extras (Detalhes / Avarias)</h3>
            <p className="text-xs text-zinc-400">Opcional — adicione quantas fotos de detalhe precisar</p>
          </div>
          <label className="cursor-pointer bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 border border-zinc-700 btn-interactive">
            <Plus size={16} />
            {loadingAngle === "EXTRA" ? "Adicionando..." : "Adicionar Foto"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleExtraCapture}
            />
          </label>
        </div>

        {extraPhotos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-1">
            {extraPhotos.map((photo, index) => (
              <div
                key={photo.id}
                className="relative h-32 rounded-lg overflow-hidden border border-zinc-700 bg-black"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={`Foto extra ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-1.5 left-1.5 bg-black/70 text-[10px] text-white px-2 py-0.5 rounded">
                  Extra #{index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveExtraPhoto(photo.id)}
                  className="absolute top-1.5 right-1.5 bg-red-600/90 hover:bg-red-600 text-white p-1.5 rounded-full"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
