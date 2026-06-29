const BASE_WORDS = [
  ["aber","but","fixed"],["außer","except","fixed"],["auf","on","fixed"],["aus","out / off","fixed"],
  ["bald","soon","fixed"],["Bett","bed","noun"],["Bis","until","fixed"],["Brot","bread","noun"],
  ["das","the","other"],["dass","that","other"],["den","the","other"],["denn","because","other"],
  ["dich","you (object)","fixed"],["die","the","other"],["durch","through","fixed"],["dort","there","fixed"],
  ["Denke","think","verb"],["draußen","outside","fixed"],["du","you","fixed"],["eben","exactly","fixed"],
  ["Ei","egg","noun"],["ein","a / one","other"],["Essen","food","noun"],["Er","he","fixed"],["es","it","fixed"],
  ["fast","almost","fixed"],["finden","find","verb"],["für","for","fixed"],["gegen","against","fixed"],
  ["Geld","money","noun"],["gut","good","fixed"],["hab","have","verb"],["Handy","phone","noun"],
  ["halt","simply / just","fixed"],["Haus","house","noun"],["hat","has","verb"],["hier","here","fixed"],
  ["hoffe","hope","verb"],["ich","I","fixed"],["ich kann","I can","verb"],["Ich will","I want","verb"],
  ["immer","always","fixed"],["ist / Ist","is","verb"],["ja","yes","fixed"],["jeden","every","fixed"],
  ["jetzt","now","fixed"],["Jux","joke","noun"],["Korb","basket","noun"],["kinder","children","noun"],
  ["komme","come","verb"],["Mein","my","fixed"],["mache","make","verb"],["mit","with","fixed"],
  ["morgen","tomorrow","fixed"],["nach","after / to","fixed"],["noch","still / yet","fixed"],["nur","only","fixed"],
  ["Oder","or","fixed"],["ohne","without","fixed"],["oft","often","fixed"],["Rat","advice","noun"],
  ["rot","red","other"],["sehr","very","fixed"],["sie","she / they","fixed"],["Sind","are","verb"],
  ["tag","day","noun"],["Tisch","table","noun"],["Tüte","bag","noun"],["tun / Tun","do","verb"],
  ["Tür","door","noun"],["über","over / about","fixed"],["um","around / at","fixed"],["und","and","fixed"],
  ["unten","below","fixed"],["unter","under","fixed"],["vor","before","fixed"],["von","from","fixed"],
  ["war","was","verb"],["warum","why","fixed"],["was","what","fixed"],["Wasser","water","noun"],
  ["wenn","if / when","fixed"],["wieder","again","fixed"],["Wie","how","fixed"],["wollen","want","verb"],
  ["wo","where","fixed"],["zu","to","fixed"],["zug","train","noun"]
];

const STORAGE_KEY = "wortwerk-words-v1";
const THEME_STORAGE_KEY = "lexicore-theme-v1";
const SYSTEM_DARK_QUERY = window.matchMedia("(prefers-color-scheme: dark)");
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

let words = loadWords();
let mode = "study";
let themePreference = loadThemePreference();
let session = null;
let feedbackLocked = false;
let advanceTimer = null;

function makeBaseWords() {
  return BASE_WORDS.map(([german, english, category], index) => ({
    id: `base-${index}`, german, english, category, active: true, custom: false
  }));
}

function loadWords() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) && saved.length ? saved : makeBaseWords();
  } catch {
    return makeBaseWords();
  }
}

function saveWords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
  renderLibrarySummary();
}

function loadThemePreference() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return ["system", "light", "dark"].includes(saved) ? saved : "system";
  } catch {
    return "system";
  }
}

function applyTheme(preference, save = true) {
  themePreference = ["system", "light", "dark"].includes(preference) ? preference : "system";
  const effectiveTheme = themePreference === "system"
    ? (SYSTEM_DARK_QUERY.matches ? "dark" : "light")
    : themePreference;

  document.documentElement.dataset.theme = effectiveTheme;
  document.documentElement.style.colorScheme = effectiveTheme;
  $("#theme-color").content = effectiveTheme === "dark" ? "#111318" : "#eef1f5";

  $$('input[name="theme"]').forEach((input) => {
    input.checked = input.value === themePreference;
  });

  const label = effectiveTheme === "dark" ? "Dark" : "Light";
  $("#theme-status").textContent = themePreference === "system"
    ? `Following system appearance. Currently using ${label} mode.`
    : `${label} mode is always on.`;

  if (save) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themePreference);
    } catch {}
  }
}

