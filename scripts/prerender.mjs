// scripts/prerender.mjs
// "vite build" 이후에 실행되는 순수 Node 스크립트예요 (외부 패키지 의존성 없음).
// dist/index.html(빌드가 끝난 실제 프로덕션 HTML, 해시된 JS 번들 경로 포함)을 템플릿으로 삼아서,
// 종목 394개(/stocks/{ticker})·가이드 69개(/guide/{slug})마다 실제 내용이 담긴 정적 HTML을
// dist/ 아래에 별도 파일로 생성해요.
//
// 핵심 아이디어: 크롤러가 JS를 실행하지 않아도, 이 정적 파일 자체에 실제 종목명·배당 정보·
// 가이드 본문이 텍스트로 들어있어요. 사람이 방문했을 때는 파일 안의 <script type="module">
// 태그가 그대로 살아있어서 React 앱이 정상적으로 부팅되고, 이후엔 지금까지와 동일하게
// 상호작용 가능한 SPA로 동작해요(= "프로그레시브 인핸스먼트": 정적 콘텐츠 위에 JS가 덧씌워짐).
//
// 사용법: package.json의 "build" 스크립트에서 "vite build" 다음에 이어서 실행돼요.
//   "build": "vite build && node scripts/prerender.mjs"

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARTICLES, STOCKS, getRelatedStocks, getRelatedArticles } from '../data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, '..', 'dist');
const SITE = 'https://www.dividendpassbook.com';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function readTemplate() {
  const p = path.join(DIST, 'index.html');
  if (!fs.existsSync(p)) {
    throw new Error(
      `dist/index.html이 없어요. "vite build"를 먼저 실행한 다음에 이 스크립트를 실행해야 해요. (경로: ${p})`
    );
  }
  return fs.readFileSync(p, 'utf-8');
}

// 템플릿 HTML에서 title/description/canonical/og태그/#root 내부 콘텐츠를 교체
function renderPage(template, { title, description, canonicalPath, bodyHtml }) {
  let html = template;
  const canonicalUrl = `${SITE}${canonicalPath}`;

  html = html.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>`);

  if (/<meta name="description"[^>]*>/.test(html)) {
    html = html.replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${escapeHtml(description)}" />`);
  } else {
    html = html.replace('</head>', `  <meta name="description" content="${escapeHtml(description)}" />\n  </head>`);
  }

  if (/<link rel="canonical"[^>]*>/.test(html)) {
    html = html.replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${canonicalUrl}" />`);
  } else {
    html = html.replace('</head>', `  <link rel="canonical" href="${canonicalUrl}" />\n  </head>`);
  }

  const ogReplacements = {
    'og:title': title,
    'og:description': description,
    'og:url': canonicalUrl,
  };
  for (const [prop, value] of Object.entries(ogReplacements)) {
    const re = new RegExp(`<meta property="${prop}"[^>]*>`);
    const tag = `<meta property="${prop}" content="${escapeHtml(value)}" />`;
    html = html.includes(`property="${prop}"`) ? html.replace(re, tag) : html.replace('</head>', `  ${tag}\n  </head>`);
  }

  // #root 안의 기존(정적 폴백) 콘텐츠를 이 페이지 전용 실제 콘텐츠로 교체
  // 주의: 실제 프로덕션 dist/index.html에서는 <script type="module">이 <head> 안에 있을 수 있어
  // (div#root보다 앞에 위치), "div#root 다음에 나오는 script 태그"를 기준으로 찾으면 매치가 실패한다.
  // 그래서 script 태그 위치에 의존하지 않고, div#root 자신의 닫는 태그(뒤에 <script 또는 </body>가
  // 오는 지점)까지를 통째로 교체하는 방식으로 처리한다.
  if (html.includes('<div id="root">')) {
    const newHtml = html.replace(
      /<div id="root">[\s\S]*<\/div>(?=\s*(?:<script|<\/body>))/,
      `<div id="root">${bodyHtml}</div>`
    );
    if (newHtml !== html) {
      html = newHtml;
    } else {
      console.warn(`[prerender] 경고: #root 닫는 태그 지점을 찾지 못해 본문 치환을 건너뜀 (${canonicalUrl})`);
    }
  } else {
    console.warn(`[prerender] 경고: #root를 찾지 못해 본문 치환을 건너뜀 (${canonicalUrl})`);
  }

  return html;
}

