"use client";

import React, { useState, ChangeEvent } from "react";
import { cn } from "@/lib/utils";

interface LicensePlateInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function LicensePlateInput({ value, onChange, className }: LicensePlateInputProps) {
  // Check if it's Mercosul (AAA1A11) vs Old (AAA1111)
  // Length is max 7 chars
  const isMercosul = value.length >= 5 && isNaN(Number(value[4]));

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (val.length > 7) val = val.slice(0, 7);
    onChange(val);
  };

  return (
    <div className={cn("relative w-full max-w-[280px] mx-auto", className)}>
      <div
        className={cn(
          "w-full rounded-md border-[3px] border-zinc-800 bg-white overflow-hidden shadow-lg flex flex-col transition-all duration-300",
          isMercosul ? "h-[100px]" : "h-[90px]"
        )}
      >
        {isMercosul && (
          <div className="bg-blue-600 h-[28px] w-full flex items-center justify-between px-2">
            <span className="text-[10px] font-bold text-white">MERCOSUL</span>
            <span className="text-[12px] font-bold text-white">BRASIL</span>
          </div>
        )}
        {!isMercosul && (
          <div className="bg-zinc-300 h-[20px] w-full border-b border-zinc-400"></div>
        )}
        
        <div className="flex-1 flex items-center justify-center bg-white relative">
          <input
            type="text"
            value={value}
            onChange={handleChange}
            placeholder="AAA0A00"
            className="w-full h-full text-center bg-transparent outline-none font-bold text-zinc-900 tracking-[0.2em] placeholder:text-zinc-300"
            style={{ fontSize: "2.5rem", fontFamily: "monospace" }}
          />
        </div>
      </div>
    </div>
  );
}
