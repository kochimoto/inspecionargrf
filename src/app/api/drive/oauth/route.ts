import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SCOPE = "https://www.googleapis.com/auth/drive.file";

/**
 * Live OAuth helper so the admin can generate GOOGLE_DRIVE_REFRESH_TOKEN
 * directly on the production domain (no localhost needed).
 *
 * Redirect URI to register in Google Cloud Console:
 *   https://<seu-dominio-na-vercel>/api/drive/oauth
 *
 * Step 1: Put GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET in Vercel.
 * Step 2: Logged in as ADMIN, open https://<seu-dominio>/api/drive/oauth
 * Step 3: Authorize Google → the page shows the GOOGLE_DRIVE_REFRESH_TOKEN to copy into Vercel.
 */
export async function GET(request: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || role !== "ADMIN") {
    return new Response("Acesso restrito ao administrador. Faça login em /login primeiro.", {
      status: 403,
    });
  }

  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const url = new URL(request.url);
  const redirectUri = `${url.origin}/api/drive/oauth`;

  if (!clientId || !clientSecret) {
    return new Response(
      `Configure primeiro GOOGLE_DRIVE_CLIENT_ID e GOOGLE_DRIVE_CLIENT_SECRET na Vercel.\n\n` +
        `No Google Cloud Console, adicione este URI de redirecionamento autorizado:\n${redirectUri}`,
      { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  const code = url.searchParams.get("code");

  // Step 1: redirect admin to Google consent screen
  if (!code) {
    const authUrl =
      "https://accounts.google.com/o/oauth2/v2/auth?" +
      new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: SCOPE,
        access_type: "offline",
        prompt: "consent",
      }).toString();

    return NextResponse.redirect(authUrl);
  }

  // Step 2: exchange code for refresh_token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });

  const data = (await tokenRes.json()) as {
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!data.refresh_token) {
    return new Response(
      `Erro ao obter refresh_token:\n${JSON.stringify(data, null, 2)}`,
      { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Google Drive Conectado — GRF</title>
  <style>
    body { background:#09090b; color:#f4f4f5; font-family:system-ui,sans-serif; padding:40px 20px; max-width:680px; margin:0 auto; }
    .card { background:#18181b; border:1px solid #27272a; border-radius:16px; padding:24px; }
    code { display:block; background:#09090b; border:1px solid #3f3f46; padding:14px; border-radius:8px; word-break:break-all; color:#34d399; font-size:13px; margin:12px 0; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Google Drive autorizado com sucesso!</h2>
    <p>Copie a variável abaixo, adicione em <strong>Vercel → Settings → Environment Variables</strong> e faça um Redeploy:</p>
    <code>GOOGLE_DRIVE_REFRESH_TOKEN=${data.refresh_token}</code>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
