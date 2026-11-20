export interface LegalSection {
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

export const LEGAL: Record<string, { title: string; sections: LegalSection[] }> = {
  privacy: {
    title: "Privacy",
    sections: [
      {
        title: "Nothing you paste leaves your browser",
        paragraphs: [
          "Decoding happens entirely in this tab. Pasted text and dropped files are never sent to a server, logged, analysed or stored by us. There is no analytics, no tracking script, no advertising and no third-party font or image request.",
        ],
      },
      {
        title: "What is stored on your device",
        paragraphs: [
          "Your theme choice is saved locally. Recent inputs are saved only if you turn on the opt-in history setting; you can clear them at any time. Share links put the input in the URL #fragment, which browsers never send to a server — anyone you send the link to can read the input.",
        ],
      },
      {
        title: "Licensing data",
        paragraphs: [
          "For AppSumo licence holders the server stores only the licence key, its status and tier, timestamps and a log of licence events. AppSumo does not send customer email addresses, and no pasted input is ever included in a licence record.",
        ],
      },
    ],
  },
  terms: {
    title: "Terms",
    sections: [
      {
        title: "Use of the tool",
        paragraphs: [
          "The tool is provided as-is for decoding data you are allowed to inspect. No cryptographic verification is performed: JWT signatures are displayed but never checked, and certificate data is parsed for information only.",
        ],
      },
      {
        title: "Availability",
        paragraphs: [
          "We aim to keep the service available, but the free tier is offered without a guarantee of uptime. AppSumo licence holders receive Pro access for as long as the licence is active and the service operates.",
        ],
      },
      {
        title: "Your data",
        paragraphs: [
          "You remain responsible for anything you paste or drop. Because everything is local, we cannot recover it for you if you close the tab without a share link.",
        ],
      },
    ],
  },
  refunds: {
    title: "Refunds",
    sections: [
      {
        title: "AppSumo purchases",
        paragraphs: [
          "Purchases, refunds and licence changes are handled by AppSumo under its own refund policy and within its refund window. Please contact AppSumo support for a refund request.",
        ],
      },
      {
        title: "What happens after a refund",
        paragraphs: [
          "When AppSumo sends a deactivation event, the licence is marked invalid and Pro access is removed on the next online status check. Reactivation is supported if the licence becomes active again.",
        ],
      },
    ],
  },
  faq: {
    title: "FAQ",
    sections: [
      {
        title: "Is my token or private key uploaded?",
        paragraphs: ["No. All decoding runs in your browser. There is no upload endpoint for input data."],
      },
      {
        title: "Why does it say the signature is not verified?",
        paragraphs: ["v1 decodes and displays; it never performs cryptographic verification. Treat the contents as untrusted."],
      },
      {
        title: "What is Pro?",
        paragraphs: ["Pro adds certificates, nested unpacking, cron, User-Agent parsing, header/cookie audits, the archive peeker, local history and offline install. Free features stay free."],
      },
      {
        title: "Does it work offline?",
        paragraphs: ["The page is cached for offline use. Pro access is verified locally and re-checked online about once a day, with a seven-day offline grace period."],
      },
      {
        title: "Which archives are supported?",
        paragraphs: ["Zip (central-directory listing), tar and tar.gz. RAR, 7z, xz and zstd are not supported in v1."],
      },
    ],
  },
};
