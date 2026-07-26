import { cookies } from "next/headers";
import { getSessionUser } from "@valgian/core";
import { SESSION_COOKIE } from "@/lib/session";

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getSessionUser(token);
}
