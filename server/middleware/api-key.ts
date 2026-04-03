import type { Request, Response, NextFunction } from "express";

export function requireApiKey(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const apiKey = req.headers["x-api-key"] as string | undefined;
  const expectedKey = process.env.CONSOLE_API_KEY;

  if (!expectedKey) {
    return res.status(500).json({
      error: "Server configuration error",
      message: "API key authentication is not configured",
    });
  }

  if (!apiKey) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Missing x-api-key header",
    });
  }

  if (apiKey !== expectedKey) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid API key",
    });
  }

  next();
}
