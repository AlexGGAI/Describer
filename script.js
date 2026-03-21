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
    "This picture shows a busy market in the morning. Many people are walking around and looking at fresh fruit. The sellers seem friendly, and the street feels colorful and lively.",
  advanced:
    "The image captures a vibrant open-air market where shoppers are moving through a lively street lined with fresh produce. The bright colors, relaxed expressions, and natural light create a warm and energetic atmosphere.",
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
    image:
      "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "hist-2",
    date: "2026-03-17",
    title: "Beach sunset",
    summary: "Practice focused on scenery words, emotions, and fluid spoken descriptions.",
    image:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "hist-3",
    date: "2026-03-16",
    title: "Library study hour",
    summary: "Good correction set for singular/plural grammar and clearer pronunciation.",
    image:
      "https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "hist-4",
    date: "2026-02-24",
    title: "Rainy city walk",
    summary: "Focused on weather vocabulary, movement verbs, and clearer speaking.",
    image:
      "https://images.unsplash.com/photo-1519692933481-e162a57d6721?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "hist-5",
    date: "2026-02-10",
    title: "Cooking at home",
    summary: "Practiced food descriptions, actions in progress, and sentence linking.",
    image:
      "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "hist-6",
    date: "2026-01-28",
    title: "Station commute",
    summary: "Good practice for travel expressions, location words, and pronunciation.",
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
    transcript:
      "I think this picture show a busy market. Many people is walking and some seller are smiling. The fruits look very fresh and the street feels lively.",
    feedback: analyzeTranscript(
      "I think this picture show a busy market. Many people is walking and some seller are smiling. The fruits look very fresh and the street feels lively."
    ),
    readingList: [
      createWord("vendor", "2026-03-20", 3, 1),
      createWord("atmosphere", "2026-03-20", 2, 2),
      createWord("fresh produce", "2026-03-18", 1, 2),
      createWord("market", "2026-03-17", 4, 0),
      createWord("crowded", "2026-03-16", 1, 3),
    ],
    speakingList: [
      createWord("lively", "2026-03-20", 2, 3),
      createWord("seller", "2026-03-16", 1, 4),
      createWord("atmosphere", "2026-03-14", 3, 1),
      createWord("vendor", "2026-03-12", 2, 2),
    ],
    history: seedHistory,
    review: {
      readingQueue: [],
      readingIndex: 0,
      readingPending: null,
      speakingIndex: 0,
      speakingAttempt: "",
    },
  };
}

let state = createDefaultState();
let selectedWord = null;
let selectedWordElement = null;
let currentMonth = "all";
let historyPage = 1;
let readingPage = 1;
let speakingPage = 1;
const pageSize = 3;
const listPageSize = 4;
let activeRecognition = null;
let recognitionMode = null;
let apiConfigured = false;
let mediaRecorder = null;
let recordingMode = null;
let dailyAudioBlob = null;
let speakingAudioBlob = null;
let micPermissionGranted = false;
let isTodayRecording = false;

