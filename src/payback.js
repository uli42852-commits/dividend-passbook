// 원금회수 계산 — 순수 함수만 둬서 Node에서도 바로 검증할 수 있어요.
//
// 가정
// - 분배율(주가 대비 분배금 비율)은 처음과 같게 유지돼요. 그래서 주가가 내려가면 분배금도 같이 줄어요.
//   커버드콜·주배당 ETF는 보통 순자산가치(NAV)에 비례해 분배하므로 이 가정이 더 현실에 가까워요.
// - 주가는 매년 같은 비율(annualPriceChange)로 변해요. 실제로는 들쭉날쭉하니 시나리오로만 보세요.
// - 받은 분배금은 재투자하지 않고 현금으로 모아요(= 원금회수의 의미).

export const FREQUENCIES = [
  { v: 52, t: '매주' },
  { v: 12, t: '매월' },
  { v: 4, t: '분기' },
];

export const MAX_YEARS = 30;

export function simulatePayback({ invest, price, dps, perYear, taxRate, annualPriceChange }) {
  if (!(invest > 0) || !(price > 0) || !(dps > 0) || !(perYear > 0)) return null;
  if (!(annualPriceChange > -1)) return null;

  const shares = invest / price;
  const yieldPerPeriod = dps / price;
  const growth = Math.pow(1 + annualPriceChange, 1 / perYear);
  const afterTax = 1 - (taxRate || 0);
  const totalPeriods = perYear * MAX_YEARS;

  let p = price;
  let cumulative = 0;
  let paybackPeriod = null;
  let valueAtPayback = null;
  // 차트용으로는 한 달 단위로만 기록 (주배당이면 30년에 1,560점이라 너무 많음)
  const monthly = [{ month: 0, cumulative: 0, value: invest }];
  let nextMonthMark = 1;

  for (let i = 1; i <= totalPeriods; i++) {
    p *= growth;
    cumulative += shares * p * yieldPerPeriod * afterTax;
    const value = shares * p;
    if (paybackPeriod === null && cumulative >= invest) {
      paybackPeriod = i;
      valueAtPayback = value;
    }
    const monthsElapsed = (i / perYear) * 12;
    while (monthsElapsed + 1e-9 >= nextMonthMark) {
      monthly.push({ month: nextMonthMark, cumulative, value });
      nextMonthMark++;
    }
  }

  const firstDistribution = shares * dps * afterTax;
  return {
    shares,
    annualYield: yieldPerPeriod * perYear,
    firstDistribution,
    firstMonthlyAvg: (firstDistribution * perYear) / 12,
    paybackPeriod,
    paybackMonths: paybackPeriod === null ? null : (paybackPeriod / perYear) * 12,
    valueAtPayback,
    monthly,
  };
}

// "1년 7개월" 형태 (올림해서 회수가 끝나는 달 기준)
export function formatMonths(months) {
  const m = Math.ceil(months - 1e-9);
  const y = Math.floor(m / 12);
  const r = m % 12;
  if (y === 0) return `${r}개월`;
  return r === 0 ? `${y}년` : `${y}년 ${r}개월`;
}
