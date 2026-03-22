const STORAGE_KEY = "describer-state-v1";
const SpeechRecognitionApi =
  window.SpeechRecognition || window.webkitSpeechRecognition || null;
const synth = window.speechSynthesis || null;

const todayPrompt = {
  date: "2026-03-20",
  title: "Describe this street market.",
  image:
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
  alt: "A bright morning market street with fruit stands and people walking",
  easy:
    "This picture shows a busy street market in the morning. I can see many people walking between the stalls. Some sellers are standing near fresh fruit and vegetables. The street looks colorful, busy, and full of energy. There are many small details that make the scene interesting to describe. Overall, it feels like a lively place where people are shopping and talking.",
  advanced:
    "Today I would describe a busy street market filled with people, color, and movement. The first thing I notice is that the street is full of activity from one side to the other. Several people are walking through the market and looking at the goods on display. Some sellers seem to be standing near fresh fruit and vegetables, ready to help customers. In the middle of the scene, the market feels open, bright, and easy to observe. In the background, the street continues and gives the picture more depth. The colors make the whole place look warm and lively without feeling too crowded. This kind of scene is useful for speaking practice because there are people, objects, and actions to describe. I can also talk about the mood, which seems friendly and active. If I were giving a short presentation, I would say this picture shows everyday life in a very clear way. Overall, it is a detailed image that gives the speaker many ideas to talk about.",
  keywords: ["market", "vendor", "fresh produce", "crowded", "lively", "atmosphere"],
};

const wordLibrary = {
  seller: {
    phonetic: "/ˈsel.ər/",
    meaning: "someone whose job is selling products",
    example: "The seller is standing beside the fruit baskets.",
  },
  lively: {
    phonetic: "/ˈlaɪv.li/",
    meaning: "full of energy, movement, and excitement",
    example: "The market looks lively because many people are shopping.",
  },
  market: {
    phonetic: "/ˈmɑːr.kɪt/",
    meaning: "a place where people buy and sell goods",
    example: "This market is busy in the morning.",
  },
  vendor: {
    phonetic: "/ˈven.dər/",
    meaning: "a person selling items, often in a public place",
    example: "A vendor is arranging fruit on the stand.",
  },
  "fresh produce": {
    phonetic: "/freʃ ˈproʊ.duːs/",
    meaning: "fresh fruits and vegetables",
    example: "The stand is full of fresh produce.",
  },
  crowded: {
    phonetic: "/ˈkraʊ.dɪd/",
    meaning: "full of many people in one place",
    example: "The street feels crowded but cheerful.",
  },
  atmosphere: {
    phonetic: "/ˈæt.mə.sfɪr/",
    meaning: "the general feeling or mood of a place",
    example: "The atmosphere is warm and inviting.",
  },
};

const seedHistory = [
  {
    id: "hist-1",
    date: "2026-03-18",
    title: "Cafe conversation",
    summary: "You described relationships, body language, and a relaxed indoor atmosphere.",
    score: 89,
    image:
      "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "hist-2",
    date: "2026-03-17",
    title: "Beach sunset",
    summary: "Practice focused on scenery words, emotions, and fluid spoken descriptions.",
    score: 91,
    image:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "hist-3",
    date: "2026-03-16",
    title: "Library study hour",
    summary: "Good correction set for singular/plural grammar and clearer pronunciation.",
    score: 87,
    image:
      "https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "hist-4",
    date: "2026-02-24",
    title: "Rainy city walk",
    summary: "Focused on weather vocabulary, movement verbs, and clearer speaking.",
    score: 89,
    image:
      "https://images.unsplash.com/photo-1519692933481-e162a57d6721?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "hist-5",
    date: "2026-02-10",
    title: "Cooking at home",
    summary: "Practiced food descriptions, actions in progress, and sentence linking.",
    score: 86,
    image:
      "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "hist-6",
    date: "2026-01-28",
    title: "Station commute",
    summary: "Good practice for travel expressions, location words, and pronunciation.",
    score: 88,
    image:
      "https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=800&q=80",
  },
];

function createWord(word, savedAt, rightCount = 0, wrongCount = 0) {
  const details = lookupWordEntry(word);
  return {
    word,
    savedAt,
    rightCount,
    wrongCount,
    ...details,
  };
}

function createDefaultState() {
  return {
    transcript: "",
    feedback: createEmptyFeedback(),
    readingList: [],
    speakingList: [],
    history: [],
    review: {
      readingActive: false,
      readingQueue: [],
      readingIndex: 0,
      readingChoice: null,
      readingPending: null,
      speakingActive: false,
      speakingQueue: [],
      speakingIndex: 0,
      speakingAttempt: "",
      speakingStatus: "Ready",
      speakingJudged: false,
    },
  };
}

let state = createDefaultState();
let selectedWord = null;
let selectedWordElement = null;
let historyFilterMode = "all";
let historyYear = todayPrompt.date.slice(0, 4);
let historyMonth = todayPrompt.date.slice(5, 7);
let historyPage = 1;
let readingPage = 1;
let speakingPage = 1;
let selectedHistoryIds = new Set();
let currentFilteredHistoryIds = [];
let historyCardMode = "full";
let selectedReadingWordIds = new Set();
let selectedSpeakingWordIds = new Set();
let currentFilteredReadingWords = [];
let currentFilteredSpeakingWords = [];
let activeTodayHistoryId = null;
let todayLiveSnapshot = null;
const pageSize = 3;
const liteListPageSize = 10;
const fullListPageSize = 3;
let activeRecognition = null;
let recognitionMode = null;
let apiConfigured = false;
let mediaRecorder = null;
let recordingMode = null;
let dailyAudioBlob = null;
let speakingAudioBlob = null;
let micPermissionGranted = false;
let playbackAudio = null;
let playbackAudioUrl = null;
let isTodayRecording = false;
let isTodayTranscriptProcessing = false;
let todayTranscribeRequestId = 0;
let todayAutoSubmitRequested = false;
let todayPracticeFinished = false;
let speakingReviewAutoJudgeRequested = false;
let isSpeakingReviewProcessing = false;
let activeHistoryPreviewId = null;
let readingSessionResults = new Map();
let speakingSessionResults = new Map();
let reviewSummary = null;
let speakingListPractice = {
  word: null,
  attempt: "",
  judged: false,
  score: null,
};
let speakingListAudioBlob = null;
let speakingListAutoJudgeRequested = false;
let isSpeakingListProcessing = false;

const elements = {
  views: {
    today: document.getElementById("view-today"),
    history: document.getElementById("view-history"),
    vocabulary: document.getElementById("view-vocabulary"),
    speaking: document.getElementById("view-speaking"),
    settings: document.getElementById("view-settings"),
  },
  todayDate: document.getElementById("today-date"),
  backToTodayButton: document.getElementById("back-to-today"),
  dailyImage: document.getElementById("daily-image"),
  dailyPromptTitle: document.getElementById("daily-prompt-title"),
  startSpeakingButton: document.getElementById("start-speaking-button"),
  finishSpeakingButton: document.getElementById("finish-speaking-button"),
  transcriptText: document.getElementById("transcript-text"),
  transcriptProcessing: document.getElementById("transcript-processing"),
  testMicButton: document.getElementById("test-mic-button"),
  restartSpeakingButton: document.getElementById("restart-speaking-button"),
  playOriginalSpeakingButton: document.getElementById("play-original-speaking"),
  micTestResult: document.getElementById("mic-test-result"),
  feedbackOriginalTranscript: document.getElementById("feedback-original-transcript"),
  grammarSentences: document.getElementById("grammar-sentences"),
  pronunciationFlags: document.getElementById("pronunciation-flags"),
  modelEasyText: document.getElementById("model-easy-text"),
  modelAdvancedText: document.getElementById("model-advanced-text"),
  modelToggleRow: document.getElementById("model-toggle-row"),
  modelLockedNote: document.getElementById("model-locked-note"),
  aiSuggestionScore: document.getElementById("ai-suggestion-score"),
  aiSuggestionText: document.getElementById("ai-suggestion-text"),
  keywordGrid: document.getElementById("keyword-grid"),
  recentSavedList: document.getElementById("recent-saved-list"),
  historySearch: document.getElementById("history-search"),
  historyDate: document.getElementById("history-date"),
  selectAllHistoryButton: document.getElementById("select-all-history"),
  exportHistoryButton: document.getElementById("export-history"),
  historyAllButton: document.getElementById("history-all-button"),
  historyMonthModeButton: document.getElementById("history-month-mode"),
  historyDateModeButton: document.getElementById("history-date-mode"),
  historyMonthControls: document.getElementById("history-month-controls"),
  historyDateControls: document.getElementById("history-date-controls"),
  historyYear: document.getElementById("history-year"),
  historyMonth: document.getElementById("history-month"),
  monthSessionCount: document.getElementById("month-session-count"),
  historyGrid: document.getElementById("history-grid"),
  deleteAllHistory: document.getElementById("delete-all-history"),
  historyPrev: document.getElementById("history-prev"),
  historyNext: document.getElementById("history-next"),
  historyPageStatus: document.getElementById("history-page-status"),
  vocabularySearch: document.getElementById("vocabulary-search"),
  vocabularySort: document.getElementById("vocabulary-sort"),
  selectAllReadingButton: document.getElementById("select-all-reading"),
  exportReadingButton: document.getElementById("export-reading"),
  deleteSelectedReadingButton: document.getElementById("delete-selected-reading"),
  vocabularyLiteList: document.getElementById("vocabulary-lite-list"),
  vocabularyFullPanel: document.getElementById("vocabulary-full-panel"),
  vocabularyPrev: document.getElementById("vocabulary-prev"),
  vocabularyNext: document.getElementById("vocabulary-next"),
  vocabularyPageStatus: document.getElementById("vocabulary-page-status"),
  speakingSearch: document.getElementById("speaking-search"),
  speakingSort: document.getElementById("speaking-sort"),
  selectAllSpeakingButton: document.getElementById("select-all-speaking"),
  exportSpeakingButton: document.getElementById("export-speaking"),
  deleteSelectedSpeakingButton: document.getElementById("delete-selected-speaking"),
  speakingLiteList: document.getElementById("speaking-lite-list"),
  speakingFullPanel: document.getElementById("speaking-full-panel"),
  speakingPrev: document.getElementById("speaking-prev"),
  speakingNext: document.getElementById("speaking-next"),
  speakingPageStatus: document.getElementById("speaking-page-status"),
  readingReviewCount: document.getElementById("review-word-count"),
  startReadingReview: document.getElementById("start-reading-review"),
  finishReadingReview: document.getElementById("finish-reading-review"),
  readingReviewCard: document.getElementById("reading-review-card"),
  reviewYes: document.getElementById("review-yes"),
  reviewNo: document.getElementById("review-no"),
  readingReviewWrong: document.getElementById("reading-review-wrong"),
  readingReviewProgress: document.getElementById("reading-review-progress"),
  readingReviewWord: document.getElementById("reading-review-word"),
  readingReviewPhonetic: document.getElementById("reading-review-phonetic"),
  readingReviewAudio: document.getElementById("reading-review-audio"),
  readingReviewMeaningPanel: document.getElementById("review-meaning-panel"),
  readingReviewMeaning: document.getElementById("reading-review-meaning"),
  readingReviewExample: document.getElementById("reading-review-example"),
  readingReviewPrev: document.getElementById("reading-review-prev"),
  readingReviewNext: document.getElementById("reading-review-next"),
  speakingReviewCount: document.getElementById("speaking-review-count"),
  startSpeakingSession: document.getElementById("start-speaking-session"),
  finishSpeakingSession: document.getElementById("finish-speaking-session"),
  speakingReviewCard: document.getElementById("speaking-review-card"),
  speakingReviewProgress: document.getElementById("speaking-review-progress"),
  speakingReviewWord: document.getElementById("speaking-review-word"),
  speakingReviewAudio: document.getElementById("speaking-review-audio"),
  speakingPhonetic: document.getElementById("speaking-phonetic"),
  speakingResult: document.getElementById("speaking-review-result"),
  speakingMemoryLine: document.getElementById("speaking-memory-line"),
  speakingMeaning: document.getElementById("speaking-review-meaning"),
  speakingExample: document.getElementById("speaking-review-example"),
  startSpeakingReview: document.getElementById("start-speaking-review"),
  runAiJudge: document.getElementById("run-ai-judge"),
  retrySpeakingReview: document.getElementById("retry-speaking-review"),
  originalSpeakingReview: document.getElementById("original-speaking-review"),
  speakingReviewPrev: document.getElementById("speaking-review-prev"),
  speakingReviewNext: document.getElementById("speaking-review-next"),
  drawer: document.getElementById("word-drawer"),
  drawerWord: document.getElementById("drawer-word"),
  drawerAudio: document.getElementById("drawer-audio"),
  drawerPhonetic: document.getElementById("drawer-phonetic"),
  drawerMeaning: document.getElementById("drawer-meaning"),
  drawerExample: document.getElementById("drawer-example"),
  closeDrawer: document.getElementById("close-drawer"),
  addReading: document.getElementById("add-vocabulary"),
  addSpeaking: document.getElementById("add-speaking"),
  historyPreviewBackdrop: document.getElementById("history-preview-backdrop"),
  historyPreview: document.getElementById("history-preview"),
  historyPreviewImage: document.getElementById("history-preview-image"),
  historyPreviewDate: document.getElementById("history-preview-date"),
  historyPreviewTitle: document.getElementById("history-preview-title"),
  historyPreviewSummary: document.getElementById("history-preview-summary"),
  historyPreviewOriginal: document.getElementById("history-preview-original"),
  historyPreviewCorrected: document.getElementById("history-preview-corrected"),
  openHistoryDetails: document.getElementById("open-history-details"),
  closeHistoryPreview: document.getElementById("close-history-preview"),
  deleteHistoryEntry: document.getElementById("delete-history-entry"),
  reviewSummaryBackdrop: document.getElementById("review-summary-backdrop"),
  reviewSummaryModal: document.getElementById("review-summary-modal"),
  reviewSummaryType: document.getElementById("review-summary-type"),
  reviewSummaryRight: document.getElementById("review-summary-right"),
  reviewSummaryWrong: document.getElementById("review-summary-wrong"),
  reviewSummaryRate: document.getElementById("review-summary-rate"),
  closeReviewSummary: document.getElementById("close-review-summary"),
  shortcutToast: document.getElementById("shortcut-toast"),
};

