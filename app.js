// ESM CDN からReact/ReactDOM/Framer Motionを読み込み（ビルド不要）
import React, { useState, useEffect, useMemo } from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import { motion, AnimatePresence } from "https://esm.sh/framer-motion@11?external=react,react-dom";

function App() {
  // ---------- helpers ----------
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

  // 100段階スコア（校正済み）
  // 校正: 75kg・男性がビール500ml(5%)を飲んだ直後に targetScore=43 で約30分になるように設定
  // 参考: A(500ml,5%)≒20g, burnRate≈7.2g/h → (20 - A_target)/7.2 ≒ 0.5h → A_target≒16.4g
  const C_AT_100 = 0.745;
  const scoreFromC = (C) => Math.max(0, Math.min(100, Math.round((C / C_AT_100) * 100)));
  const COCKTAIL_DEFAULT_ML = 150;

  // ---------- drink config (要件反映) ----------
  const DRINKS = {
    beer: { name: "ビール", avgAbv: 5, options: [{ label: "350ml", ml: 350 }, { label: "500ml", ml: 500 }] },
    wine: { name: "ワイン", avgAbv: 12, options: [{ label: "グラス(120ml)", ml: 120 }] },
    champagne: { name: "シャンパン", avgAbv: 12, options: [{ label: "フルート(120ml)", ml: 120 }] },
    umeshu: { name: "梅酒", avgAbv: 12, options: [{ label: "グラス(90ml)", ml: 90 }] },
    gin: { name: "ジン", avgAbv: 40, simpleAdd: true, options: [{ label: "", ml: 30 }] },
    vodka: { name: "ウォッカ", avgAbv: 40, simpleAdd: true, options: [{ label: "", ml: 30 }] },
    tequila: { name: "テキーラ", avgAbv: 40, simpleAdd: true, options: [{ label: "", ml: 30 }] },
    rum: { name: "ラム", avgAbv: 40, simpleAdd: true, options: [{ label: "", ml: 30 }] },
    sake: { name: "日本酒", avgAbv: 15, options: [{ label: "お猪口(60ml)", ml: 60 }, { label: "一合(180ml)", ml: 180 }] },
    shochu: { name: "焼酎", avgAbv: 25, simpleAdd: true, options: [{ label: "", ml: 90 }] },
    whisky: { name: "ウイスキー", avgAbv: 40, simpleAdd: true, options: [{ label: "", ml: 30 }] },
    chuhi: { name: "酎ハイ", avgAbv: 7, options: [{ label: "350ml", ml: 350 }, { label: "500ml", ml: 500 }], allowPercent: true, percentRange: { min: 3, max: 12, step: 0.5 } },
    cocktail: { name: "カクテル", avgAbv: 20, options: [{ label: "弱め（10度前後）", abv: 10 }, { label: "レギュラー（20度前後）", abv: 20 }, { label: "強め（30度前後以上）", abv: 30 }] },
    other: { name: "その他", avgAbv: 5, options: [{ label: "100ml", ml: 100 }, { label: "350ml", ml: 350 }, { label: "500ml", ml: 500 }], allowPercent: true, percentRange: { min: 0, max: 96, step: 0.5 }, showMlAlways: true },
  };
  const ORDER = [
    "beer", "wine", "champagne", "umeshu",
    "gin", "vodka", "tequila", "rum",
    "sake", "shochu", "whisky", "chuhi", "cocktail", "other"
  ];

  // ---------- settings ----------
  const [weightKg, setWeightKg] = useState(Number(localStorage.getItem("alc_weightKg") || 75));
  const [age, setAge] = useState(Number(localStorage.getItem("alc_age") || 35));
  const [sex, setSex] = useState(localStorage.getItem("alc_sex") || "male");
  const r = useMemo(() => (sex === "male" ? 0.68 : sex === "female" ? 0.55 : 0.62), [sex]);
  const burnRate = useMemo(() => {
    // 体内代謝の簡易推定（g/h）
    let v = sex === "male" ? 7.2 : sex === "female" ? 6.8 : 7.0;
    if (age < 30) v += 0.2; else if (age >= 60) v -= 0.2;
    return Math.max(3, Math.min(12, Number(v.toFixed(1))));
  }, [sex, age]);

  // ---------- core states ----------
  const [A_g, setAg] = useState(Number(localStorage.getItem("alc_Ag") || 0)); // 現在体内に残る純アル(g)
  const [lastTs, setLastTs] = useState(Number(localStorage.getItem("alc_lastTs") || Date.now()));
  const [history, setHistory] = useState(() => {
    const v = localStorage.getItem("alc_hist");
    return v ? JSON.parse(v) : [];
  });
  const [lastWaterTs, setLastWaterTs] = useState(Number(localStorage.getItem("alc_lastWater") || 0));

  // ---------- UI states ----------
  const [tab, setTab] = useState("main");
  const [cat, setCat] = useState("beer");
  const [optionIdx, setOptionIdx] = useState(0);
  const [percent, setPercent] = useState("");

  // ソフトドリンク効果（任意の水: -10分/杯）、最初の必須水はボーナスなし
  const [waterBonusSec, setWaterBonusSec] = useState(Number(localStorage.getItem("alc_waterBonusSec") || 0));
  const [lastAlcoholTs, setLastAlcoholTs] = useState(Number(localStorage.getItem("alc_lastAlcohol") || 0));
  useEffect(() => { try { localStorage.setItem("alc_waterBonusSec", String(waterBonusSec)); } catch (e) {} }, [waterBonusSec]);
  useEffect(() => { try { localStorage.setItem("alc_lastAlcohol", String(lastAlcoholTs)); } catch (e) {} }, [lastAlcoholTs]);

  const [lastDrinkGrams, setLastDrinkGrams] = useState(Number(localStorage.getItem("alc_lastDrinkGrams") || 0));
  useEffect(() => { try { localStorage.setItem("alc_lastDrinkGrams", String(lastDrinkGrams)); } catch (e) {} }, [lastDrinkGrams]);

  const [appKey, setAppKey] = useState(0);
  const [toast, setToast] = useState("");
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 1500); };
  const [ripple, setRipple] = useState(false);
  const [spin, setSpin] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const [showSparks, setShowSparks] = useState(false);
  const [showSparks2, setShowSparks2] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);
  const COLORS = ['#60a5fa','#34d399','#fbbf24','#f472b6','#f87171'];
  const SPARKS1 = [
    {x:0,y:-60,size:18},{x:40,y:-45,size:14},{x:60,y:-5,size:16},{x:55,y:35,size:14},
    {x:15,y:60,size:16},{x:-20,y:60,size:14},{x:-55,y:30,size:16},{x:-60,y:-5,size:14},{x:-35,y:-45,size:16},{x:20,y:-60,size:14}
  ];
  const SPARKS2 = [
    {x:0,y:-85,size:18},{x:70,y:-50,size:16},{x:90,y:0,size:18},{x:65,y:55,size:16},
    {x:0,y:85,size:18},{x:-70,y:50,size:16},{x:-90,y:0,size:18},{x:-65,y:-55,size:16}
  ];

  // persist
  useEffect(() => { try { localStorage.setItem("alc_weightKg", String(weightKg)); } catch (e) {} }, [weightKg]);
  useEffect(() => { try { localStorage.setItem("alc_age", String(age)); } catch (e) {} }, [age]);
  useEffect(() => { try { localStorage.setItem("alc_sex", String(sex)); } catch (e) {} }, [sex]);
  useEffect(() => { try { localStorage.setItem("alc_Ag", String(A_g)); } catch (e) {} }, [A_g]);
  useEffect(() => { try { localStorage.setItem("alc_lastTs", String(lastTs)); } catch (e) {} }, [lastTs]);
  useEffect(() => { try { localStorage.setItem("alc_hist", JSON.stringify(history)); } catch (e) {} }, [history]);
  useEffect(() => { try { localStorage.setItem("alc_lastWater", String(lastWaterTs)); } catch (e) {} }, [lastWaterTs]);

  // decay timer (1min)
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const dt_h = Math.max(0, (now - lastTs) / 3600000);
      const newA = Math.max(0, A_g - burnRate * dt_h);
      setAg(newA);
      setLastTs(now);
    }, 60000);
    return () => clearInterval(id);
  }, [A_g, lastTs, burnRate]);

  // seconds tick for countdown re-render
  const [secTick, setSecTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSecTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // current selection
  const cfg = DRINKS[cat];
  const curOption = cfg.options[Math.max(0, Math.min(optionIdx, (cfg.options?.length || 1) - 1))] || { label: "", ml: 0 };
  const baseAbv = curOption && curOption.abv != null ? curOption.abv : cfg.allowPercent ? Number(percent || cfg.avgAbv) : cfg.avgAbv;
  const ml = cat === "cocktail" ? COCKTAIL_DEFAULT_ML : curOption.ml;

  // calculations
  const decayedA = (at) => {
    const dt_h = Math.max(0, (at - lastTs) / 3600000);
    return Math.max(0, A_g - burnRate * dt_h);
  };
  const A_now = useMemo(() => decayedA(Date.now()), [A_g, lastTs, burnRate, secTick]);
  const C = useMemo(() => (r > 0 && weightKg > 0 ? A_now / (r * weightKg) : 0), [A_now, r, weightKg]);
  const scoreExact = useMemo(() => Math.max(0, Math.min(100, (C / C_AT_100) * 100)), [C]);
  const score100 = Math.round(scoreExact);
  const stageInfo = (s) => {
    // ユーザー配慮のしきい値（さらに現実寄りに緩和）
    // しらふ < 15 / ほろ酔い < 45 / パーティ < 75 / 酩酊 < 90 / 危険 ≥ 90
    if (s < 15) return { idx: 1, label: 'しらふ', chip: 'bg-gray-200 text-gray-800', bar: 'bg-gray-400' };
    if (s < 45) return { idx: 2, label: 'ほろ酔い', chip: 'bg-green-100 text-green-800', bar: 'bg-green-500' };
    if (s < 75) return { idx: 3, label: 'パーティ', chip: 'bg-sky-100 text-sky-800', bar: 'bg-sky-500' };
    if (s < 90) return { idx: 4, label: '酩酊', chip: 'bg-amber-100 text-amber-900', bar: 'bg-amber-500' };
    return { idx: 5, label: '危険', chip: 'bg-red-100 text-red-700', bar: 'bg-red-600' };
  };
  const stage = useMemo(() => stageInfo(score100), [score100]);
  const secondsToTarget = (Acur, Atarget, rate) => {
    if (Acur <= Atarget) return 0;
    const over = Acur - Atarget;
    const hours = over / Math.max(0.0001, rate);
    return Math.max(0, Math.ceil(hours * 3600));
  };

  // 目標スコア（固定: 500mlで約30分）
  const targetScore = 43;
  const C_target = C_AT_100 * (targetScore / 100); // scoreFromCの逆写像
  const A_target = C_target * r * weightKg; // C_targetをr・体重へ変換
  const targetBaseSec = secondsToTarget(A_now, A_target, burnRate);
  const minCooldownSec = lastAlcoholTs ? Math.max(0, Math.round((lastDrinkGrams / 20) * 1800) - Math.floor((Date.now() - lastAlcoholTs) / 1000)) : 0;
  // 直近60分の摂取グラム総量に基づくフレンドリー上限（20g→30分を基準に比例）
  const gramsRecent60 = (() => {
    const cutoff = Date.now() - 60 * 60 * 1000;
    let sum = 0;
    for (const h of history) {
      if (h.type === 'alcohol' && h.ts >= cutoff) {
        const abv = Number(h.abv || 0);
        const vol = Number(h.ml || 0);
        sum += gramsOfAlcohol(abv, vol);
      }
    }
    return sum;
  })();
  const friendlyCapSec = Math.max(0, Math.round((gramsRecent60 / 20) * 1800));
  // ポリシー: 「ターゲットまでの時間」をフレンドリー上限で抑えつつ、最小クールダウンは下回らない
  const policyBaseSec = Math.max(minCooldownSec, Math.min(targetBaseSec, friendlyCapSec));
  const effectiveBonusSec = Math.min(waterBonusSec, policyBaseSec);
  const nextOkSec = Math.max(0, policyBaseSec - effectiveBonusSec);

  // 一杯目の後からカウント（初回は 0:00 表示）
  const hasAnyAlcohol = useMemo(() => history.some(h => h.type === 'alcohol'), [history]);
  const displaySec = hasAnyAlcohol ? nextOkSec : 0;

  // header 表示の見かけ酔い度（飲酒可能=タイマー0のときは targetScore までクリップ表示）
  const computeHeaderScoreExact = (scoreExactVal, hasAlcohol, sec, tgtScore) => (
    (hasAlcohol && sec === 0) ? Math.min(scoreExactVal, tgtScore) : scoreExactVal
  );
  const headerScoreExact = useMemo(
    () => computeHeaderScoreExact(scoreExact, hasAnyAlcohol, displaySec, targetScore),
    [scoreExact, hasAnyAlcohol, displaySec, targetScore]
  );
  const headerStage = useMemo(() => stageInfo(Math.round(headerScoreExact)), [headerScoreExact]);

  // ユーティリティ（テスト用）
  const hasAnyAlcoholEver = (hist) => hist.some(h => h.type === 'alcohol');
  const needsWaterAfter = (hist) => hist.length > 0 && hist[0].type === "alcohol";
  const needsWater = needsWaterAfter(history);

  // actions
  const addDrink = () => {
    if (needsWater) { alert("次の一杯の前にソフトドリンクを挟んでください"); return; }
    try { if (navigator.vibrate) navigator.vibrate(10); } catch (e) {}
    const g = gramsOfAlcohol(baseAbv, ml);
    const now = Date.now();
    const aNow = decayedA(now);
    setAg(aNow + g);
    setLastTs(now);
    setLastAlcoholTs(now);         // 最終アルコール時刻を更新
    setLastDrinkGrams(g);         // 直近の摂取グラムを記録
    setWaterBonusSec(0);           // ソフトドリンク効果はリセット（次の周回へ）
    const labelParts = [
      cfg.name,
      cat === "cocktail" ? curOption.label || "" : (!cfg.simpleAdd && (((cfg.options?.length || 0) > 1) || cfg.showMlAlways) ? (curOption.label || "") : ""),
      curOption && curOption.abv != null ? `${curOption.abv}%` : cfg.allowPercent ? `${baseAbv}%` : `平均${cfg.avgAbv}%`,
    ];
    setHistory((h) => [
      { id: Math.random().toString(36).slice(2), ts: now, type: "alcohol", label: labelParts.filter(Boolean).join(" · "), abv: baseAbv, ml },
      ...h,
    ]);
    setTab("main");
  };
  const addWater = () => {
    try { if (navigator.vibrate) navigator.vibrate(10); } catch (e) {}
    const now = Date.now();
    // 直前がアルコールなら必須ウォーター（ボーナスなし）
    const mandatory = history.length > 0 && history[0].type === 'alcohol';
    setHistory((h) => [{ id: Math.random().toString(36).slice(2), ts: now, type: "water", label: "ソフトドリンク/水" }, ...h]);
    setLastWaterTs(now);
    if (!mandatory) {
      // 追加のソフトドリンクは1杯ごとに -10分（600秒）
      setWaterBonusSec((s)=> s + 600);
    }
  };
  const handleWaterClick = () => {
    try { if (navigator.vibrate) navigator.vibrate([10, 30, 10]); } catch (e) {}
    setRipple(true);
    setPulseKey((k) => k + 1);
    setSpin(true);
    setShowSparks(true);
    setShowSparks2(true);
    setBurstKey((k) => k + 1);
    // 長め&派手めの演出
    setTimeout(() => setRipple(false), 1100);
    setTimeout(() => setShowSparks(false), 800);
    setTimeout(() => setShowSparks2(false), 1000);
    // 演出を見せてから記録（オーバーレイは記録後に閉じる）
    setTimeout(() => {
      addWater();
      showToast("ソフトドリンクを記録しました");
      setSpin(false);
    }, 700);
  };
  const endSession = () => {
    try { if (navigator.vibrate) navigator.vibrate(20); } catch (e) {}

    // 1) 永続データを先に空にする
    const now = Date.now();
    try {
      localStorage.setItem("alc_Ag", "0");
      localStorage.setItem("alc_lastTs", String(now));
      localStorage.setItem("alc_lastWater", "0");
      localStorage.setItem("alc_hist", JSON.stringify([]));
      localStorage.setItem("alc_lastAlcohol", "0");
      localStorage.setItem("alc_waterBonusSec", "0");
      localStorage.setItem("alc_lastDrinkGrams", "0");
    } catch (e) {}

    // 2) React state を同期して即UIに反映
    setAg(0);
    setLastTs(now);
    setLastWaterTs(0);
    setHistory([]);
    setCat("beer");
    setOptionIdx(0);
    setPercent("");
    setLastAlcoholTs(0);
    setLastDrinkGrams(0);
    setWaterBonusSec(0);
    setTab("main");

    // 3) 強制再計算 + 再マウント（key更新）で確実に初期化
    setSecTick((t) => t + 1);
    setAppKey((k) => k + 1);
    showToast("リセットしました");
  };

  // ---------- tiny dev tests (console) ----------
  useEffect(() => {
    try {
      console.assert(Math.abs(gramsOfAlcohol(5, 350) - 14) < 0.01, "g(5%,350ml) ≈ 14g");
      console.assert(Math.abs(gramsOfAlcohol(5, 500) - 20) < 0.01, "g(5%,500ml) ≈ 20g");
      console.assert(gramsOfAlcohol(5, 500) > gramsOfAlcohol(5, 350), 'g increases with ml');
      console.assert(fmtMMSS(0) === "0:00", "fmtMMSS 0:00");
      console.assert(fmtMMSS(125) === "2:05", "fmtMMSS 2:05");
      const stageInfoLocal = (s)=>stageInfo(s);
      (function(){
        const a = stageInfoLocal(5).label === 'しらふ';
        const b = stageInfoLocal(20).label === 'ほろ酔い';
        const c = stageInfoLocal(60).label === 'パーティ';
        const d = stageInfoLocal(80).label === '酩酊';
        const e = stageInfoLocal(95).label === '危険';
        console.assert(a && b && c && d && e, 'stageInfo thresholds ok');
      })();
    } catch (e) {
      console.warn("dev tests failed", e);
    }
  }, []);

  // ---------- UI ----------
  return (
    <div className="min-h-[100dvh] w-full text-slate-900 bg-gradient-to-b from-slate-50 to-slate-100">
      <div key={appKey} className="max-w-md mx-auto relative flex flex-col min-h-[100dvh]">
        {/* header */}
        <header className="sticky top-0 z-20 backdrop-blur bg-white/70 border-b border-slate-200" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold">飲酒管理</div>
              <div className="text-right leading-tight w-40">
                <div className="text-[10px] text-slate-500 flex items-center justify-between gap-1">
                  <span>酔い度ゲージ</span>
                  <span className={`shrink-0 px-1.5 py-0.5 rounded ${headerStage.chip}`}>{headerStage.label}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1">
                  <div className={`h-full ${headerStage.bar} transition-[width] duration-700`} style={{ width: `${Math.max(0, Math.min(100, headerScoreExact))}%` }} />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* main content */}
        <main className="flex-1 px-4 pb-32 pt-3">
          {/* main section */}
          <section className="bg-white rounded-2xl p-4 shadow-sm grid gap-4" style={{ display: "grid" }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold tracking-tight">{fmtMMSS(displaySec)}</div>
                {hasAnyAlcohol && displaySec > 0 && (
                  <div className="text-[11px] text-slate-500">（{fmtTime(Date.now() + displaySec * 1000)} 目安）</div>
                )}
                {effectiveBonusSec > 0 && (
                  <div className="text-[11px] text-slate-500">ソフトドリンク効果: -{Math.floor(effectiveBonusSec / 60)}分</div>
                )}
              </div>
              <button onClick={addWater} className="h-11 px-4 rounded-xl bg-slate-100 font-semibold active:scale-[.98]">
                ソフトドリンク
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {ORDER.map((id) => (
                <button
                  key={id}
                  className={`h-11 px-3 rounded-xl text-sm font-semibold border active:scale-[.98] ${cat === id ? 'bg-slate-900 text-white' : 'bg-white'}`}
                  onClick={() => {
                    setCat(id);
                    setOptionIdx(0);
                    setPercent("");
                  }}
                >
                  {DRINKS[id].name}
                </button>
              ))}
            </div>

            {cat === 'cocktail' ? (
              <>
                <div>
                  <div className="text-xs text-slate-500">強さ</div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {DRINKS.cocktail.options.map((op, idx) => (
                      <button
                        key={op.label}
                        className={`h-11 px-3 rounded-xl text-sm font-semibold border active:scale-[.98] ${optionIdx === idx ? 'bg-slate-900 text-white' : 'bg-white'}`}
                        onClick={() => setOptionIdx(idx)}
                      >
                        {op.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-50 border rounded-xl p-3 text-xs text-slate-600">
                  {optionIdx === 0 && <p>弱め（10度前後）：カシスオレンジやファジーネーブルなど、ジュースベースの飲みやすいカクテル。</p>}
                  {optionIdx === 1 && <p>レギュラー（20度前後）：ウォッカ、ジン、テキーラ、ラムなどのスピリッツをベースに他の材料を加えて作られます。</p>}
                  {optionIdx === 2 && <p>強め（30度前後以上）：マティーニ、マンハッタン、モヒートなど、スピリッツ比率が高め。</p>}
                </div>

                <div className="mt-2">
                  <button
                    disabled={needsWater}
                    aria-disabled={needsWater}
                    className={`w-full h-12 px-4 rounded-xl font-semibold active:scale-[.98] ${needsWater ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white'}`}
                    onClick={addDrink}
                  >
                    この内容で追加
                  </button>
                </div>
                {needsWater && <div className="text-[11px] text-rose-600">一杯お酒を飲んだら、一杯ソフトドリンクを挟んでください。</div>}
              </>
            ) : (
              <>
                {(!DRINKS[cat].simpleAdd && ((DRINKS[cat].options?.length || 0) > 1)) && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-slate-500">量</div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {DRINKS[cat].options.map((op, idx) => (
                          <button
                            key={op.label}
                            className={`h-11 px-3 rounded-xl text-sm font-semibold border active:scale-[.98] ${optionIdx === idx ? 'bg-slate-900 text-white' : 'bg-white'}`}
                            onClick={() => setOptionIdx(idx)}
                          >
                            {op.label || '既定量'}
                          </button>
                        ))}
                      </div>
                    </div>
                    {DRINKS[cat].allowPercent && (
                      <div>
                        <div className="text-xs text-slate-500">度数（%）</div>
                        <input
                          className="w-full mt-1 border rounded-xl px-3 h-11"
                          type="number"
                          min={DRINKS[cat].percentRange.min}
                          max={DRINKS[cat].percentRange.max}
                          step={DRINKS[cat].percentRange.step}
                          value={percent === '' ? DRINKS[cat].avgAbv : percent}
                          onChange={(e) => setPercent(e.target.value === '' ? '' : Number(e.target.value))}
                        />
                        <div className="text-[11px] text-slate-500 mt-1">未入力時は平均{DRINKS[cat].avgAbv}%で推定</div>
                      </div>
                    )}
                  </div>
                )}

                {(!DRINKS[cat].simpleAdd && ((DRINKS[cat].options?.length || 0) <= 1) && DRINKS[cat].allowPercent) && (
                  <div>
                    <div className="text-xs text-slate-500">度数（%）</div>
                    <input
                      className="w-full mt-1 border rounded-xl px-3 h-11"
                      type="number"
                      min={DRINKS[cat].percentRange.min}
                      max={DRINKS[cat].percentRange.max}
                      step={DRINKS[cat].percentRange.step}
                      value={percent === '' ? DRINKS[cat].avgAbv : percent}
                      onChange={(e) => setPercent(e.target.value === '' ? '' : Number(e.target.value))}
                    />
                    <div className="text-[11px] text-slate-500 mt-1">未入力時は平均{DRINKS[cat].avgAbv}%で推定</div>
                  </div>
                )}

                <div className="mt-2">
                  <button
                    disabled={needsWater}
                    aria-disabled={needsWater}
                    className={`w-full h-12 px-4 rounded-xl font-semibold active:scale-[.98] ${needsWater ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white'}`}
                    onClick={addDrink}
                  >
                    この内容で追加
                  </button>
                </div>
                {needsWater && <div className="text-[11px] text-rose-600">一杯お酒を飲んだら、一杯ソフトドリンクを挟んでください。</div>}
              </>
            )}
          </section>

          {/* history */}
          <section className="bg-white rounded-2xl p-4 shadow-sm" style={{ display: "none" }}>
            {/* タブ実装を簡素化（単画面運用）。もし切り替えたい場合は、上のtab状態とこの表示を戻してください */}
          </section>

          {/* settings */}
          <section className="bg-white rounded-2xl p-4 shadow-sm grid gap-4" style={{ display: "none" }}>
            {/* 同上 */}
          </section>
        </main>

        {/* toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              key="toast"
              className="fixed left-1/2 -translate-x-1/2 bottom-24 z-40 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs shadow"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

// マウント
createRoot(document.getElementById("root")).render(<App />);