function normalise(value) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function acceptedAnswers(word, direction) {
  const raw = direction === "en-de" ? word.german : word.english;
  const answers = raw.split("/").map(normalise).filter(Boolean);
  if (direction === "en-de" && normalise(word.english) === "the") {
    return ["die", "das", "den"];
  }
  return answers;
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function showView(id) {
  $$(".view").forEach((view) => view.classList.toggle("active", view.id === id));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderLibrarySummary() {
  const active = words.filter((word) => word.active);
  $("#active-count").textContent = active.length;
  const categories = [
    ["noun", "Nouns"], ["verb", "Verbs"], ["fixed", "Fixed words"], ["other", "Other"]
  ];
  $("#category-summary").innerHTML = categories.map(([key, label]) => {
    const count = active.filter((word) => word.category === key).length;
    const width = active.length ? Math.max(3, count / active.length * 100) : 0;
    return `<div class="category-line"><div><span>${label}</span><span>${count}</span></div><div class="bar"><span style="width:${width}%"></span></div></div>`;
  }).join("");
}

function setMode(nextMode) {
  mode = nextMode;
  $$("#mode-options button").forEach((button) => button.classList.toggle("selected", button.dataset.value === mode));
  const isInfinite = mode === "infinite";
  const isCategory = mode === "category";
  $("#question-count-group").style.display = isInfinite ? "none" : "";
  $("#target-group label").textContent = isInfinite ? "Rolling target" : "Pass target";
  $("#category-practice-group").hidden = !isCategory;
  $("#standard-category-group").style.display = isCategory ? "none" : "";
  $("#session-options-row").classList.toggle("category-mode", isCategory);

  if (isCategory) {
    const selectedCategory = $("#category").value === "all" ? "noun" : $("#category").value;
    setCategoryPractice(selectedCategory);
  }
}

function setCategoryPractice(category) {
  $("#category").value = category;
  $$("#category-mode-options button").forEach((button) => {
    button.classList.toggle("selected", button.dataset.category === category);
  });
}

function getPool() {
  const category = $("#category").value;
  return words.filter((word) => word.active && (category === "all" || word.category === category || (category === "custom" && word.custom)));
}

function startQuiz() {
  const pool = getPool();
  const message = $("#setup-message");
  message.textContent = "";
  if (!pool.length) {
    message.textContent = "There are no active words in that category.";
    return;
  }

  const count = Math.max(1, Math.min(Number($("#question-count").value) || 10, pool.length));
  const target = Number($("#target-score").value);
  const isFinite = mode !== "infinite";
  session = {
    mode,
    direction: $("#direction").value,
    category: $("#category").value,
    target,
    pool,
    queue: isFinite ? shuffle(pool).slice(0, count) : [],
    index: 0,
    current: null,
    correct: 0,
    wrong: 0,
    streak: 0,
    best: 0,
    history: []
  };
  $("#session-mode-label").textContent = mode === "category" ? "CATEGORY PRACTICE" : `${mode.toUpperCase()} SESSION`;
  $("#target-note").textContent = `${isFinite ? "Target" : "Rolling target"}: ${target}%`;
  showView("quiz-view");
  nextQuestion();
}

function nextQuestion() {
  window.clearTimeout(advanceTimer);
  advanceTimer = null;
  if (!session) return;

  feedbackLocked = false;
  const input = $("#answer-input");
  input.value = "";
  input.disabled = false;
  $("#feedback").textContent = "";
  $("#feedback").className = "feedback";
  $("#submit-answer").innerHTML = 'Check answer <span>→</span>';

  if (session.mode !== "infinite" && session.index >= session.queue.length) {
    finishSession();
    return;
  }

  if (session.mode !== "infinite") {
    session.current = session.queue[session.index];
  } else {
    let candidates = session.pool;
    if (session.current && candidates.length > 1) {
      candidates = candidates.filter((word) => word.id !== session.current.id);
    }
    session.current = candidates[Math.floor(Math.random() * candidates.length)];
  }

  const word = session.current;
  const enToDe = session.direction === "en-de";
  $("#quiz-prompt").textContent = enToDe ? word.english : word.german;
  $("#prompt-language").textContent = enToDe ? "Translate into German" : "Translate into English";
  $("#category-badge").textContent = `${word.custom ? "CUSTOM · " : ""}${word.category.toUpperCase()}`;
  updateStats();
  requestAnimationFrame(() => input.focus());
}

function checkAnswer(event) {
  event.preventDefault();
  if (feedbackLocked) return;

  const value = normalise($("#answer-input").value);
  if (!value) return;
  const accepted = acceptedAnswers(session.current, session.direction);
  recordAnswer(accepted.includes(value), accepted.join(" / "));
  advanceTimer = window.setTimeout(nextQuestion, 450);
}

function recordAnswer(correct, displayAnswer) {
  feedbackLocked = true;
  session.history.push(correct);
  if (correct) {
    session.correct++;
    session.streak++;
    session.best = Math.max(session.best, session.streak);
  } else {
    session.wrong++;
    session.streak = 0;
  }

  const feedback = $("#feedback");
  feedback.textContent = correct ? "Correct. Nicely done." : `Not quite. Correct answer: ${displayAnswer}`;
  feedback.className = `feedback ${correct ? "correct" : "wrong"}`;
  $("#answer-input").disabled = true;
  $("#submit-answer").innerHTML = session.mode !== "infinite" && session.index === session.queue.length - 1
    ? 'See results <span>→</span>'
    : 'Next word <span>→</span>';
  session.index++;
  updateStats();
}

function skipQuestion() {
  if (feedbackLocked) return nextQuestion();
  recordAnswer(false, acceptedAnswers(session.current, session.direction).join(" / "));
  nextQuestion();
}

function updateStats() {
  const total = session.correct + session.wrong;
  const accuracy = total ? Math.round(session.correct / total * 100) : 0;
  $("#correct-stat").textContent = session.correct;
  $("#wrong-stat").textContent = session.wrong;
  $("#streak-stat").textContent = session.streak;
  $("#best-stat").textContent = session.best;
  $("#accuracy-stat").textContent = `${accuracy}%`;
  $("#accuracy-bar").style.width = `${accuracy}%`;

  if (session.mode !== "infinite") {
    const totalQuestions = session.queue.length;
    const shownIndex = Math.min(session.index + (feedbackLocked ? 0 : 1), totalQuestions);
    $("#progress-label").textContent = `Question ${shownIndex} of ${totalQuestions}`;
    $("#progress-bar").style.width = `${session.index / totalQuestions * 100}%`;
  } else {
    const rolling = session.history.slice(-25);
    const rollingAccuracy = rolling.length ? Math.round(rolling.filter(Boolean).length / rolling.length * 100) : 0;
    $("#progress-label").textContent = `${total} answered · ${rollingAccuracy}% rolling`;
    $("#progress-bar").style.width = `${rollingAccuracy}%`;
  }
}

function finishSession() {
  if (!session) return;
  const total = session.correct + session.wrong;
  const percentage = total ? Math.round(session.correct / total * 100) : 0;
  const passed = percentage >= session.target;
  $("#result-percent").textContent = `${percentage}%`;
  $("#result-title").textContent = total === 0 ? "Session ended." : passed ? "Target reached." : "Keep building.";
  $("#result-summary").textContent = `You answered ${session.correct} of ${total} questions correctly.`;
  $("#result-correct").textContent = session.correct;
  $("#result-best").textContent = session.best;
  $("#result-target").textContent = `${session.target}%`;
  $("#result-ring").style.borderTopColor = passed ? "var(--green)" : "var(--gold)";
  showView("result-view");
}

function openManager() {
  updateManagerStatus();
  renderWordList();
  $("#manager-dialog").showModal();
}

function updateManagerStatus() {
  const category = $("#new-category").value;
  $("#add-word-status").textContent = `Showing ${categoryName(category, true)}`;
}

function renderWordList() {
  const query = normalise($("#word-search").value);
  const category = $("#new-category").value;
  const filtered = words.filter((word) => {
    const matchesQuery = !query || normalise(`${word.german} ${word.english}`).includes(query);
    return matchesQuery && word.category === category;
  });
  $("#word-list").innerHTML = filtered.length ? filtered.map((word) => `
    <div class="word-row" data-id="${word.id}">
      <span class="german">${escapeHtml(word.german)}</span>
      <span class="english">${escapeHtml(word.english)}</span>
      <span class="category">${word.custom ? "custom · " : ""}${word.category}</span>
      <button class="toggle ${word.active ? "on" : ""}" data-action="toggle" type="button" aria-label="${word.active ? "Disable" : "Enable"} ${escapeHtml(word.german)}"></button>
      <button class="delete-word" data-action="delete" type="button" aria-label="Delete ${escapeHtml(word.german)}">${word.custom ? "×" : ""}</button>
    </div>`).join("") : '<p class="empty-list-message">No words found for this filter.</p>';
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[char]));
}

