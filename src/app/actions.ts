"use server";

import { randomUUID } from "crypto";
import {
  ItemStatus,
  MovementType,
  MovementReason,
  PhotoAngle,
  DamageType,
  InspectionStatus,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

// ── Auth Helpers ─────────────────────────────────────────────────────────────

async function requireSessionUser(allowedRoles: ("INSPECTOR" | "ADMIN")[]) {
  const session = await auth();
  const user = session?.user as
    | { id?: string; name?: string | null; email?: string | null; role?: string }
    | undefined;

  if (!user || !user.email) {
    throw new Error("Não autenticado. Faça login novamente.");
  }

  const role = (user.role || "INSPECTOR") as "INSPECTOR" | "ADMIN";
  if (!allowedRoles.includes(role)) {
    throw new Error("Sem permissão para executar esta ação.");
  }

  // Ensure DB user record exists and return it
  const dbUser = await prisma.user.upsert({
    where: { email: user.email },
    update: {},
    create: {
      name: user.name || "Usuário GRF",
      email: user.email,
      role,
    },
  });

  return dbUser;
}

// ── Validation Schemas (Zod) ─────────────────────────────────────────────────

const PlateSchema = z
  .string()
  .transform((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, ""))
  .refine((v) => /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(v), {
    message: "Placa inválida. Use o formato antigo (AAA0000) ou Mercosul (AAA0A00).",
  });

const SubmitItemSchema = z.object({
  id: z.string(),
  category: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(["OK", "ALERT", "DEFECT"]),
  observation: z.string().nullable().optional(),
});

const SubmitDamageSchema = z.object({
  clientId: z.string(),
  area: z.string().min(1),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  type: z.enum(["SCRATCH", "DENT", "CRACK", "MISSING_PART", "OTHER"]),
  notes: z.string().nullable().optional(),
});

const SubmitMovementInputSchema = z.object({
  type: z.enum(["ENTRY", "EXIT"]),
  reason: z.enum([
    "PURCHASE",
    "CONSIGNMENT",
    "TRADE_IN",
    "SALE",
    "RETURN",
    "WORKSHOP",
    "OTHER",
  ]),
  licensePlate: PlateSchema,
  vehicleData: z
    .object({
      make: z.string().nullable().optional(),
      model: z.string().nullable().optional(),
      year: z.number().int().min(1950).max(2100).nullable().optional(),
      color: z.string().nullable().optional(),
      chassis: z.string().nullable().optional(),
      renavam: z.string().nullable().optional(),
    })
    .optional(),
  km: z.number().int().nonnegative(),
  fuelLevel: z.number().int().min(0).max(100),
  value: z.number().nonnegative().optional().default(0),
  personName: z.string().min(2, "Informe o nome de quem trouxe/retirou o veículo."),
  personDoc: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  signature: z.string().min(10, "Assinatura obrigatória."),
  items: z.array(SubmitItemSchema).min(1),
  damages: z.array(SubmitDamageSchema).default([]),
});

export type SubmitMovementInput = z.infer<typeof SubmitMovementInputSchema>;

// ── Vehicle & Last Entry Lookup ──────────────────────────────────────────────

export async function lookupVehicleByPlate(rawPlate: string) {
  try {
    await requireSessionUser(["INSPECTOR", "ADMIN"]);

    const parsed = PlateSchema.safeParse(rawPlate);
    if (!parsed.success) {
      return {
        success: false as const,
        error: parsed.error.issues[0]?.message || "Placa inválida.",
      };
    }
    const licensePlate = parsed.data;

    const vehicle = await prisma.vehicle.findUnique({
      where: { licensePlate },
      include: {
        movements: {
          where: { type: "ENTRY" },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            damages: {
              include: { photo: true },
            },
            inspector: true,
            inspection: true,
          },
        },
      },
    });

    if (!vehicle) {
      return {
        success: true as const,
        exists: false as const,
        licensePlate,
        vehicle: null,
        lastEntry: null,
      };
    }

    const lastEntry = vehicle.movements[0] ?? null;

    return {
      success: true as const,
      exists: true as const,
      licensePlate,
      vehicle: {
        id: vehicle.id,
        licensePlate: vehicle.licensePlate,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        color: vehicle.color,
        chassis: vehicle.chassis,
        renavam: vehicle.renavam,
      },
      lastEntry: lastEntry
        ? {
            id: lastEntry.id,
            createdAt: lastEntry.createdAt.toISOString(),
            km: lastEntry.km,
            fuelLevel: lastEntry.fuelLevel,
            reason: lastEntry.reason,
            personName: lastEntry.personName,
            inspectorName: lastEntry.inspector.name,
            damages: lastEntry.damages.map((d) => ({
              id: d.id,
              area: d.area,
              x: d.x,
              y: d.y,
              type: d.type,
              notes: d.notes ?? "",
              photoUrl: d.photo?.url ?? null,
            })),
          }
        : null,
    };
  } catch (error) {
    console.error("Failed to lookup vehicle:", error);
    const msg = error instanceof Error ? error.message : "Erro ao buscar veículo.";
    return { success: false as const, error: msg };
  }
}

