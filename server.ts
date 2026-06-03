import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import NeteaseCloudMusicApi from 'NeteaseCloudMusicApi';
import { MAYDAY_ALBUMS } from './src/data';

const { search, song_url_v1, lyric, login_qr_key, login_qr_create, login_qr_check, login_status, logout } = NeteaseCloudMusicApi as any;

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// ---- Netease Cloud Music API Cache ----
interface SongCache {
  url: string;
  lyric: string;
  expireAt: number;
}
const songCache = new Map<string, SongCache>();
const CACHE_TTL = 30 * 60 * 1000; // 30 min

async function neteaseSearch(songTitle: string, albumTitle?: string): Promise<{ id: number; title: string } | null> {
  try {
    const keyword = `五月天 ${songTitle}`;
    const result: any = await search(neteaseOpts({ keywords: keyword, limit: 5, type: 1 }));
    if (result.status !== 200 || !result.body?.result?.songs?.length) {
      console.error(`Netease search failed for "${keyword}": status=${result.status}`);
      return null;
    }
    const songs: any[] = result.body.result.songs;
    if (albumTitle) {
      const match = songs.find((s: any) => s.al?.name?.includes(albumTitle));
      if (match) return { id: match.id, title: match.name };
    }
    return { id: songs[0].id, title: songs[0].name };
  } catch (e) {
    console.error('Netease search error:', e);
    return null;
  }
}

async function neteaseGetUrl(songId: number): Promise<string | null> {
  try {
    const levels: any[] = ['lossless', 'exhigh', 'higher', 'standard'];
    for (const level of levels) {
      const result: any = await song_url_v1(neteaseOpts({ id: songId, level }));
      const url = result.body?.data?.[0]?.url;
      if (url) return url;
    }
    return null;
  } catch (e) { console.error('Netease url error:', e); return null; }
}

async function neteaseGetLyric(songId: number): Promise<string | null> {
  try {
    const result: any = await lyric(neteaseOpts({ id: songId }));
    if (result.status !== 200) return null;
    return result.body?.lrc?.lyric || null;
  } catch (e) { console.error('Netease lyric error:', e); return null; }
}

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || '';
const GLM_KEY = process.env.GLM_API_KEY || '';
// Read cookie from .netease_cookie file (not .env to avoid Vite HMR reload)
let savedCookie = '';
try { const fs = require('fs'); const p = path.join(process.cwd(), '.netease_cookie'); if (fs.existsSync(p)) savedCookie = fs.readFileSync(p, 'utf-8').trim(); } catch {}
const NETEASE_COOKIE = process.env.NETEASE_COOKIE || savedCookie;
if (savedCookie) process.env.NETEASE_COOKIE = savedCookie;

let neteaseLoggedOut = false;

function neteaseOpts(extra: any = {}) {
  const opts: any = { ...extra, realIP: '116.25.146.177' };
  const cookie = neteaseLoggedOut ? '' : process.env.NETEASE_COOKIE || '';
  if (cookie) {
    opts.cookie = cookie.includes('MUSIC_U') ? cookie : `MUSIC_U=${cookie}`;
  }
  return opts;
}

