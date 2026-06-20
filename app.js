const STORE_KEY = "braindumpz:v1";

const $ = (id) => document.getElementById(id);

const moods = [
  { label: "Great", emoji: "😊", value: 5, tone: "great" },
  { label: "Good", emoji: "🙂", value: 4, tone: "great" },
  { label: "Okay", emoji: "😐", value: 3, tone: "okay" },
  { label: "Stressed", emoji: "😔", value: 2, tone: "stressed" },
  { label: "Burnt Out", emoji: "😭", value: 1, tone: "burnout" },
];

const affirmations = [
  "I can pause without falling behind.",
  "One difficult mock test is data, not destiny.",
  "My worth is larger than any rank, score, or attempt.",
  "A steadier mind studies better than a punished one.",
];

const recoveryItems = [
  "Drink water",
  "Step away from the screen",
  "Loosen jaw and shoulders",
  "Message one safe person",
  "Pick the next tiny task",
];

const quotes = [
  ["Reset", "Slow is still movement when the direction is honest."],
  ["Perspective", "Preparation is a season, not your whole identity."],
  ["Focus", "The next ten minutes only need one clear action."],
];

const defaultState = {
  entries: [],
  moods: [],
  wellness: [],
  theme: "light",
};

let state = loadState();
let selectedMood = moods[1];
let selectedDailyMood = moods[1];
let selectedDate = todayKey();
let visibleMonth = monthStart(selectedDate);
let insightDays = 14;
let charts = {};
let breathInterval = null;

// ==========================================
// CORE DATA & STORAGE
// ==========================================

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { ...defaultState };
    const parsed = JSON.parse(raw);
    return {
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      moods: Array.isArray(parsed.moods) ? parsed.moods : [],
      wellness: Array.isArray(parsed.wellness) ? parsed.wellness : [],
      theme: parsed.theme === "dark" ? "dark" : "light",
    };
  } catch (e) {
    console.error("Failed to load state", e);
    return { ...defaultState };
  }
}

function saveState() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Failed to save state", e);
    alert("Warning: Could not save data. Your browser storage might be full or disabled.");
  }
}

// ==========================================
// UTILITIES
// ==========================================

function todayKey() { return new Date().toISOString().slice(0, 10); }
function monthStart(dateKey) { return `${dateKey.slice(0, 7)}-01`; }
function localDate(dateKey) { return new Date(`${dateKey}T12:00:00`); }
function dateKeyFromDate(date) { return date.toISOString().slice(0, 10); }

function shiftDate(dateKey, days) {
  const date = localDate(dateKey);
  date.setDate(date.getDate() + days);
  return dateKeyFromDate(date);
}

function shiftMonth(dateKey, months) {
  const date = localDate(dateKey);
  date.setMonth(date.getMonth() + months, 1);
  return dateKeyFromDate(date);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(localDate(value));
}

function formatMonth(value) {
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(localDate(value));
}

function prettyTime(iso) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

/**
 * Clamps a number between a minimum and maximum value.
 * @param {number|string} val - The input value to clamp.
 * @param {number} min - The minimum allowed value.
 * @param {number} max - The maximum allowed value.
 * @returns {number} The clamped numerical value.
 */
function clampNumber(val, min, max) {
  const num = Number(val);
  if (!Number.isFinite(num)) return min;
  return Math.max(min, Math.min(max, num));
}

/**
 * Upserts an item into an array based on its date property, sorting the result chronologically.
 * @param {Array<{date: string}>} collection - The array to update.
 * @param {{date: string}} item - The item to insert or update.
 * @returns {Array<{date: string}>} A new sorted array with the item upserted.
 */
