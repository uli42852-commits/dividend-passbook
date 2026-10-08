import React, { useEffect, useMemo, useState } from 'react';
import { simulateSalary, scenarioGrowths, SCENARIO_KEYS, SCENARIO_LABEL } from './salary.js';

const INPUT_KEY = 'dividend-passbook-salary-v1';
const TAX = { USD: 0.15, KRW: 0.154 };
const MONTHLY_PRESETS = [100000, 300000, 500000, 1000000];
const YEAR_PRESETS = [10, 20, 30];
const RANK_PAGE = 10;
const MANUAL_DEFAULT = { yield: '3.5', divGrowth: '5' };

const ink = 'var(--pb-ink)';
const soft = 'var(--pb-ink-soft)';
const line = 'var(--pb-line)';
const card = { background: 'var(--pb-card-bg)', border: `1px solid ${line}`, borderRadius: 16, padding: 16, marginBottom: 12 };

// 매주 GitHub Actions가 갱신하는 대표 배당주 과거 10년 통계 (scripts/fetch-distributions.mjs)
let historyPromise = null;
function loadHistory() {
  if (!historyPromise) {
    historyPromise = fetch('/history.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((j) => (j && j.tickers ? j : null))
      .catch(() => null);
  }
  return historyPromise;
}

function man(n) {
  if (!Number.isFinite(n)) return '-';
  if (n >= 1e8) return `${(n / 1e8).toFixed(1)}억원`;
  if (n >= 1e4) return `${Math.round(n / 1e4).toLocaleString('ko-KR')}만원`;
  return `${Math.round(n).toLocaleString('ko-KR')}원`;
}
const pct = (g, d = 1) => (g === null || g === undefined ? '-' : `${g > 0 ? '+' : ''}${(g * 100).toFixed(d)}%`);
const isKr = (t) => /^\d{6}$/.test(t);

function loadInputs() {
  try {
    const raw = JSON.parse(window.localStorage.getItem(INPUT_KEY) || 'null');
    if (raw && raw.monthly) return raw;
  } catch (e) { /* ignore */ }
  return { monthly: '300000', years: 30, reinvest: true, real: true, inflation: '2.5', tax: true, market: 'US', ticker: null, ...MANUAL_DEFAULT };
}

export default function Salary({ data, onNavigate }) {
  const [f, setF] = useState(loadInputs);
  const [hist, setHist] = useState(null);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    try { window.localStorage.setItem(INPUT_KEY, JSON.stringify(f)); } catch (e) { /* ignore */ }
  }, [f]);
  useEffect(() => {
    let alive = true;
    loadHistory().then((h) => { if (alive) setHist(h); });
    return () => { alive = false; };
  }, []);

  const num = (s) => parseFloat(String(s).replace(/,/g, ''));
  const monthly = num(f.monthly);
  const years = Number(f.years);
  const inflation = num(f.inflation) / 100;
  const nameOf = (t) => data?.STOCKS.find((s) => s.ticker === t)?.name || t;
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  // 같은 조건으로 종목 하나를 세 시나리오로 계산
  const runScenarios = (startYield, divGrowth, currency) => {
    const g = scenarioGrowths(divGrowth);
    const out = {};
    for (const k of SCENARIO_KEYS) {
      out[k] = simulateSalary({
        monthly, years, startYield, ...g[k],
        taxRate: f.tax ? TAX[currency] : 0, reinvest: f.reinvest, inflation: Number.isFinite(inflation) ? inflation : 0,
      });
    }
    return out;
  };
  const shown = (r) => (r ? (f.real ? r.monthlyDividendReal : r.monthlyDividend) : null);

  // 순위: '과거의 절반' 시나리오 기준 (과거 성장률을 그대로 30년 늘리면 많이 오른 종목이 과하게 위로 올라가서)
  const ranking = useMemo(() => {
    if (!hist) return [];
    return Object.entries(hist.tickers)
      .filter(([t]) => (f.market === 'KR' ? isKr(t) : !isKr(t)))
      .filter(([, h]) => h && h.yield > 0)
      .map(([t, h]) => ({ ticker: t, h, sc: runScenarios(h.yield, h.divGrowth, h.currency) }))
      .filter((x) => x.sc.half)
      .sort((a, b) => shown(b.sc.half) - shown(a.sc.half));
  }, [hist, f]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = f.ticker && hist?.tickers[f.ticker];
  const manual = {
    startYield: num(f.yield) / 100, divGrowth: num(f.divGrowth) / 100,
    currency: f.ticker ? selected?.currency || 'USD' : f.market === 'KR' ? 'KRW' : 'USD',
  };
  const detail = useMemo(
    () => runScenarios(manual.startYield, manual.divGrowth, manual.currency),
    [f, hist], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const pick = (t) => {
    const h = hist?.tickers[t];
    if (!h) return;
    setF((p) => ({
      ...p, ticker: t,
      yield: (h.yield * 100).toFixed(2),
      divGrowth: ((h.divGrowth ?? 0) * 100).toFixed(1),
    }));
    setTimeout(() => document.getElementById('salary-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const input = {
    width: '100%', background: 'var(--pb-input-bg)', borderRadius: 10, padding: '11px 12px', fontSize: 16,
    color: ink, border: '1px solid var(--pb-line-strong)', boxSizing: 'border-box',
  };
  const label = { display: 'block', fontSize: 13, color: soft, marginBottom: 6, fontWeight: 600 };
  const chip = (on) => ({
    flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
    border: `1px solid ${on ? 'var(--pb-cover)' : 'var(--pb-line-strong)'}`,
    background: on ? 'var(--pb-cover)' : 'transparent', color: on ? 'var(--pb-foil)' : soft,
  });
  const toggle = (k, text) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: ink, cursor: 'pointer' }}>
      <input type="checkbox" checked={f[k]} onChange={(e) => setF((p) => ({ ...p, [k]: e.target.checked }))} style={{ width: 18, height: 18, accentColor: 'var(--pb-cover)' }} />
      {text}
    </label>
  );
  const principal = monthly * years * 12;
  const valueLabel = f.real ? '오늘 돈 가치' : '그때 금액';
  const fastGrowth = num(f.divGrowth) > 10;
  const rankShown = ranking.slice(0, showAll ? undefined : RANK_PAGE);

  return (
    <section style={{ marginTop: 6, marginBottom: 14 }}>
      <h2 style={{ fontWeight: 700, fontSize: 20, color: ink, margin: '0 0 4px' }}>배당 월급 시뮬레이터</h2>
      <p style={{ fontSize: 13, color: soft, margin: '0 0 14px', lineHeight: 1.6 }}>
        매달 모은 돈이 몇 년 뒤 매달 얼마의 배당이 되는지 계산해요. 과거 성장률을 그대로 믿지 않도록 세 가지 가정을 나란히 보여줘요.
      </p>

      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={label} htmlFor="sl-monthly">매달 투자금 (원)</label>
          <input id="sl-monthly" type="number" inputMode="numeric" min="0" step="10000" value={f.monthly} onChange={set('monthly')} style={input} />
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {MONTHLY_PRESETS.map((v) => (
              <button key={v} type="button" onClick={() => setF((p) => ({ ...p, monthly: String(v) }))} style={{ ...chip(monthly === v), fontSize: 13, padding: '7px 0' }}>{man(v)}</button>
            ))}
          </div>
        </div>
        <div>
          <span style={label}>투자 기간</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {YEAR_PRESETS.map((y) => (
              <button key={y} type="button" onClick={() => setF((p) => ({ ...p, years: y }))} style={chip(years === y)}>{y}년</button>
            ))}
          </div>
          <p style={{ fontSize: 13, color: soft, margin: '8px 0 0' }}>모으는 원금 {man(principal)}</p>
        </div>
        {toggle('reinvest', '모으는 동안 받은 배당은 다시 투자 (재투자)')}
        {toggle('tax', '배당세 반영 (국내 15.4%, 미국 15%)')}
        <div>
          {toggle('real', '오늘 돈 가치로 보기 (물가 반영)')}
          {f.real && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: soft, margin: '8px 0 0 26px' }}>
              연 물가상승률
              <input type="number" inputMode="decimal" step="0.1" value={f.inflation} onChange={set('inflation')}
                style={{ ...input, width: 76, padding: '6px 8px', fontSize: 15, textAlign: 'right' }} />
              %
            </label>
          )}
        </div>
      </div>

      {hist && ranking.length > 0 && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: ink }}>{years}년 뒤 월 배당 순위</span>
            <span style={{ fontSize: 12, color: soft }}>{hist.updatedAt} 기준</span>
          </div>
          <p style={{ fontSize: 12.5, color: soft, margin: '4px 0 10px', lineHeight: 1.6 }}>
            큰 숫자는 <b style={{ color: ink }}>과거 성장률의 절반</b>이 이어진다고 볼 때예요. 아래 작은 숫자는 과거 그대로(낙관)와 성장 없음(비관)일 때예요. 단위: {valueLabel}, 세후
          </p>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            {[['US', '미국 주식'], ['KR', '국내 주식']].map(([v, t]) => (
              <button key={v} type="button" onClick={() => { setF((p) => ({ ...p, market: v })); setShowAll(false); }} style={chip(f.market === v)}>{t}</button>
            ))}
          </div>
          {rankShown.map((x, i) => (
            <button key={x.ticker} type="button" onClick={() => pick(x.ticker)} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', background: f.ticker === x.ticker ? 'var(--pb-cover-soft)' : 'transparent',
              border: 'none', borderBottom: `1px solid ${line}`, padding: '12px 4px', cursor: 'pointer', color: ink,
            }}>
              <span style={{ width: 22, fontSize: 15, fontWeight: 800, color: i < 3 ? 'var(--pb-brass)' : soft }}>{i + 1}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameOf(x.ticker)}</span>
                <span style={{ fontSize: 12, color: soft }}>
                  배당 {pct(x.h.yield)} · 배당 증가 {pct(x.h.divGrowth)}/년{x.h.years < 9.5 ? ` · 상장 ${Math.floor(x.h.years)}년 자료` : ''}
                </span>
              </span>
              <span style={{ textAlign: 'right', flexShrink: 0 }}>
                <span style={{ display: 'block', fontSize: 16, fontWeight: 800, color: 'var(--pb-cover)' }}>월 {man(shown(x.sc.half))}</span>
                <span style={{ fontSize: 11.5, color: soft }}>{man(shown(x.sc.flat))} ~ {man(shown(x.sc.history))}</span>
              </span>
            </button>
          ))}
          {ranking.length > RANK_PAGE && (
            <button type="button" onClick={() => setShowAll((v) => !v)} style={{ width: '100%', marginTop: 10, padding: 10, borderRadius: 10, fontSize: 14, fontWeight: 700, background: 'transparent', color: 'var(--pb-cover)', border: '1px solid var(--pb-line-strong)', cursor: 'pointer' }}>
              {showAll ? '접기' : `전체 ${ranking.length}개 보기`}
            </button>
          )}
          <p style={{ fontSize: 12, color: soft, margin: '10px 0 0', lineHeight: 1.6 }}>
            종목을 누르면 아래에서 가정을 직접 바꿔볼 수 있어요. 과거 성적이 좋았던 종목일수록 "과거 그대로" 숫자가 크게 나오지만, 같은 속도가 수십 년 이어진다는 보장은 없어요. 특별배당이 있던 해는 배당성장률이 실제보다 높게 잡힐 수 있어요.
          </p>
        </div>
      )}

      <div id="salary-detail" style={{ ...card, scrollMarginTop: 112 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: ink }}>{f.ticker ? nameOf(f.ticker) : '직접 입력'}</span>
          {f.ticker && (
            <span style={{ display: 'flex', gap: 12, fontSize: 13 }}>
              <a href={`/stocks/${f.ticker}`} onClick={(e) => { e.preventDefault(); onNavigate('stocks', f.ticker); }} style={{ color: 'var(--pb-cover)' }}>종목 정보</a>
              <button type="button" onClick={() => setF((p) => ({ ...p, ticker: null, ...MANUAL_DEFAULT }))} style={{ background: 'none', border: 'none', padding: 0, color: soft, cursor: 'pointer', textDecoration: 'underline', fontSize: 13 }}>직접 입력으로</button>
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
          {[['yield', '지금 배당수익률'], ['divGrowth', '과거 배당 증가율(연)']].map(([k, t]) => (
            <div key={k} style={{ flex: 1, minWidth: 0 }}>
              <label style={{ ...label, fontSize: 12 }} htmlFor={`sl-${k}`}>{t}</label>
              <div style={{ position: 'relative' }}>
                <input id={`sl-${k}`} type="number" inputMode="decimal" step="0.1" value={f[k]} onChange={set(k)} style={{ ...input, padding: '9px 22px 9px 10px', fontSize: 15 }} />
                <span style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: soft }}>%</span>
              </div>
            </div>
          ))}
        </div>
        {f.ticker && selected && (
          <p style={{ fontSize: 12, color: soft, margin: '0 0 10px' }}>
            과거 {selected.years}년 자료로 채웠어요 ({selected.asOf} 기준, 출처 {hist.source}). 참고로 같은 기간 주가는 연 {pct(selected.priceGrowth)} 움직였어요. 숫자를 바꿔서 다른 가정도 볼 수 있어요.
          </p>
        )}

        {!detail.history ? (
          <p style={{ fontSize: 14, color: soft, textAlign: 'center', margin: '14px 0' }}>매달 투자금과 배당수익률을 0보다 크게 입력해 주세요.</p>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, margin: '6px 0 12px' }}>
              {SCENARIO_KEYS.map((k) => {
                const r = detail[k];
                const main = k === 'half';
                return (
                  <div key={k} style={{
                    borderRadius: 12, padding: '12px 8px', textAlign: 'center',
                    background: main ? 'var(--pb-cover-soft)' : 'var(--pb-input-bg)',
                    border: `1px solid ${main ? 'var(--pb-cover)' : line}`,
                  }}>
                    <div style={{ fontSize: 12, color: soft, fontWeight: 600 }}>{SCENARIO_LABEL[k]}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: main ? 'var(--pb-cover)' : ink, margin: '4px 0 2px', letterSpacing: '-0.02em' }}>월 {man(shown(r))}</div>
                    <div style={{ fontSize: 11.5, color: soft }}>{valueLabel}</div>
                  </div>
                );
              })}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr style={{ color: soft, fontSize: 12, textAlign: 'right' }}>
                  <th style={{ textAlign: 'left', fontWeight: 600, padding: '6px 0' }}>{years}년 뒤</th>
                  {SCENARIO_KEYS.map((k) => <th key={k} style={{ fontWeight: 600 }}>{SCENARIO_LABEL[k]}</th>)}
                </tr>
              </thead>
              <tbody>
                {[
                  ['월 배당 (그때 금액)', (r) => man(r.monthlyDividend)],
                  ['모은 주식 평가액', (r) => man(r.value)],
                  ['원금 대비 배당률', (r) => `${(r.yieldOnCost * 100).toFixed(1)}%`],
                ].map(([t, fn]) => (
                  <tr key={t} style={{ borderTop: `1px solid ${line}`, textAlign: 'right', color: ink }}>
                    <td style={{ textAlign: 'left', padding: '8px 0', color: soft }}>{t}</td>
                    {SCENARIO_KEYS.map((k) => <td key={k}>{fn(detail[k])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {fastGrowth && (
              <p style={{ fontSize: 13, lineHeight: 1.6, margin: '12px 0 0', padding: '10px 12px', borderRadius: 10, background: 'var(--pb-stamp-06)', color: ink }}>
                <b style={{ color: 'var(--pb-stamp)' }}>가정 확인.</b> 연 10%가 넘는 배당 증가가 {years}년 내내 이어진 사례는 드물어요. "과거 그대로" 숫자는 낙관적인 상한선으로 보고, "과거의 절반"을 기준으로 보는 게 안전해요.
              </p>
            )}
          </>
        )}
      </div>

      <div style={{ ...card, fontSize: 13, color: soft, lineHeight: 1.7 }}>
        <div style={{ fontWeight: 700, color: ink, marginBottom: 6 }}>이렇게 계산해요</div>
        <p style={{ margin: '0 0 6px' }}>· 매달 같은 금액으로 주식을 사고, 마지막 달 기준 1년 치 세후 배당을 12로 나눠 월 배당을 구해요.</p>
        <p style={{ margin: '0 0 6px' }}>· 배당수익률은 지금 수준을 유지한다고 봐요(주가가 배당과 같은 속도로 오름). 배당과 주가를 따로 늘리면, 배당이 주가보다 빨리 늘어난 종목은 수십 년 뒤 배당수익률이 수십 %가 되는 비현실적인 결과가 나오기 때문이에요.</p>
        <p style={{ margin: '0 0 6px' }}>· "과거 그대로"는 최근 최대 10년의 연평균 배당 증가율이 기간 내내 이어지는 경우, "과거의 절반"은 그 절반, "성장 없음"은 지금 배당이 그대로인 경우예요.</p>
        <p style={{ margin: '0 0 6px' }}>· 미국 주식은 환율이 지금과 같다고 가정해요. "오늘 돈 가치"는 입력한 물가상승률로 미래 금액을 할인한 값이에요.</p>
        <p style={{ margin: 0 }}>· 과거 성과는 미래 수익을 보장하지 않아요. 결과는 참고용 시나리오이며 특정 종목의 매수 권유가 아니에요.</p>
      </div>
    </section>
  );
}