// ── Submit Movement + Inspection + Items + Damages ───────────────────────────

export async function submitMovementInspection(rawInput: SubmitMovementInput) {
  try {
    const inspector = await requireSessionUser(["INSPECTOR", "ADMIN"]);

    const parsed = SubmitMovementInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const firstErr = parsed.error.issues[0]?.message || "Dados inválidos.";
      return { success: false as const, error: firstErr };
    }
    const data = parsed.data;

    const vData = data.vehicleData ?? {};
    const vehicleUpdatePayload: Record<string, unknown> = {};
    if (vData.make) vehicleUpdatePayload.make = vData.make;
    if (vData.model) vehicleUpdatePayload.model = vData.model;
    if (vData.year) vehicleUpdatePayload.year = vData.year;
    if (vData.color) vehicleUpdatePayload.color = vData.color;
    if (vData.chassis) vehicleUpdatePayload.chassis = vData.chassis;
    if (vData.renavam) vehicleUpdatePayload.renavam = vData.renavam;

    const vehicle = await prisma.vehicle.upsert({
      where: { licensePlate: data.licensePlate },
      update: vehicleUpdatePayload,
      create: {
        licensePlate: data.licensePlate,
        make: vData.make ?? null,
        model: vData.model ?? null,
        year: vData.year ?? null,
        color: vData.color ?? null,
        chassis: vData.chassis ?? null,
        renavam: vData.renavam ?? null,
      },
    });

    const movementId = randomUUID();
    const inspectionId = randomUUID();

    const itemIdMap: Record<string, string> = {};
    const itemRows = data.items.map((item) => {
      const dbId = randomUUID();
      itemIdMap[item.id] = dbId;
      return {
        id: dbId,
        inspectionId,
        category: item.category,
        name: item.name,
        status: item.status as ItemStatus,
        observation: item.observation ?? null,
      };
    });

    const damageIdMap: Record<string, string> = {};
    const damageRows = data.damages.map((dmg) => {
      const dbId = randomUUID();
      damageIdMap[dmg.clientId] = dbId;
      return {
        id: dbId,
        movementId,
        area: dmg.area,
        x: dmg.x,
        y: dmg.y,
        type: dmg.type as DamageType,
        notes: dmg.notes ?? null,
      };
    });

    await prisma.$transaction([
      prisma.movement.create({
        data: {
          id: movementId,
          vehicleId: vehicle.id,
          type: data.type as MovementType,
          reason: data.reason as MovementReason,
          km: data.km,
          fuelLevel: data.fuelLevel,
          personName: data.personName,
          personDoc: data.personDoc ?? null,
          signature: data.signature,
          notes: data.notes ?? null,
          inspectorId: inspector.id,
        },
      }),
      prisma.inspection.create({
        data: {
          id: inspectionId,
          vehicleId: vehicle.id,
          inspectorId: inspector.id,
          movementId,
          km: data.km,
          value: data.value ?? 0,
          signature: data.signature,
        },
      }),
      prisma.inspectionItem.createMany({ data: itemRows }),
      ...(damageRows.length > 0 ? [prisma.damage.createMany({ data: damageRows })] : []),
    ]);

    revalidatePath("/admin");
    return {
      success: true as const,
      id: inspectionId,
      movementId,
      itemIdMap,
      damageIdMap,
    };
  } catch (error) {
    console.error("Failed to submit movement inspection:", error);
    const msg = error instanceof Error ? error.message : "Erro desconhecido.";
    return { success: false as const, error: `Falha ao enviar vistoria: ${msg}` };
  }
}

// ── Legacy submitInspection (kept for compatibility) ─────────────────────────