function saveState() {
  return state;
}

async function checkApiHealth() {
  try {
    const response = await fetch("/api/health");
    const data = await response.json();
    apiConfigured = Boolean(data.configured);
  } catch {
    apiConfigured = false;
  }
}

async function loadBootstrap() {
  try {
    const response = await fetch("/api/bootstrap");
    if (!response.ok) return;
    const data = await response.json();
    apiConfigured = Boolean(data.configured);
    if (data.todayPrompt) {
      Object.assign(todayPrompt, data.todayPrompt);
      todayPrompt.easy = ensureExampleVariant(todayPrompt.easy, "easy", todayPrompt);
      todayPrompt.advanced = ensureExampleVariant(todayPrompt.advanced, "advanced", todayPrompt);
    }
    if (Array.isArray(data.readingList)) state.readingList = data.readingList;
    if (Array.isArray(data.speakingList)) state.speakingList = data.speakingList;
    if (Array.isArray(data.history)) state.history = data.history;
    state.feedback = normalizeFeedback(state.feedback);
  } catch {
    apiConfigured = false;
  }
}

function formatDateLabel(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatHistoryMonthLabel(year, month) {
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function buildHistoryYearOptions() {
  const historyYears = state.history
    .map((entry) => Number(String(entry.date || "").slice(0, 4)))
    .filter((value) => Number.isFinite(value));
  const todayYear = Number(todayPrompt.date.slice(0, 4));
  const minYear = Math.min(...historyYears, todayYear - 1);
  const maxYear = Math.max(...historyYears, todayYear + 4);
  const years = [];
  for (let year = maxYear; year >= minYear; year -= 1) years.push(String(year));
  return years;
}

function renderHistoryFilterControls() {
  const yearOptions = buildHistoryYearOptions();
  if (!yearOptions.includes(historyYear)) {
    historyYear = yearOptions[0] || todayPrompt.date.slice(0, 4);
  }

  elements.historyYear.innerHTML = yearOptions
    .map((year) => `<option value="${year}">${year}</option>`)
    .join("");
  elements.historyYear.value = historyYear;
  elements.historyMonth.value = historyMonth;
  elements.historyAllButton.classList.toggle("is-active", historyFilterMode === "all");
  elements.historyMonthModeButton.classList.toggle("is-active", historyFilterMode === "month");
  elements.historyDateModeButton.classList.toggle("is-active", historyFilterMode === "date");
  elements.historyMonthControls.classList.toggle("is-hidden", historyFilterMode !== "month");
  elements.historyDateControls.classList.toggle("is-hidden", historyFilterMode !== "date");
  document.querySelectorAll("[data-history-card-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.historyCardMode === historyCardMode);
  });
}

function clearHistorySelection() {
  selectedHistoryIds.clear();
}

function getSelectedHistoryIds() {
  return [...selectedHistoryIds].filter((id) => state.history.some((entry) => entry.id === id));
}

function toggleHistorySelection(id, checked) {
  if (checked) selectedHistoryIds.add(id);
  else selectedHistoryIds.delete(id);
  renderHistory();
}

function areAllFilteredHistorySelected() {
  return (
    currentFilteredHistoryIds.length > 0 &&
    currentFilteredHistoryIds.every((id) => selectedHistoryIds.has(id))
  );
}

function selectAllFilteredHistory() {
  if (!currentFilteredHistoryIds.length) {
    showToast("No history in this view.");
    return;
  }
  if (areAllFilteredHistorySelected()) {
    currentFilteredHistoryIds.forEach((id) => selectedHistoryIds.delete(id));
  } else {
    currentFilteredHistoryIds.forEach((id) => selectedHistoryIds.add(id));
  }
  renderHistory();
}

function getWordListLabel(listName) {
  return listName === "reading" ? "Reading" : "Speaking";
}

function getWordListKey(listName) {
  return listName === "reading" ? "readingList" : "speakingList";
}

function getActiveWordMode(listName) {
  return document.getElementById(`${listName}-lite-panel`)?.classList.contains("is-visible")
    ? "lite"
    : "full";
}

function getSelectedWordSet(listName) {
  return listName === "reading" ? selectedReadingWordIds : selectedSpeakingWordIds;
}

function setCurrentFilteredWords(listName, words) {
  if (listName === "reading") currentFilteredReadingWords = words;
  else currentFilteredSpeakingWords = words;
}

function getCurrentFilteredWords(listName) {
  return listName === "reading" ? currentFilteredReadingWords : currentFilteredSpeakingWords;
}

function getFilteredHistoryEntries() {
  const query = elements.historySearch.value.trim().toLowerCase();
  const dateValue = elements.historyDate.value;
  const monthKey = `${historyYear}-${historyMonth}`;

  return state.history.filter((entry) => {
    const haystack = `${entry.title} ${entry.summary} ${entry.date}`.toLowerCase();
    const matchesSearch = !query || haystack.includes(query);
    const matchesView =
      historyFilterMode === "date" && dateValue
        ? entry.date === dateValue
        : historyFilterMode === "month"
          ? entry.date.startsWith(monthKey)
          : true;
    return matchesSearch && matchesView;
  });
}

function getFilteredWordEntries(listName) {
  const listKey = getWordListKey(listName);
  const searchInput =
    listName === "reading" ? elements.vocabularySearch : elements.speakingSearch;
  const sortInput = listName === "reading" ? elements.vocabularySort : elements.speakingSort;

  return sortedWords(
    state[listKey].filter((item) => {
      const haystack = `${item.word} ${item.meaning} ${item.savedAt}`.toLowerCase();
      return !searchInput.value.trim() || haystack.includes(searchInput.value.trim().toLowerCase());
    }),
    sortInput.value
  );
}

function clearWordSelection(listName) {
  getSelectedWordSet(listName).clear();
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function downloadCsv(filename, headers, rows) {
  const csv = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportHistoryCsv() {
  const entries = getFilteredHistoryEntries();
  if (!entries.length) {
    showToast("No history to export in this view.");
    return;
  }
  downloadCsv(
    `describer-history-${formatIsoDate(new Date())}.csv`,
    [
      "Date",
      "Topic",
      "Score",
      "Original Transcript",
      "Corrected Version",
      "Easy Example",
      "Advanced Example",
    ],
    entries.map((entry) => [
      entry.date,
      entry.title,
      typeof entry.score === "number" ? entry.score : "",
      entry.originalTranscript || "",
      entry.correctedTranscript || "",
      entry.easyExample || "",
      entry.advancedExample || "",
    ])
  );
  showToast(`Exported ${entries.length} history item${entries.length === 1 ? "" : "s"}.`);
}

function exportWordListCsv(listName) {
  const entries = getFilteredWordEntries(listName);
  if (!entries.length) {
    showToast(`No ${getWordListLabel(listName).toLowerCase()} words to export.`);
    return;
  }
  downloadCsv(
    `describer-${listName}-${formatIsoDate(new Date())}.csv`,
    ["Word", "Right", "Wrong"],
    entries.map((item) => [item.word, item.rightCount, item.wrongCount])
  );
  showToast(
    `Exported ${entries.length} ${getWordListLabel(listName).toLowerCase()} word${
      entries.length === 1 ? "" : "s"
    }.`
  );
}

function getSelectedWords(listName) {
  const selected = getSelectedWordSet(listName);
  const listKey = getWordListKey(listName);
  return [...selected].filter((word) => state[listKey].some((item) => item.word === word));
}

function toggleWordSelection(listName, word, checked) {
  const selected = getSelectedWordSet(listName);
  if (checked) selected.add(word);
  else selected.delete(word);
  renderWordList(listName);
}

function areAllFilteredWordsSelected(listName) {
  const filteredWords = getCurrentFilteredWords(listName);
  const selected = getSelectedWordSet(listName);
  return filteredWords.length > 0 && filteredWords.every((word) => selected.has(word));
}

function selectAllFilteredWords(listName) {
  const filteredWords = getCurrentFilteredWords(listName);
  if (!filteredWords.length) {
    showToast(`No ${getWordListLabel(listName).toLowerCase()} words in this view.`);
    return;
  }

  const selected = getSelectedWordSet(listName);
  if (areAllFilteredWordsSelected(listName)) {
    filteredWords.forEach((word) => selected.delete(word));
  } else {
    filteredWords.forEach((word) => selected.add(word));
  }
  renderWordList(listName);
}

function normalized(value) {
  return value.toLowerCase().replace(/[^\w\s]/g, "").trim();
}

function analyzeTranscript(text, prompt = todayPrompt) {
  const original = text || "";
  let corrected = original;
  let grammarIssueCount = 0;
  const fixes = [
    {
      from: /\bpicture show\b/i,
      to: "picture shows",
      original: "“this picture show a busy market”",
      corrected: "Correct: “this picture shows a busy market”",
      note: "Use shows because the subject is singular.",
    },
    {
      from: /\bpeople is\b/i,
      to: "people are",
      original: "“many people is walking”",
      corrected: "Correct: “many people are walking”",
      note: "Use are with the plural noun people.",
    },
    {
      from: /\bseller are\b/i,
      to: "sellers are",
      original: "“some seller are smiling”",
      corrected: "Correct: “some sellers are smiling”",
      note: "Use sellers because some needs a plural noun.",
    },
  ];

  let selectedFix = fixes[0];
  for (const fix of fixes) {
    if (fix.from.test(corrected)) {
      corrected = corrected.replace(fix.from, fix.to);
      selectedFix = fix;
      grammarIssueCount += 1;
      break;
    }
  }
  if (/\bpeople is\b/i.test(corrected)) {
    corrected = corrected.replace(/\bpeople is\b/i, "people are");
    grammarIssueCount += 1;
  }
  if (/\bseller are\b/i.test(corrected)) {
    corrected = corrected.replace(/\bseller are\b/i, "sellers are");
    grammarIssueCount += 1;
  }

  const flagged = Object.keys(wordLibrary).filter((word) =>
    normalized(original).includes(normalized(word))
  );
  const overallScore = clampScore(
    96 - grammarIssueCount * 2 - Math.max(Math.min(flagged.length, 3) - 2, 0)
  );

  return {
    grammarOriginal: selectedFix.original,
    grammarCorrected: selectedFix.corrected,
    grammarNote: selectedFix.note,
    overallSuggestion:
      "Good detail. Next time, slow down a little and keep each sentence shorter so your grammar stays clear.",
    correctedTranscript: corrected,
    overallScore,
    pronunciationWords: flagged.slice(0, 3).length ? flagged.slice(0, 3) : ["seller", "lively"],
    keywords: prompt.keywords?.length ? prompt.keywords : deriveKeywordsFromText(original, prompt.title),
    easy: buildEasyExample(prompt),
    advanced: buildAdvancedExample(prompt),
  };
}

function createEmptyFeedback(prompt = todayPrompt) {
  return {
    grammarOriginal: "",
    grammarCorrected: "",
    grammarNote: "",
    overallSuggestion: "",
    correctedTranscript: "",
    overallScore: null,
    pronunciationWords: [],
    keywords: [],
    easy: "",
    advanced: "",
  };
}

function clonePrompt(prompt = todayPrompt) {
  return {
    ...prompt,
    keywords: [...(prompt.keywords || [])],
  };
}

function cloneFeedback(feedback = createEmptyFeedback()) {
  return JSON.parse(JSON.stringify(feedback));
}

function deriveKeywordsFromText(text, title = "") {
  const stopWords = new Set([
    "this",
    "that",
    "with",
    "from",
    "have",
    "there",
    "their",
    "about",
    "would",
    "could",
    "should",
    "because",
    "people",
    "picture",
    "looks",
    "look",
    "very",
    "some",
    "into",
    "after",
    "before",
    "again",
    "while",
  ]);
  const source = `${title} ${text}`.toLowerCase();
  const words = source.match(/[a-z][a-z'-]+/g) || [];
  const unique = [];

  for (const word of words) {
    if (word.length < 4 || stopWords.has(word) || unique.includes(word)) continue;
    unique.push(word);
    if (unique.length === 6) break;
  }

  return unique.length ? unique : ["details", "scene", "objects", "setting", "mood", "actions"];
}

function createTodaySnapshot() {
  return {
    prompt: clonePrompt(todayPrompt),
    transcript: state.transcript,
    feedback: cloneFeedback(state.feedback),
    finished: todayPracticeFinished,
  };
}

function buildHistoryTodayView(entry) {
  const prompt = {
    id: entry.id,
    date: entry.date,
    title: entry.title || "Saved practice",
    image: entry.image || todayPrompt.image,
    alt: entry.title || "Saved practice image",
    keywords: deriveKeywordsFromText(
      `${entry.correctedTranscript || ""} ${entry.summary || ""}`,
      entry.title || ""
    ),
  };
  const transcript = entry.originalTranscript || "";
  const correctedTranscript = entry.correctedTranscript || transcript;
  const feedback = normalizeFeedback(
    {
      ...analyzeTranscript(transcript, prompt),
      correctedTranscript,
      overallScore: typeof entry.score === "number" ? entry.score : 89,
      easy: entry.easyExample || "",
      advanced: entry.advancedExample || "",
      overallSuggestion:
        entry.summary || "Review this saved practice and compare your original words with the corrected version.",
      keywords: prompt.keywords,
    },
    prompt
  );

  return {
    prompt,
    transcript,
    feedback,
    finished: true,
  };
}

function getTodayViewData() {
  if (!activeTodayHistoryId) {
    return {
      prompt: todayPrompt,
      transcript: state.transcript,
      feedback: state.feedback,
      finished: todayPracticeFinished,
      isHistory: false,
    };
  }

  const entry = state.history.find((item) => item.id === activeTodayHistoryId);
  if (!entry) {
    activeTodayHistoryId = null;
    return {
      prompt: todayPrompt,
      transcript: state.transcript,
      feedback: state.feedback,
      finished: todayPracticeFinished,
      isHistory: false,
    };
  }

  return {
    ...buildHistoryTodayView(entry),
    isHistory: true,
  };
}

function showToast(message) {
  elements.shortcutToast.textContent = message;
  elements.shortcutToast.classList.add("is-visible");
  setTimeout(() => elements.shortcutToast.classList.remove("is-visible"), 1200);
}

function lookupWordEntry(word) {
  const key = String(word || "").trim().toLowerCase();
  const existing = wordLibrary[key];
  if (existing) return existing;

  const fallback = {
    phonetic: "",
    meaning: `Useful word related to "${word}".`,
    example: `I can use "${word}" when I describe a picture.`,
  };
  wordLibrary[key] = fallback;
  return fallback;
}

function setSelectedWord(word, element) {
  if (selectedWordElement) selectedWordElement.classList.remove("is-selected");
  selectedWord = word;
  selectedWordElement = element;
  if (selectedWordElement) selectedWordElement.classList.add("is-selected");
}

function resetSpeakingListPractice(word = speakingListPractice.word) {
  stopPlaybackAudio();
  speakingListPractice = {
    word,
    attempt: "",
    judged: false,
    score: null,
  };
  speakingListAudioBlob = null;
  speakingListAutoJudgeRequested = false;
  isSpeakingListProcessing = false;
}

function getSpeakingListUiState(word) {
  const isRecordingNow =
    speakingListPractice.word === word &&
    (recordingMode === "speaking-list" || recognitionMode === "speaking-list");
  const isCurrentWord = speakingListPractice.word === word;
  return {
    isRecordingNow,
    isProcessing: isCurrentWord && isSpeakingListProcessing,
    isJudged: isCurrentWord && speakingListPractice.judged,
    score: isCurrentWord ? speakingListPractice.score : null,
    hasOriginalAudio: isCurrentWord && Boolean(speakingListAudioBlob),
  };
}

async function updateSpeakingWordRecord(word, passed) {
  const item = state.speakingList.find((entry) => entry.word === word);
  if (!item) return;
  try {
    const reviewResponse = await fetch("/api/review/speaking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word, matched: passed }),
    });
    if (reviewResponse.ok) {
      const reviewData = await reviewResponse.json();
      state.speakingList = reviewData.list;
    } else if (passed) item.rightCount += 1;
    else item.wrongCount += 1;
  } catch {
    if (passed) item.rightCount += 1;
    else item.wrongCount += 1;
  }
}

async function getSpeakingJudgeResult(word, attempt, audioBlob) {
  if (apiConfigured) {
    const formData = new FormData();
    formData.append("targetWord", word);
    formData.append("attempt", attempt || "");
    if (audioBlob) formData.append("audio", audioBlob, "speaking.webm");
    const response = await fetch("/api/judge-word", {
      method: "POST",
      body: formData,
    });
    if (!response.ok) throw new Error("AI judge request failed.");
    const result = await response.json();
    return {
      score: result.score,
      feedback: result.feedback || "",
      heard: result.heard || attempt,
      passed: result.score > 80,
    };
  }

  const normalizedAttempt = normalized(attempt || "");
  const target = normalized(word);
  const score =
    normalizedAttempt === target || normalizedAttempt.includes(target) ? 88 : 58;
  return {
    score,
    feedback: score > 80 ? "" : "Try the ending sound again.",
    heard: attempt,
    passed: score > 80,
  };
}

function speakWord(word) {
  if (!synth || !word) return;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.rate = 0.9;
  synth.speak(utterance);
}

function speakText(text) {
  if (!synth || !text) return;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  synth.speak(utterance);
}

function stopPlaybackAudio() {
  if (playbackAudio) {
    playbackAudio.pause();
    playbackAudio.src = "";
    playbackAudio = null;
  }
  if (playbackAudioUrl) {
    URL.revokeObjectURL(playbackAudioUrl);
    playbackAudioUrl = null;
  }
}

function playOriginalAudio(blob) {
  if (!blob) {
    showToast("No original recording available yet.");
    return;
  }
  stopPlaybackAudio();
  playbackAudioUrl = URL.createObjectURL(blob);
  playbackAudio = new Audio(playbackAudioUrl);
  playbackAudio.onended = () => {
    stopPlaybackAudio();
  };
  playbackAudio.onerror = () => {
    stopPlaybackAudio();
    showToast("This recording could not be played.");
  };
  playbackAudio.play().catch(() => {
    stopPlaybackAudio();
    showToast("This browser could not play the recording.");
  });
}

function updateTodayRecordingControls() {
  elements.startSpeakingButton.textContent = isTodayRecording ? "Recording" : "Start";
  elements.finishSpeakingButton.textContent = isTodayTranscriptProcessing
    ? "Processing"
    : todayPracticeFinished
      ? "Judged"
      : "Finish";

  elements.startSpeakingButton.disabled =
    isTodayRecording || isTodayTranscriptProcessing || todayPracticeFinished;
  elements.finishSpeakingButton.disabled = !isTodayRecording;
  elements.testMicButton.disabled = isTodayRecording || isTodayTranscriptProcessing;
  elements.restartSpeakingButton.disabled = isTodayRecording || isTodayTranscriptProcessing;
  elements.playOriginalSpeakingButton.disabled =
    isTodayRecording || isTodayTranscriptProcessing || !dailyAudioBlob;

  elements.startSpeakingButton.classList.toggle("is-start-active", isTodayRecording);
  elements.finishSpeakingButton.classList.toggle(
    "is-finish-active",
    isTodayTranscriptProcessing || todayPracticeFinished
  );
}

function setTodayTranscriptProcessing(isProcessing) {
  isTodayTranscriptProcessing = isProcessing;
  elements.transcriptProcessing.classList.toggle("is-hidden", !isProcessing);
  updateTodayRecordingControls();
}

function collectRecognitionTranscript(event) {
  return Array.from(event.results || [])
    .map((result) => result?.[0]?.transcript?.trim() || "")
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isTypingTarget(target) {
  if (!target) return false;
  const tagName = target.tagName?.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select"
  );
}

function getMouseSelectedText() {
  const rawSelection = window.getSelection?.()?.toString?.() || "";
  const normalizedSelection = rawSelection
    .replace(/\s+/g, " ")
    .replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "")
    .trim();
  return normalizedSelection;
}

function normalizeWordForSave(word) {
  const compact = String(word || "").replace(/\s+/g, " ").trim();
  if (!compact) return "";

  const tokens = compact.split(" ");
  const capitalizedTokenCount = tokens.filter((token) => {
    const lettersOnly = token.replace(/[^A-Za-z]/g, "");
    return (
      lettersOnly.length > 0 &&
      lettersOnly[0] === lettersOnly[0].toUpperCase() &&
      lettersOnly.slice(1) === lettersOnly.slice(1).toLowerCase()
    );
  }).length;
  const preserveTitleCasePhrase = capitalizedTokenCount > 1;

  return tokens
    .map((token) => {
      const lettersOnly = token.replace(/[^A-Za-z]/g, "");
      if (!lettersOnly) return token;
      if (lettersOnly.length >= 2 && lettersOnly === lettersOnly.toUpperCase()) return token;
      if (preserveTitleCasePhrase) {
        const isTitleCase =
          lettersOnly[0] === lettersOnly[0].toUpperCase() &&
          lettersOnly.slice(1) === lettersOnly.slice(1).toLowerCase();
        if (isTitleCase) return token;
      }
      if (/[A-Z]/.test(token.slice(1)) && /[a-z]/.test(token)) return token;
      return token.toLowerCase();
    })
    .join(" ");
}

function splitIntoSentences(text) {
  const cleaned = String(text || "").trim();
  if (!cleaned) return [];
  const matches = cleaned.match(/[^.!?]+[.!?]?/g);
  return (matches || [cleaned]).map((sentence) => sentence.trim()).filter(Boolean);
}

function formatSceneLabel(prompt = todayPrompt) {
  return String(prompt.title || "this picture")
    .replace(/^describe\s+/i, "")
    .replace(/\.$/, "")
    .replace(/^this\s+/i, "this ")
    .trim()
    .toLowerCase();
}

function pickPromptKeyword(prompt, index, fallback) {
  return prompt.keywords?.[index] || fallback;
}

function buildEasyExample(prompt = todayPrompt) {
  const scene = formatSceneLabel(prompt);
  const keyword1 = pickPromptKeyword(prompt, 0, "details");
  const keyword2 = pickPromptKeyword(prompt, 1, "people");
  const keyword3 = pickPromptKeyword(prompt, 2, "movement");
  const keyword4 = pickPromptKeyword(prompt, 3, "color");

  return [
    `This picture shows ${scene}.`,
    `I can see ${keyword2} and many small details in the scene.`,
    `There are clear things to describe, such as ${keyword1} and ${keyword3}.`,
    `The place looks active, and people seem to be busy with their own actions.`,
    `The colors and the background make the picture more interesting to talk about.`,
    `Overall, this is a clear and useful picture for speaking practice because it has many simple details.`,
  ].join(" ");
}

function buildAdvancedExample(prompt = todayPrompt) {
  const scene = formatSceneLabel(prompt);
  const keyword1 = pickPromptKeyword(prompt, 0, "details");
  const keyword2 = pickPromptKeyword(prompt, 1, "people");
  const keyword3 = pickPromptKeyword(prompt, 2, "objects");
  const keyword4 = pickPromptKeyword(prompt, 3, "movement");
  const keyword5 = pickPromptKeyword(prompt, 4, "energy");

  return [
    `Today I would like to describe ${scene}.`,
    `The first thing I notice is that the picture has many visible details to talk about.`,
    `There are ${keyword2} in the scene, which makes the image feel more active and natural.`,
    `I can also notice ${keyword1} and ${keyword3}, which give the speaker more vocabulary to use.`,
    `In the middle of the picture, the main action seems clear and easy to follow.`,
    `The background also adds depth, so the scene does not feel flat or empty.`,
    `Another useful point is the sense of ${keyword4}, because it helps describe what may be happening at that moment.`,
    `The overall mood feels connected to ${keyword5}, but it still looks realistic and easy to explain.`,
    `This kind of picture is good for public speaking practice because it allows the speaker to move from the main idea to smaller details.`,
    `A speaker can describe the people, the setting, the objects, and the general mood in a logical order.`,
    `That makes the description sound more organized and more confident.`,
    `Overall, this image gives enough detail for a full spoken description without being too difficult to understand.`,
  ].join(" ");
}

function ensureExampleVariant(text, mode, prompt = todayPrompt) {
  const sentenceCount = splitIntoSentences(text).length;
  if (mode === "easy" && sentenceCount >= 5 && sentenceCount <= 7) return text;
  if (mode === "advanced" && sentenceCount >= 10 && sentenceCount <= 12) return text;
  return mode === "easy" ? buildEasyExample(prompt) : buildAdvancedExample(prompt);
}

function normalizeFeedback(feedback = {}, prompt = todayPrompt) {
  return {
    ...feedback,
    overallScore:
      typeof feedback.overallScore === "number" ? clampScore(feedback.overallScore) : null,
    easy: ensureExampleVariant(feedback.easy, "easy", prompt),
    advanced: ensureExampleVariant(feedback.advanced, "advanced", prompt),
  };
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function normalizedSentence(text) {
  return tokenizeForDiff(text)
    .map((token) => comparableToken(token))
    .filter(Boolean)
    .join(" ");
}

function comparableToken(token) {
  return token.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, "");
}

function tokenizeForDiff(text) {
  return String(text || "").match(/\s+|[^\s]+/g) || [];
}

function findMatchedOriginalTokenIndexes(originalText, correctedText) {
  const originalTokens = tokenizeForDiff(originalText);
  const correctedTokens = tokenizeForDiff(correctedText);

  const originalWords = originalTokens
    .map((token, index) => ({ index, value: comparableToken(token) }))
    .filter((token) => token.value);
  const correctedWords = correctedTokens
    .map((token) => ({ value: comparableToken(token) }))
    .filter((token) => token.value);

  const dp = Array.from({ length: originalWords.length + 1 }, () =>
    new Array(correctedWords.length + 1).fill(0)
  );

  for (let i = originalWords.length - 1; i >= 0; i -= 1) {
    for (let j = correctedWords.length - 1; j >= 0; j -= 1) {
      dp[i][j] =
        originalWords[i].value === correctedWords[j].value
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const matchedIndexes = new Set();
  let i = 0;
  let j = 0;

  while (i < originalWords.length && j < correctedWords.length) {
    if (originalWords[i].value === correctedWords[j].value) {
      matchedIndexes.add(originalWords[i].index);
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }

  return matchedIndexes;
}

function highlightOriginalSentence(originalText, correctedText) {
  const tokens = tokenizeForDiff(originalText);
  const matchedIndexes = findMatchedOriginalTokenIndexes(originalText, correctedText);

  return tokens
    .map((token, index) => {
      if (/^\s+$/.test(token)) return token;
      const comparable = comparableToken(token);
      if (!comparable) return escapeHtml(token);
      if (matchedIndexes.has(index)) return escapeHtml(token);
      return `
        <span
          class="mistake grammar inline-word-select"
          data-word-select="${escapeHtml(comparable)}"
        >
          ${escapeHtml(token)}
        </span>
      `;
    })
    .join("");
}

function buildGrammarSentencePairs(originalText, correctedText) {
  const originalSentences = splitIntoSentences(originalText);
  const correctedSentences = splitIntoSentences(correctedText);

  const filterChangedPairs = (pairs) =>
    pairs.filter(
      (pair) => normalizedSentence(pair.original) !== normalizedSentence(pair.corrected)
    );

  if (
    originalSentences.length > 0 &&
    correctedSentences.length > 0 &&
    originalSentences.length === correctedSentences.length
  ) {
    return filterChangedPairs(
      originalSentences.map((original, index) => ({
        original,
        corrected: correctedSentences[index],
      }))
    );
  }

  return filterChangedPairs([
    {
      original: String(originalText || "").trim(),
      corrected: String(correctedText || "").trim() || String(originalText || "").trim(),
    },
  ]);
}

function renderGrammarFeedback(originalText, correctedText) {
  if (!String(originalText || "").trim() || !String(correctedText || "").trim()) {
    elements.grammarSentences.innerHTML = "";
    return;
  }
  const pairs = buildGrammarSentencePairs(originalText, correctedText);
  if (!pairs.length) {
    elements.grammarSentences.innerHTML = "";
    return;
  }

  elements.grammarSentences.innerHTML = pairs
    .map(
      (pair) => `
        <div class="feedback-sentence">
          <p class="feedback-row feedback-corrected">
            ${escapeHtml(pair.corrected)}
          </p>
        </div>
      `
    )
    .join("");
}

async function saveWordToList(word, listName) {
  const normalizedWord = normalizeWordForSave(word);
  if (!normalizedWord) {
    showToast("Please select a valid word first.");
    return;
  }
  const listKey = listName === "reading" ? "readingList" : "speakingList";
  try {
    const response = await fetch("/api/words", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word: normalizedWord, listName, savedAt: todayPrompt.date }),
    });
    if (response.ok) {
      const data = await response.json();
      state[listKey] = data.list;
    } else if (!state[listKey].some((item) => item.word.toLowerCase() === normalizedWord.toLowerCase())) {
      state[listKey].unshift(createWord(normalizedWord, todayPrompt.date));
    }
  } catch {
    if (!state[listKey].some((item) => item.word.toLowerCase() === normalizedWord.toLowerCase())) {
      state[listKey].unshift(createWord(normalizedWord, todayPrompt.date));
    }
  }
  saveState();
  renderAll();
  showToast(`Saved "${normalizedWord}" to ${listName === "reading" ? "Reading" : "Speaking"}`);
}

async function removeWordFromList(word, listName) {
  const listKey = getWordListKey(listName);
  getSelectedWordSet(listName).delete(word);
  if (listName === "speaking" && speakingListPractice.word === word) {
    resetSpeakingListPractice(null);
  }
  try {
    const response = await fetch(
      `/api/words/${listName}/${encodeURIComponent(word)}`,
      { method: "DELETE" }
    );
    if (response.ok) {
      const data = await response.json();
      state[listKey] = data.list;
    } else {
      state[listKey] = state[listKey].filter((item) => item.word !== word);
    }
  } catch {
    state[listKey] = state[listKey].filter((item) => item.word !== word);
  }
  if (selectedWord === word) setSelectedWord(null, null);
  saveState();
  renderAll();
}

async function deleteSelectedWords(listName) {
  const wordsToDelete = getSelectedWords(listName);
  if (!wordsToDelete.length) {
    showToast(`Select ${getWordListLabel(listName).toLowerCase()} words first.`);
    return;
  }

  const listKey = getWordListKey(listName);
  const deletedSet = new Set(wordsToDelete);

  try {
    await Promise.all(
      wordsToDelete.map((word) =>
        fetch(`/api/words/${listName}/${encodeURIComponent(word)}`, {
          method: "DELETE",
        })
      )
    );
  } catch {}

  state[listKey] = state[listKey].filter((item) => !deletedSet.has(item.word));
  wordsToDelete.forEach((word) => getSelectedWordSet(listName).delete(word));
  if (selectedWord && deletedSet.has(selectedWord)) setSelectedWord(null, null);
  if (listName === "speaking" && speakingListPractice.word && deletedSet.has(speakingListPractice.word)) {
    resetSpeakingListPractice(null);
  }
  saveState();
  renderAll();
  showToast(
    `${wordsToDelete.length} ${getWordListLabel(listName).toLowerCase()} word${
      wordsToDelete.length === 1 ? "" : "s"
    } deleted`
  );
}

function sortedWords(words, sortMode) {
  return [...words].sort((a, b) => {
    if (sortMode === "az") return a.word.localeCompare(b.word);
    if (sortMode === "oldest") return a.savedAt.localeCompare(b.savedAt);
    return b.savedAt.localeCompare(a.savedAt);
  });
}

function renderToday() {
  const todayView = getTodayViewData();
  elements.todayDate.textContent = new Date(`${todayView.prompt.date}T12:00:00`).toLocaleDateString(
    "en-US",
    { month: "long", day: "numeric" }
  );
  elements.backToTodayButton.classList.toggle("is-hidden", !todayView.isHistory);
  elements.dailyImage.src = todayView.prompt.image;
  elements.dailyImage.alt = todayView.prompt.alt;
  elements.dailyPromptTitle.textContent = todayView.prompt.title;
  elements.transcriptText.textContent =
    todayView.transcript ||
    (
      todayView.isHistory
        ? "No original transcript was saved for this older practice."
        : isTodayTranscriptProcessing
          ? "Processing your recording..."
          : "Tap Start to describe the picture."
    );
  if (todayView.transcript && todayView.feedback.correctedTranscript) {
    elements.feedbackOriginalTranscript.innerHTML = highlightOriginalSentence(
      todayView.transcript,
      todayView.feedback.correctedTranscript
    );
  } else {
    elements.feedbackOriginalTranscript.textContent = todayView.transcript ||
      (todayView.isHistory
        ? "No original transcript was saved for this older practice."
        : isTodayTranscriptProcessing
        ? "Processing your recording..."
        : "Your original transcript will appear here after you finish speaking.");
  }
  elements.micTestResult.textContent = todayView.isHistory
    ? "Viewing a saved practice. Click Back to Today to return to today's training."
    : micPermissionGranted
      ? SpeechRecognitionApi
        ? apiConfigured
          ? "Mic OK. Speech recognition available. AI available."
          : "Mic OK. Speech recognition available. AI not configured."
        : apiConfigured
          ? "Mic OK. Recording available. Speech recognition unsupported."
          : "Mic OK. Recording available. Speech recognition unsupported. AI not configured."
      : "Mic not tested yet.";
  renderGrammarFeedback(todayView.transcript, todayView.feedback.correctedTranscript);
  elements.modelEasyText.textContent = todayView.feedback.easy;
  elements.modelAdvancedText.textContent = todayView.feedback.advanced;
  elements.aiSuggestionText.textContent =
    todayView.finished
      ? (
          todayView.feedback.overallSuggestion ||
          todayView.feedback.grammarNote ||
          ""
        )
      : "";
  elements.aiSuggestionScore.textContent =
    typeof todayView.feedback.overallScore === "number"
      ? `Score: ${todayView.feedback.overallScore}/100`
      : "";
  elements.aiSuggestionScore.classList.toggle(
    "is-hidden",
    typeof todayView.feedback.overallScore !== "number"
  );

  const activeModelButton =
    document.querySelector('.toggle-button.is-active[data-model]') ||
    document.querySelector('.toggle-button[data-model="easy"]');
  const activeModel = activeModelButton?.dataset.model || "easy";
  elements.modelToggleRow.classList.toggle("is-hidden", !todayView.finished);
  elements.modelLockedNote.classList.toggle("is-hidden", todayView.finished);
  document.querySelectorAll(".model-copy").forEach((copy) => {
    copy.classList.toggle(
      "is-visible",
      todayView.finished && copy.id === `model-${activeModel}`
    );
  });

  elements.pronunciationFlags.innerHTML = todayView.feedback.pronunciationWords.length
    ? todayView.feedback.pronunciationWords
        .map(
          (word) =>
            `<button class="word-chip issue" data-word-value="${word}" data-word-select="${word}">${word}</button>`
        )
        .join("")
    : ``;

  elements.keywordGrid.innerHTML = todayView.feedback.keywords.length
    ? todayView.feedback.keywords
        .map(
          (word) =>
            `<button class="word-chip" data-word-value="${word}" data-word-select="${word}">${word}</button>`
        )
        .join("")
    : "";

  [...todayView.feedback.pronunciationWords, ...todayView.feedback.keywords].forEach((word) =>
    lookupWordEntry(word)
  );

  const recent = [
    ...state.readingList.slice(0, 2).map((item) => ({ ...item, tag: "Reading" })),
    ...state.speakingList.slice(0, 2).map((item) => ({ ...item, tag: "Speaking" })),
  ]
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
    .slice(0, 3);

  elements.recentSavedList.innerHTML = recent
    .map(
      (item) => `
        <div class="mini-row">
          <div>
            <strong>${item.word}</strong>
            <span>${item.phonetic}</span>
          </div>
          <span class="tag ${item.tag === "Speaking" ? "warm" : ""}">${item.tag}</span>
        </div>
      `
    )
    .join("");

  if (todayView.isHistory) {
    elements.transcriptProcessing.classList.add("is-hidden");
    elements.startSpeakingButton.textContent = "Start";
    elements.finishSpeakingButton.textContent = "Finish";
    elements.startSpeakingButton.disabled = true;
    elements.finishSpeakingButton.disabled = true;
    elements.testMicButton.disabled = true;
    elements.restartSpeakingButton.disabled = true;
    elements.playOriginalSpeakingButton.disabled = true;
    elements.startSpeakingButton.classList.remove("is-start-active");
    elements.finishSpeakingButton.classList.remove("is-finish-active");
    return;
  }

  updateTodayRecordingControls();
  setTodayTranscriptProcessing(isTodayTranscriptProcessing);
}

function renderHistory() {
  renderHistoryFilterControls();
  const historyPageSize = historyCardMode === "lite" ? 9 : pageSize;
  const filtered = getFilteredHistoryEntries();
  currentFilteredHistoryIds = filtered.map((entry) => entry.id);

  const totalPages = Math.max(1, Math.ceil(filtered.length / historyPageSize));
  historyPage = Math.min(historyPage, totalPages);
  const visible = filtered.slice(
    (historyPage - 1) * historyPageSize,
    historyPage * historyPageSize
  );

  elements.historyGrid.innerHTML = visible
    .map((entry) => {
      const score = typeof entry.score === "number" ? entry.score : 89;
      if (historyCardMode === "lite") {
        return `
        <article
          class="history-card history-card-lite panel ${selectedHistoryIds.has(entry.id) ? "is-selected" : ""}"
          data-history-open="${entry.id}"
          role="button"
          tabindex="0"
          aria-label="Open history preview for ${escapeHtml(entry.title)}"
        >
          <div class="history-copy">
            <div class="history-lite-top-row">
              <div class="history-card-select">
                <input
                  class="history-select-checkbox"
                  type="checkbox"
                  data-history-select="${entry.id}"
                  aria-label="Select history entry ${escapeHtml(entry.title)}"
                  ${selectedHistoryIds.has(entry.id) ? "checked" : ""}
                />
              </div>
              <div class="history-meta-row">
                <p class="eyebrow">${formatDateLabel(entry.date)}</p>
                <span class="history-score-chip">Score ${score}</span>
              </div>
            </div>
            <h4>${escapeHtml(entry.title)}</h4>
          </div>
          <div class="history-card-footer">
            <button class="ghost-button history-open-button" data-history-open="${entry.id}">
              Preview
            </button>
            <button
              class="history-delete-button"
              data-history-delete="${entry.id}"
              aria-label="Delete history entry ${escapeHtml(entry.title)}"
            >
              Delete
            </button>
          </div>
        </article>
      `;
      }
      return `
        <article
          class="history-card panel ${selectedHistoryIds.has(entry.id) ? "is-selected" : ""}"
          data-history-open="${entry.id}"
          role="button"
          tabindex="0"
          aria-label="Open history preview for ${escapeHtml(entry.title)}"
        >
          <div class="history-card-select">
            <input
              class="history-select-checkbox"
              type="checkbox"
              data-history-select="${entry.id}"
              aria-label="Select history entry ${escapeHtml(entry.title)}"
              ${selectedHistoryIds.has(entry.id) ? "checked" : ""}
            />
          </div>
          <img src="${entry.image}" alt="${escapeHtml(entry.title)}" />
          <div class="history-copy">
            <div class="history-meta-row">
              <p class="eyebrow">${formatDateLabel(entry.date)}</p>
              <span class="history-score-chip">Score ${score}</span>
            </div>
            <h4>${escapeHtml(entry.title)}</h4>
            <p>${escapeHtml(entry.summary || "Open to review your original words and the corrected version.")}</p>
          </div>
          <div class="history-card-footer">
            <button class="ghost-button history-open-button" data-history-open="${entry.id}">
              Preview
            </button>
            <button
              class="history-delete-button"
              data-history-delete="${entry.id}"
              aria-label="Delete history entry ${escapeHtml(entry.title)}"
            >
              Delete
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  if (!visible.length) {
    elements.historyGrid.innerHTML = `
      <article class="panel history-empty-state">
        <p class="eyebrow">No History</p>
        <h4>No saved practice matches this view.</h4>
        <p>Try another month, clear the search, or save a new speaking practice.</p>
      </article>
    `;
  }

  elements.historyPageStatus.textContent = `Page ${historyPage} of ${totalPages}`;
  elements.historyPrev.disabled = historyPage === 1;
  elements.historyNext.disabled = historyPage === totalPages;
  elements.monthSessionCount.textContent = `${filtered.length} session${filtered.length === 1 ? "" : "s"}`;
  const allFilteredSelected = areAllFilteredHistorySelected();
  elements.selectAllHistoryButton.disabled = currentFilteredHistoryIds.length === 0;
  elements.selectAllHistoryButton.textContent = allFilteredSelected ? "Cancel" : "Select All";
  elements.selectAllHistoryButton.classList.toggle("is-active", allFilteredSelected);
  elements.exportHistoryButton.disabled = filtered.length === 0;
  elements.deleteAllHistory.disabled = getSelectedHistoryIds().length === 0;
}

function openHistoryPreview(id) {
  const entry = state.history.find((item) => item.id === id);
  if (!entry) return;
  activeHistoryPreviewId = id;
  elements.historyPreviewImage.src = entry.image;
  elements.historyPreviewImage.alt = entry.title;
  elements.historyPreviewDate.textContent = formatDateLabel(entry.date);
  elements.historyPreviewTitle.textContent = entry.title;
  elements.historyPreviewSummary.textContent = entry.summary || "";
  elements.historyPreviewOriginal.innerHTML =
    entry.originalTranscript && entry.correctedTranscript
      ? highlightOriginalSentence(entry.originalTranscript, entry.correctedTranscript)
      : escapeHtml(entry.originalTranscript || "No original transcript was saved for this older practice.");
  elements.historyPreviewCorrected.textContent =
    entry.correctedTranscript || entry.summary || "No corrected version was saved for this older practice.";
  elements.historyPreviewBackdrop.classList.add("is-open");
  elements.historyPreviewBackdrop.setAttribute("aria-hidden", "false");
  elements.historyPreview.setAttribute("aria-hidden", "false");
}

function closeHistoryPreview() {
  activeHistoryPreviewId = null;
  elements.historyPreviewBackdrop.classList.remove("is-open");
  elements.historyPreviewBackdrop.setAttribute("aria-hidden", "true");
  elements.historyPreview.setAttribute("aria-hidden", "true");
}

function switchToView(viewName) {
  document.querySelectorAll(".nav-link").forEach((item) =>
    item.classList.toggle("is-active", item.dataset.view === viewName)
  );
  Object.entries(elements.views).forEach(([name, view]) => {
    view.classList.toggle("is-visible", name === viewName);
  });
}

function openHistoryDetailsInToday(id) {
  const entry = state.history.find((item) => item.id === id);
  if (!entry) return;
  if (!activeTodayHistoryId) {
    todayLiveSnapshot = createTodaySnapshot();
  }
  activeTodayHistoryId = id;
  closeHistoryPreview();
  switchToView("today");
  renderAll();
}

function returnToLiveToday() {
  activeTodayHistoryId = null;
  if (todayLiveSnapshot) {
    Object.assign(todayPrompt, todayLiveSnapshot.prompt);
    state.transcript = todayLiveSnapshot.transcript;
    state.feedback = todayLiveSnapshot.feedback;
    todayPracticeFinished = todayLiveSnapshot.finished;
    todayLiveSnapshot = null;
  }
  renderAll();
}

async function deleteHistory(id) {
  const shouldReturnToToday = activeTodayHistoryId === id;
  selectedHistoryIds.delete(id);
  try {
    const response = await fetch(`/api/history/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (response.ok) {
      const data = await response.json();
      state.history = data.history;
    } else {
      state.history = state.history.filter((entry) => entry.id !== id);
    }
  } catch {
    state.history = state.history.filter((entry) => entry.id !== id);
  }
  if (activeHistoryPreviewId === id) closeHistoryPreview();
  if (shouldReturnToToday) {
    activeTodayHistoryId = null;
    returnToLiveToday();
  }
  historyPage = 1;
  renderHistory();
  showToast("History deleted");
}

async function deleteAllHistory() {
  const idsToDelete = getSelectedHistoryIds();
  if (!idsToDelete.length) {
    showToast("Select history first.");
    return;
  }

  const deletedSet = new Set(idsToDelete);
  const shouldReturnToToday = activeTodayHistoryId && deletedSet.has(activeTodayHistoryId);

  try {
    await Promise.all(
      idsToDelete.map((id) =>
        fetch(`/api/history/${encodeURIComponent(id)}`, {
          method: "DELETE",
        })
      )
    );
  } catch {}

  state.history = state.history.filter((entry) => !deletedSet.has(entry.id));
  clearHistorySelection();
  closeHistoryPreview();
  historyPage = 1;

  if (shouldReturnToToday) {
    activeTodayHistoryId = null;
    returnToLiveToday();
  } else {
    renderHistory();
  }

  showToast(
    `${idsToDelete.length} history item${idsToDelete.length === 1 ? "" : "s"} deleted`
  );
}

function renderWordList(listName) {
  const listKey = getWordListKey(listName);
  const searchInput =
    listName === "reading" ? elements.vocabularySearch : elements.speakingSearch;
  const sortInput = listName === "reading" ? elements.vocabularySort : elements.speakingSort;
  const liteList = listName === "reading" ? elements.vocabularyLiteList : elements.speakingLiteList;
  const fullPanel =
    listName === "reading" ? elements.vocabularyFullPanel : elements.speakingFullPanel;
  const selectAllButton =
    listName === "reading"
      ? elements.selectAllReadingButton
      : elements.selectAllSpeakingButton;
  const deleteSelectedButton =
    listName === "reading"
      ? elements.deleteSelectedReadingButton
      : elements.deleteSelectedSpeakingButton;
  const pageNode =
    listName === "reading" ? elements.vocabularyPageStatus : elements.speakingPageStatus;
  const prevNode = listName === "reading" ? elements.vocabularyPrev : elements.speakingPrev;
  const nextNode = listName === "reading" ? elements.vocabularyNext : elements.speakingNext;
  const page = listName === "reading" ? readingPage : speakingPage;
  const activeMode = getActiveWordMode(listName);
  const listPageSize = activeMode === "lite" ? liteListPageSize : fullListPageSize;
  const selectedSet = getSelectedWordSet(listName);

  const filtered = getFilteredWordEntries(listName);
  setCurrentFilteredWords(
    listName,
    filtered.map((item) => item.word)
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / listPageSize));
  const safePage = Math.min(page, totalPages);
  if (listName === "reading") readingPage = safePage;
  else speakingPage = safePage;
  const visible = filtered.slice((safePage - 1) * listPageSize, safePage * listPageSize);

  liteList.innerHTML = visible
    .map((item) => {
      const escapedWord = escapeHtml(item.word);
      const isBulkSelected = selectedSet.has(item.word);
      const speakingUi = listName === "speaking" ? getSpeakingListUiState(item.word) : null;
      return `
        <div class="lite-word-row ${isBulkSelected ? "is-bulk-selected" : ""}" data-word-select="${escapedWord}" data-word-surface="lite">
          <label
            class="word-select-chip lite-word-select-chip"
            data-list-select-name="${listName}"
            data-list-select-word="${escapedWord}"
          >
            <input
              class="word-select-checkbox"
              type="checkbox"
              aria-label="Select ${getWordListLabel(listName).toLowerCase()} word ${escapedWord}"
              ${isBulkSelected ? "checked" : ""}
            />
          </label>
          <div class="lite-word-copy">
            <strong>${escapedWord}</strong>
            <span class="lite-word-record">Right ${item.rightCount} / Wrong ${item.wrongCount}</span>
          </div>
          <div class="lite-word-actions">
            <button class="inline-audio-button" data-word-audio="${escapedWord}" aria-label="Play pronunciation for ${escapedWord}">&#128264;</button>
            ${
              listName === "speaking"
                ? `<div class="lite-word-controls">
                    <button class="ghost-button small-button ${speakingUi.isRecordingNow ? "is-active" : ""}" data-speaking-list-start="${escapedWord}" ${speakingUi.isProcessing || speakingUi.isJudged ? "disabled" : ""}>
                      ${speakingUi.isRecordingNow ? "Recording" : "Start"}
                    </button>
                    <button class="ghost-button small-button ${speakingUi.isProcessing || speakingUi.isJudged ? "is-active" : ""}" data-speaking-list-finish="${escapedWord}" ${
                      speakingUi.isProcessing || speakingUi.isJudged
                        ? "disabled"
                        : !speakingUi.isRecordingNow &&
                            !(speakingListPractice.word === item.word && (speakingListAudioBlob || speakingListPractice.attempt.trim()))
                          ? "disabled"
                          : ""
                    }>
                      ${speakingUi.isProcessing ? "Proceed" : speakingUi.isJudged ? "Judged" : "Finish"}
                    </button>
                    <button class="ghost-button small-button" data-speaking-list-retry="${escapedWord}" ${speakingUi.isJudged ? "" : "disabled"}>
                      Retry
                    </button>
                    <button class="ghost-button small-button" data-speaking-list-original="${escapedWord}" ${speakingUi.hasOriginalAudio ? "" : "disabled"}>
                      Original
                    </button>
                    ${speakingUi.isJudged && speakingUi.score !== null ? `<span class="speaking-list-score">Score ${speakingUi.score}/100</span>` : ""}
                    <button class="ghost-button small-button" data-delete-word="${escapedWord}" data-delete-list="${listName}">Delete</button>
                  </div>`
                : `<button class="ghost-button small-button" data-delete-word="${escapedWord}" data-delete-list="${listName}">Delete</button>`
            }
          </div>
        </div>
      `;
    })
    .join("");

  fullPanel.innerHTML = visible
    .map((item) => {
      const escapedWord = escapeHtml(item.word);
      const isBulkSelected = selectedSet.has(item.word);
      const speakingUi = listName === "speaking" ? getSpeakingListUiState(item.word) : null;
      return `
        <article class="panel practice-target word-card-entry ${listName === "reading" ? "word-entry" : ""} ${isBulkSelected ? "is-bulk-selected" : ""}" data-word-list="${listName}" data-word="${escapedWord}" data-word-select="${escapedWord}" data-word-surface="full">
          <div class="target-top">
            <div class="target-top-main">
              <label
                class="word-select-chip"
                data-list-select-name="${listName}"
                data-list-select-word="${escapedWord}"
              >
                <input
                  class="word-select-checkbox"
                  type="checkbox"
                  aria-label="Select ${getWordListLabel(listName).toLowerCase()} word ${escapedWord}"
                  ${isBulkSelected ? "checked" : ""}
                />
              </label>
              <p class="eyebrow word-card-date">${formatDateLabel(item.savedAt)}</p>
            </div>
          </div>
          <h4 class="word-card-title">${escapedWord}</h4>
          <div class="phonetic-row">
            <button class="inline-audio-button" data-word-audio="${escapedWord}" aria-label="Play pronunciation for ${escapedWord}">&#128264;</button>
            <p class="phonetic">${escapeHtml(item.phonetic)}</p>
          </div>
          <p class="memory-line">${listName === "reading" ? "Reading" : "Speaking"}: Right ${item.rightCount} / Wrong ${item.wrongCount}</p>
          <p class="meaning detail-line">Meaning: ${escapeHtml(item.meaning)}</p>
          <p class="example detail-line">Example: "${escapeHtml(item.example)}"</p>
          <div class="action-row speaking-list-full-actions">
            ${
              listName === "speaking"
                ? `<button class="ghost-button small-button ${speakingUi.isRecordingNow ? "is-active" : ""}" data-speaking-list-start="${escapedWord}" ${speakingUi.isProcessing || speakingUi.isJudged ? "disabled" : ""}>
                     ${speakingUi.isRecordingNow ? "Recording" : "Start"}
                   </button>
                   <button class="ghost-button small-button ${speakingUi.isProcessing || speakingUi.isJudged ? "is-active" : ""}" data-speaking-list-finish="${escapedWord}" ${
                     speakingUi.isProcessing || speakingUi.isJudged
                       ? "disabled"
                       : !speakingUi.isRecordingNow &&
                           !(speakingListPractice.word === item.word && (speakingListAudioBlob || speakingListPractice.attempt.trim()))
                         ? "disabled"
                         : ""
                   }>
                     ${speakingUi.isProcessing ? "Proceed" : speakingUi.isJudged ? "Judged" : "Finish"}
                   </button>
                   <button class="ghost-button small-button" data-speaking-list-retry="${escapedWord}" ${speakingUi.isJudged ? "" : "disabled"}>
                     Retry
                   </button>
                   <button class="ghost-button small-button" data-speaking-list-original="${escapedWord}" ${speakingUi.hasOriginalAudio ? "" : "disabled"}>
                     Original
                   </button>
                   ${speakingUi.isJudged && speakingUi.score !== null ? `<span class="speaking-list-score">Score ${speakingUi.score}/100</span>` : ""}
                   <button class="ghost-button small-button" data-delete-word="${escapedWord}" data-delete-list="${listName}">Delete</button>`
                : `<button class="ghost-button small-button" data-delete-word="${escapedWord}" data-delete-list="${listName}">Delete</button>`
            }
          </div>
        </article>
      `;
    })
    .join("");

  pageNode.textContent = `Page ${safePage} of ${totalPages}`;
  prevNode.disabled = safePage === 1;
  nextNode.disabled = safePage === totalPages;
  const allFilteredSelected = areAllFilteredWordsSelected(listName);
  selectAllButton.disabled = getCurrentFilteredWords(listName).length === 0;
  selectAllButton.textContent = allFilteredSelected ? "Cancel" : "Select All";
  selectAllButton.classList.toggle("is-active", allFilteredSelected);
  if (listName === "reading") elements.exportReadingButton.disabled = filtered.length === 0;
  else elements.exportSpeakingButton.disabled = filtered.length === 0;
  deleteSelectedButton.disabled = getSelectedWords(listName).length === 0;
}

function getReadingReviewWord() {
  if (!state.review.readingActive || !state.review.readingQueue.length) return null;
  const word = state.review.readingQueue[state.review.readingIndex];
  return state.readingList.find((item) => item.word === word) || null;
}

function startReadingReviewSession() {
  const count = parseInt(elements.readingReviewCount.value, 10) || 10;
  const queue = state.readingList.slice(0, count).map((item) => item.word);
  if (!queue.length) {
    showToast("Add reading words first.");
    return;
  }
  readingSessionResults = new Map();
  closeReviewSummary();
  state.review.readingActive = true;
  state.review.readingQueue = queue;
  state.review.readingIndex = 0;
  state.review.readingChoice = null;
  state.review.readingPending = null;
  saveState();
  renderReadingReview();
}

async function finishReadingReviewSession() {
  if (!state.review.readingActive) return;
  await commitReadingPending();
  const summaryResults = new Map(readingSessionResults);
  readingSessionResults = new Map();
  state.review.readingActive = false;
  state.review.readingQueue = [];
  state.review.readingIndex = 0;
  state.review.readingChoice = null;
  state.review.readingPending = null;
  saveState();
  renderReadingReview();
  openReviewSummary("Reading", summaryResults);
}

function renderReadingReview() {
  const item = getReadingReviewWord();
  const isActive = Boolean(state.review.readingActive && item);
  elements.readingReviewCard.classList.toggle("is-hidden", !isActive);
  elements.finishReadingReview.disabled = !state.review.readingActive;
  if (!isActive) {
    elements.readingReviewMeaningPanel.classList.add("is-hidden");
    return;
  }
  elements.readingReviewProgress.textContent = `Word ${state.review.readingIndex + 1} of ${state.review.readingQueue.length}`;
  elements.readingReviewWord.textContent = item.word;
  elements.readingReviewPhonetic.textContent = item.phonetic;
  elements.readingReviewMeaning.textContent = `Meaning: ${item.meaning}.`;
  elements.readingReviewExample.textContent = `Example: "${item.example}"`;
  elements.readingReviewMeaningPanel.classList.toggle("is-hidden", !state.review.readingChoice);
  elements.reviewYes.classList.toggle("is-active", state.review.readingChoice === "yes");
  elements.reviewNo.classList.toggle("is-active", state.review.readingChoice === "no");
  elements.readingReviewWrong.classList.toggle(
    "is-active",
    state.review.readingChoice === "remember-wrong"
  );
  elements.readingReviewWrong.disabled = !state.review.readingChoice;
  elements.readingReviewPrev.disabled = state.review.readingIndex === 0;
  elements.readingReviewNext.textContent =
    state.review.readingIndex >= state.review.readingQueue.length - 1 ? "Finish" : "Next Word";
  elements.readingReviewNext.disabled = !state.review.readingChoice;
}

async function commitReadingPending() {
  const item = getReadingReviewWord();
  if (!item || !state.review.readingPending) return;
  readingSessionResults.set(
    state.review.readingIndex,
    state.review.readingPending === "right" ? "right" : "wrong"
  );
  try {
    const response = await fetch("/api/review/reading", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word: item.word, result: state.review.readingPending }),
    });
    if (response.ok) {
      const data = await response.json();
      state.readingList = data.list;
    } else if (state.review.readingPending === "right") item.rightCount += 1;
    else item.wrongCount += 1;
  } catch {
    if (state.review.readingPending === "right") item.rightCount += 1;
    else item.wrongCount += 1;
  }
  state.review.readingPending = null;
  state.review.readingChoice = null;
  saveState();
}

