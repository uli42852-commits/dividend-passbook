// scripts/prerender.mjs
// "vite build" 이후에 실행되는 순수 Node 스크립트예요 (외부 패키지 의존성 없음).
// dist/index.html(빌드가 끝난 실제 프로덕션 HTML, 해시된 JS 번들 경로 포함)을 템플릿으로 삼아서
// 아래 페이지마다 실제 내용이 담긴 정적 HTML을 dist/ 아래에 별도 파일로 생성해요.
//   - 홈(/)과 탭 페이지 5개(/calc, /calendar, /find, /stocks, /guide)
//   - 종목 페이지 전체(/stocks/{ticker})와 가이드 글 전체(/guide/{slug})
//   - 404.html (없는 주소는 Vercel이 이 파일을 404 상태로 보여줌)
//
// 핵심 아이디어: 크롤러가 JS를 실행하지 않아도, 이 정적 파일 자체에 실제 종목명·배당 정보·
// 가이드 본문이 텍스트로 들어있어요. 사람이 방문했을 때는 파일 안의 <script type="module">
// 태그가 그대로 살아있어서 React 앱이 정상적으로 부팅되고, 이후엔 상호작용 가능한 SPA로
// 동작해요(= "프로그레시브 인핸스먼트": 정적 콘텐츠 위에 JS가 덧씌워짐).
//
// 사용법: package.json의 "build" 스크립트에서 "vite build" 다음에 이어서 실행돼요.
//   "build": "vite build && node scripts/prerender.mjs"

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARTICLES, STOCKS, getRelatedStocks, getRelatedArticles } from '../data.js';
import {
  SITE, SITE_NAME, HOME_META, TAB_META, TAB_ORDER, stockMeta, articleMeta,
} from '../src/pageMeta.js';
import { GUIDE_CATEGORIES, guideCategoryOf } from '../src/guideCategories.js';
import { inferPerYear, trailingTotal } from '../src/distributions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, '..', 'dist');
const OG_IMAGE = `${SITE}/og.png`;
const BUILD_DATE = new Date().toISOString().slice(0, 10);

// 매주 GitHub Actions가 갱신하는 최근 분배금 데이터 — 없으면 해당 섹션만 빠짐
let PAYOUTS = null;
try {
  PAYOUTS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'distributions.json'), 'utf-8'));
} catch (e) { /* 아직 수집 전 */ }

const FREQ_LABEL = { 52: '매주', 12: '매월', 4: '분기' };
function distMoney(n, cur) {
  // 1달러 미만은 소수 넷째 자리까지 보여주되 최소 둘째 자리는 유지 ($0.20, $0.1834)
  return cur === 'USD' ? `$${n.toFixed(n < 1 ? 4 : 2).replace(/(\.\d\d\d*?)0+$/, '$1')}` : `${Math.round(n).toLocaleString('ko-KR')}원`;
}