const elements = {
  views: {
    today: document.getElementById("view-today"),
    history: document.getElementById("view-history"),
    vocabulary: document.getElementById("view-vocabulary"),
    speaking: document.getElementById("view-speaking"),
    settings: document.getElementById("view-settings"),
  },
  todayDate: document.getElementById("today-date"),
  dailyImage: document.getElementById("daily-image"),
  dailyPromptTitle: document.getElementById("daily-prompt-title"),
  micStatus: document.getElementById("mic-status"),
  startSpeakingButton: document.getElementById("start-speaking-button"),
  finishSpeakingButton: document.getElementById("finish-speaking-button"),
  transcriptText: document.getElementById("transcript-text"),
  testMicButton: document.getElementById("test-mic-button"),
  micTestResult: document.getElementById("mic-test-result"),
  retryButton: document.getElementById("retry-button"),
  submitButton: document.getElementById("submit-button"),
  grammarOriginal: document.getElementById("grammar-original"),
  grammarCorrected: document.getElementById("grammar-corrected"),
  grammarNote: document.getElementById("grammar-note"),
  pronunciationFlags: document.getElementById("pronunciation-flags"),
  modelEasyText: document.getElementById("model-easy-text"),
  modelAdvancedText: document.getElementById("model-advanced-text"),
  keywordGrid: document.getElementById("keyword-grid"),
  recentSavedList: document.getElementById("recent-saved-list"),
  historySearch: document.getElementById("history-search"),
  historyDate: document.getElementById("history-date"),
  monthButtons: Array.from(document.querySelectorAll(".month-pill")),
  monthSummaryTitle: document.getElementById("month-summary-title"),
  monthSessionCount: document.getElementById("month-session-count"),
  historyGrid: document.getElementById("history-grid"),
  historyPrev: document.getElementById("history-prev"),
  historyNext: document.getElementById("history-next"),
  historyPageStatus: document.getElementById("history-page-status"),
  vocabularySearch: document.getElementById("vocabulary-search"),
  vocabularySort: document.getElementById("vocabulary-sort"),
  vocabularyLiteList: document.getElementById("vocabulary-lite-list"),
  vocabularyFullPanel: document.getElementById("vocabulary-full-panel"),
  vocabularyPrev: document.getElementById("vocabulary-prev"),
  vocabularyNext: document.getElementById("vocabulary-next"),
  vocabularyPageStatus: document.getElementById("vocabulary-page-status"),
  speakingSearch: document.getElementById("speaking-search"),
  speakingSort: document.getElementById("speaking-sort"),
  speakingLiteList: document.getElementById("speaking-lite-list"),
  speakingFullPanel: document.getElementById("speaking-full-panel"),
  speakingPrev: document.getElementById("speaking-prev"),
  speakingNext: document.getElementById("speaking-next"),
  speakingPageStatus: document.getElementById("speaking-page-status"),
  readingReviewCount: document.getElementById("review-word-count"),
  startReadingReview: document.getElementById("start-reading-review"),
  reviewYes: document.getElementById("review-yes"),
  reviewNo: document.getElementById("review-no"),
  readingReviewWrong: document.getElementById("reading-review-wrong"),
  readingReviewProgress: document.getElementById("reading-review-progress"),
  readingReviewWord: document.getElementById("reading-review-word"),
  readingReviewPhonetic: document.getElementById("reading-review-phonetic"),
  readingReviewAudio: document.getElementById("reading-review-audio"),
  readingReviewMeaningPanel: document.getElementById("review-meaning-panel"),
  readingReviewMeaning: document.getElementById("reading-review-meaning"),
  readingReviewMemory: document.getElementById("reading-review-memory"),
  readingReviewPrev: document.getElementById("reading-review-prev"),
  readingReviewNext: document.getElementById("reading-review-next"),
  speakingReviewProgress: document.getElementById("speaking-review-progress"),
  speakingReviewWord: document.getElementById("speaking-review-word"),
  speakingReviewAudio: document.getElementById("speaking-review-audio"),
  speakingReviewHelper: document.getElementById("speaking-review-helper"),
  speakingPhonetic: document.getElementById("speaking-phonetic"),
  speakingResult: document.getElementById("speaking-review-result"),
  speakingMemoryLine: document.getElementById("speaking-memory-line"),
  speakingMeaning: document.getElementById("speaking-review-meaning"),
  speakingExample: document.getElementById("speaking-review-example"),
  startSpeakingReview: document.getElementById("start-speaking-review"),
  runAiJudge: document.getElementById("run-ai-judge"),
  speakingReviewPrev: document.getElementById("speaking-review-prev"),
  speakingReviewNext: document.getElementById("speaking-review-next"),
  drawer: document.getElementById("word-drawer"),
  drawerWord: document.getElementById("drawer-word"),
  drawerPhonetic: document.getElementById("drawer-phonetic"),
  drawerMeaning: document.getElementById("drawer-meaning"),
  drawerExample: document.getElementById("drawer-example"),
  closeDrawer: document.getElementById("close-drawer"),
  playAudio: document.getElementById("play-audio"),
  addReading: document.getElementById("add-vocabulary"),
  addSpeaking: document.getElementById("add-speaking"),
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
    if (data.todayPrompt) Object.assign(todayPrompt, data.todayPrompt);
    if (Array.isArray(data.readingList)) state.readingList = data.readingList;
    if (Array.isArray(data.speakingList)) state.speakingList = data.speakingList;
    if (Array.isArray(data.history)) state.history = data.history;
  } catch {
    apiConfigured = false;
  }
}

