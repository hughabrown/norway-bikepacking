export function isAuthorized(request: Request, expectedToken: string): boolean {
  if (!expectedToken) return false;

  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${expectedToken}`;
}

export function isPostCallWebhookAuthorized(
  request: Request,
  expectedToken: string,
): boolean {
  if (!expectedToken) return false;

  return (
    isAuthorized(request, expectedToken) ||
    request.headers.get("x-fjordpilot-tool-token") === expectedToken
  );
}