function getSpeakingReviewWord() {
  if (!state.review.speakingActive || !state.review.speakingQueue.length) return null;
  const word = state.review.speakingQueue[state.review.speakingIndex];
  return state.speakingList.find((item) => item.word === word) || null;
}

function startSpeakingReviewSession(queueWords = null) {
  const requestedCount = parseInt(elements.speakingReviewCount.value, 10) || 10;
  const queue = queueWords?.length
    ? queueWords
    : state.speakingList.slice(0, requestedCount).map((item) => item.word);
  if (!queue.length) {
    showToast("Add speaking words first.");
    return;
  }
  speakingSessionResults = new Map();
  closeReviewSummary();
  state.review.speakingActive = true;
  state.review.speakingQueue = queue;
  state.review.speakingIndex = 0;
  state.review.speakingAttempt = "";
  state.review.speakingStatus = "Ready";
  state.review.speakingJudged = false;
  isSpeakingReviewProcessing = false;
  stopPlaybackAudio();
  speakingAudioBlob = null;
  saveState();
  renderSpeakingReview();
}

function finishSpeakingReviewSession() {
  const isRecordingNow =
    recordingMode === "speaking-review" || recognitionMode === "speaking-review";
  if (isRecordingNow || isSpeakingReviewProcessing) {
    showToast("Finish the current word first.");
    return;
  }
  const summaryResults = new Map(speakingSessionResults);
  speakingSessionResults = new Map();
  state.review.speakingActive = false;
  state.review.speakingQueue = [];
  state.review.speakingIndex = 0;
  state.review.speakingAttempt = "";
  state.review.speakingStatus = "Ready";
  state.review.speakingJudged = false;
  isSpeakingReviewProcessing = false;
  stopPlaybackAudio();
  speakingAudioBlob = null;
  saveState();
  renderSpeakingReview();
  openReviewSummary("Speaking", summaryResults);
}

