import "server-only";

export const fallbackUserId = "local-test-user";

export function getRequestUserId(request: Request) {
  const headerId = request.headers.get("x-magi-user-id")?.trim();
  if (headerId && isSafeUserId(headerId)) return headerId;
  return fallbackUserId;
}

function isSafeUserId(value: string) {
  return /^[a-zA-Z0-9:_-]{3,96}$/.test(value);
}
