"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, ExternalLink, X } from "lucide-react";

export interface GalleryPhoto {
  url: string;
  label?: string;
}

const DRIVE_PREFIX = "/api/drive/";

/** Returns the Google Drive file id if the photo is stored in Drive. */
export function getDriveFileId(url: string) {
  return url.startsWith(DRIVE_PREFIX) ? url.slice(DRIVE_PREFIX.length) : null;
}

interface PhotoGalleryProps {
  photos: GalleryPhoto[];
  /** Classes for the wrapper around the thumbnails. */
  className?: string;
  /** Classes for each thumbnail <img>. */
  thumbClassName?: string;
  /** Show the label under each thumbnail. */
  showLabels?: boolean;
}

/** Thumbnails that open a full-screen viewer when clicked. */
export function PhotoGallery({
  photos,
  className = "flex flex-wrap gap-2",
  thumbClassName = "w-28 h-20 object-cover rounded-lg border border-zinc-700",
  showLabels = false,
}: PhotoGalleryProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (photos.length === 0) return null;

  return (
    <>
      <div className={className}>
        {photos.map((p, idx) => (
          <button
            key={`${p.url.slice(0, 64)}-${idx}`}
            type="button"
            onClick={() => setOpenIndex(idx)}
            className={
              showLabels
                ? "flex flex-col gap-1 bg-zinc-900/70 rounded-xl p-2 border border-zinc-800 hover:border-blue-500/60 transition-colors text-left cursor-zoom-in"
                : "group cursor-zoom-in"
            }
            title="Clique para ampliar"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.url}
              alt={p.label ?? "Foto"}
              loading="lazy"
              className={`${thumbClassName} hover:opacity-90 transition-opacity`}
            />
            {showLabels && p.label && (
              <span className="text-[11px] text-zinc-300 font-medium text-center truncate w-full">
                {p.label}
              </span>
            )}
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <PhotoLightbox
          photos={photos}
          index={openIndex}
          onChangeIndex={setOpenIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </>
  );
}

interface PhotoLightboxProps {
  photos: GalleryPhoto[];
  index: number;
  onChangeIndex: (i: number) => void;
  onClose: () => void;
}

export function PhotoLightbox({ photos, index, onChangeIndex, onClose }: PhotoLightboxProps) {
  const photo = photos[index];
  const hasMany = photos.length > 1;
  const driveId = getDriveFileId(photo.url);

  const prev = useCallback(
    () => onChangeIndex((index - 1 + photos.length) % photos.length),
    [index, photos.length, onChangeIndex]
  );
  const next = useCallback(
    () => onChangeIndex((index + 1) % photos.length),
    [index, photos.length, onChangeIndex]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasMany) prev();
      if (e.key === "ArrowRight" && hasMany) next();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, prev, next, hasMany]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col"
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          <p className="text-white font-semibold truncate">{photo.label ?? "Foto"}</p>
          {hasMany && (
            <p className="text-xs text-zinc-400">
              {index + 1} de {photos.length}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {driveId && (
            <a
              href={`https://drive.google.com/file/d/${driveId}/view`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
            >
              <ExternalLink size={14} /> Abrir no Drive
            </a>
          )}
          <a
            href={photo.url}
            download={`${(photo.label ?? "foto").replace(/[^a-zA-Z0-9_-]+/g, "_")}.jpg`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold"
          >
            <Download size={14} /> Baixar
          </a>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-zinc-800 text-white hover:bg-zinc-700"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Image */}
      <div className="flex-1 relative flex items-center justify-center px-2 pb-4 min-h-0">
        {hasMany && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            className="absolute left-2 md:left-6 p-3 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-white z-10"
            aria-label="Anterior"
          >
            <ChevronLeft size={24} />
          </button>
        )}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={photo.label ?? "Foto ampliada"}
          className="max-w-full max-h-full object-contain rounded-lg"
          onClick={(e) => e.stopPropagation()}
        />

        {hasMany && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            className="absolute right-2 md:right-6 p-3 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-white z-10"
            aria-label="Próxima"
          >
            <ChevronRight size={24} />
          </button>
        )}
      </div>
    </div>
  );
}
