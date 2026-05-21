import { NextResponse } from "next/server";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function notFound(entity = "Resource") {
  return jsonError(`${entity} not found`, 404);
}

export async function parseBody<T>(request: Request): Promise<T> {
  return request.json() as Promise<T>;
}

// Generic so a handler's existing signature (Request vs NextRequest, narrow
// param types like `{ id: string }`) is preserved. Without the generic the
// wrapper would force every route to widen its param type to
// Record<string, string>, which fights Next's typed `await params` pattern.
export function withErrorHandler<H extends (...args: never[]) => Promise<NextResponse>>(
  handler: H,
): H {
  return (async (...args: never[]) => {
    try {
      return await handler(...args);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      const req = args[0] as Request | undefined;
      console.error(`[API Error] ${req?.method ?? "?"} ${req?.url ?? "?"}:`, err);
      return jsonError(message, 500);
    }
  }) as H;
}
