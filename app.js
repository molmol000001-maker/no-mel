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
  const needsW
