import { getDb } from "@/db";
import { getToday } from "@/lib/dates";
import { serializeEnv } from "@/lib/envfile";
import { ENVIRONMENTS } from "@/lib/validation";
import { vaultKey } from "@/server/keys";
import { clientIp, getCurrentUser } from "@/server/session";
import { exportEntries } from "@/server/vault";

export async function GET(request: Request, ctx: RouteContext<"/api/projects/[id]/export">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  const { id } = await ctx.params;
  const env = new URL(request.url).searchParams.get("env") ?? "production";
  if (!(ENVIRONMENTS as readonly string[]).includes(env)) return new Response("Unknown environment", { status: 400 });
  const res = await exportEntries(getDb(), user.id, Number(id), env, vaultKey(), await clientIp());
  if (!res) return new Response("Not found", { status: 404 });
  const slug = res.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const body = serializeEnv(res.entries, `${res.project.name} (${env})\nExported from Hush on ${getToday()}. Do not commit this file.`);
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.${env}.env"`,
      "Cache-Control": "no-store",
    },
  });
}
