// 종목별 배당 지급월 — 달력 탭의 "이 달 배당 지급 종목"과 종목분석 필터에서 써요.
// 확실한 정보만 담아요: 월배당·주배당 종목은 매달, 정기 지급월이 확인된 종목은 그 달.
// 지급월을 모르는 분기·반기 종목은 null로 두고 달력에 넣지 않아요(틀린 달에 표시되는 것보다 나음).
// 배당 기준일(예: 3·6·9·12월 말 기준)과 실제 지급월은 다를 수 있으니, 지급월로 확인된 것만 추가하세요.

// 월배당 지급 종목 티커 (종목분석 탭의 "월배당" 필터 칩에서 사용)
export const MONTHLY_TICKERS = new Set([
  'O', 'JEPI', '458730', '458760', '429000', '329200', '472150', '402970',
  '489250', '446720', '452360', '441640', 'ADC', 'STAG',
  'AGNC', 'MAIN', 'EPR', 'PSEC', 'GLAD', 'GAIN', 'LAND', 'GOOD', 'LTC',
  'APLE', 'ORC', 'DX', 'HRZN', 'PFLT', 'EFC', 'ARR', 'PVL',
  'JEPQ', 'QYLD', 'XYLD', 'DIVO', 'PDI', 'RYLD',
  'SPHD', 'PFF', 'SPYI', 'QQQI', 'GPIQ',
  'PFFA', 'UTG', 'PTY', 'CLM', 'GOF',
  'CRF', 'ECC', 'OXLC', 'EIC', 'PDO',
  'DOC', 'UDR', 'CSWC', 'TRIN', 'GRP.U',
  'BST', 'RQI', 'FFC', 'PDT',
  'PFD', 'PFO', 'FLC', 'DFP',
  'NCV', 'NCZ', 'JQC', 'EVV', 'EFT',
  'SLG', 'GWRS', 'PECO', 'PNNT',
  'PEY', 'KBWD', 'DIV', 'SRET', 'TLTW', 'SVOL',
]);

// 주배당(매주) 지급 종목 티커 (종목분석 탭의 "주배당" 필터 칩에서 사용)
export const WEEKLY_TICKERS = new Set(['MSTY', 'PLTY', 'TSLY', 'NVDY', 'CONY', 'YMAX', 'YMAG', 'ULTY', 'AMZY', 'AMDY', 'APLY', 'GOOY', 'CVNY', 'NFLY', 'MSFO', 'SNOY', 'GMEY', 'HOOY', 'RBLY', 'BABO', 'PYPY', 'MARO', 'JPMO', 'OARK', 'DISO', 'XOMO', 'BRKC', 'YBIT', 'RDYY', 'MRNY', 'SHOY', 'PDDY', 'JDY', 'DRAY', 'GPTY', 'GDXY', 'CHPY', 'SMCY', 'LFGY', 'MINY', 'AIYY', 'CRSH', 'DIPS', 'WNTR', 'SLTY', 'FIAT', 'YQQQ', 'QDTY', 'XDTE', 'QDTE', 'RDTE']);

// 정기 배당 지급월이 확인된 종목 (특별배당 달은 제외)
export const KNOWN_PAY_MONTHS = {
  SCHD: [3, 6, 9, 12],
  KO: [4, 7, 10, 12],
  JNJ: [3, 6, 9, 12],
  GOOGL: [3, 6, 9, 12],
  AZN: [3, 9],
  RIO: [4, 9],
  NESN: [4],
  NVS: [3],
  ALV: [5],
  SIEGY: [2],
};

const EVERY_MONTH = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// { freq: 'weekly' | 'monthly' | 'fixed', months: [..] } 또는 지급월을 모르면 null
export function payScheduleOf(ticker) {
  if (WEEKLY_TICKERS.has(ticker)) return { freq: 'weekly', months: EVERY_MONTH };
  if (MONTHLY_TICKERS.has(ticker)) return { freq: 'monthly', months: EVERY_MONTH };
  if (KNOWN_PAY_MONTHS[ticker]) return { freq: 'fixed', months: KNOWN_PAY_MONTHS[ticker] };
  return null;
}
