"use client";

import React, { useState } from "react";
import { Camera, ChevronDown, ChevronUp, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { compressImageFile } from "@/lib/image";

export type Status = "OK" | "ALERT" | "DEFECT" | null;

export interface ItemData {
  id: string;
  name: string;
  status: Status;
  photoUrl: string | null;
  observation?: string;
  requirePhotoAlways?: boolean;
}

export interface CategoryData {
  category: string;
  items: ItemData[];
}

interface ChecklistItemProps {
  item: ItemData;
  onChange: (id: string, updates: Partial<ItemData>) => void;
}

function ChecklistItem({ item, onChange }: ChecklistItemProps) {
  const [compressing, setCompressing] = useState(false);

  const handleStatusChange = (status: Status) => {
    onChange(item.id, { status });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressing(true);
    try {
      const compressed = await compressImageFile(file, 1600, 0.7);
      onChange(item.id, { photoUrl: compressed });
    } catch (err) {
      console.error("Failed to compress item photo:", err);
    } finally {
      setCompressing(false);
      e.target.value = "";
    }
  };

  const requirePhoto = item.requirePhotoAlways;
  const missingPhoto = requirePhoto && !item.photoUrl;

  return (
    <div className="py-4 border-b border-zinc-800/50 last:border-b-0 flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2.5">
        <span className="font-medium text-base text-zinc-200">{item.name}</span>

        <div className="grid grid-cols-3 sm:flex items-center gap-2">
          {/* OK Button */}
          <button
            type="button"
            onClick={() => handleStatusChange("OK")}
            className={cn(
              "py-2.5 px-3 rounded-lg border btn-interactive flex items-center justify-center gap-1.5 text-xs font-semibold min-h-[44px]",
              item.status === "OK"
                ? "bg-[var(--color-status-ok-muted)] border-[var(--color-status-ok)] text-[var(--color-status-ok)]"
                : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200"
            )}
          >
            <CheckCircle size={18} />
            <span>OK / Bom</span>
          </button>

          {/* ALERT Button */}
          <button
            type="button"
            onClick={() => handleStatusChange("ALERT")}
            className={cn(
              "py-2.5 px-3 rounded-lg border btn-interactive flex items-center justify-center gap-1.5 text-xs font-semibold min-h-[44px]",
              item.status === "ALERT"
                ? "bg-[var(--color-status-alert-muted)] border-[var(--color-status-alert)] text-[var(--color-status-alert)]"
                : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200"
            )}
          >
            <AlertTriangle size={18} />
            <span>Atenção</span>
          </button>

          {/* DEFECT Button */}
          <button
            type="button"
            onClick={() => handleStatusChange("DEFECT")}
            className={cn(
              "py-2.5 px-3 rounded-lg border btn-interactive flex items-center justify-center gap-1.5 text-xs font-semibold min-h-[44px]",
              item.status === "DEFECT"
                ? "bg-[var(--color-status-defect-muted)] border-[var(--color-status-defect)] text-[var(--color-status-defect)]"
                : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200"
            )}
          >
            <XCircle size={18} />
            <span>Defeito / Falta</span>
          </button>
        </div>
      </div>

      {/* Observation + Optional Photo row */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder={
            item.status === "ALERT" || item.status === "DEFECT"
              ? "Descreva a observação ou avaria..."
              : "Observação opcional..."
          }
          value={item.observation || ""}
          onChange={(e) => onChange(item.id, { observation: e.target.value })}
          className={cn(
            "flex-1 bg-zinc-900 border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none transition-colors",
            (item.status === "ALERT" || item.status === "DEFECT") && !item.observation
              ? "border-amber-500/50 focus:border-amber-500"
              : "border-zinc-800 focus:border-blue-500"
          )}
        />

        <label
          title="Anexar foto do item"
          className={cn(
            "cursor-pointer p-2.5 rounded-lg border transition-colors flex items-center justify-center gap-1.5 min-h-[42px] px-3 text-xs font-medium flex-shrink-0",
            item.photoUrl
              ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
              : missingPhoto
              ? "bg-[var(--color-status-defect-muted)] border-[var(--color-status-defect)] text-[var(--color-status-defect)]"
              : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
          )}
        >
          <Camera size={18} />
          <span className="hidden sm:inline">{compressing ? "..." : item.photoUrl ? "Trocar" : "Foto"}</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoUpload}
          />
        </label>
      </div>

      {item.photoUrl && (
        <div className="relative w-full h-36 rounded-lg overflow-hidden border border-zinc-700">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.photoUrl} alt={`Foto de ${item.name}`} className="object-cover w-full h-full" />
          <button
            type="button"
            onClick={() => onChange(item.id, { photoUrl: null })}
            className="absolute top-2 right-2 bg-black/70 rounded-full p-1.5 text-white hover:bg-black"
          >
            <XCircle size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

interface ChecklistCategoryProps {
  categoryData: CategoryData;
  onChange: (id: string, updates: Partial<ItemData>) => void;
  defaultOpen?: boolean;
}

function ChecklistCategory({ categoryData, onChange, defaultOpen = true }: ChecklistCategoryProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const completed = categoryData.items.filter((i) => i.status !== null).length;
  const total = categoryData.items.length;
  const isAllCompleted = completed === total;

  const handleMarkAllOk = (e: React.MouseEvent) => {
    e.stopPropagation();
    categoryData.items.forEach((item) => {
      if (item.status === null) {
        onChange(item.id, { status: "OK" });
      }
    });
  };

  return (
    <div className="glass-card mb-4">
      <div className="w-full px-4 py-3.5 flex items-center justify-between bg-zinc-800/40">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-3 flex-1 text-left"
        >
          <span className="font-semibold text-base sm:text-lg text-zinc-100">{categoryData.category}</span>
          <span
            className={cn(
              "text-xs px-2.5 py-0.5 rounded-full font-semibold",
              isAllCompleted
                ? "bg-[var(--color-status-ok-muted)] text-[var(--color-status-ok)]"
                : "bg-zinc-700 text-zinc-300"
            )}
          >
            {completed}/{total}
          </span>
        </button>

        <div className="flex items-center gap-2">
          {!isAllCompleted && (
            <button
              type="button"
              onClick={handleMarkAllOk}
              className="text-xs bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border border-emerald-500/30 px-2.5 py-1.5 rounded-lg font-medium transition-colors"
            >
              Marcar restantes OK
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 text-zinc-400 hover:text-white"
          >
            {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="px-4 pb-2">
          {categoryData.items.map((item) => (
            <ChecklistItem key={item.id} item={item} onChange={onChange} />
          ))}
        </div>
      )}
    </div>
  );
}

interface ChecklistProps {
  categories: CategoryData[];
  onChange: (id: string, updates: Partial<ItemData>) => void;
}

export function Checklist({ categories, onChange }: ChecklistProps) {
  return (
    <div className="w-full">
      {categories.map((cat) => (
        <ChecklistCategory
          key={cat.category}
          categoryData={cat}
          onChange={onChange}
          defaultOpen={true}
        />
      ))}
    </div>
  );
}
