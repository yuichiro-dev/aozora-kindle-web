import JSZip from 'jszip';
import { ExtractedImage } from './aozora';

export interface BuildEpubOptions {
  title: string;
  author: string;
  bodyHtml: string;
  images?: ExtractedImage[];
}

export async function buildEpub({ title, author, bodyHtml, images = [] }: BuildEpubOptions): Promise<Uint8Array> {
  const zip = new JSZip();

  // 1. mimetype
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // 2. META-INF/container.xml
  zip.folder('META-INF')?.file('container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

  // 3. OEBPS/style.css
  const css = `
@page {
  margin: 5%;
}
html {
  writing-mode: vertical-rl;
  -webkit-writing-mode: vertical-rl;
  font-family: "Hiragino Mincho ProN", "Yu Mincho", serif;
  line-height: 1.8;
}
body {
  margin: 0;
  padding: 0;
}
p {
  text-indent: 1em;
  margin: 0;
}
ruby rt {
  font-size: 0.5em;
}
.illust {
  text-indent: 0;
  text-align: center;
  margin: 1em 0;
  writing-mode: horizontal-tb;
}
img {
  max-width: 100%;
  height: auto;
}
`;
  zip.folder('OEBPS')?.file('style.css', css);

  // 4. 画像ファイルを OEBPS フォルダへ書き込み ＆ OPF用マニフェスト文字列生成
  let imageManifestItems = '';
  images.forEach((img, idx) => {
    const imgId = `img_${idx}`;
    zip.folder('OEBPS')?.file(img.name, img.buffer);
    imageManifestItems += `\n    <item id="${imgId}" href="${escapeXml(img.name)}" media-type="${img.mimeType}"/>`;
  });

  // 5. OEBPS/item.xhtml (本文)
  const xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="ja" lang="ja">
<head>
  <meta charset="UTF-8"/>
  <title>${escapeXml(title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <section epub:type="chapter">
    <h1 style="font-size: 1.5em; margin-bottom: 2em;">${escapeXml(title)}</h1>
    <h2 style="font-size: 1.1em; text-align: right; margin-bottom: 3em;">${escapeXml(author)}</h2>
    ${bodyHtml}
  </section>
</body>
</html>`;
  zip.folder('OEBPS')?.file('item.xhtml', xhtml);

  // 6. OEBPS/content.opf
  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="pub-id" version="3.0" page-progression-direction="rtl">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">urn:uuid:${Math.random().toString(36).substring(2)}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:language>ja</dc:language>
    <dc:creator>${escapeXml(author)}</dc:creator>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta>
  </metadata>
  <manifest>
    <item id="item" href="item.xhtml" media-type="application/xhtml+xml"/>
    <item id="style" href="style.css" media-type="text/css"/>${imageManifestItems}
  </manifest>
  <spine page-progression-direction="rtl">
    <itemref idref="item"/>
  </spine>
</package>`;
  zip.folder('OEBPS')?.file('content.opf', opf);

  return await zip.generateAsync({ type: 'uint8array', mimeType: 'application/epub+zip' });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}