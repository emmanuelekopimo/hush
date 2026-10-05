"use server";

import { getDb } from "@/db";
import { getNow } from "@/lib/dates";
import { clientIp } from "@/server/session";
import { openShare } from "@/server/shares";

export async function openShareAction(token: string) {
  const res = await openShare(getDb(), token, getNow(), await clientIp());
  if (!res.ok) return { ok: false as const, status: res.status };
  return { ok: true as const, key: res.key, value: res.value, viewsLeft: res.viewsLeft };
}
