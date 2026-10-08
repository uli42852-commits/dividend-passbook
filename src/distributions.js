// 분배금 데이터(public/distributions.json) 해석 — 수집 스크립트, 프리렌더, 원금회수 계산기가 함께 써요.
// 순수 함수만 둬서 Node와 브라우저 양쪽에서 그대로 import할 수 있어요.

const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;
const isoDate = (sec) => new Date(sec * 1000).toISOString().slice(0, 10);

// Yahoo Finance v8 chart 응답 → { currency, price, priceDate, change1y, distributions: [{ exDate, amount }] (최신순) }
// 형식이 예상과 다르면 null (호출하는 쪽에서 이전 데이터를 유지)
export function parseYahooChart(json) {
  const r = json?.chart?.result?.[0];
  if (!r || !r.meta) return null;
  const currency = r.meta.currency === 'KRW' ? 'KRW' : r.meta.currency === 'USD' ? 'USD' : null;
  if (!currency) return null;

  const ts = Array.isArray(r.timestamp) ? r.timestamp : [];
  const closes = r.indicators?.quote?.[0]?.close || [];
  const series = ts.map((t, i) => [t, closes[i]]).filter(([, c]) => Number.isFinite(c) && c > 0);

  const metaPrice = r.meta.regularMarketPrice;
  const price = Number.isFinite(metaPrice) && metaPrice > 0 ? metaPrice : series.length ? series[series.length - 1][1] : null;
  if (!price) return null;
  const priceTime = Number.isFinite(r.meta.regularMarketTime) ? r.meta.regularMarketTime : series.length ? series[series.length - 1][0] : null;

  const divs = Object.values(r.events?.dividends || {})
    .filter((d) => Number.isFinite(d?.amount) && d.amount > 0 && Number.isFinite(d?.date))
    .sort((a, b) => b.date - a.date)
    .map((d) => ({ exDate: isoDate(d.date), amount: round(d.amount, 6) }));

  // 1년 전 종가 대비 변화 (데이터가 9개월치 이상일 때만 — 상장한 지 얼마 안 된 종목은 비워둠)
  let change1y = null;
  if (series.length && series[series.length - 1][0] - series[0][0] >= 270 * 86400) {
    change1y = round(price / series[0][1] - 1, 4);
  }

  return {
    currency,
    price: round(price, currency === 'KRW' ? 0 : 4),
    priceDate: priceTime ? isoDate(priceTime) : null,
    change1y,
    distributions: divs,
  };
}

// 최근 1년 지급 횟수로 주기 추정 (주배당 52, 월배당 12, 분기 4)
export function inferPerYear(entry) {
  const n = entry?.distributions?.length || 0;
  if (n >= 40) return 52;
  if (n >= 10) return 12;
  return 4;
}

// 최근 n회 평균 분배금 (자료가 n회보다 적으면 있는 만큼)
export function averageRecent(entry, n) {
  const list = (entry?.distributions || []).slice(0, n);
  if (!list.length) return null;
  return list.reduce((s, d) => s + d.amount, 0) / list.length;
}

// 최근 1년 분배금 합계
export function trailingTotal(entry) {
  return (entry?.distributions || []).reduce((s, d) => s + d.amount, 0);
}

// 브라우저에서 /distributions.json을 한 번만 받아 공유 (없거나 실패하면 null)
let distPromise = null;
export function loadDistributions() {
  if (!distPromise) {
    distPromise = fetch('/distributions.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((j) => (j && j.tickers ? j : null))
      .catch(() => null);
  }
  return distPromise;
}
