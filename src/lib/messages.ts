export interface EmptyMessage {
  headline: string;
  hint: string;
}

export function noMatchMessage(overrideLabel: string | null): EmptyMessage {
  if (overrideLabel) {
    return {
      headline: `Can’t unpack this as ${overrideLabel}.`,
      hint: "Pick a different format above, or clear the override to auto-detect.",
    };
  }
  return {
    headline: "No known format matched.",
    hint: "Pick a format above to try it anyway.",
  };
}