type LegacySubmitItem = {
  id: string;
  category: string;
  name: string;
  status: string | null;
  observation?: string | null;
};

type LegacySubmitInspectionInput = {
  licensePlate: string;
  km: number;
  value: number;
  signature: string;
  items: LegacySubmitItem[];
};

export async function submitInspection(data: LegacySubmitInspectionInput) {
  const validItems = data.items.filter(
    (i): i is LegacySubmitItem & { status: "OK" | "ALERT" | "DEFECT" } =>
      i.status === "OK" || i.status === "ALERT" || i.status === "DEFECT"
  );

  return submitMovementInspection({
    type: "ENTRY",
    reason: "PURCHASE",
    licensePlate: data.licensePlate,
    km: data.km,
    fuelLevel: 50,
    value: data.value,
    personName: "Responsável",
    signature: data.signature,
    items: validItems,
    damages: [],
  });
}

// ── Photo Upload Actions (one per photo to avoid body size limits) ───────────

/** Attaches a single photo (base64 data URL) to an inspection item. */
export async function addItemPhoto(inspectionItemId: string, url: string) {
  try {
    await requireSessionUser(["INSPECTOR", "ADMIN"]);
    await prisma.photo.create({
      data: { inspectionItemId, angle: "EXTRA", url },
    });
    return { success: true as const };
  } catch (error) {
    console.error("Failed to upload item photo:", error);
    const msg = error instanceof Error ? error.message : "Erro desconhecido.";
    return { success: false as const, error: msg };
  }
}

/** Attaches a required angle or extra photo to a Movement. */
export async function addMovementPhoto(
  movementId: string,
  angle: PhotoAngle,
  url: string
) {
  try {
    await requireSessionUser(["INSPECTOR", "ADMIN"]);
    await prisma.photo.create({
      data: { movementId, angle, url },
    });
    return { success: true as const };
  } catch (error) {
    console.error("Failed to upload movement photo:", error);
    const msg = error instanceof Error ? error.message : "Erro desconhecido.";
    return { success: false as const, error: msg };
  }
}

/** Attaches a photo to a specific Damage record. */
export async function addDamagePhoto(
  movementId: string,
  damageId: string,
  url: string
) {
  try {
    await requireSessionUser(["INSPECTOR", "ADMIN"]);
    const photo = await prisma.photo.create({
      data: {
        movementId,
        angle: "EXTRA",
        url,
      },
    });
    await prisma.damage.update({
      where: { id: damageId },
      data: { photoId: photo.id },
    });
    return { success: true as const };
  } catch (error) {
    console.error("Failed to upload damage photo:", error);
    const msg = error instanceof Error ? error.message : "Erro desconhecido.";
    return { success: false as const, error: msg };
  }
}

// ── Admin Approval / Rejection Action (ADMIN ONLY) ───────────────────────────

const ReviewInspectionSchema = z
  .object({
    inspectionId: z.string().min(1),
    status: z.enum(["APPROVED", "REJECTED"]),
    rejectionReason: z.string().optional(),
  })
  .refine(
    (val) =>
      val.status === "APPROVED" ||
      (val.rejectionReason && val.rejectionReason.trim().length >= 3),
    {
      message: "O motivo da rejeição é obrigatório (mínimo 3 caracteres).",
      path: ["rejectionReason"],
    }
  );

export async function reviewInspection(input: {
  inspectionId: string;
  status: "APPROVED" | "REJECTED";
  rejectionReason?: string;
}) {
  try {
    const admin = await requireSessionUser(["ADMIN"]);

    const parsed = ReviewInspectionSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false as const,
        error: parsed.error.issues[0]?.message || "Dados inválidos.",
      };
    }

    await prisma.inspection.update({
      where: { id: parsed.data.inspectionId },
      data: {
        status: parsed.data.status as InspectionStatus,
        approvedById: admin.id,
        approvedAt: new Date(),
        rejectionReason:
          parsed.data.status === "REJECTED"
            ? parsed.data.rejectionReason?.trim() ?? null
            : null,
      },
    });

    revalidatePath("/admin");
    revalidatePath(`/admin/inspection/${parsed.data.inspectionId}`);
    return { success: true as const };
  } catch (error) {
    console.error("Failed to review inspection:", error);
    const msg = error instanceof Error ? error.message : "Erro ao atualizar status.";
    return { success: false as const, error: msg };
  }
}
