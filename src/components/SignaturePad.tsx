"use client";

import React, { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Eraser } from "lucide-react";
import { cn } from "@/lib/utils";

interface SignaturePadProps {
  onChange: (signatureDataUrl: string | null) => void;
  className?: string;
}

export function SignaturePad({ onChange, className }: SignaturePadProps) {
  const sigCanvas = useRef<SignatureCanvas>(null);
  const [hasSignature, setHasSignature] = useState(false);

  const handleEnd = () => {
    if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
      onChange(sigCanvas.current.getTrimmedCanvas().toDataURL("image/png"));
      setHasSignature(true);
    }
  };

  const clear = () => {
    if (sigCanvas.current) {
      sigCanvas.current.clear();
      onChange(null);
      setHasSignature(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-2 w-full", className)}>
      <div className="flex justify-between items-center mb-1">
        <label className="text-sm font-medium text-zinc-300">Assinatura do Vistoriador</label>
        {hasSignature && (
          <button 
            type="button" 
            onClick={clear}
            className="text-xs flex items-center gap-1 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <Eraser size={14} /> Limpar
          </button>
        )}
      </div>
      
      <div className="w-full bg-zinc-100 rounded-md overflow-hidden border-2 border-zinc-700 focus-within:border-zinc-500 relative touch-none">
        <SignatureCanvas 
          ref={sigCanvas}
          penColor="#09090b"
          canvasProps={{
            className: "w-full h-[150px] sm:h-[200px]"
          }}
          onEnd={handleEnd}
        />
        {!hasSignature && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <span className="text-zinc-400/50 text-xl select-none font-medium">Assine aqui</span>
          </div>
        )}
      </div>
    </div>
  );
}
