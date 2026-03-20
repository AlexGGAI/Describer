import "dotenv/config";
import express from "express";
import multer from "multer";
import Anthropic from "@anthropic-ai/sdk";
import path from "path";
import { fileURLToPath } from "url";
import {
  addHistoryEntry,
  addWord,
  deleteWord,
  getBootstrap,
  updateReviewCount,
} from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const port = Number(process.env.PORT || 4173);
const textModel =
  process.env.ANTHROPIC_TEXT_MODEL || "claude-sonnet-4-20250514";

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

app.use(express.json({ limit: "4mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.get("/api/bootstrap", (_req, res) => {
  res.json({
    configured: Boolean(anthropic),
    ...getBootstrap(formatIsoDate(new Date())),
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    configured: Boolean(anthropic),
    provider: "anthropic",
    textModel,
    transcription: "browser-only",
  });
});

app.post("/api/words", async (req, res) => {
  const { word, listName, savedAt } = req.body;
  if (!word || !listName) {
    return res.status(400).json({ error: "word and listName are required." });
  }

  const details = await lookupWordDetails(word);
  const list = addWord({
    listName,
    word,
    savedAt: savedAt || formatIsoDate(new Date()),
    ...details,
  });

  res.json({ list });
});

app.delete("/api/words/:listName/:word", (req, res) => {
  const { listName, word } = req.params;
  const list = deleteWord(listName, decodeURIComponent(word));
  res.json({ list });
});

app.post("/api/review/reading", (req, res) => {
  const { word, result } = req.body;
  const list = updateReviewCount("reading", word, result === "right");
  res.json({ list });
});

app.post("/api/review/speaking", (req, res) => {
  const { word, matched } = req.body;
  const list = updateReviewCount("speaking", word, Boolean(matched));
  res.json({ list });
});

app.post("/api/history", (req, res) => {
  const { title, summary, image, date } = req.body;
  const bootstrap = getBootstrap(formatIsoDate(new Date()));
  const history = addHistoryEntry({
    id: `hist-${Date.now()}`,
    title: title || "Practice",
    summary: summary || "",
    image: image || bootstrap.todayPrompt.image,
    date: date || formatIsoDate(new Date()),
  });
  res.json({ history });
});

app.post("/api/analyze", upload.none(), async (req, res) => {
  try {
    if (!anthropic) {
      return res.status(503).json({
        error: "Anthropic API key is not configured on the server.",
      });
    }

    const promptTitle = req.body.promptTitle || "Describe the picture.";
    const transcript = (req.body.transcript || "").trim();
    const imageUrl = req.body.imageUrl || "";

    if (!transcript) {
      return res.status(400).json({
        error: "No transcript was provided. Claude mode needs browser transcript input.",
      });
    }

    const response = await anthropic.messages.create({
      model: textModel,
      max_tokens: 900,
      system:
        "You are an English speaking coach for learners. Respond with compact valid JSON only.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                `Picture prompt: ${promptTitle}\n` +
                `Picture image URL for context: ${imageUrl || "not provided"}\n` +
                `Learner transcript: ${transcript}\n\n` +
                `Return only valid JSON with keys grammarOriginal, grammarCorrected, grammarNote, correctedTranscript, pronunciationWords, easy, advanced, keywords.\n` +
                `pronunciationWords and keywords must be arrays of strings.\n` +
                `Keep explanations short and simple.\n` +
                `For pronunciationWords, infer likely hard words from the learner transcript and the picture context.`,
            },
          ],
        },
      ],
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    const parsed = safeJson(text);

    res.json({
      transcript,
      feedback: {
        grammarOriginal: parsed.grammarOriginal || `Original: "${transcript}"`,
        grammarCorrected: parsed.grammarCorrected || `Correct: "${transcript}"`,
        grammarNote:
          parsed.grammarNote || "Try smoother grammar and more natural phrasing.",
        correctedTranscript: parsed.correctedTranscript || transcript,
        pronunciationWords: Array.isArray(parsed.pronunciationWords)
          ? parsed.pronunciationWords.slice(0, 4)
          : [],
        easy: parsed.easy || transcript,
        advanced: parsed.advanced || transcript,
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 8) : [],
      },
    });
  } catch (error) {
    console.error("/api/analyze failed", error);
    res.status(500).json({ error: "Failed to analyze speech with Claude." });
  }
});

