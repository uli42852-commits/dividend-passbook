import React, { useEffect, useMemo, useRef, useState } from 'react';
import { simulatePayback, formatMonths, FREQUENCIES, MAX_YEARS } from './payback.js';
import { WEEKLY_TICKERS } from './payMonths.js';

const INPUT_KEY = 'dividend-passbook-payback-v1';
const TAX = { USD: 0.15, KRW: 0.154 };
const SCENARIOS = [0, -0.15, -0.3];
const PRICE_PRESETS = [
  { v: 0, t: '유지' },
  { v: -0.15, t: '연 -15%' },
  { v: -0.3, t: '연 -30%' },
];
const DEFAULTS = {
  USD: { invest: '10000', price: '20', dps: '0.25' },
  KRW: { invest: '10000000', price: '10000', dps: '100' },
};

const ink = 'var(--pb-ink)';
const soft = 'var(--pb-ink-soft)';
const line = 'var(--pb-line)';
const card = { background: 'var(--pb-card-bg)', border: `1px solid ${line}`, borderRadius: 16, padding: 16, marginBottom: 12 };

function money(n, cur) {
  if (!Number.isFinite(n)) return '-';
  if (cur === 'USD') return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return Math.round(n).toLocaleString('ko-KR') + '원';
}

function compact(n, cur) {
  if (cur === 'USD') return n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `$${Math.round(n)}`;
  return n >= 1e8 ? `${(n / 1e8).toFixed(1)}억` : n >= 1e4 ? `${Math.round(n / 1e4).toLocaleString('ko-KR')}만` : `${Math.round(n)}`;
}

function loadInputs() {
  try {
    const raw = JSON.parse(window.localStorage.getItem(INPUT_KEY) || 'null');
    if (raw && (raw.cur === 'USD' || raw.cur === 'KRW')) return raw;
  } catch (e) { /* ignore */ }
  return { cur: 'USD', ...DEFAULTS.USD, perYear: 52, tax: true, change: 0 };
}

/* ── 누적 분배금 vs 남은 주식 가치 (월 단위) ──
   실제 화면 너비에 맞춰 그려서 모바일에서도 글자가 작아지지 않게 하고,
   호버 값은 그래프 위 한 줄에 보여줘서 선을 가리지 않게 해요. */
