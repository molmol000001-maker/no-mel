import { motion, AnimatePresence } from "framer-motion";
import React, { useState, useEffect, useMemo } from "react";

export default function App() {
  // --- helpers ---
  const gramsOfAlcohol = (abvPct, ml) => ml * (abvPct / 100) * 0.8; // 0.8g/ml
  const fmtMMSS = (s) => {
    const m = Math.floor(s / 60);
    const ss = String(Math.floor(s % 60)).padStart(2, "0");
    return `${m}:${ss}`;
  };

  // ---------- 状態管理 ----------
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState("main");
  const [weightKg, setWeightKg] = useState(75);
  const [age, setAge] = useState(35);
  const [sex, setSex] = useState("male");
  const [A_g, setAg] = useState(0); // 体内アルコール量(g)
  const [lastTs, setLastTs] = useState(Date.now());
  const [waterBonusSec, setWaterBonusSec] = useState(0);
  const [waterBonusBudgetSec, setWaterBonusBudgetSec] = useState(0);
  // state 群のところに追加
const [waterFX, setWaterFX] = useState(false);
const [goodNightOpen, setGoodNightOpen] = useState(false);

  // 直前がアルコールなら「水が必要」
  const needsWater = history[0]?.type === "alcohol";

  // タイマー関連
  const [lastAlcoholTs, setLastAlcoholTs] = useState(0);
  const [lastDrinkGrams, setLastDrinkGrams] = useState(0);
  const [secTick, setSecTick] = useState(0); // 1秒ごとに再レンダリング
  // === カクテル強さプリセット & 表示用テキスト ===
const COCKTAIL_STRENGTHS = [
  { key: "weak",   label: "弱め", abv: 6,  note: "目安6%／例: スプリッツァー、カシスソーダ" },
  { key: "normal", label: "普通", abv: 8,  note: "目安8%／例: ジントニック、ファジーネーブル" },
  { key: "strong", label: "強め", abv: 12, note: "目安12%／例: ラムコーク(濃いめ)、テキーラサンライズ(濃いめ)" },
];

const PRESETS = {
  beer:     { label: "ビール",   sizes: [350, 500, 700], defaultMl: 350, defaultAbv: 5 },
  sake:     { label: "日本酒",
              sizes: [{k:"ochoko", label:"お猪口(60ml)", ml:60}, {k:"ichigo", label:"一合(180ml)", ml:180}],
              defaultAbv: 15 },
  cocktail: { label: "カクテル", defaultMl: 200, strengths: COCKTAIL_STRENGTHS },
  chuhai:   { label: "酎ハイ",  sizes: [350, 500], abvMin: 1, abvMax: 9, defaultMl: 350, defaultAbv: 5 },
  other:    {
  label: "その他",
  defaultMl: 200,             // 初期値
  defaultAbv: 8,              // 初期値
  mlMin: 30,  mlMax: 1000,    // 量スライダーの範囲
  mlStep: 10,
  abvMin: 0,  abvMax: 60,     // 度数スライダーの範囲
  abvStep: 1,
},
};

// === ドリンクピッカー state ===
const [picker, setPicker] = useState({
  open: false,
  kind: null,   // 'beer' | 'sake' | 'cocktail' | 'chuhai' | 'other'
  label: "",
  ml: 350,
  abv: 5,
  sizeKey: null, // 日本酒の「お猪口/一合」、カクテル強さキーなど
  note: "",      // 補足表示（カクテルの説明）
});


  // ---------- 定数 ----------
  const C_AT_100 = 0.745; // 校正用

  // ---------- 性別による分布係数 ----------
  const r = useMemo(
    () => (sex === "male" ? 0.68 : sex === "female" ? 0.55 : 0.62),
    [sex]
  );

  // ---------- 代謝速度 (g/h) ----------
  const burnRate = useMemo(() => {
    let v = sex === "male" ? 7.2 : sex === "female" ? 6.8 : 7.0;
    if (age < 30) v += 0.2;
    else if (age >= 60) v -= 0.2;
    return Math.max(3, Math.min(12, Number(v.toFixed(1))));
  }, [sex, age]);

  // ---- 残存アルコール量 / 目標スコアまで ----
  const decayedA = (at) => {
    const dt_h = Math.max(0, (at - lastTs) / 3600000);
    return Math.max(0, A_g - burnRate * dt_h);
  };

  // 目標スコア（フル版と同じ）
  const targetScore = 43;
  const C_target = C_AT_100 * (targetScore / 100);
  const A_target = C_target * r * weightKg;

  const secondsToTarget = (Acur, Atgt, rate) => {
    if (Acur <= Atgt) return 0;
    const over = Acur - Atgt;
    const hours = over / Math.max(0.0001, rate);
    return Math.ceil(hours * 3600);
  };

// 現在の残存量：表示は毎秒更新（secTick 依存）
  const A_now = useMemo(() => decayedA(Date.now()), [secTick, lastTs, A_g, burnRate]);

  // ---- 直近60分の摂取量（g）と友好的上限 ----
  const gramsRecent60 = (() => {
    const cutoff = Date.now() - 60 * 60 * 1000;
    let sum = 0;
    for (const h of history) {
      if (h.type === "alcohol" && h.ts >= cutoff) {
        const abv = Number(h.abv || 0);
        const vol = Number(h.ml || 0);
        sum += vol * (abv / 100) * 0.8;
      }
    }
    return sum;
  })();

  // 20g→30分を基準に比例して上限を伸ばす
  const friendlyCapSec = Math.max(0, Math.round((gramsRecent60 / 20) * 1800));

  // ---------- 時間経過でアルコール減少 ----------
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

  // 秒ごとに再描画（タイマー表示用）
  useEffect(() => {
    const id = setInterval(() => setSecTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // 飲酒処理（履歴に abv/ml を持たせる）
  const addDrink = (label, ml, abv) => {
    // 直前がアルコールならゲート
    if (history[0]?.type === "alcohol") {
      alert("次の一杯の前にソフトドリンクを挟んでください");
      return;
    }

    const vol = Number(ml);
    const pct = Number(abv);
    if (!Number.isFinite(vol) || !Number.isFinite(pct)) return;

    const now = Date.now();
    const grams = vol * (pct / 100) * 0.8;

    setAg((a) => a + grams);
    setLastTs(now);
    setLastAlcoholTs(now);
    setLastDrinkGrams(grams);
    setWaterBonusSec(0);

    setHistory((h) => [
      {
        id: Math.random().toString(36).slice(2),
        ts: now,
        type: "alcohol",
        label,
        abv: pct,
        ml: vol,
      },
      ...h,
    ]);
  };

  // ソフトドリンク処理（必須ウォーターはボーナス無し）
  const addWater = () => {
  const now = Date.now();
  const mandatory = history[0]?.type === "alcohol"; // ← 直前が酒なら必須

  setHistory((h) => [
    { id: Math.random().toString(36).slice(2), ts: now, type: "water", label: "ソフトドリンク/水" },
    ...h,
  ]);

  // 必須ウォーターのときは時短ボーナスを付けない
  if (!mandatory) {
    setWaterBonusSec((s) => s + 600); // 1杯＝600秒（=10分）
  }
   // 必須ウォーター時は派手エフェクトを 1.2 秒だけ出す
 if (mandatory) {
   setWaterFX(true);
   setTimeout(() => setWaterFX(false), 1200);
 }
};

// === ドリンクピッカーを開く/閉じる/確定 ===
const openDrinkPicker = (kind) => {
  if (history[0]?.type === "alcohol") return; // 必須ウォーター中は開かない
  const p = PRESETS[kind]; if (!p) return;

  if (kind === "beer") {
    setPicker({ open:true, kind, label:p.label, ml:p.defaultMl, abv:p.defaultAbv, sizeKey:null, note:"" });
  } else if (kind === "sake") {
    const def = p.sizes[1]; // 既定=一合
    setPicker({ open:true, kind, label:p.label, ml:def.ml, abv:p.defaultAbv, sizeKey:def.k, note:def.label });
  } else if (kind === "cocktail") {
    const def = p.strengths[1]; // 既定=普通
    setPicker({ open:true, kind, label:p.label, ml:p.defaultMl, abv:def.abv, sizeKey:def.key, note:def.note });
  } else if (kind === "chuhai") {
    setPicker({ open:true, kind, label:p.label, ml:p.defaultMl, abv:p.defaultAbv, sizeKey:null, note:"" });
  } else if (kind === "other") {
    setPicker({ open:true, kind, label:p.label, ml:200, abv:8, sizeKey:null, note:"" });
  }
};
const closePicker = () => setPicker((x) => ({ ...x, open:false }));
const confirmPicker = () => {
  const { label, ml, abv } = picker;
  if (!Number.isFinite(Number(ml)) || !Number.isFinite(Number(abv))) return;
  const finalLabel = `${label} ${ml}ml (${abv}%)`;
  addDrink(finalLabel, Number(ml), Number(abv));
  closePicker();
};


  // ---------- 血中濃度とスコア ----------
  const C = useMemo(
    () => (r > 0 && weightKg > 0 ? A_g / (r * weightKg) : 0),
    [A_g, r, weightKg]
  );
  const scoreExact = useMemo(
    () => Math.max(0, Math.min(100, (C / C_AT_100) * 100)),
    [C]
  );
  const score100 = Math.round(scoreExact);

  // 次の一杯OKまで（ベース&ポリシー統合）
  let minCooldownSec = lastAlcoholTs
    ? Math.max(
        0,
        Math.round((lastDrinkGrams / 20) * 1800) -
          Math.floor((Date.now() - lastAlcoholTs) / 1000)
      )
    : 0;

  const baseSec = lastAlcoholTs
    ? Math.round((Math.max(0, lastDrinkGrams) / 20) * 1800)
    : 0;
  const elapsed = lastAlcoholTs
    ? Math.floor((Date.now() - lastAlcoholTs) / 1000)
    : 0;

  // ベース残り（直近一杯由来の残り待ち）
  const remainingBaseSec = Math.max(0, baseSec - Math.max(0, elapsed));
  minCooldownSec = remainingBaseSec;

  // 目標スコアまでの自然減衰時間（残り秒）
  const targetBaseSec = secondsToTarget(A_now, A_target, burnRate);

  // ポリシー: 「minCooldown」以上、「目標まで」「友好的上限」の小さい方以下
  const policyBaseSec = Math.max(
    minCooldownSec,
    Math.min(targetBaseSec, friendlyCapSec)
  );

   // —— ボーナス予算を、消化に応じて減らして適用 ——
 // これまでに消化したベース時間
 const baseConsumedSec = Math.max(0, baseSec - remainingBaseSec);
 // すでに消費済みのボーナス（＝ベース消化ぶんから切り崩された分）
 const bonusConsumedSec = Math.min(waterBonusBudgetSec, baseConsumedSec);
 // 現時点の残りボーナス予算
 const bonusRemainingSec = Math.max(0, waterBonusBudgetSec - bonusConsumedSec);
 // 今フレームで使えるボーナス（ベースの残りと予算の小さい方）
 const bonusUsable = Math.min(bonusRemainingSec, remainingBaseSec);
 // 無条件ボーナス適用（ただし加算は任意ウォーター時のみ）
 const nextOkSec = Math.max(0, policyBaseSec - (waterBonusSec || 0));

  // ---------- ステージ判定 ----------
  const stageInfo = (s) => {
    if (s < 15) return { label: "しらふ", bar: "bg-gray-400" };
    if (s < 45) return { label: "ほろ酔い", bar: "bg-green-500" };
    if (s < 75) return { label: "パーティ", bar: "bg-sky-500" };
    if (s < 90) return { label: "酩酊", bar: "bg-amber-500" };
    return { label: "危険", bar: "bg-red-600" };
  };
  const stage = useMemo(() => stageInfo(score100), [score100]);

  // ---------- フォーマット ----------
  const fmtTime = (ts) => {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  };

  // すべてのステータスをリセット
  const endSession = () => {
    const now = Date.now();
    setAg(0);
    setLastTs(now);
    setHistory([]);
    setWaterBonusSec(0);
    setLastAlcoholTs(0);
    setLastDrinkGrams(0);
    try {
      localStorage.removeItem("alc_Ag");
      localStorage.removeItem("alc_lastTs");
      localStorage.removeItem("alc_hist");
      localStorage.removeItem("alc_lastWater");
      localStorage.removeItem("alc_lastAlcohol");
      localStorage.removeItem("alc_waterBonusSec");
      localStorage.removeItem("alc_lastDrinkGrams");
    } catch (_) {}
    setGoodNightOpen(true); // ← オーバーレイ表示
  };

  // ---------- UI ----------
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50">
      {/* header */}
      <header className="bg-white/70 border-b border-slate-200 w-full">
        <div className="max-w-md mx-auto px-4 py-3 flex justify-between items-center">
          <div className="font-semibold">飲酒管理</div>
          <div className="text-right w-32">
            <div className="text-[10px] text-slate-500">酔い度: {stage.label}</div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1">
              <div className={`h-full ${stage.bar}`} style={{ width: `${scoreExact}%` }} />
            </div>
          </div>
        </div>
      </header>

      {/* main */}
      <main className="w-full max-w-md flex-1 px-4 pt-3 pb-20" // ← pb-20 を足す（高さ≒80px）
      >
        {/* メイン画面 */}
        <section
          className="bg-white rounded-2xl p-4 shadow-sm grid gap-4"
          style={{ display: tab === "main" ? "grid" : "none" }}
        >
          {/* タイマー行 */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold tracking-tight">{fmtMMSS(nextOkSec)}</div>
              {nextOkSec > 0 && (
                <div className="text-[11px] text-slate-500">
                  （{new Date(Date.now() + nextOkSec * 1000).toTimeString().slice(0, 5)} 目安）
                </div>
              )}
              {waterBonusSec > 0 && (
                <div className="text-[11px] text-slate-500">
                  ソフトドリンク効果: -{Math.floor(waterBonusSec / 60)}分
                </div>
              )}
            </div>
            <button
              onClick={addWater}
              className="h-11 px-4 rounded-xl bg-slate-100 font-semibold active:scale-[.98]"
            >
              ソフトドリンク
            </button>
          </div>



          {/* 飲み物ボタン */}
          <div className="grid grid-cols-2 gap-2">
            {/* ビール：350/500/700を選ぶピッカー */}
            <button
              onClick={() => openDrinkPicker("beer")}
              className="h-12 px-4 rounded-xl font-semibold bg-yellow-600 text-white"
            >
              ビール
            </button>

            {/* 酎ハイ：350/500 ＋ 度数1〜9 */}
            <button
              onClick={() => openDrinkPicker("chuhai")}
              className="h-12 px-4 rounded-xl font-semibold bg-cyan-600 text-white"
            >
              酎ハイ
            </button>

            <button
              onClick={() => addDrink("ウイスキー 40ml (40%)", 40, 40)}
              className="h-12 px-4 rounded-xl font-semibold bg-orange-700 text-white"
            >
              ウイスキー
            </button>


            <button
              onClick={() => addDrink("焼酎 90ml (25%)", 90, 25)}
              className="h-12 px-4 rounded-xl font-semibold bg-rose-600 text-white"
            >
              焼酎
            </button>


            {/* 日本酒：お猪口/一合を選ぶピッカー */}
            <button
              onClick={() => openDrinkPicker("sake")}
              className="h-12 px-4 rounded-xl font-semibold bg-emerald-600 text-white"
            >
              日本酒
            </button>

            {/* カクテル：強さ（弱/普/強）＋量スライダー */}
            <button
              onClick={() => openDrinkPicker("cocktail")}
              className="h-12 px-4 rounded-xl font-semibold bg-pink-500 text-white"
            >
              カクテル
            </button>

            {/* ジン／ウォッカ／ラム：固定（量選択なし） */}
            <button
              onClick={() => addDrink("ジン 30ml (40%)", 30, 40)}
              className="h-12 px-4 rounded-xl font-semibold bg-indigo-600 text-white"
            >
              ジン
            </button>
            <button
              onClick={() => addDrink("ウォッカ 30ml (40%)", 30, 40)}
              className="h-12 px-4 rounded-xl font-semibold bg-blue-700 text-white"
            >
              ウォッカ
            </button>
            <button
              onClick={() => addDrink("ラム 30ml (40%)", 30, 40)}
              className="h-12 px-4 rounded-xl font-semibold bg-amber-700 text-white"
            >
              ラム
            </button>

            {/* 既存のクイック追加（ワイン／ウイスキー／焼酎） */}
            <button
              onClick={() => addDrink("ワイン 100ml (12%)", 100, 12)}
              className="h-12 px-4 rounded-xl font-semibold bg-purple-600 text-white"
            >
              ワイン
            </button>

            {/* その他：自由入力ピッカー */}
            <button
              onClick={() => openDrinkPicker("other")}
              className="h-12 px-4 rounded-xl font-semibold bg-slate-500 text-white"
            >
              その他
            </button>

          </div>

        </section>

        {/* 履歴 */}
        <section
          className="bg-white rounded-2xl p-4 shadow-sm"
          style={{ display: tab === "history" ? "block" : "none" }}
        >
          {history.length === 0 ? (
            <div className="text-slate-500">まだ履歴はありません。</div>
          ) : (
            <div className="grid gap-3">
              {history.map((h) => (
                <div key={h.id} className="border rounded-xl p-3">
                  <div className="text-[11px] text-slate-500">{fmtTime(h.ts)}</div>
                  <div className="font-medium text-sm">{h.label}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 設定 */}
        <section
          className="bg-white rounded-2xl p-4 shadow-sm grid gap-4"
          style={{ display: tab === "settings" ? "grid" : "none" }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-slate-500">体重 (kg)</div>
              <input
                className="w-full mt-1 border rounded-xl px-3 h-11"
                type="number"
                min="30"
                max="200"
                value={weightKg}
                onChange={(e) => setWeightKg(Number(e.target.value))}
              />
            </div>
            <div>
              <div className="text-xs text-slate-500">年齢</div>
              <input
                className="w-full mt-1 border rounded-xl px-3 h-11"
                type="number"
                min="16"
                max="99"
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
              />
            </div>
            <div className="col-span-2">
              <div className="text-xs text-slate-500 mb-1">性別</div>
              <div className="flex gap-2">
                {[
                  { id: "male", label: "男性" },
                  { id: "female", label: "女性" },
                  { id: "other", label: "その他" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setSex(opt.id)}
                    className={`h-11 px-3 rounded-xl text-sm font-semibold border active:scale-[.98] ${
                      sex === opt.id ? "bg-slate-900 text-white" : "bg-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-2 mt-2">
            <button
              type="button"
              onClick={endSession}
              className="w-full h-12 px-4 rounded-xl border font-semibold active:scale-[.98]"
            >
              飲み会終了
            </button>
            <div className="text-[10px] text-slate-500">
              すべてのカウント・履歴・タイマーをリセットします
            </div>
          </div>
        </section>
      </main>

      {/* === ゲート用オーバーレイ === */}
      <AnimatePresence>
        {needsWater && (
          <motion.div
            key="gate"
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="bg-white rounded-2xl w-full max-w-xs p-6 text-center shadow-xl"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div className="text-sm text-slate-600 mb-4">
                一杯お酒を飲んだので、次の前にソフトドリンクを挟みましょう。
              </div>

              {/* きらめき＋波紋 */}
              <div className="relative mx-auto grid place-items-center">
                <motion.span
                  className="absolute h-24 w-24 rounded-full"
                  style={{ background: "rgba(59,130,246,0.15)" }}
                  initial={{ scale: 0.9, opacity: 0.6 }}
                  animate={{ scale: 1.8, opacity: 0 }}
                  transition={{ duration: 1.0, repeat: Infinity, repeatDelay: 0.4 }}
                />
                <motion.span
                  className="absolute h-24 w-24 rounded-full"
                  style={{ background: "rgba(59,130,246,0.10)" }}
                  initial={{ scale: 1.0, opacity: 0.5 }}
                  animate={{ scale: 2.1, opacity: 0 }}
                  transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 0.4, delay: 0.15 }}
                />

                <motion.button
                  whileTap={{ scale: 0.9, rotate: 5 }}
                  onClick={addWater}
                  className="relative h-24 w-24 rounded-full bg-slate-900 text-white font-bold shadow-lg grid place-items-center"
                >
                  <span className="text-2xl">💧</span>
                </motion.button>
              </div>

              <div className="mt-3 text-xs text-slate-500">ソフトドリンク</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === 必須ウォーター演出 === */}
<AnimatePresence>
  {waterFX && (
    <motion.div
      key="waterfx"
      className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm grid place-items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="relative w-64 h-64 grid place-items-center"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.25 }}
      >
        {/* 中央の水しぶき */}
        <motion.div
          className="h-28 w-28 rounded-full bg-sky-500 shadow-2xl grid place-items-center text-white"
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 15 }}
        >
          <span className="text-5xl">💧</span>
        </motion.div>

        {/* 波紋 */}
        <motion.span
          className="absolute h-36 w-36 rounded-full"
          style={{ background: "rgba(59,130,246,0.25)" }}
          initial={{ scale: 0.8, opacity: 0.7 }}
          animate={{ scale: 1.8, opacity: 0 }}
          transition={{ duration: 1.0, repeat: Infinity, repeatDelay: 0.1 }}
        />
        <motion.span
          className="absolute h-44 w-44 rounded-full"
          style={{ background: "rgba(59,130,246,0.18)" }}
          initial={{ scale: 0.9, opacity: 0.6 }}
          animate={{ scale: 2.2, opacity: 0 }}
          transition={{ duration: 1.1, repeat: Infinity, repeatDelay: 0.1, delay: 0.15 }}
        />

        {/* コンフェッティ風の飛び散り */}
        {[...Array(12)].map((_, i) => (
          <motion.span
            key={i}
            className="absolute h-2 w-2 rounded-full bg-white/90"
            initial={{ x: 0, y: 0, opacity: 1 }}
            animate={{
              x: Math.cos((i / 12) * Math.PI * 2) * 130,
              y: Math.sin((i / 12) * Math.PI * 2) * 130,
              opacity: 0,
            }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
        ))}

        {/* テキスト */}
        <motion.div
          className="absolute bottom-4 text-white font-semibold drop-shadow"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.25 }}
        >
          いいチョイス！
        </motion.div>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>

{/* === Drink Picker === */}
<AnimatePresence>
  {picker.open && (
    <motion.div
      key="picker"
      className="fixed inset-0 z-[65] bg-black/40 backdrop-blur-sm grid place-items-end sm:place-items-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={closePicker}
    >
      <motion.div
        className="w-full sm:w-[420px] rounded-t-3xl sm:rounded-2xl bg-white p-5 shadow-2xl"
        initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
        transition={{ duration: 0.2 }} onClick={(e) => e.stopPropagation()}
      >
        <div className="font-bold text-lg">{picker.label}</div>

        {/* beer: 量を選ぶ */}
        {picker.kind === "beer" && (
          <div className="mt-3 grid gap-3">
            <div className="text-xs text-slate-500">量（ml）</div>
            <div className="flex flex-wrap gap-2">
              {PRESETS.beer.sizes.map((v) => (
                <button key={v}
                  onClick={() => setPicker((p)=>({ ...p, ml:v }))}
                  className={`h-10 px-3 rounded-xl border font-semibold ${picker.ml===v?"bg-slate-900 text-white":"bg-white"}`}>
                  {v}ml
                </button>
              ))}
            </div>
            <div className="text-sm text-slate-600">選択: {picker.ml}ml（度数 {picker.abv}%）</div>
          </div>
        )}

        {/* sake: お猪口/一合 */}
        {picker.kind === "sake" && (
          <div className="mt-3 grid gap-3">
            <div className="text-xs text-slate-500">量（お猪口 / 一合）</div>
            <div className="flex flex-wrap gap-2">
              {PRESETS.sake.sizes.map((s)=>(
                <button key={s.k}
                  onClick={() => setPicker((p)=>({ ...p, sizeKey:s.k, ml:s.ml, note:s.label }))}
                  className={`h-10 px-3 rounded-xl border font-semibold ${picker.sizeKey===s.k?"bg-slate-900 text-white":"bg-white"}`}>
                  {s.label}
                </button>
              ))}
            </div>
            <div className="text-sm text-slate-600">選択: {picker.note}（度数 {picker.abv}%）</div>
          </div>
        )}

        {/* cocktail: 強さ（度数） */}
        {picker.kind === "cocktail" && (
          <div className="mt-3 grid gap-3">
            <div className="text-xs text-slate-500">強さ</div>
            <div className="flex flex-wrap gap-2">
              {COCKTAIL_STRENGTHS.map((s)=>(
                <button key={s.key}
                  onClick={() => setPicker((p)=>({ ...p, sizeKey:s.key, abv:s.abv, note:s.note }))}
                  className={`h-10 px-3 rounded-xl border font-semibold ${picker.sizeKey===s.key?"bg-slate-900 text-white":"bg-white"}`}>
                  {s.label}
                </button>
              ))}
            </div>
            <div className="text-sm text-slate-600">{picker.note}</div>
            <div className="text-xs text-slate-500">量（ml）</div>
            <input type="range" min="100" max="400" step="25" value={picker.ml}
              onChange={(e)=>setPicker((p)=>({ ...p, ml:Number(e.target.value) }))}
              className="w-full" />
            <div className="text-sm text-slate-600">選択: {picker.ml}ml（度数 {picker.abv}%）</div>
          </div>
        )}

        {/* chuhai: サイズ + 度数 1〜9 */}
        {picker.kind === "chuhai" && (
          <div className="mt-3 grid gap-4">
            <div>
              <div className="text-xs text-slate-500">量（ml）</div>
              <div className="flex gap-2">
                {PRESETS.chuhai.sizes.map((v)=>(
                  <button key={v}
                    onClick={()=>setPicker((p)=>({ ...p, ml:v }))}
                    className={`h-10 px-3 rounded-xl border font-semibold ${picker.ml===v?"bg-slate-900 text-white":"bg-white"}`}>
                    {v}ml
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">度数（1〜9%）</div>
              <input type="range" min={PRESETS.chuhai.abvMin} max={PRESETS.chuhai.abvMax} step="1"
                value={picker.abv}
                onChange={(e)=>setPicker((p)=>({ ...p, abv:Number(e.target.value) }))}
                className="w-full" />
              <div className="text-sm text-slate-600">選択: {picker.abv}%</div>
            </div>
          </div>
        )}

        {/* other: 自由入力 */}
        {picker.kind === "other" && (
  <div className="mt-3 grid gap-4">
    <div>
      <div className="text-xs text-slate-500">量（ml）</div>
      <input
        type="range"
        min={PRESETS.other.mlMin}
        max={PRESETS.other.mlMax}
        step={PRESETS.other.mlStep}
        value={picker.ml}
        onChange={(e)=>setPicker((p)=>({ ...p, ml:Number(e.target.value) }))}
        className="w-full"
      />
      <div className="text-sm text-slate-600">選択: {picker.ml}ml</div>
    </div>

    <div>
      <div className="text-xs text-slate-500">度数（%）</div>
      <input
        type="range"
        min={PRESETS.other.abvMin}
        max={PRESETS.other.abvMax}
        step={PRESETS.other.abvStep}
        value={picker.abv}
        onChange={(e)=>setPicker((p)=>({ ...p, abv:Number(e.target.value) }))}
        className="w-full"
      />
      <div className="text-sm text-slate-600">選択: {picker.abv}%</div>
    </div>

    <div className="text-[11px] text-slate-500">
      例: 250ml / 7%（缶サワー・自作カクテルなど）
    </div>
  </div>
)}


        <div className="mt-5 grid grid-cols-2 gap-2">
          <button onClick={closePicker} className="h-11 rounded-xl border font-semibold active:scale-[.98]">キャンセル</button>
          <button onClick={confirmPicker} className="h-11 rounded-xl bg-slate-900 text-white font-semibold active:scale-[.98]">追加</button>
        </div>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>


{/* === Good Night Overlay === */}
<AnimatePresence>
  {goodNightOpen && (
    <motion.div
      key="goodnight"
      className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm grid place-items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={() => setGoodNightOpen(false)} // 外側タップでも閉じる
    >
      <motion.div
        className="relative w-[88vw] max-w-xs rounded-3xl bg-white/95 shadow-2xl px-6 py-8 text-center select-none"
        initial={{ scale: 0.95, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.98, opacity: 0, y: 6 }}
        transition={{ duration: 0.25 }}
        onClick={() => setGoodNightOpen(false)} // カード本体タップでも閉じる
       role="button"
       tabIndex={0}
       onKeyDown={(e) => {
         if (e.key === "Enter" || e.key === " ") setGoodNightOpen(false);
         if (e.key === "Escape") setGoodNightOpen(false);
       }}
      >
        <motion.div
          className="text-6xl mb-2"
          initial={{ rotate: -8 }}
          animate={{ rotate: [ -8, 8, -8 ] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        >
          😴
        </motion.div>
        <div className="text-xl font-bold tracking-tight">おやすみなさい</div>
        <div className="text-[12px] text-slate-500 mt-1">タップで閉じる</div>

        {/* ふわっと光る円 */}
        <motion.span
          className="absolute -z-10 inset-0 m-auto h-48 w-48 rounded-full"
          style={{ background: "radial-gradient(closest-side, rgba(59,130,246,.18), transparent)" }}
          initial={{ scale: 0.9, opacity: 0.7 }}
          animate={{ scale: [0.9, 1.1, 0.9], opacity: [0.7, 0.4, 0.7] }}
          transition={{ duration: 2.2, repeat: Infinity }}
        />
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>



{/* footer */}
<nav
  className="fixed bottom-0 inset-x-0 z-50
             border-t border-slate-200 bg-white/95 backdrop-blur"
>
  <div className="max-w-md mx-auto grid grid-cols-3 h-16 px-2"
       style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
    {["main", "history", "settings"].map((t) => (
      <button
        key={t}
        onClick={() => setTab(t)}
        className={`flex flex-col items-center justify-center gap-0.5 ${
          tab === t ? "text-slate-900" : "text-slate-400"
        }`}
      >
        <span className="text-[11px] font-medium">
          {t === "main" ? "メイン" : t === "history" ? "履歴" : "設定"}
        </span>
      </button>
    ))}
  </div>
</nav>

    </div>
  );
}
