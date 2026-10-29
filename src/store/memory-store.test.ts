import { MemoryStore } from "./memory-store.ts";
import { runStoreContract } from "./store.contract.ts";

runStoreContract("memory", async () => new MemoryStore());
