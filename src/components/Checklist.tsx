"use client";

import React, { useState } from "react";
import { Camera, ChevronDown, ChevronUp, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const handleStatusChange = (status: Status) => {
    onChange(item.id, { status });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        onChange(item.id, { photoUrl: event.target?.result as string });
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const requirePhoto = item.requirePhotoAlways || item.status === "ALERT" || item.status === "DEFECT";
  const missingPhoto = requirePhoto && !item.photoUrl;

  return (
    <div className="py-3 border-b border-zinc-800/50 flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <span className="font-medium text-sm sm:text-base text-zinc-200">{item.name}</span>
        
        <div className="flex items-center gap-1 sm:gap-2">
          {/* OK Button */}
          <button
            type="button"
            onClick={() => handleStatusChange("OK")}
            className={cn(
              "p-2 rounded-md border btn-interactive flex items-center justify-center",
              item.status === "OK" 
                ? "bg-[var(--color-status-ok-muted)] border-[var(--color-status-ok)] text-[var(--color-status-ok)]" 
                : "bg-zinc-900 border-zinc-700 text-zinc-500 hover:text-zinc-300"
            )}
          >
            <CheckCircle size={20} />
          </button>
          
          {/* ALERT Button */}
          <button
            type="button"
            onClick={() => handleStatusChange("ALERT")}
            className={cn(
              "p-2 rounded-md border btn-interactive flex items-center justify-center",
              item.status === "ALERT" 
                ? "bg-[var(--color-status-alert-muted)] border-[var(--color-status-alert)] text-[var(--color-status-alert)]" 
                : "bg-zinc-900 border-zinc-700 text-zinc-500 hover:text-zinc-300"
            )}
          >
            <AlertTriangle size={20} />
          </button>
          
          {/* DEFECT Button */}
          <button
            type="button"
            onClick={() => handleStatusChange("DEFECT")}
            className={cn(
              "p-2 rounded-md border btn-interactive flex items-center justify-center",
              item.status === "DEFECT" 
                ? "bg-[var(--color-status-defect-muted)] border-[var(--color-status-defect)] text-[var(--color-status-defect)]" 
                : "bg-zinc-900 border-zinc-700 text-zinc-500 hover:text-zinc-300"
            )}
          >
            <XCircle size={20} />
          </button>
        </div>
      </div>

      {item.status === "ALERT" && (
        <div>
          <input
            type="text"
            placeholder="Adicione uma observação (obrigatório para Atenção)..."
            value={item.observation || ""}
            onChange={(e) => onChange(item.id, { observation: e.target.value })}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-[var(--color-status-alert)] focus:ring-1 focus:ring-[var(--color-status-alert)]"
          />
        </div>
      )}

      <div className="flex items-center justify-between">
        {missingPhoto && (
          <span className="text-xs text-[var(--color-status-defect)] animate-pulse">
            * Foto obrigatória
          </span>
        )}
        {!missingPhoto && item.photoUrl && (
          <span className="text-xs text-[var(--color-status-ok)] flex items-center gap-1">
            <CheckCircle size={12} /> Foto anexada
          </span>
        )}
        {!missingPhoto && !item.photoUrl && <span className="text-xs"></span>}

        <label className={cn(
          "cursor-pointer p-2 rounded-full transition-colors flex items-center justify-center",
          item.photoUrl ? "bg-zinc-800 text-zinc-300" : (missingPhoto ? "bg-[var(--color-status-defect-muted)] text-[var(--color-status-defect)] ring-1 ring-[var(--color-status-defect)]" : "bg-zinc-900 text-zinc-500 hover:text-zinc-300")
        )}>
          <Camera size={20} />
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
         <div className="mt-2 relative w-full h-32 rounded-md overflow-hidden border border-zinc-700">
           <img src={item.photoUrl} alt={`Foto de ${item.name}`} className="object-cover w-full h-full" />
           <button 
             type="button"
             onClick={() => onChange(item.id, { photoUrl: null })}
             className="absolute top-1 right-1 bg-black/60 rounded-full p-1 text-white hover:bg-black"
           >
             <XCircle size={16} />
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

function ChecklistCategory({ categoryData, onChange, defaultOpen = false }: ChecklistCategoryProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const completed = categoryData.items.filter(i => i.status !== null).length;
  const total = categoryData.items.length;
  const isAllCompleted = completed === total;

  return (
    <div className="glass-card mb-4">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between bg-zinc-800/40 hover:bg-zinc-800/60 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-lg text-zinc-100">{categoryData.category}</span>
          <span className={cn("text-xs px-2 py-1 rounded-full", isAllCompleted ? "bg-[var(--color-status-ok-muted)] text-[var(--color-status-ok)]" : "bg-zinc-700 text-zinc-300")}>
            {completed}/{total}
          </span>
        </div>
        {isOpen ? <ChevronUp className="text-zinc-400" /> : <ChevronDown className="text-zinc-400" />}
      </button>

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
      {categories.map((cat, index) => (
        <ChecklistCategory 
          key={cat.category} 
          categoryData={cat} 
          onChange={onChange}
          defaultOpen={index === 0} 
        />
      ))}
    </div>
  );
}
