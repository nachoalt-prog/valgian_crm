import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getTemaPorDefecto, getTemaPorInterfaz } from "@valgian/core";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getCurrentSession } from "@/lib/current-user";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Valgian CRM",
  description: "CRM modular — Valgian",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Antes de loguearse (o si el perfil no tiene interfaz asignada) se usa la
  // interfaz "default". Después de loguearse, la del perfil real — ver
  // domain/infraestructura.md ("Interfaz").
  const session = await getCurrentSession();
  const temaSesion = session?.perfil?.idInterfaz ? await getTemaPorInterfaz(session.perfil.idInterfaz) : null;
  const tema = temaSesion ?? (await getTemaPorDefecto());

  const overrides = [
    tema?.colorPrimario &&
      `--primary: ${tema.colorPrimario}; --sidebar-primary: ${tema.colorPrimario}; --ring: ${tema.colorPrimario}; --sidebar-ring: ${tema.colorPrimario}; --chart-1: ${tema.colorPrimario};`,
    tema?.colorSecundario && `--accent: ${tema.colorSecundario}; --chart-2: ${tema.colorSecundario};`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {overrides && <style>{`:root { ${overrides} }`}</style>}
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