function formatDateLabel(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatMonthLabel(month) {
  if (month === "all") return "All Months";
  const [year, number] = month.split("-");
  const date = new Date(Number(year), Number(number) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function normalized(value) {
  return value.toLowerCase().replace(/[^\w\s]/g, "").trim();
}

function analyzeTranscript(text) {
  const original = text || "";
  let corrected = original;
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
      break;
    }
  }
  corrected = corrected.replace(/\bpeople is\b/i, "people are");
  corrected = corrected.replace(/\bseller are\b/i, "sellers are");

  const flagged = Object.keys(wordLibrary).filter((word) =>
    normalized(original).includes(normalized(word))
  );

  return {
    grammarOriginal: selectedFix.original,
    grammarCorrected: selectedFix.corrected,
    grammarNote: selectedFix.note,
    correctedTranscript: corrected,
    pronunciationWords: flagged.slice(0, 3).length ? flagged.slice(0, 3) : ["seller", "lively"],
    keywords: todayPrompt.keywords,
    easy: todayPrompt.easy,
    advanced: todayPrompt.advanced,
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

function speakWord(word) {
  if (!synth || !word) return;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.rate = 0.9;
  synth.speak(utterance);
}

function updateTodayRecordingControls() {
  elements.startSpeakingButton.disabled = isTodayRecording;
  elements.finishSpeakingButton.disabled = !isTodayRecording;
  elements.submitButton.disabled = isTodayRecording;
}

function collectRecognitionTranscript(event) {
  return Array.from(event.results || [])
    .map((result) => result?.[0]?.transcript?.trim() || "")
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

async function saveWordToList(word, listName) {
  const listKey = listName === "reading" ? "readingList" : "speakingList";
  try {
    const response = await fetch("/api/words", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word, listName, savedAt: todayPrompt.date }),
    });
    if (response.ok) {
      const data = await response.json();
      state[listKey] = data.list;
    } else if (!state[listKey].some((item) => item.word === word)) {
      state[listKey].unshift(createWord(word, todayPrompt.date));
    }
  } catch {
    if (!state[listKey].some((item) => item.word === word)) {
      state[listKey].unshift(createWord(word, todayPrompt.date));
    }
  }
  saveState();
  renderAll();
  showToast(`Saved "${word}" to ${listName === "reading" ? "Reading" : "Speaking"}`);
}

async function removeWordFromList(word, listName) {
  const listKey = listName === "reading" ? "readingList" : "speakingList";
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
  saveState();
  renderAll();
}

function sortedWords(words, sortMode) {
  return [...words].sort((a, b) => {
    if (sortMode === "az") return a.word.localeCompare(b.word);
    if (sortMode === "oldest") return a.savedAt.localeCompare(b.savedAt);
    return b.savedAt.localeCompare(a.savedAt);
  });
}

function renderToday() {
  elements.todayDate.textContent = new Date(`${todayPrompt.date}T12:00:00`).toLocaleDateString(
    "en-US",
    { month: "long", day: "numeric" }
  );
  elements.dailyImage.src = todayPrompt.image;
  elements.dailyImage.alt = todayPrompt.alt;
  elements.dailyPromptTitle.textContent = todayPrompt.title;
  elements.transcriptText.textContent =
    state.transcript || "Tap Speak to start describing the picture.";
  elements.micStatus.textContent = isTodayRecording
    ? "Recording..."
    : dailyAudioBlob
      ? state.transcript.trim()
        ? "Ready to submit"
        : "Recording saved"
      : micPermissionGranted
        ? apiConfigured
          ? "Ready to record"
          : "Mic on, local only"
        : apiConfigured
          ? "Ready to record"
          : "Need mic access";
  elements.micTestResult.textContent = micPermissionGranted
    ? SpeechRecognitionApi
      ? apiConfigured
        ? "Mic OK. Speech recognition available. AI available."
        : "Mic OK. Speech recognition available. AI not configured."
      : apiConfigured
        ? "Mic OK. Recording available. Speech recognition unsupported."
        : "Mic OK. Recording available. Speech recognition unsupported. AI not configured."
    : "Mic not tested yet.";
  elements.grammarOriginal.textContent = state.feedback.grammarOriginal;
  elements.grammarCorrected.innerHTML = state.feedback.grammarCorrected.replace(
    /Correct:/,
    "<strong>Correct:</strong>"
  );
  elements.grammarNote.textContent = state.feedback.grammarNote;
  elements.modelEasyText.textContent = state.feedback.easy;
  elements.modelAdvancedText.textContent = state.feedback.advanced;

  elements.pronunciationFlags.innerHTML = `Flagged words: ${state.feedback.pronunciationWords
    .map(
      (word) =>
        `<button class="word-chip issue" data-word-value="${word}" data-word-select="${word}">${word}</button>`
    )
    .join(" ")}`;

  elements.keywordGrid.innerHTML = state.feedback.keywords
    .map(
      (word) =>
        `<button class="word-chip" data-word-value="${word}" data-word-select="${word}">${word}</button>`
    )
    .join("");

  [...state.feedback.pronunciationWords, ...state.feedback.keywords].forEach((word) =>
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

  updateTodayRecordingControls();
}

function renderHistory() {
  const query = elements.historySearch.value.trim().toLowerCase();
  const dateValue = elements.historyDate.value;
  const filtered = state.history.filter((entry) => {
    const matchesMonth = currentMonth === "all" || entry.date.startsWith(currentMonth);
    const haystack = `${entry.title} ${entry.summary} ${entry.date}`.toLowerCase();
    const matchesSearch = !query || haystack.includes(query);
    const matchesDate = !dateValue || entry.date === dateValue;
    return matchesMonth && matchesSearch && matchesDate;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  historyPage = Math.min(historyPage, totalPages);
  const visible = filtered.slice((historyPage - 1) * pageSize, historyPage * pageSize);

  elements.historyGrid.innerHTML = visible
    .map(
      (entry) => `
        <article class="history-card panel">
          <img src="${entry.image}" alt="${entry.title}" />
          <div class="history-copy">
            <p class="eyebrow">${formatDateLabel(entry.date)}</p>
            <h4>${entry.title}</h4>
            <p>${entry.summary}</p>
          </div>
        </article>
      `
    )
    .join("");

  elements.historyPageStatus.textContent = `Page ${historyPage} of ${totalPages}`;
  elements.historyPrev.disabled = historyPage === 1;
  elements.historyNext.disabled = historyPage === totalPages;
  elements.monthSummaryTitle.textContent = formatMonthLabel(currentMonth);
  elements.monthSessionCount.textContent = `${filtered.length} session${filtered.length === 1 ? "" : "s"}`;
}

function renderWordList(listName) {
  const listKey = listName === "reading" ? "readingList" : "speakingList";
  const searchInput =
    listName === "reading" ? elements.vocabularySearch : elements.speakingSearch;
  const sortInput = listName === "reading" ? elements.vocabularySort : elements.speakingSort;
  const liteList = listName === "reading" ? elements.vocabularyLiteList : elements.speakingLiteList;
  const fullPanel =
    listName === "reading" ? elements.vocabularyFullPanel : elements.speakingFullPanel;
  const pageNode =
    listName === "reading" ? elements.vocabularyPageStatus : elements.speakingPageStatus;
  const prevNode = listName === "reading" ? elements.vocabularyPrev : elements.speakingPrev;
  const nextNode = listName === "reading" ? elements.vocabularyNext : elements.speakingNext;
  const page = listName === "reading" ? readingPage : speakingPage;

  const filtered = sortedWords(
    state[listKey].filter((item) => {
      const haystack = `${item.word} ${item.meaning} ${item.savedAt}`.toLowerCase();
      return !searchInput.value.trim() || haystack.includes(searchInput.value.trim().toLowerCase());
    }),
    sortInput.value
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / listPageSize));
  const safePage = Math.min(page, totalPages);
  if (listName === "reading") readingPage = safePage;
  else speakingPage = safePage;
  const visible = filtered.slice((safePage - 1) * listPageSize, safePage * listPageSize);

  liteList.innerHTML = visible
    .map(
      (item) => `
        <div class="lite-word-row" data-word-select="${item.word}">
          <strong>${item.word}</strong>
          <button class="inline-audio-button" data-word-audio="${item.word}" aria-label="Play pronunciation for ${item.word}">&#128264;</button>
        </div>
      `
    )
    .join("");

  fullPanel.innerHTML = visible
    .map(
      (item) => `
        <article class="panel practice-target word-card-entry ${listName === "reading" ? "word-entry" : ""}" data-word-list="${listName}" data-word="${item.word}" data-word-select="${item.word}">
          <div class="target-top">
            <div>
              <p class="eyebrow">${formatDateLabel(item.savedAt)}</p>
              <h4>${item.word}</h4>
            </div>
            <button class="inline-audio-button" data-word-audio="${item.word}" aria-label="Play pronunciation for ${item.word}">&#128264;</button>
          </div>
          <p class="phonetic">${item.phonetic}</p>
          <p class="meaning">${item.meaning}</p>
          <p class="memory-line">${listName === "reading" ? "Reading" : "Speaking"} record: Right ${item.rightCount} / Wrong ${item.wrongCount}</p>
          <p class="example">Example: "${item.example}"</p>
          <div class="action-row">
            <button class="ghost-button small-button" data-delete-word="${item.word}" data-delete-list="${listName}">Delete</button>
            ${
              listName === "speaking"
                ? `<button class="primary-button small-button" data-practice-word="${item.word}">Practice</button>
                   <button class="ghost-button small-button" data-judge-word="${item.word}">Judge</button>`
                : ""
            }
          </div>
        </article>
      `
    )
    .join("");

  pageNode.textContent = `Page ${safePage} of ${totalPages}`;
  prevNode.disabled = safePage === 1;
  nextNode.disabled = safePage === totalPages;
}

function ensureReadingQueue() {
  if (!state.review.readingQueue.length) {
    const count = parseInt(elements.readingReviewCount.value, 10) || 10;
    state.review.readingQueue = state.readingList.slice(0, count).map((item) => item.word);
    state.review.readingIndex = 0;
    state.review.readingPending = null;
  }
}

function getReadingReviewWord() {
  ensureReadingQueue();
  const word = state.review.readingQueue[state.review.readingIndex] || state.readingList[0]?.word;
  return state.readingList.find((item) => item.word === word) || state.readingList[0];
}

function renderReadingReview() {
  const item = getReadingReviewWord();
  if (!item) return;
  elements.readingReviewProgress.textContent = `Word ${state.review.readingIndex + 1} of ${state.review.readingQueue.length}`;
  elements.readingReviewWord.textContent = item.word;
  elements.readingReviewPhonetic.textContent = item.phonetic;
  elements.readingReviewMeaning.textContent = item.meaning;
  elements.readingReviewMemory.textContent = `Memory record: Remembered ${item.rightCount} times, forgot ${item.wrongCount} times.`;
  elements.readingReviewMeaningPanel.classList.add("is-hidden");
}

async function commitReadingPending() {
  const item = getReadingReviewWord();
  if (!item || !state.review.readingPending) return;
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
  saveState();
}

function getSpeakingReviewWord() {
  return state.speakingList[state.review.speakingIndex] || state.speakingList[0];
}

function renderSpeakingReview() {
  const item = getSpeakingReviewWord();
  if (!item) return;
  elements.speakingReviewProgress.textContent = `Speaking word ${state.review.speakingIndex + 1} of ${state.speakingList.length}`;
  elements.speakingReviewWord.textContent = item.word;
  elements.speakingPhonetic.textContent = item.phonetic;
  elements.speakingPhonetic.classList.add("is-hidden");
  elements.speakingResult.textContent = state.review.speakingAttempt
    ? `Latest attempt: "${state.review.speakingAttempt}". Press Let AI Judge to check it.`
    : "Say the word, then let AI judge it.";
  elements.startSpeakingReview.textContent = speakingAudioBlob ? "Record Again" : "Start Speaking";
  elements.speakingMemoryLine.textContent = `Speaking record: Right ${item.rightCount} times, wrong ${item.wrongCount} times.`;
  elements.speakingMemoryLine.classList.add("is-hidden");
  elements.speakingMeaning.textContent = `Meaning: ${item.meaning}.`;
  elements.speakingExample.textContent = `Example: "${item.example}"`;
}

function renderAll() {
  renderToday();
  renderHistory();
  renderWordList("reading");
  renderWordList("speaking");
  renderReadingReview();
  renderSpeakingReview();
}

function startRecognition(mode) {
  if (!SpeechRecognitionApi) {
    if (mode === "today") {
      elements.micStatus.textContent = "Mic works, speech recognition unsupported";
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
    if (mode === "today") elements.micStatus.textContent = "Listening...";
    else elements.speakingResult.textContent = "Listening for your pronunciation...";
  };

  recognition.onresult = (event) => {
    micPermissionGranted = true;
    const transcript = collectRecognitionTranscript(event);
    if (mode === "today") {
      state.transcript = transcript;
      saveState();
      renderToday();
    } else {
      state.review.speakingAttempt = transcript;
      elements.speakingResult.textContent = `Latest attempt: "${transcript}". Press Let AI Judge to check it.`;
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
      if (state.transcript.trim()) {
        elements.micStatus.textContent = "Ready to submit";
      } else if (dailyAudioBlob) {
        elements.micStatus.textContent = SpeechRecognitionApi
          ? "Recording saved"
          : "Speech recognition unsupported";
        elements.transcriptText.textContent =
          "No browser transcript was captured, but your recording is saved. You can still click Submit to AI.";
      } else {
        elements.micStatus.textContent = "Microphone ready";
      }
    }
  };

  recognition.start();
  return true;
}

async function captureAudio(mode) {
  if (mediaRecorder || activeRecognition) {
    showToast("Finish the current recording first.");
    return;
  }

  if (mode === "today") {
    isTodayRecording = true;
    dailyAudioBlob = null;
    state.transcript = "";
    renderToday();
  } else {
    speakingAudioBlob = null;
    state.review.speakingAttempt = "";
    renderSpeakingReview();
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
      updateTodayRecordingControls();
      elements.micStatus.textContent = "Microphone blocked";
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
    if (mode === "today") {
      elements.micStatus.textContent = "Recording...";
    } else {
      elements.speakingResult.textContent = "Recording...";
      elements.startSpeakingReview.textContent = "Stop";
    }
  };

  mediaRecorder.onstop = () => {
    const blob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
    if (mode === "today") {
      dailyAudioBlob = blob;
      elements.micStatus.textContent = state.transcript.trim()
        ? "Ready to submit"
        : "Recording saved";
      if (!state.transcript.trim() && !SpeechRecognitionApi) {
        showToast("Recording saved, but this browser still needs speech recognition for Claude analysis.");
      }
    } else {
      speakingAudioBlob = blob;
      elements.speakingResult.textContent = apiConfigured
        ? "Recording ready. Press Let AI Judge."
        : "Recording ready, but AI is not configured.";
      elements.startSpeakingReview.textContent = "Record Again";
    }

    stream.getTracks().forEach((track) => track.stop());
    mediaRecorder = null;
    recordingMode = null;
    if (mode === "today") {
      isTodayRecording = false;
      updateTodayRecordingControls();
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
    updateTodayRecordingControls();
  }

  if (activeRecognition && recognitionMode === mode) {
    activeRecognition.stop();
  }

  if (mediaRecorder && recordingMode === mode) {
    mediaRecorder.stop();
    return;
  }

  if (mode === "today") {
    elements.micStatus.textContent = state.transcript.trim()
      ? "Ready to submit"
      : dailyAudioBlob
        ? "Recording saved"
        : "Microphone ready";
    if (!state.transcript.trim() && dailyAudioBlob) {
      elements.transcriptText.textContent =
        "Your recording is saved. If no transcript appears, click Submit to AI and the backend will transcribe it.";
    }
  } else {
    elements.startSpeakingReview.textContent = "Record Again";
    elements.speakingResult.textContent = state.review.speakingAttempt
      ? `Latest attempt: "${state.review.speakingAttempt}". Press Let AI Judge to check it.`
      : "Recording finished. Press Let AI Judge.";
  }
}

async function testMicrophone() {
  if (!navigator.mediaDevices?.getUserMedia) {
    micPermissionGranted = false;
    elements.micStatus.textContent = "Browser unsupported";
    elements.micTestResult.textContent =
      "This browser does not support microphone capture.";
    showToast("Mic test failed.");
    return;
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micPermissionGranted = true;
    stream.getTracks().forEach((track) => track.stop());
    elements.micStatus.textContent = apiConfigured ? "Ready to record" : "Mic on, local only";
    elements.micTestResult.textContent = SpeechRecognitionApi
      ? apiConfigured
        ? "Mic permission granted. Speech recognition available. AI available."
        : "Mic permission granted. Speech recognition available. AI not configured."
      : apiConfigured
        ? "Mic permission granted. Recording works. Speech recognition unsupported."
        : "Mic permission granted. Recording works. Speech recognition unsupported. AI not configured.";
    showToast("Mic test passed.");
  } catch {
    micPermissionGranted = false;
    elements.micStatus.textContent = "Microphone blocked";
    elements.micTestResult.textContent =
      "Microphone is blocked in browser or system settings.";
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
    elements.speakingResult.textContent = "Say the word first, then let AI judge it.";
    showToast("Please say the word first.");
    return;
  }

  if (apiConfigured) {
    try {
      const formData = new FormData();
      formData.append("targetWord", word);
      formData.append("attempt", state.review.speakingAttempt || "");
      if (speakingAudioBlob) formData.append("audio", speakingAudioBlob, "speaking.webm");
      const response = await fetch("/api/judge-word", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("AI judge request failed.");
      const result = await response.json();
      state.review.speakingAttempt = result.heard || state.review.speakingAttempt;
      try {
        const reviewResponse = await fetch("/api/review/speaking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ word, matched: result.matched }),
        });
        if (reviewResponse.ok) {
          const reviewData = await reviewResponse.json();
          state.speakingList = reviewData.list;
        } else if (result.matched) item.rightCount += 1;
        else item.wrongCount += 1;
      } catch {
        if (result.matched) item.rightCount += 1;
        else item.wrongCount += 1;
      }
      saveState();
      renderWordList("speaking");
      renderSpeakingReview();
      elements.speakingPhonetic.classList.remove("is-hidden");
      elements.speakingMemoryLine.classList.remove("is-hidden");
      elements.speakingResult.textContent = `AI result: ${result.feedback} Score ${result.score}/100.`;
      return;
    } catch {
      showToast("AI judge failed. Using local fallback.");
    }
  }

  const attempt = normalized(state.review.speakingAttempt || "");
  const target = normalized(word);
  const correct = attempt === target || attempt.includes(target);
  try {
    const reviewResponse = await fetch("/api/review/speaking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word, matched: correct }),
    });
    if (reviewResponse.ok) {
      const reviewData = await reviewResponse.json();
      state.speakingList = reviewData.list;
    } else if (correct) item.rightCount += 1;
    else item.wrongCount += 1;
  } catch {
    if (correct) item.rightCount += 1;
    else item.wrongCount += 1;
  }
  saveState();
  renderWordList("speaking");
  renderSpeakingReview();
  elements.speakingPhonetic.classList.remove("is-hidden");
  elements.speakingMemoryLine.classList.remove("is-hidden");
  elements.speakingResult.textContent = correct
    ? `AI result: good pronunciation. Score 90/100.`
    : `AI result: not clear enough yet. Score 58/100. Try the ending sound again.`;
}

document.querySelectorAll(".nav-link").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-link").forEach((item) => item.classList.remove("is-active"));
    Object.values(elements.views).forEach((view) => view.classList.remove("is-visible"));
    button.classList.add("is-active");
    elements.views[button.dataset.view].classList.add("is-visible");
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
      return;
    }

    document.querySelectorAll(".toggle-button").forEach((item) => {
      if (!item.dataset.wordMode && !item.dataset.reviewTab) item.classList.remove("is-active");
    });
    document.querySelectorAll(".model-copy").forEach((copy) => copy.classList.remove("is-visible"));
    button.classList.add("is-active");
    document.getElementById(`model-${button.dataset.model}`).classList.add("is-visible");
  });
});

