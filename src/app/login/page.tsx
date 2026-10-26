"use client";

import React, { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Car, Lock, Mail, LogIn, ShieldCheck, UserCheck } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState("joao@grf.com");
  const [pin, setPin] = useState("1234");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    errorParam === "AccessDenied"
      ? "Acesso negado: esta área exige perfil de Administrador (ADMIN)."
      : null
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await signIn("credentials", {
      email,
      pin,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError("E-mail ou PIN inválidos.");
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  };

  const selectQuickProfile = (role: "INSPECTOR" | "ADMIN") => {
    if (role === "ADMIN") {
      setEmail("admin@grf.com");
      setPin("admin123");
    } else {
      setEmail("joao@grf.com");
      setPin("1234");
    }
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-4">
      <div className="glass-card p-8 max-w-md w-full flex flex-col gap-6">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
            <Car size={32} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">GRF AUTO CAR</h1>
            <p className="text-xs text-zinc-400 mt-1">
              Identifique-se para acessar o sistema
            </p>
          </div>
        </div>

        {/* Quick profile selector for ease of testing / patio use */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => selectQuickProfile("INSPECTOR")}
            className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-colors ${
              email === "joao@grf.com"
                ? "bg-emerald-600/20 border-emerald-500 text-emerald-300"
                : "bg-zinc-900 border-zinc-800 text-zinc-400"
            }`}
          >
            <UserCheck size={18} />
            Perfil Inspetor
          </button>
          <button
            type="button"
            onClick={() => selectQuickProfile("ADMIN")}
            className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-colors ${
              email === "admin@grf.com"
                ? "bg-blue-600/20 border-blue-500 text-blue-300"
                : "bg-zinc-900 border-zinc-800 text-zinc-400"
            }`}
          >
            <ShieldCheck size={18} />
            Perfil Admin
          </button>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300 mb-1.5">
              <Mail size={14} className="text-blue-400" /> E-mail
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-3 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300 mb-1.5">
              <Lock size={14} className="text-blue-400" /> PIN / Senha
            </label>
            <input
              type="password"
              required
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-3 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 text-white py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 btn-interactive"
          >
            <LogIn size={18} />
            {loading ? "Entrando..." : "Entrar no Sistema"}
          </button>
        </form>

        <div className="text-center">
          <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300">
            ← Voltar para a Tela Inicial
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#09090b]" />}>
      <LoginForm />
    </Suspense>
  );
}
