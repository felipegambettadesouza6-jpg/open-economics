import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QueryRecipes } from "@/app/components/QueryRecipes";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteHeader } from "@/app/components/SiteHeader";
import { isLocale, type Locale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Ask official Brazilian economic data — Open Economics",
  description: "Run real questions against official Brazilian economic data, then reuse the exact API or MCP recipe.",
};

export default async function AskPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ recipe?: string }> }) {
  const { locale: rawLocale } = await params;
  const { recipe } = await searchParams;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const pt = locale === "pt-br";
  const initialRecipe = isRecipe(recipe) ? recipe : "selic";
  return <main className="atlas-page query-page"><SiteHeader locale={locale} /><section className="query-intro atlas-shell"><p className="atlas-kicker">{pt ? "PERGUNTA → FONTE → RECEITA" : "QUESTION → SOURCE → RECIPE"}</p><p>{pt ? "Escolha uma pergunta. O resultado vem da API pública agora — sem conta, chave ou valor de demonstração." : "Choose a question. The result comes from the public API now—without an account, key, or demo value."}</p></section><div className="atlas-shell"><QueryRecipes locale={locale} initialRecipe={initialRecipe} /></div><SiteFooter locale={locale} /></main>;
}

function isRecipe(value: string | undefined): value is "selic" | "jobs" | "unemployment" {
  return value === "selic" || value === "jobs" || value === "unemployment";
}
