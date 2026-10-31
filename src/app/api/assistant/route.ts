import { z } from "zod";
export const dynamic = "force-dynamic";
import { route, body } from "@/server/http";
import { ctxFor } from "@/server/ctx";
import { ask } from "@/server/services/assistant";

export const POST = route({ action: "assistant.ask" }, async (req, session) => {
  const { question } = z.object({ question: z.string().trim().min(2).max(500) }).parse(await body(req));
  return ask(await ctxFor(session), question);
});
