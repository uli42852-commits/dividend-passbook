import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Trash2, Pencil, X, BookOpen, Shield, Copy, Check, Sparkles, Star,
  Calculator, CalendarDays, Compass, LineChart, Sun, Moon, Download, Upload, Info,
  FileText, AlertTriangle, Mail, HelpCircle, Share2,
} from 'lucide-react';
import { ARTICLES, STOCKS, getRelatedStocks, getRelatedArticles } from '../data.js';

/* ── design tokens (CSS 변수로 연결 — prefers-color-scheme: dark 대응) ── */
const C = {
  cover: 'var(--pb-cover)',
  coverEdge: 'var(--pb-cover-edge)',
  foil: 'var(--pb-foil)',
  paper: 'var(--pb-paper)',
  paperLine: 'var(--pb-paper-line)',
  ink: 'var(--pb-ink)',
  inkSoft: 'var(--pb-ink-soft)',
  stamp: 'var(--pb-stamp)',
  brass: 'var(--pb-brass)',
  cardBg: 'var(--pb-card-bg)',
  line: 'var(--pb-line)',
  lineStrong: 'var(--pb-line-strong)',
  etf: 'var(--pb-etf)',
  reit: 'var(--pb-reit)',
};

const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
const STORAGE_KEY = 'dividend-passbook-v1';
const FAVORITES_KEY = 'dividend-passbook-favorites-v1';
const GOAL_KEY = 'dividend-passbook-goal-v1';
const RECENT_KEY = 'dividend-passbook-recent-v1';
const RECENT_MAX = 5;
const THIS_MONTH = new Date().getMonth() + 1;

/* ── 한글 초성 검색 ── */
const CHOSUNG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
function toChosung(str) {
  let out = '';
  for (const ch of String(str)) {
    const code = ch.charCodeAt(0);
    out += (code >= 0xAC00 && code <= 0xD7A3) ? CHOSUNG[Math.floor((code - 0xAC00) / 588)] : ch;
  }
  return out;
}
const isChosungQuery = (str) => /^[ㄱ-ㅎ]+$/.test(str);
const TAX = { KRW: 0.154, USD: 0.15 };
const FX_KRW_PER_USD = 1400; // 참고용 환산 환율, 실제 환율과 다를 수 있음

/* ── 계산 결과 공유 링크 인코딩/디코딩 ──────────────────────
   holdings 배열을 짧은 키의 배열 형태로 압축한 뒤 URL-safe base64로 인코딩해요.
   서버 저장 없이 URL 자체에 계산에 필요한 값만 담아서, 다른 브라우저·기기에서
   그 링크를 열면 같은 계산 결과가 재현되게 해요. */