function PaybackChart({ points, invest, paybackMonths, cur }) {
  const [hover, setHover] = useState(null);
  const [W, setW] = useState(600);
  const boxRef = useRef(null);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => setW(Math.max(260, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = 200, L = 44, R = 8, T = 8, B = 24;
  const last = points[points.length - 1].month;
  const yMax = Math.max(invest * 1.15, ...points.map((p) => Math.max(p.cumulative, p.value))) || 1;
  const x = (m) => L + (m / last) * (W - L - R);
  const y = (v) => T + (1 - v / yMax) * (H - T - B);
  const path = (key) => points.map((p, i) => `${i ? 'L' : 'M'}${x(p.month).toFixed(1)},${y(p[key]).toFixed(1)}`).join('');
  const yTicks = [0, 0.5, 1].map((f) => f * yMax);
  const maxTicks = Math.max(2, Math.floor((W - L - R) / 56));
  // 2년 이상이면 눈금을 해 단위로만 (18개월·30개월 같은 어색한 눈금 방지)
  const xStep = (last >= 24 ? [12, 24, 60, 120] : [3, 6, 12]).find((st) => last / st <= maxTicks) || 120;
  const xTicks = [];
  for (let m = 0; m <= last; m += xStep) xTicks.push(m);

  const onMove = (e) => {
    const rect = boxRef.current.getBoundingClientRect();
    const m = Math.round(((e.clientX - rect.left - L) / (W - L - R)) * last);
    setHover(points[Math.max(0, Math.min(points.length - 1, m))]);
  };
  const shown = hover || points[points.length - 1];

  return (
    <div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13, color: soft, marginBottom: 8 }}>
        <span><span style={{ display: 'inline-block', width: 14, height: 2, background: 'var(--pb-series-1)', verticalAlign: 'middle', marginRight: 5 }} />누적 세후 분배금</span>
        <span><span style={{ display: 'inline-block', width: 14, height: 2, background: 'var(--pb-series-2)', verticalAlign: 'middle', marginRight: 5 }} />남은 주식 가치</span>
        <span><span style={{ display: 'inline-block', width: 14, borderTop: `2px dashed ${soft}`, verticalAlign: 'middle', marginRight: 5 }} />투자 원금</span>
      </div>
      <div aria-live="polite" style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px', fontSize: 13, color: soft, marginBottom: 6, minHeight: 20 }}>
        <b style={{ color: ink }}>{shown.month === 0 ? '투자 시점' : `${formatMonths(shown.month)} 후`}</b>
        <span>분배금 <b style={{ color: ink }}>{money(shown.cumulative, cur)}</b></span>
        <span>남은 주식 <b style={{ color: ink }}>{money(shown.value, cur)}</b></span>
      </div>
      <div ref={boxRef} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} style={{ touchAction: 'pan-y' }}>
        <svg width={W} height={H} role="img" aria-label="기간별 누적 분배금과 남은 주식 가치 그래프" style={{ display: 'block' }}>
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={line} strokeWidth="1" />
              <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="12" fill={soft}>{compact(v, cur)}</text>
            </g>
          ))}
          {xTicks.map((m) => (
            <text key={m} x={x(m)} y={H - 6} textAnchor={m === 0 ? 'start' : 'middle'} fontSize="12" fill={soft}>
              {m === 0 ? '0' : m % 12 === 0 ? `${m / 12}년` : `${m}개월`}
            </text>
          ))}
          <line x1={L} x2={W - R} y1={y(invest)} y2={y(invest)} stroke={soft} strokeWidth="1.5" strokeDasharray="5 4" />
          {paybackMonths !== null && paybackMonths <= last && (
            <line x1={x(paybackMonths)} x2={x(paybackMonths)} y1={T} y2={H - B} stroke={soft} strokeWidth="1" strokeDasharray="2 3" />
          )}
          <path d={path('value')} fill="none" stroke="var(--pb-series-2)" strokeWidth="2" strokeLinejoin="round" />
          <path d={path('cumulative')} fill="none" stroke="var(--pb-series-1)" strokeWidth="2" strokeLinejoin="round" />
          {hover && (
            <g>
              <line x1={x(hover.month)} x2={x(hover.month)} y1={T} y2={H - B} stroke={ink} strokeWidth="1" opacity="0.35" />
              <circle cx={x(hover.month)} cy={y(hover.cumulative)} r="4.5" fill="var(--pb-series-1)" stroke="var(--pb-card-bg)" strokeWidth="2" />
              <circle cx={x(hover.month)} cy={y(hover.value)} r="4.5" fill="var(--pb-series-2)" stroke="var(--pb-card-bg)" strokeWidth="2" />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}

export default function Payback({ data, onNavigate }) {
  const [f, setF] = useState(loadInputs);
  useEffect(() => {
    try { window.localStorage.setItem(INPUT_KEY, JSON.stringify(f)); } catch (e) { /* ignore */ }
  }, [f]);

  const num = (s) => parseFloat(String(s).replace(/,/g, ''));
  const params = {
    invest: num(f.invest), price: num(f.price), dps: num(f.dps), perYear: f.perYear,
    taxRate: f.tax ? TAX[f.cur] : 0, annualPriceChange: f.change,
  };
  const r = useMemo(() => simulatePayback(params), [f]); // eslint-disable-line react-hooks/exhaustive-deps
  const scenarios = useMemo(
    () => SCENARIOS.map((g) => ({ g, r: simulatePayback({ ...params, annualPriceChange: g }) })),
    [f], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const chartPoints = useMemo(() => {
    if (!r) return null;
    const horizon = r.paybackMonths === null ? 60 : Math.min(MAX_YEARS * 12, Math.max(12, Math.ceil(r.paybackMonths * 1.5)));
    return r.monthly.slice(0, horizon + 1);
  }, [r]);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const switchCur = (cur) => setF((p) => (p.cur === cur ? p : { ...p, cur, ...DEFAULTS[cur] }));

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
  const unit = f.cur === 'USD' ? '$' : '원';
  const weeklyStocks = data ? data.STOCKS.filter((s) => WEEKLY_TICKERS.has(s.ticker)) : [];
  const invest = params.invest;
  const lowValue = r && r.valueAtPayback !== null && r.valueAtPayback < invest * 0.5;

  return (
    <section style={{ marginTop: 6, marginBottom: 14 }}>
      <h2 style={{ fontWeight: 700, fontSize: 20, color: ink, margin: '0 0 4px' }}>원금회수 계산기</h2>
      <p style={{ fontSize: 13, color: soft, margin: '0 0 14px', lineHeight: 1.6 }}>
        받은 분배금만으로 투자 원금을 언제 되찾는지, 그때 남은 주식은 얼마인지 계산해요. 주배당·커버드콜 ETF처럼 분배율이 높은 종목에 맞춰 만들었어요.
      </p>

      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <span style={label}>통화</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={() => switchCur('USD')} style={chip(f.cur === 'USD')}>달러</button>
            <button type="button" onClick={() => switchCur('KRW')} style={chip(f.cur === 'KRW')}>원화</button>
          </div>
        </div>
        <div>
          <label style={label} htmlFor="pb-invest">투자금 ({unit})</label>
          <input id="pb-invest" type="number" inputMode="decimal" min="0" value={f.invest} onChange={set('invest')} style={input} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={label} htmlFor="pb-price">매입가 ({unit})</label>
            <input id="pb-price" type="number" inputMode="decimal" min="0" value={f.price} onChange={set('price')} style={input} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={label} htmlFor="pb-dps">1회 주당 분배금 ({unit})</label>
            <input id="pb-dps" type="number" inputMode="decimal" min="0" value={f.dps} onChange={set('dps')} style={input} />
          </div>
        </div>
        <div>
          <span style={label}>지급 주기</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {FREQUENCIES.map((o) => (
              <button key={o.v} type="button" onClick={() => setF((p) => ({ ...p, perYear: o.v }))} style={chip(f.perYear === o.v)}>{o.t}</button>
            ))}
          </div>
          {r && (
            <p style={{ fontSize: 13, color: soft, margin: '8px 0 0' }}>
              연 분배율 <b style={{ color: ink }}>{(r.annualYield * 100).toFixed(1)}%</b> (1회 분배금 × 연 {f.perYear}회 ÷ 매입가)
            </p>
          )}
        </div>
        <div>
          <span style={label}>주가 변화 가정 (연)</span>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {PRICE_PRESETS.map((o) => (
              <button key={o.v} type="button" onClick={() => setF((p) => ({ ...p, change: o.v }))} style={chip(f.change === o.v)}>{o.t}</button>
            ))}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: soft }}>
            직접 입력
            <input type="number" inputMode="decimal" step="1" min="-95" max="100"
              value={Math.round(f.change * 1000) / 10}
              onChange={(e) => { const n = parseFloat(e.target.value); if (Number.isFinite(n) && n > -100 && n <= 100) setF((p) => ({ ...p, change: n / 100 })); }}
              style={{ ...input, width: 90, padding: '7px 10px', fontSize: 15, textAlign: 'right' }} />
            %
          </label>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: ink, cursor: 'pointer' }}>
          <input type="checkbox" checked={f.tax} onChange={(e) => setF((p) => ({ ...p, tax: e.target.checked }))} style={{ width: 18, height: 18, accentColor: 'var(--pb-cover)' }} />
          배당세 원천징수 반영 ({f.cur === 'USD' ? '미국 15%' : '국내 15.4%'})
        </label>
      </div>

      {!r ? (
        <div style={{ ...card, textAlign: 'center', color: soft, fontSize: 14 }}>투자금, 매입가, 분배금을 0보다 크게 입력해 주세요.</div>
      ) : (
        <>
          <div style={card}>
            <div style={{ fontSize: 14, color: soft, fontWeight: 600 }}>분배금으로 원금 회수까지</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: ink, letterSpacing: '-0.03em', margin: '2px 0 12px' }}>
              {r.paybackMonths === null ? `${MAX_YEARS}년 안에 회수 못 해요` : `약 ${formatMonths(r.paybackMonths)}`}
            </div>
            {[
              ['회수까지 분배 횟수', r.paybackPeriod === null ? '-' : `${r.paybackPeriod.toLocaleString('ko-KR')}회`],
              ['첫 회 세후 분배금', money(r.firstDistribution, f.cur)],
              ['처음 월평균 세후 분배금', money(r.firstMonthlyAvg, f.cur)],
              ['회수 시점 남은 주식 가치', r.valueAtPayback === null ? '-' : `${money(r.valueAtPayback, f.cur)} (원금의 ${Math.round((r.valueAtPayback / invest) * 100)}%)`],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0', borderBottom: `1px solid ${line}`, fontSize: 14 }}>
                <span style={{ color: soft }}>{k}</span>
                <b style={{ color: ink, textAlign: 'right' }}>{v}</b>
              </div>
            ))}
            {(lowValue || r.paybackMonths === null) && (
              <p style={{ fontSize: 13, lineHeight: 1.6, margin: '12px 0 0', padding: '10px 12px', borderRadius: 10, background: 'var(--pb-stamp-06)', color: ink }}>
                <b style={{ color: 'var(--pb-stamp)' }}>주의.</b>{' '}
                {r.paybackMonths === null
                  ? '주가가 이 속도로 내려가면 분배금도 함께 줄어서, 분배금만으로는 원금을 되찾지 못해요.'
                  : '원금만큼 분배금을 받는 시점에 남은 주식이 원금의 절반도 안 돼요. 분배금 일부는 사실상 내 원금을 돌려받은 셈일 수 있어요.'}
              </p>
            )}
          </div>

          <div style={card}>
            <div style={{ fontSize: 15, fontWeight: 700, color: ink, marginBottom: 8 }}>기간별 흐름</div>
            <PaybackChart points={chartPoints} invest={invest} paybackMonths={r.paybackMonths} cur={f.cur} />
          </div>

          <div style={card}>
            <div style={{ fontSize: 15, fontWeight: 700, color: ink, marginBottom: 4 }}>주가 시나리오별 비교</div>
            <p style={{ fontSize: 12.5, color: soft, margin: '0 0 8px' }}>같은 분배율에서 주가만 다르게 움직일 때</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ color: soft, fontSize: 12.5, textAlign: 'right' }}>
                  <th style={{ textAlign: 'left', fontWeight: 600, padding: '6px 0' }}>주가 변화</th>
                  <th style={{ fontWeight: 600 }}>회수 기간</th>
                  <th style={{ fontWeight: 600 }}>그때 남은 주식</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map(({ g, r: s }) => (
                  <tr key={g} style={{ borderTop: `1px solid ${line}`, textAlign: 'right', color: ink }}>
                    <td style={{ textAlign: 'left', padding: '8px 0', color: soft }}>{g === 0 ? '유지' : `연 ${Math.round(g * 100)}%`}</td>
                    <td style={{ fontWeight: 700 }}>{s.paybackMonths === null ? '회수 못 함' : formatMonths(s.paybackMonths)}</td>
                    <td>{s.valueAtPayback === null ? '-' : `${Math.round((s.valueAtPayback / invest) * 100)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {weeklyStocks.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 700, color: ink, marginBottom: 4 }}>주배당 종목 살펴보기</div>
          <p style={{ fontSize: 12.5, color: soft, margin: '0 0 10px' }}>최근 분배금은 종목 페이지에 안내된 운용사 공지에서 확인해 입력하세요</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {weeklyStocks.map((s) => (
              <a key={s.ticker} href={`/stocks/${s.ticker}`} onClick={(e) => { e.preventDefault(); onNavigate('stocks', s.ticker); }}
                style={{ textDecoration: 'none', fontSize: 13, fontWeight: 600, color: 'var(--pb-cover)', border: '1px solid var(--pb-line-strong)', borderRadius: 999, padding: '5px 11px' }}>
                {s.ticker}
              </a>
            ))}
          </div>
        </div>
      )}

      <div style={{ ...card, fontSize: 13, color: soft, lineHeight: 1.7 }}>
        <div style={{ fontWeight: 700, color: ink, marginBottom: 6 }}>이렇게 계산해요</div>
        <p style={{ margin: '0 0 6px' }}>· 분배율(주가 대비 분배금)은 처음과 같다고 봐요. 주가가 내려가면 분배금도 같은 비율로 줄어요. 주배당 ETF는 대개 순자산에 비례해 분배하기 때문이에요.</p>
        <p style={{ margin: '0 0 6px' }}>· 받은 분배금은 재투자하지 않고 모은다고 가정해요. 주가는 매년 입력한 비율로 고르게 변한다고 봐요.</p>
        <p style={{ margin: '0 0 6px' }}>· 실제 분배금은 매주·매달 크게 달라질 수 있고, 분배금 중 일부는 원금을 돌려주는 것(자본환급)일 수 있어요. 결과는 참고용 시나리오이며 투자 권유가 아니에요.</p>
        <p style={{ margin: 0 }}>
          더 알아보기:{' '}
          {[
            ['covered-call-etf-nav-erosion', '분배금이 원금을 갉아먹는다는 말'],
            ['yieldmax-etf-explained', '야일드맥스 ETF의 원리와 위험'],
            ['distribution-rate-vs-dividend-yield', '분배율과 배당수익률'],
          ].map(([id, t], i) => (
            <React.Fragment key={id}>
              {i > 0 && ' · '}
              <a href={`/guide/${id}`} onClick={(e) => { e.preventDefault(); onNavigate('guide', id); }} style={{ color: 'var(--pb-cover)' }}>{t}</a>
            </React.Fragment>
          ))}
        </p>
      </div>
    </section>
  );
}
