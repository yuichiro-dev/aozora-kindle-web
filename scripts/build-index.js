import fs from 'fs';
import path from 'path';
import https from 'https';
import unzipper from 'unzipper';
import { fileURLToPath } from 'url';
import Papa from 'papaparse';
import iconv from 'iconv-lite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_ZIP_URL = 'https://www.aozora.gr.jp/index_pages/list_person_all_extended_utf8.zip';
const OUTPUT_PATH = path.join(__dirname, '../public/books.json');

function fetchUrl(url, timeout = 15000, redirectCount = 0) {
  const MAX_REDIRECTS = 5;
  if (redirectCount > MAX_REDIRECTS) {
    return Promise.reject(new Error(`リダイレクト回数が上限(${MAX_REDIRECTS}回)を超えました。`));
  }

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = https;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
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
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        let redirectUrl = response.headers.location;
        if (!redirectUrl.startsWith('http')) {
          redirectUrl = `${parsedUrl.origin}${redirectUrl}`;
        }
        if (!redirectUrl.startsWith('https://')) {
          return reject(new Error('HTTPS以外のURLへのリダイレクトは許可されていません。'));
        }
        return resolve(fetchUrl(redirectUrl, timeout, redirectCount + 1));
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

  const response = await fetchUrl(CSV_ZIP_URL);

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

    const booksMap = new Map(); // IDで管理するためにMapを使用
    const rows = parsed.data.slice(1);

    for (const row of rows) {
      const rawId = clean(row[0]);
      const bookId = parseInt(rawId, 10);
      const title = clean(row[1]);
      const titleKana = clean(row[2]);
      const subTitle = clean(row[4]);
      const subTitleKana = clean(row[5]);
      const originalTitle = clean(row[6]);

      const lastName = clean(row[15]);
      const firstName = clean(row[16]);
      const lastNameKana = clean(row[17]);
      const firstNameKana = clean(row[18]);

      const lastNameEn = clean(row[21]);
      const firstNameEn = clean(row[22]);

      const authorBirth = clean(row[24]);
      const authorDeath = clean(row[25]);

      const role = clean(row[23]);
      const zipUrl = clean(row[45]);
      const htmlUrl = clean(row[50]);

      if (!isNaN(bookId) && role === '著者' && (zipUrl || htmlUrl)) {
        const author = `${lastName} ${firstName}`.trim();
        const authorKana = `${lastNameKana} ${firstNameKana}`.trim();

        const rawEn = `${lastNameEn} ${firstNameEn}`.trim();
        const authorEn = /[a-zA-Z]/.test(rawEn) ? rawEn : null;

        if (booksMap.has(bookId)) {
          // すでにIDが存在する場合は、著者を追加（重複チェック付き）
          const existingBook = booksMap.get(bookId);
          if (!existingBook.author.includes(author)) {
            existingBook.author += `, ${author}`;
            existingBook.author_kana += `, ${authorKana}`;
          }
          // URLデータがない場合のみ上書き（データ欠損を防ぐ）
          if (!existingBook.zip_url) existingBook.zip_url = zipUrl || null;
          if (!existingBook.html_url) existingBook.html_url = htmlUrl || null;
        } else {
          // 新規登録
          booksMap.set(bookId, {
            id: bookId,
            title,
            title_kana: titleKana,
            sub_title: subTitle || null,
            sub_title_kana: subTitleKana || null,
            original_title: originalTitle || null,
            author,
            author_birth: authorBirth || null,
            author_death: authorDeath || null,
            author_kana: authorKana,
            author_en: authorEn,
            zip_url: zipUrl || null,
            html_url: htmlUrl || null,
          });
        }
      }
    }

    const books = Array.from(booksMap.values()); // Mapから配列に変換

    books.sort((a, b) => a.id - b.id);

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
