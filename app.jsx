// app.jsx ーーー 先頭に import は不要（削除） ーーー

// Framer Motion の UMD グローバルを取り出し
const { motion, AnimatePresence } = window.framerMotion || {};

// ここからは殿の元コードほぼそのまま（関数宣言にする点だけ注意）
function App() {
  // ---------- helpers ----------
  const { useState, useEffect, useMemo } = React;

  const gramsOfAlcohol = (abvPct, ml) => ml * (abvPct / 100) * 0.8; // 0.8g/ml
  const fmtTime = (ts) => {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  };
  const fmtMMSS = (s) => {
    const m = Math.floor(s / 60);
    const ss = String(Math.floor(s % 60)).padStart(2, "0");
    return `${m}:${ss}`;
  };

  // 以降は、殿が貼ってくれた App の中身をそのまま貼り付けでOKです
  // （import/exports を消して、最後の createRoot だけ下の通りにする）
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  // ここに「ご提示のApp本体のロジック」を全部貼ってください
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ・・・（省略：殿の長いApp本体）・・・

  return (
    // ここも殿の JSX のままでOK
    <div className="min-h-[100dvh] w-full text-slate-900 bg-gradient-to-b from-slate-50 to-slate-100">
      {/* 以降、元のJSXそのまま */}
    </div>
  );
}

// マウント（UMDのReactDOMを使用）
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
