// ===================================================
// 遊戯王マスターデュエル カウンター
// 古代決闘石板 - カスタム石板ドロップダウン＆テーマ削除管理
// ===================================================

// 初期テーマリスト（指定の13テーマ）
const INITIAL_THEMES = [
  "ブラックマジシャン",
  "青眼の白龍",
  "ウィッチクラフト",
  "ブリッツクリーク",
  "ドラゴンテイル",
  "六花",
  "ゴブリンライダー",
  "ヘカトンケイル",
  "巳剣",
  "烙印",
  "獄神",
  "ヤミー",
  "道化の一座"
];

// 五十音順ソート用の読み仮名辞書
const KANA_MAP = {
  "ウィッチクラフト": "うぃっちくらふと",
  "ゴブリンライダー": "ごぶりんらいだー",
  "獄神": "ごくしん",
  "ドラゴンテイル": "どらごんている",
  "道化の一座": "どうけのいちざ",
  "ブラックマジシャン": "ぶらっくまじしゃん",
  "ブリッツクリーク": "ぶりっつくりーく",
  "青眼の白龍": "ぶるーあいずほわいとどらごん",
  "ヘカトンケイル": "へかとんけいる",
  "巳剣": "みけん",
  "ヤミー": "やみー",
  "烙印": "らくいん",
  "六花": "りっか"
};

const STORAGE_KEYS = {
  FIREBASE_CONFIG: "yugioh_firebase_config_v1",
  LOCAL_DUELS: "yugioh_local_duels_backup_v1",
  CUSTOM_THEMES: "yugioh_custom_themes_v3",
  LAST_MY_DECK: "yugioh_last_my_deck_v1",
  APP_SKIN: "yugioh_app_skin_v1"
};

// アプリ状態
const state = {
  coin: "heads",
  turn: "first",
  result: "win",
  myDeck: "",
  opponentDeck: "",
  selectedFilterDeck: "__ALL__",
  isFirebaseActive: false,
  firestore: null,
  unsubscribeSnapshot: null,
  records: [],
  themes: [],
  deckStats: []
};

const elements = {
  // ステータス & 設定
  connectionStatusPill: document.getElementById("connection-status-pill"),
  statusDot: document.getElementById("status-dot"),
  statusText: document.getElementById("status-text"),
  btnOpenSyncSettings: document.getElementById("btn-open-sync-settings"),

  // モーダル
  syncModal: document.getElementById("sync-modal"),
  btnCloseModal: document.getElementById("btn-close-modal"),
  settingFirebaseConfig: document.getElementById("setting-firebase-config"),
  btnSaveFirebase: document.getElementById("btn-save-firebase"),
  btnDisconnectFirebase: document.getElementById("btn-disconnect-firebase"),

  // カスタムドロップダウン (マイデッキ & 相手デッキ)
  dropdownMyDeck: document.getElementById("dropdown-my-deck"),
  labelMyDeck: document.getElementById("label-my-deck"),
  menuMyDeck: document.getElementById("menu-my-deck"),

  dropdownOppDeck: document.getElementById("dropdown-opp-deck"),
  labelOppDeck: document.getElementById("label-opp-deck"),
  menuOppDeck: document.getElementById("menu-opp-deck"),

  // テーマ追加・削除マネージャー
  btnToggleThemeManager: document.getElementById("btn-toggle-theme-manager"),
  themeManagerPanel: document.getElementById("theme-manager-panel"),
  newThemeInput: document.getElementById("new-theme-input"),
  btnAddTheme: document.getElementById("btn-add-theme"),
  themeTagsContainer: document.getElementById("theme-tags-container"),
  btnResetThemes: document.getElementById("btn-reset-themes"),

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
  allWinRateLabel: document.getElementById("all-win-rate-label"),
  allCoinRate: document.getElementById("all-coin-rate"),
  allCoinDetail: document.getElementById("all-coin-detail"),
  allFirstRate: document.getElementById("all-first-rate"),
  allFirstDetail: document.getElementById("all-first-detail"),

  // 通年フィルターカスタムドロップダウン
  dropdownFilterDeck: document.getElementById("dropdown-filter-deck"),
  labelFilterDeck: document.getElementById("label-filter-deck"),
  menuFilterDeck: document.getElementById("menu-filter-deck"),

  // 相手デッキ別一覧テーブル
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
  initSkin();
  loadThemes();
  setupToggleButtons();
  setupThemeManager();
  setupCustomDropdowns();
  setupActionButtons();
  setupModal();

  // Firebase接続試行
  await initFirebase();
});