function upsertByDate(collection, item) {
  const next = collection.filter((entry) => entry.date !== item.date);
  next.push(item);
  return next.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Extracts and clamps wellness metrics from form inputs.
 * @param {string} prefix - The ID prefix for the inputs (e.g., "daily" or "").
 * @param {string} date - The date to associate with this wellness record.
 * @returns {Object} The parsed wellness object including the calculated score.
 */
function extractWellnessForm(prefix, date) {
  const wellness = {
    date,
    study: clampNumber($(`${prefix}StudyHours`)?.value, 0, 24),
    sleep: clampNumber($(`${prefix}SleepHours`)?.value, 0, 24),
    water: clampNumber($(`${prefix}WaterIntake`)?.value, 0, 50),
    exercise: clampNumber($(`${prefix}ExerciseMinutes`)?.value, 0, 1440),
  };
  wellness.score = calculateScore(wellness);
  return wellness;
}

/**
 * Creates or updates a journal entry securely.
 * @param {string} rawText - The raw input text.
 * @param {string} date - The target date.
 * @param {Object} [existing] - An existing journal entry to preserve metadata.
 * @returns {Object|null} A new journal object or null if text is empty.
 */
function createJournalEntry(rawText, date, existing = null) {
  const text = typeof rawText === "string" ? rawText.trim() : "";
  if (text.length === 0) return null;
  return {
    id: existing?.id || crypto.randomUUID(),
    date,
    text: escapeHtml(text),
    aiResponse: getMoodRecommendation(text),
    createdAt: existing?.createdAt || `${date}T12:00:00.000Z`,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Calculates a daily wellness score (0-100) based on various recovery metrics.
 * @param {Object} metrics - The raw metrics object.
 * @param {number|string} metrics.study - Study hours.
 * @param {number|string} metrics.sleep - Sleep hours.
 * @param {number|string} metrics.water - Water intake units.
 * @param {number|string} metrics.exercise - Exercise minutes.
 * @returns {number} The calculated wellness score rounded to the nearest integer.
 */
function calculateScore({ study, sleep, water, exercise }) {
  const s = clampNumber(sleep, 0, 24);
  const st = clampNumber(study, 0, 24);
  const w = clampNumber(water, 0, 50);
  const e = clampNumber(exercise, 0, 1440);
  const sleepScore = Math.min(30, Math.max(0, 30 - Math.abs(7.5 - s) * 6));
  const studyScore = st <= 8 ? 25 : Math.max(8, 25 - (st - 8) * 4);
  const waterScore = Math.min(20, w * 3.3);
  const exerciseScore = Math.min(25, e * 0.85);
  return Math.round(Math.min(100, sleepScore + studyScore + waterScore + exerciseScore));
}

function recordForDate(date) {
  const mood = state.moods.find((item) => item.date === date);
  const wellness = state.wellness.find((item) => item.date === date);
  
  let journal = undefined;
  for (let i = state.entries.length - 1; i >= 0; i--) {
    const entry = state.entries[i];
    if (entry.date === date || (entry.createdAt && entry.createdAt.slice(0, 10) === date)) {
      if (!journal || entry.createdAt > journal.createdAt) {
        journal = entry;
      }
    }
  }

  return { date, mood, wellness, journal, hasRecord: Boolean(mood || wellness || journal) };
}

function getLastDays(days = insightDays) {
  return Array.from({ length: days }, (_, index) => shiftDate(todayKey(), -(days - index - 1)));
}

// ==========================================
// RENDERERS
// ==========================================

function applyTheme() {
  document.body.classList.toggle("dark", state.theme === "dark");
  $("themeIcon").textContent = state.theme === "dark" ? "☀" : "◐";
}

function renderCalendar() {
  $("monthLabel").textContent = formatMonth(visibleMonth);
  const start = localDate(visibleMonth);
  const firstVisible = new Date(start);
  firstVisible.setDate(start.getDate() - start.getDay());
  const today = todayKey();

  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstVisible);
    date.setDate(firstVisible.getDate() + index);
    const key = dateKeyFromDate(date);
    const record = recordForDate(key);
    const mood = record.mood;
    const wellness = record.wellness;
    const isOutside = key.slice(0, 7) !== visibleMonth.slice(0, 7);
    const isFuture = key > today;
    const classes = [
      "calendar-day",
      isOutside ? "outside" : "",
      isFuture ? "future" : "",
      record.hasRecord ? "has-record" : "",
      key === selectedDate ? "selected" : "",
      wellness?.study > 10 ? "heavy-study" : "",
      wellness?.sleep < 5.5 ? "low-sleep" : "",
    ].filter(Boolean).join(" ");

    return `
      <button class="${classes}" type="button" data-date="${key}" ${isFuture ? "disabled" : ""}>
        <span class="day-number">${date.getDate()}</span>
        <span class="day-meta">
          ${mood ? `<i class="dot ${mood.tone}" title="${mood.label}"></i>` : ""}
          ${wellness ? `<small>${wellness.score}</small>` : ""}
        </span>
      </button>
    `;
  });

  $("calendarGrid").innerHTML = days.join("");
  renderDailyForm();
}

