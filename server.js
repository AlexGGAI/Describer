import "dotenv/config";
import express from "express";
import multer from "multer";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const port = Number(process.env.PORT || 4173);
const textModel = process.env.OPENAI_TEXT_MODEL || "gpt-5-mini";
const transcribeModel =
  process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

app.use(express.json({ limit: "4mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    configured: Boolean(openai),
    textModel,
    transcribeModel,
  });
});

app.post("/api/analyze", upload.single("audio"), async (req, res) => {
  try {
    if (!openai) {
      return res.status(503).json({
        error: "OpenAI API key is not configured on the server.",
      });
    }

    const promptTitle = req.body.promptTitle || "Describe the picture.";
    let transcript = (req.body.transcript || "").trim();

    if (req.file?.buffer?.length) {
      const file = new File([req.file.buffer], req.file.originalname || "recording.webm", {
        type: req.file.mimetype || "audio/webm",
      });
      const transcription = await openai.audio.transcriptions.create({
        file,
        model: transcribeModel,
      });
      transcript = (transcription.text || "").trim();
    }

    if (!transcript) {
      return res.status(400).json({ error: "No transcript or audio was provided." });
    }

    const response = await openai.responses.create({
      model: textModel,
      instructions:
        "You are an English speaking coach. Return only valid JSON with keys grammarOriginal, grammarCorrected, grammarNote, correctedTranscript, pronunciationWords, easy, advanced, keywords. pronunciationWords and keywords must be arrays of strings. Keep explanations simple and concise. For pronunciationWords, infer likely hard words from the learner's spoken output and useful speaking targets, not certainty from acoustics.",
      input: `Picture prompt: ${promptTitle}\nLearner transcript: ${transcript}`,
    });

    const parsed = safeJson(response.output_text);

    res.json({
      transcript,
      feedback: {
        grammarOriginal:
          parsed.grammarOriginal || `Original: "${transcript}"`,
        grammarCorrected:
          parsed.grammarCorrected || `Correct: "${transcript}"`,
        grammarNote: parsed.grammarNote || "Try smoother grammar and more natural phrasing.",
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
    res.status(500).json({ error: "Failed to analyze speech." });
  }
});

app.post("/api/judge-word", upload.single("audio"), async (req, res) => {
  try {
    if (!openai) {
      return res.status(503).json({
        error: "OpenAI API key is not configured on the server.",
      });
    }

    const targetWord = (req.body.targetWord || "").trim();
    let heard = (req.body.attempt || "").trim();

    if (!targetWord) {
      return res.status(400).json({ error: "targetWord is required." });
    }

    if (req.file?.buffer?.length) {
      const file = new File([req.file.buffer], req.file.originalname || "word.webm", {
        type: req.file.mimetype || "audio/webm",
      });
      const transcription = await openai.audio.transcriptions.create({
        file,
        model: transcribeModel,
      });
      heard = (transcription.text || "").trim();
    }

    const score = similarityScore(targetWord, heard);
    const response = await openai.responses.create({
      model: textModel,
      instructions:
        "You are an English pronunciation coach. Return only valid JSON with keys score and feedback. score must be an integer 0-100. feedback must be one short sentence. Base your judgment on the target word and the transcribed heard word, and be honest that this is an approximate speaking check.",
      input: `Target word: ${targetWord}\nTranscribed spoken attempt: ${heard || "(empty)" }\nSuggested baseline score: ${score}`,
    });

    const parsed = safeJson(response.output_text);
    res.json({
      targetWord,
      heard,
      score:
        typeof parsed.score === "number"
          ? clamp(Math.round(parsed.score), 0, 100)
          : score,
      feedback:
        parsed.feedback ||
        (score >= 85
          ? "Very close. Your pronunciation sounds clear for this word."
          : "Not clear enough yet. Try listening once more and repeating it."),
      matched: score >= 85,
    });
  } catch (error) {
    console.error("/api/judge-word failed", error);
    res.status(500).json({ error: "Failed to judge pronunciation." });
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
