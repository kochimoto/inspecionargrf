"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Car, Gauge, DollarSign, Send, ClipboardCheck } from "lucide-react";
import { LicensePlateInput } from "@/components/LicensePlateInput";
import { Checklist, CategoryData, ItemData } from "@/components/Checklist";
import { SignaturePad } from "@/components/SignaturePad";
import { submitInspection } from "@/app/actions";

const INITIAL_CATEGORIES: CategoryData[] = [
  {
    category: "Fotos Obrigatórias (Padrão Detran)",
    items: [
      { id: "fot-1", name: "Frente do Veículo", status: null, photoUrl: null, requirePhotoAlways: true },
      { id: "fot-2", name: "Fundo do Veículo", status: null, photoUrl: null, requirePhotoAlways: true },
      { id: "fot-3", name: "Lateral do Veículo", status: null, photoUrl: null, requirePhotoAlways: true },
      { id: "fot-4", name: "Placa", status: null, photoUrl: null, requirePhotoAlways: true },
      { id: "fot-5", name: "Para-brisa", status: null, photoUrl: null, requirePhotoAlways: true },
      { id: "fot-6", name: "Retrovisores", status: null, photoUrl: null, requirePhotoAlways: true },
      { id: "fot-7", name: "Painel Aceso com KM", status: null, photoUrl: null, requirePhotoAlways: true },
      { id: "fot-8", name: "Volante", status: null, photoUrl: null, requirePhotoAlways: true },
      { id: "fot-9", name: "Bancos", status: null, photoUrl: null, requirePhotoAlways: true },
      { id: "fot-10", name: "Multimídia", status: null, photoUrl: null, requirePhotoAlways: true },
      { id: "fot-11", name: "Câmbio", status: null, photoUrl: null, requirePhotoAlways: true },
    ],
  },
  {
    category: "Lataria e Vidros",
    items: [
      { id: "lat-1", name: "Para-brisa", status: null, photoUrl: null },
      { id: "lat-2", name: "Vidro Traseiro", status: null, photoUrl: null },
      { id: "lat-3", name: "Vidro Porta Dianteira Esq.", status: null, photoUrl: null },
      { id: "lat-4", name: "Vidro Porta Dianteira Dir.", status: null, photoUrl: null },
      { id: "lat-5", name: "Pintura Capô", status: null, photoUrl: null },
      { id: "lat-6", name: "Pintura Teto", status: null, photoUrl: null },
      { id: "lat-7", name: "Pintura Porta Esquerda Dianteira", status: null, photoUrl: null },
      { id: "lat-8", name: "Pintura Porta Esquerda Traseira", status: null, photoUrl: null },
      { id: "lat-9", name: "Pintura Porta Direita Dianteira", status: null, photoUrl: null },
      { id: "lat-10", name: "Pintura Porta Direita Traseira", status: null, photoUrl: null },
      { id: "lat-11", name: "Para-choque Dianteiro", status: null, photoUrl: null },
      { id: "lat-12", name: "Para-choque Traseiro", status: null, photoUrl: null },
    ],
  },
  {
    category: "Interior",
    items: [
      { id: "int-1", name: "Bancos Dianteiros", status: null, photoUrl: null },
      { id: "int-2", name: "Bancos Traseiros", status: null, photoUrl: null },
      { id: "int-3", name: "Painel / Dashboard", status: null, photoUrl: null },
      { id: "int-4", name: "Ar-condicionado", status: null, photoUrl: null },
      { id: "int-5", name: "Som / Multimídia", status: null, photoUrl: null },
      { id: "int-6", name: "Teto / Revestimento Interno", status: null, photoUrl: null },
      { id: "int-7", name: "Tapetes", status: null, photoUrl: null },
      { id: "int-8", name: "Volante", status: null, photoUrl: null },
    ],
  },
  {
    category: "Mecânica",
    items: [
      { id: "mec-1", name: "Motor", status: null, photoUrl: null, requirePhotoAlways: true },
      { id: "mec-2", name: "Caixa de Câmbio", status: null, photoUrl: null },
      { id: "mec-3", name: "Sistema de Freios", status: null, photoUrl: null },
      { id: "mec-4", name: "Suspensão", status: null, photoUrl: null },
      { id: "mec-5", name: "Direção", status: null, photoUrl: null },
      { id: "mec-6", name: "Elétrica (Luzes)", status: null, photoUrl: null, requirePhotoAlways: true },
      { id: "mec-7", name: "Escapamento / Silencioso", status: null, photoUrl: null },
    ],
  },
  {
    category: "Pneus e Rodas",
    items: [
      { id: "pne-1", name: "Pneu Dianteiro Esquerdo", status: null, photoUrl: null },
      { id: "pne-2", name: "Pneu Dianteiro Direito", status: null, photoUrl: null },
      { id: "pne-3", name: "Pneu Traseiro Esquerdo", status: null, photoUrl: null },
      { id: "pne-4", name: "Pneu Traseiro Direito", status: null, photoUrl: null },
      { id: "pne-5", name: "Estepe", status: null, photoUrl: null },
      { id: "pne-6", name: "Rodas / Aros", status: null, photoUrl: null },
    ],
  },
];

