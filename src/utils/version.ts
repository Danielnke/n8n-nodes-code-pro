/**
 * Package version for live n8n L1 build identity checks.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Resolve package version so live n8n can prove which build is loaded.
 * Walks up from this file looking for package.json (works from nested dist/src/utils).
 */
export function getCodeProVersion(): string {
	let dir = __dirname;
	for (let i = 0; i < 6; i++) {
		const pkgPath = join(dir, 'package.json');
		try {
			if (existsSync(pkgPath)) {
				const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
					name?: string;
					version?: string;
				};
				if (pkg.name === 'n8n-nodes-code-pro' || typeof pkg.version === 'string') {
					return typeof pkg.version === 'string' ? pkg.version : 'unknown';
				}
			}
		} catch {
			/* continue walk */
		}
		dir = join(dir, '..');
	}
	return 'unknown';
}