app.post("/api/judge-word", upload.none(), async (req, res) => {
  try {
    if (!anthropic) {
      return res.status(503).json({
        error: "Anthropic API key is not configured on the server.",
      });
    }

    const targetWord = (req.body.targetWord || "").trim();
    const heard = (req.body.attempt || "").trim();

    if (!targetWord) {
      return res.status(400).json({ error: "targetWord is required." });
    }

    if (!heard) {
      return res.status(400).json({
        error: "No spoken transcript was provided. Claude mode needs browser speech recognition first.",
      });
    }

    const baseline = similarityScore(targetWord, heard);
    const response = await anthropic.messages.create({
      model: textModel,
      max_tokens: 250,
      system:
        "You are an English pronunciation coach. Respond with compact valid JSON only.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                `Target word: ${targetWord}\n` +
                `Browser transcript of spoken attempt: ${heard}\n` +
                `Baseline similarity score: ${baseline}\n\n` +
                `Return only valid JSON with keys score and feedback.\n` +
                `score must be an integer 0-100.\n` +
                `feedback must be one short sentence.\n` +
                `Judge carefully but acknowledge this is approximate because the input is transcript-based.`,
            },
          ],
        },
      ],
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    const parsed = safeJson(text);
    const score =
      typeof parsed.score === "number"
        ? clamp(Math.round(parsed.score), 0, 100)
        : baseline;

    res.json({
      targetWord,
      heard,
      score,
      feedback:
        parsed.feedback ||
        (score >= 85
          ? "Very close. Your pronunciation sounds clear for this word."
          : "Not clear enough yet. Try listening once more and repeating it."),
      matched: score >= 85,
    });
  } catch (error) {
    console.error("/api/judge-word failed", error);
    res.status(500).json({ error: "Failed to judge pronunciation with Claude." });
  }
});

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(port, () => {
  console.log(`Describer running on http://localhost:${port}`);
});

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      return JSON.parse(match[0]);
    } catch {
      return {};
    }
  }
}

function normalizeWord(value) {
  return value.toLowerCase().replace(/[^\w\s]/g, "").trim();
}

function similarityScore(target, heard) {
  const a = normalizeWord(target);
  const b = normalizeWord(heard);
  if (!a || !b) return 20;
  if (a === b) return 94;
  if (b.includes(a) || a.includes(b)) return 84;
  const distance = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length, 1);
  return clamp(Math.round((1 - distance / maxLen) * 100), 20, 90);
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[a.length][b.length];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

async function lookupWordDetails(word) {
  const normalizedWord = String(word || "").trim().toLowerCase();
  if (!normalizedWord) {
    return emptyWordDetails(word);
  }

  if (defaultWordLibrary[normalizedWord]) {
    return defaultWordLibrary[normalizedWord];
  }

  if (!anthropic) {
    return emptyWordDetails(word);
  }

  try {
    const response = await anthropic.messages.create({
      model: textModel,
      max_tokens: 220,
      system:
        "You are a concise English vocabulary coach. Respond with compact valid JSON only.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                `Word or phrase: ${word}\n\n` +
                "Return only valid JSON with keys phonetic, meaning, example.\n" +
                "meaning should be short and easy.\n" +
                "example should be one natural sentence for English learners.",
            },
          ],
        },
      ],
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");
    const parsed = safeJson(text);

    return {
      phonetic: typeof parsed.phonetic === "string" ? parsed.phonetic : "",
      meaning:
        typeof parsed.meaning === "string" && parsed.meaning.trim()
          ? parsed.meaning.trim()
          : `Useful word related to "${word}".`,
      example:
        typeof parsed.example === "string" && parsed.example.trim()
          ? parsed.example.trim()
          : `I can use "${word}" when I describe a picture.`,
    };
  } catch (error) {
    console.error("lookupWordDetails failed", error);
    return emptyWordDetails(word);
  }
}

function emptyWordDetails(word) {
  return {
    phonetic: "",
    meaning: `Useful word related to "${word}".`,
    example: `I can use "${word}" when I describe a picture.`,
  };
}

const defaultWordLibrary = {
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
