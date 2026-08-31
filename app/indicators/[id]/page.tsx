import { redirect } from "next/navigation";
export default async function Indicator({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; redirect(`/en/indicators/${id}`); }
