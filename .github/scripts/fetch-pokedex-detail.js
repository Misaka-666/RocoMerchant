const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://rocokingdomworld.org/zh/pokedex/';
const OUTPUT_FILE = path.join(__dirname, '../../pokedex-detail-data.json');
const JS_OUTPUT_FILE = path.join(__dirname, '../../entry/src/main/resources/rawfile/pokedex-detail-data.js');
const PROGRESS_FILE = path.join(__dirname, '../../pokedex-progress.json');

function httpGet(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      reject(new Error('Too many redirects'));
      return;
    }

    const doRequest = (requestUrl) => {
      https.get(requestUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        // Follow redirects
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
          let redirectUrl = res.headers.location;
          if (redirectUrl) {
            // Handle relative URLs
            if (redirectUrl.startsWith('/')) {
              const parsed = new URL(requestUrl);
              redirectUrl = parsed.protocol + '//' + parsed.host + redirectUrl;
            }
            console.log(`Redirect ${res.statusCode} -> ${redirectUrl}`);
            doRequest(redirectUrl);
            return;
          }
        }

        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
        res.on('error', reject);
      }).on('error', reject);
    };

    doRequest(url);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanHtml(str) {
  return str.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
}

function parseDetailPage(html, slug) {
  const detail = { slug: slug };

  // Extract description
  const descMatch = html.match(/leading-relaxed[^>]*>([\s\S]*?)<\/p>/);
  if (descMatch) {
    detail.description = cleanHtml(descMatch[1]);
  }

  // Extract obtain method
  const obtainMatch = html.match(/获取方式<\/dt><dd[^>]*>([\s\S]*?)<\/dd>/);
  if (obtainMatch) {
    detail.obtainMethod = cleanHtml(obtainMatch[1]);
  }

  // Extract height
  const heightMatch = html.match(/身高<\/dt><dd[^>]*>([\s\S]*?)<\/dd>/);
  if (heightMatch) {
    detail.height = cleanHtml(heightMatch[1]);
  }

  // Extract weight
  const weightMatch = html.match(/体重<\/dt><dd[^>]*>([\s\S]*?)<\/dd>/);
  if (weightMatch) {
    detail.weight = cleanHtml(weightMatch[1]);
  }

  // Extract trait info
  const traitNameMatch = html.match(/特[性点][^<]*?-\s*([^<]+)<\/div>/);
  const traitDescMatch = html.match(/特[性点][^<]*?<\/div>\s*<div[^>]*>([\s\S]*?)<\/div>/);
  if (traitNameMatch) {
    detail.traitName = cleanHtml(traitNameMatch[1]);
  }
  if (traitDescMatch) {
    detail.traitDesc = cleanHtml(traitDescMatch[1]);
  }

  // Extract 6 base stats
  detail.stats = { hp: 0, atk: 0, matk: 0, def: 0, mdef: 0, spd: 0 };
  const statRegex = /<div[^>]*>(HP|ATK|M\.ATK|DEF|M\.DEF|SPD)<\/div>[\s\S]*?<div[^>]*text-right[^>]*text-sm[^>]*>(\d+)<\/div>/g;
  let statMatch;
  while ((statMatch = statRegex.exec(html)) !== null) {
    const statName = statMatch[1];
    const statValue = parseInt(statMatch[2]);
    switch (statName) {
      case 'HP': detail.stats.hp = statValue; break;
      case 'ATK': detail.stats.atk = statValue; break;
      case 'M.ATK': detail.stats.matk = statValue; break;
      case 'DEF': detail.stats.def = statValue; break;
      case 'M.DEF': detail.stats.mdef = statValue; break;
      case 'SPD': detail.stats.spd = statValue; break;
    }
  }

  // Extract type matchups
  detail.matchups = { strongTo: [], weakTo: [], resistFrom: [], weakFrom: [] };

  // Attack 2x
  const strongToMatch = html.match(/攻击 2 倍克制<\/div>\s*<div[^>]*>([\s\S]*?)<\/div>/);
  if (strongToMatch) {
    const types = strongToMatch[1].match(/type-pill[^>]*>([^<]+)</g);
    if (types) detail.matchups.strongTo = types.map(t => t.replace(/type-pill[^>]*>/, '').replace('<', ''));
  }

  // Take 2x
  const weakToMatch = html.match(/受到 2 倍克制<\/div>\s*<div[^>]*>([\s\S]*?)<\/div>/);
  if (weakToMatch) {
    const types = weakToMatch[1].match(/type-pill[^>]*>([^<]+)</g);
    if (types) detail.matchups.weakTo = types.map(t => t.replace(/type-pill[^>]*>/, '').replace('<', ''));
  }

  // Resist 0.5x
  const resistMatch = html.match(/受到 0.5 倍伤害<\/div>\s*<div[^>]*>([\s\S]*?)<\/div>/);
  if (resistMatch) {
    const types = resistMatch[1].match(/type-pill[^>]*>([^<]+)</g);
    if (types) detail.matchups.resistFrom = types.map(t => t.replace(/type-pill[^>]*>/, '').replace('<', ''));
  }

  // Attack 0.5x
  const weakFromMatch = html.match(/攻击 0.5 倍伤害<\/div>\s*<div[^>]*>([\s\S]*?)<\/div>/);
  if (weakFromMatch) {
    const types = weakFromMatch[1].match(/type-pill[^>]*>([^<]+)</g);
    if (types) detail.matchups.weakFrom = types.map(t => t.replace(/type-pill[^>]*>/, '').replace('<', ''));
  }

  // Extract skills
  detail.skills = [];
  const skillRows = html.match(/<tr class="skill-row[\s\S]*?<\/tr>/g) || [];

  for (const row of skillRows) {
    const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [];
    if (cells.length >= 7) {
      const level = parseInt(cleanHtml(cells[0])) || 0;
      const name = cleanHtml(cells[2]);
      const type = cleanHtml(cells[3]);
      const category = cleanHtml(cells[4]);
      const powerStr = cleanHtml(cells[5]);
      const pp = parseInt(cleanHtml(cells[6])) || 0;
      const effect = cleanHtml(cells[7] || '');

      if (name) {
        detail.skills.push({
          level: level,
          name: name,
          type: type,
          category: category,
          power: powerStr === '-' ? 0 : parseInt(powerStr) || 0,
          pp: pp,
          effect: effect
        });
      }
    }
  }

  return detail;
}

async function fetchSpiritDetail(slug, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const html = await httpGet(BASE_URL + slug);
      return parseDetailPage(html, slug);
    } catch (err) {
      console.error(`Error fetching ${slug} (attempt ${i + 1}):`, err.message);
      if (i < retries - 1) await sleep(2000);
    }
  }
  return { slug: slug, error: 'Failed to fetch' };
}

