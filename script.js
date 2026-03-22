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
      speakingStatus: "Say the word clearly, then press Finish.",
      speakingJudged: false,
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
let isTodayTranscriptProcessing = false;
let todayTranscribeRequestId = 0;
let todayAutoSubmitRequested = false;
let todayPracticeFinished = false;
let speakingReviewAutoJudgeRequested = false;
let isSpeakingReviewProcessing = false;
let activeHistoryPreviewId = null;

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
  startSpeakingButton: document.getElementById("start-speaking-button"),
  finishSpeakingButton: document.getElementById("finish-speaking-button"),
  transcriptText: document.getElementById("transcript-text"),
  transcriptProcessing: document.getElementById("transcript-processing"),
  testMicButton: document.getElementById("test-mic-button"),
  restartSpeakingButton: document.getElementById("restart-speaking-button"),
  micTestResult: document.getElementById("mic-test-result"),
  feedbackOriginalTranscript: document.getElementById("feedback-original-transcript"),
  grammarSentences: document.getElementById("grammar-sentences"),
  pronunciationFlags: document.getElementById("pronunciation-flags"),
  modelEasyText: document.getElementById("model-easy-text"),
  modelAdvancedText: document.getElementById("model-advanced-text"),
  modelToggleRow: document.getElementById("model-toggle-row"),
  modelLockedNote: document.getElementById("model-locked-note"),
  aiSuggestionText: document.getElementById("ai-suggestion-text"),
  keywordGrid: document.getElementById("keyword-grid"),
  recentSavedList: document.getElementById("recent-saved-list"),
  historySearch: document.getElementById("history-search"),
  historyDate: document.getElementById("history-date"),
  monthButtons: Array.from(document.querySelectorAll(".month-pill")),
  monthSummaryTitle: document.getElementById("month-summary-title"),
  monthSessionCount: document.getElementById("month-session-count"),
  historyGrid: document.getElementById("history-grid"),
  deleteAllHistory: document.getElementById("delete-all-history"),
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
  closeHistoryPreview: document.getElementById("close-history-preview"),
  deleteHistoryEntry: document.getElementById("delete-history-entry"),
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
    overallSuggestion:
      "Good detail. Next time, slow down a little and keep each sentence shorter so your grammar stays clear.",
    correctedTranscript: corrected,
    pronunciationWords: flagged.slice(0, 3).length ? flagged.slice(0, 3) : ["seller", "lively"],
    keywords: todayPrompt.keywords,
    easy: buildEasyExample(todayPrompt),
    advanced: buildAdvancedExample(todayPrompt),
  };
}