function stockBodyHtml(s) {
  const detailHtml = s.detail.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n');
  const cautionHtml = s.caution.map((p) => `<li>${escapeHtml(p)}</li>`).join('\n');
  const relatedStocks = getRelatedStocks(s.ticker, 4);
  const relatedArticles = getRelatedArticles(s.ticker, s.name, 4);
  const relatedArticlesHtml = relatedArticles.length
    ? `<h2 style="font-size:15px;margin:18px 0 8px;">📚 관련 가이드</h2>
       <ul style="font-size:13px;padding-left:20px;">${relatedArticles.map((a) => `<li><a href="/guide/${escapeHtml(a.id)}">${escapeHtml(a.t)}</a> — ${escapeHtml(a.p[0].slice(0, 60))}...</li>`).join('\n')}</ul>`
    : '';
  const relatedStocksHtml = relatedStocks.length
    ? `<h2 style="font-size:15px;margin:18px 0 8px;">📈 비슷한 종목</h2>
       <ul style="font-size:13px;padding-left:20px;">${relatedStocks.map((r) => `<li><a href="/stocks/${escapeHtml(r.ticker)}">${escapeHtml(r.name)}(${escapeHtml(r.ticker)})</a> — ${escapeHtml(r.typeTag)}</li>`).join('\n')}</ul>`
    : '';
  return `
    <main style="max-width:720px;margin:40px auto;padding:0 20px;font-family:-apple-system,'Noto Sans KR',sans-serif;color:#22312a;line-height:1.75;">
      <h1 style="font-size:20px;margin:0 0 4px;">${escapeHtml(s.name)} (${escapeHtml(s.ticker)}) 배당 정보</h1>
      <p style="font-size:13px;color:#5b6a61;margin:0 0 14px;">${escapeHtml(s.typeTag)}</p>
      <p style="font-size:14px;margin:0 0 16px;">${escapeHtml(s.basic)}</p>
      ${detailHtml}
      <h2 style="font-size:15px;margin:18px 0 8px;">주의할 점</h2>
      <ul style="font-size:13px;padding-left:20px;">${cautionHtml}</ul>
      ${relatedArticlesHtml}
      ${relatedStocksHtml}
      <p style="font-size:11px;color:#8a978f;margin-top:20px;">이 페이지의 배당 정책 설명은 최근 공개된 기업·운용사 자료를 바탕으로 정리했으며, 실시간으로 자동 갱신되지 않아요. 최신 배당수익률·배당금은 위 "주의할 점"에 안내된 공식 페이지에서 확인하세요.</p>
    </main>`;
}

function guideBodyHtml(a) {
  const bodyHtml = a.p.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n');
  const ctaHtml = (a.cta && a.cta.length)
    ? a.cta.map((c) => `<p><a href="${escapeHtml(c.href)}" style="display:inline-block;font-weight:700;">${escapeHtml(c.text)}</a></p>`).join('\n')
    : '';
  const faqHtml = (a.faq && a.faq.length)
    ? `<h2 style="font-size:15px;margin:18px 0 8px;">❓ 자주 묻는 질문</h2>` +
      a.faq.map((f) => `<p><b>Q. ${escapeHtml(f.q)}</b><br>${escapeHtml(f.a)}</p>`).join('\n')
    : '';
  // 이 글 본문에 언급된 티커를 역으로 찾아 "관련 종목"으로 연결
  const text = a.t + ' ' + a.p.join(' ');
  const mentioned = STOCKS.filter((s) => new RegExp(`\\b${s.ticker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text)).slice(0, 4);
  const relatedStocksHtml = mentioned.length
    ? `<h2 style="font-size:15px;margin:18px 0 8px;">📈 관련 종목</h2>
       <ul style="font-size:13px;padding-left:20px;">${mentioned.map((s) => `<li><a href="/stocks/${escapeHtml(s.ticker)}">${escapeHtml(s.name)}(${escapeHtml(s.ticker)})</a></li>`).join('\n')}</ul>`
    : '';
  return `
    <main style="max-width:720px;margin:40px auto;padding:0 20px;font-family:-apple-system,'Noto Sans KR',sans-serif;color:#22312a;line-height:1.75;">
      <h1 style="font-size:20px;margin:0 0 14px;">${escapeHtml(a.t)}</h1>
      ${bodyHtml}
      ${ctaHtml}
      ${faqHtml}
      ${relatedStocksHtml}
    </main>`;
}

function writeFile(relDir, html) {
  const dir = path.join(DIST, relDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf-8');
}

// data.js의 STOCKS·ARTICLES를 기준으로 sitemap.xml을 매 build마다 자동 생성.
// public/sitemap.xml을 수동으로 고칠 필요가 없어짐 — vite build가 만든 dist/sitemap.xml을
// 여기서 최신 데이터로 덮어씀. 홈/탭 5개 고정 경로 + 종목 전체 + 가이드 전체.
function writeSitemap() {
  const urls = [
    { loc: `${SITE}/`, freq: 'daily', pri: '1.0' },
    ...['calc', 'calendar', 'find', 'stocks', 'guide'].map((t) => ({
      loc: `${SITE}/${t}`, freq: 'weekly', pri: '0.8',
    })),
    ...STOCKS.map((s) => ({ loc: `${SITE}/stocks/${s.ticker}`, freq: 'weekly', pri: '0.6' })),
    ...ARTICLES.map((a) => ({ loc: `${SITE}/guide/${a.id}`, freq: 'monthly', pri: '0.6' })),
  ];
  const body = urls
    .map((u) => `  <url><loc>${u.loc}</loc><changefreq>${u.freq}</changefreq><priority>${u.pri}</priority></url>`)
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), xml, 'utf-8');
  return urls.length;
}

function main() {
  const template = readTemplate();
  let count = 0;

  for (const s of STOCKS) {
    const html = renderPage(template, {
      title: `${s.name}(${s.ticker}) 배당 정보 — ${s.typeTag} | 배당 통장`,
      description: s.basic,
      canonicalPath: `/stocks/${s.ticker}`,
      bodyHtml: stockBodyHtml(s),
    });
    writeFile(path.join('stocks', s.ticker), html);
    count++;
  }

  for (const a of ARTICLES) {
    const html = renderPage(template, {
      title: `${a.t} | 배당 통장 공부방`,
      description: a.p[0].slice(0, 150),
      canonicalPath: `/guide/${a.id}`,
      bodyHtml: guideBodyHtml(a),
    });
    writeFile(path.join('guide', a.id), html);
    count++;
  }

  const urlCount = writeSitemap();

  console.log(`[prerender] ${count}개 정적 페이지 생성 완료 (종목 ${STOCKS.length} + 가이드 ${ARTICLES.length})`);
  console.log(`[sitemap] ${urlCount}개 URL로 sitemap.xml 자동 생성 완료`);
}

main();
