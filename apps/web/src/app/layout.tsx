import type { Metadata } from "next";
import { cookies } from "next/headers";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { getTemaPorDefecto, getTemaPorInterfaz } from "@valgian/core";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getCurrentSession } from "@/lib/current-user";
import { THEME_COOKIE } from "@/lib/theme";
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

  // Sin cookie: se renderiza "dark" como default y el script de abajo lo
  // corrige antes del primer paint si el SO prefiere claro (sin flash porque
  // corre con estrategia beforeInteractive, antes de que el navegador pinte).
  const themeCookie = (await cookies()).get(THEME_COOKIE)?.value;
  const temaClase = themeCookie === "light" ? "light" : "dark";

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${temaClase} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {!themeCookie && (
          <Script id="theme-init" strategy="beforeInteractive">
            {`try{if(!document.cookie.includes("${THEME_COOKIE}=")&&window.matchMedia("(prefers-color-scheme: light)").matches){document.documentElement.classList.replace("dark","light")}}catch(e){}`}
          </Script>
        )}
        {overrides && <style>{`:root { ${overrides} }`}</style>}
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
