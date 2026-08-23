export const LIMIT_WINDOW_MS = 60 * 1000;

export const MAX_REQUESTS = 10;

export const MAX_ZIP_BYTES = 20 * 1024 * 1024;

export const MAX_TEXT_BYTES = 10 * 1024 * 1024;

export const MAX_COMPRESSION_RATIO = 50;

export const RUBY_PATTERN =
  /｜(.+?)《(.+?)》|((?:[\u3005\u3400-\u9FFF\uF900-\uFAFF]|\[\[AOZORA_HTML:[^\]]+\]\])+)《(.+?)》/g;

export const ANNOTATION_PATTERN = /［＃[^］]+］/g;

export const IMAGE_ANNOTATION_PATTERN = /［＃.+?（([^,、）]+)(?:[、,][^）]+)?）入る］/g;
