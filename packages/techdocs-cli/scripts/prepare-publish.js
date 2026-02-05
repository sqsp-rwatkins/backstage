#!/usr/bin/env node
/*
 * Copyright 2025 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Resolves workspace:^ (and similar) dependencies in package.json to concrete
 * ^<version> ranges using the workspace packages' versions, so the package can
 * be packed (npm pack) and installed elsewhere without the monorepo.
 *
 * Run from packages/techdocs-cli (e.g. node scripts/prepare-publish.js).
 * Overwrites package.json in place; run before `npm pack`.
 */

const fs = require('node:fs');
const path = require('node:path');

const pkgDir = path.join(__dirname, '..');
const rootDir = path.join(pkgDir, '../..');
const pkgPath = path.join(pkgDir, 'package.json');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

function resolveWorkspaceVersion(name) {
  // @backstage/foo -> packages/foo or plugins/foo
  // @backstage/plugin-foo -> plugins/foo (Backstage plugin folder convention)
  const shortName = name.replace(/^@backstage\//, '');
  const candidates = [
    path.join(rootDir, 'packages', shortName, 'package.json'),
    path.join(rootDir, 'plugins', shortName, 'package.json'),
  ];
  if (shortName.startsWith('plugin-')) {
    candidates.push(
      path.join(
        rootDir,
        'plugins',
        shortName.replace(/^plugin-/, ''),
        'package.json',
      ),
    );
  }
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const sub = JSON.parse(fs.readFileSync(candidate, 'utf8'));
      return sub.version;
    }
  }
  throw new Error(`Could not resolve workspace version for ${name}`);
}

function resolveDeps(deps) {
  if (!deps) return deps;
  const out = { ...deps };
  for (const [name, value] of Object.entries(out)) {
    if (typeof value === 'string' && value.startsWith('workspace:')) {
      const version = resolveWorkspaceVersion(name);
      out[name] = `^${version}`;
    }
  }
  return out;
}

pkg.dependencies = resolveDeps(pkg.dependencies);
pkg.devDependencies = resolveDeps(pkg.devDependencies);

fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log('Resolved workspace deps in package.json for packing.');
