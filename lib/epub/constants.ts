export const LIMIT_WINDOW_MS = 60 * 1000;

export const MAX_REQUESTS = 10;

export const MAX_ZIP_BYTES = 20 * 1024 * 1024;

export const MAX_TEXT_BYTES = 10 * 1024 * 1024;

export const MAX_COMPRESSION_RATIO = 50;

export const RUBY_PATTERN =
  /｜([^《\n]+)《([^》\n]+)》|([\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF〆々〇ヶ]+)《([^》\n]+)》/g;

export const ANNOTATION_PATTERN = /［＃[^］]+］/g;

export const IMAGE_ANNOTATION_PATTERN =
  /［＃(?:.+?図|挿絵|画像)（([^,、）]+)(?:[、,][^）]+)?）入る］/g;