function createEmptyFeedback() {
  return {
    grammarOriginal: "",
    grammarCorrected: "",
    grammarNote: "",
    overallSuggestion: "AI suggestions will appear here after your recording is judged.",
    correctedTranscript: "",
    pronunciationWords: [],
    keywords: todayPrompt.keywords,
    easy: buildEasyExample(todayPrompt),
    advanced: buildAdvancedExample(todayPrompt),
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

function speakText(text) {
  if (!synth || !text) return;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  synth.speak(utterance);
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

function normalizeFeedback(feedback = {}) {
  return {
    ...feedback,
    easy: ensureExampleVariant(feedback.easy, "easy", todayPrompt),
    advanced: ensureExampleVariant(feedback.advanced, "advanced", todayPrompt),
  };
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
  const pairs = buildGrammarSentencePairs(originalText, correctedText);
  if (!pairs.length) {
    elements.grammarSentences.innerHTML = `<p class="feedback-empty">No grammar changes.</p>`;
    return;
  }

  elements.grammarSentences.innerHTML = pairs
    .map(
      (pair) => `
        <div class="feedback-sentence">
          <p class="feedback-row feedback-original">
            ${highlightOriginalSentence(pair.original, pair.corrected)}
          </p>
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
    state.transcript ||
    (isTodayTranscriptProcessing
      ? "Processing your recording..."
      : "Tap Start to describe the picture.");
  if (state.transcript && state.feedback.correctedTranscript) {
    elements.feedbackOriginalTranscript.innerHTML = highlightOriginalSentence(
      state.transcript,
      state.feedback.correctedTranscript
    );
  } else {
    elements.feedbackOriginalTranscript.textContent = state.transcript ||
      (isTodayTranscriptProcessing
        ? "Processing your recording..."
        : "Your original transcript will appear here after you finish speaking.");
  }
  elements.micTestResult.textContent = micPermissionGranted
    ? SpeechRecognitionApi
      ? apiConfigured
        ? "Mic OK. Speech recognition available. AI available."
        : "Mic OK. Speech recognition available. AI not configured."
      : apiConfigured
        ? "Mic OK. Recording available. Speech recognition unsupported."
        : "Mic OK. Recording available. Speech recognition unsupported. AI not configured."
    : "Mic not tested yet.";
  renderGrammarFeedback(state.transcript, state.feedback.correctedTranscript);
  elements.modelEasyText.textContent = state.feedback.easy;
  elements.modelAdvancedText.textContent = state.feedback.advanced;
  elements.aiSuggestionText.textContent =
    state.feedback.overallSuggestion ||
    state.feedback.grammarNote ||
    "AI suggestions will appear here after your recording is judged.";

  const activeModelButton =
    document.querySelector('.toggle-button.is-active[data-model]') ||
    document.querySelector('.toggle-button[data-model="easy"]');
  const activeModel = activeModelButton?.dataset.model || "easy";
  elements.modelToggleRow.classList.toggle("is-hidden", !todayPracticeFinished);
  elements.modelLockedNote.classList.toggle("is-hidden", todayPracticeFinished);
  document.querySelectorAll(".model-copy").forEach((copy) => {
    copy.classList.toggle(
      "is-visible",
      todayPracticeFinished && copy.id === `model-${activeModel}`
    );
  });

  elements.pronunciationFlags.innerHTML = state.feedback.pronunciationWords.length
    ? state.feedback.pronunciationWords
        .map(
          (word) =>
            `<button class="word-chip issue" data-word-value="${word}" data-word-select="${word}">${word}</button>`
        )
        .join("")
    : `<span class="muted">No flagged words.</span>`;

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
  setTodayTranscriptProcessing(isTodayTranscriptProcessing);
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
        <article
          class="history-card panel"
          data-history-open="${entry.id}"
          role="button"
          tabindex="0"
          aria-label="Open history preview for ${escapeHtml(entry.title)}"
        >
          <div class="history-card-actions">
            <button
              class="history-delete-button"
              data-history-delete="${entry.id}"
              aria-label="Delete history entry ${escapeHtml(entry.title)}"
            >
              Delete
            </button>
          </div>
          <img src="${entry.image}" alt="${escapeHtml(entry.title)}" />
          <div class="history-copy">
            <p class="eyebrow">${formatDateLabel(entry.date)}</p>
            <h4>${escapeHtml(entry.title)}</h4>
            <p>${escapeHtml(entry.summary || "Open to review your original words and the corrected version.")}</p>
          </div>
          <div class="history-card-footer">
            <button class="ghost-button history-open-button" data-history-open="${entry.id}">
              Preview
            </button>
          </div>
        </article>
      `
    )
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
  elements.monthSummaryTitle.textContent = formatMonthLabel(currentMonth);
  elements.monthSessionCount.textContent = `${filtered.length} session${filtered.length === 1 ? "" : "s"}`;
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
  elements.historyPreviewOriginal.textContent =
    entry.originalTranscript || "No original transcript was saved for this older practice.";
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

async function deleteHistory(id) {
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
  historyPage = 1;
  renderHistory();
  showToast("History deleted");
}

async function deleteAllHistory() {
  try {
    const response = await fetch("/api/history", { method: "DELETE" });
    if (response.ok) {
      const data = await response.json();
      state.history = data.history;
    } else {
      state.history = [];
    }
  } catch {
    state.history = [];
  }
  closeHistoryPreview();
  historyPage = 1;
  renderHistory();
  showToast("All history deleted");
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
        <div class="lite-word-row" data-word-select="${item.word}" data-word-surface="lite">
          <strong>${item.word}</strong>
          <div class="lite-word-actions">
            <button class="inline-audio-button" data-word-audio="${item.word}" aria-label="Play pronunciation for ${item.word}">&#128264;</button>
            <button class="ghost-button small-button" data-delete-word="${item.word}" data-delete-list="${listName}">Delete</button>
          </div>
        </div>
      `
    )
    .join("");

  fullPanel.innerHTML = visible
    .map(
      (item) => `
        <article class="panel practice-target word-card-entry ${listName === "reading" ? "word-entry" : ""}" data-word-list="${listName}" data-word="${item.word}" data-word-select="${item.word}" data-word-surface="full">
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
                ? `<button class="primary-button small-button" data-practice-word="${item.word}">Start</button>
                   <button class="ghost-button small-button" data-judge-word="${item.word}">Finish</button>`
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
  const isRecordingNow =
    recordingMode === "speaking-review" || recognitionMode === "speaking-review";
  elements.speakingReviewProgress.textContent = `Speaking word ${state.review.speakingIndex + 1} of ${state.speakingList.length}`;
  elements.speakingReviewWord.textContent = item.word;
  elements.speakingPhonetic.textContent = item.phonetic;
  elements.speakingPhonetic.classList.toggle("is-hidden", !state.review.speakingJudged);
  elements.speakingResult.textContent =
    state.review.speakingStatus || "Say the word clearly, then press Finish.";
  elements.startSpeakingReview.textContent = isRecordingNow ? "Recording" : "Start";
  elements.runAiJudge.textContent = isSpeakingReviewProcessing
    ? "Processing"
    : state.review.speakingJudged
      ? "Judged"
      : "Finish";
  elements.startSpeakingReview.disabled = isSpeakingReviewProcessing;
  elements.runAiJudge.disabled =
    isSpeakingReviewProcessing ||
    state.review.speakingJudged ||
    (!isRecordingNow && !speakingAudioBlob && !state.review.speakingAttempt);
  elements.speakingMemoryLine.textContent = `Speaking record: Right ${item.rightCount} times, wrong ${item.wrongCount} times.`;
  elements.speakingMemoryLine.classList.toggle("is-hidden", !state.review.speakingJudged);
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
      state.review.speakingStatus = "Recording";
      renderSpeakingReview();
    }
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
      state.review.speakingStatus = transcript
        ? `Recording: "${transcript}"`
        : "Recording";
      renderSpeakingReview();
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
    todayAutoSubmitRequested = false;
    todayPracticeFinished = false;
    setTodayTranscriptProcessing(false);
    dailyAudioBlob = null;
    state.transcript = "";
    state.feedback = createEmptyFeedback();
    renderToday();
  } else {
    speakingAudioBlob = null;
    state.review.speakingAttempt = "";
    state.review.speakingStatus = "Recording";
    state.review.speakingJudged = false;
    isSpeakingReviewProcessing = false;
    speakingReviewAutoJudgeRequested = false;
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
    if (mode !== "today") {
      state.review.speakingStatus = "Recording";
      renderSpeakingReview();
    }
  };

  mediaRecorder.onstop = () => {
    const blob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
    if (mode === "today") {
      dailyAudioBlob = blob;
    } else {
      speakingAudioBlob = blob;
      state.review.speakingStatus = "Processing";
      renderSpeakingReview();
    }

    stream.getTracks().forEach((track) => track.stop());
    mediaRecorder = null;
    recordingMode = null;
    if (mode === "today") {
      isTodayRecording = false;
      updateTodayRecordingControls();
      void maybeCompleteTodayPractice();
    } else {
      void maybeCompleteSpeakingReview();
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
    if (!state.review.speakingAttempt.trim() && !speakingAudioBlob) {
      showToast("Start speaking first.");
      state.review.speakingStatus = "Say the word clearly, then press Finish.";
      renderSpeakingReview();
      return;
    }
    speakingReviewAutoJudgeRequested = true;
    isSpeakingReviewProcessing = true;
    state.review.speakingJudged = false;
    state.review.speakingStatus = "Processing";
    renderSpeakingReview();
    void maybeCompleteSpeakingReview();
  }
}

function restartTodayPractice() {
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

async function saveTodayPracticeToHistory() {
  const payload = {
    date: todayPrompt.date,
    title: todayPrompt.title,
    summary: state.feedback.correctedTranscript || state.transcript || "",
    image: todayPrompt.image,
    originalTranscript: state.transcript,
    correctedTranscript: state.feedback.correctedTranscript || state.transcript || "",
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
    dailyAudioBlob = null;
  } catch {
    if (state.transcript.trim()) {
      state.feedback = normalizeFeedback(analyzeTranscript(state.transcript));
      await saveTodayPracticeToHistory();
      todayPracticeFinished = true;
      dailyAudioBlob = null;
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
    state.review.speakingStatus = "Say the word clearly, then press Finish.";
    isSpeakingReviewProcessing = false;
    state.review.speakingJudged = false;
    renderSpeakingReview();
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
      state.review.speakingJudged = true;
      isSpeakingReviewProcessing = false;
      state.review.speakingStatus = result.matched
        ? `AI result: correct pronunciation. Score ${result.score}/100. ${result.feedback}`
        : `AI result: not correct yet. Score ${result.score}/100. ${result.feedback}`;
      renderSpeakingReview();
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
  state.review.speakingJudged = true;
  isSpeakingReviewProcessing = false;
  state.review.speakingStatus = correct
    ? `AI result: correct pronunciation. Score 90/100.`
    : `AI result: not correct yet. Score 58/100. Try the ending sound again.`;
  renderSpeakingReview();
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
    state.review.speakingIndex = state.speakingList.findIndex(
      (item) => item.word === practiceButton.dataset.practiceWord
    );
    state.review.speakingAttempt = "";
    state.review.speakingStatus = "Say the word clearly, then press Finish.";
    state.review.speakingJudged = false;
    isSpeakingReviewProcessing = false;
    speakingAudioBlob = null;
    saveState();
    renderSpeakingReview();
    showToast(`Start "${practiceButton.dataset.practiceWord}"`);
    return;
  }

  const judgeButton = event.target.closest("[data-judge-word]");
  if (judgeButton) {
    event.stopPropagation();
    const word = judgeButton.dataset.judgeWord;
    state.review.speakingIndex = state.speakingList.findIndex((item) => item.word === word);
    state.review.speakingAttempt = "";
    state.review.speakingStatus = "Say the word clearly, then press Finish.";
    state.review.speakingJudged = false;
    isSpeakingReviewProcessing = false;
    speakingAudioBlob = null;
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
    showToast(`Finish "${word}" in Review`);
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
      elements.drawerMeaning.textContent = entry.meaning;
      elements.drawerExample.textContent = `Example: "${entry.example}"`;
      elements.drawer.dataset.word = word;
      elements.drawer.classList.add("is-open");
      elements.drawer.setAttribute("aria-hidden", "false");
    }
    return;
  }
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
elements.deleteAllHistory.addEventListener("click", () => {
  deleteAllHistory();
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
elements.speakingReviewPrev.addEventListener("click", () => {
  if (state.review.speakingIndex > 0) state.review.speakingIndex -= 1;
  state.review.speakingAttempt = "";
  state.review.speakingStatus = "Say the word clearly, then press Finish.";
  state.review.speakingJudged = false;
  isSpeakingReviewProcessing = false;
  speakingAudioBlob = null;
  renderSpeakingReview();
});
elements.speakingReviewNext.addEventListener("click", () => {
  if (state.review.speakingIndex < state.speakingList.length - 1) state.review.speakingIndex += 1;
  state.review.speakingAttempt = "";
  state.review.speakingStatus = "Say the word clearly, then press Finish.";
  state.review.speakingJudged = false;
  isSpeakingReviewProcessing = false;
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
elements.deleteHistoryEntry.addEventListener("click", () => {
  if (activeHistoryPreviewId) deleteHistory(activeHistoryPreviewId);
});
elements.historyPreviewBackdrop.addEventListener("click", (event) => {
  if (event.target === elements.historyPreviewBackdrop) {
    closeHistoryPreview();
  }
});

Promise.all([checkApiHealth(), loadBootstrap()]).finally(renderAll);
