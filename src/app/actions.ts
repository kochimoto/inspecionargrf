"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function submitInspection(data: any) {
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
    const validItems = (data.items as any[]).filter((item) => item.status !== null && item.status !== undefined);

    // Create Inspection
    const inspection = await prisma.inspection.create({
      data: {
        vehicleId: vehicle.id,
        inspectorId: inspector.id,
        km: data.km,
        value: data.value,
        signature: data.signature,
        items: {
          create: validItems.map((item: any) => ({
            category: item.category,
            name: item.name,
            status: item.status,
            observation: item.observation ?? null,
            photos: item.photoUrl ? {
              create: { url: item.photoUrl }
            } : undefined
          }))
        }
      }
    });

    revalidatePath("/admin");
    return { success: true, id: inspection.id };
  } catch (error) {
    console.error("Failed to submit inspection:", error);
    const msg = error instanceof Error ? error.message : "Erro desconhecido.";
    return { success: false, error: `Falha ao enviar vistoria: ${msg}` };
  }
}
