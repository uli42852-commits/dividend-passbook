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

/* ── dividend guide articles (SEO content) ─────────────────── */
const ARTICLES = [
  {
    t: '월배당 포트폴리오 만드는 법 — 매달 배당 받는 지급월 조합',
    p: [
      '월급처럼 매달 배당을 받으려면 종목의 배당 지급월을 조합하면 됩니다. 미국 분기배당 주식은 보통 세 그룹으로 나뉩니다. 1·4·7·10월 지급 그룹, 2·5·8·11월 지급 그룹, 3·6·9·12월 지급 그룹입니다. 각 그룹에서 한 종목씩만 담아도 1년 열두 달 매달 배당이 들어오는 구조가 완성됩니다.',
      '예를 들어 3·6·9·12월에 지급하는 배당 ETF 하나, 1·4·7·10월에 지급하는 배당주 하나, 2·5·8·11월에 지급하는 배당주 하나를 조합하는 식입니다. 여기에 매달 배당을 주는 월배당 리츠를 더하면 월별 편차가 더 완만해집니다.',
      '이 계산기 위쪽에서 종목마다 지급월을 선택해 기입하면 월별 배당 흐름 차트로 비는 달이 한눈에 보입니다. 비는 달을 채우는 방향으로 종목을 추가하는 것이 월배당 포트폴리오의 기본 전략입니다.',
    ],
  },
  {
    t: 'SCHD 배당 정리 — 지급월, 배당성장, 왜 인기가 많을까',
    p: [
      'SCHD(슈왑 미국 배당주 ETF)는 한국 투자자에게 가장 인기 있는 배당 ETF 중 하나입니다. 배당 지급월은 3월·6월·9월·12월 분기 지급이며, 10년 이상 배당을 꾸준히 늘려온 우량 기업들을 골라 담는 것이 특징입니다.',
      'SCHD의 매력은 현재 배당수익률 자체보다 배당성장에 있습니다. 담고 있는 기업들이 해마다 배당을 늘리는 경향이 있어, 오래 보유할수록 내 매입가 대비 수익률이 점점 올라가는 구조를 기대하는 투자자가 많습니다.',
      '국내 증시에도 SCHD를 추종하는 상장 ETF들이 있어 연금계좌에서 세제 혜택을 받으며 투자하는 방법도 있습니다. 배당금과 수익률은 시기에 따라 달라지므로 매수 전 최신 공시를 확인하세요.',
    ],
  },
  {
    t: '리얼티인컴(O) — 월배당의 대표주자',
    p: [
      '리얼티인컴은 "The Monthly Dividend Company"라는 별명이 상표일 정도로 월배당으로 유명한 미국 리츠(부동산 투자회사)입니다. 매달 배당을 지급하며, 수십 년간 배당을 늘려온 배당 귀족 종목이기도 합니다.',
      '리츠는 법적으로 이익 대부분을 배당으로 지급해야 하는 구조라 배당수익률이 일반 주식보다 높은 편입니다. 다만 금리가 오르는 시기에는 리츠 주가가 압박을 받는 경향이 있어 주가 변동은 감수해야 합니다.',
      '매달 현금 흐름이 생기는 것을 눈으로 확인하고 싶은 배당 투자 입문자가 첫 종목으로 많이 선택합니다. 이 계산기에 지급월을 1월부터 12월까지 모두 선택해 기입하면 월배당 효과를 바로 확인할 수 있습니다.',
    ],
  },
  {
    t: '코카콜라(KO) 배당 — 60년 넘게 배당을 늘려온 배당킹',
    p: [
      '코카콜라는 60년 이상 연속으로 배당을 늘려온 대표적인 배당킹 종목입니다. 워런 버핏이 수십 년째 보유 중인 것으로도 유명합니다. 배당 지급월은 보통 4월·7월·10월·12월입니다.',
      '배당킹(50년 이상 연속 증배)이나 배당귀족(25년 이상)은 불황에도 배당을 깎지 않고 버텨온 이력이 있어 배당 안정성을 중시하는 투자자에게 선호됩니다. 다만 성숙한 기업이라 주가 성장은 완만한 편입니다.',
      '이런 종목은 "배당이 끊길 걱정을 덜고 오래 들고 가는 용도"로 접근하는 경우가 많습니다. 배당 안정성과 주가 성장성 사이의 균형은 본인의 투자 목적에 맞게 정하면 됩니다.',
    ],
  },
  {
    t: '배당락일이란? 배당 받으려면 언제까지 사야 할까',
    p: [
      '배당을 받으려면 배당기준일에 주주명부에 올라 있어야 하고, 그러려면 배당락일 전날까지 주식을 매수해야 합니다. 배당락일 당일에 사면 그 회차 배당은 받지 못합니다.',
      '미국 주식은 매수 후 결제까지 하루가 걸리는 T+1 결제라서, 배당락일 전 영업일까지 매수하면 배당을 받을 수 있습니다. 국내 주식은 T+2 결제라 기준일 2영업일 전까지 매수해야 합니다.',
      '주의할 점은 배당락일에 주가가 배당금만큼 내려가는 경향이 있다는 것입니다. 배당만 받고 바로 팔아 차익을 내는 전략이 잘 통하지 않는 이유입니다. 배당 투자는 단기 이벤트보다 꾸준한 보유로 접근하는 것이 일반적입니다.',
    ],
  },
  {
    t: '미국 배당주 세금 정리 — 15% 원천징수와 종합과세',
    p: [
      '미국 주식 배당금은 미국에서 15%가 원천징수된 후 계좌에 입금됩니다. 예를 들어 배당금이 100달러라면 85달러가 들어옵니다. 한국에서 추가로 떼지는 않지만, 신고 대상에는 포함됩니다.',
      '이자와 배당을 합친 금융소득이 연 2,000만원을 넘으면 금융소득종합과세 대상이 되어 다른 소득과 합산해 누진세율로 과세될 수 있습니다. 배당 규모가 커지면 세무 전문가와 상담하는 것이 안전합니다.',
      '참고로 매매 차익에는 배당과 별도로 연 250만원 공제 후 22% 양도소득세가 적용됩니다. 이 계산기의 세후 토글은 배당 원천징수 간이율만 반영한 참고치입니다.',
    ],
  },
  {
    t: '국내 배당주 세금 — 15.4% 원천징수 이해하기',
    p: [
      '국내 주식 배당금은 배당소득세 14%에 지방소득세 1.4%를 더한 15.4%가 원천징수됩니다. 증권사가 알아서 떼고 입금하므로 소액 투자자는 따로 신고할 일이 거의 없습니다.',
      '미국 주식과 마찬가지로 금융소득 연 2,000만원 초과 시 종합과세 대상이 됩니다. 배당 규모가 큰 투자자들이 연금계좌(연금저축·IRP)를 활용하는 이유 중 하나입니다. 연금계좌 안에서는 배당에 대한 과세가 이연되고 낮은 세율이 적용될 수 있습니다.',
      '이 계산기에서 세후 토글을 켜면 원화 종목에 15.4%를 적용한 대략적인 실수령액을 확인할 수 있습니다.',
    ],
  },
  {
    t: '배당수익률의 함정 — 높다고 좋은 게 아닌 이유',
    p: [
      '배당수익률은 주당 배당금을 주가로 나눈 값입니다. 그런데 수익률이 유난히 높은 종목은 배당이 많아서가 아니라 주가가 급락해서 수치가 부풀려진 경우가 많습니다. 이를 배당 함정(dividend trap)이라고 부릅니다.',
      '실적이 나빠져 주가가 반토막 나면 배당수익률은 두 배로 보입니다. 하지만 그런 기업은 곧 배당 자체를 삭감할 가능성이 높아, 높은 수익률만 보고 들어가면 배당도 깎이고 주가도 떨어지는 이중 손실을 볼 수 있습니다.',
      '수익률 숫자보다 배당성향(이익 대비 배당 비율)이 무리하지 않은지, 배당을 몇 년째 유지·증액해왔는지를 함께 보는 것이 안전합니다.',
    ],
  },
  {
    t: '배당성장주 vs 고배당주 — 뭐가 나에게 맞을까',
    p: [
      '고배당주는 지금 당장 수익률이 높은 종목(리츠, 통신, 에너지 등)이고, 배당성장주는 현재 수익률은 낮아도 해마다 배당을 늘려가는 종목입니다. 둘은 성격이 다릅니다.',
      '당장 현금 흐름이 필요하다면 고배당 위주가 맞고, 10년 이상 장기 투자라면 배당성장주가 유리한 경우가 많습니다. 배당이 매년 늘면 내 매입가 기준 수익률이 계속 올라가고, 배당을 늘릴 여력이 있는 기업은 주가도 함께 성장하는 경향이 있기 때문입니다.',
      '실전에서는 둘을 섞는 경우가 많습니다. 기반은 배당성장 ETF로 깔고, 월배당 리츠나 고배당주를 일부 더해 현금 흐름을 보강하는 식입니다.',
    ],
  },
  {
    t: '월배당 ETF와 커버드콜 — JEPI류 투자 전 알아둘 것',
    p: [
      '최근 몇 년 사이 월배당을 주는 커버드콜 ETF가 크게 인기를 얻었습니다. 콜옵션을 팔아 얻은 프리미엄을 분배금으로 나눠주는 구조라 분배율이 높고 매달 지급됩니다.',
      '다만 구조상 상승장에서 주가 상승분을 일부 포기하는 대신 분배금을 받는 것이라, 시장이 크게 오를 때는 일반 지수 ETF보다 총수익이 뒤처질 수 있습니다. 분배율이 높다고 총수익이 높은 것은 아니라는 점을 이해하고 접근해야 합니다.',
      '월 현금 흐름이 목적이라면 유용한 도구지만, 자산을 불리는 성장 구간에서는 일반 배당성장 ETF와 비중을 나눠 담는 것이 균형 잡힌 접근입니다.',
    ],
  },
  {
    t: 'ISA 계좌로 배당 투자하면 세금이 얼마나 줄까',
    p: [
      'ISA(개인종합자산관리계좌)는 배당 투자자에게 강력한 세제 혜택을 주는 계좌입니다. 일반 계좌에서는 배당에 15.4%가 원천징수되지만, ISA 안에서 발생한 배당·이자 소득은 순이익 기준 200만원(서민형은 400만원)까지 비과세됩니다.',
      '비과세 한도를 넘는 초과분에도 15.4% 대신 9.9% 분리과세가 적용돼 세율이 크게 낮아집니다. 3년 의무 보유 조건이 있지만, 배당은 원래 장기 투자가 기본이라 궁합이 좋습니다.',
      '다만 ISA에서는 미국 주식 직접 투자가 안 되고 국내 상장 ETF를 통해야 합니다. 국내에 상장된 미국 배당 ETF(예: 미국 배당다우존스 추종 ETF)를 ISA에 담으면 세제 혜택과 미국 배당 노출을 동시에 얻을 수 있습니다.',
    ],
  },
  {
    t: '배당 재투자(DRIP)란? 복리로 배당을 굴리는 법',
    p: [
      '배당 재투자는 받은 배당금으로 같은 주식을 다시 사서 보유 주식을 늘리는 전략입니다. 영어로 DRIP(Dividend Reinvestment Plan)이라고 부릅니다. 주식이 늘면 다음 배당이 늘고, 그 배당으로 또 사면 눈덩이처럼 불어나는 복리 효과가 생깁니다.',
      '예를 들어 배당수익률 4%짜리 종목을 배당 재투자하면서 20년 보유하면, 배당을 쓰지 않고 굴렸을 때와 아닐 때의 최종 자산 차이가 매우 커집니다. 시간이 길수록 복리의 위력이 세집니다.',
      '한국 증권사 중 일부는 자동 배당 재투자 서비스를 제공하고, 없더라도 배당이 들어올 때마다 수동으로 재매수하면 됩니다. 당장 현금이 필요 없는 젊은 투자자일수록 배당 재투자가 유리합니다.',
    ],
  },
  {
    t: '미국 배당귀족·배당킹이란? 대표 종목 정리',
    p: [
      '배당귀족(Dividend Aristocrats)은 S&P500 기업 중 25년 이상 연속으로 배당을 늘려온 기업을 말합니다. 배당킹(Dividend Kings)은 그보다 더 엄격해서 50년 이상 연속 증배한 기업입니다. 불황과 위기를 여러 번 겪으면서도 배당을 깎지 않고 늘려왔다는 뜻이라 안정성의 상징으로 여겨집니다.',
      '대표적인 배당킹으로는 코카콜라, 존슨앤드존슨, P&G, 3M 등이 있습니다. 이들은 성장성은 완만해도 배당 안정성이 뛰어나 은퇴 자금이나 장기 배당 포트폴리오의 뼈대로 많이 쓰입니다.',
      '개별 종목을 고르기 부담스럽다면 배당귀족 지수를 추종하는 ETF에 투자하는 방법도 있습니다. 여러 배당귀족에 한 번에 분산 투자하는 효과를 얻을 수 있습니다.',
    ],
  },
  {
    t: '배당금으로 생활비 만들기 — 얼마를 모아야 할까',
    p: [
      '"배당금만으로 생활한다"는 목표를 세운다면, 필요한 원금은 목표 월 생활비와 배당수익률로 계산할 수 있습니다. 예를 들어 월 200만원(연 2,400만원)을 세전 배당으로 받고 싶고 포트폴리오 배당수익률이 4%라면, 필요한 원금은 6억원입니다. 세후 기준으로는 더 필요합니다.',
      '수익률을 5~6%로 높이면 필요 원금은 줄지만, 그런 고배당 종목은 배당 삭감 위험이나 주가 하락 위험이 큰 경우가 많아 안정성이 떨어집니다. 무리한 고수익률 추종보다 4% 안팎의 견고한 포트폴리오가 현실적입니다.',
      '한 번에 큰 원금을 만들기 어렵다면, 매달 적립하면서 배당을 재투자해 보유 주식을 꾸준히 늘려가는 것이 정석입니다. 이 계산기로 목표 월 배당에 도달하려면 지금 어떤 종목을 얼마나 담아야 하는지 시뮬레이션해 볼 수 있습니다.',
    ],
  },
  {
    t: '배당주 초보 — 무엇부터 사야 할까',
    p: [
      '배당 투자를 처음 시작한다면 개별 종목보다 배당 ETF로 시작하는 것이 안전합니다. ETF 하나가 수십~수백 개 기업에 분산 투자하는 효과가 있어, 한 기업이 배당을 삭감해도 전체에 미치는 영향이 작습니다.',
      '국내 상장 미국 배당 ETF나 배당성장 ETF를 연금·ISA 계좌에서 매달 적립식으로 사는 것이 무난한 출발점입니다. 어느 정도 감을 잡은 뒤 코카콜라, 리얼티인컴 같은 개별 배당주를 조금씩 더해가는 순서를 추천합니다.',
      '초보가 흔히 하는 실수는 배당수익률이 유난히 높은 종목에 끌리는 것입니다. 수익률 8~10%짜리는 대부분 그럴 만한 위험이 숨어 있습니다. 처음에는 수익률보다 배당을 오래 유지·증액해온 안정적인 종목에 집중하는 것이 좋습니다.',
    ],
  },
  {
    t: '고배당 ETF 고를 때 봐야 할 3가지',
    p: [
      '고배당 ETF를 고를 때는 분배율만 보면 안 됩니다. 첫째로 총보수(운용수수료)를 확인하세요. 수수료가 높으면 배당으로 번 것을 갉아먹습니다. 둘째로 분배금의 재원이 진짜 배당인지, 아니면 원금을 헐어 나눠주는 것인지 봐야 합니다.',
      '셋째로 담고 있는 종목 구성을 확인하세요. 특정 업종(리츠, 에너지 등)에 쏠려 있으면 그 업종이 부진할 때 타격이 큽니다. 여러 업종에 고루 분산된 ETF가 안정적입니다.',
      '분배율이 높다고 무조건 좋은 것이 아니라, 그 분배가 지속 가능한지가 핵심입니다. 과거 분배금 추이가 꾸준했는지, 급등락이 심하지 않았는지 살펴보는 것이 도움이 됩니다.',
    ],
  },
  {
    t: '연금저축·IRP로 배당 투자하면 좋은 이유',
    p: [
      '연금저축과 IRP(개인형 퇴직연금)는 배당 투자와 궁합이 아주 좋은 계좌입니다. 우선 납입액에 대해 연말정산 세액공제를 받아 세금을 돌려받을 수 있고, 계좌 안에서 발생한 배당에 대한 과세가 인출 시점까지 미뤄집니다.',
      '일반 계좌에서 배당에 15.4%가 바로 빠지는 것과 달리, 연금계좌 안에서는 배당을 그대로 재투자해 복리로 굴릴 수 있습니다. 나중에 연금으로 받을 때 낮은 연금소득세(3.3~5.5%)가 적용돼 세금 부담도 줄어듭니다.',
      '다만 연금계좌에서는 미국 주식 직접 투자가 안 되고 국내 상장 ETF로 투자해야 하며, 만 55세 이후 연금 형태로 인출하는 것이 원칙입니다. 장기 배당 투자자에게는 이런 제약을 감수할 만한 세제 혜택이 있습니다.',
    ],
  },
  {
    t: '분기배당 vs 월배당 — 뭐가 더 유리할까',
    p: [
      '월배당은 매달 현금이 들어와 심리적 만족감이 크고 생활비로 쓰기 편합니다. 분기배당은 3개월에 한 번 지급되지만, 지급월이 다른 분기배당 종목을 조합하면 사실상 월배당과 같은 효과를 낼 수 있습니다.',
      '총수익 관점에서는 지급 주기 자체가 수익률을 좌우하지 않습니다. 중요한 것은 배당의 크기와 지속성이지, 나눠 받는 횟수가 아닙니다. 다만 배당을 바로 재투자한다면 월배당이 아주 약간 복리에 유리할 수 있습니다.',
      '결론적으로 현금 흐름이 자주 필요하면 월배당이나 지급월을 분산한 분기배당 조합이 좋고, 재투자 위주로 자산을 불리는 단계라면 지급 주기는 크게 신경 쓰지 않아도 됩니다.',
    ],
  },
  {
    t: '환율이 미국 배당에 미치는 영향',
    p: [
      '미국 주식 배당은 달러로 지급되기 때문에, 원화로 환산한 실제 수령액은 환율에 따라 달라집니다. 배당금이 같은 100달러라도 환율이 1,300원일 때와 1,400원일 때 원화 수령액이 1만원 차이가 납니다.',
      '원/달러 환율이 오르면(원화 약세) 같은 달러 배당의 원화 가치가 커지고, 환율이 내리면 줄어듭니다. 즉 미국 배당주는 배당 자체 외에 환율이라는 변수가 하나 더 있는 셈입니다.',
      '환율은 예측이 어렵기 때문에, 특정 시점의 환율에 베팅하기보다 장기간 적립하며 평균 환율에 사는 접근이 안전합니다. 이 계산기에서 달러 종목을 기입하면 달러 기준으로 배당을 보여주므로, 원화 환산은 그때그때 환율을 곱해 가늠하시면 됩니다.',
    ],
  },
  {
    t: '국내 상장 미국 배당 ETF vs 미국 직투 — 뭐가 유리할까',
    p: [
      'SCHD 같은 미국 배당 ETF에 투자하는 방법은 두 가지입니다. 미국 시장에서 직접 사는 방법(직투)과, 같은 지수를 추종하는 국내 상장 ETF를 사는 방법입니다. 세금과 계좌 활용에서 차이가 큽니다.',
      '국내 상장 ETF의 최대 장점은 연금저축·IRP·ISA 같은 세제 혜택 계좌에 담을 수 있다는 점입니다. 이 계좌 안에서는 배당(분배금) 과세가 이연되거나 낮은 세율이 적용돼 복리 효과가 커집니다. 반면 직투는 이런 계좌에 담을 수 없습니다.',
      '직투의 장점은 종목 선택의 폭이 넓고, 매매차익이 연 250만원까지 공제된 뒤 22% 분리과세로 끝난다는 점입니다. 금융소득종합과세를 걱정하는 고액 투자자에게 유리할 수 있습니다. 일반적으로 소액·장기 적립 투자자는 국내 상장 ETF를, 규모가 크고 종목을 직접 고르고 싶은 투자자는 직투를 선택하는 경우가 많습니다.',
    ],
  },
  {
    t: '배당 성향(Payout Ratio)이란? 몇 %가 적당할까',
    p: [
      '배당성향은 기업이 벌어들인 순이익 중 몇 퍼센트를 배당으로 나눠주는지를 나타내는 지표입니다. 순이익 100억 중 40억을 배당하면 배당성향은 40%입니다.',
      '배당성향이 지나치게 높으면(80~100% 이상) 이익 대부분을 배당으로 쓰고 있다는 뜻이라, 실적이 조금만 나빠져도 배당을 줄일 위험이 큽니다. 반대로 너무 낮으면 배당 여력이 있는데 안 주는 것일 수도 있습니다.',
      '일반적으로 30~60% 정도가 안정적이라고 봅니다. 다만 리츠(REITs)는 법적으로 이익 대부분을 배당해야 해서 배당성향이 90%를 넘는 것이 정상이므로, 업종 특성을 함께 봐야 합니다.',
    ],
  },
  {
    t: '배당주 매수 타이밍 — 배당락 전과 후, 언제가 좋을까',
    p: [
      '배당을 받으려고 배당락일 직전에 몰려서 사는 경우가 많습니다. 하지만 배당락일에는 배당금만큼 주가가 자연스럽게 하락하는 경향이 있어, 배당만 받고 바로 팔면 실익이 거의 없습니다. 세금까지 고려하면 오히려 손해일 수 있습니다.',
      '그래서 배당 투자는 "언제 사느냐"보다 "얼마나 오래 들고 가느냐"가 핵심입니다. 장기 보유할 종목이라면 배당락 전후 며칠 차이는 큰 의미가 없습니다.',
      '굳이 따지자면 배당락 직후 주가가 일시적으로 눌렸을 때 매수하는 것이 심리적으로 편할 수 있지만, 이 역시 확정적인 전략은 아닙니다. 적립식으로 꾸준히 사는 것이 타이밍 고민을 줄이는 가장 현실적인 방법입니다.',
    ],
  },
  {
    t: '배당 삭감 신호 — 이런 종목은 조심하세요',
    p: [
      '배당 투자에서 가장 큰 리스크는 주가 하락보다 배당 삭감입니다. 배당이 깎이면 현금 흐름도 줄고 주가도 함께 떨어지는 경우가 많습니다.',
      '위험 신호는 몇 가지가 있습니다. 첫째, 배당성향이 100%를 넘어 이익보다 배당을 더 주고 있는 경우. 둘째, 부채가 빠르게 늘고 있는데 배당을 유지하는 경우. 셋째, 본업 실적이 몇 분기 연속 악화되는 경우입니다.',
      '배당수익률이 업종 평균보다 유난히 높다면 시장이 이미 "이 배당은 지속되기 어렵다"고 보고 있다는 신호일 수 있습니다. 수익률이 높아서 좋은 게 아니라, 왜 높은지를 확인하는 습관이 중요합니다.',
    ],
  },
  {
    t: '배당금 입금일은 언제? 지급 절차 정리',
    p: [
      '배당은 여러 날짜를 거쳐 지급됩니다. 순서는 배당기준일(주주명부 확정) → 배당락일 → 배당발표일 → 실제 지급일입니다. 기준일에 주주로 등재돼 있어야 배당을 받을 수 있습니다.',
      '미국 주식은 배당락일로부터 보통 2~4주 뒤에 지급됩니다. 증권사 계좌에 달러로 입금되며, 미국에서 15%를 원천징수한 나머지가 들어옵니다.',
      '국내 주식은 결산 배당의 경우 기준일이 12월 말이어도 실제 입금은 이듬해 4월 전후인 경우가 많습니다. 배당을 확정하는 주주총회를 거쳐야 하기 때문입니다. 분기배당을 하는 기업은 이보다 주기가 짧습니다.',
    ],
  },
  {
    t: '소액으로 배당 투자 시작하기 — 월 10만원부터',
    p: [
      '배당 투자는 큰돈이 있어야 시작할 수 있다고 생각하기 쉽지만, 월 10만원부터도 충분히 시작할 수 있습니다. 요즘은 소수점 매수를 지원하는 증권사가 많아 비싼 미국 주식도 몇 천원 단위로 살 수 있습니다.',
      '소액 단계에서 중요한 것은 배당금 액수가 아니라 습관과 구조를 만드는 것입니다. 매달 정해진 날 자동으로 매수하고, 들어온 배당은 재투자하는 흐름을 몸에 익히는 시기입니다.',
      '월 10만원씩 배당 ETF에 넣으면 1년에 120만원, 배당수익률 4%면 첫해 배당은 연 몇 만원 수준입니다. 작아 보이지만 이 금액이 매년 늘어나고 재투자로 불어나는 것이 배당 투자의 본질입니다.',
    ],
  },
  {
    t: '리츠(REITs) 투자 기초 — 부동산으로 배당 받기',
    p: [
      '리츠는 여러 투자자의 돈을 모아 부동산에 투자하고, 임대수익 대부분을 배당으로 나눠주는 회사입니다. 직접 건물을 사지 않아도 소액으로 부동산 임대수익에 참여할 수 있다는 것이 매력입니다.',
      '법적으로 이익의 대부분(미국 기준 90% 이상)을 배당해야 하기 때문에 배당수익률이 일반 주식보다 높은 편입니다. 리얼티인컴 같은 월배당 리츠가 배당 투자자에게 인기 있는 이유입니다.',
      '다만 금리가 오르면 리츠는 이중으로 압박을 받습니다. 차입 비용이 늘고, 상대적으로 채권 매력이 커져 자금이 빠져나가기 때문입니다. 포트폴리오에서 리츠 비중을 지나치게 높이지 않는 것이 안전합니다.',
    ],
  },
  {
    t: '배당 포트폴리오 몇 종목이 적당할까',
    p: [
      '개별 배당주로 포트폴리오를 짤 때 종목 수는 보통 10~20개 정도를 적정선으로 봅니다. 너무 적으면 한 종목이 배당을 삭감했을 때 타격이 크고, 너무 많으면 관리가 어렵고 사실상 ETF와 비슷해집니다.',
      '중요한 것은 숫자보다 분산의 질입니다. 10종목을 담아도 전부 금융주면 분산 효과가 거의 없습니다. 업종, 국가, 배당 지급월을 고루 섞는 것이 핵심입니다.',
      '관리가 부담스럽다면 배당 ETF 2~3개로 뼈대를 만들고, 관심 있는 개별 종목을 3~5개 정도만 얹는 방식도 좋습니다. 이 계산기에 종목을 기입하면 월별 흐름과 통화별 비중을 한눈에 볼 수 있어 분산 상태를 점검하기 좋습니다.',
    ],
  },
  {
    t: '배당 투자 흔한 실수 5가지',
    p: [
      '첫째, 배당수익률만 보고 종목을 고르는 것입니다. 수익률이 높은 데는 대부분 이유가 있고, 그 이유가 좋은 경우는 드뭅니다. 둘째, 배당만 받고 바로 파는 단타입니다. 배당락으로 주가가 빠져 실익이 거의 없습니다.',
      '셋째, 세금을 고려하지 않는 것입니다. 세전 수익률만 계산하다가 실수령액에서 실망하는 경우가 많습니다. 넷째, 한 업종에 몰아 담는 것입니다. 고배당을 좇다 보면 리츠·금융·통신에 쏠리기 쉽습니다.',
      '다섯째, 배당을 생활비로 다 써버리는 것입니다. 자산을 불려야 하는 시기라면 배당 재투자가 훨씬 유리합니다. 이 다섯 가지만 피해도 배당 투자의 큰 실패는 대부분 막을 수 있습니다.',
    ],
  },
];

