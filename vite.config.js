import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { STOCKS, ARTICLES } from './data.js';

export default defineConfig({
  plugins: [react()],
  // data.js(종목·가이드 원문)는 필요할 때만 불러오는 별도 청크라 크기 경고 기준을 넉넉히 둠
  build: { chunkSizeWarningLimit: 900 },
  // 헤더에 표시하는 종목·가이드 수 — 데이터 청크를 불러오지 않고도 숫자를 보여주기 위해 빌드 시점에 주입
  define: {
    __STOCK_COUNT__: STOCKS.length,
    __ARTICLE_COUNT__: ARTICLES.length,
  },
});
