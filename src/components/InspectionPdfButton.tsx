"use client";

import React, { useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";

interface Photo {
  url: string;
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
}

interface Inspector {
  name: string;
}

interface InspectionData {
  id: string;
  createdAt: Date;
  km: number;
  value: number;
  status: string;
  signature: string | null;
  vehicle: Vehicle;
  inspector: Inspector;
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
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(date));
}

export function InspectionPdfButton({ inspection, label = "Baixar PDF" }: Props) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const { default: jsPDF } = await import("jspdf");

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = 210;
      const pageH = 297;
      const margin = 14;
      const contentW = pageW - margin * 2;
      let y = margin;

      const addPageIfNeeded = (needed: number) => {
        if (y + needed > pageH - margin) {
          doc.addPage();
          y = margin;
        }
      };

      // ── Header ──────────────────────────────────────────────────────────
      doc.setFillColor(37, 99, 235); // blue-600
      doc.rect(0, 0, pageW, 28, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("GRF AUTO CAR", margin, 12);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Laudo de Vistoria Automotiva", margin, 19);
      doc.setFontSize(9);
      doc.text(`Gerado em: ${formatDate(new Date())}`, pageW - margin, 19, { align: "right" });
      y = 36;

      // ── Vehicle Info ─────────────────────────────────────────────────────
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(margin, y, contentW, 38, 3, 3, "F");
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");

      // License Plate box
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(60, 60, 60);
      doc.roundedRect(margin + 4, y + 4, 50, 14, 2, 2, "FD");
      doc.setFontSize(14);
      doc.text(inspection.vehicle.licensePlate, margin + 29, y + 13.5, { align: "center" });

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      const infoX = margin + 60;
      doc.text(`Vistoriador: ${inspection.inspector.name}`, infoX, y + 9);
      doc.text(`KM: ${inspection.km.toLocaleString("pt-BR")}`, infoX, y + 16);
      doc.text(`Valor: ${formatCurrency(inspection.value)}`, infoX, y + 23);
      doc.text(`Data: ${formatDate(inspection.createdAt)}`, infoX, y + 30);

      // Status badge
      const statusLabel = STATUS_LABEL[inspection.status] ?? inspection.status;
      const badgeColor = inspection.status === "APPROVED" ? [22, 163, 74] :
                         inspection.status === "REJECTED" ? [220, 38, 38] : [217, 119, 6];
      doc.setFillColor(...(badgeColor as [number, number, number]));
      doc.roundedRect(pageW - margin - 36, y + 4, 36, 10, 2, 2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(statusLabel, pageW - margin - 18, y + 10.5, { align: "center" });
      y += 46;

      // ── Summary counters ─────────────────────────────────────────────────
      const ok = inspection.items.filter(i => i.status === "OK").length;
      const alert = inspection.items.filter(i => i.status === "ALERT").length;
      const defect = inspection.items.filter(i => i.status === "DEFECT").length;
      const counters = [
        { label: "OK", count: ok, color: [22, 163, 74] as [number, number, number] },
        { label: "Atenção", count: alert, color: [217, 119, 6] as [number, number, number] },
        { label: "Defeito", count: defect, color: [220, 38, 38] as [number, number, number] },
      ];
      const boxW = (contentW - 8) / 3;
      counters.forEach((c, i) => {
        const bx = margin + i * (boxW + 4);
        doc.setFillColor(c.color[0], c.color[1], c.color[2]);
        doc.roundedRect(bx, y, boxW, 16, 2, 2, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text(String(c.count), bx + boxW / 2, y + 9, { align: "center" });
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(c.label, bx + boxW / 2, y + 14, { align: "center" });
      });
      y += 22;

      // ── Items by category ────────────────────────────────────────────────
      const categories = [...new Set(inspection.items.map(i => i.category))];

      for (const category of categories) {
        const items = inspection.items.filter(i => i.category === category);
        addPageIfNeeded(12);

        // Category header
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
          const photoH = hasPhoto ? 45 : 0;
          const obsH = item.observation ? 8 : 0;
          const rowH = 9 + photoH + obsH;

          addPageIfNeeded(rowH + 2);

          // Row background (alternating)
          doc.setFillColor(249, 249, 249);
          doc.rect(margin, y, contentW, rowH, "F");

          // Status indicator stripe
          const [r, g, b] = color.replace("#", "").match(/.{2}/g)!.map(x => parseInt(x, 16));
          doc.setFillColor(r, g, b);
          doc.rect(margin, y, 3, rowH, "F");

          // Item name
          doc.setTextColor(30, 30, 30);
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.text(item.name, margin + 6, y + 6);

          // Status badge
          doc.setFillColor(r, g, b);
          doc.roundedRect(pageW - margin - 26, y + 2, 26, 6, 1, 1, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(7.5);
          doc.setFont("helvetica", "bold");
          doc.text(STATUS_LABEL[item.status] ?? item.status, pageW - margin - 13, y + 6.2, { align: "center" });

          let itemY = y + 9;

          // Observation
          if (item.observation) {
            doc.setTextColor(100, 100, 100);
            doc.setFontSize(8);
            doc.setFont("helvetica", "italic");
            doc.text(`Obs: ${item.observation}`, margin + 6, itemY + 4);
            itemY += obsH;
          }

          // Photo
          if (hasPhoto) {
            try {
              const imgData = item.photos[0].url;
              const imgW = 60;
              const imgH = 40;
              doc.addImage(imgData, "JPEG", margin + 6, itemY + 2, imgW, imgH);
            } catch {
              // skip if image fails
            }
            itemY += photoH;
          }

          y += rowH + 1;
        }
        y += 4;
      }

      // ── Signature ────────────────────────────────────────────────────────
      if (inspection.signature) {
        addPageIfNeeded(40);
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(margin, y, pageW - margin, y);
        y += 6;
        doc.setTextColor(60, 60, 60);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("Assinatura do Vistoriador", margin, y + 4);
        try {
          doc.addImage(inspection.signature, "PNG", margin, y + 7, 70, 25);
        } catch { /* skip */ }
        y += 36;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(inspection.inspector.name, margin, y);
      }

      // ── Footer on all pages ──────────────────────────────────────────────
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFillColor(240, 240, 240);
        doc.rect(0, pageH - 10, pageW, 10, "F");
        doc.setTextColor(120, 120, 120);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.text("GRF AUTO CAR — Sistema de Vistorias Automotivas", margin, pageH - 4);
        doc.text(`Página ${p} de ${totalPages}`, pageW - margin, pageH - 4, { align: "right" });
      }

      doc.save(`vistoria-${inspection.vehicle.licensePlate}-${inspection.id.slice(0, 8)}.pdf`);
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
