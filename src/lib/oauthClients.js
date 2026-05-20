const MAX_NAME = 200;
const MAX_URIS = 10;

export function normalizeRedirectUri(uri) {
  try {
    const u = new URL(uri);
    u.hostname = u.hostname.toLowerCase();
    let s = u.toString();
    if (s.endsWith('/') && u.pathname !== '/') s = s.slice(0, -1);
    return s;
  } catch {
    return uri;
  }
}

export function redirectUriAllowed(candidate, allowed) {
  const norm = normalizeRedirectUri(candidate);
  return allowed.some((r) => normalizeRedirectUri(r) === norm);
}

function uriOk(raw) {
  let u;
  try { u = new URL(raw); } catch { return false; }
  if (u.hash) return false;
  if (u.protocol === 'https:') return true;
  if (u.protocol === 'http:') {
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '::1';
  }
  return false;
}

export function validateRegistrationRequest(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'invalid_client_metadata', message: 'body required' };
  }
  const name = body.client_name;
  if (typeof name !== 'string' || name.length === 0 || name.length > MAX_NAME) {
    return { ok: false, error: 'invalid_client_metadata', message: 'client_name required (<=200 chars)' };
  }
  const uris = body.redirect_uris;
  if (!Array.isArray(uris) || uris.length === 0 || uris.length > MAX_URIS) {
    return { ok: false, error: 'invalid_redirect_uri', message: 'redirect_uris must be a non-empty array' };
  }
  for (const u of uris) {
    if (!uriOk(u)) return { ok: false, error: 'invalid_redirect_uri', message: `bad redirect_uri: ${u}` };
  }
  const method = body.token_endpoint_auth_method ?? 'client_secret_post';
  if (method !== 'client_secret_post' && method !== 'none') {
    return { ok: false, error: 'invalid_client_metadata', message: 'unsupported token_endpoint_auth_method' };
  }
  return {
    ok: true,
    value: {
      name,
      redirectUris: uris.map(normalizeRedirectUri),
      tokenEndpointAuthMethod: method,
    },
  };
}
