const baseUrl = process.env.BASE_URL || "http://localhost:4180";
const testRunId = Date.now();
const historyTitle = `System Test Practice ${testRunId}`;

const createdWords = [
  { listName: "reading", word: "lantern stall" },
  { listName: "speaking", word: "sunlit awning" },
];

async function main() {
  console.log(`Running system test against ${baseUrl}`);

  await cleanup();

  await testHomePage();
  await testHealth();
  await testBootstrap();
  await testAnalyze();
  await testWordAddAndDelete();
  await testReviewCounters();
  await testJudgeWord();
  await testHistoryCreate();
  await testHistoryDelete();

  await cleanup();
  console.log("System test passed.");
}

async function testHomePage() {
  const response = await fetch(baseUrl);
  assert(response.ok, "Home page should load.");
  const html = await response.text();
  assert(html.includes("Describer"), "Home page should include app title.");
  assert(html.includes("v2.0"), "Home page should include app version.");
}

async function testHealth() {
  const data = await json("/api/health");
  assert(data.ok === true, "Health endpoint should be ok.");
  assert(data.provider === "anthropic", "Provider should be anthropic.");
  assert(data.configured === true, "Anthropic key should be configured.");
}

async function testBootstrap() {
  const data = await json("/api/bootstrap");
  assert(Boolean(data.todayPrompt?.title), "Bootstrap should include todayPrompt.");
  assert(Array.isArray(data.readingList), "Bootstrap should include readingList.");
  assert(Array.isArray(data.speakingList), "Bootstrap should include speakingList.");
  assert(Array.isArray(data.history), "Bootstrap should include history.");
}

async function testAnalyze() {
  const form = new FormData();
  form.append("promptTitle", "Describe this night market.");
  form.append(
    "transcript",
    "This picture show many people in a market and the place look lively."
  );
  form.append(
    "imageUrl",
    "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=1200&q=80"
  );

  const response = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    body: form,
  });
  assert(response.ok, "Analyze endpoint should succeed.");
  const data = await response.json();
  assert(Boolean(data.transcript), "Analyze should return transcript.");
  assert(Boolean(data.feedback?.grammarCorrected), "Analyze should return grammar correction.");
  assert(Array.isArray(data.feedback?.keywords), "Analyze should return keywords.");
  assert(Array.isArray(data.feedback?.pronunciationWords), "Analyze should return pronunciation words.");
}

async function testWordAddAndDelete() {
  for (const item of createdWords) {
    const response = await fetch(`${baseUrl}/api/words`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listName: item.listName,
        word: item.word,
        savedAt: "2026-03-20",
      }),
    });
    assert(response.ok, `Add word should succeed for ${item.word}.`);
    const data = await response.json();
    const saved = data.list.find((entry) => entry.word.toLowerCase() === item.word);
    assert(saved, `Saved word should be returned for ${item.word}.`);
    assert(typeof saved.meaning === "string" && saved.meaning.length > 0, "Saved word should have meaning.");
    assert(typeof saved.example === "string" && saved.example.length > 0, "Saved word should have example.");
  }

  let response = await fetch(
    `${baseUrl}/api/words/reading/${encodeURIComponent("lantern stall")}`,
    { method: "DELETE" }
  );
  assert(response.ok, "Delete word should succeed.");
  let data = await response.json();
  assert(
    !data.list.some((entry) => entry.word.toLowerCase() === "lantern stall"),
    "Deleted reading word should be removed."
  );

  response = await fetch(`${baseUrl}/api/words`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      listName: "reading",
      word: "lantern stall",
      savedAt: "2026-03-20",
    }),
  });
  assert(response.ok, "Re-add reading word should succeed.");
}

async function testReviewCounters() {
  let response = await fetch(`${baseUrl}/api/review/reading`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word: "lantern stall", result: "right" }),
  });
  assert(response.ok, "Reading review update should succeed.");
  let data = await response.json();
  let item = data.list.find((entry) => entry.word.toLowerCase() === "lantern stall");
  assert(item?.rightCount >= 1, "Reading word should increment rightCount.");

  response = await fetch(`${baseUrl}/api/review/speaking`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word: "sunlit awning", matched: false }),
  });
  assert(response.ok, "Speaking review update should succeed.");
  data = await response.json();
  item = data.list.find((entry) => entry.word.toLowerCase() === "sunlit awning");
  assert(item?.wrongCount >= 1, "Speaking word should increment wrongCount.");
}

async function testJudgeWord() {
  const form = new FormData();
  form.append("targetWord", "lively");
  form.append("attempt", "lively");

  const response = await fetch(`${baseUrl}/api/judge-word`, {
    method: "POST",
    body: form,
  });
  assert(response.ok, "Judge endpoint should succeed.");
  const data = await response.json();
  assert(typeof data.score === "number", "Judge should return a numeric score.");
  assert(typeof data.feedback === "string" && data.feedback.length > 0, "Judge should return feedback.");
  assert(typeof data.matched === "boolean", "Judge should return matched.");
}

async function testHistoryCreate() {
  const response = await fetch(`${baseUrl}/api/history`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      date: "2026-03-20",
      title: historyTitle,
      summary: "Automated test saved a history entry.",
      originalTranscript: "This picture show a busy night market.",
      correctedTranscript: "This picture shows a busy night market.",
      image:
        "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=1200&q=80",
    }),
  });
  assert(response.ok, "History create should succeed.");
  const data = await response.json();
  const entry = data.history.find((item) => item.title === historyTitle);
  assert(entry, "Created history entry should exist.");
  assert(entry.originalTranscript === "This picture show a busy night market.", "History should store original transcript.");
  assert(entry.correctedTranscript === "This picture shows a busy night market.", "History should store corrected transcript.");
}

async function testHistoryDelete() {
  let response = await fetch(`${baseUrl}/api/bootstrap`);
  let data = await response.json();
  const entry = data.history.find((item) => item.title === historyTitle);
  assert(entry, "History entry should still exist before delete.");

  response = await fetch(`${baseUrl}/api/history/${encodeURIComponent(entry.id)}`, {
    method: "DELETE",
  });
  assert(response.ok, "History delete should succeed.");
  data = await response.json();
  assert(
    !data.history.some((item) => item.id === entry.id),
    "Deleted history entry should be removed."
  );
}

async function cleanup() {
  for (const item of createdWords) {
    await fetch(`${baseUrl}/api/words/${item.listName}/${encodeURIComponent(item.word)}`, {
      method: "DELETE",
    });
  }
}

async function json(pathname) {
  const response = await fetch(`${baseUrl}${pathname}`);
  assert(response.ok, `${pathname} should succeed.`);
  return response.json();
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
