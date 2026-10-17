/**
 * REST client. All calls go to same-origin `/api/v1/*`, which Next rewrites to the NestJS API,
 * so the httpOnly auth cookie is first-party. Unwraps the API's `{ success, data | error }` envelope.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Envelope<T> =
  | { success: true; data: T }
  | { success: false; error: { statusCode: number; code: string; message: string; details?: unknown } };

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      credentials: "include",
      ...rest,
      headers: { ...(json !== undefined && { "Content-Type": "application/json" }), ...headers },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Can't reach the server. Check your connection and try again.");
  }

  let body: Envelope<T> | null = null;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    // non-JSON response (e.g. proxy error page)
  }

  if (!res.ok || !body || !body.success) {
    const err = body && !body.success ? body.error : undefined;
    throw new ApiError(
      res.status,
      err?.code ?? "UNKNOWN_ERROR",
      err?.message ?? (res.status >= 500 ? "Server error, please try again." : "Request failed"),
      err?.details,
    );
  }
  return body.data;
}

/** Human-readable message for toasts / inline errors */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "VALIDATION_ERROR" && Array.isArray(error.details)) {
      return (error.details as string[]).join(". ");
    }
    return error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong";
}
