import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  secret: process.env.AUTH_SECRET || "grf-auto-car-internal-secret-key-2026",
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "INSPECTOR";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? "";
        (session.user as { role?: string }).role = (token.role as string) ?? "INSPECTOR";
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const role = (auth?.user as { role?: string } | undefined)?.role;
      const isOnAdmin = nextUrl.pathname.startsWith("/admin");
      const isOnInspector = nextUrl.pathname.startsWith("/inspector");

      if (isOnAdmin) {
        if (!isLoggedIn) return false;
        if (role !== "ADMIN") {
          return Response.redirect(new URL("/login?error=AccessDenied", nextUrl));
        }
        return true;
      }

      if (isOnInspector) {
        if (!isLoggedIn) return false;
        return role === "INSPECTOR" || role === "ADMIN";
      }

      return true;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
