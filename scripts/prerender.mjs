/**
 * Post-build prerender.
 *
 * 1. Inlines the server-rendered landing page into dist/index.html, so `/`
 *    returns real content to crawlers and AI fetchers that do not run JS.
 * 2. Writes dist/app.html: the tool route's document with its own head
 *    metadata and a static introduction, served by the Worker for `/app`.
 * 3. Writes dist/404.html for the Worker's not-found response.
 * 4. Injects JSON-LD generated from the same data the page renders.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const BODY_PLACEHOLDER = "<!--app-html-->";
const JSONLD_PLACEHOLDER = "<!--seo-jsonld-->";
const SITE = "https://unpackingtheworld.com";

const LANDING_TITLE = "unpacking_the_world — Decode anything, upload nothing";
const APP_TITLE = "Decoder — unpacking_the_world";
const NOT_FOUND_TITLE = "Page not found — unpacking_the_world";
const APP_DESCRIPTION =
  "Paste a JWT, PEM key, certificate, cron expression, header block, timestamp, UUID or archive and see a flagged result instantly. Everything runs in your browser; nothing is uploaded.";

const APP_BODY = `<article class="legal">
  <h1>unpacking_the_world decoder</h1>
  <p>Paste a JWT, PEM key, certificate, cron expression, header block, timestamp, UUID or archive and see a flagged, structured result instantly. Detection ranks the best format first and you can always force another one.</p>
  <p>Decoding runs in this tab. Pasted text and dropped files are never uploaded, logged or analysed, and there is no analytics or third-party request.</p>
  <p><a class="link" href="/">About unpacking_the_world</a></p>
</article>`;

const NOT_FOUND_BODY = `<article class="legal">
  <h1>That page isn’t here</h1>
  <p>The URL may be from an older version of the site, or mistyped. Everything the tool does now lives in two places.</p>
  <p><a class="link" href="/">unpacking_the_world — what it is</a> · <a class="link" href="/app">Open the decoder</a></p>
</article>`;

function replaceOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first === -1) throw new Error(`prerender: could not find ${label} in the template`);
  if (source.indexOf(needle, first + 1) !== -1) {
    throw new Error(`prerender: ${label} appears more than once in the template`);
  }
  return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

function structuredData(faq) {
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "unpacking_the_world",
      alternateName: "Unpacking the World",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Any",
      url: `${SITE}/`,
      description:
        "Browser-based decoder for JWTs, private keys, certificates, cron expressions, HTTP headers, timestamps, UUIDs and archives. Nothing you paste is uploaded.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description:
          "Free tier for everyday decodes; Pro unlocks certificates, nested chaining, archives and history via an AppSumo lifetime licence.",
      },
    },
    { "@context": "https://schema.org", "@type": "WebSite", name: "unpacking_the_world", url: `${SITE}/` },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "unpacking_the_world",
      url: `${SITE}/`,
      logo: `${SITE}/og-image.png`,
    },
  ];
  if (faq.length) {
    data.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    });
  }
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

/**
 * Rewrites the shared template for one route. `robots` defaults to indexable;
 * pass "noindex" for documents that must not be crawled on their own URL.
 */
function buildDocument(template, { title, description, canonical, body, jsonld = "", robots = "index, follow" }) {
  let html = replaceOnce(template, BODY_PLACEHOLDER, body, "body placeholder");
  html = replaceOnce(html, JSONLD_PLACEHOLDER, jsonld, "json-ld placeholder");
  html = replaceOnce(html, `<title>${LANDING_TITLE}</title>`, `<title>${title}</title>`, "title");
  html = replaceOnce(html, '<meta name="robots" content="index, follow" />', `<meta name="robots" content="${robots}" />`, "robots");
  if (canonical === null) {
    html = replaceOnce(html, `<link rel="canonical" href="${SITE}/" />`, "", "canonical");
    html = replaceOnce(html, `<meta property="og:url" content="${SITE}/" />`, "", "og:url");
  } else {
    html = replaceOnce(html, `<link rel="canonical" href="${SITE}/" />`, `<link rel="canonical" href="${canonical}" />`, "canonical");
    html = replaceOnce(html, `<meta property="og:url" content="${SITE}/" />`, `<meta property="og:url" content="${canonical}" />`, "og:url");
  }
  for (const [label, selector, value] of [
    ["description", 'name="description" content="Decode JWTs, private keys, certificates, cron expressions, headers, timestamps, UUIDs and archives in your browser. Nothing you paste is uploaded — no analytics, no sign-up."', description],
    ["og:title", `property="og:title" content="${LANDING_TITLE}"`, title],
    ["og:description", 'property="og:description" content="A paste-first decoder for JWTs, keys, certificates, cron, headers and archives. Everything runs in your browser. Nothing is uploaded."', description],
    ["twitter:title", `name="twitter:title" content="${LANDING_TITLE}"`, title],
    ["twitter:description", 'name="twitter:description" content="Decode JWTs, keys, certificates, cron, headers and archives entirely in your browser. Nothing is uploaded."', description],
  ]) {
    html = replaceOnce(html, selector, selector.replace(/content="[^"]*"$/, `content="${value}"`), label);
  }
  return html;
}

const server = await createServer({
  root,
  logLevel: "error",
  server: { middlewareMode: true },
  appType: "custom",
});

try {
  const { renderLanding, faqPairs } = await server.ssrLoadModule("/src/entry-server.ts");
  const template = await readFile(`${root}dist/index.html`, "utf8");
  const landing = renderLanding();

  await writeFile(
    `${root}dist/index.html`,
    buildDocument(template, {
      title: LANDING_TITLE,
      description:
        "Decode JWTs, private keys, certificates, cron expressions, headers, timestamps, UUIDs and archives in your browser. Nothing you paste is uploaded — no analytics, no sign-up.",
      canonical: `${SITE}/`,
      body: landing,
      jsonld: structuredData(faqPairs()),
    }),
  );

  await writeFile(
    `${root}dist/app.html`,
    buildDocument(template, {
      title: APP_TITLE,
      description: APP_DESCRIPTION,
      canonical: `${SITE}/app`,
      body: APP_BODY,
    }),
  );

  await writeFile(
    `${root}dist/404.html`,
    buildDocument(template, {
      title: NOT_FOUND_TITLE,
      description: "That page isn’t here. Open the unpacking_the_world decoder or read what the tool does.",
      canonical: null,
      robots: "noindex, follow",
      body: NOT_FOUND_BODY,
    }),
  );

  // The sitemap is generated here so `lastmod` is the real build date and the
  // only URLs listed are the ones whose raw HTML carries a matching canonical.
  await writeFile(
    `${root}dist/sitemap.xml`,
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE}/</loc>
    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>
  </url>
  <url>
    <loc>${SITE}/app</loc>
    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>
  </url>
</urlset>
`,
  );

  console.log(`prerender: landing ${(landing.length / 1024).toFixed(1)} kB of HTML; app.html, 404.html and sitemap.xml written`);
} finally {
  await server.close();
}