async function main() {
  console.log('Starting pokedex detail crawl...');

  // Read the basic pokedex data to get slugs
  const pokedexDataPath = path.join(__dirname, '../../entry/src/main/resources/rawfile/pokedex-data.js');
  const pokedexContent = fs.readFileSync(pokedexDataPath, 'utf8');

  // Use eval to parse the JavaScript variable
  let spirits;
  eval(pokedexContent.replace('var POKEDEX_DATA', 'spirits'));

  if (!spirits || !Array.isArray(spirits)) {
    console.error('Could not read pokedex data');
    process.exit(1);
  }

  console.log(`Found ${spirits.length} spirits to crawl`);

  // Generate slugs from nameEn (lowercase)
  for (const s of spirits) {
    if (!s.slug) {
      s.slug = s.nameEn.toLowerCase().replace(/[^a-z0-9]/g, '');
    }
  }

  // Load progress
  let results = {};
  let startIndex = 0;
  try {
    const progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    results = progress.results || {};
    startIndex = progress.nextIndex || 0;
    console.log(`Resuming from index ${startIndex}, ${Object.keys(results).length} already done`);
  } catch (e) {
    console.log('Starting fresh crawl');
  }

  // Crawl each spirit
  for (let i = startIndex; i < spirits.length; i++) {
    const s = spirits[i];
    const slug = s.slug;

    if (results[slug]) {
      console.log(`[${i + 1}/${spirits.length}] Skipping ${slug} (already done)`);
      continue;
    }

    console.log(`[${i + 1}/${spirits.length}] Fetching ${slug}...`);
    const detail = await fetchSpiritDetail(slug);
    results[slug] = detail;

    // Save progress every 10 spirits
    if ((i + 1) % 10 === 0) {
      fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ nextIndex: i + 1, results: results }, null, 2));
      console.log(`Progress saved (${i + 1}/${spirits.length})`);
    }

    // Rate limiting
    await sleep(500);
  }

  // Save final results
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  console.log(`Saved ${Object.keys(results).length} detail entries to ${OUTPUT_FILE}`);

  // Generate JS file
  const jsContent = 'var POKEDEX_DETAIL_DATA = ' + JSON.stringify(results) + ';';
  fs.writeFileSync(JS_OUTPUT_FILE, jsContent);
  console.log(`Saved JS file to ${JS_OUTPUT_FILE}`);

  // Clean up progress file
  try { fs.unlinkSync(PROGRESS_FILE); } catch (e) {}

  console.log('Done!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
