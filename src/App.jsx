import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Trash2, Pencil, X, BookOpen, Shield, Copy, Check, Sparkles,
} from 'lucide-react';

/* ── design tokens ─────────────────────────────────────────── */
const C = {
  cover: '#1f3d2e',        // 통장 표지 딥그린
  coverEdge: '#162d22',
  foil: '#d9b36a',         // 금박
  paper: '#f7f3e8',        // 내지
  paperLine: 'rgba(31,61,46,0.10)',
  ink: '#22312a',
  inkSoft: '#5b6a61',
  stamp: '#c03a2b',        // 도장 레드
  brass: '#b8863c',
  cardBg: '#fdfaf1',
  line: 'rgba(34,49,42,0.12)',
  lineStrong: 'rgba(34,49,42,0.24)',
};

const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
const STORAGE_KEY = 'dividend-passbook-v1';
const THIS_MONTH = new Date().getMonth() + 1;

const TAX = { KRW: 0.154, USD: 0.15 }; // 원천징수 간이율

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
      transform: 'rotate(-6deg)', flexShrink: 0, background: 'rgba(192,58,43,0.04)',
      boxShadow: 'inset 0 0 0 1px rgba(192,58,43,0.35)',
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

/* ── main app ─────────────────────────────────────────────── */

export default function App() {
  const [holdings, setHoldings] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [afterTax, setAfterTax] = useState(false);
  const [copied, setCopied] = useState(false);
  const idRef = useRef(1);
  const formRef = useRef(null);

  useEffect(() => {
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

  const applyTax = (v, cur) => (afterTax ? v * (1 - TAX[cur]) : v);

  /* form handlers */
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

  /* per-currency stats */
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

  const copySummary = async () => {
    const lines = stats.map((s) =>
      `[${s.cur}] 연 ${fmt(applyTax(s.annual, s.cur), s.cur)} · 월평균 ${fmt(applyTax(s.annual / 12, s.cur), s.cur)}${afterTax ? ' (세후)' : ' (세전)'}`
    );
    try {
      await navigator.clipboard.writeText(`내 배당 통장\n${lines.join('\n')}\n종목 ${holdings.length}개`);
      setCopied(true); setTimeout(() => setCopied(false), 1800);
    } catch (e) { /* clipboard unavailable */ }
  };

  const input = { width: '100%', background: '#fffef9', borderRadius: 7, padding: '10px 11px', fontSize: 14, color: C.ink, border: `1px solid ${C.lineStrong}`, boxSizing: 'border-box', fontFamily: "'Noto Sans KR', sans-serif" };
  const label = { display: 'block', fontSize: 11, color: C.inkSoft, marginBottom: 5, fontWeight: 600 };

  return (
    <div style={{ minHeight: '100vh', width: '100%', background: '#ece6d6', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '26px 14px 44px', boxSizing: 'border-box', fontFamily: "'Noto Sans KR', -apple-system, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@600;700;900&family=Noto+Sans+KR:wght@400;500;700&family=IBM+Plex+Mono:wght@500;600;700&display=swap');
        * { -webkit-tap-highlight-color: transparent; }
        input::placeholder { color: rgba(34,49,42,0.35); }
        input:focus { outline: none; border-color: ${C.cover}; }
        button { font-family: inherit; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
      `}</style>

      <div style={{ width: '100%', maxWidth: 470 }}>

        {/* ── passbook cover ── */}
        <div style={{
          background: `linear-gradient(160deg, ${C.cover} 0%, #17301f 100%)`,
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
            </div>
            <div aria-hidden style={{
              width: 46, height: 46, borderRadius: '50%', border: `1.5px solid ${C.foil}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: C.foil, fontFamily: "'Noto Serif KR', serif", fontWeight: 900, fontSize: 20, opacity: 0.85, flexShrink: 0,
            }}>
              配
            </div>
          </div>
        </div>

        {/* ── paper body ── */}
        <div style={{ background: C.paper, borderRadius: '0 0 14px 14px', border: `1px solid ${C.line}`, borderTop: 'none', padding: '20px 16px 24px', boxSizing: 'border-box' }}>

          {/* 광고 */}
          <div style={{ border: `1px dashed ${C.lineStrong}`, borderRadius: 8, padding: '9px 14px', textAlign: 'center', fontSize: 10.5, color: C.inkSoft, opacity: 0.6, marginBottom: 18 }}>
            광고 영역 · AdSense 승인 후 스크립트 삽입
          </div>

          {holdings.length === 0 ? (
            /* ── empty state ── */
            <Ruled style={{ padding: '34px 20px', textAlign: 'center', marginBottom: 18 }}>
              <p style={{ margin: '0 0 6px', fontFamily: "'Noto Serif KR', serif", fontWeight: 700, fontSize: 17, color: C.ink }}>
                첫 페이지가 비어 있어요
              </p>
              <p style={{ margin: '0 0 16px', fontSize: 12.5, color: C.inkSoft, lineHeight: 1.6 }}>
                아래에서 보유 종목을 기입하면<br />이 자리에 배당 내역이 인쇄됩니다
              </p>
              <button onClick={loadSample} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8,
                border: `1px solid ${C.cover}`, background: 'transparent', color: C.cover,
                fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              }}>
                <Sparkles size={13} /> 샘플로 미리 체험하기
              </button>
            </Ruled>
          ) : (
            <>
              {/* ── 세전/세후 + 공유 ── */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
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
                <button onClick={copySummary} style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 8,
                  border: `1px solid ${C.lineStrong}`, background: 'transparent',
                  fontSize: 11.5, fontWeight: 600, color: copied ? C.cover : C.inkSoft, cursor: 'pointer',
                }}>
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? '복사됨' : '요약 복사'}
                </button>
              </div>
              {afterTax && (
                <p style={{ margin: '0 0 14px', fontSize: 10.5, color: C.inkSoft, opacity: 0.8 }}>
                  세후: 원화 15.4% · 달러 15% 원천징수 간이 적용 (참고용)
                </p>
              )}

              {/* ── per-currency ledger blocks ── */}
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

              {/* ── holdings ledger ── */}
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

          {/* ── entry form ── */}
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
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="예: 코카콜라" style={input} />
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

          {/* ── info folds ── */}
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

/* summary row inside stamp card */
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
