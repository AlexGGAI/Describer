const views = {
  today: document.getElementById("view-today"),
  history: document.getElementById("view-history"),
  vocabulary: document.getElementById("view-vocabulary"),
  speaking: document.getElementById("view-speaking"),
  settings: document.getElementById("view-settings"),
};

const drawer = document.getElementById("word-drawer");
const drawerWord = document.getElementById("drawer-word");
const drawerPhonetic = document.getElementById("drawer-phonetic");
const drawerMeaning = document.getElementById("drawer-meaning");
const drawerExample = document.getElementById("drawer-example");
const shortcutToast = document.getElementById("shortcut-toast");
const historyCards = Array.from(document.querySelectorAll(".history-card"));
const historySearch = document.getElementById("history-search");
const historyDate = document.getElementById("history-date");
const monthButtons = Array.from(document.querySelectorAll(".month-pill"));
const monthSummaryTitle = document.getElementById("month-summary-title");
const monthSessionCount = document.getElementById("month-session-count");
const historyPrev = document.getElementById("history-prev");
const historyNext = document.getElementById("history-next");
const historyPageStatus = document.getElementById("history-page-status");
const vocabularyEntries = Array.from(
  document.querySelectorAll('.word-entry[data-word-list="vocabulary"]')
);
const vocabularySearch = document.getElementById("vocabulary-search");
const vocabularySort = document.getElementById("vocabulary-sort");
const vocabularyPrev = document.getElementById("vocabulary-prev");
const vocabularyNext = document.getElementById("vocabulary-next");
const vocabularyPageStatus = document.getElementById("vocabulary-page-status");
const speakingEntries = Array.from(
  document.querySelectorAll('.word-card-entry[data-word-list="speaking"]')
);
const speakingSearch = document.getElementById("speaking-search");
const speakingSort = document.getElementById("speaking-sort");
const speakingPrev = document.getElementById("speaking-prev");
const speakingNext = document.getElementById("speaking-next");
const speakingPageStatus = document.getElementById("speaking-page-status");
const reviewMeaningPanel = document.getElementById("review-meaning-panel");
const reviewYes = document.getElementById("review-yes");
const reviewNo = document.getElementById("review-no");
const speakingPhonetic = document.getElementById("speaking-phonetic");
const speakingMemoryLine = document.getElementById("speaking-memory-line");
const runAiJudge = document.getElementById("run-ai-judge");

let currentMonth = "all";
let currentPage = 1;
const pageSize = 3;
let vocabularyPage = 1;
let speakingPage = 1;
const vocabularyPageSize = 3;
const speakingPageSize = 2;
let selectedWord = null;
let selectedWordElement = null;

const wordLibrary = {
  seller: {
    phonetic: "/ˈsel.ər/",
    meaning: "someone whose job is selling products",
    example: "Example: The seller is standing beside the fruit baskets.",
  },
  lively: {
    phonetic: "/ˈlaɪv.li/",
    meaning: "full of energy, movement, and excitement",
    example: "Example: The market looks lively because many people are shopping.",
  },
  market: {
    phonetic: "/ˈmɑːr.kɪt/",
    meaning: "a place where people buy and sell goods",
    example: "Example: This market is busy in the morning.",
  },
  vendor: {
    phonetic: "/ˈven.dər/",
    meaning: "a person selling items, often in a public place",
    example: "Example: A vendor is arranging fruit on the stand.",
  },
  "fresh produce": {
    phonetic: "/freʃ ˈproʊ.duːs/",
    meaning: "fresh fruits and vegetables",
    example: "Example: The stand is full of fresh produce.",
  },
  crowded: {
    phonetic: "/ˈkraʊ.dɪd/",
    meaning: "full of many people in one place",
    example: "Example: The street feels crowded but cheerful.",
  },
  atmosphere: {
    phonetic: "/ˈæt.mə.sfɪr/",
    meaning: "the general feeling or mood of a place",
    example: "Example: The atmosphere is warm and inviting.",
  },
};

document.querySelectorAll(".nav-link").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-link").forEach((item) => {
      item.classList.remove("is-active");
    });
    document.querySelectorAll(".view").forEach((view) => {
      view.classList.remove("is-visible");
    });
    button.classList.add("is-active");
    views[button.dataset.view].classList.add("is-visible");
  });
});

