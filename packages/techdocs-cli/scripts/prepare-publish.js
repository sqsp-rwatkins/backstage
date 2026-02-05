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
 * Resolves workspace:^ dependencies in package.json to concrete ^version ranges
 * using the versions from the monorepo workspace packages. Used before npm pack
 * so the tarball can be installed with plain npm install (e.g. in Docker).
 *
 * Run from packages/techdocs-cli. Mutates package.json in place.
 */

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../..');
const cliDir = path.resolve(__dirname, '..');

function getWorkspaceVersions() {
  const map = {};
  const packagesDir = path.join(repoRoot, 'packages');
  const pluginsDir = path.join(repoRoot, 'plugins');

  for (const dir of [packagesDir, pluginsDir]) {
    if (!fs.existsSync(dir)) continue;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const pkgPath = path.join(dir, ent.name, 'package.json');
      if (!fs.existsSync(pkgPath)) continue;
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.name && pkg.version) map[pkg.name] = pkg.version;
      } catch (error) {
        console.error(`Error parsing package.json: ${pkgPath}`);
        console.error(error);
      }
    }
  }
  return map;
}

function resolveDeps(deps, versions) {
  if (!deps || typeof deps !== 'object') return deps;
  const out = { ...deps };
  for (const [name, range] of Object.entries(out)) {
    if (typeof range === 'string' && range.startsWith('workspace:')) {
      const ver = versions[name];
      if (ver) out[name] = `^${ver}`;
    }
  }
  return out;
}

const versions = getWorkspaceVersions();
const pkgPath = path.join(cliDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

pkg.dependencies = resolveDeps(pkg.dependencies, versions);
// devDependencies are not included in the pack by default; resolve in case we ever need them
pkg.devDependencies = resolveDeps(pkg.devDependencies, versions);

fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log('Resolved workspace deps in package.json for pack');
