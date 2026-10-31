import { route } from "@/server/http";
import { ctxFor } from "@/server/ctx";
import { computeAnalytics } from "@/server/services/analytics";

export const dynamic = "force-dynamic";
export const GET = route({ action: "analytics.view" }, async (req, session) => computeAnalytics(await ctxFor(session), { fresh: new URL(req.url).searchParams.get("fresh") === "1" }));