document.querySelectorAll(".toggle-button").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.reviewTab) {
      document
        .querySelectorAll("[data-review-tab]")
        .forEach((item) => item.classList.remove("is-active"));
      document
        .querySelectorAll(".review-tab")
        .forEach((tab) => tab.classList.remove("is-visible"));

      button.classList.add("is-active");
      document
        .getElementById(`review-tab-${button.dataset.reviewTab}`)
        .classList.add("is-visible");
      return;
    }

    if (button.dataset.wordMode) {
      const [group] = button.dataset.wordMode.split("-");
      document
        .querySelectorAll(`[data-word-mode^="${group}-"]`)
        .forEach((item) => item.classList.remove("is-active"));
      document
        .querySelectorAll(`#${group}-lite-panel, #${group}-full-panel`)
        .forEach((panel) => panel.classList.remove("is-visible"));

      button.classList.add("is-active");
      document
        .getElementById(`${button.dataset.wordMode}-panel`)
        .classList.add("is-visible");
      return;
    }

    document.querySelectorAll(".toggle-button").forEach((item) => {
      if (!item.dataset.wordMode) {
        item.classList.remove("is-active");
      }
    });
    document.querySelectorAll(".model-copy").forEach((copy) => {
      copy.classList.remove("is-visible");
    });

    button.classList.add("is-active");
    document
      .getElementById(`model-${button.dataset.model}`)
      .classList.add("is-visible");
  });
});

function openDrawer(word) {
  const entry = wordLibrary[word];
  if (!entry) return;

  drawerWord.textContent = word;
  drawerPhonetic.textContent = entry.phonetic;
  drawerMeaning.textContent = entry.meaning;
  drawerExample.textContent = entry.example;
  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
  drawer.dataset.word = word;
}

document.querySelectorAll(".word-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    setSelectedWord(chip.dataset.word, chip);
    openDrawer(chip.dataset.word);
  });
});

document.getElementById("close-drawer").addEventListener("click", () => {
  drawer.classList.remove("is-open");
  drawer.setAttribute("aria-hidden", "true");
});

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if (key === "r" && selectedWord) {
    showShortcutToast(`Saved "${selectedWord}" to Reading`);
    return;
  }

  if (key === "s" && selectedWord) {
    showShortcutToast(`Saved "${selectedWord}" to Speaking`);
    return;
  }
});

document.getElementById("add-vocabulary").addEventListener("click", () => {
  const button = document.getElementById("add-vocabulary");
  const word = drawer.dataset.word;
  if (!word) return;
  button.textContent = `Saved "${word}"`;
  setTimeout(() => {
    button.textContent = "Add to Vocabulary";
  }, 1200);
});

document.getElementById("add-speaking").addEventListener("click", () => {
  const button = document.getElementById("add-speaking");
  const word = drawer.dataset.word;
  if (!word) return;
  button.textContent = `Saved "${word}"`;
  setTimeout(() => {
    button.textContent = "Add to Speaking List";
  }, 1200);
});

document.getElementById("play-audio").addEventListener("click", () => {
  const button = document.getElementById("play-audio");
  button.textContent = "Playing...";
  setTimeout(() => {
    button.textContent = "Play Sound";
  }, 900);
});

document.querySelectorAll("[data-word-audio]").forEach((button) => {
  button.addEventListener("click", () => {
    const original = button.innerHTML;
    button.innerHTML = "&#10003;";
    setTimeout(() => {
      button.innerHTML = original;
    }, 900);
  });
});

function setSelectedWord(word, element) {
  if (selectedWordElement) {
    selectedWordElement.classList.remove("is-selected");
  }

  selectedWord = word;
  selectedWordElement = element;
  selectedWordElement.classList.add("is-selected");
}

function showShortcutToast(message) {
  shortcutToast.textContent = message;
  shortcutToast.classList.add("is-visible");

  setTimeout(() => {
    shortcutToast.classList.remove("is-visible");
  }, 1200);
}

document
  .querySelectorAll(".lite-word-row, .practice-target, .word-entry")
  .forEach((item) => {
    const source =
      item.dataset.word ||
      item.querySelector("strong, h4, .word-title span")?.textContent?.trim();

    if (!source) return;

    item.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      setSelectedWord(source, item);
    });
  });

function getMonthLabel(month) {
  if (month === "all") return "All Months";

  const [year, number] = month.split("-");
  const labels = {
    "01": "January",
    "02": "February",
    "03": "March",
    "04": "April",
    "05": "May",
    "06": "June",
    "07": "July",
    "08": "August",
    "09": "September",
    "10": "October",
    "11": "November",
    "12": "December",
  };

  return `${labels[number]} ${year}`;
}

function getFilteredHistoryCards() {
  const query = historySearch.value.trim().toLowerCase();
  const selectedDate = historyDate.value;

  return historyCards.filter((card) => {
    const matchesMonth =
      currentMonth === "all" || card.dataset.month === currentMonth;
    const matchesSearch =
      !query || card.dataset.search.toLowerCase().includes(query);
    const matchesDate = !selectedDate || card.dataset.date === selectedDate;

    return matchesMonth && matchesSearch && matchesDate;
  });
}

function renderHistory() {
  const filtered = getFilteredHistoryCards();
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  currentPage = Math.min(currentPage, totalPages);

  historyCards.forEach((card) => {
    card.classList.add("is-hidden");
  });

  filtered
    .slice((currentPage - 1) * pageSize, currentPage * pageSize)
    .forEach((card) => {
      card.classList.remove("is-hidden");
    });

  historyPageStatus.textContent = `Page ${currentPage} of ${totalPages}`;
  historyPrev.disabled = currentPage === 1;
  historyNext.disabled = currentPage === totalPages;
  monthSummaryTitle.textContent = getMonthLabel(currentMonth);
  monthSessionCount.textContent = `${filtered.length} session${
    filtered.length === 1 ? "" : "s"
  }`;
}