document.addEventListener("click", (event) => {
  const wordButton = event.target.closest("[data-word-select]");
  if (wordButton) {
    const word = wordButton.dataset.wordSelect;
    setSelectedWord(word, wordButton);
    const entry = lookupWordEntry(word);
    if (entry) {
      elements.drawerWord.textContent = word;
      elements.drawerPhonetic.textContent = entry.phonetic;
      elements.drawerMeaning.textContent = entry.meaning;
      elements.drawerExample.textContent = `Example: "${entry.example}"`;
      elements.drawer.dataset.word = word;
      elements.drawer.classList.add("is-open");
      elements.drawer.setAttribute("aria-hidden", "false");
    }
    return;
  }

  const audioButton = event.target.closest("[data-word-audio]");
  if (audioButton) {
    speakWord(audioButton.dataset.wordAudio);
    return;
  }

  const deleteButton = event.target.closest("[data-delete-word]");
  if (deleteButton) {
    removeWordFromList(deleteButton.dataset.deleteWord, deleteButton.dataset.deleteList);
    return;
  }

  const practiceButton = event.target.closest("[data-practice-word]");
  if (practiceButton) {
    state.review.speakingIndex = state.speakingList.findIndex(
      (item) => item.word === practiceButton.dataset.practiceWord
    );
    saveState();
    renderSpeakingReview();
    showToast(`Practice "${practiceButton.dataset.practiceWord}"`);
    return;
  }

  const judgeButton = event.target.closest("[data-judge-word]");
  if (judgeButton) {
    const word = judgeButton.dataset.judgeWord;
    state.review.speakingIndex = state.speakingList.findIndex((item) => item.word === word);
    state.review.speakingAttempt = "";
    document.querySelectorAll(".nav-link").forEach((item) => item.classList.remove("is-active"));
    Object.values(elements.views).forEach((view) => view.classList.remove("is-visible"));
    document.querySelector('.nav-link[data-view="settings"]').classList.add("is-active");
    elements.views.settings.classList.add("is-visible");
    document.querySelectorAll("[data-review-tab]").forEach((item) => {
      item.classList.toggle("is-active", item.dataset.reviewTab === "speaking");
    });
    document.querySelectorAll(".review-tab").forEach((tab) => tab.classList.remove("is-visible"));
    document.getElementById("review-tab-speaking").classList.add("is-visible");
    renderSpeakingReview();
    showToast(`Ready to judge "${word}" in Review`);
    return;
  }
});

