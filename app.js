// ===================================================
// 遊戯王マスターデュエル カウンター
// 古代決闘石板 - Firebase Firestore クラウド自動同期
// ===================================================

const DEFAULT_POPULAR_DECKS = [
  "スネークアイ", "粛声", "ユベル", "天盃龍", "ラビュリンス",
  "神碑", "R-ACE", "ティアラメンツ", "烙印", "センチュリオン",
  "キマイラ", "クシャトリラ", "ピュアリィ", "ドラゴンリンク",
  "ふわんだりぃず", "御巫", "青眼の白龍", "ブラック・マジシャン"
];

const STORAGE_KEYS = {
  FIREBASE_CONFIG: "yugioh_firebase_config_v1",
  LOCAL_DUELS: "yugioh_local_duels_backup_v1"
};

// アプリ状態
const state = {
  coin: "heads",
  turn: "first",
  result: "win",
  deck: "",
  isFirebaseActive: false,
  firestore: null,
  unsubscribeSnapshot: null,
  records: [],
  deckStats: [],
  knownDecks: new Set(DEFAULT_POPULAR_DECKS)
};

const elements = {
  // ステータス & 設定
  connectionStatusPill: document.getElementById("connection-status-pill"),
  statusDot: document.getElementById("status-dot"),
  statusText: document.getElementById("status-text"),
  syncBanner: document.getElementById("sync-banner"),
  btnOpenSyncSettings: document.getElementById("btn-open-sync-settings"),

  // モーダル
  syncModal: document.getElementById("sync-modal"),
  btnCloseModal: document.getElementById("btn-close-modal"),
  settingFirebaseConfig: document.getElementById("setting-firebase-config"),
  btnSaveFirebase: document.getElementById("btn-save-firebase"),
  btnDisconnectFirebase: document.getElementById("btn-disconnect-firebase"),
  firebaseStatusMsg: document.getElementById("firebase-status-msg"),

  // 入力フォーム
  deckInput: document.getElementById("deck-input"),
  deckSuggestions: document.getElementById("deck-suggestions"),
  quickDeckChips: document.getElementById("quick-deck-chips"),
  btnClearDeck: document.getElementById("btn-clear-deck"),
  btnRecord: document.getElementById("btn-record"),
  toastMessage: document.getElementById("toast-message"),

  // 当日統計
  todayDateBadge: document.getElementById("today-date-badge"),
  todayTotalDuels: document.getElementById("today-total-duels"),
  todayWinRate: document.getElementById("today-win-rate"),
  todayWinDetail: document.getElementById("today-win-detail"),
  todayCoinRate: document.getElementById("today-coin-rate"),
  todayCoinDetail: document.getElementById("today-coin-detail"),
  todayFirstRate: document.getElementById("today-first-rate"),
  todayFirstDetail: document.getElementById("today-first-detail"),
  todayFirstWinRate: document.getElementById("today-first-win-rate"),
  todaySecondWinRate: document.getElementById("today-second-win-rate"),

  // 通算統計
  allTotalDuels: document.getElementById("all-total-duels"),
  allWinRate: document.getElementById("all-win-rate"),
  allWinDetail: document.getElementById("all-win-detail"),
  allCoinRate: document.getElementById("all-coin-rate"),
  allCoinDetail: document.getElementById("all-coin-detail"),
  allFirstRate: document.getElementById("all-first-rate"),
  allFirstDetail: document.getElementById("all-first-detail"),

  // デッキ別テーブル・コントロール
  deckFilterInput: document.getElementById("deck-filter-input"),
  deckSortSelect: document.getElementById("deck-sort-select"),
  deckStatsTbody: document.getElementById("deck-stats-tbody"),

  // 履歴
  historyTbody: document.getElementById("history-tbody"),
  btnExportCsv: document.getElementById("btn-export-csv"),
  btnSampleData: document.getElementById("btn-sample-data"),
  btnClearData: document.getElementById("btn-clear-data")
};

// ===================================================
// 初期化
// ===================================================
document.addEventListener("DOMContentLoaded", async () => {
  initServiceWorker();
  setupToggleButtons();
  setupDeckInputs();
  setupActionButtons();
  setupModal();

  // Firebaseの初期化を試行
  await initFirebase();
});