historySearch.addEventListener("input", () => {
  currentPage = 1;
  renderHistory();
});

historyDate.addEventListener("change", () => {
  currentPage = 1;
  renderHistory();
});

monthButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentMonth = button.dataset.month;
    currentPage = 1;
    monthButtons.forEach((item) => {
      item.classList.toggle("is-active", item === button);
    });
    renderHistory();
  });
});

historyPrev.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage -= 1;
    renderHistory();
  }
});

historyNext.addEventListener("click", () => {
  currentPage += 1;
  renderHistory();
});

document.getElementById("open-months").addEventListener("click", () => {
  document.getElementById("month-strip").scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
});

document.getElementById("jump-today-history").addEventListener("click", () => {
  currentMonth = "all";
  currentPage = 1;
  historySearch.value = "";
  historyDate.value = "";
  monthButtons.forEach((item) => {
    item.classList.toggle("is-active", item.dataset.month === "all");
  });
  renderHistory();
});

renderHistory();

function sortEntries(entries, mode) {
  return [...entries].sort((a, b) => {
    if (mode === "az") {
      return a.dataset.word.localeCompare(b.dataset.word);
    }

    if (mode === "oldest") {
      return a.dataset.date.localeCompare(b.dataset.date);
    }

    return b.dataset.date.localeCompare(a.dataset.date);
  });
}

function renderManagedList(config) {
  const {
    entries,
    searchInput,
    sortInput,
    page,
    size,
    prevButton,
    nextButton,
    statusNode,
  } = config;

  const query = searchInput.value.trim().toLowerCase();
  const filtered = sortEntries(
    entries.filter((entry) => {
      const searchBase = `${entry.dataset.word} ${entry.dataset.meaning} ${entry.dataset.date}`;
      return !query || searchBase.toLowerCase().includes(query);
    }),
    sortInput.value
  );

  entries.forEach((entry) => {
    entry.classList.add("is-hidden");
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / size));
  const safePage = Math.min(page, totalPages);

  filtered
    .slice((safePage - 1) * size, safePage * size)
    .forEach((entry) => entry.classList.remove("is-hidden"));

  statusNode.textContent = `Page ${safePage} of ${totalPages}`;
  prevButton.disabled = safePage === 1;
  nextButton.disabled = safePage === totalPages;

  return safePage;
}

function renderVocabularyList() {
  vocabularyPage = renderManagedList({
    entries: vocabularyEntries,
    searchInput: vocabularySearch,
    sortInput: vocabularySort,
    page: vocabularyPage,
    size: vocabularyPageSize,
    prevButton: vocabularyPrev,
    nextButton: vocabularyNext,
    statusNode: vocabularyPageStatus,
  });
}

function renderSpeakingList() {
  speakingPage = renderManagedList({
    entries: speakingEntries,
    searchInput: speakingSearch,
    sortInput: speakingSort,
    page: speakingPage,
    size: speakingPageSize,
    prevButton: speakingPrev,
    nextButton: speakingNext,
    statusNode: speakingPageStatus,
  });
}

vocabularySearch.addEventListener("input", () => {
  vocabularyPage = 1;
  renderVocabularyList();
});

vocabularySort.addEventListener("change", () => {
  vocabularyPage = 1;
  renderVocabularyList();
});

vocabularyPrev.addEventListener("click", () => {
  if (vocabularyPage > 1) {
    vocabularyPage -= 1;
    renderVocabularyList();
  }
});

vocabularyNext.addEventListener("click", () => {
  vocabularyPage += 1;
  renderVocabularyList();
});

speakingSearch.addEventListener("input", () => {
  speakingPage = 1;
  renderSpeakingList();
});

speakingSort.addEventListener("change", () => {
  speakingPage = 1;
  renderSpeakingList();
});

speakingPrev.addEventListener("click", () => {
  if (speakingPage > 1) {
    speakingPage -= 1;
    renderSpeakingList();
  }
});

speakingNext.addEventListener("click", () => {
  speakingPage += 1;
  renderSpeakingList();
});

renderVocabularyList();
renderSpeakingList();

reviewYes.addEventListener("click", () => {
  reviewMeaningPanel.classList.remove("is-hidden");
});

reviewNo.addEventListener("click", () => {
  reviewMeaningPanel.classList.remove("is-hidden");
});

runAiJudge.addEventListener("click", () => {
  runAiJudge.textContent = "AI Judging...";

  setTimeout(() => {
    runAiJudge.textContent = "Let AI Judge";
    speakingPhonetic.classList.remove("is-hidden");
    speakingMemoryLine.classList.remove("is-hidden");
  }, 900);
});