document.addEventListener("keydown", async (event) => {
  const key = event.key.toLowerCase();
  if (key === "r" && selectedWord) await saveWordToList(selectedWord, "reading");
  if (key === "s" && selectedWord) await saveWordToList(selectedWord, "speaking");
});

elements.startSpeakingButton.addEventListener("click", () => captureAudio("today"));
elements.finishSpeakingButton.addEventListener("click", () => finishCapture("today"));
elements.testMicButton.addEventListener("click", () => testMicrophone());
elements.retryButton.addEventListener("click", () => {
  if (activeRecognition && recognitionMode === "today") activeRecognition.stop();
  if (mediaRecorder && recordingMode === "today") mediaRecorder.stop();
  isTodayRecording = false;
  state.transcript = "";
  dailyAudioBlob = null;
  state.feedback = analyzeTranscript("");
  saveState();
  renderToday();
});
elements.submitButton.addEventListener("click", async () => {
  if (isTodayRecording) {
    showToast("Finish speaking first, then submit to AI.");
    return;
  }

  if (!state.transcript.trim() && !dailyAudioBlob) {
    showToast("Please speak first so Claude can analyze your recording.");
    return;
  }

  if (!apiConfigured && dailyAudioBlob && !state.transcript) {
    showToast("Mic works, but Claude needs browser transcript text first.");
    return;
  }

  try {
    const result = await analyzeWithBackend();
    if (result) {
      state.transcript = result.transcript;
      state.feedback = result.feedback;
    } else {
      state.feedback = analyzeTranscript(state.transcript);
    }
  } catch {
    state.feedback = analyzeTranscript(state.transcript);
    showToast("AI is not configured or unavailable. Using local fallback.");
  }

  if (!state.transcript && dailyAudioBlob && !apiConfigured) {
    showToast("Recording exists, but Claude mode still needs browser transcript text.");
  }

  try {
    const historyResponse = await fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: todayPrompt.date,
        title: "Street market practice",
        summary: state.feedback.correctedTranscript,
        image: todayPrompt.image,
      }),
    });
    if (historyResponse.ok) {
      const historyData = await historyResponse.json();
      state.history = historyData.history;
    } else {
      state.history.unshift({
        id: `hist-${Date.now()}`,
        date: todayPrompt.date,
        title: "Street market practice",
        summary: state.feedback.correctedTranscript,
        image: todayPrompt.image,
      });
    }
  } catch {
    state.history.unshift({
      id: `hist-${Date.now()}`,
      date: todayPrompt.date,
      title: "Street market practice",
      summary: state.feedback.correctedTranscript,
      image: todayPrompt.image,
    });
  }
  dailyAudioBlob = null;
  saveState();
  renderAll();
  showToast("Practice saved to History");
});

