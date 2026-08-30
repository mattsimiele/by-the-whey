import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function pngSize(relativePath) {
  const buffer = fs.readFileSync(path.join(root, relativePath));
  if (buffer.toString('ascii', 1, 4) !== 'PNG') throw new Error(`${relativePath} is not a PNG file`);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

export function collectPreflightFailures() {
  const failures = [];
  const packageJson = JSON.parse(read('package.json'));
  const appJson = JSON.parse(read('app.json'));
  const expo = appJson.expo;

  if (packageJson.version !== expo.version) failures.push(`package.json version ${packageJson.version} does not match app.json ${expo.version}`);
  if (expo.ios?.bundleIdentifier !== 'com.thecurdnerd.bythewhey') failures.push('Unexpected iOS bundle identifier');
  if (expo.android?.package !== 'com.thecurdnerd.bythewhey') failures.push('Unexpected Android package');
  if (!expo.extra?.eas?.projectId) failures.push('Missing EAS project ID');
  if (!expo.ios?.usesAppleSignIn) failures.push('Sign in with Apple entitlement is not enabled');
  if (expo.android?.softwareKeyboardLayoutMode !== 'resize') failures.push('Android keyboard layout mode must remain resize');

  const icon = pngSize('assets/icon.png');
  if (icon.width !== icon.height || icon.width < 1024) failures.push(`App icon must be square and at least 1024px; found ${icon.width}x${icon.height}`);
  const feature = pngSize('store/android/assets/feature-graphic.png');
  if (feature.width !== 1024 || feature.height !== 500) failures.push(`Google feature graphic must be 1024x500; found ${feature.width}x${feature.height}`);

  const filesWithoutLegacyUrls = [
    'src/AuthScreen.tsx', 'src/SafetyCenter.tsx', 'docs/ANDROID_BETA_RELEASE.md',
    'docs/GOOGLE_AUTH_SETUP.md', 'store/android/listing.md',
  ];
  for (const file of filesWithoutLegacyUrls) {
    if (read(file).includes('thecurdnerd.com/by-the-whey')) failures.push(`${file} still contains the retired website path`);
  }

  const auth = read('src/AuthScreen.tsx');
  for (const marker of ['legalAccepted', 'createLegalAcceptanceMetadata', 'TERMS_URL', 'PRIVACY_URL']) {
    if (!auth.includes(marker)) failures.push(`Signup legal acceptance is missing ${marker}`);
  }
  const transforms = read('src/lib/coreTransforms.ts');
  for (const marker of ['terms_accepted_at', 'privacy_accepted_at']) {
    if (!transforms.includes(marker)) failures.push(`Legal acceptance metadata is missing ${marker}`);
  }

  const requiredPages = ['docs/index.html', 'docs/404.html', 'docs/catalog/index.html', 'docs/privacy/index.html', 'docs/terms/index.html', 'docs/guidelines/index.html', 'docs/support/index.html', 'docs/delete-account/index.html', 'docs/manage/index.html'];
  for (const page of requiredPages) {
    if (!fs.existsSync(path.join(root, page))) failures.push(`Missing public release page: ${page}`);
    else if (!read(page).includes('assets/site.js')) failures.push(`${page} is missing the shared website navigation`);
  }

  const siteShell = read('docs/assets/site.js');
  for (const marker of ['Why By the Whey', 'Catalog Studio', 'Delete Account', 'renderHeader()', 'renderFooter()']) {
    if (!siteShell.includes(marker)) failures.push(`Shared website navigation is missing ${marker}`);
  }

  const catalogStudio = `${read('docs/manage/index.html')}\n${read('docs/manage/manage.js')}`;
  for (const marker of ['data-photo-input', 'data-upload-photo', 'uploadCatalogPhoto', 'removeCatalogPhoto']) {
    if (!catalogStudio.includes(marker)) failures.push(`Catalog Studio photo management is missing ${marker}`);
  }

  const generatedCatalog = JSON.parse(read('docs/cheese/generated.json'));
  if (!generatedCatalog.count || generatedCatalog.count !== generatedCatalog.slugs?.length) failures.push('Generated public cheese pages are missing or inconsistent');
  for (const slug of generatedCatalog.slugs ?? []) {
    const page = path.join('docs/cheese', slug, 'index.html');
    if (!fs.existsSync(path.join(root, page))) failures.push(`Missing generated cheese page: ${slug}`);
    else if (!read(page).includes('assets/site.js')) failures.push(`Generated cheese page is missing the shared website navigation: ${slug}`);
  }

  return failures;
}

export function runPreflight() {
  const failures = collectPreflightFailures();
  if (failures.length) {
    console.error('Release preflight failed:');
    failures.forEach((failure) => console.error(`- ${failure}`));
    return 1;
  }
  console.log('Release preflight passed: versions, identifiers, artwork dimensions, legal links, and required public pages are consistent.');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = runPreflight();
}
