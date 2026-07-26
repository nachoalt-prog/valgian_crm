"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { login } from "@valgian/core";
import { SESSION_COOKIE } from "@/lib/session";

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

  redirect("/dashboard");
}
