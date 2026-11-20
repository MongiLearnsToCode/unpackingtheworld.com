import { CronExpressionParser } from "cron-parser";
import { toString as describeCron } from "cronstrue";
import type { Flag, Unpacker } from "./types.ts";

const FIELD = /^[\d*/,\-#?A-Za-z]+$/;

function parts(input: string): string[] {
  return input.trim().split(/\s+/);
}

function scoreExpression(input: string): number {
  const fields = parts(input);
  if (fields.length !== 5 && fields.length !== 6) return 0;
  if (!fields.every((field) => FIELD.test(field) && field.length <= 40)) return 0;
  if (!fields.some((field) => /\d|\*|\?/.test(field))) return 0;
  return fields.length === 6 ? 0.85 : 0.9;
}

export const cron: Unpacker = {
  id: "cron",
  label: "Cron",
  score: scoreExpression,
  unpack(input) {
    const expression = parts(input).join(" ");
    const fields = parts(expression);
    const flags: Flag[] = [];

    let explanation: string;
    try {
      explanation = describeCron(expression, { verbose: true, throwExceptionOnParseError: true });
    } catch {
      return null;
    }

    const runs: { local: string; utc: string }[] = [];
    try {
      const iterator = CronExpressionParser.parse(expression, { currentDate: new Date() });
      for (let i = 0; i < 7; i++) {
        const date = iterator.next().toDate();
        runs.push({ local: date.toLocaleString(), utc: date.toISOString() });
      }
    } catch {
      flags.push({ severity: "warn" as const, text: "Expression is valid to describe but not to calculate next runs" });
    }

    flags.unshift({ severity: "info" as const, text: fields.length === 6 ? "6-field expression (seconds first)" : "5-field expression" });
    const dayOfMonth = fields[fields.length === 6 ? 3 : 2];
    const dayOfWeek = fields[fields.length === 6 ? 5 : 4];
    if (!/^[*?]$/.test(dayOfMonth) && !/^[*?]$/.test(dayOfWeek)) {
      flags.push({ severity: "warn" as const, text: "Day-of-month and day-of-week are both set; many crons use OR semantics here" });
    }

    return {
      id: "cron",
      label: "Cron",
      headline: explanation,
      flags,
      fields: [
        { label: "expression", value: expression },
        { label: "explanation", value: explanation },
      ],
      sections: runs.length ? [{ title: "Next runs", json: runs }] : [],
    };
  },
};