/**
 * Renders a grid of mood buttons into a specified container.
 * @param {string} containerId - The DOM ID of the container.
 * @param {string} dataAttr - The data attribute for the button (e.g., "data-mood").
 * @param {Object} activeMood - The currently selected mood object to highlight.
 */
function renderMoodGrid(containerId, dataAttr, activeMood) {
  $(containerId).innerHTML = moods.map((mood) => `
    <button class="mood-option ${mood.label === activeMood.label ? "active" : ""}" type="button" ${dataAttr}="${mood.label}">
      <span>${mood.emoji}</span>${mood.label}
    </button>
  `).join("");
}

function renderDailyMoodButtons() {
  renderMoodGrid("dailyMoodGrid", "data-daily-mood", selectedDailyMood);
}

function renderDailyForm() {
  const record = recordForDate(selectedDate);
  const mood = record.mood || selectedDailyMood;
  selectedDailyMood = mood;

  $("selectedDateLabel").textContent = formatDate(selectedDate);
  $("selectedDateScore").textContent = record.wellness ? `${record.wellness.score}/100` : "--";
  $("selectedDateMood").textContent = record.mood ? `${record.mood.emoji} ${record.mood.label}` : "No record yet";
  $("dailyFormDate").textContent = formatDate(selectedDate);
  $("dailySavedBadge").textContent = record.hasRecord ? "Saved" : "New";
  $("dailyJournal").value = record.journal?.text || "";
  $("dailyStudyHours").value = record.wellness?.study ?? 6;
  $("dailySleepHours").value = record.wellness?.sleep ?? 7;
  $("dailyWaterIntake").value = record.wellness?.water ?? 6;
  $("dailyExerciseMinutes").value = record.wellness?.exercise ?? 20;
  $("dailyWellnessScore").textContent = record.wellness?.score ?? "--";
  $("dailyScoreMessage").textContent = record.wellness ? scoreMessage(record.wellness.score) : "Save this day to generate a score.";
  renderDailyMoodButtons();
}

function renderMoodButtons() {
  renderMoodGrid("moodGrid", "data-mood", selectedMood);
}

function renderJournal() {
  const entries = [...state.entries].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  $("entryCount").textContent = `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`;

  if (!entries.length) {
    $("journalTimeline").innerHTML = `<p class="empty-state">No entries yet.</p>`;
    return;
  }

  $("journalTimeline").innerHTML = entries.map((entry) => `
    <button class="timeline-item clickable-card" type="button" data-open-date="${entry.date || entry.createdAt.slice(0, 10)}">
      <time>${entry.createdAt ? prettyTime(entry.createdAt) : formatDate(entry.date)}</time>
      <p>${escapeHtml(entry.text).replaceAll("\n", "<br>")}</p>
      ${entry.aiResponse ? `<div style="margin-top: 12px; padding: 12px; background: rgba(15, 139, 122, 0.1); border-left: 3px solid var(--accent); border-radius: 4px;"><strong>Recommendation:</strong><p style="margin: 4px 0 0; color: var(--accent); font-size: 0.9rem;">${escapeHtml(entry.aiResponse)}</p></div>` : ""}
    </button>
  `).join("");
}

function renderMoodHistory() {
  const items = [...state.moods].sort((a, b) => b.date.localeCompare(a.date));

  if (!items.length) {
    $("moodHistory").innerHTML = `<p class="empty-state">No moods logged yet.</p>`;
    return;
  }

  $("moodHistory").innerHTML = items.map((item) => `
    <button class="history-item clickable-card" type="button" data-open-date="${item.date}">
      <time>${formatDate(item.date)}</time>
      <p>${item.emoji} ${item.label}</p>
    </button>
  `).join("");
}

function renderWellness() {
  const latest = state.wellness.find((item) => item.date === todayKey());
  const score = latest?.score;
  $("wellnessScore").textContent = score ?? "--";
  
  if (score) {
    const sleep = latest?.sleep ?? 7;
    const study = latest?.study ?? 6;
    let context = "";
    if (sleep < 6) context = " Protect your sleep tonight.";
    else if (study > 10) context = " Heavy study load, take a real break.";
    $("scoreMessage").textContent = scoreMessage(score) + context;
  } else {
    $("scoreMessage").textContent = "Save a check-in to see your score.";
  }
}

