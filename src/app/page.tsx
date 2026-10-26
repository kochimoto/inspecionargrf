import Link from "next/link";
import { ClipboardList, Car, ArrowDownCircle, ArrowUpCircle } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-4">
      <div className="glass-card p-8 sm:p-10 max-w-md w-full flex flex-col items-center text-center gap-7">
        <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
          <Car size={40} className="text-white" />
        </div>

        <div>
          <h1 className="text-3xl font-bold text-white mb-2">GRF AUTO CAR</h1>
          <p className="text-zinc-400 text-sm">
            Controle Interno de Entrada e Saída de Veículos
          </p>
        </div>

        <div className="flex flex-col gap-4 w-full">
          <Link
            href="/inspector?type=ENTRY"
            className="flex items-center justify-center gap-3 w-full bg-emerald-600 hover:bg-emerald-500 text-white py-5 rounded-2xl font-bold text-lg transition-colors shadow-lg shadow-emerald-600/20 btn-interactive"
          >
            <ArrowDownCircle size={24} />
            Registrar ENTRADA
          </Link>

          <Link
            href="/inspector?type=EXIT"
            className="flex items-center justify-center gap-3 w-full bg-amber-600 hover:bg-amber-500 text-white py-5 rounded-2xl font-bold text-lg transition-colors shadow-lg shadow-amber-600/20 btn-interactive"
          >
            <ArrowUpCircle size={24} />
            Registrar SAÍDA
          </Link>

          <div className="border-t border-zinc-800 my-1" />

          <Link
            href="/admin"
            className="flex items-center justify-center gap-3 w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 py-4 rounded-xl font-semibold transition-colors border border-zinc-700/50 text-sm"
          >
            <ClipboardList size={18} />
            Painel Admin (Estoque e Auditoria)
          </Link>
        </div>
      </div>
    </div>
  );
}
