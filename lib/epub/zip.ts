import { unzipSync } from 'fflate';

import iconv from 'iconv-lite';

import { MAX_COMPRESSION_RATIO, MAX_TEXT_BYTES } from './constants';

import type { ExtractedImage } from './types';

export function extractDataFromZip(zipBuffer: Buffer): {
  text: string;
  images: ExtractedImage[];
} {
  let txtFileName: string | null = null;

  const images: ExtractedImage[] = [];

  const unzipped = unzipSync(new Uint8Array(zipBuffer), {
    filter(file) {
      const lower = file.name.toLowerCase();

      if (lower.endsWith('.txt')) {
        if (txtFileName === null) {
          if (file.originalSize > MAX_TEXT_BYTES) {
            throw new Error(
              `展開後の予測テキストサイズが大きすぎます（上限: ${MAX_TEXT_BYTES / 1024 / 1024}MB）`
            );
          }

          if (file.size > 0 && file.originalSize / file.size > MAX_COMPRESSION_RATIO) {
            throw new Error('Zip Bombの可能性が検知されたため処理を中断しました。');
          }

          txtFileName = file.name;
        }

        return true;
      }

      const ext = lower.split('.').pop() || '';

      return ['jpg', 'jpeg', 'png', 'gif'].includes(ext);
    },
  });

  if (!txtFileName) {
    throw new Error('ZIP内に有効な .txt ファイルが見つかりませんでした。');
  }

  const contentBuffer = Buffer.from(unzipped[txtFileName]);

  if (contentBuffer.length > MAX_TEXT_BYTES) {
    throw new Error(`展開後のテキストが大きすぎます（上限: ${MAX_TEXT_BYTES / 1024 / 1024}MB）`);
  }

  let text = iconv.decode(contentBuffer, 'Shift_JIS');

  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  for (const [filePath, u8Data] of Object.entries(unzipped)) {
    if (filePath === txtFileName) {
      continue;
    }

    const fileName = filePath.split('/').pop() || filePath;

    const ext = fileName.split('.').pop()?.toLowerCase() || '';

    if (!['jpg', 'jpeg', 'png', 'gif'].includes(ext)) {
      continue;
    }

    const mediaType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';

    images.push({
      name: fileName,
      data: u8Data,
      mediaType,
    });
  }

  return {
    text,
    images,
  };
}