// 종목 페이지의 "최근 분배금" 섹션 (최근 8회 + 1년 합계·주기·주가 대비 비율)
function distributionsHtml(ticker) {
  const e = PAYOUTS?.tickers?.[ticker];
  if (!e || !e.distributions?.length) return '';
  const cur = e.currency;
  const total = trailingTotal(e);
  const rate = e.price > 0 ? (total / e.price) * 100 : null;
  const rows = e.distributions.slice(0, 8)
    .map((d) => `<tr><td>${escapeHtml(d.exDate)}</td><td style="text-align:right">${escapeHtml(distMoney(d.amount, cur))}</td></tr>`).join('');
  return `<h2>최근 분배금</h2>
<p>최근 1년 동안 ${e.distributions.length}회(${FREQ_LABEL[inferPerYear(e)]}) 지급, 합계 ${escapeHtml(distMoney(total, cur))}${rate !== null ? ` — ${escapeHtml(e.priceDate || PAYOUTS.updatedAt)} 주가 ${escapeHtml(distMoney(e.price, cur))} 대비 약 ${rate.toFixed(1)}%` : ''}${Number.isFinite(e.change1y) ? `, 같은 기간 주가 변화 ${(e.change1y * 100).toFixed(1)}%` : ''}.</p>
<table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr><th style="text-align:left">배당락일</th><th style="text-align:right">주당 분배금</th></tr></thead><tbody>${rows}</tbody></table>
<p class="s-note">${escapeHtml(PAYOUTS.updatedAt)} 기준 ${escapeHtml(PAYOUTS.source)} 자료이며 매주 자동 갱신돼요. 공식 공시와 다를 수 있으니 운용사 발표를 함께 확인하세요. <a href="/payback">이 분배금으로 원금회수 기간 계산하기 →</a></p>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// JSON-LD는 <script> 안에 들어가므로 "</script>"가 본문에 있으면 태그가 끊겨요 — "<"를 이스케이프
function jsonLdString(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
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

function replaceOrInsert(html, re, tag) {
  return re.test(html) ? html.replace(re, tag) : html.replace('</head>', `  ${tag}\n  </head>`);
}

// 템플릿 HTML에서 title/description/canonical/og태그/JSON-LD/#root 내부 콘텐츠를 교체
function renderPage(template, { title, description, canonicalPath, bodyHtml, jsonLd, noindex = false, withScripts = true }) {
  let html = template;
  const canonicalUrl = `${SITE}${canonicalPath}`;

  html = html.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>`);
  html = replaceOrInsert(html, /<meta name="description"[^>]*>/, `<meta name="description" content="${escapeHtml(description)}" />`);

  if (noindex) {
    html = html.replace(/\s*<link rel="canonical"[^>]*>/, '');
    html = html.replace('</head>', '  <meta name="robots" content="noindex" />\n  </head>');
  } else {
    html = replaceOrInsert(html, /<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${canonicalUrl}" />`);
  }

  const og = {
    'og:title': title,
    'og:description': description,
    'og:url': canonicalUrl,
    'og:type': canonicalPath.startsWith('/guide/') ? 'article' : 'website',
    'og:image': OG_IMAGE,
  };
  for (const [prop, value] of Object.entries(og)) {
    html = replaceOrInsert(html, new RegExp(`<meta property="${prop}"[^>]*>`), `<meta property="${prop}" content="${escapeHtml(value)}" />`);
  }

  html = html.replace(
    /<script type="application\/ld\+json" id="ld-json">[\s\S]*?<\/script>/,
    jsonLd ? `<script type="application/ld+json" id="ld-json">${jsonLdString(jsonLd)}</script>` : ''
  );

  if (!withScripts) {
    // 404 페이지: 앱을 띄우지 않고 정적 안내만 보여줌 (앱이 뜨면 기본 탭이 그려져 404 안내가 사라짐)
    html = html.replace(/\s*<script type="module"[^>]*><\/script>/g, '');
    html = html.replace(/\s*<link rel="modulepreload"[^>]*>/g, '');
  }

  const newHtml = html.replace(/<div id="root">[\s\S]*?<\/div>(?=\s*(?:<script|<\/body>))/, `<div id="root">${bodyHtml}</div>`);
  if (newHtml === html) {
    throw new Error(`[prerender] #root를 찾지 못해 본문을 넣지 못했어요 (${canonicalUrl})`);
  }
  return newHtml;
}

