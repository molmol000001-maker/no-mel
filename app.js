import React, { useState, useEffect, useMemo } from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import { motion, AnimatePresence } from "https://esm.sh/framer-motion@11?external=react,react-dom";

function App() {
  const gramsOfAlcohol = (abvPct, ml) => ml * (abvPct / 100) * 0.8;
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

  const C_AT_100 = 0.745;
  const COCKTAIL_DEFAULT_ML = 150;

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
  const ORDER = ["beer","wine","champagne","umeshu","gin","vodka","tequila","rum","sake","shochu","whisky","chuhi","cocktail","other"];

  const [weightKg, setWeightKg] = useState(Number(localStorage.getItem("alc_weightKg") || 75));
  const [age, setAge] = useState(Number(localStorage.getItem("alc_age") || 35));
  const [sex, setSex] = useState(localStorage.getItem("alc_sex") || "male");
  const r = useMemo(() => (sex === "male" ? 0.68 : sex === "female" ? 0.55 : 0.62), [sex]);
  const burnRate = useMemo(() => {
    let v = sex === "male" ? 7.2 : sex === "female" ? 6.8 : 7.0;
    if (age < 30) v += 0.2; else if (age >= 60) v -= 0.2;
    return Math.max(3, Math.min(12, Number(v.toFixed(1))));
  }, [sex, age]);

  const [A_g, setAg] = useState(Number(localStorage.getItem("alc_Ag") || 0));
  const [lastTs, setLastTs] = useState(Number(localStorage.getItem("alc_lastTs") || Date.now()));
  const [history, setHistory] = useState(() => {
    const v = localStorage.getItem("alc_hist");
    return v ? JSON.parse(v) : [];
  });
  const [lastWaterTs, setLastWaterTs] = useState(Number(localStorage.getItem("alc_lastWater") || 0));

  const [tab, setTab] = useState("main");
  const [cat, setCat] = useState("beer");
  const [optionIdx, setOptionIdx] = useState(0);
  const [percent, setPercent] = useState("");

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

  useEffect(() => { try { localStorage.setItem("alc_weightKg", String(weightKg)); } catch (e) {} }, [weightKg]);
  useEffect(() => { try { localStorage.setItem("alc_age", String(age)); } catch (e) {} }, [age]);
  useEffect(() => { try { localStorage.setItem("alc_sex", String(sex)); } catch (e) {} }, [sex]);
  useEffect(() => { try { localStorage.setItem("alc_Ag", String(A_g)); } catch (e) {} }, [A_g]);
  useEffect(() => { try { localStorage.setItem("alc_lastTs", String(lastTs)); } catch (e) {} }, [lastTs]);
  useEffect(() => { try { localStorage.setItem("alc_hist", JSON.stringify(history)); } catch (e) {} }, [history]);
  useEffect(() => { try { localStorage.setItem("alc_lastWater", String(lastWaterTs)); } catch (e) {} }, [lastWaterTs]);

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

  const [secTick, setSecTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSecTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const cfg = DRINKS[cat];
  const curOption = cfg.options[Math.max(0, Math.min(optionIdx, (cfg.options?.length || 1) - 1))] || { label: "", ml: 0 };
  const baseAbv = curOption && curOption.abv != null ? curOption.abv : cfg.allowPercent ? Number(percent || cfg.avgAbv) : cfg.avgAbv;
  const ml = cat === "cocktail" ? COCKTAIL_DEFAULT_ML : curOption.ml;

  const decayedA = (at) => {
    const dt_h = Math.max(0, (at - lastTs) / 3600000);
    return Math.max(0, A_g - burnRate * dt_h);
  };
  const A_now = useMemo(() => decayedA(Date.now()), [A_g, lastTs, burnRate, secTick]);
  const C = useMemo(() => (r > 0 && weightKg > 0 ? A_now / (r * weightKg) : 0), [A_now, r, weightKg]);
  const scoreExact = useMemo(() => Math.max(0, Math.min(100, (C / 0.745) * 100)), [C]);
  const score100 = Math.round(scoreExact);
  const stageInfo = (s) => {
    if (s < 15) return { idx: 1, label: 'しらふ', chip: 'bg-gray-200 text-gray-800', bar: 'bg-gray-400' };
    if (s < 45) return { idx: 2, label: 'ほろ酔い', chip: 'bg-green-100 text-green-800', bar: 'bg-green-500' };
    if (s < 75) return { idx: 3, label: 'パーティ', chip: 'bg-sky-100 text-sky-800', bar: 'bg-sky-500' };
    if (s < 90) return { idx: 4, label: '酩酊', chip: 'bg-amber-100 text-amber-900', bar: 'bg-amber-500' };
    return { idx: 5, label: '危険', chip: 'bg-red-100 text-red-700', bar: 'bg-red-600' };
  };
  const secondsToTarget = (Acur, Atarget, rate) => {
    if (Acur <= Atarget) return 0;
    const over = Acur - Atarget;
    const hours = over / Math.max(0.0001, rate);
    return Math.max(0, Math.ceil(hours * 3600));
  };

  const targetScore = 43;
  const C_target = 0.745 * (targetScore / 100);
  const A_target = C_target * r * weightKg;
  const targetBaseSec = secondsToTarget(A_now, A_target, burnRate);
  const minCooldownSec = lastAlcoholTs ? Math.max(0, Math.round((lastDrinkGrams / 20) * 1800) - Math.floor((Date.now() - lastAlcoholTs) / 1000)) : 0;

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
  const policyBaseSec = Math.max(minCooldownSec, Math.min(targetBaseSec, friendlyCapSec));
  const effectiveBonusSec = Math.min(waterBonusSec, policyBaseSec);
  const nextOkSec = Math.max(0, policyBaseSec - effectiveBonusSec);

  const hasAnyAlcohol = useMemo(() => history.some(h => h.type === 'alcohol'), [history]);
  const displaySec = hasAnyAlcohol ? nextOkSec : 0;

  const computeHeaderScoreExact = (scoreExactVal, hasAlcohol, sec, tgtScore) => (
    (hasAlcohol && sec === 0) ? Math.min(scoreExactVal, tgtScore) : scoreExactVal
  );
  const headerScoreExact = useMemo(
    () => computeHeaderScoreExact(scoreExact, hasAnyAlcohol, displaySec, targetScore),
    [scoreExact, hasAnyAlcohol, displaySec, targetScore]
  );
  const headerStage = useMemo(() => stageInfo(Math.round(headerScoreExact)), [headerScoreExact]);

  const needsWaterAfter = (hist) => hist.length > 0 && hist[0].type === "alcohol";
  const needsWater = needsWaterAfter(history);

  const addDrink = () => {
    if (needsWater) { alert("次の一杯の前にソフトドリンクを挟んでください"); return; }
    try { if (navigator.vibrate) navigator.vibrate(10); } catch (e) {}
    const g = gramsOfAlcohol(baseAbv, ml);
    const now = Date.now();
    const aNow = decayedA(now);
    setAg(aNow + g);
    setLastTs(now);
    setLastAlcoholTs(now);
    setLastDrinkGrams(g);
    setWaterBonusSec(0);
    const labelParts = [
      cfg.name,
      cat === "cocktail" ? curOption.label || "" : (!cfg.simpleAdd && (((cfg.options?.length || 0) > 1) || cfg.showMlAlways) ? (curOption.label || "") : ""),
      curOption && curOption.abv != null ? `${curOption.abv}%` : cfg.allowPercent ? `${baseAbv}%` : `平均${cfg.avgAbv}%`,
    ];
    setHistory((h) => [{ id: Math.random().toString(36).slice(2), ts: now, type: "alcohol", label: labelParts.filter(Boolean).join(" · "), abv: baseAbv, ml }, ...h]);
  };
  const addWater = () => {
    try { if (navigator.vibrate) navigator.vibrate(10); } catch (e) {}
    const now = Date.now();
    const mandatory = history.length > 0 && history[0].type === 'alcohol';
    setHistory((h) => [{ id: Math.random().toString(36).slice(2), ts: now, type: "water", label: "ソフトドリンク/水" }, ...h]);
    setLastWaterTs(now);
    if (!mandatory) setWaterBonusSec((s)=> s + 600);
  };

  return (
    <div className="min-h-[100dvh] w-full text-slate-900 bg-gradient-to-b from-slate-50 to-slate-100">
      <div key={appKey} className="max-w-md mx-auto relative flex flex-col min-h-[100dvh]">
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

        <main className="flex-1 px-4 pb-32 pt-3">
          <section className="bg-white rounded-2xl p-4 shadow-sm grid gap-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold tracking-tight">{fmtMMSS(displaySec)}</div>
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
                  onClick={() => { setCat(id); setOptionIdx(0); setPercent(""); }}
                >
                  {DRINKS[id].name}
                </button>
              ))}
            </div>

            <div className="mt-2">
              <button
                className={`w-full h-12 px-4 rounded-xl font-semibold active:scale-[.98] bg-slate-900 text-white`}
                onClick={addDrink}
              >
                この内容で追加
              </button>
            </div>
          </section>
        </main>

        <AnimatePresence>
          {toast && (
            <motion.div key="toast" className="fixed left-1/2 -translate-x-1/2 bottom-24 z-40 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs shadow"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.2 }}>
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
