import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const encode = (value: Uint8Array | string) => {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
};

const pemBytes = (pem: string) =>
  Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')), (character) => character.charCodeAt(0));

Deno.serve(async (request) => {
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return new Response('Unauthorized', { status: 401 });
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return new Response('Unauthorized', { status: 401 });

    const { authorizationCode } = await request.json();
    if (!authorizationCode) return new Response('Apple authorization code is required', { status: 400 });

    const teamId = Deno.env.get('APPLE_TEAM_ID')!;
    const keyId = Deno.env.get('APPLE_KEY_ID')!;
    const clientId = Deno.env.get('APPLE_CLIENT_ID')!;
    const privateKey = Deno.env.get('APPLE_PRIVATE_KEY')!.replaceAll('\\n', '\n');
    const now = Math.floor(Date.now() / 1000);
    const header = encode(JSON.stringify({ alg: 'ES256', kid: keyId }));
    const payload = encode(JSON.stringify({ iss: teamId, iat: now, exp: now + 300, aud: 'https://appleid.apple.com', sub: clientId }));
    const key = await crypto.subtle.importKey('pkcs8', pemBytes(privateKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${header}.${payload}`)));
    const clientSecret = `${header}.${payload}.${encode(signature)}`;

    const tokenResponse = await fetch('https://appleid.apple.com/auth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: authorizationCode,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.refresh_token) {
      return Response.json({ error: 'Apple token exchange failed', detail: tokenData }, { status: 502 });
    }

    const revokeResponse = await fetch('https://appleid.apple.com/auth/revoke', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        token: tokenData.refresh_token,
        token_type_hint: 'refresh_token',
      }),
    });
    if (!revokeResponse.ok) return new Response('Apple token revocation failed', { status: 502 });
    return Response.json({ revoked: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unexpected error' }, { status: 500 });
  }
});
