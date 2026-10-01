// 공부방 가이드 글 카테고리 — React 앱(공부방 필터)과 프리렌더(/guide 목록 페이지)가 함께 써요.
// 새 글을 data.js에 추가하면 여기에도 id를 한 줄 넣어주세요. 빠진 글은 '기초 개념'으로 보여요.

export const GUIDE_CATEGORIES = [
  { v: 'basics', t: '기초 개념' },
  { v: 'tax', t: '세금·계좌' },
  { v: 'strategy', t: '포트폴리오 전략' },
  { v: 'funds', t: 'ETF·리츠·펀드' },
  { v: 'stocks', t: '종목·업종 분석' },
  { v: 'risk', t: '배당컷·위험 신호' },
  { v: 'market', t: '환율·제도' },
];

const IDS = {
  basics: [
    'ex-dividend-date', 'dividend-reinvestment-drip', 'dividend-aristocrats-kings', 'dividend-investing-beginner',
    'payout-ratio', 'dividend-buy-timing', 'dividend-payment-date', 'small-amount-dividend-start',
    'dividend-investing-mistakes', 'dividend-calendar-guide', 'preferred-stock-dividend', 'dividend-cagr-calculation',
    'dividend-yield-calculation', 'dividend-sell-timing', 'dividend-investing-glossary', 'dividend-vs-growth-stock-lifecycle',
    'preferred-stock-explained', 'distribution-rate-vs-dividend-yield', 'dividend-amount-by-share-count',
    'monthly-dividend-check-feature', 'finding-related-stocks-guide', 'special-dividend-explained', 'spinoff-company-dividend',
  ],
  tax: [
    'us-dividend-tax', 'korea-dividend-tax', 'isa-account-dividend-tax', 'pension-account-dividend',
    'dividend-income-tax-guide', 'dividend-tax-filing', 'dividend-tax-refund', 'reit-tax-guide',
    'dividend-account-types-comparison', 'section-1256-contracts-tax', 'dividend-separate-taxation-2026',
    'after-tax-dividend-calculation',
  ],
  strategy: [
    'monthly-dividend-portfolio', 'dividend-growth-vs-high-yield', 'dividend-income-living', 'quarterly-vs-monthly-dividend',
    'dividend-portfolio-stock-count', 'dividend-etf-vs-individual-stock', 'retirement-dividend-portfolio',
    'monthly-dividend-portfolio-practical-example', 'monthly-dividend-goal-setting', 'korea-vs-us-dividend-stocks',
    'schd-drip-simulation-20-years', 'monthly-dividend-3million-required-capital', 'dividend-investing-vs-4-percent-rule',
  ],
  funds: [
    'schd-dividend', 'monthly-dividend-etf-covered-call', 'high-dividend-etf-checklist', 'korea-listed-us-dividend-etf-vs-direct',
    'reit-investing-basics', 'dividend-etf-aum', 'covered-call-etf-nav-erosion', 'yieldmax-etf-explained',
    'monthly-vs-weekly-dividend-etf', 'covered-call-option-premium-basics', '0dte-options-explained',
    'closed-end-fund-cef-explained', 'cef-premium-discount', 'convertible-bond-explained', 'clo-collateralized-loan-obligation',
    'leveraged-fund-explained', 'fund-of-funds-explained', 'managed-distribution-policy', 'yieldmax-group1-group2-schedule',
    'schd-vs-jepi', 'schd-vs-vym', 'monthly-dividend-reit-bdc-risk-tiers',
  ],
  stocks: [
    'realty-income-o', 'coca-cola-ko-dividend', 'healthcare-dividend-stocks', 'restaurant-dividend-stocks-overview',
    'ultra-low-dividend-yield-stocks', 'gold-mining-variable-dividend-stocks', 'apple-aapl-dividend', 'microsoft-msft-dividend',
    'regional-bank-dividend-stocks', 'gold-streaming-royalty-companies', 'defense-government-services-dividend-stocks',
    'johnson-johnson-jnj-dividend', 'altria-mo-dividend', 'philip-morris-pm-dividend', '3m-mmm-dividend',
    'procter-gamble-pg-dividend', 'verizon-vz-dividend', 'att-t-dividend', 'chevron-cvx-dividend', 'exxonmobil-xom-dividend',
    'broadcom-avgo-dividend', 'pepsico-pep-dividend', 'mcdonalds-mcd-dividend', 'home-depot-hd-dividend',
    'starbucks-sbux-dividend', 'texas-instruments-txn-dividend', 'pfizer-pfe-dividend', 'walmart-wmt-dividend',
    'costco-cost-special-dividend-history', 'abbvie-abbv-dividend', 'utility-dividend-stocks-overview',
    'coca-cola-vs-pepsico-dividend', 'visa-yield-on-cost-explained', 'visa-vs-mastercard-dividend', 'ibm-dividend',
    'merck-mrk-dividend', 'chevron-vs-exxonmobil-dividend', 'cisco-csco-dividend', 'bristol-myers-squibb-bmy-dividend',
    'telecom-dividend-stocks-overview', 'jpmorgan-bofa-wellsfargo-dividend-overview', 'nike-nke-dividend',
    'home-depot-vs-lowes-dividend',
  ],
  risk: [
    'dividend-yield-trap', 'dividend-cut-warning-signs', 'dividend-cut-meaning-cases', 'dividend-cut-real-cases-compilation',
    'intel-intc-dividend-suspension-case', 'general-electric-ge-dividend-cut-recovery',
    'disney-dis-dividend-suspension-resumption',
  ],
  market: [
    'exchange-rate-us-dividend', 'korean-investors-us-dividend-stocks', 'value-up-program-dividend', 'us-stock-account-open-guide',
    'usd-exchange-tips', 'dividend-record-date-change-korea', 'value-up-program-korea', 'holding-company-dividend-structure',
    'first-time-dividend-companies', 'canadian-dividend-stocks-investing',
  ],
};

const CATEGORY_OF = new Map();
for (const [cat, ids] of Object.entries(IDS)) for (const id of ids) CATEGORY_OF.set(id, cat);

export function guideCategoryOf(articleId) {
  return CATEGORY_OF.get(articleId) || 'basics';
}

export function guideCategoryLabel(v) {
  return GUIDE_CATEGORIES.find((c) => c.v === v)?.t || '';
}