// 智谱 GLM-4-Flash API (免费，OpenAI 兼容)
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
    if (!resp.ok) { const errText = await resp.text(); throw new Error(`GLM ${resp.status}: ${errText.slice(0, 200)}`); }
    const data = await resp.json();
    let content = data.choices?.[0]?.message?.content || '';
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// DeepSeek API (OpenAI-compatible)
async function tryDeepSeek(systemPrompt: string, userPrompt: string): Promise<any | null> {
  if (!DEEPSEEK_KEY) return null;
  try {
    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_KEY}` },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        temperature: 0.9, max_tokens: 800,
        response_format: { type: 'json_object' },
      }),
    });
    if (!resp.ok) { const errText = await resp.text(); throw new Error(`DeepSeek ${resp.status}: ${errText.slice(0, 200)}`); }
    const data = await resp.json();
    return JSON.parse(data.choices?.[0]?.message?.content || '');
  } catch {
    return null;
  }
}

// ---- Music API ----
app.post('/api/music/logout', async (_req, res): Promise<any> => {
  neteaseLoggedOut = true;
  try { await (logout as any)(neteaseOpts()); } catch {}
  try {
    const fs = await import('fs');
    fs.writeFileSync(path.join(process.cwd(), '.netease_cookie'), '');
  } catch {}
  process.env.NETEASE_COOKIE = '';
  res.json({ success: true });
});

app.get('/api/music/status', async (_req, res): Promise<any> => {
  try {
    const result: any = await login_status(neteaseOpts());
    if (result.status !== 200) return res.json({ loggedIn: false });
    const profile = result.body?.data?.profile;
    res.json({
      loggedIn: !!profile,
      nickname: profile?.nickname || null,
      vipType: profile?.vipType || 0,
      message: profile ? `已登录: ${profile.nickname}` : '未登录'
    });
  } catch (e: any) { res.json({ loggedIn: false, message: '检测失败: ' + (e.message || '') }); }
});

// Simple login page
app.get('/login', (_req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>网易云登录</title>
<style>body{font-family:sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
form{background:#1e293b;padding:2rem;border-radius:1rem;width:320px;box-shadow:0 0 40px rgba(245,158,11,0.1)}
input{width:100%;padding:10px;margin:8px 0;border:1px solid #334155;border-radius:8px;background:#0f172a;color:#e2e8f0;box-sizing:border-box}
button{width:100%;padding:12px;background:linear-gradient(135deg,#f59e0b,#d97706);border:none;border-radius:8px;color:#0f172a;font-weight:bold;cursor:pointer;margin-top:12px}
#msg{margin-top:12px;text-align:center;font-size:14px}</style></head><body>
<form onsubmit="login(event)">
<h2 style="text-align:center;margin-bottom:1rem">🔐 网易云音乐登录</h2>
<input type="text" id="phone" placeholder="手机号" required>
<input type="password" id="password" placeholder="密码" required>
<button type="submit">登录</button>
<div id="msg"></div>
</form>
<script>
async function login(e){e.preventDefault();const msg=document.getElementById('msg');msg.style.color='#fbbf24';msg.textContent='登录中...';
const res=await fetch('/api/music/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:document.getElementById('phone').value,password:document.getElementById('password').value})});
const data=await res.json();msg.style.color=data.success?'#34d399':'#f87171';msg.textContent=data.message;
if(data.success)setTimeout(()=>location.href='/',1500);}
</script></body></html>`);
});

// Phone/Email login
app.post('/api/music/login', async (req, res): Promise<any> => {
  const { phone, password } = req.body;
  if (!phone || !password) return res.status(400).json({ error: '需要手机号和密码' });
  try {
    const { login_cellphone } = await import('NeteaseCloudMusicApi');
    const result: any = await login_cellphone({ phone, password });
    if (result.status !== 200 || !result.body?.cookie) {
      return res.json({ success: false, message: '登录失败，请检查手机号和密码' });
    }
    const cookie = result.body.cookie;
    const fs = await import('fs');
    fs.writeFileSync(path.join(process.cwd(), '.netease_cookie'), cookie);
    process.env.NETEASE_COOKIE = cookie;
    neteaseLoggedOut = false;
    songCache.clear(); // Clear cached preview URLs
    res.json({ success: true, message: '登录成功！Cookie 已自动保存', nickname: result.body?.profile?.nickname || '' });
  } catch (e: any) {
    res.json({ success: false, message: e.message });
  }
});

// QR Code login
let qrKey: string | null = null;
app.get('/api/music/qrcode', async (_req, res): Promise<any> => {
  try {
    const keyResult: any = await login_qr_key(neteaseOpts());
    if (keyResult.status !== 200) return res.status(500).json({ error: 'Failed to get QR key' });
    qrKey = keyResult.body.data.unikey;
    const qrResult: any = await login_qr_create(neteaseOpts({ key: qrKey, qrimg: true }));
    if (qrResult.status !== 200) return res.status(500).json({ error: 'Failed to create QR' });
    res.json({ qrUrl: qrResult.body.data.qrimg, key: qrKey });
  } catch (e: any) { res.status(500).json({ error: e.message || 'QR code failed' }); }
});

app.get('/api/music/qrcode/check', async (_req, res): Promise<any> => {
  try {
    if (!qrKey) return res.json({ scanned: false, message: '请先生成二维码', code: -1 });
    const result: any = await login_qr_check(neteaseOpts({ key: qrKey }));
    const code = result.body?.code;
    if (code === 803) {
      const cookie = result.body?.cookie || '';
      const fs = await import('fs');
      fs.writeFileSync(path.join(process.cwd(), '.netease_cookie'), cookie);
      process.env.NETEASE_COOKIE = cookie;
      neteaseLoggedOut = false;
      songCache.clear();
      qrKey = null;
      let nickname = '';
      try { const s: any = await login_status(neteaseOpts()); nickname = s.body?.data?.profile?.nickname || ''; } catch {}
      return res.json({ scanned: true, loggedIn: true, cookie, nickname, message: '登录成功！' });
    }
    if (code === 800) return res.json({ scanned: false, message: '二维码已过期，请刷新', code: 800 });
    if (code === 801) return res.json({ scanned: false, message: '请用网易云音乐App扫码', code: 801 });
    if (code === 802) return res.json({ scanned: true, loggedIn: false, message: '请在手机上确认登录', code: 802 });
    return res.json({ scanned: false, message: '等待扫码...', code });
  } catch (e: any) { res.status(500).json({ error: e.message || 'Check failed' }); }
});

