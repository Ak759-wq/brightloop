import { z } from "zod";
export const dynamic = "force-dynamic";
import { route, body } from "@/server/http";
import { ctxFor } from "@/server/ctx";
import { ask } from "@/server/services/assistant";

const Schema = z.object({
  question: z.string().trim().min(2).max(500),
  // Optional bring-your-own model key. Used only for this request; never persisted or logged.
  llm: z.object({
    provider: z.enum(["openai", "gemini", "openrouter"]),
    apiKey: z.string().trim().min(10).max(300),
    model: z.string().trim().max(100).optional(),
  }).optional(),
});

export const POST = route({ action: "assistant.ask" }, async (req, session) => {
  const { question, llm } = Schema.parse(await body(req));
  return ask(await ctxFor(session), question, llm ?? null);
});