function encodeShareState(holdings, afterTax) {
  const h = holdings.map((x) => [
    x.name, x.ticker || '', x.shares, x.avgPrice, x.annualDiv,
    (x.months || []).join(','), x.currency || 'KRW',
  ]);
  const json = JSON.stringify({ h, x: afterTax ? 1 : 0 });
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeShareState(b64) {
  try {
    const norm = String(b64).replace(/-/g, '+').replace(/_/g, '/');
    const pad = norm.length % 4 === 0 ? '' : '='.repeat(4 - (norm.length % 4));
    const json = decodeURIComponent(escape(atob(norm + pad)));
    const payload = JSON.parse(json);
    if (!payload || !Array.isArray(payload.h)) return null;

    const holdings = payload.h.map((arr, i) => {
      if (!Array.isArray(arr) || arr.length < 7) return null;
      const [name, ticker, shares, avgPrice, annualDiv, monthsStr, currency] = arr;
      if (typeof name !== 'string' || !name.trim()) return null;
      const sharesN = Number(shares), avgPriceN = Number(avgPrice), annualDivN = Number(annualDiv);
      if (!Number.isFinite(sharesN) || sharesN <= 0 || sharesN > 10_000_000) return null;
      if (!Number.isFinite(avgPriceN) || avgPriceN < 0 || avgPriceN > 1_000_000_000) return null;
      if (!Number.isFinite(annualDivN) || annualDivN < 0 || annualDivN > 100_000_000) return null;
      const months = String(monthsStr || '').split(',').map(Number).filter((m) => Number.isInteger(m) && m >= 1 && m <= 12);
      if (months.length === 0) return null;
      return {
        id: Date.now() + i,
        name: String(name).slice(0, 60),
        ticker: String(ticker || '').slice(0, 15),
        shares: sharesN, avgPrice: avgPriceN, annualDiv: annualDivN,
        months, currency: currency === 'USD' ? 'USD' : 'KRW',
      };
    }).filter(Boolean);

    if (holdings.length === 0) return null;
    return { holdings, afterTax: payload.x === 1 };
  } catch (e) {
    return null; // 잘못됐거나 변조된 URL — 조용히 무시하고 평소처럼 동작
  }
}

function fmt(n, cur) {
  if (cur === 'USD') return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return Math.round(n).toLocaleString('ko-KR') + '원';
}

function emptyForm() {
  return { name: '', ticker: '', shares: '', avgPrice: '', annualDiv: '', months: [], currency: 'KRW' };
}

const SAMPLE = [
  { id: 1, name: '코카콜라', ticker: 'KO', shares: 3, avgPrice: 60, annualDiv: 1.94, months: [4, 7, 10, 12], currency: 'USD' },
  { id: 2, name: '리얼티인컴', ticker: 'O', shares: 5, avgPrice: 55, annualDiv: 3.16, months: [1,2,3,4,5,6,7,8,9,10,11,12], currency: 'USD' },
  { id: 3, name: '삼성전자', ticker: '005930', shares: 10, avgPrice: 70000, annualDiv: 1444, months: [4, 5, 8, 11], currency: 'KRW' },
];

/* ── dividend guide articles (SEO content) — 데이터는 data.js로 분리됨 ── */

// deepId가 슬러그면 그대로, 예전 방식(숫자 인덱스, 예: 구 링크 #/guide/23)이면 그 인덱스의 글로 변환
function resolveArticle(deepId) {
  if (deepId == null) return null;
  const bySlug = ARTICLES.find((a) => a.id === deepId);
  if (bySlug) return bySlug;
  const idx = Number(deepId);
  if (Number.isInteger(idx) && ARTICLES[idx]) return ARTICLES[idx];
  return null;
}

// 가이드 글 본문에 실제로 언급된 종목 티커를 찾아 링크로 보여줌
function RelatedStocksForArticle({ article, onNavigate }) {
  const text = article.t + ' ' + article.p.join(' ');
  const mentioned = STOCKS.filter((s) => {
    const re = new RegExp(`\\b${s.ticker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    return re.test(text);
  }).slice(0, 4);
  if (!mentioned.length) return null;
  return (
    <div style={{ background: 'var(--pb-input-bg)', border: `1px solid ${C.line}`, borderRadius: 8, padding: '10px 12px', margin: '0 0 9px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.ink, marginBottom: 7 }}>📈 관련 종목</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {mentioned.map((s) => (
          <a key={s.ticker} href={`/stocks/${s.ticker}`} onClick={(e) => { e.preventDefault(); onNavigate?.('stocks', s.ticker); }}
            style={{ textDecoration: 'none', fontSize: 11, fontWeight: 600, color: C.cover, border: `1px solid ${C.lineStrong}`, borderRadius: 999, padding: '4px 10px' }}>
            {s.name}({s.ticker})
          </a>
        ))}
      </div>
    </div>
  );
}

function Articles({ deepId, onNavigate }) {
  const [q, setQ] = useState('');
  const [copiedIdx, setCopiedIdx] = useState(null);
  const query = q.trim().toLowerCase();
  const withIdx = ARTICLES.map((a, i) => ({ a, i }));
  const filtered = query
    ? withIdx.filter(({ a }) =>
        a.t.toLowerCase().includes(query) ||
        a.p.some((p) => p.toLowerCase().includes(query)) ||
        (isChosungQuery(query) && toChosung(a.t).includes(query))
      )
    : withIdx;

  useEffect(() => {
    if (!deepId) return;
    const target = resolveArticle(deepId);
    if (!target) return;
    const t = setTimeout(() => {
      const el = document.getElementById(`article-${target.id}`);
      if (el) {
        el.open = true;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
    return () => clearTimeout(t);
  }, [deepId]);

  const copyLink = (idx) => {
    const url = `${window.location.origin}/guide/${idx}`;
    try {
      navigator.clipboard.writeText(url);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1600);
    } catch (e) { /* clipboard unavailable */ }
  };

  return (
    <section style={{ marginTop: 6, marginBottom: 14 }}>
      <h2 style={{ fontFamily: "'Noto Serif KR', serif", fontWeight: 700, fontSize: 17, color: C.ink, margin: '0 0 4px' }}>
        배당 공부방
      </h2>
      <p style={{ fontSize: 11.5, color: C.inkSoft, margin: '0 0 12px' }}>
        배당 투자 전에 알아두면 좋은 내용을 정리했어요 (총 {ARTICLES.length}개 글)
      </p>
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="글 제목이나 키워드로 검색 (예: 세금, ISA, DRIP)"
          style={{
            width: '100%', background: 'var(--pb-input-bg)', borderRadius: 8, padding: '10px 34px 10px 12px',
            fontSize: 13, color: C.ink, border: `1px solid ${C.lineStrong}`, boxSizing: 'border-box',
            fontFamily: "'Noto Sans KR', sans-serif",
          }}
        />
        {q && (
          <button
            onClick={() => setQ('')}
            aria-label="검색어 지우기"
            style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'transparent', border: 'none', cursor: 'pointer', color: C.inkSoft, padding: 4,
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>
      {query && (
        <p style={{ fontSize: 11, color: C.inkSoft, margin: '0 0 10px' }}>
          {filtered.length > 0 ? `${filtered.length}개 글이 검색됐어요` : '검색 결과가 없어요. 다른 키워드로 찾아보세요'}
        </p>
      )}
      {filtered.map(({ a, i }) => (
        <details key={i} id={`article-${a.id}`} style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 10, marginBottom: 8, padding: '0 16px', overflow: 'hidden' }}>
          <summary style={{ padding: '13px 0', fontSize: 12.5, fontWeight: 700, color: C.ink, cursor: 'pointer' }}>
            {a.t}
          </summary>
          <div style={{ paddingBottom: 14 }}>
            {a.p.map((para, j) => (
              <p key={j} style={{ fontSize: 12, lineHeight: 1.8, color: C.inkSoft, margin: j === 0 ? '2px 0 9px' : '0 0 9px' }}>{para}</p>
            ))}
            <RelatedStocksForArticle article={a} onNavigate={onNavigate} />
            <button
              onClick={(e) => { e.preventDefault(); copyLink(a.id); }}
              style={{
                marginTop: 4, display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5,
                color: copiedIdx === a.id ? C.cover : C.inkSoft, background: 'transparent',
                border: `1px solid ${C.lineStrong}`, borderRadius: 7, padding: '6px 10px', cursor: 'pointer',
              }}
            >
              {copiedIdx === a.id ? <Check size={11} /> : <Copy size={11} />}
              {copiedIdx === a.id ? '링크 복사됨' : '이 글 링크 복사'}
            </button>
          </div>
        </details>
      ))}
      <p style={{ fontSize: 10.5, color: C.inkSoft, opacity: 0.7, margin: '10px 0 0', lineHeight: 1.6 }}>
        위 내용은 일반적인 정보 제공 목적이며 특정 종목 추천이 아닙니다. 배당금·수익률·세율은 변동될 수 있으니 투자 전 최신 공시를 확인하세요.
      </p>
    </section>
  );
}

/* ── 종목 분석 (팩트체크된 구조적 정보, 변하는 수치 제외) ────── */

function classifyAssetClass(ticker) {
  const s = STOCKS.find((x) => x.ticker === ticker);
  if (!s) return 'unknown';
  if (/ETF/i.test(s.typeTag)) return 'etf';
  if (/리츠|REIT/i.test(s.typeTag)) return 'reit';
  return 'stock';
}

function diagnosePortfolio(holdings) {
  if (holdings.length === 0) return null;

  const weighted = holdings.map((h) => {
    const principal = h.shares * h.avgPrice;
    const krwPrincipal = (h.currency || 'KRW') === 'USD' ? principal * FX_KRW_PER_USD : principal;
    return { ...h, krwPrincipal };
  });
  const total = weighted.reduce((s, h) => s + h.krwPrincipal, 0) || 1;

  // 1) 종목 집중도 (HHI)
  const weights = weighted.map((h) => h.krwPrincipal / total);
  const hhi = weights.reduce((s, w) => s + w * w, 0) * 10000;
  const concentrationScore = Math.max(0, Math.min(100, 100 - hhi / 100));
  const top = weighted.reduce((a, b) => (b.krwPrincipal > a.krwPrincipal ? b : a));
  const topWeightPct = (top.krwPrincipal / total) * 100;

  // 2) 월별 분산
  const coveredMonths = new Set();
  holdings.forEach((h) => h.months.forEach((m) => coveredMonths.add(m)));
  const monthScore = (coveredMonths.size / 12) * 100;
  const missingMonths = MONTHS.filter((_, i) => !coveredMonths.has(i + 1));

  // 3) 통화 분산
  const krw = weighted.filter((h) => (h.currency || 'KRW') === 'KRW').reduce((s, h) => s + h.krwPrincipal, 0);
  const krwPct = (krw / total) * 100;
  const singleCurrency = holdings.every((h) => (h.currency || 'KRW') === (holdings[0].currency || 'KRW'));
  const currencyScore = singleCurrency ? 40 : 100 - Math.abs(krwPct - 50) * 2;

  // 4) 자산군 분산 (종목분석 탭 데이터와 매칭)
  const classWeights = { stock: 0, etf: 0, reit: 0, unknown: 0 };
  weighted.forEach((h) => {
    classWeights[classifyAssetClass(h.ticker)] += h.krwPrincipal / total;
  });
  const classHhi = Object.values(classWeights).reduce((s, w) => s + w * w, 0) * 10000;
  const classScore = Math.max(0, Math.min(100, 100 - classHhi / 100));

  const score = Math.round(
    concentrationScore * 0.3 + monthScore * 0.3 + currencyScore * 0.15 + classScore * 0.25
  );

  let grade = 'D';
  if (score >= 90) grade = 'S';
  else if (score >= 78) grade = 'A';
  else if (score >= 62) grade = 'B';
  else if (score >= 45) grade = 'C';

  const feedback = [];
  if (topWeightPct > 35) {
    feedback.push(`${top.name} 비중이 전체의 ${topWeightPct.toFixed(0)}%예요. 한 종목에 쏠려 있으면 그 종목에 이슈가 생겼을 때 타격이 커요.`);
  }
  if (missingMonths.length > 0) {
    feedback.push(`${missingMonths.join(', ')}에는 배당이 없어요. 이 달에 지급하는 종목을 더하면 월배당 흐름이 완성돼요.`);
  }
  if (currencyScore < 60) {
    feedback.push(`현재 ${krwPct > 50 ? '원화' : '달러'} 종목에 쏠려 있어요. 다른 통화 종목을 섞으면 환율 분산 효과를 얻을 수 있어요.`);
  }
  if (classWeights.stock > 0.7) {
    feedback.push('개별 종목 비중이 높아요. ETF를 일부 섞으면 개별 기업 리스크를 줄일 수 있어요.');
  }
  if (feedback.length === 0) {
    feedback.push('종목·통화·월별로 고르게 분산돼 있어요. 지금 구성을 잘 유지해보세요.');
  }

  return { score, grade, concentrationScore, monthScore, currencyScore, classScore, feedback };
}

function PortfolioDiagnosis({ holdings }) {
  const d = diagnosePortfolio(holdings);
  if (!d) return null;
  const gradeColor = { S: C.brass, A: C.cover, B: '#8a7a3f', C: C.stamp, D: C.stamp }[d.grade];
  return (
    <div style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
        <div style={{
          width: 62, height: 62, borderRadius: '50%', border: `2.5px solid ${gradeColor}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          fontFamily: "'Noto Serif KR', serif", fontWeight: 900, fontSize: 26, color: gradeColor,
        }}>
          {d.grade}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>통장 분산도 진단</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{d.score}점</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 12 }}>
        {[
          ['종목 집중도', d.concentrationScore],
          ['월별 분산', d.monthScore],
          ['통화 분산', d.currencyScore],
          ['자산군 분산', d.classScore],
        ].map(([label, v]) => (
          <div key={label} style={{ fontSize: 10.5, color: C.inkSoft }}>
            {label}
            <div style={{ height: 5, borderRadius: 3, background: C.line, marginTop: 4, overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(0, Math.min(100, v))}%`, height: '100%', background: C.cover }} />
            </div>
          </div>
        ))}
      </div>
      {d.feedback.map((f, i) => (
        <p key={i} style={{ fontSize: 11.5, lineHeight: 1.7, color: C.inkSoft, margin: '0 0 6px' }}>
          · {f}
        </p>
      ))}
    </div>
  );
}

const FINANCIAL_INCOME_THRESHOLD = 20000000; // 금융소득종합과세 기준선 (연 2,000만원)

function calcTotalAnnualDividendKRW(holdings) {
  return holdings.reduce((sum, h) => {
    const annual = h.shares * h.annualDiv;
    const krw = (h.currency || 'KRW') === 'USD' ? annual * FX_KRW_PER_USD : annual;
    return sum + krw;
  }, 0);
}

function TaxThresholdCheck({ holdings }) {
  const [otherIncome, setOtherIncome] = useState('');
  if (holdings.length === 0) return null;

  const dividendKRW = calcTotalAnnualDividendKRW(holdings);
  const otherNum = parseFloat(otherIncome) || 0;
  const total = dividendKRW + otherNum;
  const pct = Math.min(100, (total / FINANCIAL_INCOME_THRESHOLD) * 100);
  const over = total >= FINANCIAL_INCOME_THRESHOLD;
  const near = !over && total >= FINANCIAL_INCOME_THRESHOLD * 0.8;
  const barColor = over ? C.stamp : near ? C.brass : C.cover;

  const inputStyle = {
    width: '100%', background: 'var(--pb-input-bg)', borderRadius: 7, padding: '10px 11px', fontSize: 14,
    color: C.ink, border: `1px solid ${C.lineStrong}`, boxSizing: 'border-box',
    fontFamily: "'Noto Sans KR', sans-serif", marginBottom: 12,
  };

  return (
    <div style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, marginBottom: 18 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 10 }}>
        금융소득종합과세 체크
      </div>
      <label style={{ display: 'block', fontSize: 11, color: C.inkSoft, marginBottom: 5, fontWeight: 600 }}>
        이 통장 밖의 다른 이자·배당소득 (연간, 세전, 원화)
      </label>
      <input
        type="number" inputMode="decimal" min="0"
        value={otherIncome}
        onChange={(e) => setOtherIncome(e.target.value)}
        placeholder="0"
        style={inputStyle}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 11, color: C.inkSoft, marginBottom: 6 }}>
        <span>합산 금융소득 (세전, 원화 환산)</span>
        <span style={{ fontWeight: 700, color: C.ink, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
          {Math.round(total).toLocaleString('ko-KR')}원
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: C.line, overflow: 'hidden', marginBottom: 10 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: barColor, transition: 'width .3s ease' }} />
      </div>
      <p style={{ fontSize: 11.5, lineHeight: 1.7, color: over ? C.stamp : C.inkSoft, margin: 0, fontWeight: over ? 700 : 500 }}>
        {over
          ? '기준선(연 2,000만원)을 넘었어요. 다음 해 5월 종합소득세 신고 때 다른 소득과 합산해 신고해야 할 수 있어요.'
          : near
          ? '기준선(연 2,000만원)에 가까워지고 있어요. 배당이 더 늘어나면 종합과세 대상이 될 수 있어요.'
          : '연 2,000만원 기준선까지 아직 여유가 있어요.'}
      </p>
      <p style={{ fontSize: 10, color: C.inkSoft, opacity: 0.7, marginTop: 8, lineHeight: 1.6 }}>
        이미 원천징수된 세금은 기납부세액으로 인정돼요. 정확한 신고 여부는 세무 전문가와 상담하세요. 달러 배당은 참고 환율({FX_KRW_PER_USD.toLocaleString('ko-KR')}원/달러)로 환산한 근사치예요.
      </p>
    </div>
  );
}

const PAGE_SIZE = 24;

// 문자 티커이지만 미국 종목이 아닌 것들(캐나다·영국·유럽·싱가포르·대만 등)
const NON_US_LETTER_TICKERS = new Set([
  'UL', 'NESN', 'BTI', 'HSBC', 'DEO', 'AZN', 'NVS', 'ROG', 'TTE', 'ALV',
  'BASFY', 'BHP', 'RIO', 'SIEGY', 'URW', 'ENB', 'RY', 'BCE', 'TRP', 'FTS',
  'D05', 'O39', 'U11', 'TSM',
]);

function tagColorFor(typeTag) {
  if (/삭감|중단|사례|리셋/.test(typeTag)) return C.stamp;
  if (/ETF/i.test(typeTag)) return C.etf;
  if (/리츠|REIT/i.test(typeTag)) return C.reit;
  return C.brass;
}

const STOCK_FILTERS = [
  { v: 'all', t: '전체', test: () => true },
  { v: 'kr', t: '한국', test: (s) => /^\d{6}$/.test(s.ticker) },
  { v: 'us', t: '미국', test: (s) => !/^\d/.test(s.ticker) && !NON_US_LETTER_TICKERS.has(s.ticker) },
  { v: 'monthly', t: '월배당', test: (s) => MONTHLY_TICKERS.has(s.ticker) },
  { v: 'weekly', t: '주배당', test: (s) => WEEKLY_TICKERS.has(s.ticker) },
  { v: 'reit', t: '리츠', test: (s) => /리츠|REIT/i.test(s.typeTag) },
  { v: 'etf', t: 'ETF', test: (s) => /ETF/i.test(s.typeTag) },
  { v: 'king', t: '배당킹·귀족', test: (s) => /배당킹|배당귀족/.test(s.typeTag) },
  { v: 'cut', t: '배당삭감 사례', test: (s) => /삭감|중단|사례|리셋/.test(s.typeTag) },
];

// 종목 카드 안에 보여주는 "비슷한 종목·관련 가이드" — 실제 <a href> 링크, 클릭하면 해당 상세로 이동
function RelatedLinks({ stock, onNavigate }) {
  const relStocks = getRelatedStocks(stock.ticker, 4);
  const relArticles = getRelatedArticles(stock.ticker, stock.name, 3);
  if (!relStocks.length && !relArticles.length) return null;
  return (
    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {relArticles.length > 0 && (
        <div style={{ background: 'var(--pb-input-bg)', border: `1px solid ${C.line}`, borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.ink, marginBottom: 7 }}>📚 관련 가이드</div>
          {relArticles.map((a) => (
            <a key={a.id} href={`/guide/${a.id}`} onClick={(e) => { e.preventDefault(); onNavigate?.('guide', a.id); }}
              style={{ display: 'block', textDecoration: 'none', padding: '5px 0' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.cover }}>{a.t}</div>
              <div style={{ fontSize: 10.5, color: C.inkSoft, marginTop: 2, lineHeight: 1.5 }}>{a.p[0].slice(0, 60)}...</div>
            </a>
          ))}
        </div>
      )}
      {relStocks.length > 0 && (
        <div style={{ background: 'var(--pb-input-bg)', border: `1px solid ${C.line}`, borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.ink, marginBottom: 7 }}>📈 비슷한 종목</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {relStocks.map((r) => (
              <a key={r.ticker} href={`/stocks/${r.ticker}`} onClick={(e) => { e.preventDefault(); onNavigate?.('stocks', r.ticker); }}
                style={{ textDecoration: 'none', fontSize: 11, fontWeight: 600, color: C.cover, border: `1px solid ${C.lineStrong}`, borderRadius: 999, padding: '4px 10px' }}>
                {r.name}({r.ticker})
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StockCards({ deepId, onNavigate }) {
  const [q, setQ] = useState('');
  const [chip, setChip] = useState('all');
  const [onlyFav, setOnlyFav] = useState(false);
  const [favs, setFavs] = useState(() => new Set());
  const [favLoaded, setFavLoaded] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [copiedTicker, setCopiedTicker] = useState(null);
  const [recent, setRecent] = useState([]);
  const query = q.trim().toLowerCase();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (raw) setRecent(JSON.parse(raw));
    } catch (e) { /* first visit */ }
  }, []);

  const recordView = (ticker) => {
    setRecent((prev) => {
      const next = [ticker, ...prev.filter((t) => t !== ticker)].slice(0, RECENT_MAX);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch (e) { /* ignore */ }
      return next;
    });
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      if (raw) setFavs(new Set(JSON.parse(raw)));
    } catch (e) { /* first visit */ }
    setFavLoaded(true);
  }, []);

  useEffect(() => {
    if (!favLoaded) return;
    try { localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favs])); } catch (e) { /* ignore */ }
  }, [favs, favLoaded]);

  const toggleFav = (ticker) => {
    setFavs((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker); else next.add(ticker);
      return next;
    });
  };

  const chipTest = STOCK_FILTERS.find((f) => f.v === chip)?.test || (() => true);
  const filtered = STOCKS.filter((s) => {
    if (query && !(
      s.name.toLowerCase().includes(query) ||
      s.ticker.toLowerCase().includes(query) ||
      s.typeTag.toLowerCase().includes(query) ||
      (isChosungQuery(query) && toChosung(s.name).includes(query))
    )) return false;
    if (!chipTest(s)) return false;
    if (onlyFav && !favs.has(s.ticker)) return false;
    return true;
  });

  useEffect(() => { setVisible(PAGE_SIZE); }, [query, chip, onlyFav]);

  useEffect(() => {
    if (!deepId) return;
    const idx = filtered.findIndex((s) => s.ticker === deepId);
    if (idx >= 0 && idx >= visible) setVisible(idx + PAGE_SIZE);
    const t = setTimeout(() => {
      const el = document.getElementById(`stock-${deepId}`);
      if (el) {
        el.open = true;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
    return () => clearTimeout(t);
  }, [deepId, filtered, visible]);

  const shown = filtered.slice(0, visible);

  const jumpToStock = (ticker) => {
    const idx = filtered.findIndex((s) => s.ticker === ticker);
    if (idx >= 0 && idx >= visible) setVisible(idx + PAGE_SIZE);
    setTimeout(() => {
      const el = document.getElementById(`stock-${ticker}`);
      if (el) { el.open = true; el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    }, 60);
  };

  const copyLink = (ticker) => {
    const url = `${window.location.origin}/stocks/${ticker}`;
    try {
      navigator.clipboard.writeText(url);
      setCopiedTicker(ticker);
      setTimeout(() => setCopiedTicker(null), 1600);
    } catch (e) { /* clipboard unavailable */ }
  };

  return (
    <section style={{ marginTop: 6, marginBottom: 14 }}>
      <h2 style={{ fontFamily: "'Noto Serif KR', serif", fontWeight: 700, fontSize: 17, color: C.ink, margin: '0 0 4px' }}>
        종목 분석
      </h2>
      <p style={{ fontSize: 11.5, color: C.inkSoft, margin: '0 0 12px' }}>
        변하지 않는 구조적 사실 위주로 정리했어요. 배당수익률·주가는 매일 바뀌니 공식 출처에서 최신 수치를 확인하세요 (총 {STOCKS.length}종목)
      </p>
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="종목명, 티커, 유형으로 검색 (예: 리츠, SCHD, 배당킹)"
          style={{
            width: '100%', background: 'var(--pb-input-bg)', borderRadius: 8, padding: '10px 34px 10px 12px',
            fontSize: 13, color: C.ink, border: `1px solid ${C.lineStrong}`, boxSizing: 'border-box',
            fontFamily: "'Noto Sans KR', sans-serif",
          }}
        />
        {q && (
          <button
            onClick={() => setQ('')}
            aria-label="검색어 지우기"
            style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'transparent', border: 'none', cursor: 'pointer', color: C.inkSoft, padding: 4,
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {!query && recent.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 4, WebkitOverflowScrolling: 'touch' }}>
          <span style={{ fontSize: 10.5, color: C.inkSoft, flexShrink: 0 }}>최근 본 종목</span>
          {recent.map((ticker) => {
            const s = STOCKS.find((x) => x.ticker === ticker);
            if (!s) return null;
            return (
              <button key={ticker} onClick={() => jumpToStock(ticker)} style={{
                flexShrink: 0, padding: '5px 11px', borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${C.lineStrong}`, background: 'transparent', color: C.inkSoft, whiteSpace: 'nowrap',
              }}>
                {s.name}
              </button>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 4, WebkitOverflowScrolling: 'touch' }}>
        {STOCK_FILTERS.map((f) => {
          const on = chip === f.v;
          return (
            <button key={f.v} onClick={() => setChip(f.v)} style={{
              flexShrink: 0, padding: '6px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${on ? C.cover : C.lineStrong}`,
              background: on ? C.cover : 'transparent', color: on ? C.foil : C.inkSoft, whiteSpace: 'nowrap',
            }}>
              {f.t}
            </button>
          );
        })}
        <button onClick={() => setOnlyFav((v) => !v)} style={{
          flexShrink: 0, padding: '6px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4,
          border: `1px solid ${onlyFav ? C.brass : C.lineStrong}`,
          background: onlyFav ? C.brass : 'transparent', color: onlyFav ? '#fff' : C.inkSoft, whiteSpace: 'nowrap',
        }}>
          <Star size={11} fill={onlyFav ? '#fff' : 'none'} /> 즐겨찾기{favs.size > 0 ? ` (${favs.size})` : ''}
        </button>
      </div>
      <p style={{ fontSize: 11, color: C.inkSoft, margin: '6px 0 10px' }}>
        {filtered.length}개 종목{query || chip !== 'all' || onlyFav ? ' 표시 중' : ''}
        {filtered.length === 0 && ' · 다른 조건으로 찾아보세요'}
      </p>
      {shown.map((s) => {
        const isFav = favs.has(s.ticker);
        return (
          <details key={s.ticker} id={`stock-${s.ticker}`} onToggle={(e) => { if (e.target.open) recordView(s.ticker); }} style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 10, marginBottom: 8, padding: '0 16px', overflow: 'hidden' }}>
            <summary style={{ padding: '13px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, listStyle: 'none' }}>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFav(s.ticker); }}
                aria-label={isFav ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', flexShrink: 0 }}
              >
                <Star size={14} color={isFav ? C.brass : C.inkSoft} fill={isFav ? C.brass : 'none'} />
              </button>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: C.ink }}>{s.name}</span>
              <span style={{ fontSize: 10, color: C.inkSoft }}>{s.ticker}</span>
              <span style={{ marginLeft: 'auto', fontSize: 9.5, fontWeight: 700, color: tagColorFor(s.typeTag), border: `1px solid ${tagColorFor(s.typeTag)}`, borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                {s.typeTag}
              </span>
            </summary>
            <div style={{ paddingBottom: 15 }}>
              <p style={{ fontSize: 11.5, lineHeight: 1.7, color: C.inkSoft, margin: '2px 0 10px', fontFamily: "'IBM Plex Mono', monospace" }}>
                {s.basic}
              </p>
              {s.detail.map((p, i) => (
                <p key={i} style={{ fontSize: 12, lineHeight: 1.8, color: C.inkSoft, margin: '0 0 9px' }}>{p}</p>
              ))}
              <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--pb-stamp-06)', borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.stamp, marginBottom: 5 }}>주의할 점</div>
                {s.caution.map((c, i) => (
                  <p key={i} style={{ fontSize: 11.5, lineHeight: 1.7, color: C.inkSoft, margin: '0 0 5px' }}>· {c}</p>
                ))}
              </div>
              <RelatedLinks stock={s} onNavigate={onNavigate} />
              <button
                onClick={(e) => { e.preventDefault(); copyLink(s.ticker); }}
                style={{
                  marginTop: 10, display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5,
                  color: copiedTicker === s.ticker ? C.cover : C.inkSoft, background: 'transparent',
                  border: `1px solid ${C.lineStrong}`, borderRadius: 7, padding: '6px 10px', cursor: 'pointer',
                }}
              >
                {copiedTicker === s.ticker ? <Check size={11} /> : <Copy size={11} />}
                {copiedTicker === s.ticker ? '링크 복사됨' : '이 종목 링크 복사'}
              </button>
            </div>
          </details>
        );
      })}
      {visible < filtered.length && (
        <button
          onClick={() => setVisible((v) => v + PAGE_SIZE)}
          style={{
            width: '100%', padding: '12px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
            background: 'transparent', color: C.cover, border: `1px solid ${C.cover}`, marginTop: 4, marginBottom: 4,
          }}
        >
          {filtered.length - visible}개 더보기 ({visible}/{filtered.length})
        </button>
      )}
      <p style={{ fontSize: 10.5, color: C.inkSoft, opacity: 0.7, margin: '10px 0 0', lineHeight: 1.6 }}>
        위 내용은 일반적인 정보 제공 목적이며 특정 종목에 대한 매수·매도 추천이 아니에요. 배당수익률·주가·최근 공시는 각 운용사·기업 공식 출처에서 확인하세요.
      </p>
    </section>
  );
}

