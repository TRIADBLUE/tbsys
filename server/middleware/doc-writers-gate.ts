import type { Request, Response, NextFunction } from "express";

// Doc writers pause — Prompt 05/06/2026-30 (rulebook reorg).
// Set DOC_WRITERS_ENABLED=false on the Railway env to block the POST endpoints
// that push assembled CLAUDE.md (doc-push) and auto-generated docs
// (doc-generator) out to other project repos. Default behavior (env var unset
// or set to anything other than the literal string "false") is unchanged.
// To re-enable: unset the env var on Railway or set it to "true".
export function requireDocWritersEnabled(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  if (process.env.DOC_WRITERS_ENABLED === "false") {
    return res.status(503).json({
      error: "Doc writers paused",
      hint:
        "DOC_WRITERS_ENABLED=false is set on Railway env — paused for rulebook reorg per Prompt 05/06/2026-30. Unset or set to \"true\" on Railway to re-enable.",
    });
  }
  next();
}
