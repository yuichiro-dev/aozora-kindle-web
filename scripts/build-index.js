const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const unzipper = require('unzipper');
const Papa = require('papaparse');
const iconv = require('iconv-lite');

const CSV_ZIP_URL = 'https://www.aozora.gr.jp/index_pages/list_person_all_extended_utf8.zip';
const OUTPUT_PATH = path.join(__dirname, '../public/books.json');

function fetchUrl(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: '*/*',
      },
      timeout: timeout,
    };

    const req = client.get(options, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        let redirectUrl = response.headers.location;
        if (!redirectUrl.startsWith('http')) {
          redirectUrl = `${parsedUrl.origin}${redirectUrl}`;
        }
        return resolve(fetchUrl(redirectUrl, timeout));
      }

      if (response.statusCode !== 200) {
        return reject(new Error(`ダウンロード失敗: Status ${response.statusCode}`));
      }

      resolve(response);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`接続タイムアウト (${url})`));
    });

    req.on('error', reject);
  });
}

async function downloadAndExtractCsv() {
  console.log('青空文庫のインデックスCSVを取得中...');

  let response;
  try {
    response = await fetchUrl(CSV_ZIP_URL);
  } catch (err) {
    console.log('HTTPSでの取得に失敗したため、HTTPで再試行します...');
    const httpUrl = CSV_ZIP_URL.replace('https://', 'http://');
    response = await fetchUrl(httpUrl);
  }

  return new Promise((resolve, reject) => {
    response
      .pipe(unzipper.Parse())
      .on('entry', async (entry) => {
        if (entry.path.endsWith('.csv')) {
          const chunks = [];
          for await (const chunk of entry) {
            chunks.push(chunk);
          }
          const buffer = Buffer.concat(chunks);
          let csvText = iconv.decode(buffer, 'utf-8');
          if (csvText.charCodeAt(0) === 0xfeff) {
            csvText = csvText.slice(1);
          }
          resolve(csvText);
        } else {
          entry.autodrain();
        }
      })
      .on('error', reject);
  });
}

const clean = (val) => (val ? val.replace(/^"+|"+$/g, '').trim() : '');

async function main() {
  try {
    const csvText = await downloadAndExtractCsv();
    console.log('CSVの解析を開始します...');

    const parsed = Papa.parse(csvText, {
      header: false,
      skipEmptyLines: true,
    });

    const books = [];
    const rows = parsed.data.slice(1);

    for (const row of rows) {
      const rawId = clean(row[0]);
      const bookId = parseInt(rawId, 10);
      const title = clean(row[1]);
      const titleKana = clean(row[2]);
      const subTitle = clean(row[4]);
      const subTitleKana = clean(row[5]);
      const originalTitle = clean(row[6]); // 原題 (欧文タイトル)

      const lastName = clean(row[15]);
      const firstName = clean(row[16]);
      const lastNameKana = clean(row[17]);
      const firstNameKana = clean(row[18]);

      // 【確定インデックス】21: 姓ローマ字 ("Poe", "Irving"), 22: 名ローマ字 ("Edgar Allan", "Washington")
      const lastNameEn = clean(row[21]);
      const firstNameEn = clean(row[22]);

      const role = clean(row[23]); // "著者"
      const zipUrl = clean(row[45]);
      const htmlUrl = clean(row[50]);

      if (!isNaN(bookId) && role === '著者' && (zipUrl || htmlUrl)) {
        const author = `${lastName} ${firstName}`.trim();
        const authorKana = `${lastNameKana} ${firstNameKana}`.trim();

        // 姓ローマ字と名ローマ字を結合 (例: "Poe Edgar Allan", "Irving Washington")
        const rawEn = `${lastNameEn} ${firstNameEn}`.trim();
        const authorEn = /[a-zA-Z]/.test(rawEn) ? rawEn : null;

        books.push({
          id: bookId,
          title,
          title_kana: titleKana,
          sub_title: subTitle || null,
          sub_title_kana: subTitleKana || null,
          original_title: originalTitle || null,
          author,
          author_kana: authorKana,
          author_en: authorEn,
          zip_url: zipUrl || null,
          html_url: htmlUrl || null,
        });
      }
    }

    const publicDir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(books));
    console.log(`完了! 合計 ${books.length} 件の作品データを作成しました: ${OUTPUT_PATH}`);
  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  }
}

main();