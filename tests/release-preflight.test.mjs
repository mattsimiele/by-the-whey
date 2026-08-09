import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { collectPreflightFailures } from '../scripts/release-preflight.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('release preflight has no static failures', () => {
  assert.deepEqual(collectPreflightFailures(), []);
});

test('account creation requires and records legal acceptance', () => {
  const auth = read('src/AuthScreen.tsx');
  const transforms = read('src/lib/coreTransforms.ts');
  assert.match(auth, /accessibilityRole="checkbox"/);
  assert.match(auth, /if \(!requireLegalAcceptance\(\)\) return;/);
  assert.match(auth, /createLegalAcceptanceMetadata/);
  assert.match(transforms, /terms_accepted_at/);
  assert.match(transforms, /privacy_accepted_at/);
});

test('mobile legal URLs use the dedicated public pages', () => {
  const config = read('src/config.ts');
  assert.match(config, /https:\/\/bythe-whey\.com/);
  assert.match(config, /\/privacy\//);
  assert.match(config, /\/terms\//);
  assert.doesNotMatch(config, /thecurdnerd\.com\/by-the-whey/);
});
