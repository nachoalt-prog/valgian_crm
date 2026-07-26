"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { logout } from "@valgian/core";
import { SESSION_COOKIE } from "@/lib/session";

export async function logoutAction() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await logout(token);
  }

  cookieStore.delete(SESSION_COOKIE);
  redirect("/");
}
