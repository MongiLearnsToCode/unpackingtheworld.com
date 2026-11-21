<script lang="ts">
  import { onMount } from "svelte";
  import { FEATURES } from "../entitlements.ts";
  import { APPSUMO_PRICE_USD } from "../pricing.ts";
  import { LEGAL } from "../legal.ts";
  import { sampleJwt } from "../samples.ts";
  import { unpack, unpackers } from "../unpackers/index.ts";

  // The demo sample is generated from the current clock, so it must not be part
  // of the prerendered markup: a build-time token would already be expired by
  // the time anyone reads it. The static fallback below is what crawlers see.
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });
  const demo = $derived(hydrated ? unpack("jwt", sampleJwt()) : null);
  const freeFeatures = unpackers.filter((unpacker) => FEATURES[unpacker.id as keyof typeof FEATURES]?.tier === "free");
  const proFeatures = unpackers.filter((unpacker) => FEATURES[unpacker.id as keyof typeof FEATURES]?.tier === "pro");
  const faq = LEGAL.faq.sections;
</script>

<div class="landing">
  <header class="landing-nav">
    <a class="brand" href="/"><span class="logo" aria-hidden="true">📦</span> unpacking_the_world</a>
    <nav aria-label="Landing sections">
      <a href="#formats">Formats</a>
      <a href="#privacy-first">Privacy</a>
      <a href="#pricing">Pricing</a>
      <a href="#faq">FAQ</a>
    </nav>
    <a class="btn solid" href="/app">Open the tool</a>
  </header>

  <main>
    <section class="hero">
      <div class="hero-copy">
        <h1>Paste anything.<br />See everything.<br /><span class="muted">Upload nothing.</span></h1>
        <p class="lede">unpacking_the_world detects what you pasted — JWTs, private keys, certificates, cron expressions, headers, timestamps, UUIDs and archives — and shows you what matters, entirely in your browser.</p>
        <div class="hero-actions">
          <a class="btn solid" href="/app">Open the tool</a>
          <a class="btn" href="#formats">See the formats</a>
        </div>
        <p class="micro muted">No sign-up. No analytics. Nothing you paste leaves this tab.</p>
      </div>

      <div class="hero-demo" aria-label="Example decoded JWT">
        <div class="demo-bar"><span class="dot red"></span><span class="dot amber"></span><span class="dot green"></span><span class="demo-url">unpackingtheworld.com/app</span></div>
        <div class="demo-body">
          <span class="detected-chip">Detected: JWT</span>
          {#if demo}
            <div class="headline" data-tone={demo.headline && demo.flags.find((f) => f.text === demo.headline)?.severity}>{demo.headline}</div>
            <ul class="flags">
              {#each demo.flags.slice(0, 3) as flag (flag.text)}
                <li data-tone={flag.severity}><span class="dot" aria-hidden="true"></span>{flag.text}</li>
              {/each}
            </ul>
            <dl class="fields">
              {#each demo.fields.slice(0, 3) as field (field.label)}
                <dt>{field.label}</dt><dd class="mono">{field.value.length > 34 ? `${field.value.slice(0, 34)}…` : field.value}</dd>
              {/each}
            </dl>
          {:else}
            <div class="headline" data-tone="good">Valid token, decoded in this tab</div>
            <ul class="flags">
              <li data-tone="good"><span class="dot" aria-hidden="true"></span>Signature algorithm: HS256</li>
              <li data-tone="good"><span class="dot" aria-hidden="true"></span>Claims readable without the key</li>
              <li data-tone="info"><span class="dot" aria-hidden="true"></span>Nothing sent over the network</li>
            </ul>
            <dl class="fields">
              <dt>Issuer</dt><dd class="mono">https://auth.example.com</dd>
              <dt>Subject</dt><dd class="mono">user_8f3a21</dd>
              <dt>Audience</dt><dd class="mono">api.example.com</dd>
            </dl>
          {/if}
          <div class="demo-foot mono">header · payload · signature</div>
        </div>
      </div>
    </section>

    <section class="proof" aria-label="Product facts">
      <div><strong>0</strong><span>bytes of your input uploaded</span></div>
      <div><strong>{unpackers.length}</strong><span>formats detected automatically</span></div>
      <div><strong>0</strong><span>trackers, ads or third-party scripts</span></div>
      <div><strong>7 days</strong><span>offline Pro grace period</span></div>
    </section>

    <section class="section landing-split" id="privacy-first">
      <div>
        <h2>Privacy is the feature, not a settings page.</h2>
        <p class="muted">A production token or private key is the last thing you should paste into an unfamiliar website. Here, decoding happens in the tab you are looking at. There is no submit button because there is nowhere to submit to.</p>
        <a class="link" href="/app">Try it with a sample</a>
      </div>
      <ul class="check-list">
        <li><span aria-hidden="true">✓</span> No network request contains pasted input</li>
        <li><span aria-hidden="true">✓</span> Strict CSP; fonts and code served from this site only</li>
        <li><span aria-hidden="true">✓</span> Share links carry input in the URL fragment, never to a server</li>
        <li><span aria-hidden="true">✓</span> Keys and certificates are never printed back</li>
        <li><span aria-hidden="true">✓</span> Archives are listed locally; nothing is executed</li>
      </ul>
    </section>

    <section class="section" id="formats">
      <h2>One paste box. Eleven formats.</h2>
      <p class="muted section-intro">Detection ranks the best match first; everything else stays one click away. You can always force a format.</p>
      <div class="format-grid">
        {#each unpackers as unpacker (unpacker.id)}
          <div class="format">
            <div class="format-head">
              <strong>{FEATURES[unpacker.id as keyof typeof FEATURES]?.name ?? unpacker.label}</strong>
              {#if FEATURES[unpacker.id as keyof typeof FEATURES]?.tier === "pro"}<span class="pro-mark">Pro</span>{/if}
            </div>
            <p class="muted small">{FEATURES[unpacker.id as keyof typeof FEATURES]?.description ?? unpacker.label}</p>
          </div>
        {/each}
      </div>
    </section>

    <section class="section landing-split landing-reverse" id="pricing">
      <div>
        <h2>Pricing</h2>
        <p class="muted section-intro">Free for the everyday decodes. Pro covers the security-focused and bulk tools. One AppSumo lifetime licence unlocks everything on this browser — no subscription, no account.</p>
        <p class="micro muted">Suggested launch price: ${APPSUMO_PRICE_USD} once. Redeeming here stores Pro locally with a seven-day offline grace period.</p>
      </div>
      <div class="plan-list">
        <div class="plan">
          <h3>Free</h3>
          <p class="plan-price"><strong>$0</strong><span>forever · no account</span></p>
          <p class="muted small">The formats developers reach for most.</p>
          <ul>
            {#each freeFeatures as unpacker (unpacker.id)}<li>{unpacker.label}</li>{/each}
          </ul>
          <a class="btn" href="/app">Start free</a>
        </div>
        <div class="plan featured">
          <h3>Pro <span class="pro-mark">Lifetime</span></h3>
          <p class="plan-price"><strong>${APPSUMO_PRICE_USD}</strong><span>one-time · via AppSumo</span></p>
          <p class="muted small">Everything in Free, plus:</p>
          <ul>
            {#each proFeatures as unpacker (unpacker.id)}<li>{unpacker.label}</li>{/each}
            <li>Local history</li>
          </ul>
          <a class="btn solid" href="/app#redeem">Redeem AppSumo code</a>
        </div>
      </div>
    </section>

    <section class="section story">
      <h2>Why this exists</h2>
      <p>Developers paste sensitive strings into decoder sites every day. Most of those sites are single-purpose, cluttered, or send the input somewhere. unpacking_the_world is the opposite: one page, an honest flagged result, and a promise it can keep — nothing you paste leaves your browser.</p>
    </section>

    <section class="section" id="faq">
      <h2>Questions</h2>
      <div class="faq-list">
        {#each faq as section (section.title)}
          <details>
            <summary>{section.title}</summary>
            {#each section.paragraphs as paragraph}<p>{paragraph}</p>{/each}
          </details>
        {/each}
      </div>
    </section>

    <section class="final-cta">
      <h2>Give a token to the tool.<br /><span class="muted">Keep the secret to yourself.</span></h2>
      <a class="btn solid" href="/app">Open the tool</a>
    </section>
  </main>

  <footer class="landing-footer">
    <span class="muted">Runs entirely in your browser. Nothing is uploaded.</span>
    <span class="muted">
      <a href="/app#privacy">Privacy</a> · <a href="/app#terms">Terms</a> · <a href="/app#refunds">Refunds</a> · <a href="/app#faq">FAQ</a>
    </span>
  </footer>
</div>
