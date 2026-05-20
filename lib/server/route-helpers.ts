import { NextResponse, type NextRequest } from "next/server";

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

type RouteHandler = (
  request: NextRequest,
  context?: { params: Promise<Record<string, string>> },
) => Promise<NextResponse>;

export function withErrorHandler(handler: RouteHandler): RouteHandler {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      console.error(`[API Error] ${request.method} ${request.url}:`, err);
      return jsonError(message, 500);
    }
  };
}