function addWord(event) {
  event.preventDefault();
  const german = $("#new-german").value.trim();
  const english = $("#new-english").value.trim();
  const category = $("#new-category").value;
  words.unshift({
    id: `custom-${Date.now()}`,
    german,
    english,
    category,
    active: true,
    custom: true
  });
  $("#new-german").value = "";
  $("#new-english").value = "";
  $("#add-word-status").textContent = `Added ${german} as ${categoryName(category)}.`;
  saveWords();
  renderWordList();
  $("#new-german").focus();
}

function categoryName(category, plural = false) {
  const labels = {
    noun: plural ? "nouns" : "a noun",
    verb: plural ? "verbs" : "a verb",
    fixed: plural ? "fixed words" : "a fixed word",
    other: "other"
  };
  return labels[category] || category;
}

$("#mode-options").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-value]");
  if (button) setMode(button.dataset.value);
});
$("#category-mode-options").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-category]");
  if (button) setCategoryPractice(button.dataset.category);
});
$(".number-control").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-change]");
  if (!button) return;
  const input = $("#question-count");
  input.value = Math.max(1, Number(input.value) + Number(button.dataset.change));
});
$("#target-score").addEventListener("input", (event) => $("#target-output").textContent = `${event.target.value}%`);
$("#start-quiz").addEventListener("click", startQuiz);
$("#answer-form").addEventListener("submit", checkAnswer);
$("#skip-question").addEventListener("click", skipQuestion);
$("#end-session").addEventListener("click", () => {
  window.clearTimeout(advanceTimer);
  advanceTimer = null;
  session = null;
  feedbackLocked = false;
  showView("setup-view");
});
$("#stats-button").addEventListener("click", () => $(".stats-card").scrollIntoView({ behavior: "smooth", block: "center" }));
$("#new-session").addEventListener("click", () => showView("setup-view"));
$("#open-manager").addEventListener("click", openManager);
$("#manage-from-card").addEventListener("click", openManager);
$("#close-manager").addEventListener("click", () => $("#manager-dialog").close());
$("#open-settings").addEventListener("click", () => {
  applyTheme(themePreference, false);
  $("#settings-dialog").showModal();
});
$("#close-settings").addEventListener("click", () => $("#settings-dialog").close());
$(".theme-options").addEventListener("change", (event) => {
  if (event.target.name === "theme") applyTheme(event.target.value);
});
$("#add-word-form").addEventListener("submit", addWord);
$("#word-search").addEventListener("input", renderWordList);
$("#new-category").addEventListener("change", () => {
  updateManagerStatus();
  renderWordList();
});
$("#word-list").addEventListener("click", (event) => {
  const action = event.target.dataset.action;
  const row = event.target.closest(".word-row");
  if (!action || !row) return;
  const word = words.find((item) => item.id === row.dataset.id);
  if (action === "toggle") word.active = !word.active;
  if (action === "delete" && word.custom) words = words.filter((item) => item.id !== word.id);
  saveWords();
  renderWordList();
});
$("#enable-all").addEventListener("click", () => {
  words.forEach((word) => word.active = true);
  saveWords(); renderWordList();
});
$("#disable-all").addEventListener("click", () => {
  words.forEach((word) => word.active = false);
  saveWords(); renderWordList();
});
$("#reset-words").addEventListener("click", () => {
  if (!confirm("Reset the library and remove all custom words?")) return;
  words = makeBaseWords();
  saveWords(); renderWordList();
});

const handleSystemThemeChange = () => {
  if (themePreference === "system") applyTheme("system", false);
};
if (SYSTEM_DARK_QUERY.addEventListener) {
  SYSTEM_DARK_QUERY.addEventListener("change", handleSystemThemeChange);
} else {
  SYSTEM_DARK_QUERY.addListener(handleSystemThemeChange);
}

applyTheme(themePreference, false);
renderLibrarySummary();
setMode("study");
