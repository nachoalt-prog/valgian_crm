"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { login, getSessionUser, getTemaPorInterfaz } from "@valgian/core";
import { SESSION_COOKIE } from "@/lib/session";
import { INTERFAZ_COLORES_COOKIE } from "@/lib/interfaz-colores";

export async function loginAction(_prevState: { error?: string } | undefined, formData: FormData) {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  const result = await login(username, password);

  if (!result) {
    return { error: "Usuario o contraseña incorrectos" };
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: result.tokenExpiracion,
    path: "/",
  });

  // Colores de énfasis de la interfaz real del perfil — para que la próxima
  // vez que se muestre el login (sin sesión todavía) use estos en vez de
  // caer siempre a la interfaz "default" (ver lib/interfaz-colores.ts).
  const session = await getSessionUser(result.token);
  const tema = session?.perfil?.idInterfaz ? await getTemaPorInterfaz(session.perfil.idInterfaz) : null;
  if (tema?.colorPrimario || tema?.colorSecundario) {
    cookieStore.set(INTERFAZ_COLORES_COOKIE, JSON.stringify({ colorPrimario: tema.colorPrimario, colorSecundario: tema.colorSecundario }), {
      sameSite: "lax",
      maxAge: 31536000,
      path: "/",
    });
  }

  redirect("/dashboard");
}