app.get('/api/music/play', async (req, res): Promise<any> => {
  const songTitle = req.query.title as string;
  const albumTitle = req.query.album as string | undefined;
  if (!songTitle) return res.status(400).json({ error: 'Missing title' });

  const cacheKey = `${albumTitle || ''}:${songTitle}`;
  const cached = songCache.get(cacheKey);
  if (cached && Date.now() < cached.expireAt && cached.url) {
    return res.json({ url: cached.url, lyric: cached.lyric, cached: true });
  }

  const song = await neteaseSearch(songTitle, albumTitle);
  if (!song) return res.status(404).json({ error: 'Song not found' });

  const [url, lyric] = await Promise.all([neteaseGetUrl(song.id), neteaseGetLyric(song.id)]);
  if (!url) return res.status(404).json({ error: 'No playable URL' });

  songCache.set(cacheKey, { url, lyric: lyric || '', expireAt: Date.now() + CACHE_TTL });
  res.json({ url, lyric: lyric || '', cached: false });
});

app.get('/api/music/lyric', async (req, res): Promise<any> => {
  const songTitle = req.query.title as string;
  const albumTitle = req.query.album as string | undefined;
  if (!songTitle) return res.status(400).json({ error: 'Missing title' });

  const cacheKey = `${albumTitle || ''}:${songTitle}`;
  const cached = songCache.get(cacheKey);
  if (cached && Date.now() < cached.expireAt) {
    return res.json({ lyric: cached.lyric });
  }

  const song = await neteaseSearch(songTitle, albumTitle);
  if (!song) return res.status(404).json({ error: 'Song not found' });

  const lyric = await neteaseGetLyric(song.id);
  if (cached) {
    cached.lyric = lyric || '';
    cached.expireAt = Date.now() + CACHE_TTL;
  } else {
    songCache.set(cacheKey, { url: '', lyric: lyric || '', expireAt: Date.now() + CACHE_TTL });
  }
  res.json({ lyric: lyric || '' });
});

// ---- 命运唱片 Oracle API ----
app.post('/api/oracle', async (req, res): Promise<any> => {
  try {
    const { albumId, userQuestion } = req.body;
    const album = MAYDAY_ALBUMS.find(a => a.id === albumId);
    if (!album) {
      return res.status(404).json({ error: 'Album not found.' });
    }

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

    // Priority: GLM-4-Flash (free) → DeepSeek → mock
    let result = await tryGLM(systemPrompt, userPrompt);
    if (result) { res.json(result); return; }

    result = await tryDeepSeek(systemPrompt, userPrompt);
    if (result) { res.json(result); return; }

    // Mock fallback
    const mockAnswers = [
      `嘿，你选中了我们的第${album.romanNumeral}张专辑《${album.title}》。我还记得${album.year}年做这张专辑的时候，${album.backgroundStory.slice(0, 50)}……针对你问的"${userQuestion || '未来的方向'}"，我想说：就像《${album.songs[0]?.title || '拥抱'}》里唱的，有些答案不用急着找，时间会给你。温柔地对待自己，就是最勇敢的事。`,
      `（笑）你抽到《${album.title}》了。这张专辑对我们五个来说很特别。${album.description.slice(0, 50)}面对你心中的"${userQuestion || '困惑'}"，我想告诉你：潮落之后一定有潮起，没什么了不起。五月天会一直在这里陪你。`
    ];
    const randomAns = mockAnswers[Math.floor(Math.random() * mockAnswers.length)];
    return res.json({
      answer: randomAns + "\n\n(配置 GLM_API_KEY 或 DEEPSEEK_API_KEY 后将解锁阿信亲自回复。)",
      recommendedSongs: album.songs.slice(0, 2).map(s => s.title),
      divineInsight: '我和我最后的倔强，握紧双手绝对不放！'
    });

  } catch (error: any) {
    console.error('Oracle API error:', error.message);
    res.status(500).json({
      answer: `旋律连线中断：${error.message}。请稍后重试。`,
      recommendedSongs: [],
      divineInsight: '潮落之后一定有潮起'
    });
  }
});

// Legacy alias
app.post('/api/tarot', (req, res) => {
  req.url = '/api/oracle';
  res.redirect(307, '/api/oracle');
});

async function setupServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Vite dev server loaded.');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.use(express.static(path.join(process.cwd(), 'public')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`五月天 · 命运唱片行 on port ${PORT}`);
    console.log(GLM_KEY ? 'GLM-4-Flash AI: ready (free)' : 'GLM API: not configured (get free key at open.bigmodel.cn)');
    console.log(DEEPSEEK_KEY ? 'DeepSeek AI: ready' : 'DeepSeek API: not configured');
    console.log('Priority: GLM-4-Flash (free) → DeepSeek → mock');
  });
}

setupServer();