// スキン（テーマ）の初期化と切り替え
function initSkin() {
  const skinSelect = document.getElementById("skin-select");
  const savedSkin = localStorage.getItem(STORAGE_KEYS.APP_SKIN) || "egypt";

  document.body.setAttribute("data-theme", savedSkin);
  if (skinSelect) {
    skinSelect.value = savedSkin;
    skinSelect.addEventListener("change", () => {
      const chosen = skinSelect.value;
      document.body.setAttribute("data-theme", chosen);
      localStorage.setItem(STORAGE_KEYS.APP_SKIN, chosen);
      showToast(`スキンを「${skinSelect.options[skinSelect.selectedIndex].text}」に切り替えました！`);
    });
  }
}

function initServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

// ===================================================
// テーマ管理 ＆ 五十音順ソートエンジン
// ===================================================
function loadThemes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_THEMES);
    if (raw) {
      state.themes = JSON.parse(raw);
    } else {
      state.themes = [...INITIAL_THEMES];
    }
  } catch (e) {
    state.themes = [...INITIAL_THEMES];
  }
  sortThemesGojuon();
}

function saveThemes() {
  localStorage.setItem(STORAGE_KEYS.CUSTOM_THEMES, JSON.stringify(state.themes));
}

function sortThemesGojuon() {
  const getSortKey = (name) => KANA_MAP[name] || name;
  state.themes.sort((a, b) => getSortKey(a).localeCompare(getSortKey(b), "ja"));
}

function setupThemeManager() {
  // パネル開閉
  elements.btnToggleThemeManager.addEventListener("click", () => {
    const isHidden = elements.themeManagerPanel.style.display === "none";
    elements.themeManagerPanel.style.display = isHidden ? "block" : "none";
    elements.btnToggleThemeManager.textContent = isHidden ? "✕ 編集を閉じる" : "✏️ テーマの追加・削除";
    if (isHidden) {
      elements.newThemeInput.focus();
      renderThemeTags();
    }
  });

  // 新規追加
  elements.btnAddTheme.addEventListener("click", () => {
    const name = elements.newThemeInput.value.trim();
    if (!name) return;
    if (state.themes.includes(name)) {
      alert("そのテーマは既に登録されています。");
      return;
    }
    state.themes.push(name);
    sortThemesGojuon();
    saveThemes();

    elements.newThemeInput.value = "";
    // 追加したテーマを相手デッキにセット
    state.opponentDeck = name;
    updateDropdownLabels();
    renderAllDropdownMenus();
    renderThemeTags();
    showToast(`「${name}」を追加しました！`);
  });

  elements.newThemeInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      elements.btnAddTheme.click();
    }
  });

  // 初期テーマにリセット
  elements.btnResetThemes.addEventListener("click", () => {
    if (!confirm("テーマ一覧を初期の13テーマにリセットしますか？")) return;
    state.themes = [...INITIAL_THEMES];
    sortThemesGojuon();
    saveThemes();

    if (!state.themes.includes(state.myDeck)) state.myDeck = state.themes[0];
    if (!state.themes.includes(state.opponentDeck)) state.opponentDeck = state.themes[0];

    updateDropdownLabels();
    renderAllDropdownMenus();
    renderThemeTags();
    showToast("初期テーマ一覧にリセットしました。");
  });
}

// テーマ削除用タグの描画
function renderThemeTags() {
  elements.themeTagsContainer.innerHTML = "";
  if (state.themes.length === 0) {
    elements.themeTagsContainer.innerHTML = '<span style="font-size:11px; color:var(--papyrus-muted); padding:4px;">テーマがありません。上の枠から追加してください。</span>';
    return;
  }

  state.themes.forEach(theme => {
    const tag = document.createElement("span");
    tag.className = "theme-tag";
    tag.style.cssText = "background: linear-gradient(180deg, #332619 0%, #1d160e 100%) !important; border: 1px solid #d4af37 !important; color: #ffdf78 !important;";
    tag.innerHTML = `
      <span>${escapeHtml(theme)}</span>
      <button type="button" class="btn-tag-delete" title="「${escapeHtml(theme)}」を削除">✕</button>
    `;

    tag.querySelector(".btn-tag-delete").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteTheme(theme);
    });

    elements.themeTagsContainer.appendChild(tag);
  });
}

// テーマの削除
function deleteTheme(themeName) {
  if (state.themes.length <= 1) {
    alert("テーマは最低1つ以上必要です。");
    return;
  }

  state.themes = state.themes.filter(t => t !== themeName);
  saveThemes();

  // 選択中だった場合のフォールバック
  if (state.myDeck === themeName) state.myDeck = state.themes[0];
  if (state.opponentDeck === themeName) state.opponentDeck = state.themes[0];

  updateDropdownLabels();
  renderAllDropdownMenus();
  renderThemeTags();
  showToast(`「${themeName}」を削除しました。`);
}