function retrySpeakingReviewAttempt() {
  if (!state.review.speakingActive) return;
  const isRecordingNow =
    recordingMode === "speaking-review" || recognitionMode === "speaking-review";
  if (isRecordingNow || isSpeakingReviewProcessing) return;
  state.review.speakingAttempt = "";
  state.review.speakingStatus = "Ready";
  state.review.speakingJudged = false;
  isSpeakingReviewProcessing = false;
  stopPlaybackAudio();
  speakingAudioBlob = null;
  saveState();
  renderSpeakingReview();
}

async function judgeSpeakingListWord(word) {
  const item = state.speakingList.find((entry) => entry.word === word);
  if (!item || speakingListPractice.word !== word) return;

  if (!speakingListPractice.attempt.trim() && !speakingListAudioBlob) {
    isSpeakingListProcessing = false;
    speakingListPractice.judged = false;
    renderWordList("speaking");
    showToast("Please say the word first.");
    return;
  }

  try {
    const result = await getSpeakingJudgeResult(
      word,
      speakingListPractice.attempt,
      speakingListAudioBlob
    );
    speakingListPractice.attempt = result.heard || speakingListPractice.attempt;
    await updateSpeakingWordRecord(word, result.passed);
    saveState();
    speakingListPractice.judged = true;
    speakingListPractice.score = result.score;
    isSpeakingListProcessing = false;
    renderWordList("speaking");
    return;
  } catch {
    isSpeakingListProcessing = false;
    renderWordList("speaking");
    showToast("AI judge failed. Using local fallback.");
  }
}

