export function isAuthorized(request: Request, expectedToken: string): boolean {
  if (!expectedToken) return false;

  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${expectedToken}`;
}