// ===================================================
// カスタム石板ドロップダウンの制御
// ===================================================
function setupCustomDropdowns() {
  // 初期値の復元
  const lastMy = localStorage.getItem(STORAGE_KEYS.LAST_MY_DECK);
  state.myDeck = (lastMy && state.themes.includes(lastMy)) ? lastMy : (state.themes[0] || "");
  state.opponentDeck = state.themes[1] || state.themes[0] || "";

  updateDropdownLabels();
  renderAllDropdownMenus();

  // クリック時の開閉イベント
  setupSingleDropdown(elements.dropdownMyDeck);
  setupSingleDropdown(elements.dropdownOppDeck);
  setupSingleDropdown(elements.dropdownFilterDeck);

  // 画面外クリックで閉じる
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".custom-dropdown")) {
      closeAllDropdowns();
    }
  });
}

function setupSingleDropdown(dropdownEl) {
  const trigger = dropdownEl.querySelector(".dropdown-trigger");
  const menu = dropdownEl.querySelector(".dropdown-menu");

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = menu.style.display === "block" || dropdownEl.classList.contains("open");
    closeAllDropdowns();
    if (!isOpen) {
      dropdownEl.classList.add("open");
      menu.style.display = "block";
    }
  });
}

function closeAllDropdowns() {
  document.querySelectorAll(".custom-dropdown").forEach(d => {
    d.classList.remove("open");
    const menu = d.querySelector(".dropdown-menu");
    if (menu) menu.style.display = "none";
  });
}

function updateDropdownLabels() {
  elements.labelMyDeck.textContent = state.myDeck || "選択してください";
  elements.labelOppDeck.textContent = state.opponentDeck || "選択してください";

  if (state.selectedFilterDeck === "__ALL__") {
    elements.labelFilterDeck.textContent = "すべての使用デッキ (全体通算)";
  } else {
    elements.labelFilterDeck.textContent = `👑 ${state.selectedFilterDeck} の成績`;
  }
}

function renderAllDropdownMenus() {
  // 1. マイデッキメニュー
  elements.menuMyDeck.innerHTML = state.themes.map(t => {
    const isSelected = t === state.myDeck ? "selected" : "";
    return `<div class="dropdown-item ${isSelected}" data-value="${escapeHtml(t)}">${escapeHtml(t)}</div>`;
  }).join("");

  elements.menuMyDeck.querySelectorAll(".dropdown-item").forEach(item => {
    item.addEventListener("click", () => {
      state.myDeck = item.dataset.value;
      localStorage.setItem(STORAGE_KEYS.LAST_MY_DECK, state.myDeck);
      updateDropdownLabels();
      renderAllDropdownMenus();
      closeAllDropdowns();
    });
  });

  // 2. 相手デッキメニュー
  elements.menuOppDeck.innerHTML = state.themes.map(t => {
    const isSelected = t === state.opponentDeck ? "selected" : "";
    return `<div class="dropdown-item ${isSelected}" data-value="${escapeHtml(t)}">${escapeHtml(t)}</div>`;
  }).join("");

  elements.menuOppDeck.querySelectorAll(".dropdown-item").forEach(item => {
    item.addEventListener("click", () => {
      state.opponentDeck = item.dataset.value;
      updateDropdownLabels();
      renderAllDropdownMenus();
      closeAllDropdowns();
    });
  });

  // 3. 通年フィルターメニュー
  renderFilterDropdownMenu();
}

function renderFilterDropdownMenu() {
  const usedDecks = new Set();
  state.records.forEach(r => {
    if (r.my_deck) usedDecks.add(r.my_deck);
  });

  const getSortKey = (name) => KANA_MAP[name] || name;
  const sortedUsed = Array.from(usedDecks).sort((a, b) => getSortKey(a).localeCompare(getSortKey(b), "ja"));

  let itemsHtml = `
    <div class="dropdown-item ${state.selectedFilterDeck === '__ALL__' ? 'selected' : ''}" data-value="__ALL__">
      すべての使用デッキ (全体通算)
    </div>
  `;

  sortedUsed.forEach(d => {
    const isSelected = d === state.selectedFilterDeck ? "selected" : "";
    itemsHtml += `
      <div class="dropdown-item ${isSelected}" data-value="${escapeHtml(d)}">
        👑 ${escapeHtml(d)} の成績
      </div>
    `;
  });

  elements.menuFilterDeck.innerHTML = itemsHtml;
  elements.menuFilterDeck.querySelectorAll(".dropdown-item").forEach(item => {
    item.addEventListener("click", () => {
      state.selectedFilterDeck = item.dataset.value;
      updateDropdownLabels();
      renderFilterDropdownMenu();
      closeAllDropdowns();
      updateAllDisplays();
    });
  });
}

