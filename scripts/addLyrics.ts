// Script to add missing lyrics to data.ts
// Usage: npx tsx scripts/addLyrics.ts
// This reads data.ts and outputs the song IDs that need lyrics

import { MAYDAY_ALBUMS } from '../src/data';

const missing: string[] = [];
for (const album of MAYDAY_ALBUMS) {
  for (const song of album.songs) {
    if (!song.lyrics) {
      missing.push(`${song.id} | ${album.title} | ${song.title} | ${song.duration}`);
    }
  }
}

console.log(`Total missing: ${missing.length}/${MAYDAY_ALBUMS.reduce((s, a) => s + a.songs.length, 0)}`);
console.log('');
missing.forEach(m => console.log(m));
