import Link from "next/link";
import { ClipboardList, Car } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-4">
      <div className="glass-card p-10 max-w-md w-full flex flex-col items-center text-center gap-8">
        <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
          <Car size={40} className="text-white" />
        </div>
        
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">GRF AUTO CAR</h1>
          <p className="text-zinc-400">Selecione o módulo que deseja acessar:</p>
        </div>

        <div className="flex flex-col gap-4 w-full">
          <Link 
            href="/admin"
            className="flex items-center justify-center gap-3 w-full bg-zinc-800 hover:bg-zinc-700 text-white py-4 rounded-xl font-semibold transition-colors border border-zinc-700/50"
          >
            <ClipboardList size={20} />
            Painel Admin (Auditoria)
          </Link>
          
          <Link 
            href="/inspector"
            className="flex items-center justify-center gap-3 w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-semibold transition-colors shadow-lg shadow-blue-600/10"
          >
            <Car size={20} />
            Nova Vistoria
          </Link>
        </div>
      </div>
    </div>
  );
}
