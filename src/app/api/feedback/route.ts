import { NextResponse } from "next/server";
import { z } from "zod";

import { addFeedback } from "@/lib/store";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 10_000;

const feedbackSchema = z.object({
  message: z
    .string()
    .trim()
    .min(5, "Tell us a little more (at least 5 characters)")
    .max(1000, "Feedback must be 1000 characters or fewer"),
  email: z.email("Enter a valid email").optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON" }, { status: 400 });
  }

  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid feedback",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.map(String).join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const result = await addFeedback(parsed.data, clientIp(request));
  if (!result.ok) {
    return NextResponse.json(
      {
        error: "You just sent feedback — give it a couple of minutes.",
        retryAfterSec: result.retryAfterSec,
      },
      { status: 429, headers: { "Retry-After": String(result.retryAfterSec) } },
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

/** Same best-effort client IP as api/reports — deterrent, not a boundary. */
function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? "local";
}
