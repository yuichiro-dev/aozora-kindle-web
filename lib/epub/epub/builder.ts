import { zipSync, strToU8, type Zippable } from 'fflate';

import crypto from 'crypto';

import { escapeXml } from '../escape';

import { EPUB_CSS } from './stylesheet';

import type { ExtractedImage } from '../types';

export function buildEpubBuffer(
  title: string,
  author: string,
  bodyHtml: string,
  images: ExtractedImage[]
): Uint8Array {
  const safeTitle = escapeXml(title);

  const safeAuthor = escapeXml(author);

  const bookId = `urn:uuid:${crypto.randomUUID()}`;

  const mimetype = strToU8('application/epub+zip');

  const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="item/standard.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

  const xhtmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml"
      xmlns:epub="http://www.idpf.org/2007/ops"
      xml:lang="ja"
      lang="ja">
<head>
  <meta charset="UTF-8"/>
  <title>${safeTitle}</title>
  <link rel="stylesheet"
        type="text/css"
        href="../style/style.css"/>
</head>
<body>
${bodyHtml}
</body>
</html>`;

  const imageManifestItems = images
    .map(
      (img, idx) =>
        `<item id="img-${idx}" href="images/${escapeXml(img.name)}" media-type="${img.mediaType}"/>`
    )
    .join('\n    ');

  const zipFiles: Zippable = {
    mimetype: [mimetype, { level: 0 }],

    'META-INF/container.xml': strToU8(containerXml),

    'item/style/style.css': strToU8(EPUB_CSS),

    'item/xhtml/p-001.xhtml': strToU8(xhtmlContent),
  };

  for (const image of images) {
    zipFiles[`item/images/${image.name}`] = image.data;
  }

  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package
  xmlns="http://www.idpf.org/2007/opf"
  version="3.0"
  unique-identifier="pub-id"
  xml:lang="ja">

<metadata
  xmlns:dc="http://purl.org/dc/elements/1.1/">

<dc:identifier id="pub-id">${bookId}</dc:identifier>
<dc:title>${safeTitle}</dc:title>
<dc:creator>${safeAuthor}</dc:creator>
<dc:language>ja</dc:language>

<meta
  property="dcterms:modified">
${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}
</meta>

<meta
  property="page-progression-direction">
rtl
</meta>

<meta
  property="primary-writing-mode">
vertical-rl
</meta>

</metadata>

<manifest>

<item
  id="style"
  href="style/style.css"
  media-type="text/css"/>

<item
  id="p-001"
  href="xhtml/p-001.xhtml"
  media-type="application/xhtml+xml"/>

${imageManifestItems}

</manifest>

<spine
  page-progression-direction="rtl">

<itemref idref="p-001"/>

</spine>

</package>`;

  zipFiles['item/standard.opf'] = strToU8(opf);

  return zipSync(zipFiles);
}
