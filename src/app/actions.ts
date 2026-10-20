"use server";

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

type SubmitItem = {
  id: string; // client-side id (e.g. "fot-1")
  category: string;
  name: string;
  status: string | null;
  observation?: string | null;
};

type SubmitInspectionInput = {
  licensePlate: string;
  km: number;
  value: number;
  signature: string;
  items: SubmitItem[];
};

/**
 * Creates the inspection and its items WITHOUT photos.
 * Photos are uploaded separately (one request per photo via `addItemPhoto`) so the
 * request body never exceeds the hosting limit (Vercel ~4.5MB), which previously made
 * the submit hang forever.
 *
 * Returns a map of client item id -> database item id so the client can attach photos.
 */
export async function submitInspection(data: SubmitInspectionInput) {
  try {
    // For MVP, we use a mock inspector
    let inspector = await prisma.user.findFirst({ where: { role: "INSPECTOR" } });
    if (!inspector) {
      inspector = await prisma.user.create({
        data: { name: "João Vistoriador", email: "joao@grf.com", role: "INSPECTOR" }
      });
    }

    // Upsert Vehicle
    const vehicle = await prisma.vehicle.upsert({
      where: { licensePlate: data.licensePlate },
      update: {},
      create: { licensePlate: data.licensePlate }
    });

    // Filter out items with no status (safety check)
    const validItems = data.items.filter((item) => item.status !== null && item.status !== undefined);

    const inspectionId = randomUUID();
    const itemIdMap: Record<string, string> = {};
    const itemRows = validItems.map((item) => {
      const dbId = randomUUID();
      itemIdMap[item.id] = dbId;
      return {
        id: dbId,
        inspectionId,
        category: item.category,
        name: item.name,
        status: item.status as string,
        observation: item.observation ?? null,
      };
    });

    // 2 queries instead of one INSERT per item
    await prisma.$transaction([
      prisma.inspection.create({
        data: {
          id: inspectionId,
          vehicleId: vehicle.id,
          inspectorId: inspector.id,
          km: data.km,
          value: data.value,
          signature: data.signature,
        }
      }),
      prisma.inspectionItem.createMany({ data: itemRows }),
    ]);

    revalidatePath("/admin");
    return { success: true as const, id: inspectionId, itemIdMap };
  } catch (error) {
    console.error("Failed to submit inspection:", error);
    const msg = error instanceof Error ? error.message : "Erro desconhecido.";
    return { success: false as const, error: `Falha ao enviar vistoria: ${msg}` };
  }
}

/** Attaches a single photo (base64 data URL) to an inspection item. */
export async function addItemPhoto(inspectionItemId: string, url: string) {
  try {
    await prisma.photo.create({ data: { inspectionItemId, url } });
    return { success: true as const };
  } catch (error) {
    console.error("Failed to upload photo:", error);
    const msg = error instanceof Error ? error.message : "Erro desconhecido.";
    return { success: false as const, error: msg };
  }
}