type Step = "form" | "checklist" | "signature" | "done";

export default function InspectorPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("form");
  const [licensePlate, setLicensePlate] = useState("");
  const [km, setKm] = useState("");
  const [vehicleValue, setVehicleValue] = useState("");
  const [categories, setCategories] = useState<CategoryData[]>(INITIAL_CATEGORIES);
  const [signature, setSignature] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleItemChange = useCallback((id: string, updates: Partial<ItemData>) => {
    setCategories((prev) =>
      prev.map((cat) => ({
        ...cat,
        items: cat.items.map((item) =>
          item.id === id ? { ...item, ...updates } : item
        ),
      }))
    );
  }, []);

  const formatCurrency = (val: string) => {
    const num = val.replace(/\D/g, "");
    if (!num) return "";
    const value = (parseInt(num, 10) / 100).toFixed(2);
    return `R$ ${value.replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    setVehicleValue(raw);
  };

  const allItemsChecked = categories.every((cat) => cat.items.every((item) => item.status !== null));
  const missingPhotos = categories.flatMap((cat) =>
    cat.items.filter(
      (item) => (item.requirePhotoAlways || item.status === "ALERT" || item.status === "DEFECT") && !item.photoUrl
    )
  );
  
  const missingObservations = categories.flatMap((cat) =>
    cat.items.filter(
      (item) => item.status === "ALERT" && (!item.observation || item.observation.trim() === "")
    )
  );

  const canProceedToSignature = allItemsChecked && missingPhotos.length === 0 && missingObservations.length === 0;

  const handleSubmit = async () => {
    if (!signature) { setError("Por favor, assine o formulário."); return; }
    setIsSubmitting(true);
    setError(null);

    const allItems = categories.flatMap((cat) =>
      cat.items.map((item) => ({ ...item, category: cat.category }))
    );

    const result = await submitInspection({
      licensePlate,
      km: parseInt(km.replace(/\D/g, ""), 10),
      value: parseFloat(vehicleValue) / 100,
      signature,
      items: allItems,
    });

    setIsSubmitting(false);
    if (result.success) {
      setStep("done");
    } else {
      setError(result.error || "Erro desconhecido.");
    }
  };

  if (step === "done") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#09090b]">
        <div className="glass-card p-10 text-center max-w-sm w-full flex flex-col items-center gap-6 border border-emerald-800/30">
          <div className="w-20 h-20 bg-[var(--color-status-ok-muted)] rounded-full flex items-center justify-center animate-bounce">
            <CheckCircle size={44} className="text-[var(--color-status-ok)]" />
          </div>
          <h1 className="text-2xl font-bold text-white">Vistoria Enviada!</h1>
          <p className="text-zinc-400 text-sm">Sua vistoria foi enviada com sucesso e está aguardando aprovação do administrador.</p>
          <button
            onClick={() => { setStep("form"); setCategories(INITIAL_CATEGORIES); setLicensePlate(""); setKm(""); setVehicleValue(""); setSignature(null); }}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl font-semibold btn-interactive"
          >
            Nova Vistoria
          </button>
          <button
            onClick={() => router.push("/admin")}
            className="w-full text-zinc-400 hover:text-white text-sm transition-colors"
          >
            Ir para Painel Admin
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-panel px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <ClipboardCheck size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-none">GRF AUTO CAR</h1>
            <p className="text-xs text-zinc-400">Nova Vistoria</p>
          </div>
        </div>
        <a href="/admin" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Painel Admin →</a>
      </header>

      {/* Progress Steps */}
      <div className="px-4 py-4">
        <div className="flex gap-2">
          {(["form", "checklist", "signature"] as Step[]).map((s, i) => (
            <div key={s} className="flex-1 flex items-center gap-2">
              <div className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                step === "form" && i === 0 ? "bg-blue-500" :
                step === "checklist" && i <= 1 ? "bg-blue-500" :
                step === "signature" ? "bg-blue-500" :
                "bg-zinc-800"
              }`} />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1 text-xs text-zinc-500">
          <span>Dados</span>
          <span>Checklist</span>
          <span>Assinatura</span>
        </div>
      </div>

      <main className="px-4 mt-2">
        {step === "form" && (
          <div className="flex flex-col gap-6">
            <div className="text-center mb-2">
              <h2 className="text-2xl font-bold text-white">Dados do Veículo</h2>
              <p className="text-zinc-400 text-sm mt-1">Preencha as informações básicas</p>
            </div>

            <div className="glass-card p-5 flex flex-col gap-5">
              {/* License Plate */}
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                  <Car size={16} /> Placa do Veículo
                </label>
                <LicensePlateInput value={licensePlate} onChange={setLicensePlate} />
                <p className="text-xs text-zinc-500 text-center">Suporte a placas Mercosul e antigas</p>
              </div>

              {/* KM */}
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm font-medium text-zinc-300" htmlFor="km-input">
                  <Gauge size={16} /> KM Atual
                </label>
                <input
                  id="km-input"
                  type="number"
                  inputMode="numeric"
                  value={km}
                  onChange={(e) => setKm(e.target.value)}
                  placeholder="Ex: 45000"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-lg placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>

              {/* Vehicle Value */}
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm font-medium text-zinc-300" htmlFor="value-input">
                  <DollarSign size={16} /> Valor do Veículo
                </label>
                <input
                  id="value-input"
                  type="text"
                  inputMode="numeric"
                  value={vehicleValue ? formatCurrency(vehicleValue) : ""}
                  onChange={handleValueChange}
                  placeholder="R$ 0,00"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-lg placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>
            </div>

            <button
              disabled={!licensePlate || !km || !vehicleValue}
              onClick={() => setStep("checklist")}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-lg btn-interactive transition-colors"
            >
              Próximo: Checklist →
            </button>
          </div>
        )}

        {step === "checklist" && (
          <div className="flex flex-col gap-4">
            <div className="mb-2">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">Checklist de Vistoria</h2>
                  <p className="text-zinc-400 text-sm mt-1">Placa: <span className="font-mono text-zinc-200">{licensePlate}</span></p>
                </div>
                <button onClick={() => setStep("form")} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">← Voltar</button>
              </div>
              
              {missingPhotos.length > 0 && (
                <div className="mt-3 p-3 rounded-lg bg-[var(--color-status-alert-muted)] border border-[var(--color-status-alert)]/30">
                  <p className="text-xs text-[var(--color-status-alert)] font-medium">
                    ⚠ {missingPhotos.length} item(ns) com Alerta/Defeito precisam de foto obrigatória
                  </p>
                </div>
              )}
            </div>

            <Checklist categories={categories} onChange={handleItemChange} />

            <button
              disabled={!canProceedToSignature}
              onClick={() => setStep("signature")}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-lg btn-interactive transition-colors mt-2"
            >
              {!allItemsChecked
                ? `Preencha todos os itens (${categories.flatMap(c => c.items).filter(i => i.status === null).length} restante(s))`
                : missingPhotos.length > 0
                ? `Anexe ${missingPhotos.length} foto(s) obrigatória(s)`
                : missingObservations.length > 0
                ? `Preencha ${missingObservations.length} observação(ões) pendente(s)`
                : "Próximo: Assinatura →"}
            </button>
          </div>
        )}

        {step === "signature" && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-2xl font-bold text-white">Assinatura</h2>
                <p className="text-zinc-400 text-sm mt-1">Confirme sua vistoria assinando abaixo</p>
              </div>
              <button onClick={() => setStep("checklist")} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">← Voltar</button>
            </div>

            {/* Summary Card */}
            <div className="glass-card p-4">
              <h3 className="text-sm font-semibold text-zinc-300 mb-3">Resumo da Vistoria</h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                {categories.flatMap(c => c.items).filter(i => i.status === "OK").length > 0 && (
                  <div className="bg-[var(--color-status-ok-muted)] rounded-lg p-2 border border-[var(--color-status-ok)]/20">
                    <div className="text-2xl font-bold text-[var(--color-status-ok)]">{categories.flatMap(c => c.items).filter(i => i.status === "OK").length}</div>
                    <div className="text-xs text-zinc-400 mt-1">OK</div>
                  </div>
                )}
                {categories.flatMap(c => c.items).filter(i => i.status === "ALERT").length > 0 && (
                  <div className="bg-[var(--color-status-alert-muted)] rounded-lg p-2 border border-[var(--color-status-alert)]/20">
                    <div className="text-2xl font-bold text-[var(--color-status-alert)]">{categories.flatMap(c => c.items).filter(i => i.status === "ALERT").length}</div>
                    <div className="text-xs text-zinc-400 mt-1">Alerta</div>
                  </div>
                )}
                {categories.flatMap(c => c.items).filter(i => i.status === "DEFECT").length > 0 && (
                  <div className="bg-[var(--color-status-defect-muted)] rounded-lg p-2 border border-[var(--color-status-defect)]/20">
                    <div className="text-2xl font-bold text-[var(--color-status-defect)]">{categories.flatMap(c => c.items).filter(i => i.status === "DEFECT").length}</div>
                    <div className="text-xs text-zinc-400 mt-1">Defeito</div>
                  </div>
                )}
              </div>
            </div>

            <SignaturePad onChange={setSignature} />

            {error && (
              <p className="text-sm text-[var(--color-status-defect)] text-center">{error}</p>
            )}

            <button
              disabled={!signature || isSubmitting}
              onClick={handleSubmit}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-lg btn-interactive transition-colors flex items-center justify-center gap-3"
            >
              <Send size={20} />
              {isSubmitting ? "Enviando..." : "Enviar para Aprovação"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
