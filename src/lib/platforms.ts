export const PLATFORM_VALUES = ["tiktok", "instagram", "youtube"] as const;
export type Platform = (typeof PLATFORM_VALUES)[number];

// Real post URL shapes for short-form video platforms. Patterns are shared by
// the zod schemas on the client and the authoritative check on the server.
const TIKTOK_PATTERN =
  /^https?:\/\/(www\.|vm\.|m\.)?tiktok\.com\/@[A-Za-z0-9._-]{1,24}\/video\/\d+(\?.*)?$/i;
const INSTAGRAM_PATTERN =
  /^https?:\/\/(www\.)?instagram\.com\/(reel|p)\/[A-Za-z0-9_-]{5,}(\/)?(\?.*)?$/i;
const YOUTUBE_SHORTS_PATTERN =
  /^https?:\/\/(www\.)?youtube\.com\/shorts\/[A-Za-z0-9_-]{4,}(\?.*)?$/i;
const YOUTUBE_WATCH_PATTERN =
  /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}(&.*)?$/i;

const PLATFORM_PATTERNS: Record<Platform, RegExp[]> = {
  tiktok: [TIKTOK_PATTERN],
  instagram: [INSTAGRAM_PATTERN],
  youtube: [YOUTUBE_SHORTS_PATTERN, YOUTUBE_WATCH_PATTERN],
};

export function isUrlForPlatform(url: string, platform: Platform): boolean {
  return PLATFORM_PATTERNS[platform].some((pattern) => pattern.test(url));
}

export function platformFromUrl(url: string): Platform | null {
  for (const platform of PLATFORM_VALUES) {
    if (isUrlForPlatform(url, platform)) {
      return platform;
    }
  }
  return null;
}

export function isPlatform(value: string): value is Platform {
  return (PLATFORM_VALUES as readonly string[]).includes(value);
}
