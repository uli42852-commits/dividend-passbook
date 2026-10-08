// "배당 월급" 시뮬레이션 — 매달 일정 금액을 N년 동안 모으면 그 뒤 매달 배당을 얼마 받는지 계산해요.
// 순수 함수만 둬서 수집 스크립트(Node)와 화면(브라우저)이 함께 써요.
//
// 과거 수익률을 수십 년 그대로 늘리는 한 가지 결과 대신
// - 배당 증가율을 "과거 그대로 / 절반 / 성장 없음" 세 시나리오로 나란히 계산하고,
// - 배당수익률은 지금 수준을 유지한다고 봐서(주가가 배당과 같은 속도로 성장) 결과가 폭주하지 않게 하며,
// - 세후 금액과 물가를 반영한 "오늘 돈 가치"를 같이 보여줘요.

const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;
const YEAR = 365.25 * 86400;

// 순위·자동 채우기에 쓰는 종목 (과거 10년 월간 데이터를 받아요)
export const HISTORY_TICKERS = [
  'SCHD', 'VYM', 'VIG', 'DGRO', 'HDV', 'NOBL', 'SPYD', 'JEPI', 'JEPQ', 'DIVO',
  'O', 'ADC', 'STAG', 'PLD', 'MAIN', 'ARCC',
  'KO', 'PEP', 'PG', 'JNJ', 'ABBV', 'MRK', 'PFE', 'MSFT', 'AAPL', 'AVGO', 'TXN', 'CSCO', 'IBM',
  'HD', 'LOW', 'MCD', 'SBUX', 'COST', 'WMT', 'CVX', 'XOM', 'VZ', 'T', 'MO', 'PM',
  'JPM', 'BAC', 'MS', 'GS',
  '005930', '105560', '055550', '086790', '316140', '033780', '017670', '030200', '000270', '005380',
  '458730', '402970', '088980',
];

// Yahoo Finance v8 chart(range=10y, interval=1mo, events=div) → 과거 성장 통계
// { currency, price, yield, divGrowth, priceGrowth, years, asOf } — 3년 미만이거나 형식이 다르면 null
export function computeHistoryStats(json) {
  const r = json?.chart?.result?.[0];
  if (!r || !r.meta) return null;
  const currency = r.meta.currency === 'KRW' ? 'KRW' : r.meta.currency === 'USD' ? 'USD' : null;
  if (!currency) return null;

  const ts = Array.isArray(r.timestamp) ? r.timestamp : [];
  const closes = r.indicators?.quote?.[0]?.close || [];
  const series = ts.map((t, i) => [t, closes[i]]).filter(([, c]) => Number.isFinite(c) && c > 0);
  if (series.length < 2) return null;

  const [t0, p0] = series[0];
  const metaPrice = r.meta.regularMarketPrice;
  const tEnd = Number.isFinite(r.meta.regularMarketTime) ? r.meta.regularMarketTime : series[series.length - 1][0];
  const pEnd = Number.isFinite(metaPrice) && metaPrice > 0 ? metaPrice : series[series.length - 1][1];
  const years = (tEnd - t0) / YEAR;
  if (years < 3) return null;

  const divs = Object.values(r.events?.dividends || {})
    .filter((d) => Number.isFinite(d?.amount) && d.amount > 0 && Number.isFinite(d?.date));
  const sumBetween = (a, b) => divs.filter((d) => d.date > a && d.date <= b).reduce((s, d) => s + d.amount, 0);
  const ttm = sumBetween(tEnd - YEAR, tEnd);
  const firstYear = sumBetween(t0, t0 + YEAR);
  if (!(ttm > 0)) return null;

  // 첫 1년 합계와 최근 1년 합계 사이 기간(약 years-1년)의 연평균 배당 증가율
  const span = years - 1;
  const divGrowth = firstYear > 0 && span >= 2 ? Math.pow(ttm / firstYear, 1 / span) - 1 : null;
  const priceGrowth = Math.pow(pEnd / p0, 1 / years) - 1;

  return {
    currency,
    price: round(pEnd, currency === 'KRW' ? 0 : 4),
    yield: round(ttm / pEnd, 5),
    divGrowth: divGrowth === null ? null : round(divGrowth, 4),
    priceGrowth: round(priceGrowth, 4),
    years: round(years, 1),
    asOf: new Date(tEnd * 1000).toISOString().slice(0, 10),
  };
}

// 매달 monthly씩 years년 투자 → 마지막 해 기준 월 배당(세후)
// startYield: 지금 배당수익률(연), divGrowth·priceGrowth: 연 성장률, inflation: 연 물가상승률
export function simulateSalary({ monthly, years, startYield, divGrowth, priceGrowth, taxRate = 0, reinvest = true, inflation = 0 }) {
  if (!(monthly > 0) || !(years > 0) || !(startYield > 0)) return null;
  if (!(divGrowth > -1) || !(priceGrowth > -1) || !(inflation > -1)) return null;

  const months = Math.round(years * 12);
  const afterTax = 1 - taxRate;
  let shares = 0;
  let cash = 0;
  let price = 1;
  let divPerShare = startYield; // 연간, 주가 1 기준
  const pg = Math.pow(1 + priceGrowth, 1 / 12);
  const dg = Math.pow(1 + divGrowth, 1 / 12);
  const yearly = [];

  for (let m = 1; m <= months; m++) {
    price *= pg;
    divPerShare *= dg;
    shares += monthly / price;
    const div = (shares * divPerShare * afterTax) / 12;
    if (reinvest) shares += div / price;
    else cash += div;
    if (m % 12 === 0) {
      yearly.push({ year: m / 12, monthlyDividend: (shares * divPerShare * afterTax) / 12, value: shares * price });
    }
  }

  const monthlyDividend = (shares * divPerShare * afterTax) / 12;
  const deflator = Math.pow(1 + inflation, years);
  const principal = monthly * months;
  return {
    principal,
    value: shares * price,
    cashReceived: cash,
    monthlyDividend,
    monthlyDividendReal: monthlyDividend / deflator,
    endYield: divPerShare / price, // 마지막 시점 주가 대비 배당수익률 (비현실적으로 커지지 않는지 확인용)
    yieldOnCost: (monthlyDividend * 12) / principal,
    yearly,
  };
}

// 같은 종목을 세 가지 가정으로 — 과거 그대로 / 과거의 절반 / 성장 없음(지금 배당 유지)
// 배당과 주가는 같은 속도로 성장한다고 봐요(= 배당수익률 유지). 둘을 따로 늘리면
// 배당이 주가보다 빨리 늘어난 종목은 수십 년 뒤 배당수익률이 수십~수백 %가 되는 비현실적인 결과가 나와요.
export const SCENARIO_KEYS = ['history', 'half', 'flat'];
export const SCENARIO_LABEL = { history: '과거 그대로', half: '과거의 절반', flat: '성장 없음' };

export function scenarioGrowths(divGrowth) {
  const g = Number.isFinite(divGrowth) ? divGrowth : 0;
  return {
    history: { divGrowth: g, priceGrowth: g },
    half: { divGrowth: g / 2, priceGrowth: g / 2 },
    flat: { divGrowth: 0, priceGrowth: 0 },
  };
}