function renderSpeakingReview() {
  const item = getSpeakingReviewWord();
  const isRecordingNow =
    recordingMode === "speaking-review" || recognitionMode === "speaking-review";
  const isActive = Boolean(state.review.speakingActive && item);
  elements.speakingReviewCard.classList.toggle("is-hidden", !isActive);
  elements.finishSpeakingSession.disabled =
    !state.review.speakingActive || isRecordingNow || isSpeakingReviewProcessing;
  if (!isActive) return;
  elements.speakingReviewProgress.textContent = `Word ${state.review.speakingIndex + 1} of ${state.review.speakingQueue.length}`;
  elements.speakingReviewWord.textContent = item.word;
  elements.speakingPhonetic.textContent = item.phonetic;
  elements.speakingPhonetic.classList.toggle("is-hidden", !state.review.speakingJudged);
  elements.speakingResult.textContent = state.review.speakingStatus || "Ready";
  elements.startSpeakingReview.textContent = isRecordingNow ? "Recording" : "Start";
  elements.startSpeakingReview.classList.toggle("is-active", isRecordingNow);
  elements.runAiJudge.textContent = isSpeakingReviewProcessing
    ? "Proceed"
    : state.review.speakingJudged
      ? "Judged"
      : "Finish";
  elements.runAiJudge.classList.toggle(
    "is-active",
    isSpeakingReviewProcessing || state.review.speakingJudged
  );
  elements.startSpeakingReview.disabled = isSpeakingReviewProcessing || state.review.speakingJudged;
  elements.runAiJudge.disabled =
    isSpeakingReviewProcessing ||
    state.review.speakingJudged ||
    (!isRecordingNow && !speakingAudioBlob && !state.review.speakingAttempt);
  elements.retrySpeakingReview.disabled = isRecordingNow || isSpeakingReviewProcessing || !state.review.speakingJudged;
  elements.originalSpeakingReview.disabled =
    isRecordingNow || isSpeakingReviewProcessing || !speakingAudioBlob;
  elements.speakingMemoryLine.textContent = `Speaking record: Right ${item.rightCount} times, wrong ${item.wrongCount} times.`;
  elements.speakingMemoryLine.classList.toggle("is-hidden", !state.review.speakingJudged);
  elements.speakingMeaning.textContent = `Meaning: ${item.meaning}.`;
  elements.speakingExample.textContent = `Example: "${item.example}"`;
  elements.speakingReviewPrev.disabled = state.review.speakingIndex === 0;
  elements.speakingReviewNext.textContent =
    state.review.speakingIndex >= state.review.speakingQueue.length - 1 ? "Finish" : "Next Word";
  elements.speakingReviewNext.disabled = !state.review.speakingJudged;
}

