import type { Metadata } from "next";
import Link from "next/link";
import { PageHead } from "@/components/ui";
import { Scrambler } from "./scrambler";
import { Sealer } from "./sealer";
import { Generator } from "./generator";

export const metadata: Metadata = { title: "Tools" };

const TOOLS = [
  { value: "scramble", label: "Image scrambler" },
  { value: "seal", label: "Seal a file" },
  { value: "generate", label: "Generator" },
];

export default async function ToolsPage(props: PageProps<"/tools">) {
  const sp = await props.searchParams;
  const tool = TOOLS.some((t) => t.value === sp.tool) ? String(sp.tool) : "scramble";
  return (
    <>
      <PageHead title="Tools" sub="Privacy tools that run entirely in your browser." />
      <nav className="tabs" aria-label="Tools" style={{ marginBottom: 16 }}>
        {TOOLS.map((t) => (
          <Link key={t.value} href={`/tools?tool=${t.value}`} className="tab" aria-current={t.value === tool ? "page" : undefined}>{t.label}</Link>
        ))}
      </nav>
      {tool === "scramble" && <Scrambler />}
      {tool === "seal" && <Sealer />}
      {tool === "generate" && <Generator />}
    </>
  );
}
