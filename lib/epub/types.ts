export interface Book {
  id: number;
  title: string;
  author: string;
  zip_url: string | null;
}

export interface ExtractedImage {
  name: string;
  data: Uint8Array;
  mediaType: string;
}

export interface RateLimitStore {
  count: number;
  resetTime: number;
}

export type InlineStyle =
  | 'sesame_dot'
  | 'white_sesame_dot'
  | 'black_circle'
  | 'white_circle'
  | 'black_up-pointing_triangle'
  | 'white_up-pointing_triangle'
  | 'bullseye'
  | 'fisheye'
  | 'saltire'
  | 'sesame_dot_after'
  | 'white_sesame_dot_after'
  | 'black_circle_after'
  | 'white_circle_after'
  | 'black_up-pointing_triangle_after'
  | 'white_up-pointing_triangle_after'
  | 'bullseye_after'
  | 'fisheye_after'
  | 'saltire_after'
  | 'underline_solid'
  | 'underline_double'
  | 'underline_dotted'
  | 'underline_dashed'
  | 'underline_wave'
  | 'overline_solid'
  | 'overline_double'
  | 'overline_dotted'
  | 'overline_dashed'
  | 'overline_wave'
  | 'futoji'
  | 'shatai';

export interface BlockState {
  type:
    | 'indent'
    | 'chitsuki'
    | 'chiyose'
    | 'burasage'
    | 'jizume'
    | 'emphasis'
    | 'underline'
    | 'overline'
    | 'bold'
    | 'italic'
    | 'heading'
    | 'keigakomi'
    | 'yokogumi'
    | 'caption'
    | 'dai'
    | 'sho'
    | 'composite';

  className?: string;
  classes?: string[];
  level?: 1 | 2 | 3;
  tag?: 'h2' | 'h3' | 'h4';
  amount?: number;
  wrapIndent?: number;
}