/* ── 정적 본문 공통 틀 — 앱 화면과 비슷한 모양이라 JS가 붙을 때 화면이 크게 바뀌지 않아요 ── */
const SHELL_CSS = `
.s-wrap{--bg:#f2f4f6;--card:#fff;--ink:#191f28;--soft:#6b7684;--line:#e5e8eb;--pri:#0b7a53;
  min-height:100vh;background:var(--bg);color:var(--ink);font-family:Pretendard,'Pretendard Variable',-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;letter-spacing:-0.01em;line-height:1.7}
@media (prefers-color-scheme:dark){.s-wrap{--bg:#0f1114;--card:#1a1d21;--ink:#e9ecef;--soft:#9aa3ad;--line:#2a2e33;--pri:#34c38f}}
.s-wrap a{color:var(--pri)}
.s-head{position:sticky;top:0;background:var(--card);border-bottom:1px solid var(--line)}
.s-in{max-width:640px;margin:0 auto;padding:0 16px;box-sizing:border-box}
.s-wrap .s-brand{display:flex;align-items:center;gap:8px;height:56px;font-size:19px;font-weight:800;color:var(--ink);text-decoration:none}
.s-nav{display:flex;gap:4px;overflow-x:auto;margin:0 -12px}
.s-nav a{flex-shrink:0;padding:12px 12px 11px;font-size:15px;font-weight:600;color:var(--soft);text-decoration:none;border-bottom:2px solid transparent}
.s-nav a[aria-current=page]{color:var(--ink);font-weight:700;border-bottom-color:var(--ink)}
.s-main{padding:20px 16px 48px}
.s-card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;margin-bottom:12px}
.s-card h1{font-size:22px;line-height:1.4;margin:0 0 6px;letter-spacing:-0.02em}
.s-card h2{font-size:17px;margin:22px 0 8px}
.s-card p,.s-card li{font-size:15px}
.s-meta{font-size:13px;color:var(--soft);margin:0 0 14px}
.s-crumb{font-size:13px;color:var(--soft);margin:0 0 10px}
.s-crumb a{color:var(--soft)}
.s-list{padding-left:20px;margin:0}
.s-list li{margin:4px 0}
.s-note{font-size:13px;color:var(--soft)}
`;

const LOGO_SVG = '<svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#0b7a53"/><rect x="8" y="17" width="4" height="7" rx="1" fill="#fff"/><rect x="14" y="13" width="4" height="11" rx="1" fill="#fff"/><rect x="20" y="8" width="4" height="16" rx="1" fill="#fff"/></svg>';

function shell(activeTab, inner) {
  const nav = TAB_ORDER.map((t) =>
    `<a href="/${t}"${t === activeTab ? ' aria-current="page"' : ''}>${escapeHtml(TAB_META[t].label)}</a>`
  ).join('');
  return `<div class="s-wrap"><style>${SHELL_CSS}</style>
<header class="s-head"><div class="s-in"><a class="s-brand" href="/">${LOGO_SVG}배당통장</a><nav class="s-nav" aria-label="주요 메뉴">${nav}</nav></div></header>
<main class="s-in s-main">${inner}
<p class="s-note">이 사이트의 정보는 일반적인 정보 제공 목적이며 투자 자문이나 특정 종목 추천이 아니에요. 문의: <a href="mailto:contact@dividendpassbook.com">contact@dividendpassbook.com</a></p>
</main></div>`;
}

function crumbs(items) {
  return `<p class="s-crumb">${items.map((it) => (it.href ? `<a href="${it.href}">${escapeHtml(it.name)}</a>` : escapeHtml(it.name))).join(' › ')}</p>`;
}

function breadcrumbLd(items) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem', position: i + 1, name: it.name, ...(it.href ? { item: `${SITE}${it.href}` } : {}),
    })),
  };
}

