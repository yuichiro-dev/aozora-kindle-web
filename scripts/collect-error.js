import fs from 'fs';
import path from 'path';
import { unzipSync } from 'fflate';

// プロジェクトのパス構造に合わせてインポート（必要に応じて .js / .ts のパスを調整してください）
import { renderInline } from '../lib/epub/aozora/inline.js';

const SAMPLE_COUNT = 100;
const DELAY_MS = 100;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const OFFICIAL_CSV_ZIP_URL =
  'https://www.aozora.gr.jp/index_pages/list_person_all_extended_utf8.zip';

async function fetchBookList() {
  console.log('📦 青空文庫公式から作品全件インデックス (Zip) を取得・解凍中...');

  const res = await fetch(OFFICIAL_CSV_ZIP_URL, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
    },
  });

  if (!res.ok) {
    throw new Error(`Official Index Fetch Failed: ${res.status} ${res.statusText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const unzipped = unzipSync(new Uint8Array(arrayBuffer));

  const csvKey = Object.keys(unzipped).find(
    (key) => key.endsWith('.csv') && !key.includes('__MACOSX')
  );
  if (!csvKey) throw new Error('Zip 内に CSV ファイルが見つかりませんでした。');

  const csvText = new TextDecoder('utf-8').decode(unzipped[csvKey]);
  const lines = csvText.split(/\r?\n/);
  const books = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const zipMatch = line.match(/https?:\/\/[^\s",]+\.zip|\.\/cards\/[^\s",]+\.zip/);
    if (!zipMatch) continue;

    let txtUrl = zipMatch[0];
    const parts = line.split(',');
    const cardId = parts[0]?.replace(/"/g, '').trim() || String(i);
    const title = parts[1]?.replace(/"/g, '').trim() || 'Untitled';

    if (txtUrl.startsWith('./')) {
      txtUrl = `https://www.aozora.gr.jp/cards/${txtUrl.replace(/^\.\//, '')}`;
    }

    books.push({ cardId, title, txtUrl });
  }

  return books;
}

async function downloadAndExtractText(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
      },
    });

    if (!res.ok) return null;

    const arrayBuffer = await res.arrayBuffer();
    const unzipped = unzipSync(new Uint8Array(arrayBuffer));

    const txtKey = Object.keys(unzipped).find(
      (key) => key.endsWith('.txt') && !key.includes('__MACOSX')
    );
    if (!txtKey) return null;

    return new TextDecoder('shift-jis').decode(unzipped[txtKey]);
  } catch {
    return null;
  }
}

