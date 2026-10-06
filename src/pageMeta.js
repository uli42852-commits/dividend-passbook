// 페이지별 제목·설명 — React 앱(src/App.jsx)과 프리렌더 스크립트(scripts/prerender.mjs)가 함께 써요.
// 순수 JS만 두어야 Node에서 그대로 import할 수 있어요.

export const SITE = 'https://www.dividendpassbook.com';
export const SITE_NAME = '배당 통장';

export const HOME_META = {
  title: '배당 통장 — 배당주 포트폴리오 계산기 · 월배당 계산',
  description: '보유한 국내·미국 배당주를 기입하면 연간 배당금, 월별 배당 흐름, 세후 실수령액까지 계산해주는 무료 배당 계산기. SCHD, 리얼티인컴, 코카콜라 등 배당주 가이드 포함.',
};

export const TAB_META = {
  calc: {
    label: '계산기',
    title: '배당금 계산기 — 보유 종목별 연간·월별 배당, 세후 금액 | 배당 통장',
    description: '보유 수량과 주당 배당금을 넣으면 연간·월평균 배당금, 월별 지급 흐름, 세후 실수령액(국내 15.4%, 미국 15%)을 바로 계산해요. 회원가입 없이 무료.',
  },
  payback: {
    label: '원금회수',
    title: '원금회수 계산기 — 주배당·커버드콜 ETF 분배금으로 원금 회수 기간 계산 | 배당 통장',
    description: '투자금, 매입가, 1회 분배금, 지급 주기를 넣으면 분배금만으로 원금을 되찾는 데 걸리는 기간과 그때 남은 주식 가치를 주가 시나리오별로 계산해요. 주배당 ETF용.',
  },
  calendar: {
    label: '달력',
    title: '배당 달력 — 내 보유 종목의 월별 배당 지급 일정 | 배당 통장',
    description: '계산기에 기입한 보유 종목이 몇 월에 배당을 주는지 달력으로 확인하세요. 배당이 비는 달을 찾아 월배당 포트폴리오를 채울 수 있어요.',
  },
  find: {
    label: '유형 찾기',
    title: '나에게 맞는 배당 투자 유형 찾기 — 월배당·배당성장·고배당·배당킹 | 배당 통장',
    description: '질문 3개로 월배당 안정형, 배당성장형, 고배당 현금흐름형, 배당킹 안정형 중 나에게 맞는 배당 투자 유형과 주의할 점을 알려드려요.',
  },
  stocks: {
    label: '종목분석',
    title: '배당주 종목분석 — 국내·미국 배당주, 배당 ETF, 리츠 배당 정책 정리 | 배당 통장',
    description: '국내·미국 배당주와 배당 ETF, 리츠, 폐쇄형펀드의 배당 정책, 지급 주기, 과거 배당 이력, 투자 전 주의할 점을 종목별로 정리했어요.',
  },
  guide: {
    label: '공부방',
    title: '배당 투자 공부방 — 배당세, 배당락일, 월배당 포트폴리오 가이드 | 배당 통장',
    description: '배당소득세, 배당락일, 월배당 포트폴리오 구성, 커버드콜 ETF, 배당컷 신호까지 배당 투자에 필요한 내용을 쉽게 정리한 가이드 모음이에요.',
  },
};

export const TAB_ORDER = ['calc', 'payback', 'calendar', 'find', 'stocks', 'guide'];

export function stockMeta(s) {
  return {
    title: `${s.name}(${s.ticker}) 배당 정보 — ${s.typeTag} | ${SITE_NAME}`,
    description: s.basic,
    path: `/stocks/${s.ticker}`,
  };
}

export function articleMeta(a) {
  return {
    title: `${a.t} | ${SITE_NAME} 공부방`,
    description: a.p[0].slice(0, 150),
    path: `/guide/${a.id}`,
  };
}
