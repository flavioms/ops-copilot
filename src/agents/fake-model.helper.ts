import { BaseChatModel, type BindToolsInput } from "@langchain/core/language_models/chat_models";
import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import type { ChatResult } from "@langchain/core/outputs";
import { RunnableLambda, type Runnable } from "@langchain/core/runnables";
import type { z } from "zod";

/**
 * Scripted chat model for offline tests. Replies are consumed in order; once the queue is
 * exhausted the last reply repeats when `repeatLast` is set, otherwise it throws.
 * Structured output is a JSON reply parsed through the requested schema, so those calls
 * go through the model and are counted like real ones.
 */
export class FakeChatModel extends BaseChatModel {
  readonly received: BaseMessage[][] = [];
  private readonly replies: AIMessage[];
  private readonly repeatLast: boolean;

  constructor(replies: Array<AIMessage | string>, options: { repeatLast?: boolean } = {}) {
    super({});
    this.replies = replies.map((r) => (typeof r === "string" ? new AIMessage(r) : r));
    this.repeatLast = options.repeatLast ?? false;
  }

  _llmType() {
    return "fake";
  }

  override bindTools(_tools: BindToolsInput[]) {
    return this;
  }

  override withStructuredOutput<T>(schema: z.ZodType<T>): Runnable<never, T> {
    // The parsed value is typed by the caller's schema; Runnable input is the prompt.
    return this.pipe(new RunnableLambda({ func: (msg: AIMessage) => schema.parse(JSON.parse(String(msg.content))) })) as never;
  }

  async _generate(messages: BaseMessage[]): Promise<ChatResult> {
    this.received.push(messages);
    const next = this.replies.length > 1 || !this.repeatLast ? this.replies.shift() : this.replies[0];
    if (!next) throw new Error("FakeChatModel: no more scripted replies");
    // Fresh message per call: a repeated id would be deduplicated by the graph's message reducer.
    const message = new AIMessage({ content: next.content, tool_calls: next.tool_calls });
    return { generations: [{ message, text: String(next.content) }] };
  }
}

export const toolCall = (name: string, args: Record<string, unknown>, id = `call-${name}`) =>
  new AIMessage({ content: "", tool_calls: [{ name, args, id, type: "tool_call" }] });
