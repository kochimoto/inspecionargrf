import { auth } from "@/auth";
import { ensurePlateFolder, isDriveEnabled } from "@/lib/drive";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Redirects the authenticated user directly to the vehicle's folder in Google Drive. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ plate: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Não autenticado", { status: 401 });
  }

  if (!isDriveEnabled()) {
    return new Response(
      "Google Drive ainda não configurado nas variáveis de ambiente da Vercel.",
      { status: 503 }
    );
  }

  const { plate } = await params;
  const cleanPlate = plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleanPlate.length < 7) {
    return new Response("Placa inválida", { status: 400 });
  }

  const folderId = await ensurePlateFolder(cleanPlate);
  return NextResponse.redirect(`https://drive.google.com/drive/folders/${folderId}`);
}
