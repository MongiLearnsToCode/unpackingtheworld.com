import { render } from "svelte/server";
import { LEGAL } from "./lib/legal.ts";
import LandingPage from "./lib/components/LandingPage.svelte";

/**
 * Build-time entry: returns the landing page as static HTML so crawlers and
 * AI fetchers see real content in the initial response.
 */
export function renderLanding(): string {
  return render(LandingPage).body;
}

/** FAQ pairs for FAQPage structured data, taken from the same source as the page. */
export function faqPairs(): { question: string; answer: string }[] {
  return LEGAL.faq.sections.map((section) => ({
    question: section.title,
    answer: section.paragraphs.join(" "),
  }));
}