function buildReviewSummary(type, sessionResults) {
  const results = [...sessionResults.values()];
  const right = results.filter((result) => result === "right").length;
  const wrong = results.filter((result) => result === "wrong").length;
  const total = right + wrong;
  return {
    type,
    right,
    wrong,
    rate: total ? Math.round((right / total) * 100) : 0,
  };
}

function openReviewSummary(type, sessionResults) {
  reviewSummary = buildReviewSummary(type, sessionResults);
  renderReviewSummary();
}

function closeReviewSummary() {
  reviewSummary = null;
  renderReviewSummary();
}

function renderReviewSummary() {
  const isOpen = Boolean(reviewSummary);
  elements.reviewSummaryBackdrop.classList.toggle("is-open", isOpen);
  elements.reviewSummaryBackdrop.setAttribute("aria-hidden", String(!isOpen));
  elements.reviewSummaryModal.setAttribute("aria-hidden", String(!isOpen));
  if (!isOpen) return;
  elements.reviewSummaryType.textContent = `${reviewSummary.type} Review`;
  elements.reviewSummaryRight.textContent = String(reviewSummary.right);
  elements.reviewSummaryWrong.textContent = String(reviewSummary.wrong);
  elements.reviewSummaryRate.textContent = `Correction Rate: ${reviewSummary.rate}%`;
}

function renderAll() {
  renderToday();
  renderHistory();
  renderWordList("reading");
  renderWordList("speaking");
  renderReadingReview();
  renderSpeakingReview();
  renderReviewSummary();
}

function openSpeakingReviewTab(queueWords = null) {
  switchToView("settings");
  document.querySelectorAll("[data-review-tab]").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.reviewTab === "speaking");
  });
  document.querySelectorAll(".review-tab").forEach((tab) => tab.classList.remove("is-visible"));
  document.getElementById("review-tab-speaking").classList.add("is-visible");
  startSpeakingReviewSession(queueWords);
}

function startRecognition(mode) {
  if (!SpeechRecognitionApi) {
    if (mode === "today") {
      elements.micTestResult.textContent =
        "Recording works, but this browser does not support live speech recognition.";
      renderToday();
    } else {
      elements.speakingResult.textContent =
        "Microphone works, but this browser does not support speech recognition.";
    }
    showToast("Dia may allow the mic, but browser speech recognition is not available here.");
    return false;
  }

  if (activeRecognition) {
    if (recognitionMode === mode) return true;
    activeRecognition.stop();
  }

  const recognition = new SpeechRecognitionApi();
  recognition.lang = "en-US";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognitionMode = mode;
  activeRecognition = recognition;

  recognition.onstart = () => {
    if (mode !== "today") {
      if (mode === "speaking-review") {
        state.review.speakingStatus = "Recording";
        renderSpeakingReview();
      } else if (mode === "speaking-list") {
        renderWordList("speaking");
      }
    }
  };

  recognition.onresult = (event) => {
    micPermissionGranted = true;
    const transcript = collectRecognitionTranscript(event);
    if (mode === "today") {
      state.transcript = transcript;
      saveState();
      renderToday();
    } else if (mode === "speaking-review") {
      state.review.speakingAttempt = transcript;
      state.review.speakingStatus = transcript
        ? `Recording: "${transcript}"`
        : "Recording";
      state.review.speakingJudged = false;
      renderSpeakingReview();
    } else if (mode === "speaking-list") {
      speakingListPractice.attempt = transcript;
      speakingListPractice.judged = false;
      renderWordList("speaking");
    }
  };

  recognition.onerror = () => {
    showToast("Speech recognition failed in this browser.");
  };

  recognition.onend = () => {
    const endedMode = recognitionMode;
    activeRecognition = null;
    recognitionMode = null;
    if (endedMode === "today" && !isTodayRecording) {
      void maybeCompleteTodayPractice();
    } else if (endedMode === "speaking-review") {
      void maybeCompleteSpeakingReview();
    } else if (endedMode === "speaking-list") {
      void maybeCompleteSpeakingList();
    }
  };

  recognition.start();
  return true;
}