function Articles() {
  return (
    <section style={{ marginTop: 6, marginBottom: 14 }}>
      <h2 style={{ fontFamily: "'Noto Serif KR', serif", fontWeight: 700, fontSize: 17, color: C.ink, margin: '0 0 4px' }}>
        배당 공부방
      </h2>
      <p style={{ fontSize: 11.5, color: C.inkSoft, margin: '0 0 12px' }}>
        배당 투자 전에 알아두면 좋은 내용을 정리했어요
      </p>
      {ARTICLES.map((a, i) => (
        <details key={i} style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 10, marginBottom: 8, padding: '0 16px', overflow: 'hidden' }}>
          <summary style={{ padding: '13px 0', fontSize: 12.5, fontWeight: 700, color: C.ink, cursor: 'pointer' }}>
            {a.t}
          </summary>
          <div style={{ paddingBottom: 14 }}>
            {a.p.map((para, j) => (
              <p key={j} style={{ fontSize: 12, lineHeight: 1.8, color: C.inkSoft, margin: j === 0 ? '2px 0 9px' : '0 0 9px' }}>{para}</p>
            ))}
          </div>
        </details>
      ))}
      <p style={{ fontSize: 10.5, color: C.inkSoft, opacity: 0.7, margin: '10px 0 0', lineHeight: 1.6 }}>
        위 내용은 일반적인 정보 제공 목적이며 특정 종목 추천이 아닙니다. 배당금·수익률·세율은 변동될 수 있으니 투자 전 최신 공시를 확인하세요.
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
  const [tab, setTab] = useState('calc'); // 'calc' | 'guide'
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
          <div style={{ border: `1px dashed ${C.lineStrong}`, borderRadius: 8, padding: '9px 14px', textAlign: 'center', fontSize: 10.5, color: C.inkSoft, opacity: 0.6, marginBottom: 16 }}>
            광고 영역 · AdSense 승인 후 스크립트 삽입
          </div>

          {/* ── 탭바 ── */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 18, background: 'rgba(34,49,42,0.05)', padding: 4, borderRadius: 10 }}>
            {[{ v: 'calc', t: '계산기' }, { v: 'guide', t: '배당 공부방' }].map((o) => {
              const on = tab === o.v;
              return (
                <button key={o.v} onClick={() => { setTab(o.v); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{
                  flex: 1, padding: '9px 0', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  border: 'none', background: on ? C.cover : 'transparent', color: on ? C.foil : C.inkSoft,
                }}>
                  {o.t}
                </button>
              );
            })}
          </div>

          {tab === 'calc' && (
          <>
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
          </>
          )}

          {/* ── guide articles (공부방 탭) ── */}
          {tab === 'guide' && <Articles />}

          {/* ── info folds (항상 표시) ── */}
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
