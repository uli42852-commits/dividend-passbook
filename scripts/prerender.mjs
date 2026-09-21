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

  // #root 안의 기존(로딩 문구) 콘텐츠를 이 페이지 전용 실제 콘텐츠로 교체
  // (div 중첩 구조에 의존하지 않고, "<div id="root">부터 실제 진입 스크립트 태그 시작 지점까지"를 통째로 교체)
  if (html.includes('<div id="root">') && html.includes('<script type="module"')) {
    html = html.replace(
      /<div id="root">[\s\S]*?<script type="module"/,
      `<div id="root">${bodyHtml}</div>\n    <script type="module"`
    );
  } else {
    console.warn(`[prerender] 경고: #root 또는 진입 스크립트 태그를 찾지 못해 본문 치환을 건너뜀 (${canonicalUrl})`);
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
      <p style="font-size:12px;color:#5b6a61;margin-top:8px;">페이지를 불러오는 중입니다…</p>
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
      <p style="font-size:12px;color:#5b6a61;margin-top:20px;">페이지를 불러오는 중입니다…</p>
    </main>`;
}

function writeFile(relDir, html) {
  const dir = path.join(DIST, relDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf-8');
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

  console.log(`[prerender] ${count}개 정적 페이지 생성 완료 (종목 ${STOCKS.length} + 가이드 ${ARTICLES.length})`);
}

main();