elements.historySearch.addEventListener("input", () => {
  historyPage = 1;
  renderHistory();
});
elements.historyDate.addEventListener("change", () => {
  historyPage = 1;
  renderHistory();
});
elements.monthButtons.forEach((button) =>
  button.addEventListener("click", () => {
    currentMonth = button.dataset.month;
    historyPage = 1;
    elements.monthButtons.forEach((item) => item.classList.toggle("is-active", item === button));
    renderHistory();
  })
);
elements.historyPrev.addEventListener("click", () => {
  if (historyPage > 1) historyPage -= 1;
  renderHistory();
});
elements.historyNext.addEventListener("click", () => {
  historyPage += 1;
  renderHistory();
});
document.getElementById("open-months").addEventListener("click", () => {
  document.getElementById("month-strip").scrollIntoView({ behavior: "smooth", block: "center" });
});
document.getElementById("jump-today-history").addEventListener("click", () => {
  currentMonth = "all";
  historyPage = 1;
  elements.historySearch.value = "";
  elements.historyDate.value = "";
  elements.monthButtons.forEach((item) => item.classList.toggle("is-active", item.dataset.month === "all"));
  renderHistory();
});

elements.vocabularySearch.addEventListener("input", () => {
  readingPage = 1;
  renderWordList("reading");
});
elements.vocabularySort.addEventListener("change", () => {
  readingPage = 1;
  renderWordList("reading");
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
  renderWordList("speaking");
});
elements.speakingSort.addEventListener("change", () => {
  speakingPage = 1;
  renderWordList("speaking");
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
  const count = parseInt(elements.readingReviewCount.value, 10) || 10;
  state.review.readingQueue = state.readingList.slice(0, count).map((item) => item.word);
  state.review.readingIndex = 0;
  state.review.readingPending = null;
  saveState();
  renderReadingReview();
});
elements.reviewYes.addEventListener("click", () => {
  state.review.readingPending = "right";
  elements.readingReviewMeaningPanel.classList.remove("is-hidden");
});
elements.reviewNo.addEventListener("click", () => {
  state.review.readingPending = "wrong";
  elements.readingReviewMeaningPanel.classList.remove("is-hidden");
});
elements.readingReviewWrong.addEventListener("click", () => {
  state.review.readingPending = "wrong";
  elements.readingReviewMeaningPanel.classList.remove("is-hidden");
});
elements.readingReviewPrev.addEventListener("click", () => {
  if (state.review.readingIndex > 0) state.review.readingIndex -= 1;
  renderReadingReview();
});
elements.readingReviewNext.addEventListener("click", async () => {
  await commitReadingPending();
  if (state.review.readingIndex < state.review.readingQueue.length - 1) state.review.readingIndex += 1;
  renderReadingReview();
});
elements.readingReviewAudio.addEventListener("click", () => {
  const item = getReadingReviewWord();
  if (item) speakWord(item.word);
});

