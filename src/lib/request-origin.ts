/**
 * Same-origin check for state-changing POSTs (join/claim CSRF).
 *
 * Prefer Origin when present; otherwise require Referer to match the request URL origin.
 * If both are missing, reject — browsers send Origin (or Referer) on form POSTs;
 * smoke sets Origin explicitly.
 */
export function isAllowedRequestOrigin(request: Request): boolean {
  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(request.url).origin;
  } catch {
    return false;
  }

  const origin = request.headers.get("origin");
  if (origin) {
    return origin === expectedOrigin;
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin === expectedOrigin;
    } catch {
      return false;
    }
  }

  return false;
}
