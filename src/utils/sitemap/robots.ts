/**
 * Parse robots.txt for Sitemap: directives.
 */

/**
 * Extract all Sitemap URLs from robots.txt body.
 * Handles `Sitemap: https://…` (colons in URL) and case-insensitive keys.
 */
export function parseRobotsSitemaps(robotsText: string | null | undefined): string[] {
	if (!robotsText || typeof robotsText !== 'string') return [];
	const out: string[] = [];
	const seen = new Set<string>();
	const lines = robotsText.split(/\r?\n/);
	for (const line of lines) {
		// Strip comments
		const cleaned = line.replace(/#.*$/, '').trim();
		if (!cleaned) continue;
		const m = cleaned.match(/^sitemap\s*:\s*(.+)$/i);
		if (!m) continue;
		const url = m[1].trim();
		if (!url || seen.has(url)) continue;
		seen.add(url);
		out.push(url);
	}
	return out;
}