// PWA Service Worker 登録
function initServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

// ===================================================
// Firebase Firestore の初期化 & リアルタイム同期
// ===================================================
async function initFirebase() {
  const savedConfig = localStorage.getItem(STORAGE_KEYS.FIREBASE_CONFIG);
  if (!savedConfig) {
    setOfflineMode("ローカル保存モード (Firebase未設定)");
    loadLocalFallbackData();
    return;
  }

  try {
    const config = JSON.parse(savedConfig);
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }

    state.firestore = firebase.firestore();

    // オフラインキャッシュ有効化 (ネットが切れてもスマホ内に保存・復帰時自動同期)
    try {
      await state.firestore.enablePersistence({ synchronizeTabs: true });
    } catch (err) {
      console.warn("Firestore persistence warning:", err.code);
    }

    state.isFirebaseActive = true;
    elements.statusDot.className = "status-indicator online";
    elements.statusText.textContent = "☁️ Firebaseクラウド同期中";
    elements.btnDisconnectFirebase.style.display = "inline-block";
    elements.settingFirebaseConfig.value = JSON.stringify(config, null, 2);

    // リアルタイムリスナー起動 (端末間で勝率・履歴が瞬時に自動同期)
    subscribeFirestoreDuels();

  } catch (e) {
    console.error("Firebase init error:", e);
    setOfflineMode("Firebase接続エラー (設定を確認してください)");
    loadLocalFallbackData();
  }
}

function subscribeFirestoreDuels() {
  if (state.unsubscribeSnapshot) {
    state.unsubscribeSnapshot();
  }

  state.unsubscribeSnapshot = state.firestore
    .collection("duels")
    .orderBy("timestamp", "desc")
    .onSnapshot((snapshot) => {
      const records = [];
      snapshot.forEach((doc) => {
        records.push({ id: doc.id, ...doc.data() });
      });

      state.records = records;
      // 既知デッキ更新
      records.forEach(r => {
        if (r.opponent_deck) state.knownDecks.add(r.opponent_deck);
      });
      renderDeckChips();

      // ローカルバックアップ保存
      localStorage.setItem(STORAGE_KEYS.LOCAL_DUELS, JSON.stringify(records));

      // 画面更新
      updateAllDisplays();
    }, (error) => {
      console.error("Firestore onSnapshot error:", error);
    });
}

function setOfflineMode(message) {
  state.isFirebaseActive = false;
  elements.statusDot.className = "status-indicator offline";
  elements.statusText.textContent = message;
  elements.btnDisconnectFirebase.style.display = "none";
}

// Firebase未設定時のローカルデータ読み込み
function loadLocalFallbackData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LOCAL_DUELS);
    state.records = raw ? JSON.parse(raw) : [];
  } catch (e) {
    state.records = [];
  }
  state.records.forEach(r => {
    if (r.opponent_deck) state.knownDecks.add(r.opponent_deck);
  });
  renderDeckChips();
  updateAllDisplays();
}

// ===================================================
// トグルボタン処理
// ===================================================
function setupToggleButtons() {
  document.querySelectorAll(".btn-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const groupName = btn.dataset.name;
      const value = btn.dataset.value;
      document.querySelectorAll(`.btn-toggle[data-name="${groupName}"]`).forEach(b => {
        b.classList.remove("active");
      });
      btn.classList.add("active");
      state[groupName] = value;
    });
  });
}

// ===================================================
// デッキ入力＆チップ設定
// ===================================================
function setupDeckInputs() {
  renderDeckChips();

  elements.btnClearDeck.addEventListener("click", () => {
    elements.deckInput.value = "";
    elements.deckInput.focus();
  });

  elements.deckFilterInput.addEventListener("input", renderDeckStatsTable);
  elements.deckSortSelect.addEventListener("change", renderDeckStatsTable);
}

