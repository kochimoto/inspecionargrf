#!/usr/bin/env node
/**
 * Gera o GOOGLE_DRIVE_REFRESH_TOKEN para salvar fotos no Google Drive.
 *
 * Como usar:
 *   node scripts/google-drive-auth.mjs <CLIENT_ID> <CLIENT_SECRET>
 *
 * Pré-requisito (uma única vez no Google Cloud Console):
 *   1. Acesse https://console.cloud.google.com/apis/library/drive.googleapis.com e clique em ATIVAR.
 *   2. Em "Tela de permissão OAuth" (OAuth consent screen), configure como Externo e adicione seu e-mail em "Usuários de teste" (ou publique o app).
 *   3. Em "Credenciais" → "Criar credenciais" → "ID do cliente OAuth":
 *      - Tipo: Aplicativo da Web
 *      - URIs de redirecionamento autorizados: http://localhost:53682/callback
 *   4. Copie o Client ID e Client Secret e rode o comando acima.
 */

import http from "node:http";

const [clientId, clientSecret] = process.argv.slice(2);

if (!clientId || !clientSecret) {
  console.error("\nUso: node scripts/google-drive-auth.mjs <CLIENT_ID> <CLIENT_SECRET>\n");
  process.exit(1);
}

const PORT = 53682;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const SCOPE = "https://www.googleapis.com/auth/drive.file";

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
  }).toString();

console.log("\n1) Abra este link no navegador e autorize sua conta do Google Drive:\n");
console.log(authUrl);
console.log("\nAguardando autorização em", REDIRECT_URI, "...\n");

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  if (url.pathname !== "/callback") {
    res.writeHead(404).end();
    return;
  }

  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(400).end("Codigo nao recebido.");
    return;
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  const data = await tokenRes.json();
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end("<h2>Autorizado! Volte ao terminal para copiar as variáveis da Vercel.</h2>");
  server.close();

  if (!data.refresh_token) {
    console.error("Erro ao obter refresh_token:", data);
    process.exit(1);
  }

  console.log("==================================================================");
  console.log("Copie e adicione estas 3 variáveis na Vercel (Settings → Environment Variables):");
  console.log("==================================================================\n");
  console.log(`GOOGLE_DRIVE_CLIENT_ID=${clientId}`);
  console.log(`GOOGLE_DRIVE_CLIENT_SECRET=${clientSecret}`);
  console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${data.refresh_token}\n`);
  console.log("(Opcional) Para usar uma pasta específica do seu Drive como raiz:");
  console.log("GOOGLE_DRIVE_ROOT_FOLDER_ID=<id-da-pasta>\n");
});

server.listen(PORT);
