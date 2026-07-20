/**
 * Télécharge les photos officielles Wikipedia pour chaque ville
 * et les stocke dans public/images/cities/
 * Usage: node download_city_photos.js
 */
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const OUT_DIR = path.join(__dirname, 'public', 'images', 'cities');
fs.mkdirSync(OUT_DIR, { recursive: true });

// Ville → article Wikipedia exact + nom de fichier local
const CITIES = [
  { name: 'zürich',    wiki: 'Zürich',              file: 'zurich.jpg'     },
  { name: 'bern',      wiki: 'Bern',                file: 'bern.jpg'       },
  { name: 'geneva',    wiki: 'Geneva',              file: 'geneva.jpg'     },
  { name: 'basel',     wiki: 'Basel',               file: 'basel.jpg'      },
  { name: 'lausanne',  wiki: 'Lausanne',            file: 'lausanne.jpg'   },
  { name: 'lugano',    wiki: 'Lugano',              file: 'lugano.jpg'     },
  { name: 'stuttgart', wiki: 'Stuttgart',           file: 'stuttgart.jpg'  },
  { name: 'münchen',   wiki: 'Munich',              file: 'muenchen.jpg'   },
  { name: 'frankfurt', wiki: 'Frankfurt',           file: 'frankfurt.jpg'  },
  { name: 'berlin',    wiki: 'Berlin',              file: 'berlin.jpg'     },
  { name: 'hamburg',   wiki: 'Hamburg',             file: 'hamburg.jpg'    },
  { name: 'köln',      wiki: 'Cologne',             file: 'koeln.jpg'      },
  { name: 'wien',      wiki: 'Vienna',              file: 'wien.jpg'       },
  { name: 'salzburg',  wiki: 'Salzburg',            file: 'salzburg.jpg'   },
  { name: 'graz',      wiki: 'Graz',                file: 'graz.jpg'       },
  { name: 'innsbruck', wiki: 'Innsbruck',           file: 'innsbruck.jpg'  },
  { name: 'london',    wiki: 'London',              file: 'london.jpg'     },
  { name: 'paris',     wiki: 'Paris',               file: 'paris.jpg'      },
  { name: 'brussels',  wiki: 'Brussels',            file: 'brussels.jpg'   },
  { name: 'amsterdam', wiki: 'Amsterdam',           file: 'amsterdam.jpg'  },
  { name: 'milano',    wiki: 'Milan',               file: 'milano.jpg'     },
  { name: 'rom',       wiki: 'Rome',                file: 'rome.jpg'       },
  { name: 'tirana',    wiki: 'Tirana',              file: 'tirana.jpg'     },
  { name: 'prishtinë', wiki: 'Pristina',            file: 'prishtine.jpg'  },
  { name: 'shkodër',   wiki: 'Shkodër',             file: 'shkoder.jpg'    },
  { name: 'durrës',    wiki: 'Durrës',              file: 'durres.jpg'     },
  { name: 'vlorë',     wiki: 'Vlorë',               file: 'vlore.jpg'      },
  { name: 'shkup',     wiki: 'Skopje',              file: 'shkup.jpg'      },
  { name: 'default',   wiki: 'Road',                file: 'default.jpg'    },
];

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'AlbaWay/1.0 (https://albaway.ch; kacinr1@gmail.com) city-photo-downloader' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, data: Buffer.concat(chunks), contentType: res.headers['content-type'] }));
    }).on('error', reject);
  });
}

async function getWikiImageUrl(title) {
  // REST API — different rate limit than action API
  const api = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const res = await get(api);
  if (res.status !== 200) throw new Error(`API HTTP ${res.status}`);
  const json = JSON.parse(res.data.toString());
  // prefer originalimage (highest res), fallback to thumbnail
  return json.originalimage?.source || json.thumbnail?.source || null;
}

async function downloadImage(url, dest) {
  const res = await get(url);
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  if (!res.contentType?.includes('image')) throw new Error(`Pas une image: ${res.contentType}`);
  fs.writeFileSync(dest, res.data);
  return res.data.length;
}

(async () => {
  console.log(`\n📸 Téléchargement des photos de villes → ${OUT_DIR}\n`);
  const results = [];

  for (const city of CITIES) {
    const dest = path.join(OUT_DIR, city.file);
    process.stdout.write(`  ${city.wiki.padEnd(14)} … `);
    try {
      // Skip already downloaded
      if (fs.existsSync(dest) && fs.statSync(dest).size > 10000) {
        console.log(`⏭  déjà présente (${(fs.statSync(dest).size/1024).toFixed(0)} KB)`);
        results.push({ ...city, ok: true });
        continue;
      }
      const imgUrl = await getWikiImageUrl(city.wiki);
      if (!imgUrl) { console.log('❌ Pas d\'image Wikipedia'); results.push({ ...city, ok: false }); continue; }
      const bytes = await downloadImage(imgUrl, dest);
      console.log(`✅ ${(bytes/1024).toFixed(0)} KB`);
      results.push({ ...city, ok: true, size: bytes });
    } catch(e) {
      console.log(`❌ ${e.message}`);
      results.push({ ...city, ok: false, error: e.message });
    }
    await new Promise(r => setTimeout(r, 1500)); // respectful delay
  }

  const ok   = results.filter(r => r.ok);
  const fail = results.filter(r => !r.ok);
  console.log(`\n✅ ${ok.length} téléchargées  ❌ ${fail.length} échouées`);
  if (fail.length) console.log('Échouées:', fail.map(f => f.wiki).join(', '));

  // Génère le mapping CITY_PHOTOS pour app.js
  console.log('\n── Mapping à copier dans app.js ──────────────────────');
  console.log('const CITY_PHOTOS = {');
  for (const c of results.filter(r => r.ok)) {
    console.log(`  '${c.name.padEnd(12)}': '/images/cities/${c.file}',`);
  }
  console.log("  'default      ': '/images/cities/default.jpg',");
  console.log('};');
})();
