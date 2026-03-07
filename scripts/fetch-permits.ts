#!/usr/bin/env npx tsx

/**
 * Script to download and preview San Diego permit data CSVs.
 * Run: npx tsx scripts/fetch-permits.ts
 */

const URLS = {
  active: "https://seshat.datasd.org/development_permits_set2/permits_set2_active_datasd.csv",
  closed: "https://seshat.datasd.org/development_permits_set2/permits_set2_closed_datasd.csv",
  tags: "https://seshat.datasd.org/development_permits_tags/permits_project_tags_datasd.csv",
};

async function fetchAndPreview(name: string, url: string) {
  console.log(`\n--- Fetching ${name} from ${url} ---`);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Failed: HTTP ${res.status}`);
      return;
    }
    const text = await res.text();
    const lines = text.split("\n");
    console.log(`Total lines: ${lines.length}`);
    console.log(`Headers: ${lines[0]}`);
    console.log(`First 3 rows:`);
    for (let i = 1; i <= Math.min(3, lines.length - 1); i++) {
      console.log(`  ${lines[i]}`);
    }
  } catch (err) {
    console.error(`Error: ${err}`);
  }
}

async function main() {
  for (const [name, url] of Object.entries(URLS)) {
    await fetchAndPreview(name, url);
  }
}

main();
