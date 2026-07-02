const STORAGE_KEY = "meshit12-tests";
const ACTIVE_KEY = "meshit12-active-test";
const QUESTIONS_PER_TEST = 30;
const PASS_THRESHOLD = 0.7;

let questionsBank = [];
let imageMap = { figurePages: {} };
let activeTest = null;
let currentQuestionIndex = 0;
let showingResults = false;

const views = {
  home: document.getElementById("view-home"),
  test: document.getElementById("view-test"),
  results: document.getElementById("view-results"),
  history: document.getElementById("view-history"),
  review: document.getElementById("view-review"),
};

async function init() {
  try {
    const [questionsRes, mapRes] = await Promise.all([
      fetch("data/questions.json"),
      fetch("data/image-map.json"),
    ]);
    questionsBank = await questionsRes.json();
    imageMap = await mapRes.json();
    document.getElementById("question-count").textContent = questionsBank.length;
  } catch (err) {
    console.error(err);
    document.getElementById("question-count").textContent = "שגיאה בטעינה";
  }

  bindEvents();
  checkActiveTest();
  renderHistory();
}

function bindEvents() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      if (view === "home") showView("home");
      if (view === "history") {
        renderHistory();
        showView("history");
      }
    });
  });

  document.getElementById("btn-start").addEventListener("click", startNewTest);
  document.getElementById("btn-resume").addEventListener("click", resumeTest);
  document.getElementById("btn-prev").addEventListener("click", () => navigateQuestion(-1));
  document.getElementById("btn-next").addEventListener("click", () => navigateQuestion(1));
  document.getElementById("btn-finish").addEventListener("click", finishTest);
  document.getElementById("btn-abandon").addEventListener("click", abandonTest);
  document.getElementById("btn-new-after-results").addEventListener("click", startNewTest);
  document.getElementById("btn-back-home").addEventListener("click", () => showView("home"));
  document.getElementById("btn-back-history").addEventListener("click", () => {
    renderHistory();
    showView("history");
  });
}

function showView(name) {
  Object.values(views).forEach((v) => v.classList.remove("active"));
  views[name].classList.add("active");
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === name || (name === "home" && btn.dataset.view === "home"));
  });
}

function getTests() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveTests(tests) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tests));
}

function saveActiveTestId(id) {
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
}

