import { LyricLine } from '../types';

export function parseLRC(lrc: string, durationSeconds?: number): LyricLine[] {
  const lines: LyricLine[] = [];
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

  // Check if this is LRC format (has timestamps)
  const hasTimestamps = lrc.split('\n').some(line => timeRegex.test(line));

  if (hasTimestamps) {
    for (const raw of lrc.split('\n')) {
      const line = raw.trim();
      if (!line) continue;

      const matches = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\]/g);
      if (!matches) continue;

      const text = line.replace(/\[(\d{2}):(\d{2})\.(\d{2,3})\]/g, '').trim();
      if (!text) continue;

      for (const tag of matches) {
        const m = tag.match(timeRegex);
        if (!m) continue;
        const minutes = parseInt(m[1], 10);
        const seconds = parseInt(m[2], 10);
        const ms = parseInt(m[3].padEnd(3, '0'), 10);
        const time = minutes * 60 + seconds + ms / 1000;
        lines.push({ time, text });
      }
    }
    lines.sort((a, b) => a.time - b.time);
  } else {
    // Plain lyrics — auto-estimate timestamps
    const plainLines = lrc.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const total = durationSeconds || 240; // default 4 min
    const gap = total / (plainLines.length + 1);

    plainLines.forEach((text, i) => {
      lines.push({ time: gap * (i + 1), text });
    });
  }

  return lines;
}

export function currentLyricIndex(lines: LyricLine[], time: number): number {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= time) idx = i;
    else break;
  }
  return idx;
}
