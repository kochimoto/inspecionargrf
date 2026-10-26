import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";

const LoginSchema = z.object({
  email: z.string().email(),
  pin: z.string().min(3),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET || "grf-auto-car-internal-secret-key-2026",
  trustHost: true,
  providers: [
    Credentials({
      name: "Credenciais Internas",
      credentials: {
        email: { label: "E-mail", type: "email" },
        pin: { label: "PIN / Senha", type: "password" },
      },
      async authorize(credentials) {
        const parsed = LoginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const email = parsed.data.email.toLowerCase().trim();
        const pin = parsed.data.pin.trim();

        const adminPin = process.env.ADMIN_PIN || "admin123";
        const inspectorPin = process.env.INSPECTOR_PIN || "1234";

        // Seed default users if not yet in DB
        if (email === "admin@grf.com" && pin === adminPin) {
          const user = await prisma.user.upsert({
            where: { email: "admin@grf.com" },
            update: { role: "ADMIN" },
            create: {
              name: "Administrador GRF",
              email: "admin@grf.com",
              role: "ADMIN",
            },
          });
          return { id: user.id, name: user.name, email: user.email, role: user.role };
        }

        if (email === "joao@grf.com" && pin === inspectorPin) {
          const user = await prisma.user.upsert({
            where: { email: "joao@grf.com" },
            update: { role: "INSPECTOR" },
            create: {
              name: "João Vistoriador",
              email: "joao@grf.com",
              role: "INSPECTOR",
            },
          });
          return { id: user.id, name: user.name, email: user.email, role: user.role };
        }

        // Check existing database user by email
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (!existingUser) return null;

        const expectedPin = existingUser.role === "ADMIN" ? adminPin : inspectorPin;
        if (pin !== expectedPin) return null;

        return {
          id: existingUser.id,
          name: existingUser.name,
          email: existingUser.email,
          role: existingUser.role,
        };
      },
    }),
  ],
});
