// 종목·가이드 원문(data.js, 약 1.8MB)은 첫 화면(계산기)에 필요 없으므로 별도 청크로 분리해서
// 필요할 때만 불러와요. 한 번 불러오면 모듈 캐시에 남아서 다시 요청하지 않아요.
let cache = null;
let pending = null;

export function loadData() {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = import('../data.js').then((m) => {
      cache = m;
      return m;
    });
  }
  return pending;
}

export function getLoadedData() {
  return cache;
}
