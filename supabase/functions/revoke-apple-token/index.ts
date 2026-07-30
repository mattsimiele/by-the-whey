import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { importPKCS8, SignJWT } from 'https://deno.land/x/jose@v5.9.6/index.ts';

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

    const teamId = Deno.env.get('APPLE_TEAM_ID');
    const keyId = Deno.env.get('APPLE_KEY_ID');
    const clientId = Deno.env.get('APPLE_CLIENT_ID');
    const privateKey = Deno.env.get('APPLE_PRIVATE_KEY')?.replaceAll('\\n', '\n');
    if (!teamId || !keyId || !clientId || !privateKey) {
      return Response.json({ error: 'Apple revocation is not configured' }, { status: 500 });
    }

    const now = Math.floor(Date.now() / 1000);
    const key = await importPKCS8(privateKey, 'ES256');
    const clientSecret = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: keyId })
      .setIssuer(teamId)
      .setIssuedAt(now)
      .setExpirationTime(now + 300)
      .setAudience('https://appleid.apple.com')
      .setSubject(clientId)
      .sign(key);

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
      console.error('Apple token exchange failed', {
        status: tokenResponse.status,
        error: tokenData.error,
        description: tokenData.error_description,
      });
      return Response.json({
        error: 'Apple token exchange failed',
        detail: tokenData.error_description ?? tokenData.error ?? `Apple returned status ${tokenResponse.status}`,
      }, { status: 502 });
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
    if (!revokeResponse.ok) {
      console.error('Apple token revocation failed', { status: revokeResponse.status });
      return Response.json({
        error: 'Apple token revocation failed',
        detail: `Apple returned status ${revokeResponse.status}`,
      }, { status: 502 });
    }
    return Response.json({ revoked: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unexpected error' }, { status: 500 });
  }
});