function getActiveTestId() {
  return localStorage.getItem(ACTIVE_KEY);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandomQuestions(count) {
  return shuffle(questionsBank).slice(0, Math.min(count, questionsBank.length));
}

function buildTestQuestion(question) {
  const optionEntries = Object.entries(question.options).map(([key, text]) => ({
    originalKey: key,
    text,
  }));
  const shuffled = shuffle(optionEntries).map((opt, idx) => ({
    displayKey: String.fromCharCode(1488 + idx),
    originalKey: opt.originalKey,
    text: opt.text,
  }));

  return {
    questionId: question.id,
    text: question.text,
    imageRefs: question.imageRefs || [],
    correctOriginalKey: question.correct,
    shuffledOptions: shuffled,
    selectedDisplayKey: null,
  };
}

function createTest() {
  const selected = pickRandomQuestions(QUESTIONS_PER_TEST);
  return {
    id: generateId(),
    createdAt: new Date().toISOString(),
    completedAt: null,
    status: "in_progress",
    questions: selected.map(buildTestQuestion),
    score: null,
  };
}

function startNewTest() {
  if (
    activeTest &&
    activeTest.status === "in_progress" &&
    !confirm("יש מבחן פעיל. להתחיל מבחן חדש? המבחן הנוכחי יישמר.")
  ) {
    return;
  }

  if (activeTest && activeTest.status === "in_progress") {
    persistTest(activeTest);
  }

  activeTest = createTest();
  currentQuestionIndex = 0;
  showingResults = false;
  persistTest(activeTest);
  saveActiveTestId(activeTest.id);
  checkActiveTest();
  showView("test");
  renderQuestion();
}

function resumeTest() {
  const id = getActiveTestId();
  const test = getTests().find((t) => t.id === id && t.status === "in_progress");
  if (!test) {
    checkActiveTest();
    return;
  }
  activeTest = test;
  currentQuestionIndex = 0;
  showingResults = false;
  showView("test");
  renderQuestion();
}

function checkActiveTest() {
  const id = getActiveTestId();
  const test = getTests().find((t) => t.id === id && t.status === "in_progress");
  const resumeBtn = document.getElementById("btn-resume");
  if (test) {
    activeTest = test;
    resumeBtn.classList.remove("hidden");
    const answered = test.questions.filter((q) => q.selectedDisplayKey).length;
    resumeBtn.textContent = `המשך מבחן פעיל (${answered}/${test.questions.length})`;
  } else {
    resumeBtn.classList.add("hidden");
  }
}

function persistTest(test) {
  const tests = getTests();
  const idx = tests.findIndex((t) => t.id === test.id);
  if (idx >= 0) tests[idx] = test;
  else tests.unshift(test);
  saveTests(tests);
}

function abandonTest() {
  if (!confirm("לעזוב את המבחן? ההתקדמות תישמר ותוכל להמשיך מאוחר יותר.")) return;
  showView("home");
}

function navigateQuestion(delta) {
  currentQuestionIndex = Math.max(0, Math.min(activeTest.questions.length - 1, currentQuestionIndex + delta));
  renderQuestion();
}

function renderQuestion() {
  if (!activeTest) return;

  const q = activeTest.questions[currentQuestionIndex];
  const total = activeTest.questions.length;
  const answered = activeTest.questions.filter((x) => x.selectedDisplayKey).length;

  document.getElementById("test-progress").textContent =
    `שאלה ${currentQuestionIndex + 1} מתוך ${total} · ${answered} נענו`;
  document.getElementById("test-date").textContent = formatDate(activeTest.createdAt);
  document.getElementById("progress-fill").style.width = `${((currentQuestionIndex + 1) / total) * 100}%`;

  document.getElementById("q-number").textContent = `שאלה מס' ${q.questionId} במאגר`;
  document.getElementById("q-text").textContent = q.text;

  renderQuestionImages(q);

  const optionsEl = document.getElementById("q-options");
  optionsEl.innerHTML = "";

  q.shuffledOptions.forEach((opt) => {
    const label = document.createElement("label");
    label.className = "option" + (q.selectedDisplayKey === opt.displayKey ? " selected" : "");

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "answer";
    input.checked = q.selectedDisplayKey === opt.displayKey;
    input.addEventListener("change", () => selectAnswer(opt.displayKey));

    const keySpan = document.createElement("span");
    keySpan.className = "option-label";
    keySpan.textContent = opt.displayKey + ".";

    const textSpan = document.createElement("span");
    textSpan.className = "option-text";
    textSpan.textContent = opt.text;

    label.appendChild(input);
    label.appendChild(keySpan);
    label.appendChild(textSpan);
    optionsEl.appendChild(label);
  });

  document.getElementById("btn-prev").disabled = currentQuestionIndex === 0;
  document.getElementById("btn-next").classList.toggle("hidden", currentQuestionIndex === total - 1);
  document.getElementById("btn-finish").classList.toggle("hidden", currentQuestionIndex !== total - 1);
}

function renderQuestionImages(q) {
  const container = document.getElementById("q-images");
  container.innerHTML = "";

  if (!q.imageRefs || q.imageRefs.length === 0) return;

  const shownPages = new Set();
  q.imageRefs.forEach((ref) => {
    const page = imageMap.figurePages[ref];
    if (page && !shownPages.has(page)) {
      shownPages.add(page);
      const caption = document.createElement("div");
      caption.className = "image-caption";
      caption.textContent = `תמונה ${ref} (עמוד ${page} במאגר)`;

      const img = document.createElement("img");
      img.src = `images/pages/page-${String(page).padStart(2, "0")}.png`;
      img.alt = `תמונה ${ref}`;
      img.loading = "lazy";

      container.appendChild(caption);
      container.appendChild(img);
    }
  });

  if (shownPages.size === 0 && q.imageRefs.length > 0) {
    const note = document.createElement("div");
    note.className = "image-caption";
    note.textContent = `שאלה זו מתייחסת לתמונה ${q.imageRefs.join(", ")} במאגר השאלות`;
    container.appendChild(note);
  }
}

function selectAnswer(displayKey) {
  activeTest.questions[currentQuestionIndex].selectedDisplayKey = displayKey;
  persistTest(activeTest);
  renderQuestion();
}

function finishTest() {
  const unanswered = activeTest.questions.filter((q) => !q.selectedDisplayKey).length;
  if (unanswered > 0) {
    if (!confirm(`נותרו ${unanswered} שאלות ללא מענה. לסיים בכל זאת?`)) return;
  }

  const score = calculateScore(activeTest);
  activeTest.status = "completed";
  activeTest.completedAt = new Date().toISOString();
  activeTest.score = score;
  persistTest(activeTest);
  saveActiveTestId(null);
  checkActiveTest();
  showResults(activeTest);
}

function calculateScore(test) {
  let correct = 0;
  test.questions.forEach((q) => {
    const selected = q.shuffledOptions.find((o) => o.displayKey === q.selectedDisplayKey);
    if (selected && selected.originalKey === q.correctOriginalKey) correct++;
  });
  return { correct, total: test.questions.length };
}

function getSelectedOriginalKey(q) {
  const selected = q.shuffledOptions.find((o) => o.displayKey === q.selectedDisplayKey);
  return selected ? selected.originalKey : null;
}

function showResults(test) {
  showView("results");
  const score = test.score;
  const pct = Math.round((score.correct / score.total) * 100);
  const passed = score.correct / score.total >= PASS_THRESHOLD;

  document.getElementById("results-summary").innerHTML = `
    <div class="score-circle ${passed ? "pass" : "fail"}">
      <span class="score-num">${score.correct}/${score.total}</span>
      <span class="score-label">${pct}%</span>
    </div>
    <h2>${passed ? "כל הכבוד! 🎉" : "יש מקום לשיפור"}</h2>
    <p class="muted">${formatDate(test.completedAt)} · ${passed ? "עברת את רף 70%" : "נדרשות לפחות 21 תשובות נכונות (70%)"}</p>
  `;

  renderResultDetails(document.getElementById("results-details"), test);
}

function renderResultDetails(container, test) {
  container.innerHTML = "";

  test.questions.forEach((q, idx) => {
    const selected = getSelectedOriginalKey(q);
    const isCorrect = selected === q.correctOriginalKey;
    const isUnanswered = !selected;

    const item = document.createElement("div");
    item.className = `result-item card ${isUnanswered ? "unanswered-item" : isCorrect ? "correct-item" : "incorrect-item"}`;

    let badgeClass = isUnanswered ? "unanswered" : isCorrect ? "correct" : "incorrect";
    let badgeText = isUnanswered ? "לא נענה" : isCorrect ? "נכון ✓" : "שגוי ✗";

    const selectedText = selected
      ? q.shuffledOptions.find((o) => o.originalKey === selected)?.text
      : null;
    const correctText = q.shuffledOptions.find((o) => o.originalKey === q.correctOriginalKey)?.text;

    item.innerHTML = `
      <div class="result-header">
        <strong>שאלה ${idx + 1} (מאגר #${q.questionId})</strong>
        <span class="result-badge ${badgeClass}">${badgeText}</span>
      </div>
      <p>${escapeHtml(q.text)}</p>
      ${renderImageRefsHtml(q)}
      ${selected ? `<div class="answer-row">התשובה שלך: <strong>${selected}. ${escapeHtml(selectedText || "")}</strong></div>` : ""}
      ${!isCorrect ? `<div class="answer-row">תשובה נכונה: <strong>${q.correctOriginalKey}. ${escapeHtml(correctText || "")}</strong></div>` : ""}
    `;

    container.appendChild(item);
  });
}

function renderImageRefsHtml(q) {
  if (!q.imageRefs || q.imageRefs.length === 0) return "";
  const pages = q.imageRefs
    .map((ref) => imageMap.figurePages[ref])
    .filter(Boolean);
  const unique = [...new Set(pages)];
  if (unique.length === 0) return `<div class="image-caption">תמונה ${q.imageRefs.join(", ")}</div>`;
  return unique
    .map(
      (page) =>
        `<img src="images/pages/page-${String(page).padStart(2, "0")}.png" alt="תמונה" style="max-width:100%;border-radius:8px;margin:0.5rem 0" loading="lazy">`
    )
    .join("");
}

function renderHistory() {
  const tests = getTests();
  const list = document.getElementById("history-list");
  const empty = document.getElementById("history-empty");

  if (tests.length === 0) {
    empty.classList.remove("hidden");
    list.innerHTML = "";
    return;
  }

  empty.classList.add("hidden");
  list.innerHTML = "";

  tests.forEach((test) => {
    const item = document.createElement("div");
    item.className = "history-item";

    const isActive = test.status === "in_progress";
    const scoreText = isActive
      ? `${test.questions.filter((q) => q.selectedDisplayKey).length}/${test.questions.length} נענו`
      : `${test.score.correct}/${test.score.total} (${Math.round((test.score.correct / test.score.total) * 100)}%)`;

    const scoreClass = isActive
      ? "in-progress"
      : test.score.correct / test.score.total >= PASS_THRESHOLD
        ? "pass"
        : "fail";

    item.innerHTML = `
      <div class="history-item-info">
        <h3>${isActive ? "מבחן פעיל" : "מבחן שהושלם"}</h3>
        <p>${formatDate(test.completedAt || test.createdAt)}</p>
      </div>
      <span class="history-score ${scoreClass}">${scoreText}</span>
      <button class="btn btn-secondary">${isActive ? "המשך" : "צפייה"}</button>
    `;

    item.querySelector("button").addEventListener("click", () => {
      if (isActive) {
        activeTest = test;
        saveActiveTestId(test.id);
        currentQuestionIndex = 0;
        showingResults = false;
        showView("test");
        renderQuestion();
      } else {
        showReview(test);
      }
    });

    list.appendChild(item);
  });
}

function showReview(test) {
  showView("review");
  const score = test.score;
  const pct = Math.round((score.correct / score.total) * 100);

  document.getElementById("review-summary").innerHTML = `
    <h2>מבחן מ-${formatDate(test.completedAt)}</h2>
    <p><strong>${score.correct}/${score.total}</strong> (${pct}%)</p>
  `;

  renderResultDetails(document.getElementById("review-details"), test);
}

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("he-IL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

init();