function scoreMessage(score) {
  if (score >= 82) return "Strong foundations today. Keep the rhythm gentle.";
  if (score >= 65) return "Decent balance. A small recovery action would help.";
  if (score >= 45) return "Your system is asking for care before more push.";
  return "Recovery first today. Shorten the load and protect sleep.";
}

function renderDashboardStats() {
  const today = recordForDate(todayKey());
  $("todayMood").textContent = today.mood ? `${today.mood.emoji} ${today.mood.label}` : "Not logged";
  $("todayScore").textContent = today.wellness ? `${today.wellness.score}/100` : "--";
  $("todaySleep").textContent = today.wellness ? `${today.wellness.sleep}h` : "--";
  $("todayStudy").textContent = today.wellness ? `${today.wellness.study}h` : "--";
}

function renderInsights() {
  const records = getLastDays(insightDays).map(recordForDate);
  const moodValues = records.map((r) => r.mood?.value).filter(Number.isFinite);
  const sleepValues = records.map((r) => r.wellness?.sleep).filter(Number.isFinite);
  const studyValues = records.map((r) => r.wellness?.study).filter(Number.isFinite);
  const scoreValues = records.map((r) => r.wellness?.score).filter(Number.isFinite);
  
  const stressDays = records.filter((r) => r.mood?.value <= 2).length;
  const heavyDays = records.filter((r) => r.wellness?.study > 10).length;
  const improvedStreak = longestImprovingStreak(scoreValues);
  const sleepSpread = sleepValues.length ? Math.max(...sleepValues) - Math.min(...sleepValues) : 0;
  const avg = (values) => (values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0);

  const cards = [
    {
      level: avg(moodValues) >= 3.7 ? "good" : stressDays >= 3 ? "danger" : "warn",
      kicker: `${insightDays}-day mood`,
      title: moodValues.length ? `${avg(moodValues).toFixed(1)}/5 average` : "No mood data yet",
      message: stressDays ? `${stressDays} stressful day(s) logged.` : "Mood pattern is steady.",
    },
    {
      level: sleepSpread <= 1.5 && sleepValues.length >= 3 ? "good" : "warn",
      kicker: "Sleep consistency",
      title: sleepValues.length ? `${avg(sleepValues).toFixed(1)}h average` : "No sleep data",
      message: sleepValues.length ? `Sleep varied by ${sleepSpread.toFixed(1)}h.` : "Add check-ins.",
    },
    {
      level: heavyDays ? "warn" : "good",
      kicker: "Study habits",
      title: studyValues.length ? `${avg(studyValues).toFixed(1)}h average` : "No study data",
      message: heavyDays ? `${heavyDays} unusually high workload day(s).` : "No extreme load detected.",
    },
    {
      level: improvedStreak >= 3 ? "good" : avg(scoreValues) < 55 && scoreValues.length ? "danger" : "warn",
      kicker: "Wellness streaks",
      title: improvedStreak >= 3 ? `${improvedStreak}-day streak` : `${Math.round(avg(scoreValues)) || "--"}/100 avg`,
      message: improvedStreak >= 3 ? "Wellness is climbing." : "Watch for recovery momentum.",
    },
  ];

  $("insightCards").innerHTML = cards.map((c) => `
    <article class="radar-card ${c.level}">
      <span>${c.kicker}</span><h2>${c.title}</h2><p>${c.message}</p>
    </article>
  `).join("");
}

/**
 * Calculates the longest streak of sequentially improving (increasing) numerical values.
 * @param {Array<number>} values - Array of numerical values (e.g. wellness scores).
 * @returns {number} The maximum number of consecutive improvements.
 */
function longestImprovingStreak(values) {
  let current = 1, best = 0, previous = null;
  values.forEach((value) => {
    if (previous !== null && value > previous) current++;
    else current = 1;
    best = Math.max(best, current);
    previous = value;
  });
  return best;
}

