const https = require('https');
const fs = require('fs');
const path = require('path');

const URL = 'https://rocokingdomworld.org/zh/egg-groups/';
const OUTPUT_FILE = path.join(__dirname, '../../egg-data-versioned.json');
const JS_OUTPUT_FILE = path.join(__dirname, '../../entry/src/main/resources/rawfile/egg-data.js');

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  console.log('Fetching egg data from:', URL);

  // 1. Fetch HTML page
  const html = await httpGet(URL);
  console.log('HTML length:', html.length);

  // 2. Extract JSON from script tag
  const match = html.match(/id="egg-groups-script-data"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) {
    console.error('Could not find egg-groups-script-data in HTML');
    process.exit(1);
  }

  const jsonData = JSON.parse(match[1]);
  const sizesData = jsonData.sizesData;
  console.log('Found', sizesData.length, 'egg size entries');

  // 3. Read current version
  let currentVersion = 0;
  try {
    const existing = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
    currentVersion = existing.version || 0;
  } catch (e) {
    console.log('No existing file, starting from version 1');
  }

  // 4. Generate new data
  const newData = {
    version: currentVersion + 1,
    updatedAt: new Date().toISOString().split('T')[0],
    items: sizesData
  };

  // 5. Write versioned JSON
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(newData, null, 2));
  console.log('Updated egg-data-versioned.json to version', newData.version);

  // 6. Update embedded JS file
  const jsContent = 'var EGG_SIZES_DATA = ' + JSON.stringify(sizesData) + ';';
  fs.writeFileSync(JS_OUTPUT_FILE, jsContent);
  console.log('Updated egg-data.js');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
