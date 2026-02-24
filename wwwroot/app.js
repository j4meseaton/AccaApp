const ui = {
  datePicker: document.getElementById("datePicker"),
  timezone: document.getElementById("timezone"),
  runBtn: document.getElementById("runBtn"),
  status: document.getElementById("status"),
  summary: document.getElementById("summary"),
  picksList: document.getElementById("picksList"),
  fixturesList: document.getElementById("fixturesList"),
};

init();

function init() {
  ui.datePicker.value = formatDate(getNextSaturday(new Date()));
  ui.timezone.value = "Europe/London";

  ui.runBtn.addEventListener("click", runAnalysis);
  setStatus("Ready.");
}

async function runAnalysis() {
  const date = ui.datePicker.value;
  const timezone = ui.timezone.value;

  clearResults();

  if (!date) {
    setStatus("Pick a date first.");
    return;
  }

  setStatus("Loading analysis across English leagues...");

  try {
    const query = new URLSearchParams({ date, timezone });
    const response = await fetch(`/api/analysis?${query.toString()}`);

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Failed to load analysis.");
    }

    renderFixtures(payload.fixtures || []);
    renderRankings(payload.topPicks || [], payload.totalRanked || 0);

    if ((payload.fixtures || []).length === 0) {
      ui.summary.textContent = "No 3pm kickoffs found for that date across Prem/Champ/League One/League Two.";
    }

    setStatus("Done.");
  } catch (error) {
    setStatus(error.message || "Failed to load analysis.");
  }
}

function renderFixtures(fixtures) {
  for (const fixture of fixtures) {
    const li = document.createElement("li");
    li.className = "fixture";
    li.textContent = `${fixture.homeTeam} vs ${fixture.awayTeam} (${fixture.kickoff}) - ${fixture.league}`;
    ui.fixturesList.appendChild(li);
  }
}

function renderRankings(topPicks, total) {
  if (!total) return;

  ui.summary.textContent = `Ranked ${total} total fixture picks by confidence. Showing top ${Math.min(10, total)}.`;

  for (const item of topPicks) {
    const li = document.createElement("li");
    li.className = "pick";
    li.innerHTML = `
      <div><strong>${item.pickTeam}</strong> to win - ${item.certainty}%</div>
      <div class="meta">${item.homeTeam} vs ${item.awayTeam} | ${item.kickoff} | ${item.league} | form ${item.homeFormPoints}-${item.awayFormPoints} (last 4) | venue form ${item.homeVenueFormPoints}-${item.awayVenueFormPoints} (home/away last 6) | draw risk ${item.drawRisk} | model ${item.modelScore}</div>
    `;
    ui.picksList.appendChild(li);
  }
}

function setStatus(message) {
  ui.status.textContent = message;
}

function clearResults() {
  ui.summary.textContent = "";
  ui.picksList.innerHTML = "";
  ui.fixturesList.innerHTML = "";
}

function getNextSaturday(fromDate) {
  const d = new Date(fromDate);
  const day = d.getDay();
  const delta = (6 - day + 7) % 7;
  d.setDate(d.getDate() + delta);
  return d;
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
