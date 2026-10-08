// scripts/fetch-distributions.mjs
// 주배당·월배당 종목의 최근 1년 분배 이력과 최신 주가를 받아 public/distributions.json에,
// 대표 배당주의 과거 10년 배당·주가 성장 통계를 public/history.json에 저장해요.
// GitHub Actions(.github/workflows/update-distributions.yml)가 매주 실행하고, 바뀐 게 있으면 커밋해요.
// → Vercel이 새 커밋을 배포하면서 원금회수 계산기 자동 채우기와 종목 페이지 "최근 분배금" 표가 갱신돼요.
//
// 데이터 출처: Yahoo Finance 차트 API (공식 API가 아니라서 형식이 바뀌거나 막힐 수 있어요).
// 그래서 안전장치를 둬요:
//   - 종목 하나가 실패하면 그 종목은 이전 데이터를 그대로 유지
//   - 절반 넘게 실패하면 파일을 아예 건드리지 않음 (출처가 막힌 상황으로 보고 기존 데이터 보호)
//
// 사용법: node scripts/fetch-distributions.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MONTHLY_TICKERS, WEEKLY_TICKERS } from '../src/payMonths.js';
import { parseYahooChart } from '../src/distributions.js';
import { HISTORY_TICKERS, computeHistoryStats } from '../src/salary.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.DIST_OUT || path.join(__dirname, '..', 'public', 'distributions.json');
const HISTORY_OUT = process.env.HISTORY_OUT || path.join(__dirname, '..', 'public', 'history.json');

// 국내 상장(6자리 코드)은 Yahoo에서 .KS, 그 외 문자 티커는 미국 상장으로 조회
function yahooSymbol(ticker) {
  if (/^\d{6}$/.test(ticker)) return `${ticker}.KS`;
  if (/^[A-Z]{1,5}$/.test(ticker)) return ticker;
  return null; // GRP.U 같은 해외 상장 종목은 건너뜀
}

async function fetchChart(ticker, query, parse) {
  const symbol = yahooSymbol(ticker);
  if (!symbol) return { ticker, skipped: true };
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${query}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (dividendpassbook.com data updater)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const parsed = parse(await res.json());
  if (!parsed) throw new Error('unexpected response shape');
  return { ticker, data: parsed };
}

// 종목 목록을 받아 파일 하나를 갱신 — 실패한 종목은 이전 값 유지, 절반 넘게 실패하면 파일을 건드리지 않음
async function updateFile({ label, out, tickers, query, parse }) {
  let previous = { tickers: {} };
  try { previous = JSON.parse(fs.readFileSync(out, 'utf-8')); } catch (e) { /* 첫 실행 */ }

  const next = { ...previous.tickers };
  let ok = 0, failed = 0, skipped = 0;
  const queue = [...tickers];
  const worker = async () => {
    while (queue.length) {
      const t = queue.shift();
      try {
        const r = await fetchChart(t, query, parse);
        if (r.skipped) { skipped++; continue; }
        next[t] = r.data;
        ok++;
      } catch (e) {
        failed++;
        console.warn(`[${label}] ${t} 실패: ${e.message} (이전 데이터 유지)`);
      }
      await new Promise((r) => setTimeout(r, 250)); // 출처에 부담 주지 않도록 천천히
    }
  };
  await Promise.all([worker(), worker(), worker()]);

  const attempted = ok + failed;
  console.log(`[${label}] 성공 ${ok} · 실패 ${failed} · 건너뜀 ${skipped}`);
  if (attempted === 0 || failed > attempted / 2) {
    console.error(`[${label}] 실패가 너무 많아 파일을 갱신하지 않아요 (출처가 막혔거나 형식이 바뀐 것 같아요)`);
    return false;
  }

  const data = {
    updatedAt: new Date().toISOString().slice(0, 10),
    source: 'Yahoo Finance',
    tickers: Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b))),
  };
  fs.writeFileSync(out, JSON.stringify(data, null, 1) + '\n', 'utf-8');
  console.log(`[${label}] ${out} 저장 (${Object.keys(data.tickers).length}개 종목)`);
  return true;
}

async function main() {
  // 1) 주배당·월배당 종목의 최근 1년 분배 이력 → 원금회수 계산기, 종목 페이지 "최근 분배금"
  const okDist = await updateFile({
    label: 'distributions',
    out: OUT,
    tickers: [...new Set([...WEEKLY_TICKERS, ...MONTHLY_TICKERS])],
    query: 'range=1y&interval=1d&events=div',
    parse: parseYahooChart,
  });
  // 2) 대표 배당주의 과거 10년 성장 통계 → 배당 월급 시뮬레이터
  const okHist = await updateFile({
    label: 'history',
    out: HISTORY_OUT,
    tickers: HISTORY_TICKERS,
    query: 'range=10y&interval=1mo&events=div',
    parse: computeHistoryStats,
  });
  if (!okDist || !okHist) process.exitCode = 1;
}

main();