// 월배당 지급 종목 티커 (종목분석 탭의 "월배당" 필터 칩에서 사용)
const MONTHLY_TICKERS = new Set([
  'O', 'JEPI', '458730', '458760', '429000', '329200', '472150', '402970',
  '489250', '446720', '452360', '441640', 'ADC', 'STAG',
  'AGNC', 'MAIN', 'EPR', 'PSEC', 'GLAD', 'GAIN', 'LAND', 'GOOD', 'LTC',
  'APLE', 'ORC', 'DX', 'HRZN', 'PFLT', 'EFC', 'ARR', 'PVL',
  'JEPQ', 'QYLD', 'XYLD', 'DIVO', 'PDI', 'RYLD',
  'SPHD', 'PFF', 'SPYI', 'QQQI', 'GPIQ',
  'PFFA', 'UTG', 'PTY', 'CLM', 'GOF',
  'CRF', 'ECC', 'OXLC', 'EIC', 'PDO',
  'DOC', 'UDR', 'CSWC', 'TRIN', 'GRP.U',
  'BST', 'RQI', 'FFC', 'PDT',
  'PFD', 'PFO', 'FLC', 'DFP',
  'NCV', 'NCZ', 'JQC', 'EVV', 'EFT',
]);

// 주배당(매주) 지급 종목 티커 (종목분석 탭의 "주배당" 필터 칩에서 사용)
const WEEKLY_TICKERS = new Set(['MSTY', 'PLTY', 'TSLY', 'NVDY', 'CONY', 'YMAX', 'YMAG', 'ULTY', 'AMZY', 'AMDY', 'APLY', 'GOOY', 'CVNY', 'NFLY', 'MSFO', 'SNOY', 'GMEY', 'HOOY', 'RBLY', 'BABO', 'PYPY', 'MARO', 'JPMO', 'OARK', 'DISO', 'XOMO', 'BRKC', 'YBIT', 'RDYY', 'MRNY', 'SHOY', 'PDDY', 'JDY', 'DRAY', 'GPTY', 'GDXY', 'CHPY', 'SMCY', 'LFGY', 'MINY', 'AIYY', 'CRSH', 'DIPS', 'WNTR', 'SLTY', 'FIAT', 'YQQQ', 'QDTY']);


/* ── 유형 찾기 (3문항 점수제, 종목 추천 아닌 유형 안내) ───────── */
const TYPE_QUESTIONS = [
  {
    q: '배당을 받는 가장 큰 목적은?',
    options: [
      { t: '매달 생활비처럼 받고 싶어요', score: { monthly: 2, highyield: 1 } },
      { t: '오래 묻어두고 자산을 불리고 싶어요', score: { growth: 2, king: 1 } },
      { t: '지금 당장 현금흐름이 최대한 많았으면 좋겠어요', score: { highyield: 2, monthly: 1 } },
    ],
  },
  {
    q: '주가가 출렁일 때 나는?',
    options: [
      { t: '변동성 있어도 수익률이 높으면 괜찮아요', score: { highyield: 2 } },
      { t: '조금 흔들려도 배당이 꾸준히 늘면 안심돼요', score: { growth: 2, king: 1 } },
      { t: '무엇보다 안정적인 게 최우선이에요', score: { king: 2, monthly: 1 } },
    ],
  },
  {
    q: '투자 관리 스타일은?',
    options: [
      { t: 'ETF처럼 여러 종목에 자동으로 분산되는 게 편해요', score: { growth: 2, highyield: 1 } },
      { t: '익숙한 개별 우량 기업을 직접 골라 오래 갖고 가고 싶어요', score: { king: 2, monthly: 1 } },
    ],
  },
];

