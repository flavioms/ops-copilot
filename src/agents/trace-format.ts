import type { TraceEvent } from "./strategy.schema.ts";

const LABEL_WIDTH = 14;

const label = (name: string) => `[${name}]`.padEnd(LABEL_WIDTH);

/** Puts the label on the first line and aligns continuation lines under the text. */
function block(name: string, text: string): string {
  const [first = "", ...rest] = text.split("\n");
  return [label(name) + first, ...rest.map((line) => " ".repeat(LABEL_WIDTH) + line)].join("\n");
}

function formatEvent(event: TraceEvent): string {
  switch (event.type) {
    case "thought":
    case "critique":
    case "answer":
      return block(event.type, event.text);
    case "action":
      return block("action", `${event.tool}(${JSON.stringify(event.args)})`);
    case "observation":
      return block("observation", `${event.tool} -> ${event.content}`);
    case "plan":
      return block("plan", event.steps.map((step, i) => `${i + 1}. ${step}`).join("\n"));
  }
}

/** Pure, deterministic rendering of a trace; one labelled block per event. */
export function formatTrace(trace: TraceEvent[]): string {
  return trace.map(formatEvent).join("\n");
}