function mentionedStocks(article) {
  const text = article.t + ' ' + article.p.join(' ');
  return STOCKS.filter((s) => new RegExp(`\\b${s.ticker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text)).slice(0, 4);
}

/* ── 종목 페이지 ── */
function stockPage(s) {
  const meta = stockMeta(s);
  const trail = [{ name: '홈', href: '/' }, { name: '종목분석', href: '/stocks' }, { name: `${s.name}(${s.ticker})` }];
  const relatedStocks = getRelatedStocks(s.ticker, 4);
  const relatedArticles = getRelatedArticles(s.ticker, s.name, 4);
  const inner = `<article class="s-card">
${crumbs(trail)}
<h1>${escapeHtml(s.name)} (${escapeHtml(s.ticker)}) 배당 정보</h1>
<p class="s-meta">${escapeHtml(s.typeTag)}</p>
<p>${escapeHtml(s.basic)}</p>
${s.detail.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n')}
${distributionsHtml(s.ticker)}
<h2>주의할 점</h2>
<ul class="s-list">${s.caution.map((p) => `<li>${escapeHtml(p)}</li>`).join('\n')}</ul>
${relatedArticles.length ? `<h2>관련 가이드</h2><ul class="s-list">${relatedArticles.map((a) => `<li><a href="/guide/${escapeHtml(a.id)}">${escapeHtml(a.t)}</a></li>`).join('\n')}</ul>` : ''}
${relatedStocks.length ? `<h2>비슷한 종목</h2><ul class="s-list">${relatedStocks.map((r) => `<li><a href="/stocks/${escapeHtml(r.ticker)}">${escapeHtml(r.name)}(${escapeHtml(r.ticker)})</a> — ${escapeHtml(r.typeTag)}</li>`).join('\n')}</ul>` : ''}
<p class="s-note">배당 정책 설명은 공개된 기업·운용사 자료를 바탕으로 정리했으며 실시간으로 갱신되지 않아요. 최신 배당금·배당수익률은 위 "주의할 점"에 안내된 공식 출처에서 확인하세요.</p>
</article>
<p><a href="/calc">이 종목으로 내 배당금 계산해 보기 →</a></p>`;
  return {
    ...meta,
    bodyHtml: shell('stocks', inner),
    jsonLd: { '@context': 'https://schema.org', '@graph': [breadcrumbLd(trail)] },
  };
}

/* ── 가이드 글 페이지 ── */
function articlePage(a) {
  const meta = articleMeta(a);
  const trail = [{ name: '홈', href: '/' }, { name: '공부방', href: '/guide' }, { name: a.t }];
  const mentioned = mentionedStocks(a);
  const inner = `<article class="s-card">
${crumbs(trail)}
<h1>${escapeHtml(a.t)}</h1>
${a.p.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n')}
${(a.cta || []).map((c) => `<p><a href="${escapeHtml(c.href)}"><b>${escapeHtml(c.text)}</b></a></p>`).join('\n')}
${(a.faq && a.faq.length) ? `<h2>자주 묻는 질문</h2>${a.faq.map((f) => `<p><b>Q. ${escapeHtml(f.q)}</b><br>${escapeHtml(f.a)}</p>`).join('\n')}` : ''}
${mentioned.length ? `<h2>관련 종목</h2><ul class="s-list">${mentioned.map((s) => `<li><a href="/stocks/${escapeHtml(s.ticker)}">${escapeHtml(s.name)}(${escapeHtml(s.ticker)})</a></li>`).join('\n')}</ul>` : ''}
</article>`;
  const graph = [
    {
      '@type': 'Article',
      headline: a.t,
      description: meta.description,
      inLanguage: 'ko-KR',
      mainEntityOfPage: `${SITE}${meta.path}`,
      image: OG_IMAGE,
      dateModified: BUILD_DATE,
      author: { '@type': 'Organization', name: SITE_NAME, url: `${SITE}/` },
      publisher: { '@type': 'Organization', name: SITE_NAME, url: `${SITE}/` },
    },
    breadcrumbLd(trail),
  ];
  if (a.faq && a.faq.length) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: a.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    });
  }
  return { ...meta, bodyHtml: shell('guide', inner), jsonLd: { '@context': 'https://schema.org', '@graph': graph } };
}

/* ── 홈·탭 페이지 ── */
const isKr = (s) => /^\d{6}$/.test(s.ticker);

function stockLinks(list) {
  return `<ul class="s-list">${list.map((s) => `<li><a href="/stocks/${escapeHtml(s.ticker)}">${escapeHtml(s.name)}(${escapeHtml(s.ticker)})</a> — ${escapeHtml(s.typeTag)}</li>`).join('\n')}</ul>`;
}

function articleLinks(list) {
  return `<ul class="s-list">${list.map((a) => `<li><a href="/guide/${escapeHtml(a.id)}">${escapeHtml(a.t)}</a></li>`).join('\n')}</ul>`;
}

function tabPage(tab, intro) {
  const m = TAB_META[tab];
  const trail = [{ name: '홈', href: '/' }, { name: m.label }];
  return {
    title: m.title,
    description: m.description,
    path: `/${tab}`,
    bodyHtml: shell(tab, `<section class="s-card">${crumbs(trail)}${intro}</section>`),
    jsonLd: { '@context': 'https://schema.org', '@graph': [breadcrumbLd(trail)] },
  };
}

function homePage() {
  const inner = `<section class="s-card">
<h1>배당주 포트폴리오 계산기</h1>
<p>보유한 국내·미국 배당주를 기입하면 연간 배당금, 월별 배당 흐름, 세후 실수령액까지 계산해주는 무료 배당 계산기예요. 회원가입 없이 쓰고, 입력한 내용은 내 브라우저에만 저장돼요.</p>
<p><a href="/calc"><b>배당금 계산 시작하기 →</b></a></p>
</section>
<section class="s-card">
<h2 style="margin-top:0">종목분석 — ${STOCKS.length.toLocaleString('ko-KR')}개 종목</h2>
<p>국내·미국 배당주, 배당 ETF, 리츠, 폐쇄형펀드의 배당 정책과 지급 주기, 투자 전 주의할 점을 정리했어요.</p>
${stockLinks(STOCKS.slice(0, 24))}
<p><a href="/stocks">전체 종목 보기 →</a></p>
</section>
<section class="s-card">
<h2 style="margin-top:0">공부방 — 배당 투자 가이드 ${ARTICLES.length}편</h2>
${articleLinks(ARTICLES.slice(0, 20))}
<p><a href="/guide">전체 가이드 보기 →</a></p>
</section>`;
  return {
    ...HOME_META,
    path: '/',
    bodyHtml: shell(null, inner),
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', name: SITE_NAME, url: `${SITE}/`, inLanguage: 'ko-KR', description: HOME_META.description },
        {
          '@type': 'WebApplication', name: `${SITE_NAME} 배당 계산기`, url: `${SITE}/calc`, applicationCategory: 'FinanceApplication',
          operatingSystem: 'Web', inLanguage: 'ko-KR', offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
        },
      ],
    },
  };
}

function tabPages() {
  const kr = STOCKS.filter(isKr);
  const other = STOCKS.filter((s) => !isKr(s));
  return [
    tabPage('calc', `<h1>배당금 계산기</h1>
<p>종목명, 보유수량, 매입단가, 주당 연배당금, 배당 지급월을 기입하면 연간·월평균 배당금과 월별 배당 흐름을 계산해요. 세후 보기로 바꾸면 국내 주식은 15.4%, 미국 주식은 15% 원천징수를 뺀 금액을 보여줘요.</p>
<h2>함께 볼 수 있는 것</h2>
<ul class="s-list"><li>월 배당 목표 달성률</li><li>종목·통화·월별·자산군 분산도 진단</li><li>금융소득종합과세(연 2,000만원) 기준선 체크</li><li>계산 결과 공유 링크와 백업 파일 내보내기</li></ul>
<h2>자주 묻는 질문</h2>
<p><b>Q. 계산된 배당금이 실제 받는 금액과 다를 수 있나요?</b><br>네. 기업이 배당을 늘리거나 줄이면 실제 지급액이 달라져요. 최신 주당배당금은 기업 IR·DART·운용사 페이지에서 확인 후 입력하세요.</p>
<p><b>Q. 달러 배당은 어떻게 원화로 바꿔 계산하나요?</b><br>계산기에 설정한 환율(기본 1달러 1,400원, 직접 변경 가능)로 환산한 근사치예요.</p>`),
    tabPage('salary', `<h1>배당 월급 시뮬레이터</h1>
<p>매달 투자금과 투자 기간(10·20·30년)을 넣으면, 그 기간 뒤 매달 받게 될 세후 배당을 계산해요. 배당 재투자 여부와 물가상승률을 반영한 "오늘 돈 가치"도 함께 보여줘요.</p>
<h2>과거 성장률을 그대로 믿지 않는 계산</h2>
<p>과거 10년 동안 많이 오른 종목의 성장률을 30년 내내 그대로 이어가면 결과가 지나치게 크게 나와요. 그래서 같은 종목을 "과거 그대로", "과거의 절반", "성장 없음" 세 가지 가정으로 나란히 계산하고, 종목 순위는 중간인 "과거의 절반" 기준으로 매겨요.</p>
<h2>자주 묻는 질문</h2>
<p><b>Q. 과거 데이터는 어디서 오나요?</b><br>대표 배당주·배당 ETF의 최근 최대 10년 주가와 배당 이력으로 연평균 배당 증가율, 주가 상승률, 현재 배당수익률을 계산해 매주 갱신해요.</p>
<p><b>Q. 왜 결과가 다른 서비스보다 작게 나오나요?</b><br>세금과 물가를 반영하고, 과거의 높은 성장률이 수십 년 그대로 이어진다고 가정하지 않기 때문이에요.</p>
<p>관련 가이드: <a href="/guide/dividend-income-living">배당금으로 생활비 만들기</a> · <a href="/guide/monthly-dividend-3million-required-capital">월 300만원 배당에 필요한 투자금</a></p>`),
    tabPage('payback', `<h1>원금회수 계산기</h1>
<p>투자금, 매입가, 1회 주당 분배금, 지급 주기(매주·매월·분기)를 넣으면 받은 분배금만으로 투자 원금을 되찾는 데 걸리는 기간을 계산해요. 주배당 ETF나 커버드콜 ETF처럼 분배율이 높은 종목에 맞춰 만들었어요.</p>
<h2>주가 변화까지 함께 봐야 하는 이유</h2>
<p>분배율이 높은 ETF는 주가(순자산가치)가 함께 내려가는 경우가 많아요. 그러면 분배금도 같은 비율로 줄어서 회수 기간이 길어지고, 원금만큼 분배금을 받았을 때 남은 주식 가치는 원금보다 훨씬 작을 수 있어요. 이 계산기는 주가 유지·연 -15%·연 -30% 시나리오를 나란히 비교해 보여줘요.</p>
<h2>자주 묻는 질문</h2>
<p><b>Q. 분배금을 재투자하면 어떻게 되나요?</b><br>원금회수는 받은 현금으로 원금을 되찾는 기준이라, 이 계산기는 재투자하지 않는다고 가정해요.</p>
<p><b>Q. 세금은 어떻게 반영하나요?</b><br>미국 상장 종목은 15%, 국내 상장 종목은 15.4% 원천징수를 뺀 세후 분배금으로 계산해요. 실제 세금은 개인 상황에 따라 달라질 수 있어요.</p>
<p>관련 가이드: <a href="/guide/covered-call-etf-nav-erosion">커버드콜 ETF 분배금이 원금을 갉아먹는다는 말</a> · <a href="/guide/yieldmax-etf-explained">야일드맥스 ETF란?</a></p>`),
    tabPage('calendar', `<h1>배당 달력</h1>
<p>계산기에 기입한 보유 종목이 몇 월에 배당을 주는지 달력으로 보여줘요. 배당이 비는 달을 찾아 다른 지급월의 종목을 더하면 매달 배당이 들어오는 포트폴리오를 만들 수 있어요.</p>
<p>관련 가이드: <a href="/guide/monthly-dividend-portfolio">월배당 포트폴리오 만드는 법</a></p>`),
    tabPage('find', `<h1>나에게 맞는 배당 투자 유형 찾기</h1>
<p>질문 3개에 답하면 월배당 안정형, 배당성장형, 고배당 현금흐름형, 배당킹 안정형 중 어떤 유형이 맞는지와 그 유형에서 조심할 점을 알려드려요. 특정 종목 추천이 아닌 유형 안내예요.</p>`),
    tabPage('stocks', `<h1>배당주 종목분석</h1>
<p>${STOCKS.length.toLocaleString('ko-KR')}개 종목의 배당 정책, 지급 주기, 투자 전 주의할 점을 정리했어요. 배당수익률·주가처럼 매일 바뀌는 숫자는 싣지 않고 공식 출처를 안내해요.</p>
<h2>국내 종목 (${kr.length})</h2>${stockLinks(kr)}
<h2>미국·해외 종목 (${other.length})</h2>${stockLinks(other)}`),
    tabPage('guide', `<h1>배당 투자 공부방</h1>
<p>배당 투자를 시작하기 전에 알아두면 좋은 내용을 ${ARTICLES.length}편의 글로 정리했어요.</p>
${GUIDE_CATEGORIES.map((c) => {
  const list = ARTICLES.filter((x) => guideCategoryOf(x.id) === c.v);
  return list.length ? `<h2>${escapeHtml(c.t)} (${list.length})</h2>${articleLinks(list)}` : '';
}).join('\n')}`),
  ];
}

function notFoundPage() {
  return {
    title: `페이지를 찾을 수 없어요 | ${SITE_NAME}`,
    description: '요청하신 페이지를 찾을 수 없어요.',
    path: '/404',
    noindex: true,
    withScripts: false,
    bodyHtml: shell(null, `<section class="s-card"><h1>페이지를 찾을 수 없어요</h1>
<p>주소가 바뀌었거나 없는 종목·글일 수 있어요.</p>
<ul class="s-list"><li><a href="/">홈으로 가기</a></li><li><a href="/stocks">종목분석에서 찾아보기</a></li><li><a href="/guide">공부방 글 목록 보기</a></li></ul></section>`),
  };
}

function writeFile(relPath, html) {
  const file = path.join(DIST, relPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html, 'utf-8');
}

// data.js의 STOCKS·ARTICLES를 기준으로 sitemap.xml을 매 build마다 자동 생성 (손으로 고칠 필요 없음)
function writeSitemap() {
  const urls = [
    { loc: `${SITE}/`, freq: 'daily', pri: '1.0' },
    ...TAB_ORDER.map((t) => ({ loc: `${SITE}/${t}`, freq: 'weekly', pri: '0.8' })),
    ...STOCKS.map((s) => ({ loc: `${SITE}/stocks/${encodeURIComponent(s.ticker)}`, freq: 'weekly', pri: '0.6' })),
    ...ARTICLES.map((a) => ({ loc: `${SITE}/guide/${encodeURIComponent(a.id)}`, freq: 'monthly', pri: '0.6' })),
  ];
  const body = urls
    .map((u) => `  <url><loc>${escapeHtml(u.loc)}</loc><lastmod>${BUILD_DATE}</lastmod><changefreq>${u.freq}</changefreq><priority>${u.pri}</priority></url>`)
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), xml, 'utf-8');
  return urls.length;
}

function render(template, page) {
  return renderPage(template, {
    title: page.title,
    description: page.description,
    canonicalPath: page.path,
    bodyHtml: page.bodyHtml,
    jsonLd: page.jsonLd,
    noindex: page.noindex,
    withScripts: page.withScripts !== false,
  });
}

function main() {
  const template = readTemplate();

  for (const s of STOCKS) writeFile(path.join('stocks', s.ticker, 'index.html'), render(template, stockPage(s)));
  for (const a of ARTICLES) writeFile(path.join('guide', a.id, 'index.html'), render(template, articlePage(a)));
  for (const p of tabPages()) writeFile(path.join(p.path.slice(1), 'index.html'), render(template, p));
  writeFile('404.html', render(template, notFoundPage()));
  // 홈은 마지막에 덮어씀 — 위 페이지들이 모두 원본 dist/index.html을 템플릿으로 써야 하므로
  writeFile('index.html', render(template, homePage()));

  const urlCount = writeSitemap();
  console.log(`[prerender] 정적 페이지 생성 완료 (홈 1 + 탭 ${TAB_ORDER.length} + 종목 ${STOCKS.length} + 가이드 ${ARTICLES.length} + 404)`);
  console.log(`[sitemap] ${urlCount}개 URL로 sitemap.xml 자동 생성 완료`);
}

main();