const TYPE_RESULTS = {
  monthly: {
    title: '월배당 안정형',
    desc: '매달 꼬박꼬박 들어오는 현금 흐름을 가장 중요하게 여기는 유형이에요. 부동산을 임대하고 그 임대수익을 나눠주는 리츠(REITs)처럼, 법적으로 자주 배당을 지급하는 구조의 자산이 잘 맞아요.',
    watch: '리츠는 대출을 많이 쓰는 구조라 금리 변화에 민감할 수 있어요. 배당수익률만 보지 말고 임대율·부채 수준도 함께 살펴보는 습관이 필요해요.',
  },
  growth: {
    title: '배당성장형',
    desc: '지금 당장의 수익률보다 시간이 지날수록 배당이 꾸준히 늘어나는 걸 중요하게 여기는 유형이에요. 10년 이상 배당을 늘려온 기업들을 모아놓은 배당성장 ETF 같은 자산이 잘 맞아요.',
    watch: '초반 수익률이 낮게 느껴질 수 있어요. 배당 자체보다 "매년 얼마나 늘었는지" 성장률을 기준으로 판단하는 게 이 유형에는 더 중요해요.',
  },
  highyield: {
    title: '고배당 현금흐름형',
    desc: '지금 당장 높은 현금흐름이 중요한 유형이에요. 옵션 프리미엄 같은 부가 수익을 더해 분배율을 높이는 커버드콜형 ETF 같은 자산이 잘 맞아요.',
    watch: '분배금이 시장 상황에 따라 매달 달라질 수 있고, 강한 상승장에서는 주가 상승분을 다 누리지 못할 수 있어요. 분배율만 보지 말고 구조를 이해하고 접근하는 게 중요해요.',
  },
  king: {
    title: '배당킹 안정형',
    desc: '오래 검증된 우량 기업을 직접 골라 배당이 끊길 걱정 없이 길게 들고 가는 걸 선호하는 유형이에요. 25년, 50년 넘게 배당을 늘려온 배당귀족·배당킹 개별 기업이 잘 맞아요.',
    watch: '이미 성숙한 대형 기업이라 주가나 배당 성장 속도가 완만한 편이에요. 빠른 수익을 기대하기보다 긴 호흡으로 접근하는 유형이에요.',
  },
};

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function DividendCalendar({ holdings }) {
  const [monthOffset, setMonthOffset] = useState(0);

  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const year = base.getFullYear();
  const monthIdx = base.getMonth(); // 0-11
  const monthNum = monthIdx + 1;
  const isCurrentMonth = monthOffset === 0;

  const payers = holdings.filter((h) => h.months.includes(monthNum));

  const firstWeekday = new Date(year, monthIdx, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const todayDate = isCurrentMonth ? now.getDate() : -1;

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const navBtn = {
    width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.lineStrong}`, background: 'transparent',
    color: C.ink, fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  return (
    <section style={{ marginTop: 6, marginBottom: 14 }}>
      <h2 style={{ fontFamily: "'Noto Serif KR', serif", fontWeight: 700, fontSize: 17, color: C.ink, margin: '0 0 4px' }}>
        배당 달력
      </h2>
      <p style={{ fontSize: 11.5, color: C.inkSoft, margin: '0 0 14px' }}>
        보유 종목이 이 달에 배당을 지급하는지 한눈에 확인하세요
      </p>

      {holdings.length === 0 ? (
        <div style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 12, padding: '28px 16px', textAlign: 'center' }}>
          <p style={{ fontSize: 12.5, color: C.inkSoft, margin: 0, lineHeight: 1.7 }}>
            계산기 탭에서 종목을 먼저 기입하면<br />이 달력에 배당 예정 종목이 표시돼요
          </p>
        </div>
      ) : (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 12,
          }}>
            <button onClick={() => setMonthOffset((v) => v - 1)} aria-label="이전 달" style={navBtn}>‹</button>
            <div style={{ fontFamily: "'Noto Serif KR', serif", fontWeight: 700, fontSize: 15, color: C.ink }}>
              {year}년 {monthNum}월
            </div>
            <button onClick={() => setMonthOffset((v) => v + 1)} aria-label="다음 달" style={navBtn}>›</button>
          </div>

          <div style={{
            background: payers.length > 0 ? 'var(--pb-stamp-06)' : C.cardBg,
            border: `1px solid ${payers.length > 0 ? 'var(--pb-stamp-25)' : C.line}`,
            borderRadius: 10, padding: '12px 14px', marginBottom: 12,
          }}>
            {payers.length > 0 ? (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.stamp, marginBottom: 7 }}>
                  이 달 배당 예정 · {payers.length}종목
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {payers.map((h) => (
                    <span key={h.id} style={{
                      fontSize: 11, fontWeight: 700, color: C.ink, background: C.cardBg,
                      border: `1px solid ${C.lineStrong}`, borderRadius: 999, padding: '4px 10px',
                    }}>
                      {h.name}{h.ticker ? ` · ${h.ticker}` : ''}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p style={{ fontSize: 11.5, color: C.inkSoft, margin: 0 }}>이 달엔 예정된 배당이 없어요.</p>
            )}
          </div>

          <div style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 12, padding: '12px 10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 6 }}>
              {WEEKDAY_LABELS.map((w) => (
                <div key={w} style={{ textAlign: 'center', fontSize: 10.5, fontWeight: 700, color: C.inkSoft }}>{w}</div>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {week.map((d, di) => {
                  const isToday = d === todayDate;
                  return (
                    <div key={di} style={{
                      textAlign: 'center', padding: '7px 0', fontSize: 11.5,
                      color: d === null ? 'transparent' : (isToday ? C.foil : C.ink),
                      fontWeight: isToday ? 700 : 500,
                    }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 22, height: 22, borderRadius: '50%',
                        background: isToday ? C.cover : 'transparent',
                      }}>
                        {d ?? '·'}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <p style={{ fontSize: 10.5, color: C.inkSoft, opacity: 0.7, margin: '10px 0 0', lineHeight: 1.6 }}>
            정확한 지급일(며칠)은 종목마다 달라요. 이 달력은 "몇 월에 배당이 있는지"만 알려드리며, 정확한 배당락일·지급일은 각 기업 IR이나 증권사 앱에서 확인하세요.
          </p>
        </>
      )}
    </section>
  );
}

function TypeFinder() {
  const [answers, setAnswers] = useState([null, null, null]);
  const [done, setDone] = useState(false);

  const pick = (qi, oi) => {
    const next = [...answers]; next[qi] = oi; setAnswers(next);
  };

  const canSee = answers.every((a) => a !== null);

  const result = (() => {
    const score = { monthly: 0, growth: 0, highyield: 0, king: 0 };
    answers.forEach((oi, qi) => {
      if (oi === null) return;
      const s = TYPE_QUESTIONS[qi].options[oi].score;
      Object.keys(s).forEach((k) => { score[k] += s[k]; });
    });
    let best = 'monthly'; let bestScore = -1;
    Object.keys(score).forEach((k) => { if (score[k] > bestScore) { bestScore = score[k]; best = k; } });
    return TYPE_RESULTS[best];
  })();

  const reset = () => { setAnswers([null, null, null]); setDone(false); };

  return (
    <section style={{ marginTop: 6, marginBottom: 14 }}>
      <h2 style={{ fontFamily: "'Noto Serif KR', serif", fontWeight: 700, fontSize: 17, color: C.ink, margin: '0 0 4px' }}>
        배당 유형 찾기
      </h2>
      <p style={{ fontSize: 11.5, color: C.inkSoft, margin: '0 0 14px' }}>
        질문 3개에 답하면 나한테 맞는 배당 유형을 알려드려요
      </p>

      {!done && (
        <>
          {TYPE_QUESTIONS.map((q, qi) => (
            <div key={qi} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, marginBottom: 8 }}>{qi + 1}. {q.q}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {q.options.map((o, oi) => {
                  const on = answers[qi] === oi;
                  return (
                    <button key={oi} onClick={() => pick(qi, oi)} style={{
                      textAlign: 'left', padding: '10px 12px', borderRadius: 8, fontSize: 12.5,
                      border: `1px solid ${on ? C.cover : C.lineStrong}`,
                      background: on ? C.cover : C.cardBg, color: on ? C.foil : C.ink,
                      cursor: 'pointer', fontWeight: on ? 700 : 500,
                    }}>
                      {o.t}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <button disabled={!canSee} onClick={() => setDone(true)} style={{
            width: '100%', padding: '12px', borderRadius: 8, fontSize: 14, fontWeight: 700,
            cursor: canSee ? 'pointer' : 'default',
            background: canSee ? C.cover : C.line, color: canSee ? C.foil : C.inkSoft,
            border: 'none', marginTop: 4,
          }}>
            내 배당 유형 보기
          </button>
        </>
      )}

      {done && (
        <div style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 11, color: C.brass, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>내 배당 유형</div>
          <h3 style={{ margin: '0 0 10px', fontFamily: "'Noto Serif KR', serif", fontSize: 19, color: C.ink }}>{result.title}</h3>
          <p style={{ fontSize: 12.5, lineHeight: 1.75, color: C.inkSoft, margin: '0 0 12px' }}>{result.desc}</p>
          <p style={{ fontSize: 11.5, lineHeight: 1.7, color: C.inkSoft, margin: '0 0 14px', padding: '10px 12px', background: 'var(--pb-stamp-06)', borderRadius: 8 }}>
            <b style={{ color: C.stamp }}>주의할 점.</b> {result.watch}
          </p>
          <button onClick={reset} style={{ fontSize: 11.5, color: C.inkSoft, background: 'transparent', border: `1px solid ${C.lineStrong}`, borderRadius: 8, padding: '8px 14px', cursor: 'pointer' }}>
            다시 답하기
          </button>
        </div>
      )}

      <p style={{ fontSize: 10.5, color: C.inkSoft, opacity: 0.7, margin: '14px 0 0', lineHeight: 1.6 }}>
        이 결과는 배당 유형을 이해하기 위한 참고용 안내이며 특정 종목이나 상품에 대한 매수 추천이 아니에요. '종목분석' 탭에서 각 유형에 해당하는 예시를 살펴보실 수 있어요.
      </p>
    </section>
  );
}

/* ── small pieces ──────────────────────────────────────────── */
function Ruled({ children, style }) {
  return (
    <div style={{
      background: `repeating-linear-gradient(${C.cardBg}, ${C.cardBg} 27px, ${C.paperLine} 27px, ${C.paperLine} 28px)`,
      border: `1px solid ${C.line}`, borderRadius: 10, boxSizing: 'border-box', ...style,
    }}>
      {children}
    </div>
  );
}

function Stamp({ value, sub }) {
  return (
    <div aria-label={`연간 예상 배당 ${value}`} style={{
      width: 132, height: 132, borderRadius: '50%', border: `3px solid ${C.stamp}`,
      color: C.stamp, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      transform: 'rotate(-6deg)', flexShrink: 0, background: 'var(--pb-stamp-04)',
      boxShadow: 'inset 0 0 0 1px var(--pb-stamp-35)',
    }}>
      <span style={{ fontSize: 10, letterSpacing: 3, fontWeight: 700 }}>연간 배당</span>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: value.length > 11 ? 14 : 17, fontWeight: 700, marginTop: 4, textAlign: 'center', lineHeight: 1.25, padding: '0 8px', wordBreak: 'keep-all' }}>
        {value}
      </span>
      {sub && <span style={{ fontSize: 9.5, marginTop: 3, opacity: 0.85 }}>{sub}</span>}
    </div>
  );
}

function CurrencyBadge({ cur }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: 0.5, padding: '2px 7px', borderRadius: 999,
      background: cur === 'USD' ? 'rgba(31,61,46,0.10)' : 'rgba(184,134,60,0.14)',
      color: cur === 'USD' ? C.cover : C.brass,
    }}>
      {cur === 'USD' ? 'USD' : 'KRW'}
    </span>
  );
}

function Bars({ data, cur }) {
  const max = Math.max(0.0001, ...data);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 96 }}>
        {data.map((v, i) => {
          const isNow = i + 1 === THIS_MONTH;
          const h = v > 0 ? Math.max(6, (v / max) * 96) : 3;
          return (
            <div key={i} title={fmt(v, cur)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
              <div style={{
                width: '100%', maxWidth: 20, height: h, borderRadius: '3px 3px 1px 1px',
                background: v > 0 ? (isNow ? C.stamp : C.cover) : C.line,
                opacity: v > 0 ? (isNow ? 1 : 0.85) : 1,
                transition: 'height .35s ease',
              }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
        {MONTHS.map((_, i) => (
          <div key={i} style={{
            flex: 1, textAlign: 'center', fontSize: 9,
            color: i + 1 === THIS_MONTH ? C.stamp : C.inkSoft,
            fontWeight: i + 1 === THIS_MONTH ? 700 : 400,
          }}>
            {i + 1}
          </div>
        ))}
      </div>
    </div>
  );
}

function Fold({ icon: Icon, title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', padding: '13px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: C.ink,
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Icon size={13} color={C.cover} /> {title}</span>
        <span style={{ color: C.inkSoft, fontSize: 10.5, fontWeight: 500 }}>{open ? '접기' : '펼치기'}</span>
      </button>
      {open && <div style={{ padding: '0 16px 15px' }}>{children}</div>}
    </div>
  );
}

/* ── 라우팅 (URL: /calc, /find, /stocks, /stocks/TICKER, /guide, /guide/N — 예전 해시 링크 #/guide/N 등도 하위호환으로 계속 인식) ── */
function parseHash() {
  if (typeof window === 'undefined') return { tab: null, deepId: null };
  const validTabs = ['calc', 'calendar', 'find', 'stocks', 'guide'];

  const path = window.location.pathname.replace(/^\/+|\/+$/g, '');
  if (path) {
    const [pseg1, pseg2] = path.split('/').filter(Boolean);
    if (validTabs.includes(pseg1)) return { tab: pseg1, deepId: pseg2 || null };
  }

  // 예전에 공유된 해시 링크(#/guide/5, #/stocks/AAPL 등) 하위호환
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [seg1, seg2] = raw.split('/').filter(Boolean);
  const tab = validTabs.includes(seg1) ? seg1 : null; // null = URL에 명시된 탭 없음
  return { tab, deepId: seg2 || null };
}

function hasSavedHoldings() {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    return Array.isArray(d) && d.length > 0;
  } catch (e) {
    return false;
  }
}

/* ── main app ─────────────────────────────────────────────── */
export default function App() {
  const [holdings, setHoldings] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [afterTax, setAfterTax] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [showTaxInfo, setShowTaxInfo] = useState(false);
  const [sharedBanner, setSharedBanner] = useState(false); // 공유 링크로 들어왔을 때만 true
  const [goal, setGoal] = useState(0); // 월 배당 목표(원), 0이면 미설정
  const initial = typeof window !== 'undefined' ? parseHash() : { tab: null, deepId: null };
  const initialTab = initial.tab || (hasSavedHoldings() ? 'calc' : 'guide');
  const [tab, setTab] = useState(initialTab); // 'calc' | 'calendar' | 'find' | 'stocks' | 'guide'
  const [deepId, setDeepId] = useState(initial.deepId);
  const idRef = useRef(1);
  const formRef = useRef(null);
  const importInputRef = useRef(null);

  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const saved = window.localStorage.getItem('pb-theme');
      if (saved) return saved === 'dark';
    } catch (e) { /* ignore */ }
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    try { window.localStorage.setItem('pb-theme', dark ? 'dark' : 'light'); } catch (e) { /* ignore */ }
  }, [dark]);

  useEffect(() => {
    const onLocationChange = () => {
      const parsed = parseHash();
      setTab(parsed.tab || (hasSavedHoldings() ? 'calc' : 'guide'));
      setDeepId(parsed.deepId);
    };
    window.addEventListener('hashchange', onLocationChange);
    window.addEventListener('popstate', onLocationChange);
    return () => {
      window.removeEventListener('hashchange', onLocationChange);
      window.removeEventListener('popstate', onLocationChange);
    };
  }, []);

  const goTab = (v) => {
    setTab(v);
    setDeepId(null);
    window.history.pushState({}, '', `/${v}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 관련 종목·관련 가이드 링크 클릭 시 해당 상세로 바로 이동
  const goDeep = (targetTab, id) => {
    setTab(targetTab);
    setDeepId(id);
    window.history.pushState({}, '', `/${targetTab}/${id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ── schema.org 구조화 데이터 (FAQPage + WebSite) ── */
  useEffect(() => {
    const faqEntities = ARTICLES.map((a) => ({
      '@type': 'Question',
      name: a.t,
      acceptedAnswer: {
        '@type': 'Answer',
        text: a.p[0],
      },
    }));

    const jsonLd = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          name: '배당 통장',
          url: 'https://www.dividendpassbook.com',
          description: '보유한 국내·미국 배당주를 기입하면 연간 배당금, 월별 배당 흐름, 세후 실수령액까지 계산해주는 무료 배당 계산기',
          inLanguage: 'ko-KR',
        },
        {
          '@type': 'FAQPage',
          mainEntity: faqEntities,
        },
      ],
    };

    let script = document.getElementById('ld-json-main');
    if (!script) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = 'ld-json-main';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(jsonLd);
  }, []);

  /* ── 탭·종목·글에 따라 title/meta description을 동적으로 갱신 (개별 URL마다 고유한 제목을 갖게 함) ── */
  useEffect(() => {
    const DEFAULT_TITLE = '배당 통장 — 배당주 포트폴리오 계산기 · 월배당 계산';
    const DEFAULT_DESC = '보유한 국내·미국 배당주를 기입하면 연간 배당금, 월별 배당 흐름, 세후 실수령액까지 계산해주는 무료 배당 계산기. SCHD, 리얼티인컴, 코카콜라 등 배당주 가이드 포함.';
    const TAB_LABEL = { calc: '배당 계산기', calendar: '배당 캘린더', find: '유형 찾기', stocks: '종목분석', guide: '공부방' };

    let title = DEFAULT_TITLE;
    let desc = DEFAULT_DESC;
    let path = '/';

    if (tab === 'stocks' && deepId) {
      const s = STOCKS.find((x) => x.ticker === deepId);
      if (s) {
        title = `${s.name}(${s.ticker}) 배당 정보 — ${s.typeTag} | 배당 통장`;
        desc = s.basic;
        path = `/stocks/${s.ticker}`;
      }
    } else if (tab === 'guide' && deepId != null) {
      const a = resolveArticle(deepId);
      if (a) {
        title = `${a.t} | 배당 통장 공부방`;
        desc = a.p[0].slice(0, 150);
        path = `/guide/${a.id}`;
      }
    } else if (TAB_LABEL[tab]) {
      title = `${TAB_LABEL[tab]} | 배당 통장`;
      path = `/${tab}`;
    }

    document.title = title;

    const setMeta = (selector, attr, value) => {
      let el = document.querySelector(selector);
      if (!el) {
        el = document.createElement(selector.startsWith('link') ? 'link' : 'meta');
        if (selector.includes('rel="canonical"')) el.setAttribute('rel', 'canonical');
        else if (selector.includes('property=')) el.setAttribute('property', selector.match(/property="([^"]+)"/)[1]);
        else if (selector.includes('name=')) el.setAttribute('name', selector.match(/name="([^"]+)"/)[1]);
        document.head.appendChild(el);
      }
      el.setAttribute(attr, value);
    };

    const canonicalUrl = `https://www.dividendpassbook.com${path}`;
    setMeta('meta[name="description"]', 'content', desc);
    setMeta('link[rel="canonical"]', 'href', canonicalUrl);
    setMeta('meta[property="og:title"]', 'content', title);
    setMeta('meta[property="og:description"]', 'content', desc);
    setMeta('meta[property="og:url"]', 'content', canonicalUrl);
  }, [tab, deepId]);

  useEffect(() => {
    // 공유 링크(?s=...)로 들어온 경우: 내 저장된 포트폴리오를 곧바로 덮어쓰지 않고
    // "공유받은 결과" 배너로만 보여줘요. 저장은 사용자가 버튼을 눌렀을 때만 해요.
    let shared = null;
    try {
      const params = new URLSearchParams(window.location.search);
      const s = params.get('s');
      if (s) shared = decodeShareState(s);
    } catch (e) { /* ignore */ }

    if (shared) {
      setHoldings(shared.holdings);
      setAfterTax(shared.afterTax);
      setSharedBanner(true);
      idRef.current = shared.holdings.reduce((m, h) => Math.max(m, h.id || 0), 0) + 1;
      // 주소창에서 파라미터는 지워서, 새로고침해도 같은 화면이 계속 뜨지 않게 함
      try { window.history.replaceState({}, '', window.location.pathname); } catch (e) { /* ignore */ }
      return;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        setHoldings(d);
        idRef.current = d.reduce((m, h) => Math.max(m, h.id || 0), 0) + 1;
      }
    } catch (e) { /* first visit */ }
  }, []);

  const persist = (next) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (e) { /* ignore */ }
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(GOAL_KEY);
      if (raw) {
        const n = Number(raw);
        if (Number.isFinite(n) && n > 0) setGoal(n);
      }
    } catch (e) { /* ignore */ }
  }, []);

  const setAndPersistGoal = (n) => {
    setGoal(n);
    try {
      if (n > 0) localStorage.setItem(GOAL_KEY, String(n));
      else localStorage.removeItem(GOAL_KEY);
    } catch (e) { /* ignore */ }
  };

  // 공유받은 결과를 실제로 내 배당 통장에 저장
  const acceptSharedHoldings = () => {
    persist(holdings);
    setSharedBanner(false);
  };

  // 공유받은 결과를 무시하고 원래 내 포트폴리오(저장돼 있었다면)로 되돌림
  const dismissSharedBanner = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const d = raw ? JSON.parse(raw) : [];
      setHoldings(d);
      idRef.current = d.reduce((m, h) => Math.max(m, h.id || 0), 0) + 1;
    } catch (e) {
      setHoldings([]);
    }
    setSharedBanner(false);
  };

  const exportHoldings = () => {
    try {
      const blob = new Blob([JSON.stringify(holdings, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const today = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `배당통장-백업-${today}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) { /* ignore */ }
  };

  const triggerImport = () => importInputRef.current?.click();

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed)) throw new Error('invalid');
        const valid = parsed.every((h) => h && typeof h.name === 'string' && typeof h.shares === 'number' && typeof h.avgPrice === 'number' && typeof h.annualDiv === 'number' && Array.isArray(h.months));
        if (!valid) throw new Error('invalid');
        const proceed = holdings.length === 0 || window.confirm(`현재 저장된 ${holdings.length}개 종목을 백업 파일의 ${parsed.length}개 종목으로 덮어쓸까요?`);
        if (!proceed) return;
        const withIds = parsed.map((h, i) => ({ ...h, id: h.id || Date.now() + i }));
        setHoldings(withIds);
        persist(withIds);
        idRef.current = withIds.reduce((m, h) => Math.max(m, h.id || 0), 0) + 1;
      } catch (err) {
        window.alert('파일을 읽을 수 없어요. 이 계산기에서 내보낸 백업 파일(.json)이 맞는지 확인해주세요.');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const applyTax = (v, cur) => (afterTax ? v * (1 - TAX[cur]) : v);

  const toggleMonth = (m) => setForm((f) => ({
    ...f,
    months: f.months.includes(m) ? f.months.filter((x) => x !== m) : [...f.months, m].sort((a, b) => a - b),
  }));

  const startEdit = (h) => {
    setEditingId(h.id);
    setForm({
      name: h.name, ticker: h.ticker || '', shares: String(h.shares),
      avgPrice: String(h.avgPrice), annualDiv: String(h.annualDiv),
      months: h.months, currency: h.currency || 'KRW',
    });
    setError('');
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const cancelEdit = () => { setEditingId(null); setForm(emptyForm()); setError(''); };

  const submit = (e) => {
    e.preventDefault();
    setError('');
    const shares = parseFloat(form.shares);
    const avgPrice = parseFloat(form.avgPrice);
    const annualDiv = parseFloat(form.annualDiv);
    if (!form.name.trim()) return setError('종목명을 기입해주세요');
    if (!shares || shares <= 0) return setError('보유수량을 기입해주세요');
    if (!avgPrice || avgPrice <= 0) return setError('매입단가를 기입해주세요');
    if (isNaN(annualDiv) || annualDiv < 0) return setError('주당 연배당금을 기입해주세요');
    if (form.months.length === 0) return setError('배당 지급월을 1개 이상 선택해주세요');

    const entry = {
      name: form.name.trim(), ticker: form.ticker.trim(),
      shares, avgPrice, annualDiv, months: form.months, currency: form.currency,
    };

    let next;
    if (editingId !== null) {
      next = holdings.map((h) => (h.id === editingId ? { ...h, ...entry } : h));
    } else {
      next = [...holdings, { id: idRef.current++, ...entry }];
    }
    setHoldings(next); persist(next);
    setForm(emptyForm()); setEditingId(null);
  };

  const remove = (id) => {
    const next = holdings.filter((h) => h.id !== id);
    setHoldings(next); persist(next);
    if (editingId === id) cancelEdit();
  };

  const loadSample = () => {
    setHoldings(SAMPLE); persist(SAMPLE);
    idRef.current = 10;
  };

  const stats = ['KRW', 'USD']
    .map((cur) => {
      const items = holdings.filter((h) => (h.currency || 'KRW') === cur);
      if (items.length === 0) return null;
      const principal = items.reduce((s, h) => s + h.shares * h.avgPrice, 0);
      const annual = items.reduce((s, h) => s + h.shares * h.annualDiv, 0);
      const yieldPct = principal > 0 ? (annual / principal) * 100 : 0;
      const monthly = MONTHS.map((_, i) => items.reduce((s, h) => (
        h.months.includes(i + 1) ? s + (h.shares * h.annualDiv) / h.months.length : s
      ), 0));
      const thisMonth = monthly[THIS_MONTH - 1];
      return { cur, principal, annual, yieldPct, monthly, thisMonth };
    })
    .filter(Boolean);

  // 월 배당 목표 달성률 계산용 — 통화가 섞여 있어도 참고 환율로 KRW 환산해 하나의 월평균으로 합산
  const totalMonthlyKRW = holdings.reduce((sum, h) => {
    const cur = h.currency || 'KRW';
    const annualTaxed = applyTax(h.shares * h.annualDiv, cur);
    const krw = cur === 'USD' ? annualTaxed * FX_KRW_PER_USD : annualTaxed;
    return sum + krw;
  }, 0) / 12;
  const goalPct = goal > 0 ? Math.min(100, (totalMonthlyKRW / goal) * 100) : 0;

  // 이번 달 배당 예정 종목 — 보유 종목 중 이번 달이 지급월인 것만 골라 종목별 금액 계산
  const thisMonthDue = holdings
    .filter((h) => h.months.includes(THIS_MONTH))
    .map((h) => {
      const cur = h.currency || 'KRW';
      const amount = applyTax((h.shares * h.annualDiv) / h.months.length, cur);
      return { name: h.name, ticker: h.ticker, cur, amount };
    })
    .sort((a, b) => b.amount - a.amount);

  const copySummary = async () => {
    const lines = stats.map((s) =>
      `[${s.cur}] 연 ${fmt(applyTax(s.annual, s.cur), s.cur)} · 월평균 ${fmt(applyTax(s.annual / 12, s.cur), s.cur)}${afterTax ? ' (세후)' : ' (세전)'}`
    );
    try {
      await navigator.clipboard.writeText(`내 배당 통장\n${lines.join('\n')}\n종목 ${holdings.length}개`);
      setCopied(true); setTimeout(() => setCopied(false), 1800);
    } catch (e) { /* clipboard unavailable */ }
  };

  // 계산 결과 링크 공유 — 종목·수량 등 입력값을 URL에 담아서, 그 링크를 열면 같은 계산이 재현돼요.
  // 서버에는 아무것도 저장하지 않고, 개인 식별 정보도 포함하지 않아요.
  const shareResult = async () => {
    if (holdings.length === 0) return;
    const b64 = encodeShareState(holdings, afterTax);
    const url = `${window.location.origin}/calc?s=${b64}`;
    const lines = stats.map((s) =>
      `[${s.cur}] 예상 연 배당금 ${fmt(applyTax(s.annual, s.cur), s.cur)}${afterTax ? ' (세후)' : ' (세전)'}`
    );
    const shareText = `내 배당 계산 결과\n${lines.join('\n')}\n종목 ${holdings.length}개\n\n배당 통장에서 확인하기`;

    if (navigator.share) {
      try {
        await navigator.share({ title: '배당 통장 — 계산 결과', text: shareText, url });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return; // 사용자가 공유를 취소함 — 조용히 종료
        // 그 외 실패 시 아래 링크 복사로 대체
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true); setTimeout(() => setShareCopied(false), 1800);
    } catch (e) { /* clipboard unavailable */ }
  };

  const input = { width: '100%', background: 'var(--pb-input-bg)', borderRadius: 7, padding: '10px 11px', fontSize: 14, color: C.ink, border: `1px solid ${C.lineStrong}`, boxSizing: 'border-box', fontFamily: "'Noto Sans KR', sans-serif" };
  const label = { display: 'block', fontSize: 11, color: C.inkSoft, marginBottom: 5, fontWeight: 600 };

  return (
    <div style={{ minHeight: '100vh', width: '100%', background: 'var(--pb-page)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '26px 14px 44px', boxSizing: 'border-box', fontFamily: "'Noto Sans KR', -apple-system, sans-serif" }}>
      <style>{`
        :root {
          --pb-cover: #1f3d2e;
          --pb-cover-edge: #17301f;
          --pb-foil: #d9b36a;
          --pb-paper: #f7f3e8;
          --pb-paper-line: rgba(31,61,46,0.10);
          --pb-ink: #22312a;
          --pb-ink-soft: #5b6a61;
          --pb-stamp: #c03a2b;
          --pb-brass: #b8863c;
          --pb-card-bg: #fdfaf1;
          --pb-line: rgba(34,49,42,0.12);
          --pb-line-strong: rgba(34,49,42,0.24);
          --pb-etf: #3f6f8f;
          --pb-reit: #2f8f74;
          --pb-input-bg: #fffef9;
          --pb-page: #ece6d6;
          --pb-stamp-04: rgba(192,58,43,0.04);
          --pb-stamp-06: rgba(192,58,43,0.06);
          --pb-stamp-25: rgba(192,58,43,0.25);
          --pb-stamp-35: rgba(192,58,43,0.35);
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --pb-cover: #1b2f22;
            --pb-cover-edge: #142419;
            --pb-foil: #dcbb7e;
            --pb-paper: #1c2921;
            --pb-paper-line: rgba(220,187,126,0.05);
            --pb-ink: #e4ddc9;
            --pb-ink-soft: #99a696;
            --pb-stamp: #d8654f;
            --pb-brass: #c99c5f;
            --pb-card-bg: #24352b;
            --pb-line: rgba(228,221,201,0.09);
            --pb-line-strong: rgba(228,221,201,0.17);
            --pb-etf: #7fb2d6;
            --pb-reit: #5ecba6;
            --pb-input-bg: #24352b;
            --pb-page: #142018;
            --pb-stamp-04: rgba(216,101,79,0.09);
            --pb-stamp-06: rgba(216,101,79,0.13);
            --pb-stamp-25: rgba(216,101,79,0.32);
            --pb-stamp-35: rgba(216,101,79,0.42);
          }
        }
        :root[data-theme="dark"] {
          --pb-cover: #1b2f22;
          --pb-cover-edge: #142419;
          --pb-foil: #dcbb7e;
          --pb-paper: #1c2921;
          --pb-paper-line: rgba(220,187,126,0.05);
          --pb-ink: #e4ddc9;
          --pb-ink-soft: #99a696;
          --pb-stamp: #d8654f;
          --pb-brass: #c99c5f;
          --pb-card-bg: #24352b;
          --pb-line: rgba(228,221,201,0.09);
          --pb-line-strong: rgba(228,221,201,0.17);
          --pb-etf: #7fb2d6;
          --pb-reit: #5ecba6;
          --pb-input-bg: #24352b;
          --pb-page: #142018;
          --pb-stamp-04: rgba(216,101,79,0.09);
          --pb-stamp-06: rgba(216,101,79,0.13);
          --pb-stamp-25: rgba(216,101,79,0.32);
          --pb-stamp-35: rgba(216,101,79,0.42);
        }
        :root[data-theme="light"] {
          --pb-cover: #1f3d2e;
          --pb-cover-edge: #17301f;
          --pb-foil: #d9b36a;
          --pb-paper: #f7f3e8;
          --pb-paper-line: rgba(31,61,46,0.10);
          --pb-ink: #22312a;
          --pb-ink-soft: #5b6a61;
          --pb-stamp: #c03a2b;
          --pb-brass: #b8863c;
          --pb-card-bg: #fdfaf1;
          --pb-line: rgba(34,49,42,0.12);
          --pb-line-strong: rgba(34,49,42,0.24);
          --pb-etf: #3f6f8f;
          --pb-reit: #2f8f74;
          --pb-input-bg: #fffef9;
          --pb-page: #ece6d6;
          --pb-stamp-04: rgba(192,58,43,0.04);
          --pb-stamp-06: rgba(192,58,43,0.06);
          --pb-stamp-25: rgba(192,58,43,0.25);
          --pb-stamp-35: rgba(192,58,43,0.35);
        }
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@600;700;900&family=Noto+Sans+KR:wght@400;500;700&family=IBM+Plex+Mono:wght@500;600;700&display=swap');
        * { -webkit-tap-highlight-color: transparent; }
        input::placeholder { color: rgba(34,49,42,0.35); }
        input:focus { outline: none; border-color: ${C.cover}; }
        button { font-family: inherit; }
        summary { list-style: none; }
        summary::-webkit-details-marker { display: none; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
      `}</style>
      <div style={{ width: '100%', maxWidth: 470 }}>
        {/* ── passbook cover ── */}
        <div style={{
          background: `linear-gradient(160deg, ${C.cover} 0%, ${C.coverEdge} 100%)`,
          borderRadius: '14px 14px 0 0', padding: '26px 24px 22px',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: 4, color: C.foil, fontWeight: 700, marginBottom: 8, opacity: 0.9 }}>
                DIVIDEND PASSBOOK
              </div>
              <h1 style={{ margin: 0, fontFamily: "'Noto Serif KR', serif", fontWeight: 900, fontSize: 30, color: C.foil, letterSpacing: 1 }}>
                배당 통장
              </h1>
              <p style={{ margin: '8px 0 0', fontSize: 12, color: 'rgba(217,179,106,0.75)', lineHeight: 1.5 }}>
                보유 배당주를 기입하면 연간·월별 배당 흐름을 정리해 드립니다
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 13 }}>
                {[
                  { n: STOCKS.length, l: '종목분석' },
                  { n: ARTICLES.length, l: '가이드' },
                  { n: null, l: '무료' },
                ].map((s, i) => (
                  <React.Fragment key={s.l}>
                    {i > 0 && <span style={{ width: 1, height: 11, background: 'rgba(217,179,106,0.3)' }} />}
                    <span style={{ fontSize: 11, color: 'rgba(217,179,106,0.8)' }}>
                      {s.l}
                      {s.n !== null && (
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, marginLeft: 4 }}>{s.n}개</span>
                      )}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <button
                onClick={() => setDark((d) => !d)}
                aria-label={dark ? '라이트 모드로 전환' : '다크 모드로 전환'}
                style={{
                  width: 26, height: 26, borderRadius: '50%', border: '1px solid rgba(217,179,106,0.4)',
                  background: 'transparent', color: C.foil, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.85,
                }}
              >
                {dark ? <Moon size={13} /> : <Sun size={13} />}
              </button>
              <div aria-hidden style={{
              width: 46, height: 46, borderRadius: '50%', border: `1.5px solid ${C.foil}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: 0.9, flexShrink: 0,
            }}>
              <svg width="30" height="30" viewBox="0 0 100 100">
                <rect x="27" y="42" width="46" height="32" rx="4" fill="none" stroke={C.foil} strokeWidth="3" />
                <line x1="33" y1="52" x2="63" y2="52" stroke={C.foil} strokeWidth="1.6" />
                <line x1="33" y1="61" x2="63" y2="61" stroke={C.foil} strokeWidth="1.6" />
                <rect x="54" y="35" width="5" height="7" fill={C.foil} />
                <rect x="60" y="30" width="5" height="12" fill={C.foil} />
                <rect x="66" y="25" width="5" height="17" fill={C.foil} />
              </svg>
              </div>
            </div>
          </div>
        </div>

        {/* ── paper body ── */}
        <div style={{ background: C.paper, borderRadius: '0 0 14px 14px', border: `1px solid ${C.line}`, borderTop: 'none', padding: '20px 16px 24px', boxSizing: 'border-box' }}>
          <div style={{ border: `1px dashed ${C.lineStrong}`, borderRadius: 8, padding: '9px 14px', textAlign: 'center', fontSize: 10.5, color: C.inkSoft, opacity: 0.6, marginBottom: 16 }}>
            광고 영역 · AdSense 승인 후 스크립트 삽입
          </div>

          {/* ── 탭바 ── */}
          <div style={{ display: 'flex', gap: 5, marginBottom: 18, background: 'rgba(34,49,42,0.05)', padding: 4, borderRadius: 10 }}>
            {[
              { v: 'calc', t: '계산기', Icon: Calculator },
              { v: 'calendar', t: '달력', Icon: CalendarDays },
              { v: 'find', t: '유형찾기', Icon: Compass },
              { v: 'stocks', t: '종목분석', Icon: LineChart },
              { v: 'guide', t: '공부방', Icon: BookOpen },
            ].map((o) => {
              const on = tab === o.v;
              return (
                <a key={o.v} href={`/${o.v}`} onClick={(e) => { e.preventDefault(); goTab(o.v); }} style={{
                  flex: 1, padding: '8px 0 7px', borderRadius: 7, fontSize: 10.5, fontWeight: 700, cursor: 'pointer',
                  border: 'none', background: on ? C.cover : 'transparent', color: on ? C.foil : C.inkSoft,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, textDecoration: 'none',
                }}>
                  <o.Icon size={14} />
                  {o.t}
                </a>
              );
            })}
          </div>

          {tab === 'calc' && (
            <>
              <input
                ref={importInputRef} type="file" accept="application/json,.json"
                onChange={handleImportFile} style={{ display: 'none' }}
              />
              {holdings.length === 0 ? (
                <Ruled style={{ padding: '34px 20px', textAlign: 'center', marginBottom: 18 }}>
                  <p style={{ margin: '0 0 6px', fontFamily: "'Noto Serif KR', serif", fontWeight: 700, fontSize: 17, color: C.ink }}>
                    첫 페이지가 비어 있어요
                  </p>
                  <p style={{ margin: '0 0 16px', fontSize: 12.5, color: C.inkSoft, lineHeight: 1.6 }}>
                    아래에서 보유 종목을 기입하면<br />이 자리에 배당 내역이 인쇄됩니다
                  </p>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button onClick={loadSample} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8,
                      border: `1px solid ${C.cover}`, background: 'transparent', color: C.cover,
                      fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                    }}>
                      <Sparkles size={13} /> 샘플로 미리 체험하기
                    </button>
                    <button onClick={triggerImport} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8,
                      border: `1px solid ${C.lineStrong}`, background: 'transparent', color: C.inkSoft,
                      fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                    }}>
                      <Upload size={13} /> 백업 불러오기
                    </button>
                  </div>
                </Ruled>
              ) : (
                <>
                  {sharedBanner && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 12px', marginBottom: 12, borderRadius: 8, background: 'var(--pb-stamp-06)', border: `1px solid ${C.lineStrong}` }}>
                      <span style={{ fontSize: 11.5, color: C.inkSoft }}>🔗 다른 분이 공유한 계산 결과를 보고 있어요</span>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button onClick={acceptSharedHoldings} style={{ fontSize: 11, fontWeight: 700, color: C.foil, background: C.cover, border: 'none', borderRadius: 6, padding: '5px 9px', cursor: 'pointer' }}>
                          내 배당 통장에 저장
                        </button>
                        <button onClick={dismissSharedBanner} style={{ fontSize: 11, fontWeight: 600, color: C.inkSoft, background: 'transparent', border: `1px solid ${C.lineStrong}`, borderRadius: 6, padding: '5px 9px', cursor: 'pointer' }}>
                          닫기
                        </button>
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ display: 'flex', border: `1px solid ${C.lineStrong}`, borderRadius: 8, overflow: 'hidden' }}>
                        {[{ v: false, t: '세전' }, { v: true, t: '세후' }].map((o) => (
                          <button key={o.t} onClick={() => setAfterTax(o.v)} style={{
                            padding: '7px 16px', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
                            background: afterTax === o.v ? C.cover : 'transparent',
                            color: afterTax === o.v ? C.foil : C.inkSoft,
                          }}>
                            {o.t}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => setShowTaxInfo((v) => !v)} aria-label="세후 배당금 설명 보기" style={{
                        width: 22, height: 22, borderRadius: '50%', border: `1px solid ${C.lineStrong}`, background: 'transparent',
                        color: C.inkSoft, fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                      }}>
                        ?
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={copySummary} style={{
                        display: 'flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 8,
                        border: `1px solid ${C.lineStrong}`, background: 'transparent',
                        fontSize: 11.5, fontWeight: 600, color: copied ? C.cover : C.inkSoft, cursor: 'pointer',
                      }}>
                        {copied ? <Check size={12} /> : <Copy size={12} />}
                        {copied ? '복사됨' : '요약 복사'}
                      </button>
                      <button onClick={shareResult} style={{
                        display: 'flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 8,
                        border: `1px solid ${C.lineStrong}`, background: 'transparent',
                        fontSize: 11.5, fontWeight: 600, color: shareCopied ? C.cover : C.inkSoft, cursor: 'pointer',
                      }}>
                        {shareCopied ? <Check size={12} /> : <Share2 size={12} />}
                        {shareCopied ? '링크 복사됨' : '결과 공유'}
                      </button>
                    </div>
                  </div>

                  {showTaxInfo && (
                    <p style={{ fontSize: 11, lineHeight: 1.6, color: C.inkSoft, background: 'var(--pb-input-bg)', borderRadius: 7, padding: '8px 10px', margin: '0 0 12px' }}>
                      <b>세후 배당금이란?</b> 배당을 받을 때 국내 주식은 15.4%, 미국 주식은 15%가 자동으로 원천징수돼요. "세전"은 그 세금을 떼기 전 금액, "세후"는 뗀 뒤 실제로 받는 금액이에요. 금융소득이 연 2,000만원을 넘으면 종합과세 대상이 될 수 있어, 정확한 세금은 세무 전문가와 상담하는 게 안전해요.
                    </p>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    <button onClick={exportHoldings} style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 7,
                      border: `1px solid ${C.lineStrong}`, background: 'transparent',
                      fontSize: 10.5, fontWeight: 600, color: C.inkSoft, cursor: 'pointer',
                    }}>
                      <Download size={11} /> 백업 내보내기
                    </button>
                    <button onClick={triggerImport} style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 7,
                      border: `1px solid ${C.lineStrong}`, background: 'transparent',
                      fontSize: 10.5, fontWeight: 600, color: C.inkSoft, cursor: 'pointer',
                    }}>
                      <Upload size={11} /> 백업 가져오기
                    </button>
                  </div>

                  {afterTax && (
                    <p style={{ margin: '0 0 14px', fontSize: 10.5, color: C.inkSoft, opacity: 0.8 }}>
                      세후: 원화 15.4% · 달러 15% 원천징수 간이 적용 (참고용)
                    </p>
                  )}

                  {stats.map((s) => (
                    <div key={s.cur} style={{ marginBottom: 18 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                        <CurrencyBadge cur={s.cur} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>
                          {s.cur === 'USD' ? '달러 종목' : '원화 종목'}
                        </span>
                        <span style={{ flex: 1, height: 1, background: C.line }} />
                        <span style={{ fontSize: 10.5, color: C.inkSoft }}>수익률 {s.yieldPct.toFixed(2)}%</span>
                      </div>
                      <div style={{ display: 'flex', gap: 14, alignItems: 'center', background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 12, padding: '16px 16px' }}>
                        <Stamp
                          value={fmt(applyTax(s.annual, s.cur), s.cur)}
                          sub={afterTax ? '세후' : '세전'}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Row k="월 평균" v={fmt(applyTax(s.annual / 12, s.cur), s.cur)} strong />
                          <Row k={`이번 달 (${THIS_MONTH}월)`} v={fmt(applyTax(s.thisMonth, s.cur), s.cur)} hot={s.thisMonth > 0} />
                          <Row k="투자 원금" v={fmt(s.principal, s.cur)} />
                        </div>
                      </div>
                      <div style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 12, padding: '14px 14px 10px', marginTop: 10 }}>
                        <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 600, marginBottom: 10 }}>
                          월별 배당 흐름 <span style={{ color: C.stamp }}>■</span> 이번 달
                        </div>
                        <Bars data={s.monthly.map((v) => applyTax(v, s.cur))} cur={s.cur} />
                      </div>
                    </div>
                  ))}

                  {thisMonthDue.length > 0 && (
                    <div style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: C.ink, marginBottom: 10 }}>
                        📅 {MONTHS[THIS_MONTH - 1]} 배당 예정
                      </div>
                      {thisMonthDue.map((d) => (
                        <div key={d.ticker} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.inkSoft, padding: '4px 0' }}>
                          <span>{d.name}</span>
                          <span style={{ fontWeight: 600, color: C.ink }}>{fmt(d.amount, d.cur)}</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 700, color: C.cover, borderTop: `1px solid ${C.line}`, marginTop: 6, paddingTop: 8 }}>
                        <span>예상 합계</span>
                        <span>
                          {stats.filter((s) => s.thisMonth > 0).map((s) => fmt(applyTax(s.thisMonth, s.cur), s.cur)).join(' + ') || fmt(0, 'KRW')}
                        </span>
                      </div>
                    </div>
                  )}

                  <div style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 12, padding: '14px 16px', marginBottom: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: goal > 0 ? 10 : 8 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: C.ink }}>월 배당 목표</span>
                      {goal > 0 && (
                        <button onClick={() => setAndPersistGoal(0)} style={{ fontSize: 10.5, color: C.inkSoft, background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                          초기화
                        </button>
                      )}
                    </div>
                    {goal > 0 ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                          <span style={{ fontSize: 11, color: C.inkSoft }}>
                            현재 월평균 {fmt(totalMonthlyKRW, 'KRW')} <span style={{ opacity: 0.7 }}>{afterTax ? '(세후·환산)' : '(세전·환산)'}</span>
                          </span>
                          <span style={{ fontSize: 11, color: C.inkSoft }}>목표 {fmt(goal, 'KRW')}</span>
                        </div>
                        <div style={{ height: 8, borderRadius: 999, background: 'var(--pb-input-bg)', overflow: 'hidden', marginBottom: 6 }}>
                          <div style={{ height: '100%', width: `${goalPct}%`, background: C.cover, borderRadius: 999, transition: 'width 0.3s' }} />
                        </div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.cover }}>
                          달성률 {goalPct.toFixed(1)}%
                          {goalPct < 100 && <span style={{ fontWeight: 500, color: C.inkSoft }}> · 남은 금액 {fmt(Math.max(0, goal - totalMonthlyKRW), 'KRW')}</span>}
                        </div>
                      </>
                    ) : (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {[100000, 300000, 500000, 1000000].map((v) => (
                          <button key={v} onClick={() => setAndPersistGoal(v)} style={{
                            padding: '7px 12px', borderRadius: 999, border: `1px solid ${C.lineStrong}`, background: 'transparent',
                            fontSize: 11.5, fontWeight: 600, color: C.inkSoft, cursor: 'pointer',
                          }}>
                            {v >= 1000000 ? `${v / 10000}만원` : `${v / 10000}만원`}
                          </button>
                        ))}
                        <button onClick={() => {
                          const v = window.prompt('월 배당 목표 금액(원)을 입력해주세요');
                          const n = parseFloat(v);
                          if (n > 0) setAndPersistGoal(n);
                        }} style={{
                          padding: '7px 12px', borderRadius: 999, border: `1px solid ${C.lineStrong}`, background: 'transparent',
                          fontSize: 11.5, fontWeight: 600, color: C.inkSoft, cursor: 'pointer',
                        }}>
                          직접 입력
                        </button>
                      </div>
                    )}
                  </div>

                  <PortfolioDiagnosis holdings={holdings} />

                  <TaxThresholdCheck holdings={holdings} />

                  <Ruled style={{ padding: '2px 14px', marginBottom: 18 }}>
                    {holdings.map((h, i) => {
                      const cur = h.currency || 'KRW';
                      const annual = h.shares * h.annualDiv;
                      const paysNow = h.months.includes(THIS_MONTH);
                      return (
                        <div key={h.id} style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '11px 0',
                          borderBottom: i < holdings.length - 1 ? `1px solid ${C.line}` : 'none',
                          background: editingId === h.id ? 'rgba(184,134,60,0.10)' : 'transparent',
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>{h.name}</span>
                              {h.ticker && <span style={{ fontSize: 10.5, color: C.inkSoft }}>{h.ticker}</span>}
                              <CurrencyBadge cur={cur} />
                              {paysNow && (
                                <span style={{ fontSize: 9.5, fontWeight: 700, color: C.stamp, border: `1px solid ${C.stamp}`, borderRadius: 999, padding: '1px 6px' }}>
                                  이번 달 지급
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 3, fontFamily: "'IBM Plex Mono', monospace" }}>
                              {h.shares}주 × {fmt(h.annualDiv, cur)} = 연 {fmt(applyTax(annual, cur), cur)}
                            </div>
                          </div>
                          <button onClick={() => startEdit(h)} aria-label="수정" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, color: C.cover, opacity: 0.75 }}>
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => remove(h.id)} aria-label="삭제" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, color: C.stamp, opacity: 0.7 }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </Ruled>
                </>
              )}

              <form ref={formRef} onSubmit={submit} style={{
                background: C.cardBg, border: `1.5px solid ${editingId !== null ? C.brass : C.line}`,
                borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>
                    {editingId !== null ? '기입 내용 수정' : '새 종목 기입'}
                  </span>
                  {editingId !== null && (
                    <button type="button" onClick={cancelEdit} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.inkSoft, display: 'flex', alignItems: 'center', gap: 3, fontSize: 11 }}>
                      <X size={12} /> 취소
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 2 }}>
                    <label style={label}>종목명</label>
                    <input
                      value={form.name}
                      onChange={(e) => {
                        const v = e.target.value;
                        const match = STOCKS.find((s) => s.name === v);
                        setForm((f) => ({ ...f, name: v, ticker: match && !f.ticker ? match.ticker : f.ticker }));
                      }}
                      placeholder="예: 코카콜라" list="stock-name-list" style={input}
                    />
                    <datalist id="stock-name-list">
                      {STOCKS.map((s) => <option key={s.ticker} value={s.name} />)}
                    </datalist>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={label}>티커 (선택)</label>
                    <input value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })} placeholder="KO" style={input} />
                  </div>
                </div>

                <div>
                  <label style={label}>통화</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[{ v: 'KRW', t: '🇰🇷 원화' }, { v: 'USD', t: '🇺🇸 달러' }].map((o) => {
                      const on = form.currency === o.v;
                      return (
                        <button type="button" key={o.v} onClick={() => setForm({ ...form, currency: o.v })} style={{
                          flex: 1, padding: '9px 0', borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                          border: `1px solid ${on ? C.cover : C.lineStrong}`,
                          background: on ? C.cover : 'transparent', color: on ? C.foil : C.inkSoft,
                        }}>
                          {o.t}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={label}>보유수량 (주)</label>
                    <input type="number" inputMode="decimal" min="0" value={form.shares} onChange={(e) => setForm({ ...form, shares: e.target.value })} placeholder="10" style={input} />
                    <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
                      {[10, 50, 100, 500].map((n) => (
                        <button key={n} type="button" onClick={() => setForm((f) => ({ ...f, shares: String(n) }))} style={{
                          flex: 1, padding: '7px 0', borderRadius: 7, border: `1px solid ${C.lineStrong}`, background: 'transparent',
                          fontSize: 11, fontWeight: 600, color: C.inkSoft, cursor: 'pointer',
                        }}>
                          {n}주
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={label}>매입단가 ({form.currency === 'USD' ? '$' : '원'})</label>
                    <input type="number" inputMode="decimal" min="0" step={form.currency === 'USD' ? '0.01' : '1'} value={form.avgPrice} onChange={(e) => setForm({ ...form, avgPrice: e.target.value })} placeholder={form.currency === 'USD' ? '60.00' : '70000'} style={input} />
                  </div>
                </div>

                <div>
                  <label style={label}>주당 연배당금 ({form.currency === 'USD' ? '$' : '원'})</label>
                  <input type="number" inputMode="decimal" min="0" step={form.currency === 'USD' ? '0.01' : '1'} value={form.annualDiv} onChange={(e) => setForm({ ...form, annualDiv: e.target.value })} placeholder={form.currency === 'USD' ? '1.94' : '1500'} style={input} />
                </div>

                <div>
                  <label style={label}>배당 지급월 (모두 선택)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
                    {MONTHS.map((m, i) => {
                      const v = i + 1;
                      const on = form.months.includes(v);
                      return (
                        <button type="button" key={v} onClick={() => toggleMonth(v)} style={{
                          padding: '7px 0', borderRadius: 6, fontSize: 11.5, cursor: 'pointer', fontWeight: on ? 700 : 500,
                          border: `1px solid ${on ? C.cover : C.lineStrong}`,
                          background: on ? C.cover : 'transparent', color: on ? C.foil : C.inkSoft,
                        }}>
                          {m}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {error && <p style={{ fontSize: 12, color: C.stamp, margin: 0, fontWeight: 600 }}>{error}</p>}

                <button type="submit" style={{
                  padding: '12px', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  background: C.cover, color: C.foil, border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  <Plus size={15} /> {editingId !== null ? '수정 완료' : '통장에 기입하기'}
                </button>
              </form>
            </>
          )}

          {tab === 'calendar' && <DividendCalendar holdings={holdings} />}
          {tab === 'find' && <TypeFinder />}
          {tab === 'stocks' && <StockCards deepId={deepId} onNavigate={goDeep} />}
          {tab === 'guide' && <Articles deepId={deepId} onNavigate={goDeep} />}

          <Fold icon={Info} title="이 사이트는요">
            <p style={{ fontSize: 12, lineHeight: 1.75, color: C.inkSoft, margin: '0 0 9px' }}>
              배당 통장은 배당 투자를 하거나 시작하려는 분들을 위해 만든 개인 프로젝트예요. 보유 배당주를 기입하면 연간·월별 배당 흐름을 계산해주는 무료 도구와, 종목분석·배당 상식을 정리한 글을 함께 제공하고 있어요.
            </p>
            <p style={{ fontSize: 12, lineHeight: 1.75, color: C.inkSoft, margin: '0 0 9px' }}>
              사이트에 담긴 종목·배당 정보는 공개된 자료를 바탕으로 최대한 사실 확인을 거쳐 작성하고 있지만, 투자 자문이나 특정 종목 추천이 아니라 일반적인 정보 제공을 목적으로 해요. 실제 투자 결정 전에는 반드시 공식 출처에서 최신 정보를 다시 확인해주세요.
            </p>
            <p style={{ fontSize: 12, lineHeight: 1.75, color: C.inkSoft, margin: '0 0 9px' }}>
              종목분석·가이드 콘텐츠는 사람이 직접 조사해서 정리·검토하는 방식으로 관리하고 있고, 실시간 시세·배당 공시를 자동으로 가져와 반영하는 시스템은 아니에요. 그래서 배당수익률처럼 매일 바뀌는 수치는 이 사이트에 고정 숫자로 적어두지 않고, 각 종목 카드의 "주의할 점"에 안내된 공식 페이지(기업 IR·DART·운용사 사이트 등)에서 확인하도록 링크만 제공해요.
            </p>
            <p style={{ fontSize: 12, lineHeight: 1.75, color: C.inkSoft, margin: 0 }}>
              오탈자·잘못된 정보 제보나 문의는 <a href="mailto:contact@dividendpassbook.com" style={{ color: C.cover, fontWeight: 700 }}>contact@dividendpassbook.com</a>으로 보내주시면 확인 후 반영할게요.
            </p>
          </Fold>

          <Fold icon={BookOpen} title="배당 투자 알아두면 좋은 것들">
            <p style={{ fontSize: 12, lineHeight: 1.75, color: C.inkSoft, margin: '0 0 9px' }}>
              <b>배당수익률</b>은 매입가 대비 연간 배당금 비율이에요. 이 통장의 수익률은 매입단가 기준이라 시가 기준과는 다를 수 있어요.
            </p>
            <p style={{ fontSize: 12, lineHeight: 1.75, color: C.inkSoft, margin: '0 0 9px' }}>
              <b>세금</b>은 원화 배당 15.4%, 미국 주식 15%가 원천징수돼요. 세후 토글은 이 간이율을 적용한 참고치예요. 금융소득 연 2,000만원 초과 시 종합과세 대상이 될 수 있어요.
            </p>
            <p style={{ fontSize: 12, lineHeight: 1.75, color: C.inkSoft, margin: 0 }}>
              <b>지급월</b>이 서로 다른 종목을 섞으면 매달 배당이 들어오는 포트폴리오를 만들 수 있어요. 정확한 지급월은 DART 공시나 기업 IR에서 확인하세요.
            </p>
          </Fold>

          <Fold icon={HelpCircle} title="자주 묻는 질문">
            <p style={{ fontSize: 12, lineHeight: 1.75, color: C.inkSoft, margin: '0 0 9px' }}>
              <b>Q. 계산된 배당금이 실제로 받는 금액과 왜 다를 수 있나요?</b><br />
              기업이 배당금을 늘리거나 줄이면 실제 지급액이 달라져요. 이 계산기는 입력하신 "연간 배당금(주당)" 값을 그대로 곱해서 보여주는 방식이라, 그 값 자체가 최신이 아니면 결과도 어긋나요. 최신 주당배당금은 기업 IR·DART·운용사 페이지에서 확인 후 입력해주세요.
            </p>
            <p style={{ fontSize: 12, lineHeight: 1.75, color: C.inkSoft, margin: '0 0 9px' }}>
              <b>Q. 미국 주식과 국내 주식의 세금 계산 방식이 어떻게 다른가요?</b><br />
              미국 주식은 15% 원천징수 후 남은 금액을 기준으로, 국내 주식은 15.4% 원천징수를 기준으로 세후 금액을 계산해요. 두 나라 모두 금융소득이 연 2,000만원을 넘으면 종합과세 대상이 될 수 있는데, 이 계산기는 그 초과 여부만 참고용으로 보여줄 뿐 실제 종합과세 세액까지 계산하지는 않아요.
            </p>
            <p style={{ fontSize: 12, lineHeight: 1.75, color: C.inkSoft, margin: '0 0 9px' }}>
              <b>Q. 환율이 바뀌면 계산 결과도 바뀌나요?</b><br />
              네. 달러 배당을 원화로 환산할 때 계산기에 표시된 참고 환율을 사용해요. 실제 환전 시점의 환율과는 차이가 있을 수 있어, 정확한 원화 수령액은 실제 환전 후 확인하는 게 정확해요.
            </p>
            <p style={{ fontSize: 12, lineHeight: 1.75, color: C.inkSoft, margin: '0 0 9px' }}>
              <b>Q. 월배당과 분기배당은 화면에 어떻게 다르게 표시되나요?</b><br />
              보유 종목에 입력한 지급월(들)에 맞춰 연간 배당금을 나눠 월별 캘린더·그래프에 반영해요. 월배당 종목은 매달, 분기배당 종목은 입력하신 지급월 3~4곳에만 금액이 표시돼요.
            </p>
            <p style={{ fontSize: 12, lineHeight: 1.75, color: C.inkSoft, margin: 0 }}>
              <b>Q. 종목분석에 나오는 배당수익률·배당금 숫자를 그대로 믿어도 되나요?</b><br />
              종목분석 카드의 수치(운용보수, 상장연도 등 구조적 사실)는 확인 후 기재하지만, 배당수익률·주가처럼 매일 바뀌는 숫자는 의도적으로 싣지 않았어요. 그런 숫자는 각 카드에 안내된 공식 출처에서 최신 값을 확인하는 게 정확해요.
            </p>
          </Fold>

          <Fold icon={Shield} title="개인정보처리방침">
            <p style={{ fontSize: 12, lineHeight: 1.75, color: C.inkSoft, margin: '0 0 9px' }}>
              배당 통장은 회원가입 없이 이용하며 이름·이메일 등 개인 식별 정보를 수집하지 않아요. 기입하신 종목 정보는 서버로 전송되지 않고 이용자의 브라우저(localStorage)에만 저장돼요.
            </p>
            <p style={{ fontSize: 12, lineHeight: 1.75, color: C.inkSoft, margin: '0 0 9px' }}>
              본 사이트는 Google AdSense 광고를 게재할 수 있어요. Google 등 제3자 광고 사업자는 쿠키를 사용해 관심 기반 광고를 제공할 수 있으며, Google 광고 설정에서 맞춤 광고를 해제할 수 있어요.
            </p>
            <p style={{ fontSize: 12, lineHeight: 1.75, color: C.inkSoft, margin: 0 }}>
              브라우저 사이트 데이터를 삭제하면 저장된 내용도 함께 삭제돼요.
            </p>
          </Fold>

          <Fold icon={FileText} title="이용약관">
            <p style={{ fontSize: 12, lineHeight: 1.75, color: C.inkSoft, margin: '0 0 9px' }}>
              배당 통장은 누구나 무료로 이용할 수 있는 개인 프로젝트예요. 회원가입 절차 없이 배당 계산기·종목분석·배당 가이드 콘텐츠를 자유롭게 이용하실 수 있어요.
            </p>
            <p style={{ fontSize: 12, lineHeight: 1.75, color: C.inkSoft, margin: '0 0 9px' }}>
              이 사이트에서 제공하는 계산 결과와 종목 정보는 참고용이며, 그 정확성·완전성·최신성을 보장하지 않아요. 운영자는 사이트 이용 과정에서 발생한 직접·간접적인 손해에 대해 법적 책임을 지지 않아요.
            </p>
            <p style={{ fontSize: 12, lineHeight: 1.75, color: C.inkSoft, margin: '0 0 9px' }}>
              운영자는 서비스 내용을 사전 고지 없이 변경·중단할 수 있고, 안정적인 서비스 제공을 위해 노력하지만 서버 사정 등으로 일시적으로 접속이 어려울 수 있어요.
            </p>
            <p style={{ fontSize: 12, lineHeight: 1.75, color: C.inkSoft, margin: 0 }}>
              사이트의 콘텐츠(종목분석·가이드 글 등)를 무단으로 복제하거나, 자동화된 방식(크롤링·스크래핑 등)으로 대량 수집해 재배포하는 행위는 허용하지 않아요.
            </p>
          </Fold>

          <Fold icon={AlertTriangle} title="투자 유의사항 (면책조항)">
            <p style={{ fontSize: 12, lineHeight: 1.75, color: C.inkSoft, margin: '0 0 9px' }}>
              이 사이트에서 제공하는 모든 정보는 <b>투자 자문이나 특정 종목의 매수·매도 권유가 아니에요.</b> 투자 판단과 그 결과에 대한 책임은 전적으로 투자자 본인에게 있어요.
            </p>
            <p style={{ fontSize: 12, lineHeight: 1.75, color: C.inkSoft, margin: '0 0 9px' }}>
              배당금·배당수익률·주가는 계속 변동해요. 종목분석에 담긴 배당 이력·정책은 작성 시점 기준 공개 자료를 바탕으로 정리한 것이라, 실제 최신 배당금·배당일과 다를 수 있어요. 매수·매도 결정 전에는 반드시 기업 IR·DART 전자공시 등 공식 출처에서 최신 정보를 다시 확인해주세요.
            </p>
            <p style={{ fontSize: 12, lineHeight: 1.75, color: C.inkSoft, margin: '0 0 9px' }}>
              세후 배당금·세금 계산 결과는 원화 15.4%, 미국 주식 15% 원천징수를 적용한 간이 추정치예요. 실제 과세는 개인의 종합소득 구간, 금융소득종합과세 여부 등에 따라 달라질 수 있어, 정확한 세금은 세무 전문가와 상담하시는 게 안전해요.
            </p>
            <p style={{ fontSize: 12, lineHeight: 1.75, color: C.inkSoft, margin: 0 }}>
              과거 배당 지급 이력이 미래의 배당 지급을 보장하지 않아요. 기업은 실적·경영 상황에 따라 배당을 축소하거나 중단할 수 있어요.
            </p>
          </Fold>

          <Fold icon={Mail} title="문의하기">
            <p style={{ fontSize: 12, lineHeight: 1.75, color: C.inkSoft, margin: '0 0 9px' }}>
              종목 정보의 오탈자나 잘못된 내용을 발견하셨거나, 다뤘으면 하는 종목·주제가 있으시면 언제든 알려주세요. 확인 후 반영하고 있어요.
            </p>
            <p style={{ fontSize: 12, lineHeight: 1.75, color: C.inkSoft, margin: 0 }}>
              이메일: <a href="mailto:contact@dividendpassbook.com" style={{ color: C.cover, fontWeight: 700 }}>contact@dividendpassbook.com</a><br />
              오류 제보, 데이터 정정 요청, 기능 제안, 제휴 문의 모두 이 이메일로 받고 있어요.
            </p>
          </Fold>

          <p style={{ fontSize: 10.5, color: C.inkSoft, opacity: 0.7, textAlign: 'center', lineHeight: 1.7, margin: '16px 0 0' }}>
            본 계산기는 참고용이며 투자 자문이 아니에요.<br />실제 배당금은 기업 정책·환율에 따라 달라질 수 있어요.
          </p>
        </div>

        <div style={{ border: `1px dashed ${C.lineStrong}`, borderRadius: 8, padding: '9px 14px', textAlign: 'center', fontSize: 10.5, color: C.inkSoft, opacity: 0.55, marginTop: 14 }}>
          광고 영역 · AdSense 승인 후 스크립트 삽입
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, strong, hot }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px dashed ${C.line}` }}>
      <span style={{ fontSize: 11, color: hot ? C.stamp : C.inkSoft, fontWeight: hot ? 700 : 500 }}>{k}</span>
      <span style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: strong ? 15 : 12.5, fontWeight: strong ? 700 : 600,
        color: hot ? C.stamp : C.ink,
      }}>
        {v}
      </span>
    </div>
  );
}