function renderCharts() {
  try {
    if (!window.Chart) {
      console.warn("Chart.js not loaded. Skipping chart rendering.");
      return;
    }
    const labels = getLastDays(insightDays);
    const shortLabels = labels.map((d) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(localDate(d)));
    const moodMap = Object.fromEntries(state.moods.map((i) => [i.date, i.value]));
    const wellnessMap = Object.fromEntries(state.wellness.map((i) => [i.date, i]));

    makeChart("moodChart", "line", shortLabels, labels, labels.map((d) => moodMap[d] ?? null), "Mood", 1, 5);
    makeChart("sleepChart", "bar", shortLabels, labels, labels.map((d) => wellnessMap[d]?.sleep ?? null), "Sleep", 0, 10);
    makeChart("studyChart", "bar", shortLabels, labels, labels.map((d) => wellnessMap[d]?.study ?? null), "Study", 0, 14);
    makeChart("scoreChart", "line", shortLabels, labels, labels.map((d) => wellnessMap[d]?.score ?? null), "Score", 0, 100);
  } catch (err) {
    console.error("Failed to render charts:", err);
  }
}

function makeChart(id, type, labels, dateKeys, data, label, min, max) {
  try {
    const ctx = $(id);
    if (!ctx) return;
    charts[id]?.destroy();
    charts[id] = new Chart(ctx, {
      type,
      data: {
        labels,
        datasets: [{
          label, data,
          borderColor: "#0f8b7a",
          backgroundColor: type === "bar" ? "rgba(47, 111, 221, 0.34)" : "rgba(15, 139, 122, 0.16)",
          borderWidth: 2, tension: 0.35, fill: type === "line", spanGaps: true,
          pointRadius: type === "line" ? 4 : 0,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        onClick: (_e, elements) => {
          if (elements.length) openCalendarDate(dateKeys[elements[0].index]);
        },
        plugins: { legend: { display: false } },
        scales: {
          y: { min, max, ticks: { precision: 0 } },
          x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6 } },
        },
      },
    });
  } catch (err) {
    console.error(`Failed to initialize chart ${id}:`, err);
  }
}

/**
 * Analyzes the last 7 days of user records to detect burnout and stress patterns.
 * @returns {Array<{level: string, kicker: string, title: string, message: string}>} Array of insight cards.
 */
function analyzeBurnout() {
  const result = [];
  const recentRecords = getLastDays(7).map(recordForDate);
  const stressedRun = recentRecords.filter((r) => r.mood?.value <= 2).length >= 3;
  const lowSleep = recentRecords.some((r) => r.wellness?.sleep < 5.5);
  const heavyStudy = recentRecords.some((r) => r.wellness?.study > 10);
  const lowScores = recentRecords.filter((r) => r.wellness?.score < 50).length >= 2;

  if (stressedRun) result.push({ level: "danger", kicker: "Mood pattern", title: "Stress is clustering", message: "Plan one lighter study block." });
  if (lowSleep) result.push({ level: "warn", kicker: "Sleep signal", title: "Sleep is running low", message: "Protect a wind-down window tonight." });
  if (heavyStudy) result.push({ level: "warn", kicker: "Study load", title: "Hours are getting excessive", message: "Trade one long block for active recall." });
  if (lowScores) result.push({ level: "danger", kicker: "Wellness score", title: "Recovery needs priority", message: "Keep the target small today." });
  if (!result.length) result.push({ level: "good", kicker: "Current radar", title: "No major burnout pattern detected", message: "Keep checking in daily." });

  return result;
}

function renderRadar() {
  $("radarCards").innerHTML = analyzeBurnout().map((c) => `
    <article class="radar-card ${c.level}"><span>${c.kicker}</span><h2>${c.title}</h2><p>${c.message}</p></article>
  `).join("");
}

function renderReset() {
  $("affirmations").innerHTML = affirmations.map((t) => `<div class="affirmation">${t}</div>`).join("");
  $("recoveryList").innerHTML = recoveryItems.map((t, i) => `<label class="check-row"><input type="checkbox" /> <span>${i + 1}. ${t}</span></label>`).join("");
  $("quoteCards").innerHTML = quotes.map(([t, q]) => `<article class="quote-card"><strong>${t}</strong><p>${q}</p></article>`).join("");
}

// ==========================================
// BUSINESS LOGIC
// ==========================================

/**
 * Simple keyword-based AI logic to provide empathetic recommendations based on journal text.
 * @param {string} text - The raw text input from the user's journal.
 * @returns {string|null} A recommendation string, or null if no keywords match.
 */
