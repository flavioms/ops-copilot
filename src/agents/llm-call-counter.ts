import { BaseCallbackHandler } from "@langchain/core/callbacks/base";

/** Counts every chat-model invocation, including those made inside sub-runs. */
export class LlmCallCounter extends BaseCallbackHandler {
  name = "llm_call_counter";
  count = 0;

  override handleChatModelStart(): void {
    this.count += 1;
  }

  reset(): void {
    this.count = 0;
  }
}
