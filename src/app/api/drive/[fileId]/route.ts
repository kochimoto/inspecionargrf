import { auth } from "@/auth";
import { downloadDriveFile, isDriveEnabled } from "@/lib/drive";

export const dynamic = "force-dynamic";

/**
 * Proxies a photo stored in Google Drive so it can be displayed in <img>
 * without making the Drive file public. Requires an authenticated session.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Não autenticado", { status: 401 });
  }

  if (!isDriveEnabled()) {
    return new Response("Google Drive não configurado", { status: 503 });
  }

  const { fileId } = await params;
  if (!/^[a-zA-Z0-9_-]{10,}$/.test(fileId)) {
    return new Response("ID inválido", { status: 400 });
  }

  try {
    const driveRes = await downloadDriveFile(fileId);
    return new Response(driveRes.body, {
      status: 200,
      headers: {
        "Content-Type": driveRes.headers.get("content-type") ?? "image/jpeg",
        // Photos are immutable: cache in the browser for 7 days
        "Cache-Control": "private, max-age=604800, immutable",
      },
    });
  } catch (error) {
    console.error("Drive proxy error:", error);
    return new Response("Foto não encontrada", { status: 404 });
  }
}