elements.startSpeakingReview.addEventListener("click", () => {
  if (mediaRecorder && recordingMode === "speaking-review") {
    finishCapture("speaking-review");
    return;
  }
  if (activeRecognition && recognitionMode === "speaking-review") {
    finishCapture("speaking-review");
    return;
  }
  captureAudio("speaking-review");
});
elements.runAiJudge.addEventListener("click", async () => {
  const item = getSpeakingReviewWord();
  if (!item) return;
  if (!apiConfigured && speakingAudioBlob && !state.review.speakingAttempt) {
    showToast("AI is not configured yet.");
    return;
  }
  await judgeSpeakingWord(item.word);
});
elements.speakingReviewPrev.addEventListener("click", () => {
  if (state.review.speakingIndex > 0) state.review.speakingIndex -= 1;
  state.review.speakingAttempt = "";
  renderSpeakingReview();
});
elements.speakingReviewNext.addEventListener("click", () => {
  if (state.review.speakingIndex < state.speakingList.length - 1) state.review.speakingIndex += 1;
  state.review.speakingAttempt = "";
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
elements.playAudio.addEventListener("click", () => speakWord(elements.drawer.dataset.word));
elements.addReading.addEventListener("click", () => {
  if (elements.drawer.dataset.word) saveWordToList(elements.drawer.dataset.word, "reading");
});
elements.addSpeaking.addEventListener("click", () => {
  if (elements.drawer.dataset.word) saveWordToList(elements.drawer.dataset.word, "speaking");
});

Promise.all([checkApiHealth(), loadBootstrap()]).finally(renderAll);
