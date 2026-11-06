"use client";

import React, { useState } from "react";
import { Download, ExternalLink, ZoomIn, X } from "lucide-react";
import { REQUIRED_PHOTO_ANGLES } from "@/components/RequiredPhotos";
import { getDriveFileId } from "@/components/PhotoGallery";

interface PhotoCompareGridProps {
  entryPhotosByAngle: Record<string, string>;
  exitPhotosByAngle: Record<string, string>;
}

export function PhotoCompareGrid({
  entryPhotosByAngle,
  exitPhotosByAngle,
}: PhotoCompareGridProps) {
  const [zoomed, setZoomed] = useState<{
    label: string;
    entryUrl?: string;
    exitUrl?: string;
  } | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {REQUIRED_PHOTO_ANGLES.map((angleDef) => {
          const entryUrl = entryPhotosByAngle[angleDef.angle];
          const exitUrl = exitPhotosByAngle[angleDef.angle];

          return (
            <div key={angleDef.angle} className="glass-card p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white">{angleDef.label}</h4>
                {(entryUrl || exitUrl) && (
                  <button
                    type="button"
                    onClick={() =>
                      setZoomed({
                        label: angleDef.label,
                        entryUrl,
                        exitUrl,
                      })
                    }
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <ZoomIn size={14} /> Ampliar
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {/* Entry Photo */}
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-emerald-400">ENTRADA</span>
                  {entryUrl ? (
                    <button
                      type="button"
                      onClick={() =>
                        setZoomed({
                          label: angleDef.label,
                          entryUrl,
                          exitUrl,
                        })
                      }
                      className="relative h-36 rounded-lg overflow-hidden border border-zinc-700 bg-black group"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={entryUrl}
                        alt={`Entrada ${angleDef.label}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </button>
                  ) : (
                    <div className="h-36 rounded-lg border border-zinc-800 bg-zinc-900/50 flex items-center justify-center text-xs text-zinc-500">
                      Sem foto
                    </div>
                  )}
                </div>

                {/* Exit Photo */}
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-amber-400">SAÍDA</span>
                  {exitUrl ? (
                    <button
                      type="button"
                      onClick={() =>
                        setZoomed({
                          label: angleDef.label,
                          entryUrl,
                          exitUrl,
                        })
                      }
                      className="relative h-36 rounded-lg overflow-hidden border border-zinc-700 bg-black group"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={exitUrl}
                        alt={`Saída ${angleDef.label}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </button>
                  ) : (
                    <div className="h-36 rounded-lg border border-zinc-800 bg-zinc-900/50 flex items-center justify-center text-xs text-zinc-500">
                      Sem foto
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Zoom Lightbox Modal */}
      {zoomed && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col p-4"
          onClick={() => setZoomed(null)}
        >
          <div className="flex items-center justify-between max-w-6xl w-full mx-auto py-2">
            <h3 className="text-lg font-bold text-white">{zoomed.label} — Comparativo</h3>
            <button
              type="button"
              onClick={() => setZoomed(null)}
              className="p-2 rounded-full bg-zinc-800 text-white hover:bg-zinc-700"
            >
              <X size={20} />
            </button>
          </div>

          <div
            className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-6xl w-full mx-auto items-center overflow-y-auto py-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 uppercase">
                  Foto da Entrada
                </span>
                {zoomed.entryUrl && (
                  <div className="flex items-center gap-2">
                    {getDriveFileId(zoomed.entryUrl) && (
                      <a
                        href={`https://drive.google.com/file/d/${getDriveFileId(zoomed.entryUrl)}/view`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                      >
                        <ExternalLink size={12} /> Drive
                      </a>
                    )}
                    <a
                      href={zoomed.entryUrl}
                      download={`entrada_${zoomed.label}.jpg`}
                      className="flex items-center gap-1 text-xs text-zinc-300 hover:text-white"
                    >
                      <Download size={12} /> Baixar
                    </a>
                  </div>
                )}
              </div>
              {zoomed.entryUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={zoomed.entryUrl}
                  alt="Entrada ampliada"
                  className="w-full max-h-[75vh] object-contain rounded-xl border border-zinc-700 bg-black"
                />
              ) : (
                <div className="h-64 rounded-xl border border-zinc-800 flex items-center justify-center text-zinc-500">
                  Sem foto registrada na entrada
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 uppercase">Foto da Saída</span>
                {zoomed.exitUrl && (
                  <div className="flex items-center gap-2">
                    {getDriveFileId(zoomed.exitUrl) && (
                      <a
                        href={`https://drive.google.com/file/d/${getDriveFileId(zoomed.exitUrl)}/view`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                      >
                        <ExternalLink size={12} /> Drive
                      </a>
                    )}
                    <a
                      href={zoomed.exitUrl}
                      download={`saida_${zoomed.label}.jpg`}
                      className="flex items-center gap-1 text-xs text-zinc-300 hover:text-white"
                    >
                      <Download size={12} /> Baixar
                    </a>
                  </div>
                )}
              </div>
              {zoomed.exitUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={zoomed.exitUrl}
                  alt="Saída ampliada"
                  className="w-full max-h-[75vh] object-contain rounded-xl border border-zinc-700 bg-black"
                />
              ) : (
                <div className="h-64 rounded-xl border border-zinc-800 flex items-center justify-center text-zinc-500">
                  Sem foto registrada na saída
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