async function captureAudio(mode, targetWord = null) {
  if (mediaRecorder || activeRecognition) {
    showToast("Finish the current recording first.");
    return;
  }

  if (mode === "today") {
    isTodayRecording = true;
    todayAutoSubmitRequested = false;
    todayPracticeFinished = false;
    setTodayTranscriptProcessing(false);
    dailyAudioBlob = null;
    state.transcript = "";
    state.feedback = createEmptyFeedback();
    renderToday();
  } else {
    if (mode === "speaking-review") {
      stopPlaybackAudio();
      speakingAudioBlob = null;
      state.review.speakingAttempt = "";
      state.review.speakingStatus = "Recording";
      state.review.speakingJudged = false;
      isSpeakingReviewProcessing = false;
      speakingReviewAutoJudgeRequested = false;
      renderSpeakingReview();
    } else if (mode === "speaking-list") {
      resetSpeakingListPractice(targetWord);
      speakingListPractice.word = targetWord;
      renderWordList("speaking");
    }
  }

  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    const started = startRecognition(mode);
    if (!started && mode === "today") {
      isTodayRecording = false;
      updateTodayRecordingControls();
    }
    return;
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micPermissionGranted = true;
  } catch {
    showToast("Microphone permission was denied.");
    if (mode === "today") {
      isTodayRecording = false;
      elements.micTestResult.textContent =
        "Microphone is blocked in browser or system settings.";
      updateTodayRecordingControls();
      renderToday();
    } else {
      elements.speakingResult.textContent = "Microphone blocked.";
    }
    return;
  }
  const chunks = [];
  mediaRecorder = new MediaRecorder(stream);
  recordingMode = mode;

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  mediaRecorder.onstart = () => {
    if (mode === "speaking-review") {
      state.review.speakingStatus = "Recording";
      renderSpeakingReview();
    } else if (mode === "speaking-list") {
      renderWordList("speaking");
    }
  };

  mediaRecorder.onstop = () => {
    const blob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
    if (mode === "today") {
      dailyAudioBlob = blob;
    } else if (mode === "speaking-review") {
      speakingAudioBlob = blob;
      state.review.speakingStatus = "Processing";
      renderSpeakingReview();
    } else if (mode === "speaking-list") {
      speakingListAudioBlob = blob;
      renderWordList("speaking");
    }

    stream.getTracks().forEach((track) => track.stop());
    mediaRecorder = null;
    recordingMode = null;
    if (mode === "today") {
      isTodayRecording = false;
      updateTodayRecordingControls();
      void maybeCompleteTodayPractice();
    } else if (mode === "speaking-review") {
      void maybeCompleteSpeakingReview();
    } else if (mode === "speaking-list") {
      void maybeCompleteSpeakingList();
    }
  };

  mediaRecorder.start();
  startRecognition(mode);
}

function finishCapture(mode) {
  if (mode === "today") {
    if (!isTodayRecording && recordingMode !== "today" && recognitionMode !== "today") {
      showToast("Start speaking first.");
      return;
    }
    isTodayRecording = false;
    todayAutoSubmitRequested = true;
    todayPracticeFinished = false;
    setTodayTranscriptProcessing(true);
    updateTodayRecordingControls();
    renderToday();
  }

  if (mode !== "today") {
    const isCaptureActive =
      (activeRecognition && recognitionMode === mode) ||
      (mediaRecorder && recordingMode === mode);

    if (isCaptureActive) {
      if (mode === "speaking-review") {
        speakingReviewAutoJudgeRequested = true;
        isSpeakingReviewProcessing = true;
        state.review.speakingJudged = false;
        state.review.speakingStatus = "Processing";
        renderSpeakingReview();
      } else if (mode === "speaking-list") {
        speakingListAutoJudgeRequested = true;
        isSpeakingListProcessing = true;
        speakingListPractice.judged = false;
        renderWordList("speaking");
      }

      if (activeRecognition && recognitionMode === mode) {
        activeRecognition.stop();
      }

      if (mediaRecorder && recordingMode === mode) {
        mediaRecorder.stop();
      }

      return;
    }
  }

  if (activeRecognition && recognitionMode === mode) {
    activeRecognition.stop();
  }

  if (mediaRecorder && recordingMode === mode) {
    mediaRecorder.stop();
    return;
  }

  if (mode === "today") {
    void maybeCompleteTodayPractice();
  } else {
    if (mode === "speaking-review") {
      if (!state.review.speakingAttempt.trim() && !speakingAudioBlob) {
        showToast("Start speaking first.");
        state.review.speakingStatus = "Ready";
        renderSpeakingReview();
        return;
      }
      speakingReviewAutoJudgeRequested = true;
      isSpeakingReviewProcessing = true;
      state.review.speakingJudged = false;
      state.review.speakingStatus = "Processing";
      renderSpeakingReview();
      void maybeCompleteSpeakingReview();
    } else if (mode === "speaking-list") {
      if (!speakingListPractice.attempt.trim() && !speakingListAudioBlob) {
        showToast("Start speaking first.");
        renderWordList("speaking");
        return;
      }
      speakingListAutoJudgeRequested = true;
      isSpeakingListProcessing = true;
      speakingListPractice.judged = false;
      renderWordList("speaking");
      void maybeCompleteSpeakingList();
    }
  }
}

function restartTodayPractice() {
  stopPlaybackAudio();
  todayTranscribeRequestId += 1;
  todayAutoSubmitRequested = false;
  todayPracticeFinished = false;
  isTodayRecording = false;
  setTodayTranscriptProcessing(false);
  dailyAudioBlob = null;
  state.transcript = "";
  state.feedback = createEmptyFeedback();
  saveState();
  renderAll();
  showToast("Ready for a new recording.");
}

async function maybeCompleteSpeakingReview() {
  if (!speakingReviewAutoJudgeRequested) return;
  if (recordingMode === "speaking-review" || recognitionMode === "speaking-review") return;
  const item = getSpeakingReviewWord();
  if (!item) return;
  speakingReviewAutoJudgeRequested = false;
  await judgeSpeakingWord(item.word);
}

async function maybeCompleteSpeakingList() {
  if (!speakingListAutoJudgeRequested) return;
  if (recordingMode === "speaking-list" || recognitionMode === "speaking-list") return;
  if (!speakingListPractice.word) return;
  speakingListAutoJudgeRequested = false;
  await judgeSpeakingListWord(speakingListPractice.word);
}

async function saveTodayPracticeToHistory() {
  const payload = {
    date: todayPrompt.date,
    title: todayPrompt.title,
    summary: state.feedback.correctedTranscript || state.transcript || "",
    image: todayPrompt.image,
    originalTranscript: state.transcript,
    correctedTranscript: state.feedback.correctedTranscript || state.transcript || "",
    score: typeof state.feedback.overallScore === "number" ? state.feedback.overallScore : 89,
    easyExample: state.feedback.easy || "",
    advancedExample: state.feedback.advanced || "",
  };

  try {
    const historyResponse = await fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (historyResponse.ok) {
      const historyData = await historyResponse.json();
      state.history = historyData.history;
      return;
    }
  } catch {}

  state.history.unshift({
    id: `hist-${Date.now()}`,
    ...payload,
  });
}

async function processTodayPractice() {
  if (!state.transcript.trim() && !dailyAudioBlob) {
    setTodayTranscriptProcessing(false);
    todayPracticeFinished = false;
    renderToday();
    showToast("Please speak first so Claude can analyze your recording.");
    return;
  }

  const requestId = ++todayTranscribeRequestId;

  try {
    if (apiConfigured) {
      const result = await analyzeWithBackend();
      if (requestId !== todayTranscribeRequestId) return;
      if (result) {
        state.transcript = result.transcript || state.transcript;
        state.feedback = normalizeFeedback(result.feedback || createEmptyFeedback());
      }
    } else if (state.transcript.trim()) {
      state.feedback = normalizeFeedback(analyzeTranscript(state.transcript));
      showToast("AI is not configured. Using local feedback.");
    } else {
      showToast("Mic works, but Claude needs transcript support in this browser.");
      return;
    }

    if (!state.transcript.trim()) {
      showToast("No transcript was captured from this recording.");
      return;
    }

    await saveTodayPracticeToHistory();
    todayPracticeFinished = true;
  } catch {
    if (state.transcript.trim()) {
      state.feedback = normalizeFeedback(analyzeTranscript(state.transcript));
      await saveTodayPracticeToHistory();
      todayPracticeFinished = true;
      showToast("AI is unavailable. Using local feedback.");
    } else {
      todayPracticeFinished = false;
      showToast("This recording could not be processed.");
    }
  } finally {
    if (requestId === todayTranscribeRequestId) {
      setTodayTranscriptProcessing(false);
      saveState();
      renderAll();
    }
  }
}

async function maybeCompleteTodayPractice() {
  if (!todayAutoSubmitRequested) return;
  if (isTodayRecording) return;
  if (recognitionMode === "today" || recordingMode === "today") return;
  todayAutoSubmitRequested = false;
  await processTodayPractice();
}

async function testMicrophone() {
  if (!navigator.mediaDevices?.getUserMedia) {
    micPermissionGranted = false;
    elements.micTestResult.textContent =
      "This browser does not support microphone capture.";
    renderToday();
    showToast("Mic test failed.");
    return;
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micPermissionGranted = true;
    stream.getTracks().forEach((track) => track.stop());
    elements.micTestResult.textContent = SpeechRecognitionApi
      ? apiConfigured
        ? "Mic permission granted. Speech recognition available. AI available."
        : "Mic permission granted. Speech recognition available. AI not configured."
      : apiConfigured
        ? "Mic permission granted. Recording works. Speech recognition unsupported."
        : "Mic permission granted. Recording works. Speech recognition unsupported. AI not configured.";
    renderToday();
    showToast("Mic test passed.");
  } catch {
    micPermissionGranted = false;
    elements.micTestResult.textContent =
      "Microphone is blocked in browser or system settings.";
    renderToday();
    showToast("Mic test failed.");
  }
}

async function analyzeWithBackend() {
  if (!apiConfigured) return null;
  const formData = new FormData();
  formData.append("promptTitle", todayPrompt.title);
  formData.append("transcript", state.transcript || "");
  formData.append("imageUrl", todayPrompt.image || "");
  if (dailyAudioBlob) formData.append("audio", dailyAudioBlob, "today.webm");

  const response = await fetch("/api/analyze", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("AI analyze request failed.");
  }

  return response.json();
}

async function judgeSpeakingWord(word) {
  const item = state.speakingList.find((entry) => entry.word === word);
  if (!item) return;

  if (!state.review.speakingAttempt.trim() && !speakingAudioBlob) {
    state.review.speakingStatus = "Ready";
    isSpeakingReviewProcessing = false;
    state.review.speakingJudged = false;
    renderSpeakingReview();
    showToast("Please say the word first.");
    return;
  }

  const result = await getSpeakingJudgeResult(
    word,
    state.review.speakingAttempt,
    speakingAudioBlob
  ).catch(() => {
    showToast("AI judge failed. Using local fallback.");
    return getSpeakingJudgeResult(word, state.review.speakingAttempt, null);
  });
  const correct = result.passed;
  speakingSessionResults.set(state.review.speakingIndex, correct ? "right" : "wrong");
  state.review.speakingAttempt = result.heard || state.review.speakingAttempt;
  await updateSpeakingWordRecord(word, correct);
  saveState();
  renderWordList("speaking");
  state.review.speakingJudged = true;
  isSpeakingReviewProcessing = false;
  state.review.speakingStatus = correct
    ? `AI result: correct pronunciation. Score ${result.score}/100. ${result.feedback || ""}`.trim()
    : `AI result: not correct yet. Score ${result.score}/100. ${result.feedback || "Try the ending sound again."}`.trim();
  renderSpeakingReview();
}

document.querySelectorAll(".nav-link").forEach((button) => {
  button.addEventListener("click", () => {
    switchToView(button.dataset.view);
  });
});

document.querySelectorAll(".toggle-button").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.reviewTab) {
      document.querySelectorAll("[data-review-tab]").forEach((item) => item.classList.remove("is-active"));
      document.querySelectorAll(".review-tab").forEach((tab) => tab.classList.remove("is-visible"));
      button.classList.add("is-active");
      document.getElementById(`review-tab-${button.dataset.reviewTab}`).classList.add("is-visible");
      return;
    }

    if (button.dataset.wordMode) {
      const [group] = button.dataset.wordMode.split("-");
      document.querySelectorAll(`[data-word-mode^="${group}-"]`).forEach((item) => item.classList.remove("is-active"));
      document.querySelectorAll(`#${group}-lite-panel, #${group}-full-panel`).forEach((panel) => panel.classList.remove("is-visible"));
      button.classList.add("is-active");
      document.getElementById(`${button.dataset.wordMode}-panel`).classList.add("is-visible");
      renderWordList(group);
      return;
    }

    if (button.dataset.historyCardMode) {
      document.querySelectorAll("[data-history-card-mode]").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      historyCardMode = button.dataset.historyCardMode;
      historyPage = 1;
      renderHistory();
      return;
    }

    document.querySelectorAll(".toggle-button").forEach((item) => {
      if (!item.dataset.wordMode && !item.dataset.reviewTab && !item.dataset.historyCardMode) {
        item.classList.remove("is-active");
      }
    });
    document.querySelectorAll(".model-copy").forEach((copy) => copy.classList.remove("is-visible"));
    button.classList.add("is-active");
    document.getElementById(`model-${button.dataset.model}`).classList.add("is-visible");
  });
});

