import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { loadData } from './dataStore.js';

function start() {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// 종목·가이드 페이지는 데이터가 있어야 그릴 수 있으므로, 데이터를 받은 뒤에 앱을 띄워요.
// 그 사이에는 프리렌더된 정적 본문이 그대로 보이므로 빈 화면이 깜빡이지 않아요.
const needsData =
  /^\/(stocks|guide)(\/|$)/.test(window.location.pathname) ||
  /^#\/?(stocks|guide)/.test(window.location.hash);

if (needsData) loadData().then(start, start);
else start();