// ===================================================
// Firebase Firestore 初期化 & リアルタイム同期
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

    subscribeFirestoreDuels();

  } catch (e) {
    console.error("Firebase init error:", e);
    setOfflineMode("Firebase接続エラー (設定を確認してください)");
    loadLocalFallbackData();
  }
}

function subscribeFirestoreDuels() {
  if (state.unsubscribeSnapshot) state.unsubscribeSnapshot();

  state.unsubscribeSnapshot = state.firestore
    .collection("duels")
    .orderBy("timestamp", "desc")
    .onSnapshot((snapshot) => {
      const records = [];
      snapshot.forEach((doc) => {
        records.push({ id: doc.id, ...doc.data() });
      });

      state.records = records;
      localStorage.setItem(STORAGE_KEYS.LOCAL_DUELS, JSON.stringify(records));
      updateAllDisplays();
      renderFilterDropdownMenu();
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

function loadLocalFallbackData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LOCAL_DUELS);
    state.records = raw ? JSON.parse(raw) : [];
  } catch (e) {
    state.records = [];
  }
  updateAllDisplays();
  renderFilterDropdownMenu();
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

  elements.deckFilterInput.addEventListener("input", renderDeckStatsTable);
  elements.deckSortSelect.addEventListener("change", renderDeckStatsTable);
}

// ===================================================
// アクションボタン設定
// ===================================================
function setupActionButtons() {
  elements.btnRecord.addEventListener("click", recordDuel);
  elements.btnExportCsv.addEventListener("click", exportCsv);

  elements.btnSampleData.addEventListener("click", async () => {
    if (!confirm("テスト用のサンプル対戦記録（10戦分）を追加しますか？")) return;
    await addSampleData();
  });

  elements.btnClearData.addEventListener("click", async () => {
    if (!confirm("⚠️ 本当にすべての決闘記録を初期化しますか？\nこの操作は元に戻せません。")) return;
    await clearAllData();
  });
}