function renderDeckChips() {
  elements.quickDeckChips.innerHTML = "";
  const allDecks = Array.from(state.knownDecks);
  allDecks.slice(0, 16).forEach(deckName => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip-btn";
    chip.textContent = deckName;
    chip.addEventListener("click", () => {
      elements.deckInput.value = deckName;
      elements.deckInput.focus();
    });
    elements.quickDeckChips.appendChild(chip);
  });

  elements.deckSuggestions.innerHTML = "";
  allDecks.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d;
    elements.deckSuggestions.appendChild(opt);
  });
}

// ===================================================
// アクションボタン設定
// ===================================================
function setupActionButtons() {
  elements.btnRecord.addEventListener("click", recordDuel);

  // CSVエクスポート
  elements.btnExportCsv.addEventListener("click", exportCsv);

  // サンプルデータ
  elements.btnSampleData.addEventListener("click", async () => {
    if (!confirm("テスト用のサンプル対戦記録（10戦分）を石板に追加しますか？")) return;
    await addSampleData();
  });

  // 全消去
  elements.btnClearData.addEventListener("click", async () => {
    if (!confirm("⚠️ 本当にすべての決闘記録を初期化しますか？\nこの操作は元に戻せません。")) return;
    await clearAllData();
  });
}

// モーダル設定 (Firebase連携)
function setupModal() {
  elements.btnOpenSyncSettings.addEventListener("click", () => {
    elements.syncModal.style.display = "flex";
  });
  elements.btnCloseModal.addEventListener("click", () => {
    elements.syncModal.style.display = "none";
  });
  elements.syncModal.addEventListener("click", (e) => {
    if (e.target === elements.syncModal) {
      elements.syncModal.style.display = "none";
    }
  });

  // Firebase設定の保存
  elements.btnSaveFirebase.addEventListener("click", async () => {
    let raw = elements.settingFirebaseConfig.value.trim();
    if (!raw) {
      alert("Firebase設定を貼り付けてください。");
      return;
    }

    try {
      let config = null;

      // 方法1: JavaScriptオブジェクト表記 (const firebaseConfig = { ... };) を安全に評価
      if (raw.includes("{") && raw.includes("}")) {
        const objStr = raw.substring(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
        try {
          config = new Function("return (" + objStr + ")")();
        } catch (e1) {
          // 方法2: 通常のJSONパース
          const fixedJson = objStr
            .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2": ')
            .replace(/'/g, '"');
          config = JSON.parse(fixedJson);
        }
      } else {
        config = JSON.parse(raw);
      }

      if (!config || !config.projectId) {
        throw new Error("無効な設定オブジェクトです");
      }

      localStorage.setItem(STORAGE_KEYS.FIREBASE_CONFIG, JSON.stringify(config));
      showToast("Firebase設定を保存しました。再接続します...");
      elements.syncModal.style.display = "none";
      await initFirebase();
    } catch (err) {
      console.error("Firebase config parse error:", err);
      alert("Firebase設定の解析に失敗しました。下の回答に記載されている整形済みJSONコードを貼り付けてみてください。");
    }
  });

  // Firebase切断
  elements.btnDisconnectFirebase.addEventListener("click", () => {
    if (!confirm("Firebaseクラウド同期を切断し、ローカルモードに戻しますか？")) return;
    localStorage.removeItem(STORAGE_KEYS.FIREBASE_CONFIG);
    if (state.unsubscribeSnapshot) state.unsubscribeSnapshot();
    state.isFirebaseActive = false;
    setOfflineMode("ローカル保存モード (Firebase切断済)");
    elements.syncModal.style.display = "none";
    showToast("Firebaseを切断しました。");
  });
}

// ===================================================
// 決闘記録の送信 (Firebase自動同期 / ローカル自動保存)
// ===================================================
async function recordDuel() {
  const deck = elements.deckInput.value.trim() || "不明/その他";
  const now = new Date();
  const timestamp = formatDateTime(now);
  const dateStr = formatDate(now);

  const record = {
    timestamp: timestamp,
    date: dateStr,
    coin: state.coin,
    turn: state.turn,
    opponent_deck: deck,
    result: state.result,
    note: "",
    createdAt: Date.now()
  };

  try {
    elements.btnRecord.disabled = true;

    if (state.isFirebaseActive && state.firestore) {
      // Firebase Firestoreへ保存 (オフラインでも自動キャッシュされ復帰時自動送信！)
      await state.firestore.collection("duels").add(record);
      showToast(`「${deck}」との決闘（${record.result === 'win' ? '勝利' : '敗北'}）をクラウドに刻みました！`);
    } else {
      // ローカルモード
      record.id = "local_" + Date.now();
      state.records.unshift(record);
      localStorage.setItem(STORAGE_KEYS.LOCAL_DUELS, JSON.stringify(state.records));
      showToast(`「${deck}」との決闘をローカル石板に刻みました！`);
      updateAllDisplays();
    }

    state.knownDecks.add(deck);
    renderDeckChips();
    elements.deckInput.value = "";
    elements.deckInput.focus();

  } catch (err) {
    console.error("Record duel error:", err);
    alert("記録中にエラーが発生しました。");
  } finally {
    elements.btnRecord.disabled = false;
  }
}

// レコード削除
window.deleteDuelRecord = async function(id) {
  if (!confirm("この対戦記録を石板から抹消しますか？")) return;

  try {
    if (state.isFirebaseActive && state.firestore) {
      await state.firestore.collection("duels").doc(id).delete();
      showToast("クラウドから記録を抹消しました。");
    } else {
      state.records = state.records.filter(r => r.id !== id);
      localStorage.setItem(STORAGE_KEYS.LOCAL_DUELS, JSON.stringify(state.records));
      showToast("記録を抹消しました。");
      updateAllDisplays();
    }
  } catch (err) {
    console.error("Delete duel error:", err);
    alert("削除中にエラーが発生しました。");
  }
};

// ===================================================
// 統計計算と画面更新
// ===================================================
function updateAllDisplays() {
  const todayStr = formatDate(new Date());
  elements.todayDateBadge.textContent = todayStr;

  const todayRows = state.records.filter(r => (r.date || r.date_str) === todayStr);

  const stats = {
    today_date: todayStr,
    all_time: calculateStats(state.records),
    today: calculateStats(todayRows)
  };

  renderStats(stats);
  renderHistoryTable(state.records.slice(0, 50));
}

function calculateStats(rows) {
  const total = rows.length;
  if (total === 0) {
    return {
      total_duels: 0, wins: 0, losses: 0, win_rate: 0.0,
      coin_heads: 0, coin_tails: 0, coin_heads_rate: 0.0,
      first_turns: 0, second_turns: 0, first_turn_rate: 0.0,
      first_win_rate: 0.0, second_win_rate: 0.0,
      deck_stats: []
    };
  }

  const wins = rows.filter(r => r.result === "win").length;
  const losses = total - wins;
  const win_rate = round((wins / total) * 100, 1);

  const coin_heads = rows.filter(r => r.coin === "heads").length;
  const coin_tails = total - coin_heads;
  const coin_heads_rate = round((coin_heads / total) * 100, 1);

  const first_turns = rows.filter(r => r.turn === "first").length;
  const second_turns = total - first_turns;
  const first_turn_rate = round((first_turns / total) * 100, 1);

  const first_wins = rows.filter(r => r.turn === "first" && r.result === "win").length;
  const first_win_rate = first_turns > 0 ? round((first_wins / first_turns) * 100, 1) : 0.0;

  const second_wins = rows.filter(r => r.turn === "second" && r.result === "win").length;
  const second_win_rate = second_turns > 0 ? round((second_wins / second_turns) * 100, 1) : 0.0;

  const decks_map = {};
  rows.forEach(r => {
    const d = r.opponent_deck || "不明/その他";
    if (!decks_map[d]) {
      decks_map[d] = { deck: d, total: 0, wins: 0, losses: 0 };
    }
    decks_map[d].total += 1;
    if (r.result === "win") decks_map[d].wins += 1;
    else decks_map[d].losses += 1;
  });

  const deck_stats = Object.values(decks_map).map(st => ({
    ...st,
    win_rate: round((st.wins / st.total) * 100, 1)
  }));
  deck_stats.sort((a, b) => b.total - a.total || b.win_rate - a.win_rate);

  return {
    total_duels: total, wins, losses, win_rate,
    coin_heads, coin_tails, coin_heads_rate,
    first_turns, second_turns, first_turn_rate,
    first_win_rate, second_win_rate,
    deck_stats
  };
}

function renderStats(data) {
  // 当日
  const today = data.today;
  elements.todayTotalDuels.textContent = today.total_duels;
  elements.todayWinRate.textContent = `${today.win_rate}%`;
  elements.todayWinDetail.textContent = `${today.wins}勝 ${today.losses}敗`;
  elements.todayCoinRate.textContent = `${today.coin_heads_rate}%`;
  elements.todayCoinDetail.textContent = `表 ${today.coin_heads}回 / 裏 ${today.coin_tails}回`;
  elements.todayFirstRate.textContent = `${today.first_turn_rate}%`;
  elements.todayFirstDetail.textContent = `先攻 ${today.first_turns}回 / 後攻 ${today.second_turns}回`;
  elements.todayFirstWinRate.textContent = `${today.first_win_rate}%`;
  elements.todaySecondWinRate.textContent = `${today.second_win_rate}%`;

  // 通年
  const all = data.all_time;
  elements.allTotalDuels.textContent = all.total_duels;
  elements.allWinRate.textContent = `${all.win_rate}%`;
  elements.allWinDetail.textContent = `${all.wins}勝 ${all.losses}敗`;
  elements.allCoinRate.textContent = `${all.coin_heads_rate}%`;
  elements.allCoinDetail.textContent = `表 ${all.coin_heads} / 裏 ${all.coin_tails}`;
  elements.allFirstRate.textContent = `${all.first_turn_rate}%`;
  elements.allFirstDetail.textContent = `先 ${all.first_turns} / 後 ${all.second_turns}`;

  state.deckStats = all.deck_stats || [];
  renderDeckStatsTable();
}

function renderDeckStatsTable() {
  const filter = elements.deckFilterInput.value.trim().toLowerCase();
  const sortMode = elements.deckSortSelect.value;

  let list = [...state.deckStats];
  if (filter) list = list.filter(item => item.deck.toLowerCase().includes(filter));

  if (sortMode === "duels_desc") list.sort((a, b) => b.total - a.total || b.win_rate - a.win_rate);
  else if (sortMode === "winrate_desc") list.sort((a, b) => b.win_rate - a.win_rate || b.total - a.total);
  else if (sortMode === "winrate_asc") list.sort((a, b) => a.win_rate - b.win_rate || b.total - a.total);
  else if (sortMode === "name_asc") list.sort((a, b) => a.deck.localeCompare(b.deck));

  if (list.length === 0) {
    elements.deckStatsTbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="5">${filter ? "該当するデッキは見つかりませんでした。" : "まだ対戦記録がありません。"}</td>
      </tr>
    `;
    return;
  }

  elements.deckStatsTbody.innerHTML = list.map(item => {
    let rateClass = "mid";
    if (item.win_rate >= 60.0) rateClass = "high";
    else if (item.win_rate <= 40.0) rateClass = "low";

    return `
      <tr>
        <td><strong>${escapeHtml(item.deck)}</strong></td>
        <td class="td-center">${item.total} 試合</td>
        <td class="td-center">${item.wins}勝 - ${item.losses}敗</td>
        <td class="td-center"><span class="rate-badge ${rateClass}">${item.win_rate}%</span></td>
        <td>
          <div class="gauge-bar-wrapper">
            <div class="gauge-fill" style="width: ${item.win_rate}%"></div>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function renderHistoryTable(duels) {
  if (!duels || duels.length === 0) {
    elements.historyTbody.innerHTML = `<tr class="empty-row"><td colspan="6">まだ決闘の記録がありません。</td></tr>`;
    return;
  }

  elements.historyTbody.innerHTML = duels.map(d => {
    const isWin = d.result === "win";
    const resultBadge = isWin
      ? '<span class="badge-result win">VICTORY (勝利)</span>'
      : '<span class="badge-result lose">DEFEAT (敗北)</span>';
    
    const coinText = d.coin === "heads" ? "🪙 表" : "🪙 裏";
    const turnText = d.turn === "first" ? "⚔️ 先攻" : "🛡️ 後攻";
    const timeStr = (d.timestamp || "").substring(5, 16);

    return `
      <tr>
        <td><span class="badge-tag">${timeStr}</span></td>
        <td>${resultBadge}</td>
        <td>${coinText}</td>
        <td>${turnText}</td>
        <td><strong>${escapeHtml(d.opponent_deck)}</strong></td>
        <td class="td-center">
          <button type="button" class="btn-delete-row" onclick="deleteDuelRecord('${d.id}')" title="この記録を削除">
            削除
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

// サンプルデータ追加
async function addSampleData() {
  const todayStr = formatDate(new Date());
  const samples = [
    { coin: "heads", turn: "first", opponent_deck: "スネークアイ", result: "win" },
    { coin: "heads", turn: "first", opponent_deck: "粛声", result: "win" },
    { coin: "tails", turn: "second", opponent_deck: "天盃龍", result: "lose" },
    { coin: "heads", turn: "first", opponent_deck: "ユベル", result: "win" },
    { coin: "tails", turn: "second", opponent_deck: "ラビュリンス", result: "win" },
    { coin: "heads", turn: "first", opponent_deck: "神碑", result: "lose" },
    { coin: "heads", turn: "first", opponent_deck: "センチュリオン", result: "win" },
    { coin: "tails", turn: "second", opponent_deck: "R-ACE", result: "win" },
    { coin: "heads", turn: "first", opponent_deck: "ティアラメンツ", result: "win" },
    { coin: "tails", turn: "second", opponent_deck: "スネークアイ", result: "lose" }
  ];

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const rec = {
      timestamp: formatDateTime(new Date(Date.now() - (samples.length - i) * 60000)),
      date: todayStr,
      ...s,
      note: "",
      createdAt: Date.now() - (samples.length - i) * 60000
    };

    if (state.isFirebaseActive && state.firestore) {
      await state.firestore.collection("duels").add(rec);
    } else {
      rec.id = "sample_" + Date.now() + "_" + i;
      state.records.unshift(rec);
    }
  }

  if (!state.isFirebaseActive) {
    localStorage.setItem(STORAGE_KEYS.LOCAL_DUELS, JSON.stringify(state.records));
    updateAllDisplays();
  }
  showToast("サンプルデータ（10戦分）を追加しました！");
}

// 全データ初期化
async function clearAllData() {
  if (state.isFirebaseActive && state.firestore) {
    const snapshot = await state.firestore.collection("duels").get();
    const batch = state.firestore.batch();
    snapshot.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    showToast("クラウドの全データを初期化しました。");
  } else {
    state.records = [];
    localStorage.removeItem(STORAGE_KEYS.LOCAL_DUELS);
    updateAllDisplays();
    showToast("ローカルデータを初期化しました。");
  }
}

// CSVエクスポート
function exportCsv() {
  if (state.records.length === 0) {
    alert("エクスポートする記録がありません。");
    return;
  }
  let csv = "\uFEFF日時,日付,コイントス,先攻後攻,対戦相手デッキ,勝敗\n";
  state.records.forEach(r => {
    const coin = r.coin === "heads" ? "表" : "裏";
    const turn = r.turn === "first" ? "先攻" : "後攻";
    const res = r.result === "win" ? "勝利" : "敗北";
    csv += `"${r.timestamp}","${r.date || r.date_str}","${coin}","${turn}","${r.opponent_deck}","${res}"\n`;
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `遊戯王決闘記録_${formatDate(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function showToast(msg) {
  elements.toastMessage.textContent = msg;
  elements.toastMessage.className = "toast-message success";
  clearTimeout(elements.toastMessage._timer);
  elements.toastMessage._timer = setTimeout(() => {
    elements.toastMessage.style.display = "none";
  }, 3500);
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateTime(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}

function round(val, precision) {
  const factor = Math.pow(10, precision);
  return Math.round(val * factor) / factor;
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
