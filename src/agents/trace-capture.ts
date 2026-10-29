import { AIMessage, ToolMessage, type BaseMessage } from "@langchain/core/messages";
import type { TraceEvent } from "./strategy.schema.ts";

export function textOf(content: BaseMessage["content"]): string {
  if (typeof content === "string") return content;
  return content.map((part) => (part.type === "text" ? part.text : "")).join("");
}

/** Converts a LangChain message list into typed trace events. */
export function messagesToTrace(messages: BaseMessage[]): TraceEvent[] {
  const trace: TraceEvent[] = [];
  const toolNames = new Map<string, string>();
  messages.forEach((message, index) => {
    if (AIMessage.isInstance(message)) {
      const text = textOf(message.content).trim();
      const calls = message.tool_calls ?? [];
      if (calls.length === 0) {
        if (text) trace.push({ type: index === messages.length - 1 ? "answer" : "thought", text });
        return;
      }
      if (text) trace.push({ type: "thought", text });
      for (const call of calls) {
        if (call.id) toolNames.set(call.id, call.name);
        trace.push({ type: "action", tool: call.name, args: call.args });
      }
    } else if (ToolMessage.isInstance(message)) {
      const tool = message.name ?? toolNames.get(message.tool_call_id) ?? "unknown";
      trace.push({ type: "observation", tool, content: textOf(message.content) });
    }
  });
  return trace;
}

/** Text of the last assistant message that has any, or "". */
export function lastText(messages: BaseMessage[]): string {
  for (const message of [...messages].reverse()) {
    if (AIMessage.isInstance(message) && !(message.tool_calls?.length)) {
      const text = textOf(message.content).trim();
      if (text) return text;
    }
  }
  return "";
}
