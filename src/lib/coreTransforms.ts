export function normalizeHandle(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30);
}

export function createLegalAcceptanceMetadata(now = new Date()) {
  const acceptedAt = now.toISOString();
  return { terms_accepted_at: acceptedAt, privacy_accepted_at: acceptedAt };
}

export function parseAuthCallbackUrl(url: string) {
  const parameterText = url.includes('#') ? url.split('#')[1] : url.split('?')[1] ?? '';
  const parameters = new URLSearchParams(parameterText);
  const encodedError = parameters.get('error_description') ?? parameters.get('error');
  return {
    error: encodedError ? decodeURIComponent(encodedError.replace(/\+/g, ' ')) : null,
    code: parameters.get('code'),
    accessToken: parameters.get('access_token'),
    refreshToken: parameters.get('refresh_token'),
  };
}

export function parseCheeseDeepLink(url: string) {
  const match = url.match(/^bythewhey:\/\/cheese\/([^/?#]+)/i);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

export function splitCatalogList(value: string) {
  return value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
}

export function catalogSlug(value: string) {
  return value.toLowerCase().trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