function getMoodRecommendation(text) {
  const lower = text.toLowerCase();
  if (lower.includes("sad")) return "It's okay to feel sad. Be gentle with yourself today.";
  if (lower.includes("happy") || lower.includes("great")) return "That's wonderful! Carry this positive energy with you.";
  if (lower.includes("tired") || lower.includes("exhaust")) return "Your body needs rest. Please prioritize sleep tonight.";
  if (lower.includes("anxious") || lower.includes("stress")) return "Take a deep breath. Try the 60-second reset in the Brain Dump tab.";
  return null;
}

function startBreathing() {
  let seconds = 60;
  clearInterval(breathInterval);
  $("breathingCircle").classList.add("active");
  $("breathButton").textContent = "Restart 60s Reset";
  $("breathTimer").textContent = seconds;

  breathInterval = setInterval(() => {
    seconds -= 1;
    $("breathTimer").textContent = seconds;
    $("breathPhase").textContent = seconds % 8 > 3 ? "Breathe Out" : "Breathe In";
    if (seconds <= 0) {
      clearInterval(breathInterval);
      $("breathingCircle").classList.remove("active");
      $("breathPhase").textContent = "Done";
      $("breathButton").textContent = "Start 60s Reset";
    }
  }, 1000);
}

// ==========================================
// NAVIGATION & EVENTS
// ==========================================

function pageFromHash() {
  const page = location.hash.replace("#", "") || "calendar";
  return $(page) ? page : "calendar";
}

function switchPage() {
  const activePage = pageFromHash();
  document.querySelectorAll(".page").forEach((page) => page.classList.toggle("active", page.id === activePage));
  document.querySelectorAll(".nav-link").forEach((link) => link.classList.toggle("active", link.dataset.page === activePage));
  if (activePage === "dashboard") {
    renderInsights();
    renderCharts();
  } else if (activePage === "radar") {
    renderRadar();
  }
}

function openCalendarDate(date) {
  selectedDate = date > todayKey() ? todayKey() : date;
  visibleMonth = monthStart(selectedDate);
  location.hash = "calendar";
  renderCalendar();
}

function handleThemeToggle() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  saveState();
  applyTheme();
  if (pageFromHash() === "dashboard") renderCharts();
}

function handleClearData() {
  if (!window.confirm("Clear all BrainDumpz data saved in this browser?")) return;
  state = { ...defaultState, theme: state.theme };
  selectedMood = moods[1];
  selectedDailyMood = moods[1];
  saveState();
  renderAll();
}

function handleDailyFormSubmit(event) {
  event.preventDefault();
  const existing = recordForDate(selectedDate).journal;
  const newEntry = createJournalEntry($("dailyJournal").value, selectedDate, existing);
  
  state.entries = state.entries.filter((entry) => entry.id !== existing?.id && entry.date !== selectedDate);
  if (newEntry) state.entries.push(newEntry);

  state.moods = upsertByDate(state.moods, { ...selectedDailyMood, date: selectedDate });
  state.wellness = upsertByDate(state.wellness, extractWellnessForm("daily", selectedDate));
  
  saveState();
  renderCalendar();
  if (selectedDate === todayKey()) {
    renderWellness();
    renderDashboardStats();
  }
  renderMoodHistory();
  renderJournal();
}

function handleJournalFormSubmit(event) {
  event.preventDefault();
  const date = todayKey();
  const newEntry = createJournalEntry($("journalText").value, date);
  if (!newEntry) return;
  
  state.entries = state.entries.filter((entry) => entry.date !== date);
  state.entries.push(newEntry);
  
  saveState();
  $("journalText").value = "";
  renderJournal();
  renderCalendar();
}

function handleMoodFormSubmit(event) {
  event.preventDefault();
  state.moods = upsertByDate(state.moods, { ...selectedMood, date: todayKey() });
  saveState();
  renderMoodHistory();
  renderDashboardStats();
  renderCalendar();
}

function handleWellnessFormSubmit(event) {
  event.preventDefault();
  state.wellness = upsertByDate(state.wellness, extractWellnessForm("", todayKey()));
  saveState();
  renderWellness();
  renderDashboardStats();
  renderCalendar();
}

