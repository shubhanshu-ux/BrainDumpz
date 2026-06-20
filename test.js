const resultsDiv = document.getElementById("test-results");

function print(msg, isHeader = false) {
  const el = document.createElement("div");
  if (isHeader) el.className = "suite-title";
  el.innerHTML = msg;
  resultsDiv.appendChild(el);
}

function assert(condition, message) {
  if (condition) {
    print(`<span class="pass">✔ PASS:</span> ${message}`);
  } else {
    print(`<span class="fail">✘ FAIL:</span> ${message}`);
    console.error(`Test failed: ${message}`);
  }
}

function runTests() {
  print("--- UNIT TESTS ---", true);
  
  // Clear state for isolated tests
  state = { ...defaultState, entries: [], moods: [], wellness: [] };
  
  // 1. Wellness Score Calculation
  const highBal = calculateScore({ study: 8, sleep: 7.5, water: 6, exercise: 20 });
  assert(highBal > 80, "Wellness score calculates high for balanced inputs.");
  
  const lowBal = calculateScore({ study: 18, sleep: 2, water: 0, exercise: 0 });
  assert(lowBal < 30, "Wellness score calculates low for poor inputs.");
  
  const clamped = calculateScore({ study: 50, sleep: -5, water: 900, exercise: 5000 });
  assert(!Number.isNaN(clamped) && clamped >= 0 && clamped <= 100, "Wellness score clamps absurd invalid inputs safely.");

  // 2. Burnout Detection Logic
  state.moods = [
    { date: shiftDate(todayKey(), -1), value: 2 },
    { date: shiftDate(todayKey(), -2), value: 2 },
    { date: shiftDate(todayKey(), -3), value: 2 }
  ];
  let burnout = analyzeBurnout();
  assert(burnout.some(b => b.kicker === "Mood pattern"), "Burnout logic successfully detects 3 consecutive days of stress.");
  
  state.wellness = [
    { date: shiftDate(todayKey(), -1), sleep: 4 },
    { date: shiftDate(todayKey(), -2), sleep: 3 }
  ];
  burnout = analyzeBurnout();
  assert(burnout.some(b => b.kicker === "Sleep signal"), "Burnout logic successfully detects low sleep pattern.");

  // 3. Mood tracking logic (upsertByDate)
  state.moods = upsertByDate(state.moods, { date: todayKey(), value: 4, label: "Good" });
  assert(state.moods.find(m => m.date === todayKey()).value === 4, "Mood tracking correctly inserts a new mood.");
  
  state.moods = upsertByDate(state.moods, { date: todayKey(), value: 5, label: "Great" });
  assert(state.moods.filter(m => m.date === todayKey()).length === 1, "Mood tracking updates existing date without duplicating.");
  assert(state.moods.find(m => m.date === todayKey()).value === 5, "Mood tracking correctly overwrites the old value.");


  print("--- INTEGRATION TESTS ---", true);
  
  // Reset state
  state = { ...defaultState, entries: [], moods: [], wellness: [] };
  const mockEvent = { preventDefault: () => {} };

  // 4. Create Entry
  document.getElementById("journalText").value = "Feeling anxious about the exam.";
  handleJournalFormSubmit(mockEvent);
  
  let todayEntry = state.entries.find(e => e.date === todayKey());
  assert(todayEntry !== undefined, "Integration: Journal entry successfully created for today.");
  assert(todayEntry.text === "Feeling anxious about the exam.", "Integration: Journal entry text matches input.");
  assert(todayEntry.aiResponse !== null, "Integration: AI Keyword detection triggered a gentle recommendation for 'anxious'.");
  
  // 5. Edit Entry
  document.getElementById("journalText").value = "Feeling much better now, happy!";
  handleJournalFormSubmit(mockEvent);
  
  todayEntry = state.entries.find(e => e.date === todayKey());
  assert(state.entries.filter(e => e.date === todayKey()).length === 1, "Integration: Editing an entry replaces the old one for that date.");
  assert(todayEntry.text === "Feeling much better now, happy!", "Integration: Entry text successfully updated.");
  
  // 6. View Dashboard Insights
  state.wellness = [{ date: todayKey(), score: 80, sleep: 7, study: 6 }];
  try {
    renderInsights();
    assert(true, "Integration: View dashboard insights renders without throwing errors.");
    assert(document.getElementById("insightCards").innerHTML.includes("radar-card"), "Integration: Dashboard successfully generated insight cards HTML.");
  } catch(e) {
    assert(false, "Integration: View dashboard insights threw an error: " + e.message);
  }

  // 7. Emergency Reset Mode
  try {
    startBreathing();
    assert(document.getElementById("breathingCircle").classList.contains("active"), "Integration: Emergency Reset mode starts breathing animation.");
    assert(document.getElementById("breathTimer").textContent === "60", "Integration: Emergency Reset timer initialized to 60s.");
  } catch(e) {
    assert(false, "Integration: Emergency Reset Mode threw an error: " + e.message);
  }
  
  // Cleanup test side-effects
  clearInterval(breathInterval);
  
  print("--- END OF TESTS ---", true);
}

runTests();