// モーダル設定
function setupModal() {
  elements.btnOpenSyncSettings.addEventListener("click", () => {
    elements.syncModal.style.display = "flex";
  });
  elements.btnCloseModal.addEventListener("click", () => {
    elements.syncModal.style.display = "none";
  });
  elements.syncModal.addEventListener("click", (e) => {
    if (e.target === elements.syncModal) elements.syncModal.style.display = "none";
  });

  elements.btnSaveFirebase.addEventListener("click", async () => {
    let raw = elements.settingFirebaseConfig.value.trim();
    if (!raw) return alert("Firebase設定を貼り付けてください。");

    try {
      let config = null;
      if (raw.includes("{") && raw.includes("}")) {
        const objStr = raw.substring(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
        try {
          config = new Function("return (" + objStr + ")")();
        } catch (e1) {
          const fixedJson = objStr
            .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2": ')
            .replace(/'/g, '"');
          config = JSON.parse(fixedJson);
        }
      } else {
        config = JSON.parse(raw);
      }

      localStorage.setItem(STORAGE_KEYS.FIREBASE_CONFIG, JSON.stringify(config));
      showToast("Firebase設定を保存しました。再接続します...");
      elements.syncModal.style.display = "none";
      await initFirebase();
    } catch (err) {
      alert("JSONの解析に失敗しました。正しいコードを貼り付けてください。");
    }
  });

  elements.btnDisconnectFirebase.addEventListener("click", () => {
    if (!confirm("Firebase同期を切断し、ローカルモードに戻しますか？")) return;
    localStorage.removeItem(STORAGE_KEYS.FIREBASE_CONFIG);
    if (state.unsubscribeSnapshot) state.unsubscribeSnapshot();
    state.isFirebaseActive = false;
    setOfflineMode("ローカル保存モード (Firebase切断済)");
    elements.syncModal.style.display = "none";
    showToast("Firebaseを切断しました。");
  });
}

// ===================================================
// 決闘記録の送信 (自分の使用デッキを含めて保存)
// ===================================================
async function recordDuel() {
  const myDeck = state.myDeck || "未設定";
  const oppDeck = state.opponentDeck || "不明/その他";
  const now = new Date();
  const timestamp = formatDateTime(now);
  const dateStr = formatDate(now);

  const record = {
    my_deck: myDeck,
    opponent_deck: oppDeck,
    coin: state.coin,
    turn: state.turn,
    result: state.result,
    timestamp: timestamp,
    date: dateStr,
    note: "",
    createdAt: Date.now()
  };

  try {
    elements.btnRecord.disabled = true;

    if (state.isFirebaseActive && state.firestore) {
      await state.firestore.collection("duels").add(record);
      showToast(`「${myDeck}」vs「${oppDeck}」（${record.result === 'win' ? '勝利' : '敗北'}）をクラウドに刻みました！`);
    } else {
      record.id = "local_" + Date.now();
      state.records.unshift(record);
      localStorage.setItem(STORAGE_KEYS.LOCAL_DUELS, JSON.stringify(state.records));
      showToast(`「${myDeck}」vs「${oppDeck}」をローカル石板に刻みました！`);
      updateAllDisplays();
    }

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
    alert("削除中にエラーが発生しました。");
  }
};

// ===================================================
// 統計計算と画面更新 (マイデッキ絞り込み対応)
// ===================================================
function updateAllDisplays() {
  const todayStr = formatDate(new Date());
  elements.todayDateBadge.textContent = todayStr;

  // 当日の戦績: 自身の使用デッキは反映させず全体のまま
  const todayRows = state.records.filter(r => (r.date || r.date_str) === todayStr);

  // 通年の戦績: 選択されたマイデッキで絞り込み
  let allRows = [...state.records];
  if (state.selectedFilterDeck !== "__ALL__") {
    allRows = allRows.filter(r => r.my_deck === state.selectedFilterDeck);
    elements.allWinRateLabel.textContent = `「${state.selectedFilterDeck}」通算勝率`;
  } else {
    elements.allWinRateLabel.textContent = "通算勝率 (全体)";
  }

  const stats = {
    today_date: todayStr,
    all_time: calculateStats(allRows),
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
    elements.historyTbody.innerHTML = `<tr class="empty-row"><td colspan="7">まだ決闘の記録がありません。</td></tr>`;
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
    const myDeckText = d.my_deck || "未設定";

    return `
      <tr>
        <td><span class="badge-tag">${timeStr}</span></td>
        <td><span class="badge-tag" style="color:var(--gold-bright);">👑 ${escapeHtml(myDeckText)}</span></td>
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

// サンプルデータ追加 (マイデッキ付き)
async function addSampleData() {
  const todayStr = formatDate(new Date());
  const samples = [
    { my_deck: "ブラックマジシャン", opponent_deck: "青眼の白龍", coin: "heads", turn: "first", result: "win" },
    { my_deck: "ブラックマジシャン", opponent_deck: "烙印", coin: "heads", turn: "first", result: "win" },
    { my_deck: "ブラックマジシャン", opponent_deck: "獄神", coin: "tails", turn: "second", result: "lose" },
    { my_deck: "青眼の白龍", opponent_deck: "ウィッチクラフト", coin: "heads", turn: "first", result: "win" },
    { my_deck: "青眼の白龍", opponent_deck: "ゴブリンライダー", coin: "tails", turn: "second", result: "win" },
    { my_deck: "青眼の白龍", opponent_deck: "巳剣", coin: "heads", turn: "first", result: "lose" },
    { my_deck: "六花", opponent_deck: "ヤミー", coin: "heads", turn: "first", result: "win" },
    { my_deck: "六花", opponent_deck: "ドラゴンテイル", coin: "tails", turn: "second", result: "win" },
    { my_deck: "ブリッツクリーク", opponent_deck: "ヘカトンケイル", coin: "heads", turn: "first", result: "win" },
    { my_deck: "ブリッツクリーク", opponent_deck: "道化の一座", coin: "tails", turn: "second", result: "lose" }
  ];

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const rec = {
      ...s,
      timestamp: formatDateTime(new Date(Date.now() - (samples.length - i) * 60000)),
      date: todayStr,
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

function exportCsv() {
  if (state.records.length === 0) return alert("エクスポートする記録がありません。");
  let csv = "\uFEFF日時,日付,自分の使用デッキ,コイントス,先攻後攻,対戦相手デッキ,勝敗\n";
  state.records.forEach(r => {
    const coin = r.coin === "heads" ? "表" : "裏";
    const turn = r.turn === "first" ? "先攻" : "後攻";
    const res = r.result === "win" ? "勝利" : "敗北";
    const myDeck = r.my_deck || "未設定";
    csv += `"${r.timestamp}","${r.date || r.date_str}","${myDeck}","${coin}","${turn}","${r.opponent_deck}","${res}"\n`;
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
