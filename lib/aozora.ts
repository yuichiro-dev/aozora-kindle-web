import iconv from 'iconv-lite';
import JSZip from 'jszip';

export interface ExtractedImage {
  name: string;
  buffer: Buffer;
  mimeType: string;
}

export function parseAozoraText(text: string): { bodyHtml: string } {
  let parsed = text;

  // 1. 凡例・底本注記の除去
  parsed = parsed.replace(
    /-------------------------------------------------------[\s\S]*?【テキスト中に現れる記号について】[\s\S]*?-------------------------------------------------------/g,
    ''
  );

  const lastBorderIndex = parsed.lastIndexOf('-------------------------------------------------------');
  if (lastBorderIndex !== -1) {
    parsed = parsed.substring(0, lastBorderIndex);
  }

  // 2. 冒頭ヘッダーの重複削除
  const lines = parsed.split(/\r?\n/);
  let contentStartIndex = 0;
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i].trim() === '' && lines[i + 1].trim() !== '') {
      contentStartIndex = i + 1;
      if (i > 2) break;
    }
  }
  parsed = lines.slice(contentStartIndex).join('\n');

  // 3. 挿絵注記の完全対応パターン
  // ［＃...（ファイル名...）入る］ の形式から、拡張子(.png/.jpg/.jpeg/.gif)を持つファイル名だけを抽出
  parsed = parsed.replace(
    /［＃[^］]*?（([^）]*?\.(?:png|jpe?g|gif))[^）]*?）[^］]*?入る］/gi,
    (match, imgPath) => {
      // パスからファイル名のみを抽出（例: ./fig56691_01.png -> fig56691_01.png）
      const filename = imgPath.split('/').pop().trim();
      return `<div class="illust"><img src="${filename}" alt="挿絵" /></div>`;
    }
  );

  // 4. ルビ置換
  parsed = parsed.replace(/｜([^《\n]+)《([^》]+)》/g, '<ruby>$1<rt>$2</rt></ruby>');
  parsed = parsed.replace(/([一-龠々ヶ]+)《([^》]+)》/g, '<ruby>$1<rt>$2</rt></ruby>');

  // 5. その他の ［＃...］ 注記を削除
  parsed = parsed.replace(/［＃[^］]+］/g, '');

  // 6. 段落タグ変換
  const finalLines = parsed.split(/\r?\n/);
  const htmlLines = finalLines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '<p><br/></p>';
    if (trimmed.startsWith('<div')) return trimmed; // 挿絵用divはそのまま保持
    return `<p>${trimmed}</p>`;
  });

  return { bodyHtml: htmlLines.join('\n') };
}

// ZIPからテキストと画像群を一括ダウンロード・抽出
export async function fetchAozoraBundle(zipUrl: string): Promise<{ rawText: string; images: ExtractedImage[] }> {
  const res = await fetch(zipUrl);
  if (!res.ok) throw new Error(`ZIP取得失敗: Status ${res.status}`);

  const arrayBuffer = await res.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  // テキストファイル取得
  const txtFileName = Object.keys(zip.files).find(name => name.endsWith('.txt'));
  if (!txtFileName) throw new Error('.txt ファイルが見つかりません');
  const txtBuffer = await zip.files[txtFileName].async('nodebuffer');
  const rawText = iconv.decode(txtBuffer, 'Shift_JIS');

  // 画像ファイル取得 (.png, .jpg, .jpeg, .gif)
  const images: ExtractedImage[] = [];
  const imageFiles = Object.keys(zip.files).filter(name =>
    !name.startsWith('__MACOSX') && /\.(png|jpe?g|gif)$/i.test(name)
  );

  for (const imgName of imageFiles) {
    const buffer = await zip.files[imgName].async('nodebuffer');
    const filename = imgName.split('/').pop() || imgName;
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';

    images.push({ name: filename, buffer, mimeType });
  }

  return { rawText, images };
}