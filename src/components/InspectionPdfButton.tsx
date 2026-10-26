"use client";

import React, { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { PHOTO_ANGLE_LABELS } from "@/components/RequiredPhotos";
import { DAMAGE_TYPE_LABELS, DamageTypeKey } from "@/components/DamageMap";

interface Photo {
  url: string;
  angle?: string;
}

interface DamageRecord {
  id: string;
  area: string;
  x: number;
  y: number;
  type: string;
  notes?: string | null;
  photo?: { url: string } | null;
}

interface MovementRecord {
  id: string;
  type: string;
  reason: string;
  km: number;
  fuelLevel: number;
  personName: string;
  personDoc?: string | null;
  notes?: string | null;
  photos?: Photo[];
  damages?: DamageRecord[];
}

interface InspectionItem {
  id: string;
  name: string;
  category: string;
  status: string;
  observation: string | null;
  photos: Photo[];
}

interface Vehicle {
  licensePlate: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  color?: string | null;
  chassis?: string | null;
  renavam?: string | null;
}

interface Inspector {
  name: string;
}

interface PreviousEntrySummary {
  id: string;
  createdAt: Date;
  km: number;
  fuelLevel: number;
  damagesCount: number;
}

interface InspectionData {
  id: string;
  createdAt: Date;
  km: number;
  value: number;
  status: string;
  signature: string | null;
  rejectionReason?: string | null;
  vehicle: Vehicle;
  inspector: Inspector;
  movement?: MovementRecord | null;
  previousEntry?: PreviousEntrySummary | null;
  items: InspectionItem[];
}

interface Props {
  inspection: InspectionData;
  label?: string;
}

const STATUS_LABEL: Record<string, string> = {
  OK: "OK",
  ALERT: "Atenção",
  DEFECT: "Defeito",
  PENDING: "Pendente",
  APPROVED: "Aprovada",
  REJECTED: "Rejeitada",
};

const REASON_LABELS: Record<string, string> = {
  PURCHASE: "Compra",
  CONSIGNMENT: "Consignação",
  TRADE_IN: "Troca",
  SALE: "Venda",
  RETURN: "Devolução",
  WORKSHOP: "Oficina",
  OTHER: "Outro",
};

const STATUS_COLOR: Record<string, string> = {
  OK: "#16a34a",
  ALERT: "#d97706",
  DEFECT: "#dc2626",
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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

export function InspectionPdfButton({ inspection, label = "Baixar PDF" }: Props) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const QRCode = await import("qrcode");

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = 210;
      const pageH = 297;
      const margin = 14;
      const contentW = pageW - margin * 2;
      let y = margin;

      const addPageIfNeeded = (needed: number) => {
        if (y + needed > pageH - margin - 10) {
          doc.addPage();
          y = margin;
        }
      };

      const mov = inspection.movement;
      const movTitle = mov
        ? `LAUDO DE ${mov.type === "ENTRY" ? "ENTRADA" : "SAÍDA"} (${
            REASON_LABELS[mov.reason] ?? mov.reason
          })`
        : "LAUDO DE VISTORIA AUTOMOTIVA";

      // ── Header ──────────────────────────────────────────────────────────
      doc.setFillColor(mov?.type === "EXIT" ? 217 : 16, mov?.type === "EXIT" ? 119 : 185, mov?.type === "EXIT" ? 6 : 129);
      doc.rect(0, 0, pageW, 30, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(17);
      doc.setFont("helvetica", "bold");
      doc.text("GRF AUTO CAR", margin, 11);
      doc.setFontSize(10);
      doc.text(movTitle, margin, 18);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(
        `ID Movimentação: ${mov?.id ?? inspection.id}`,
        margin,
        24
      );
      doc.text(`Data/Hora: ${formatDate(inspection.createdAt)}`, pageW - margin - 26, 12, {
        align: "right",
      });

      // QR Code pointing to inspection page
      const verifyUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/admin/inspection/${inspection.id}`
          : `https://grfautocar.local/admin/inspection/${inspection.id}`;
      try {
        const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
          margin: 1,
          width: 120,
        });
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(pageW - margin - 22, 4, 22, 22, 1.5, 1.5, "F");
        doc.addImage(qrDataUrl, "PNG", pageW - margin - 21, 5, 20, 20);
      } catch {
        // fallback if QR fails
      }

      y = 36;

      // ── Vehicle & Movement Info ──────────────────────────────────────────
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(margin, y, contentW, 42, 3, 3, "F");
      doc.setTextColor(30, 30, 30);

      // License Plate box
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(60, 60, 60);
      doc.roundedRect(margin + 4, y + 4, 48, 14, 2, 2, "FD");
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(inspection.vehicle.licensePlate, margin + 28, y + 13.5, {
        align: "center",
      });

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(50, 50, 50);

      const vehicleDesc = [
        inspection.vehicle.make,
        inspection.vehicle.model,
        inspection.vehicle.year,
        inspection.vehicle.color,
      ]
        .filter(Boolean)
        .join(" · ");

      doc.text(`Veículo: ${vehicleDesc || "Não informado"}`, margin + 4, y + 24);
      doc.text(
        `Chassi: ${inspection.vehicle.chassis || "—"}   |   Renavam: ${
          inspection.vehicle.renavam || "—"
        }`,
        margin + 4,
        y + 30
      );
      if (mov) {
        doc.text(
          `${mov.type === "ENTRY" ? "Entregue por" : "Retirado por"}: ${mov.personName}${
            mov.personDoc ? ` (${mov.personDoc})` : ""
          }`,
          margin + 4,
          y + 36
        );
      }

      const infoX = margin + 96;
      doc.text(`Vistoriador: ${inspection.inspector.name}`, infoX, y + 9);
      doc.text(
        `KM: ${inspection.km.toLocaleString("pt-BR")} km   |   Combustível: ${
          mov ? `${mov.fuelLevel}%` : "—"
        }`,
        infoX,
        y + 16
      );
      if (inspection.value > 0) {
        doc.text(`Valor ref.: ${formatCurrency(inspection.value)}`, infoX, y + 23);
      }

      // Status badge
      const statusLabel = STATUS_LABEL[inspection.status] ?? inspection.status;
      const badgeColor: [number, number, number] =
        inspection.status === "APPROVED"
          ? [22, 163, 74]
          : inspection.status === "REJECTED"
          ? [220, 38, 38]
          : [217, 119, 6];
      doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2]);
      doc.roundedRect(pageW - margin - 36, y + 4, 32, 9, 2, 2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.text(statusLabel, pageW - margin - 20, y + 10, { align: "center" });

      y += 48;

      // ── Comparative Summary (if EXIT and previousEntry exists) ───────────
      if (mov?.type === "EXIT" && inspection.previousEntry) {
        addPageIfNeeded(24);
        const prev = inspection.previousEntry;
        const kmDiff = inspection.km - prev.km;
        const fuelDiff = mov.fuelLevel - prev.fuelLevel;

        doc.setFillColor(254, 243, 199);
        doc.setDrawColor(217, 119, 6);
        doc.roundedRect(margin, y, contentW, 20, 2, 2, "FD");
        doc.setTextColor(120, 53, 15);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("RESUMO COMPARATIVO (ENTRADA × SAÍDA)", margin + 4, y + 6);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text(
          `Entrada em ${formatDate(prev.createdAt)} | KM Entrada: ${prev.km.toLocaleString(
            "pt-BR"
          )} km -> KM Saída: ${inspection.km.toLocaleString("pt-BR")} km (Dif: ${
            kmDiff >= 0 ? "+" : ""
          }${kmDiff} km)`,
          margin + 4,
          y + 12
        );
        doc.text(
          `Combustível Entrada: ${prev.fuelLevel}% -> Saída: ${mov.fuelLevel}% (${
            fuelDiff >= 0 ? "+" : ""
          }${fuelDiff}%) | Avarias Entrada: ${prev.damagesCount} -> Saída: ${
            mov.damages?.length ?? 0
          }`,
          margin + 4,
          y + 17
        );
        y += 25;
      }

      // ── 10 Required Angle Photos Gallery ─────────────────────────────────
      const movPhotos = mov?.photos ?? [];
      if (movPhotos.length > 0) {
        addPageIfNeeded(60);
        doc.setFillColor(30, 30, 30);
        doc.rect(margin, y, contentW, 8, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(`GALERIA DE FOTOS (${movPhotos.length})`, margin + 3, y + 5.5);
        y += 10;

        const cols = 3;
        const cellW = (contentW - 6) / cols;
        const cellH = 42;

        for (let i = 0; i < movPhotos.length; i += cols) {
          addPageIfNeeded(cellH + 6);
          const rowSlice = movPhotos.slice(i, i + cols);
          rowSlice.forEach((p, colIdx) => {
            const cx = margin + colIdx * (cellW + 3);
            doc.setFillColor(248, 248, 248);
            doc.rect(cx, y, cellW, cellH, "F");
            try {
              doc.addImage(p.url, "JPEG", cx + 1.5, y + 1.5, cellW - 3, cellH - 8);
            } catch {
              // ignore invalid image
            }
            doc.setTextColor(40, 40, 40);
            doc.setFontSize(7.5);
            doc.setFont("helvetica", "bold");
            const angleLabel = PHOTO_ANGLE_LABELS[p.angle || "EXTRA"] ?? p.angle ?? "Foto";
            doc.text(angleLabel, cx + cellW / 2, y + cellH - 2, { align: "center" });
          });
          y += cellH + 3;
        }
        y += 3;
      }

      // ── Damages Map & List ───────────────────────────────────────────────
      const damages = mov?.damages ?? [];
      addPageIfNeeded(35);
      doc.setFillColor(30, 30, 30);
      doc.rect(margin, y, contentW, 8, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(`MAPA E LISTA DE AVARIAS (${damages.length})`, margin + 3, y + 5.5);
      y += 10;

      if (damages.length === 0) {
        doc.setTextColor(80, 80, 80);
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.text("Nenhuma avaria registrada nesta movimentação.", margin + 3, y + 5);
        y += 10;
      } else {
        // Draw simplified top-down silhouette box + numbered markers on left, list on right
        const mapW = 46;
        const mapH = 66;
        addPageIfNeeded(mapH + 6);

        doc.setFillColor(245, 245, 245);
        doc.setDrawColor(180, 180, 180);
        doc.roundedRect(margin, y, mapW, mapH, 2, 2, "FD");
        // Car outline inside box
        doc.setDrawColor(90, 90, 90);
        doc.roundedRect(margin + 9, y + 6, mapW - 18, mapH - 12, 5, 5, "D");
        doc.setFontSize(6);
        doc.setTextColor(100, 100, 100);
        doc.text("FRENTE", margin + mapW / 2, y + 4.5, { align: "center" });
        doc.text("TRASEIRA", margin + mapW / 2, y + mapH - 1.5, { align: "center" });

        damages.forEach((d, idx) => {
          const px = margin + (d.x / 100) * mapW;
          const py = y + (d.y / 100) * mapH;
          doc.setFillColor(220, 38, 38);
          doc.circle(px, py, 2.5, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(5.5);
          doc.setFont("helvetica", "bold");
          doc.text(String(idx + 1), px, py + 0.8, { align: "center" });
        });

        // List of damages on the right
        let listY = y + 4;
        const listX = margin + mapW + 6;
        damages.forEach((d, idx) => {
          const tLabel = DAMAGE_TYPE_LABELS[d.type as DamageTypeKey] ?? d.type;
          doc.setTextColor(30, 30, 30);
          doc.setFontSize(8.5);
          doc.setFont("helvetica", "bold");
          doc.text(`${idx + 1}. ${d.area} — ${tLabel}`, listX, listY);
          if (d.notes) {
            doc.setFont("helvetica", "normal");
            doc.setTextColor(90, 90, 90);
            doc.text(`   Obs: ${d.notes}`, listX, listY + 4);
            listY += 9;
          } else {
            listY += 6;
          }
        });

        y += Math.max(mapH + 4, listY - y + 4);
      }

      // ── Checklist Items by Category ──────────────────────────────────────
      const categories = [...new Set(inspection.items.map((i) => i.category))];

      for (const category of categories) {
        const items = inspection.items.filter((i) => i.category === category);
        addPageIfNeeded(14);

        doc.setFillColor(30, 30, 30);
        doc.rect(margin, y, contentW, 8, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(category.toUpperCase(), margin + 3, y + 5.5);
        y += 10;

        for (const item of items) {
          const color = STATUS_COLOR[item.status] ?? "#6b7280";
          const hasPhoto = item.photos.length > 0;
          const photoH = hasPhoto ? 38 : 0;
          const obsH = item.observation ? 6 : 0;
          const rowH = 8 + photoH + obsH;

          addPageIfNeeded(rowH + 2);

          doc.setFillColor(249, 249, 249);
          doc.rect(margin, y, contentW, rowH, "F");

          const [r, g, b] = color
            .replace("#", "")
            .match(/.{2}/g)!
            .map((x) => parseInt(x, 16));
          doc.setFillColor(r, g, b);
          doc.rect(margin, y, 3, rowH, "F");

          doc.setTextColor(30, 30, 30);
          doc.setFontSize(8.5);
          doc.setFont("helvetica", "bold");
          doc.text(item.name, margin + 6, y + 5.5);

          doc.setFillColor(r, g, b);
          doc.roundedRect(pageW - margin - 26, y + 1.5, 24, 5.5, 1, 1, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(7);
          doc.setFont("helvetica", "bold");
          doc.text(STATUS_LABEL[item.status] ?? item.status, pageW - margin - 14, y + 5.3, {
            align: "center",
          });

          let itemY = y + 8;

          if (item.observation) {
            doc.setTextColor(100, 100, 100);
            doc.setFontSize(7.5);
            doc.setFont("helvetica", "italic");
            doc.text(`Obs: ${item.observation}`, margin + 6, itemY + 3.5);
            itemY += obsH;
          }

          if (hasPhoto) {
            try {
              const imgData = item.photos[0].url;
              doc.addImage(imgData, "JPEG", margin + 6, itemY + 1, 52, 34);
            } catch {
              // skip
            }
          }

          y += rowH + 1;
        }
        y += 3;
      }

      // ── Signature ────────────────────────────────────────────────────────
      if (inspection.signature) {
        addPageIfNeeded(42);
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(margin, y, pageW - margin, y);
        y += 6;
        doc.setTextColor(60, 60, 60);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(
          `Assinatura (${mov?.personName || inspection.inspector.name})`,
          margin,
          y + 4
        );
        try {
          doc.addImage(inspection.signature, "PNG", margin, y + 7, 70, 25);
        } catch {
          // skip
        }
        y += 36;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(
          `Responsável: ${mov?.personName || "—"}   |   Vistoriador: ${
            inspection.inspector.name
          }`,
          margin,
          y
        );
      }

      // ── Footer on all pages ──────────────────────────────────────────────
      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFillColor(240, 240, 240);
        doc.rect(0, pageH - 10, pageW, 10, "F");
        doc.setTextColor(120, 120, 120);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.text(
          `GRF AUTO CAR — Controle de Entrada e Saída · ID: ${mov?.id ?? inspection.id}`,
          margin,
          pageH - 4
        );
        doc.text(`Página ${p} de ${totalPages}`, pageW - margin, pageH - 4, {
          align: "right",
        });
      }

      doc.save(
        `laudo-${mov?.type?.toLowerCase() || "vistoria"}-${
          inspection.vehicle.licensePlate
        }-${inspection.id.slice(0, 8)}.pdf`
      );
    } catch (err) {
      console.error("PDF generation error:", err);
      alert("Erro ao gerar PDF. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <Download size={16} />
      )}
      {loading ? "Gerando PDF..." : label}
    </button>
  );
}
