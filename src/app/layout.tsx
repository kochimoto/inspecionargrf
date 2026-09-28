import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GRF AUTO CAR - Vistorias e Auditoria",
  description: "Sistema de Vistorias e Auditoria Automotiva para GRF AUTO CAR.",
};

// Remove the `LayoutProps<"/">` type since Next.js standard is just `{ children: React.ReactNode }` for RootLayout.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} antialiased h-full dark`}>
      <body className="min-h-full flex flex-col font-sans bg-background text-foreground bg-[#0a0a0a] text-slate-100">
        {children}
      </body>
    </html>
  );
}
