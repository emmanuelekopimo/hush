import type { Metadata } from "next";
import { PageHead } from "@/components/ui";
import { Scanner } from "./scanner";

export const metadata: Metadata = { title: "Leak scanner" };

export default function ScannerPage() {
  return (
    <>
      <PageHead title="Leak scanner" sub="Find API keys, tokens and passwords before they end up in Git or a group chat." />
      <Scanner />
    </>
  );
}
