import { afterEach, describe, expect, it, vi } from "vitest";
import { llmPickTool, toolsFor } from "@/server/services/assistant";

const tools = toolsFor("admin");
afterEach(() => vi.unstubAllGlobals());

describe("assistant bring-your-own AI key", () => {
  it("uses the user's OpenAI key as a Bearer token and accepts a whitelisted tool", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "mrr" } }] })));
    vi.stubGlobal("fetch", f);
    const r = await llmPickTool("what is our mrr", tools, { provider: "openai", apiKey: "sk-test-1234567890" });
    expect(r.tool).toBe("mrr");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("api.openai.com");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test-1234567890");
  });

  it("sends a Gemini key in a header, never in the URL", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "overdue_invoices\n" }] } }] })));
    vi.stubGlobal("fetch", f);
    const r = await llmPickTool("overdue?", tools, { provider: "gemini", apiKey: "AIza-test-123456" });
    expect(r.tool).toBe("overdue_invoices");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain("AIza");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("AIza-test-123456");
  });

  it("rejects a tool outside the role's whitelist (customer cannot get mrr)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "mrr" } }] }))));
    const r = await llmPickTool("mrr", toolsFor("customer"), { provider: "openrouter", apiKey: "or-test-123456" });
    expect(r.tool).toBeNull();
  });

  it("reports a bad key without throwing, so the deterministic parser takes over", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    const r = await llmPickTool("mrr", tools, { provider: "openai", apiKey: "sk-bad-1234567890" });
    expect(r).toEqual({ tool: null, error: "OpenAI returned 401" });
  });

  it("does nothing when no key is available", async () => {
    expect(await llmPickTool("mrr", tools, null)).toEqual({ tool: null });
  });
});
