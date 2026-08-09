import assert from 'node:assert/strict';
import test from 'node:test';
import {
  catalogSlug,
  createLegalAcceptanceMetadata,
  normalizeHandle,
  parseAuthCallbackUrl,
  splitCatalogList,
} from '../src/lib/coreTransforms.ts';

test('normalizes handles to the database-safe format', () => {
  assert.equal(normalizeHandle(' Curd.Nerd-42! '), 'curdnerd42');
  assert.equal(normalizeHandle('A'.repeat(40)).length, 30);
});

test('records matching ISO timestamps for both legal documents', () => {
  const metadata = createLegalAcceptanceMetadata(new Date('2026-08-09T12:30:00.000Z'));
  assert.deepEqual(metadata, {
    terms_accepted_at: '2026-08-09T12:30:00.000Z',
    privacy_accepted_at: '2026-08-09T12:30:00.000Z',
  });
});

test('parses OAuth code, token, and readable error callback forms', () => {
  assert.equal(parseAuthCallbackUrl('bythewhey://auth/callback?code=abc').code, 'abc');
  assert.deepEqual(parseAuthCallbackUrl('bythewhey://auth/callback#access_token=a&refresh_token=r'), {
    error: null, code: null, accessToken: 'a', refreshToken: 'r',
  });
  assert.equal(parseAuthCallbackUrl('bythewhey://auth/callback?error_description=Access+denied').error, 'Access denied');
});

test('normalizes catalog lists and slugs', () => {
  assert.deepEqual(splitCatalogList('brothy, toasted nuts\ncaramelized onion'), ['brothy', 'toasted nuts', 'caramelized onion']);
  assert.equal(catalogSlug('Tête de Moine'), 'tete-de-moine');
});

