"use client";

import React, { useState, useCallback, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle,
  Car,
  Gauge,
  Fuel,
  Send,
  ClipboardCheck,
  ArrowDownCircle,
  ArrowUpCircle,
  Search,
  User,
  FileText,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { LicensePlateInput } from "@/components/LicensePlateInput";
import { Checklist, CategoryData, ItemData } from "@/components/Checklist";
import { SignaturePad } from "@/components/SignaturePad";
import {
  RequiredPhotos,
  REQUIRED_PHOTO_ANGLES,
  RequiredPhotoAngle,
  ExtraPhotoItem,
} from "@/components/RequiredPhotos";
import { DamageMap, DamageItem, DAMAGE_TYPE_LABELS } from "@/components/DamageMap";
import { createInitialChecklistState } from "@/config/checklist";
import {
  lookupVehicleByPlate,
  submitMovementInspection,
  addItemPhoto,
  addMovementPhoto,
  addDamagePhoto,
} from "@/app/actions";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Tempo esgotado")), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

type MovementTypeOption = "ENTRY" | "EXIT";
type MovementReasonOption =
  | "PURCHASE"
  | "CONSIGNMENT"
  | "TRADE_IN"
  | "SALE"
  | "RETURN"
  | "WORKSHOP"
  | "OTHER";

const ENTRY_REASONS: { value: MovementReasonOption; label: string }[] = [
  { value: "PURCHASE", label: "Compra" },
  { value: "CONSIGNMENT", label: "Consignação" },
  { value: "TRADE_IN", label: "Troca" },
  { value: "WORKSHOP", label: "Retorno de Oficina" },
  { value: "OTHER", label: "Outro" },
];

const EXIT_REASONS: { value: MovementReasonOption; label: string }[] = [
  { value: "SALE", label: "Venda" },
  { value: "RETURN", label: "Devolução" },
  { value: "WORKSHOP", label: "Envio para Oficina" },
  { value: "OTHER", label: "Outro" },
];

type Step = "plate" | "identification" | "photos" | "damages" | "checklist" | "signature" | "done";

const STEP_ORDER: { key: Step; label: string }[] = [
  { key: "plate", label: "Placa" },
  { key: "identification", label: "Dados" },
  { key: "photos", label: "Fotos" },
  { key: "damages", label: "Avarias" },
  { key: "checklist", label: "Checklist" },
  { key: "signature", label: "Assinatura" },
];

const DRAFT_STORAGE_KEY = "grf_movement_draft_v1";

interface LastEntrySummary {
  id: string;
  createdAt: string;
  km: number;
  fuelLevel: number;
  reason: string;
  personName: string;
  inspectorName: string;
  damages: DamageItem[];
}

function InspectorFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialType = searchParams.get("type") === "EXIT" ? "EXIT" : "ENTRY";

  const [movementType, setMovementType] = useState<MovementTypeOption>(initialType);
  const [reason, setReason] = useState<MovementReasonOption>(
    initialType === "EXIT" ? "SALE" : "PURCHASE"
  );
  const [step, setStep] = useState<Step>("plate");

  // Plate & Lookup State
  const [licensePlate, setLicensePlate] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [vehicleExists, setVehicleExists] = useState<boolean | null>(null);
  const [lastEntry, setLastEntry] = useState<LastEntrySummary | null>(null);

  // Vehicle & Identification Fields
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [color, setColor] = useState("");
  const [chassis, setChassis] = useState("");
  const [renavam, setRenavam] = useState("");
  const [km, setKm] = useState("");
  const [fuelLevel, setFuelLevel] = useState<number>(50);
  const [vehicleValue, setVehicleValue] = useState("");

  // Photos, Damages, Checklist
  const [photosByAngle, setPhotosByAngle] = useState<
    Partial<Record<RequiredPhotoAngle, string>>
  >({});
  const [extraPhotos, setExtraPhotos] = useState<ExtraPhotoItem[]>([]);
  const [damages, setDamages] = useState<DamageItem[]>([]);
  const [categories, setCategories] = useState<CategoryData[]>(() =>
    createInitialChecklistState()
  );

  // Person & Signature
  const [personName, setPersonName] = useState("");
  const [personDoc, setPersonDoc] = useState("");
  const [notes, setNotes] = useState("");
  const [signature, setSignature] = useState<string | null>(null);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [submittedResult, setSubmittedResult] = useState<{
    inspectionId: string;
    movementId: string;
  } | null>(null);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  const pendingRef = useRef<{
    inspectionId: string;
    movementId: string;
    itemIdMap: Record<string, string>;
    damageIdMap: Record<string, string>;
    uploadedKeys: Set<string>;
  } | null>(null);

  // Sync URL ?type= query param when movement hasn't started yet
  useEffect(() => {
    const qType = searchParams.get("type");
    if (qType === "ENTRY" || qType === "EXIT") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMovementType(qType);
      setReason(qType === "EXIT" ? "SALE" : "PURCHASE");
    }
  }, [searchParams]);

  // Load saved draft on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft && draft.licensePlate) {
        if (!searchParams.get("type") && draft.movementType) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setMovementType(draft.movementType);
        }
        if (draft.reason) setReason(draft.reason);
        if (draft.step && draft.step !== "done") setStep(draft.step);
        setLicensePlate(draft.licensePlate || "");
        setVehicleExists(draft.vehicleExists ?? null);
        setLastEntry(draft.lastEntry ?? null);
        setMake(draft.make || "");
        setModel(draft.model || "");
        setYear(draft.year || "");
        setColor(draft.color || "");
        setChassis(draft.chassis || "");
        setRenavam(draft.renavam || "");
        setKm(draft.km || "");
        if (typeof draft.fuelLevel === "number") setFuelLevel(draft.fuelLevel);
        setVehicleValue(draft.vehicleValue || "");
        if (draft.photosByAngle) setPhotosByAngle(draft.photosByAngle);
        if (Array.isArray(draft.extraPhotos)) setExtraPhotos(draft.extraPhotos);
        if (Array.isArray(draft.damages)) setDamages(draft.damages);
        if (Array.isArray(draft.categories) && draft.categories.length > 0) {
          setCategories(draft.categories);
        }
        setPersonName(draft.personName || "");
        setPersonDoc(draft.personDoc || "");
        setNotes(draft.notes || "");
        setHasRestoredDraft(true);
      }
    } catch (err) {
      console.warn("Could not restore draft from localStorage:", err);
    }
  }, [searchParams]);

  // Save draft automatically on changes
  useEffect(() => {
    if (step === "done" || !licensePlate) return;
    try {
      const payload = {
        movementType,
        reason,
        step,
        licensePlate,
        vehicleExists,
        lastEntry,
        make,
        model,
        year,
        color,
        chassis,
        renavam,
        km,
        fuelLevel,
        vehicleValue,
        photosByAngle,
        extraPhotos,
        damages,
        categories,
        personName,
        personDoc,
        notes,
        updatedAt: Date.now(),
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // If quota exceeded due to many base64 photos, save without photos so text fields are never lost
      try {
        const lightweightPayload = {
          movementType,
          reason,
          step,
          licensePlate,
          vehicleExists,
          lastEntry,
          make,
          model,
          year,
          color,
          chassis,
          renavam,
          km,
          fuelLevel,
          vehicleValue,
          damages: damages.map((d) => ({ ...d, photoUrl: null })),
          categories: categories.map((c) => ({
            ...c,
            items: c.items.map((i) => ({ ...i, photoUrl: null })),
          })),
          personName,
          personDoc,
          notes,
          updatedAt: Date.now(),
        };
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(lightweightPayload));
      } catch {
        // ignore
      }
    }
  }, [
    movementType,
    reason,
    step,
    licensePlate,
    vehicleExists,
    lastEntry,
    make,
    model,
    year,
    color,
    chassis,
    renavam,
    km,
    fuelLevel,
    vehicleValue,
    photosByAngle,
    extraPhotos,
    damages,
    categories,
    personName,
    personDoc,
    notes,
  ]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }
    setHasRestoredDraft(false);
  };

  const resetForm = () => {
    clearDraft();
    setStep("plate");
    setLicensePlate("");
    setVehicleExists(null);
    setLastEntry(null);
    setMake("");
    setModel("");
    setYear("");
    setColor("");
    setChassis("");
    setRenavam("");
    setKm("");
    setFuelLevel(50);
    setVehicleValue("");
    setPhotosByAngle({});
    setExtraPhotos([]);
    setDamages([]);
    setCategories(createInitialChecklistState());
    setPersonName("");
    setPersonDoc("");
    setNotes("");
    setSignature(null);
    setSubmittedResult(null);
    setError(null);
    pendingRef.current = null;
  };

  const handleSwitchType = (type: MovementTypeOption) => {
    setMovementType(type);
    setReason(type === "EXIT" ? "SALE" : "PURCHASE");
  };

  const handleLookupPlate = async () => {
    setError(null);
    setLookingUp(true);
    try {
      const res = await lookupVehicleByPlate(licensePlate);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setLicensePlate(res.licensePlate);
      setVehicleExists(res.exists);
      if (res.vehicle) {
        setMake(res.vehicle.make || "");
        setModel(res.vehicle.model || "");
        setYear(res.vehicle.year ? String(res.vehicle.year) : "");
        setColor(res.vehicle.color || "");
        setChassis(res.vehicle.chassis || "");
        setRenavam(res.vehicle.renavam || "");
      }
      if (res.lastEntry) {
        setLastEntry(res.lastEntry);
        // On EXIT, pre-populate existing entry damages so inspector can see/keep or add new ones
        if (movementType === "EXIT" && damages.length === 0 && res.lastEntry.damages.length > 0) {
          setDamages(res.lastEntry.damages);
        }
      } else {
        setLastEntry(null);
      }
      setStep("identification");
    } catch {
      setError("Erro ao consultar a placa. Verifique sua conexão.");
    } finally {
      setLookingUp(false);
    }
  };

  const handlePhotoChange = useCallback(
    (angle: RequiredPhotoAngle, dataUrl: string | null) => {
      setPhotosByAngle((prev) => {
        const next = { ...prev };
        if (dataUrl) next[angle] = dataUrl;
        else delete next[angle];
        return next;
      });
    },
    []
  );

  const handleAddExtraPhoto = useCallback((dataUrl: string) => {
    setExtraPhotos((prev) => [
      ...prev,
      { id: `extra-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, url: dataUrl },
    ]);
  }, []);

  const handleRemoveExtraPhoto = useCallback((id: string) => {
    setExtraPhotos((prev) => prev.filter((p) => p.id !== id));
  }, []);

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

  // Validations per step
  const isPlateValid = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(licensePlate);
  const canLeaveIdentification = Boolean(km && parseInt(km, 10) >= 0);
  const requiredPhotosCompletedCount = REQUIRED_PHOTO_ANGLES.filter((a) =>
    Boolean(photosByAngle[a.angle])
  ).length;
  const allRequiredPhotosDone = requiredPhotosCompletedCount === REQUIRED_PHOTO_ANGLES.length;
  const allChecklistItemsChecked = categories.every((cat) =>
    cat.items.every((item) => item.status !== null)
  );

  const handleSubmit = async () => {
    if (!personName.trim()) {
      setError("Informe o nome de quem trouxe ou retirou o veículo.");
      return;
    }
    if (!signature) {
      setError("Por favor, colete a assinatura para finalizar.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const allItems = categories.flatMap((cat) =>
        cat.items
          .filter((item) => item.status !== null)
          .map((item) => ({
            id: item.id,
            category: cat.category,
            name: item.name,
            status: item.status as "OK" | "ALERT" | "DEFECT",
            observation: item.observation ?? null,
            photoUrl: item.photoUrl,
          }))
      );

      // 1) Create Movement + Inspection + Items + Damages
      if (!pendingRef.current) {
        setProgress("Salvando movimentação e vistoria...");
        const result = await withTimeout(
          submitMovementInspection({
            type: movementType,
            reason,
            licensePlate,
            vehicleData: {
              make: make.trim() || null,
              model: model.trim() || null,
              year: year ? parseInt(year, 10) : null,
              color: color.trim() || null,
              chassis: chassis.trim() || null,
              renavam: renavam.trim() || null,
            },
            km: parseInt(km.replace(/\D/g, ""), 10) || 0,
            fuelLevel,
            value: vehicleValue ? parseFloat(vehicleValue) / 100 : 0,
            personName: personName.trim(),
            personDoc: personDoc.trim() || null,
            notes: notes.trim() || null,
            signature,
            items: allItems.map(({ id, category, name, status, observation }) => ({
              id,
              category,
              name,
              status,
              observation,
            })),
            damages: damages.map((d) => ({
              clientId: d.id,
              area: d.area,
              x: d.x,
              y: d.y,
              type: d.type,
              notes: d.notes || null,
            })),
          }),
          30000
        );

        if (!result.success) {
          setError(result.error || "Erro ao registrar movimentação.");
          return;
        }

        pendingRef.current = {
          inspectionId: result.id,
          movementId: result.movementId,
          itemIdMap: result.itemIdMap,
          damageIdMap: result.damageIdMap,
          uploadedKeys: new Set(),
        };
      }

      const pending = pendingRef.current;

      // 2) Upload 10 required angle photos + extra photos
      const angleEntries = REQUIRED_PHOTO_ANGLES.filter((a) => photosByAngle[a.angle]);
      const totalPhotosToUpload =
        angleEntries.length +
        extraPhotos.length +
        damages.filter((d) => d.photoUrl).length +
        allItems.filter((i) => i.photoUrl).length;

      let uploadedCount = 0;

      for (const angleDef of angleEntries) {
        const key = `angle-${angleDef.angle}`;
        const url = photosByAngle[angleDef.angle]!;
        if (pending.uploadedKeys.has(key)) {
          uploadedCount++;
          continue;
        }
        uploadedCount++;
        setProgress(`Enviando fotos (${uploadedCount}/${totalPhotosToUpload})...`);
        const r = await withTimeout(
          addMovementPhoto(pending.movementId, angleDef.angle, url),
          30000
        );
        if (!r.success) {
          setError(`Falha ao enviar foto "${angleDef.label}". Toque em Enviar novamente.`);
          return;
        }
        pending.uploadedKeys.add(key);
      }

      // 3) Upload Extra photos
      for (const extra of extraPhotos) {
        const key = `extra-${extra.id}`;
        if (pending.uploadedKeys.has(key)) {
          uploadedCount++;
          continue;
        }
        uploadedCount++;
        setProgress(`Enviando fotos (${uploadedCount}/${totalPhotosToUpload})...`);
        const r = await withTimeout(
          addMovementPhoto(pending.movementId, "EXTRA", extra.url),
          30000
        );
        if (!r.success) {
          setError("Falha ao enviar foto extra. Toque em Enviar novamente.");
          return;
        }
        pending.uploadedKeys.add(key);
      }

      // 4) Upload Damage photos
      for (const dmg of damages) {
        if (!dmg.photoUrl) continue;
        const dbDamageId = pending.damageIdMap[dmg.id];
        if (!dbDamageId) continue;
        const key = `dmg-${dmg.id}`;
        if (pending.uploadedKeys.has(key)) {
          uploadedCount++;
          continue;
        }
        uploadedCount++;
        setProgress(`Enviando fotos (${uploadedCount}/${totalPhotosToUpload})...`);
        const r = await withTimeout(
          addDamagePhoto(pending.movementId, dbDamageId, dmg.photoUrl),
          30000
        );
        if (!r.success) {
          setError(`Falha ao enviar foto da avaria em "${dmg.area}". Toque em Enviar novamente.`);
          return;
        }
        pending.uploadedKeys.add(key);
      }

      // 5) Upload Checklist Item photos
      for (const item of allItems) {
        if (!item.photoUrl) continue;
        const dbItemId = pending.itemIdMap[item.id];
        if (!dbItemId) continue;
        const key = `item-${item.id}`;
        if (pending.uploadedKeys.has(key)) {
          uploadedCount++;
          continue;
        }
        uploadedCount++;
        setProgress(`Enviando fotos (${uploadedCount}/${totalPhotosToUpload})...`);
        const r = await withTimeout(addItemPhoto(dbItemId, item.photoUrl), 30000);
        if (!r.success) {
          setError(`Falha ao enviar foto do item "${item.name}". Toque em Enviar novamente.`);
          return;
        }
        pending.uploadedKeys.add(key);
      }

      clearDraft();
      setSubmittedResult({
        inspectionId: pending.inspectionId,
        movementId: pending.movementId,
      });
      pendingRef.current = null;
      setStep("done");
    } catch (e) {
      console.error(e);
      setError("Erro de conexão ou tempo esgotado. Seus dados estão salvos, tente novamente.");
    } finally {
      setIsSubmitting(false);
      setProgress(null);
    }
  };

  if (step === "done" && submittedResult) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#09090b]">
        <div className="glass-card p-8 text-center max-w-md w-full flex flex-col items-center gap-5 border border-emerald-800/30">
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center">
            <CheckCircle size={44} className="text-emerald-400" />
          </div>
          <div>
            <span
              className={`inline-block text-xs font-bold px-3 py-1 rounded-full mb-2 ${
                movementType === "ENTRY"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-amber-500/20 text-amber-400"
              }`}
            >
              {movementType === "ENTRY" ? "ENTRADA REGISTRADA" : "SAÍDA REGISTRADA"}
            </span>
            <h1 className="text-2xl font-bold text-white">Vistoria Concluída!</h1>
            <p className="text-zinc-400 text-sm mt-1">
              Placa <strong className="text-white font-mono">{licensePlate}</strong> registrada com sucesso.
            </p>
          </div>

          <div className="flex flex-col gap-3 w-full">
            <Link
              href={`/admin/inspection/${submittedResult.inspectionId}`}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-xl font-bold transition-colors text-sm"
            >
              Ver Laudo Completo / Baixar PDF →
            </Link>

            {movementType === "EXIT" && (
              <Link
                href={`/admin/movements/${submittedResult.movementId}/compare`}
                className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-white py-3.5 rounded-xl font-bold transition-colors text-sm"
              >
                Comparar Entrada x Saída →
              </Link>
            )}

            <button
              onClick={resetForm}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3.5 rounded-xl font-semibold btn-interactive text-sm"
            >
              Registrar Outra Movimentação
            </button>

            <button
              onClick={() => router.push("/admin")}
              className="w-full text-zinc-400 hover:text-white text-sm py-2 transition-colors"
            >
              Ir para Painel Admin
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentStepIndex = STEP_ORDER.findIndex((s) => s.key === step);
  const availableReasons = movementType === "ENTRY" ? ENTRY_REASONS : EXIT_REASONS;

  return (
    <div className="min-h-screen bg-[#09090b] pb-28">
      {/* Header */}
      <header className="sticky top-0 z-40 glass-panel px-4 py-3.5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              movementType === "ENTRY" ? "bg-emerald-600" : "bg-amber-600"
            }`}
          >
            <ClipboardCheck size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-none">GRF AUTO CAR</h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              {movementType === "ENTRY" ? "Entrada de Veículo" : "Saída de Veículo"}
              {licensePlate ? ` · ${licensePlate}` : ""}
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          {hasRestoredDraft && (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1.5 rounded-lg"
              title="Limpar rascunho salvo"
            >
              <RotateCcw size={13} /> Limpar Rascunho
            </button>
          )}
          <Link href="/admin" className="text-xs text-zinc-400 hover:text-white transition-colors">
            Admin →
          </Link>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="px-4 py-3 max-w-3xl mx-auto">
        <div className="grid grid-cols-6 gap-1.5">
          {STEP_ORDER.map((s, idx) => (
            <button
              key={s.key}
              type="button"
              disabled={idx > currentStepIndex}
              onClick={() => idx < currentStepIndex && setStep(s.key)}
              className="flex flex-col gap-1 text-left disabled:cursor-default"
            >
              <div
                className={`h-1.5 w-full rounded-full transition-all ${
                  idx <= currentStepIndex
                    ? movementType === "ENTRY"
                      ? "bg-emerald-500"
                      : "bg-amber-500"
                    : "bg-zinc-800"
                }`}
              />
              <span
                className={`text-[10px] font-medium truncate ${
                  idx === currentStepIndex ? "text-white font-bold" : "text-zinc-500"
                }`}
              >
                {s.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <main className="px-4 mt-2 max-w-3xl mx-auto">
        {/* STEP 1: PLATE & TYPE */}
        {step === "plate" && (
          <div className="flex flex-col gap-5">
            {/* Movement Type Toggle */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleSwitchType("ENTRY")}
                className={`py-4 px-4 rounded-2xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 border-2 transition-all ${
                  movementType === "ENTRY"
                    ? "bg-emerald-600/20 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-600/10"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400"
                }`}
              >
                <ArrowDownCircle size={20} />
                Registrar ENTRADA
              </button>
              <button
                type="button"
                onClick={() => handleSwitchType("EXIT")}
                className={`py-4 px-4 rounded-2xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 border-2 transition-all ${
                  movementType === "EXIT"
                    ? "bg-amber-600/20 border-amber-500 text-amber-400 shadow-lg shadow-amber-600/10"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400"
                }`}
              >
                <ArrowUpCircle size={20} />
                Registrar SAÍDA
              </button>
            </div>

            <div className="glass-card p-6 flex flex-col gap-5">
              <div className="text-center">
                <h2 className="text-xl font-bold text-white">Digite a Placa do Veículo</h2>
                <p className="text-xs text-zinc-400 mt-1">
                  O sistema buscará o histórico e dados cadastrados automaticamente
                </p>
              </div>

              <LicensePlateInput value={licensePlate} onChange={setLicensePlate} />

              {/* Reason Selection */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-zinc-300">
                  Motivo da {movementType === "ENTRY" ? "Entrada" : "Saída"}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {availableReasons.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setReason(r.value)}
                      className={`py-3 px-3 rounded-xl text-xs font-bold border transition-colors ${
                        reason === r.value
                          ? "bg-blue-600 border-blue-500 text-white"
                          : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-400 text-center bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                  {error}
                </p>
              )}

              <button
                type="button"
                disabled={!isPlateValid || lookingUp}
                onClick={handleLookupPlate}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 btn-interactive"
              >
                <Search size={18} />
                {lookingUp ? "Consultando placa..." : "Continuar →"}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: IDENTIFICATION */}
        {step === "identification" && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Identificação e Hodômetro</h2>
                <p className="text-xs text-zinc-400">
                  Placa: <strong className="text-white font-mono">{licensePlate}</strong>{" "}
                  {vehicleExists ? "(Veículo já cadastrado)" : "(Novo veículo)"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep("plate")}
                className="text-xs text-zinc-400 hover:text-white"
              >
                ← Trocar Placa
              </button>
            </div>

            {/* Last Entry Summary Banner when registering EXIT */}
            {movementType === "EXIT" && (
              <div
                className={`glass-card p-4 border ${
                  lastEntry
                    ? "border-amber-500/40 bg-amber-500/10"
                    : "border-red-500/40 bg-red-500/10"
                }`}
              >
                {lastEntry ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                        Resumo da Última Entrada
                      </span>
                      <span className="text-xs text-zinc-300">
                        {new Date(lastEntry.createdAt).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center bg-zinc-950/60 p-2.5 rounded-xl">
                      <div>
                        <span className="text-[11px] text-zinc-400 block">KM na Entrada</span>
                        <strong className="text-sm text-white">
                          {lastEntry.km.toLocaleString("pt-BR")} km
                        </strong>
                      </div>
                      <div>
                        <span className="text-[11px] text-zinc-400 block">Combustível</span>
                        <strong className="text-sm text-white">{lastEntry.fuelLevel}%</strong>
                      </div>
                      <div>
                        <span className="text-[11px] text-zinc-400 block">Avarias Ant.</span>
                        <strong className="text-sm text-white">
                          {lastEntry.damages.length}
                        </strong>
                      </div>
                    </div>
                    {lastEntry.damages.length > 0 && (
                      <p className="text-xs text-zinc-300">
                        Avarias da entrada:{" "}
                        {lastEntry.damages
                          .map((d) => `${d.area} (${DAMAGE_TYPE_LABELS[d.type]})`)
                          .join(", ")}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-red-300 text-xs">
                    <AlertTriangle size={20} className="flex-shrink-0" />
                    <span>
                      Atenção: Nenhuma ENTRADA anterior foi encontrada para a placa{" "}
                      <strong>{licensePlate}</strong>. Você ainda pode registrar a saída normalmente.
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="glass-card p-5 flex flex-col gap-4">
              <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                <Car size={16} className="text-blue-400" /> Dados do Veículo
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Marca</label>
                  <input
                    type="text"
                    placeholder="Ex: Volkswagen"
                    value={make}
                    onChange={(e) => setMake(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-3 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Modelo</label>
                  <input
                    type="text"
                    placeholder="Ex: Gol 1.6 MSI"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-3 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Ano</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="Ex: 2022"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-3 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Cor</label>
                  <input
                    type="text"
                    placeholder="Ex: Prata"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-3 text-sm text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Chassi (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Últimos 8 ou chassi completo"
                    value={chassis}
                    onChange={(e) => setChassis(e.target.value.toUpperCase())}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-3 text-sm text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Renavam (Opcional)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Código Renavam"
                    value={renavam}
                    onChange={(e) => setRenavam(e.target.value.replace(/\D/g, ""))}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-3 text-sm text-white font-mono"
                  />
                </div>
              </div>
            </div>

            {/* KM & Fuel */}
            <div className="glass-card p-5 flex flex-col gap-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-2 text-xs font-semibold text-zinc-300 mb-1.5">
                    <Gauge size={16} className="text-blue-400" /> Quilometragem (KM Atual) *
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={km}
                    onChange={(e) => setKm(e.target.value)}
                    placeholder="Ex: 45000"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-lg font-bold"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-xs font-semibold text-zinc-300 mb-1.5">
                    Valor de Referência (Opcional)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={vehicleValue ? formatCurrency(vehicleValue) : ""}
                    onChange={(e) => setVehicleValue(e.target.value.replace(/\D/g, ""))}
                    placeholder="R$ 0,00"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-lg"
                  />
                </div>
              </div>

              {/* Fuel Level Selector */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                    <Fuel size={16} className="text-blue-400" /> Nível de Combustível
                  </label>
                  <span className="text-sm font-bold text-blue-400">{fuelLevel}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={fuelLevel}
                  onChange={(e) => setFuelLevel(Number(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
                <div className="grid grid-cols-5 gap-2 mt-1">
                  {[
                    { label: "Reserva", val: 10 },
                    { label: "1/4", val: 25 },
                    { label: "1/2", val: 50 },
                    { label: "3/4", val: 75 },
                    { label: "Cheio", val: 100 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setFuelLevel(preset.val)}
                      className={`py-2 rounded-lg text-xs font-semibold border transition-colors ${
                        fuelLevel === preset.val
                          ? "bg-blue-600 border-blue-500 text-white"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={!canLeaveIdentification}
              onClick={() => setStep("photos")}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white py-4 rounded-xl font-bold text-base btn-interactive"
            >
              Próximo: Fotos Obrigatórias (10) →
            </button>
          </div>
        )}

        {/* STEP 3: REQUIRED PHOTOS */}
        {step === "photos" && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Fotos Obrigatórias</h2>
                <p className="text-xs text-zinc-400">
                  Capture os 10 ângulos obrigatórios para liberar a próxima etapa
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep("identification")}
                className="text-xs text-zinc-400 hover:text-white"
              >
                ← Voltar
              </button>
            </div>

            <RequiredPhotos
              photosByAngle={photosByAngle}
              onPhotoChange={handlePhotoChange}
              extraPhotos={extraPhotos}
              onAddExtraPhoto={handleAddExtraPhoto}
              onRemoveExtraPhoto={handleRemoveExtraPhoto}
            />

            <button
              type="button"
              disabled={!allRequiredPhotosDone}
              onClick={() => setStep("damages")}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white py-4 rounded-xl font-bold text-base btn-interactive"
            >
              {allRequiredPhotosDone
                ? "Próximo: Mapa de Avarias →"
                : `Capture todas as 10 fotos obrigatórias (${requiredPhotosCompletedCount}/10)`}
            </button>
          </div>
        )}

        {/* STEP 4: DAMAGE MAP */}
        {step === "damages" && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Mapa de Avarias</h2>
                <p className="text-xs text-zinc-400">
                  Toque na silhueta do veículo para marcar riscos, amassados ou peças faltantes
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep("photos")}
                className="text-xs text-zinc-400 hover:text-white"
              >
                ← Voltar
              </button>
            </div>

            <DamageMap damages={damages} onChange={setDamages} />

            <button
              type="button"
              onClick={() => setStep("checklist")}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold text-base btn-interactive"
            >
              Próximo: Checklist Rápido →
            </button>
          </div>
        )}

        {/* STEP 5: CHECKLIST */}
        {step === "checklist" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Checklist Rápido</h2>
                <p className="text-xs text-zinc-400">
                  Acessórios, condição geral e documentos
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep("damages")}
                className="text-xs text-zinc-400 hover:text-white"
              >
                ← Voltar
              </button>
            </div>

            <Checklist categories={categories} onChange={handleItemChange} />

            <button
              type="button"
              disabled={!allChecklistItemsChecked}
              onClick={() => setStep("signature")}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white py-4 rounded-xl font-bold text-base btn-interactive"
            >
              {allChecklistItemsChecked
                ? "Próximo: Responsável e Assinatura →"
                : `Avalie todos os itens (${
                    categories.flatMap((c) => c.items).filter((i) => i.status === null).length
                  } pendente(s))`}
            </button>
          </div>
        )}

        {/* STEP 6: RESPONSIBLE & SIGNATURE */}
        {step === "signature" && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Finalização e Assinatura</h2>
                <p className="text-xs text-zinc-400">
                  Identifique quem {movementType === "ENTRY" ? "entregou" : "retirou"} o veículo e assine
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep("checklist")}
                className="text-xs text-zinc-400 hover:text-white"
              >
                ← Voltar
              </button>
            </div>

            <div className="glass-card p-5 flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300 mb-1.5">
                    <User size={15} className="text-blue-400" />
                    Nome de quem {movementType === "ENTRY" ? "trouxe" : "retirou"} *
                  </label>
                  <input
                    type="text"
                    placeholder="Nome completo"
                    value={personName}
                    onChange={(e) => setPersonName(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-3 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300 mb-1.5">
                    <FileText size={15} className="text-blue-400" />
                    CPF / RG (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="000.000.000-00"
                    value={personDoc}
                    onChange={(e) => setPersonDoc(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-3 text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 mb-1.5 block">
                  Observações Gerais da Movimentação (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Anotações adicionais sobre acordos, pendências, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
                />
              </div>
            </div>

            {/* Quick Summary */}
            <div className="glass-card p-4 grid grid-cols-4 gap-2 text-center">
              <div className="bg-zinc-900/80 rounded-lg p-2">
                <span className="text-[11px] text-zinc-400 block">Fotos</span>
                <strong className="text-base text-white">
                  {requiredPhotosCompletedCount + extraPhotos.length}
                </strong>
              </div>
              <div className="bg-zinc-900/80 rounded-lg p-2">
                <span className="text-[11px] text-zinc-400 block">Avarias</span>
                <strong className="text-base text-amber-400">{damages.length}</strong>
              </div>
              <div className="bg-zinc-900/80 rounded-lg p-2">
                <span className="text-[11px] text-zinc-400 block">KM</span>
                <strong className="text-sm text-white">
                  {Number(km || 0).toLocaleString("pt-BR")}
                </strong>
              </div>
              <div className="bg-zinc-900/80 rounded-lg p-2">
                <span className="text-[11px] text-zinc-400 block">Combustível</span>
                <strong className="text-base text-blue-400">{fuelLevel}%</strong>
              </div>
            </div>

            <SignaturePad onChange={setSignature} />

            {error && (
              <p className="text-sm text-red-400 text-center bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                {error}
              </p>
            )}

            <button
              type="button"
              disabled={!signature || !personName.trim() || isSubmitting}
              onClick={handleSubmit}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white py-4 rounded-xl font-bold text-lg btn-interactive flex items-center justify-center gap-3"
            >
              <Send size={20} />
              {isSubmitting
                ? progress ?? "Enviando..."
                : `Finalizar ${movementType === "ENTRY" ? "ENTRADA" : "SAÍDA"}`}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default function InspectorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-zinc-400">
          Carregando módulo de vistoria...
        </div>
      }
    >
      <InspectorFlow />
    </Suspense>
  );
}