function bindEvents() {
  window.addEventListener("hashchange", switchPage);
  $("themeToggle").addEventListener("click", handleThemeToggle);
  $("clearData").addEventListener("click", handleClearData);
  
  $("prevMonth").addEventListener("click", () => { visibleMonth = shiftMonth(visibleMonth, -1); renderCalendar(); });
  $("nextMonth").addEventListener("click", () => { visibleMonth = shiftMonth(visibleMonth, 1); renderCalendar(); });
  
  $("calendarGrid").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-date]");
    if (btn && !btn.disabled) openCalendarDate(btn.dataset.date);
  });
  
  $("dailyMoodGrid").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-daily-mood]");
    if (btn) {
      selectedDailyMood = moods.find((m) => m.label === btn.dataset.dailyMood);
      renderDailyMoodButtons();
    }
  });
  
  $("moodGrid").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-mood]");
    if (btn) {
      selectedMood = moods.find((m) => m.label === btn.dataset.mood);
      renderMoodButtons();
    }
  });

  document.addEventListener("click", (e) => {
    const card = e.target.closest("[data-open-date]");
    if (card) openCalendarDate(card.dataset.openDate);
  });

  $("rangeTabs").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-days]");
    if (!btn) return;
    insightDays = Number(btn.dataset.days);
    document.querySelectorAll(".range-btn").forEach((item) => item.classList.toggle("active", item === btn));
    renderInsights();
    renderCharts();
  });

  $("dailyForm").addEventListener("submit", handleDailyFormSubmit);
  $("journalForm").addEventListener("submit", handleJournalFormSubmit);
  $("moodForm").addEventListener("submit", handleMoodFormSubmit);
  $("wellnessForm").addEventListener("submit", handleWellnessFormSubmit);
  $("breathButton").addEventListener("click", startBreathing);
}

function renderAll() {
  applyTheme();
  renderCalendar();
  renderMoodButtons();
  renderJournal();
  renderMoodHistory();
  renderWellness();
  renderDashboardStats();
  renderReset();
}

// ==========================================
// BOOTSTRAP & MANUAL TESTING DOCUMENTATION
// ==========================================
if (typeof window !== "undefined" && document.getElementById("calendarGrid")) {
  bindEvents();
  renderAll();
  switchPage();
}

/*
 * ==========================================
 * MANUAL TESTING DOCUMENTATION
 * ==========================================
 * 
 * 1. Journal Submission & Sanitization
 *    How to verify: Open the "Brain Dump" tab. Enter "   <script>alert(1)</script>   ". 
 *    Verify that: 
 *      - It trims leading/trailing spaces.
 *      - It does not execute the script, but displays it safely as text in the timeline.
 *      - Submitting an empty string or just spaces does nothing (defensive handling).
 * 
 * 2. Mood Selection
 *    How to verify: Go to the "Mood" tab. Select "Great" and submit. 
 *    Verify that:
 *      - The "Great" mood instantly appears in the Mood History list.
 *      - The Dashboard immediately updates the "Today's Mood" card.
 * 
 * 3. Wellness Calculations & Defensive Handling
 *    How to verify: Open the "Wellness" tab. Try to enter "50" into sleep hours or "-5" into study hours.
 *    Verify that:
 *      - The values are automatically clamped when calculating (e.g., Sleep is capped between 0-24).
 *      - The Wellness Score generates a valid number (0-100) and never evaluates to NaN.
 * 
 * 4. Radar Insights & Missing Data
 *    How to verify: Ensure your app has no history (Settings -> Clear Data). Open the "Radar" tab.
 *    Verify that:
 *      - It safely displays "No major burnout pattern detected" instead of throwing undefined errors 
 *        from empty arrays.
 * 
 * 5. LocalStorage & Persistence Failures
 *    How to verify: Open your browser dev tools console and run:
 *      `localStorage.setItem = () => { throw new Error("QuotaExceededError"); }`
 *    Then try to save a new journal entry.
 *    Verify that:
 *      - The app does not crash or turn blank.
 *      - A browser alert warns you that storage is full or disabled.
 * 
 * 6. Chart Rendering Failures
 *    How to verify: Open `index.html` and temporarily comment out the `<script src="chart.umd.min.js">` tag.
 *    Reload the page.
 *    Verify that:
 *      - The app still works perfectly. The Dashboard simply shows everything except the charts, 
 *        and the console logs a safe warning ("Chart.js not loaded. Skipping chart rendering.") 
 *        instead of crashing the entire `renderAll()` execution.
 */
