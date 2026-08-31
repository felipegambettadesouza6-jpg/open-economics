import { redirect } from "next/navigation";
export default async function Playground({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { const query = new URLSearchParams(); Object.entries(await searchParams).forEach(([key, value]) => { if (typeof value === "string") query.set(key, value); }); redirect(`/en/playground${query.size ? `?${query}` : ""}`); }