async function runErrorCollection() {
  const warnings = [];
  const errors = [];

  let currentBook = null;
  let currentLineNo = 0;
  let currentLineRaw = '';

  const originalWarn = console.warn;
  console.warn = (...args) => {
    const msg = args.join(' ');
    if (msg.includes('[Aozora]')) {
      const match = msg.match(/［＃.+?］/);
      const annotation = match ? match[0] : msg;

      warnings.push({
        cardId: currentBook?.cardId ?? 'Unknown',
        title: currentBook?.title ?? 'Unknown',
        lineNo: currentLineNo,
        annotation,
        rawLine: currentLineRaw,
      });

      // 🔍 [WARN SOURCE] 発生行の生テキストをターミナルに表示
      console.log(`\n     🔍 [WARN SOURCE] Line ${currentLineNo}: ${currentLineRaw}`);
    }
    originalWarn.apply(console, args);
  };

  try {
    const allBooks = await fetchBookList();
    console.log(
      `✅ インデックス解析完了: 全 ${allBooks.length} 件から ${SAMPLE_COUNT} 件をランダム抽出し検証します。\n`
    );

    const shuffled = [...allBooks].sort(() => 0.5 - Math.random());
    const targetBooks = shuffled.slice(0, SAMPLE_COUNT);

    let processedLinesTotal = 0;
    let booksWithWarnings = 0;
    let booksWithErrors = 0;

    for (let i = 0; i < targetBooks.length; i++) {
      currentBook = targetBooks[i];
      process.stdout.write(`[${i + 1}/${SAMPLE_COUNT}] ${currentBook.title} ... `);

      await sleep(DELAY_MS);

      const text = await downloadAndExtractText(currentBook.txtUrl);
      if (!text) {
        console.log('SKIP (DL/解凍失敗)');
        continue;
      }

      const lines = text.split(/\r?\n/);
      let inHeader = true;
      let dividerCount = 0;
      const initialWarnCount = warnings.length;
      const initialErrCount = errors.length;

      for (let l = 0; l < lines.length; l++) {
        currentLineNo = l + 1;
        currentLineRaw = lines[l];

        if (currentLineRaw.startsWith('--------------------------------------------------')) {
          dividerCount++;
          if (dividerCount === 2) {
            inHeader = false;
          }
          continue;
        }

        if (inHeader || dividerCount >= 3 || !currentLineRaw.trim()) continue;

        processedLinesTotal++;

        try {
          const rendered = renderInline(currentLineRaw);

          if (rendered.includes('class="notes"')) {
            const annotations = currentLineRaw.match(/［＃.+?］/g);
            if (annotations) {
              for (const ann of annotations) {
                const exists = warnings.some(
                  (w) =>
                    w.cardId === currentBook?.cardId &&
                    w.lineNo === currentLineNo &&
                    w.annotation === ann
                );
                if (!exists) {
                  warnings.push({
                    cardId: currentBook.cardId,
                    title: currentBook.title,
                    lineNo: currentLineNo,
                    annotation: ann,
                    rawLine: currentLineRaw,
                  });

                  // 🔍 [NOTES SOURCE] notesクラスとして拾われた行を表示
                  console.log(`\n     🔍 [NOTES SOURCE] Line ${currentLineNo}: ${currentLineRaw}`);
                }
              }
            }
          }
        } catch (err) {
          const errObj = {
            cardId: currentBook.cardId,
            title: currentBook.title,
            lineNo: currentLineNo,
            message: err.message ?? String(err),
            rawLine: currentLineRaw,
          };
          errors.push(errObj);

          // 💥 [CRASH SOURCE] クラッシュが発生した行を表示
          console.log(`\n     💥 [CRASH SOURCE] Line ${currentLineNo}: ${currentLineRaw}`);
          console.log(`        Error: ${errObj.message}`);
        }
      }

      const bookWarns = warnings.length - initialWarnCount;
      const bookErrs = errors.length - initialErrCount;

      if (bookWarns > 0) booksWithWarnings++;
      if (bookErrs > 0) booksWithErrors++;

      if (bookErrs > 0) {
        console.log(`❌ ERROR (${bookErrs} 件)`);
      } else if (bookWarns > 0) {
        console.log(`⚠️ WARN (${bookWarns} 件)`);
      } else {
        console.log('✨ OK');
      }
    }

    const annotationSummary = {};
    for (const w of warnings) {
      if (!annotationSummary[w.annotation]) {
        annotationSummary[w.annotation] = {
          count: 0,
          sampleTitle: w.title,
          sampleRaw: w.rawLine,
        };
      }
      annotationSummary[w.annotation].count++;
    }

    const topUnknownAnnotations = Object.entries(annotationSummary)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([annotation, data]) => ({
        annotation,
        count: data.count,
        sampleTitle: data.sampleTitle,
        sampleRaw: data.sampleRaw,
      }));

    const reportData = {
      summary: {
        totalBooksChecked: targetBooks.length,
        processedLinesTotal,
        booksWithWarnings,
        booksWithErrors,
        uniqueWarningTypesCount: topUnknownAnnotations.length,
        totalWarningsCount: warnings.length,
        totalRuntimeErrorsCount: errors.length,
      },
      topUnknownAnnotations,
      details: {
        warnings,
        errors,
      },
    };

    const reportPath = path.join(process.cwd(), 'aozora-error-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));

    console.log('\n================ 📊 検証結果レポート ================');
    console.log(`検証作品数          : ${targetBooks.length} 件`);
    console.log(`検証総行数          : ${processedLinesTotal.toLocaleString()} 行`);
    console.log(`未対応注記を含む作品: ${booksWithWarnings} 件`);
    console.log(`クラッシュ発生作品  : ${booksWithErrors} 件`);
    console.log(`未対応注記の種類    : ${topUnknownAnnotations.length} パターン`);
    console.log(`未対応注記の総検出数: ${warnings.length} 件`);
    console.log(`実行エラー(Crash)数 : ${errors.length} 件`);
    console.log('--------------------------------------------------');

    if (topUnknownAnnotations.length > 0) {
      console.log('\n🔥 出現頻度の高い未対応注記 TOP 10:');
      topUnknownAnnotations.slice(0, 10).forEach((item, idx) => {
        console.log(
          `  ${idx + 1}. ${item.annotation.padEnd(25)} (${item.count} 回) -> 例: ${item.sampleTitle}`
        );
        console.log(`     📝 該当行: ${item.sampleRaw}`);
      });
    }

    console.log(`\n💾 詳細レポートを出力しました: ${reportPath}`);
  } finally {
    console.warn = originalWarn;
  }
}

runErrorCollection();