document.addEventListener("click", (event) => {
  const historySelectControl = event.target.closest("[data-history-select]");
  if (historySelectControl) {
    event.stopPropagation();
    return;
  }

  const wordSelectControl = event.target.closest("[data-list-select-word]");
  if (wordSelectControl) {
    event.stopPropagation();
    return;
  }

  const audioButton = event.target.closest("[data-word-audio]");
  if (audioButton) {
    speakWord(audioButton.dataset.wordAudio);
    return;
  }

  const historyDeleteButton = event.target.closest("[data-history-delete]");
  if (historyDeleteButton) {
    event.stopPropagation();
    deleteHistory(historyDeleteButton.dataset.historyDelete);
    return;
  }

  const historyCard = event.target.closest("[data-history-open]");
  if (historyCard) {
    openHistoryPreview(historyCard.dataset.historyOpen);
    return;
  }

  const exampleAudioButton = event.target.closest("[data-example-audio]");
  if (exampleAudioButton) {
    const text =
      exampleAudioButton.dataset.exampleAudio === "advanced"
        ? elements.modelAdvancedText.textContent
        : elements.modelEasyText.textContent;
    speakText(text);
    return;
  }

  const deleteButton = event.target.closest("[data-delete-word]");
  if (deleteButton) {
    event.stopPropagation();
    removeWordFromList(deleteButton.dataset.deleteWord, deleteButton.dataset.deleteList);
    return;
  }

  const practiceButton = event.target.closest("[data-practice-word]");
  if (practiceButton) {
    event.stopPropagation();
    openSpeakingReviewTab([practiceButton.dataset.practiceWord]);
    showToast(`Start "${practiceButton.dataset.practiceWord}"`);
    return;
  }

  const judgeButton = event.target.closest("[data-judge-word]");
  if (judgeButton) {
    event.stopPropagation();
    const word = judgeButton.dataset.judgeWord;
    openSpeakingReviewTab([word]);
    showToast(`Finish "${word}" in Review`);
    return;
  }

  const speakingListStartButton = event.target.closest("[data-speaking-list-start]");
  if (speakingListStartButton) {
    event.stopPropagation();
    if (
      (mediaRecorder && recordingMode === "speaking-list") ||
      (activeRecognition && recognitionMode === "speaking-list")
    ) {
      showToast("Press Finish to stop and judge this word.");
      return;
    }
    captureAudio("speaking-list", speakingListStartButton.dataset.speakingListStart);
    return;
  }

  const speakingListFinishButton = event.target.closest("[data-speaking-list-finish]");
  if (speakingListFinishButton) {
    event.stopPropagation();
    speakingListPractice.word = speakingListFinishButton.dataset.speakingListFinish;
    finishCapture("speaking-list");
    return;
  }

  const speakingListRetryButton = event.target.closest("[data-speaking-list-retry]");
  if (speakingListRetryButton) {
    event.stopPropagation();
    resetSpeakingListPractice(speakingListRetryButton.dataset.speakingListRetry);
    renderWordList("speaking");
    return;
  }

  const speakingListOriginalButton = event.target.closest("[data-speaking-list-original]");
  if (speakingListOriginalButton) {
    event.stopPropagation();
    if (
      speakingListPractice.word !== speakingListOriginalButton.dataset.speakingListOriginal ||
      !speakingListAudioBlob
    ) {
      showToast("No original recording available yet.");
      return;
    }
    playOriginalAudio(speakingListAudioBlob);
    return;
  }

  const wordButton = event.target.closest("[data-word-select]");
  if (wordButton) {
    const word = wordButton.dataset.wordSelect;
    setSelectedWord(word, wordButton);
    if (wordButton.dataset.wordSurface === "full") {
      return;
    }
    const entry = lookupWordEntry(word);
    if (entry) {
      elements.drawerWord.textContent = word;
      elements.drawerAudio.setAttribute("aria-label", `Play pronunciation for ${word}`);
      elements.drawerPhonetic.textContent = entry.phonetic;
      elements.drawerMeaning.textContent = `Meaning: ${entry.meaning}`;
      elements.drawerExample.textContent = `Example: "${entry.example}"`;
      elements.drawer.dataset.word = word;
      elements.drawer.classList.add("is-open");
      elements.drawer.setAttribute("aria-hidden", "false");
    }
    return;
  }
});

document.addEventListener("change", (event) => {
  const historySelectControl = event.target.closest?.("[data-history-select]");
  if (historySelectControl) {
    toggleHistorySelection(historySelectControl.dataset.historySelect, historySelectControl.checked);
    return;
  }

  const wordSelectControl = event.target.closest?.("[data-list-select-word]");
  if (!wordSelectControl) return;
  toggleWordSelection(
    wordSelectControl.dataset.listSelectName,
    wordSelectControl.dataset.listSelectWord,
    event.target.checked
  );
});

document.addEventListener("keydown", async (event) => {
  const key = event.key.toLowerCase();
  const historyCard = document.activeElement?.closest?.("[data-history-open]");

  if ((key === "enter" || key === " ") && historyCard) {
    event.preventDefault();
    openHistoryPreview(historyCard.dataset.historyOpen);
    return;
  }

  if (event.key === "Escape" && activeHistoryPreviewId) {
    closeHistoryPreview();
    return;
  }

  if (isTypingTarget(event.target)) return;
  if (key !== "r" && key !== "s") return;

  event.preventDefault();

  const highlightedText = getMouseSelectedText();
  const wordToSave = highlightedText || selectedWord;

  if (!wordToSave) {
    showToast("Highlight text or click a word first.");
    return;
  }

  if (key === "r") await saveWordToList(wordToSave, "reading");
  if (key === "s") await saveWordToList(wordToSave, "speaking");
});

elements.startSpeakingButton.addEventListener("click", () => captureAudio("today"));
elements.finishSpeakingButton.addEventListener("click", () => finishCapture("today"));
elements.testMicButton.addEventListener("click", () => testMicrophone());
elements.restartSpeakingButton.addEventListener("click", () => restartTodayPractice());
elements.playOriginalSpeakingButton.addEventListener("click", () => {
  playOriginalAudio(dailyAudioBlob);
});

elements.historySearch.addEventListener("input", () => {
  historyPage = 1;
  clearHistorySelection();
  renderHistory();
});
elements.historyDate.addEventListener("change", () => {
  historyPage = 1;
  historyFilterMode = elements.historyDate.value ? "date" : "all";
  clearHistorySelection();
  renderHistory();
});
elements.historyAllButton.addEventListener("click", () => {
  historyFilterMode = "all";
  elements.historyDate.value = "";
  historyPage = 1;
  clearHistorySelection();
  renderHistory();
});
elements.historyMonthModeButton.addEventListener("click", () => {
  historyFilterMode = "month";
  elements.historyDate.value = "";
  historyPage = 1;
  clearHistorySelection();
  renderHistory();
});
elements.historyDateModeButton.addEventListener("click", () => {
  historyFilterMode = "date";
  historyPage = 1;
  clearHistorySelection();
  renderHistory();
});
elements.historyYear.addEventListener("change", () => {
  historyFilterMode = "month";
  historyYear = elements.historyYear.value;
  elements.historyDate.value = "";
  historyPage = 1;
  clearHistorySelection();
  renderHistory();
});
elements.historyMonth.addEventListener("change", () => {
  historyFilterMode = "month";
  historyMonth = elements.historyMonth.value;
  elements.historyDate.value = "";
  historyPage = 1;
  clearHistorySelection();
  renderHistory();
});
elements.historyPrev.addEventListener("click", () => {
  if (historyPage > 1) historyPage -= 1;
  renderHistory();
});
elements.historyNext.addEventListener("click", () => {
  historyPage += 1;
  renderHistory();
});
elements.deleteAllHistory.addEventListener("click", () => {
  deleteAllHistory();
});
elements.selectAllHistoryButton.addEventListener("click", () => {
  selectAllFilteredHistory();
});
elements.exportHistoryButton.addEventListener("click", () => {
  exportHistoryCsv();
});

elements.vocabularySearch.addEventListener("input", () => {
  readingPage = 1;
  clearWordSelection("reading");
  renderWordList("reading");
});
elements.vocabularySort.addEventListener("change", () => {
  readingPage = 1;
  clearWordSelection("reading");
  renderWordList("reading");
});
elements.selectAllReadingButton.addEventListener("click", () => {
  selectAllFilteredWords("reading");
});
elements.exportReadingButton.addEventListener("click", () => {
  exportWordListCsv("reading");
});
elements.deleteSelectedReadingButton.addEventListener("click", () => {
  deleteSelectedWords("reading");
});
elements.vocabularyPrev.addEventListener("click", () => {
  if (readingPage > 1) readingPage -= 1;
  renderWordList("reading");
});
elements.vocabularyNext.addEventListener("click", () => {
  readingPage += 1;
  renderWordList("reading");
});

elements.speakingSearch.addEventListener("input", () => {
  speakingPage = 1;
  clearWordSelection("speaking");
  renderWordList("speaking");
});
elements.speakingSort.addEventListener("change", () => {
  speakingPage = 1;
  clearWordSelection("speaking");
  renderWordList("speaking");
});
elements.selectAllSpeakingButton.addEventListener("click", () => {
  selectAllFilteredWords("speaking");
});
elements.exportSpeakingButton.addEventListener("click", () => {
  exportWordListCsv("speaking");
});
elements.deleteSelectedSpeakingButton.addEventListener("click", () => {
  deleteSelectedWords("speaking");
});
elements.speakingPrev.addEventListener("click", () => {
  if (speakingPage > 1) speakingPage -= 1;
  renderWordList("speaking");
});
elements.speakingNext.addEventListener("click", () => {
  speakingPage += 1;
  renderWordList("speaking");
});

elements.startReadingReview.addEventListener("click", () => {
  startReadingReviewSession();
});
elements.finishReadingReview.addEventListener("click", async () => {
  await finishReadingReviewSession();
});
elements.reviewYes.addEventListener("click", () => {
  if (!state.review.readingActive) return;
  state.review.readingChoice = "yes";
  state.review.readingPending = "right";
  renderReadingReview();
});
elements.reviewNo.addEventListener("click", () => {
  if (!state.review.readingActive) return;
  state.review.readingChoice = "no";
  state.review.readingPending = "wrong";
  renderReadingReview();
});
elements.readingReviewWrong.addEventListener("click", () => {
  if (!state.review.readingActive || !state.review.readingChoice) return;
  state.review.readingChoice = "remember-wrong";
  state.review.readingPending = "wrong";
  renderReadingReview();
});
elements.readingReviewPrev.addEventListener("click", () => {
  if (!state.review.readingActive) return;
  if (state.review.readingIndex > 0) state.review.readingIndex -= 1;
  state.review.readingChoice = null;
  state.review.readingPending = null;
  renderReadingReview();
});
elements.readingReviewNext.addEventListener("click", async () => {
  if (!state.review.readingActive) return;
  if (state.review.readingIndex >= state.review.readingQueue.length - 1) {
    await finishReadingReviewSession();
    return;
  }
  await commitReadingPending();
  if (state.review.readingIndex < state.review.readingQueue.length - 1) state.review.readingIndex += 1;
  renderReadingReview();
});
elements.readingReviewAudio.addEventListener("click", () => {
  const item = getReadingReviewWord();
  if (item) speakWord(item.word);
});

elements.startSpeakingSession.addEventListener("click", () => {
  startSpeakingReviewSession();
});
elements.finishSpeakingSession.addEventListener("click", () => {
  finishSpeakingReviewSession();
});
elements.startSpeakingReview.addEventListener("click", () => {
  if (mediaRecorder && recordingMode === "speaking-review") {
    showToast("Press Finish to stop and judge this word.");
    return;
  }
  if (activeRecognition && recognitionMode === "speaking-review") {
    showToast("Press Finish to stop and judge this word.");
    return;
  }
  captureAudio("speaking-review");
});
elements.runAiJudge.addEventListener("click", async () => {
  finishCapture("speaking-review");
});
elements.retrySpeakingReview.addEventListener("click", () => {
  retrySpeakingReviewAttempt();
});
elements.originalSpeakingReview.addEventListener("click", () => {
  playOriginalAudio(speakingAudioBlob);
});
elements.speakingReviewPrev.addEventListener("click", () => {
  if (!state.review.speakingActive) return;
  if (state.review.speakingIndex > 0) state.review.speakingIndex -= 1;
  state.review.speakingAttempt = "";
  state.review.speakingStatus = "Ready";
  state.review.speakingJudged = false;
  isSpeakingReviewProcessing = false;
  stopPlaybackAudio();
  speakingAudioBlob = null;
  renderSpeakingReview();
});
elements.speakingReviewNext.addEventListener("click", () => {
  if (!state.review.speakingActive) return;
  if (!state.review.speakingJudged) return;
  if (state.review.speakingIndex >= state.review.speakingQueue.length - 1) {
    finishSpeakingReviewSession();
    return;
  }
  if (state.review.speakingIndex < state.review.speakingQueue.length - 1) state.review.speakingIndex += 1;
  state.review.speakingAttempt = "";
  state.review.speakingStatus = "Ready";
  state.review.speakingJudged = false;
  isSpeakingReviewProcessing = false;
  stopPlaybackAudio();
  speakingAudioBlob = null;
  renderSpeakingReview();
});
elements.speakingReviewAudio.addEventListener("click", () => {
  const item = getSpeakingReviewWord();
  if (item) speakWord(item.word);
});

elements.closeDrawer.addEventListener("click", () => {
  elements.drawer.classList.remove("is-open");
  elements.drawer.setAttribute("aria-hidden", "true");
});
elements.drawerAudio.addEventListener("click", () => {
  if (elements.drawer.dataset.word) speakWord(elements.drawer.dataset.word);
});
elements.addReading.addEventListener("click", () => {
  if (elements.drawer.dataset.word) saveWordToList(elements.drawer.dataset.word, "reading");
});
elements.addSpeaking.addEventListener("click", () => {
  if (elements.drawer.dataset.word) saveWordToList(elements.drawer.dataset.word, "speaking");
});
elements.closeHistoryPreview.addEventListener("click", () => {
  closeHistoryPreview();
});
elements.closeReviewSummary.addEventListener("click", () => {
  closeReviewSummary();
});
elements.openHistoryDetails.addEventListener("click", () => {
  if (activeHistoryPreviewId) openHistoryDetailsInToday(activeHistoryPreviewId);
});
elements.deleteHistoryEntry.addEventListener("click", () => {
  if (activeHistoryPreviewId) deleteHistory(activeHistoryPreviewId);
});
elements.backToTodayButton.addEventListener("click", () => {
  returnToLiveToday();
});
elements.historyPreviewBackdrop.addEventListener("click", (event) => {
  if (event.target === elements.historyPreviewBackdrop) {
    closeHistoryPreview();
  }
});

Promise.all([checkApiHealth(), loadBootstrap()]).finally(renderAll);
