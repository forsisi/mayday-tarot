import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import NeteaseCloudMusicApi from 'NeteaseCloudMusicApi';
import { MAYDAY_ALBUMS } from './src/data';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.use(express.json());

const GLM_KEY = process.env.GLM_API_KEY || '';
const { search, song_url_v1, lyric, login_qr_key, login_qr_create, login_qr_check, login_cellphone, login_status } = NeteaseCloudMusicApi as any;

// ---- Helpers ----
function neteaseOpts(extra: any = {}, cookie?: string) {
  const opts: any = { ...extra, realIP: '116.25.146.177' };
  if (cookie) opts.cookie = cookie;
  return opts;
}

// Song URL cache (per server instance, short-lived to avoid stale preview URLs)
const urlCache = new Map<string, { url: string; time: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 min

function getCookie(req: any): string {
  return req.query?.cookie || req.body?.cookie || '';
}

// ---- GLM-4-Flash AI ----
async function tryGLM(systemPrompt: string, userPrompt: string): Promise<any | null> {
  if (!GLM_KEY) return null;
  try {
    const resp = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GLM_KEY}` },
      body: JSON.stringify({
        model: 'glm-4-flash',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        temperature: 0.9, max_tokens: 800,
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    let content = data.choices?.[0]?.message?.content || '';
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(content);
  } catch { return null; }
}

// ---- Netease Music APIs ----
async function neteaseSearch(songTitle: string, albumTitle?: string, cookie?: string): Promise<{ id: number; title: string } | null> {
  try {
    const result: any = await search(neteaseOpts({ keywords: `五月天 ${songTitle}`, limit: 5, type: 1 }, cookie));
    if (result.status !== 200 || !result.body?.result?.songs?.length) return null;
    const songs: any[] = result.body.result.songs;
    if (albumTitle) {
      const match = songs.find((s: any) => s.al?.name?.includes(albumTitle));
      if (match) return { id: match.id, title: match.name };
    }
    return { id: songs[0].id, title: songs[0].name };
  } catch { return null; }
}

async function neteaseGetUrl(songId: number, cookie?: string): Promise<string | null> {
  try {
    const levels: any[] = ['lossless', 'exhigh', 'higher', 'standard'];
    for (const level of levels) {
      const result: any = await song_url_v1(neteaseOpts({ id: songId, level }, cookie));
      const url = result.body?.data?.[0]?.url;
      if (url) return url;
    }
    return null;
  } catch { return null; }
}

async function neteaseGetLyric(songId: number, cookie?: string): Promise<string | null> {
  try {
    const result: any = await lyric(neteaseOpts({ id: songId }, cookie));
    if (result.status !== 200) return null;
    return result.body?.lrc?.lyric || null;
  } catch { return null; }
}

// ---- Music API Routes ----
app.get('/api/music/play', async (req, res): Promise<any> => {
  const { title, album } = req.query;
  if (!title) return res.status(400).json({ error: 'Missing title' });
  const cookie = getCookie(req);
  const cacheKey = `${cookie.slice(0, 20)}:${album || ''}:${title}`;
  const cached = urlCache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return res.json({ url: cached.url, cached: true });
  }

  const song = await neteaseSearch(title as string, album as string | undefined, cookie);
  if (!song) return res.status(404).json({ error: 'Song not found' });

  const url = await neteaseGetUrl(song.id, cookie);
  if (!url) return res.status(404).json({ error: 'No playable URL' });

  urlCache.set(cacheKey, { url, time: Date.now() });
  res.json({ url, cached: false });
});

app.get('/api/music/lyric', async (req, res): Promise<any> => {
  const { title, album } = req.query;
  if (!title) return res.status(400).json({ error: 'Missing title' });
  const cookie = getCookie(req);

  const song = await neteaseSearch(title as string, album as string | undefined, cookie);
  if (!song) return res.status(404).json({ error: 'Song not found' });

  const lrc = await neteaseGetLyric(song.id, cookie);
  res.json({ lyric: lrc || '' });
});

app.get('/api/music/status', async (req, res): Promise<any> => {
  try {
    const cookie = getCookie(req);
    if (!cookie) return res.json({ loggedIn: false });
    const result: any = await login_status(neteaseOpts({}, cookie));
    if (result.status !== 200) return res.json({ loggedIn: false });
    const profile = result.body?.data?.profile;
    res.json({
      loggedIn: !!profile,
      nickname: profile?.nickname || null,
      vipType: profile?.vipType || 0,
    });
  } catch { res.json({ loggedIn: false }); }
});

// ---- Login Routes ----
app.get('/api/music/qrcode', async (_req, res): Promise<any> => {
  try {
    const keyResult: any = await login_qr_key(neteaseOpts());
    if (keyResult.status !== 200) return res.status(500).json({ error: 'Failed to get QR key' });
    const qrKey = keyResult.body.data.unikey;
    const qrResult: any = await login_qr_create(neteaseOpts({ key: qrKey, qrimg: true }));
    if (qrResult.status !== 200) return res.status(500).json({ error: 'Failed to create QR' });
    res.json({ qrUrl: qrResult.body.data.qrimg, key: qrKey });
  } catch { res.status(500).json({ error: 'QR failed' }); }
});

app.get('/api/music/qrcode/check', async (req, res): Promise<any> => {
  try {
    const key = req.query.key as string;
    if (!key) return res.json({ scanned: false, message: 'Missing key', code: -1 });
    const result: any = await login_qr_check(neteaseOpts({ key }));
    const code = result.body?.code;
    if (code === 803) {
      const cookie = result.body?.cookie || '';
      let nickname = '';
      try { const s: any = await login_status(neteaseOpts({}, cookie)); nickname = s.body?.data?.profile?.nickname || ''; } catch {}
      return res.json({ scanned: true, loggedIn: true, cookie, nickname, message: '登录成功！' });
    }
    if (code === 800) return res.json({ scanned: false, message: '二维码已过期', code: 800 });
    if (code === 801) return res.json({ scanned: false, message: '请用网易云音乐App扫码', code: 801 });
    if (code === 802) return res.json({ scanned: true, message: '请在手机上确认', code: 802 });
    return res.json({ scanned: false, message: '等待扫码...', code });
  } catch { res.status(500).json({ error: 'Check failed' }); }
});

app.post('/api/music/login', async (req, res): Promise<any> => {
  const { phone, password } = req.body;
  if (!phone || !password) return res.status(400).json({ error: '需要手机号和密码' });
  try {
    const result: any = await login_cellphone(neteaseOpts({ phone, password }));
    if (result.status !== 200 || !result.body?.cookie) {
      return res.json({ success: false, message: '登录失败' });
    }
    const cookie = result.body.cookie;
    const nickname = result.body?.profile?.nickname || '';
    res.json({ success: true, cookie, nickname, message: '登录成功！' });
  } catch { res.json({ success: false, message: '登录失败' }); }
});

// ---- Oracle AI ----
app.post('/api/oracle', async (req, res): Promise<any> => {
  try {
    const { albumId, userQuestion } = req.body;
    const album = MAYDAY_ALBUMS.find(a => a.id === albumId);
    if (!album) return res.status(404).json({ error: 'Album not found.' });

    const songsCtx = album.songs
      .filter(s => s.lyricSnippet)
      .map(s => `- 《${s.title}》: "${s.lyricSnippet}"`)
      .join('\n');

    const systemPrompt = `你是阿信（五月天主唱陈信宏）的音乐分身。你擅长用五月天歌词中的哲理与温暖，给迷茫的人以力量。你说话的方式像阿信一样温柔、深刻、带点诗意。你的回答必须严格遵循 JSON 格式。`;

    const userPrompt = `一位五迷选中了五月天第${album.romanNumeral}张专辑《${album.title}》，想听听你的话。

【专辑背景】
年份：${album.year}年
故事：${album.backgroundStory}
精神：${album.description}

【五迷想问你】
${userQuestion || '在这疯狂世界，我该秉持什么样的执着？'}

【这张专辑的代表歌词】
${songsCtx}

请以阿信的口吻，写一段约200字的温暖回复，像在演唱会上跟歌迷聊天那样。然后从这张专辑里推荐两首最适合的歌，再给一句五月天歌词作为箴言（不超过30字）。

严格返回JSON：
{
  "answer": "阿信的回复",
  "recommendedSongs": ["歌名1", "歌名2"],
  "divineInsight": "一句五月天歌词"
}`;

    const result = await tryGLM(systemPrompt, userPrompt);
    if (result) { res.json(result); return; }

    const mockAnswers = [
      `嘿，你选中了我们的第${album.romanNumeral}张专辑《${album.title}》。我还记得${album.year}年做这张专辑的时候，${album.backgroundStory.slice(0, 50)}……针对你问的"${userQuestion || '未来的方向'}"，我想说：就像《${album.songs[0]?.title || '拥抱'}》里唱的，有些答案不用急着找，时间会给你。温柔地对待自己，就是最勇敢的事。`,
      `（笑）你抽到《${album.title}》了。这张专辑对我们五个来说很特别。${album.description.slice(0, 50)}面对你心中的"${userQuestion || '困惑'}"，我想告诉你：潮落之后一定有潮起，没什么了不起。五月天会一直在这里陪你。`
    ];
    res.json({
      answer: mockAnswers[Math.floor(Math.random() * mockAnswers.length)] + "\n\n(配置 GLM_API_KEY 后将解锁阿信亲自回复。)",
      recommendedSongs: album.songs.slice(0, 2).map(s => s.title),
      divineInsight: '我和我最后的倔强，握紧双手绝对不放！'
    });
  } catch (error: any) {
    res.status(500).json({ answer: `旋律连线中断，请稍后重试。`, recommendedSongs: [], divineInsight: '潮落之后一定有潮起' });
  }
});

// ---- Server Setup ----
async function setupServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
    console.log('Vite dev server loaded.');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.use(express.static(path.join(process.cwd(), 'public')));
    app.get('*', (_req, res) => { res.sendFile(path.join(distPath, 'index.html')); });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`五月天 · 命运唱片行 on port ${PORT}`);
    console.log(GLM_KEY ? 'GLM-4-Flash AI: ready' : 'GLM API: not configured');
  });
}

setupServer();
