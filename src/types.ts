export interface Song {
  id: string;
  title: string;
  albumId: string;
  duration: string; // e.g., "04:21"
  lyricSnippet: string; // A highly representative golden lyric
  lyrics?: string; // Full formatted lyrics (LRC format with [mm:ss.xx] timestamps)
  flacFile?: string; // Original FLAC filename for matching
}

export interface LyricLine {
  time: number; // seconds
  text: string;
}

export interface Album {
  id: string;
  title: string;
  year: number;
  tarotCardName: string; // e.g., "愚者", "恋人"
  tarotCardEnglish: string; // e.g., "The Fool", "The Lovers"
  romanNumeral: string; // e.g., "0", "VI"
  keywords: string[];
  backgroundStory: string;
  description: string;
  primaryColor: string; // Tailwind color or hex gradient
  songs: Song[];
}

export interface TarotReadingRequest {
  albumId: string;
  userQuestion: string;
  userBirthDate?: string;
}

export interface TarotReadingResponse {
  answer: string;
  recommendedSongs: string[]; // representative titles
  divineInsight: string; // single powerful sentence
}

export interface DrawnCardHistory {
  albumId: string;
  albumTitle: string;
  tarotCardName: string;
  drawnAt: string; // ISO date string
}

export type AppState = 'INTRO' | 'CARD_SCROLL' | 'CARD_DETAIL' | 'PLAYING' | 'AI_FORTUNE';
