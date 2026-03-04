
document.addEventListener("DOMContentLoaded", init);

// --------- Global state (in-memory during a run) ----------
let timerStarted = false;
let intervalId = null;
let totalTyped = 0;
let correctTyped = 0;
let wrongTyped = 0;
let startTime = 0;          // set at first keystroke
let indexPos = 0;           // current caret position
let currentQuote = "";      // set on started page
let currentMode = "";       // "timed" | "passage"

// ---------- Router ----------
function init() {
  const path = window.location.pathname;
  const isStartedPage = path.includes("start.html");
  const isResultPage  = path.includes("results.html");
  const isFirstPage   = path.includes("first.html");
  const isBestPage    = path.includes("personal_best.html");

  if (isResultPage) initResultPage();
  else if (isStartedPage) initStartedPage();
  else if (isFirstPage) initFirstPage();
  else if (isBestPage) initPbPage();
  else initHomepage();
}

// ---------- Home ----------
function initHomepage() {
  const easy = document.getElementById("easy");
  const medium = document.getElementById("medium");
  const hard = document.getElementById("hard");
  const timed = document.getElementById("timed");
  const passage = document.getElementById("passage");
  const startKey = document.getElementById("startB");

  if (easy)   easy.addEventListener("click", () => difficulty("easy"));
  if (medium) medium.addEventListener("click", () => difficulty("medium"));
  if (hard)   hard.addEventListener("click", () => difficulty("hard"));

  if (timed)   timed.addEventListener("click", () => mode("timed"));
  if (passage) passage.addEventListener("click", () => mode("passage"));

  if (startKey) {
    startKey.addEventListener("click", () => {
      if (!localStorage.getItem("level")) {
        difficulty("easy"); // sets quote too
      }
      if (!localStorage.getItem("mode")) {
        mode("timed");
      }
      window.location.href = "start.html";
    });
  }
}

// ---------- Started (typing) ----------
function initStartedPage() {
  currentQuote = localStorage.getItem("quote") || "";
  const level  = localStorage.getItem("level") || "";
  currentMode  = localStorage.getItem("mode") || "";
  const input = document.getElementById("input")

  const textArea = document.getElementById("start2");
  const restart  = document.getElementById("restart");

  if (!currentQuote || !currentMode || !textArea) {
    // Missing essentials — go home and start clean
    window.location.href = "index.html";
    return;
  }

  // Render quote into spans (initialize with "idle")
  textArea.innerHTML = currentQuote.split("").map(ch => `<span class="idle">${ch}</span>`).join("");

  const spans = () => document.querySelectorAll("#start2 span");
  indexPos = 0;
  setCursor(spans(), 0);

  // Highlight selected level/mode UI
  if (level) highlightSelected(levelMapToElementId(level));
  if (currentMode === "timed")   highlightSelected("timed2");
  if (currentMode === "passage") highlightSelected("passage2");

  // Key handling
  input.focus()
  textArea.addEventListener("click",()=>input.focus() )
  const onKeyDown = (event) => {
    // Start the timer exactly once on first keypress that we accept
    if (!timerStarted && (event.key === "Backspace" || event.key.length === 1)) {
      startTime = Date.now();
      startTimerOnce(currentMode);
    }

    // Backspace logic
    if (event.key === "Backspace") {
      if (indexPos > 0) {
        indexPos -= 1;
        const sp = spans()[indexPos];
        if (sp.classList.contains("correct")) {
          correctTyped = Math.max(0, correctTyped - 1);
          totalTyped = Math.max(0, totalTyped - 1);
        } else if (sp.classList.contains("wrong")) {
          wrongTyped = Math.max(0, wrongTyped - 1);
          totalTyped = Math.max(0, totalTyped - 1);
        }
        sp.classList.remove("correct", "wrong");
        sp.classList.add("idle");
        setCursor(spans(), indexPos);
        updateLiveStats();
      }
      event.preventDefault();
      return;
    }

    // Only count printable single characters
    if (event.key.length !== 1) return;

    const nodes = spans();
    const currentSpan = nodes[indexPos];

    // Finished all characters (safety)
    if (!currentSpan) {
      finishTestAndGo();
      return;
    }

    const expected = currentQuote[indexPos] || "";
    const typed = event.key;
    totalTyped++;

    if (typed === expected) {
      currentSpan.classList.remove("idle", "wrong");
      currentSpan.classList.add("correct");
      correctTyped++;
    } else {
      currentSpan.classList.remove("idle", "correct");
      currentSpan.classList.add("wrong");
      wrongTyped++;
    }

    indexPos += 1;
    setCursor(nodes, Math.min(indexPos, nodes.length - 1));
    updateLiveStats();

    // Completed the quote
    if (indexPos >= nodes.length) {
      finishTestAndGo();
    }
  };

  document.addEventListener("keydown", onKeyDown);

  // Restart button
  if (restart) {
    restart.addEventListener("click", () => {
      if (intervalId) clearInterval(intervalId);
      timerStarted = false;
      window.location.href = "start.html";
    });
  }
}
// ---------- Live stats (WPM/Accuracy on the fly) ----------
function updateLiveStats() {
  // compute from current counters and elapsed time
  const elapsedSec = startTime ? Math.max(0.001, (Date.now() - startTime) / 1000) : 0.001;
  const elapsedMin = elapsedSec / 60;

  const rawWpm = (totalTyped / 5) / elapsedMin;
  const wpm = (correctTyped / 5) / elapsedMin;
  const accuracy = totalTyped ? (correctTyped / totalTyped) * 100 : 100;

  const statW = document.getElementById("statW");
  if (statW) statW.textContent = wpm.toFixed(1);
  const statA = document.getElementById("statA");
  if (statA) statA.textContent = `${accuracy.toFixed(1)}%`;
}

// ---------- Finish + routing ----------
function finishTestAndGo() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  const elapsedSec = startTime ? Math.max(0.001, (Date.now() - startTime) / 1000) : 0.001;
  const elapsedMin = elapsedSec / 60;

  const rawWpm = (totalTyped / 5) / elapsedMin;
  const wpm = (correctTyped / 5) / elapsedMin;
  const netWpm = rawWpm - (wrongTyped / elapsedMin);
  const accuracy = totalTyped ? (correctTyped / totalTyped) * 100 : 100;

  const results = {
    quote: currentQuote,
    totalTyped,
    correctTyped,
    wrongTyped,
    timeSeconds: Number(elapsedSec.toFixed(2)),
    wpm: Number(wpm.toFixed(1)),
    rawWpm: Number(rawWpm.toFixed(1)),
    netWpm: Number(netWpm.toFixed(1)),
    accuracy: Number(accuracy.toFixed(1)),
    mode: currentMode
  };
  localStorage.setItem("results", JSON.stringify(results));

  // Personal best logic with persistence
  const hasCompletedOnce = localStorage.getItem("hasCompletedOnce") === "true";
  const pbWpm = Number(localStorage.getItem("pbWpm") || "0");
  const isPb = wpm > pbWpm;

  // Update PB
  if (isPb) {
    localStorage.setItem("pbWpm", String(wpm.toFixed(1)));
  }

  if (!hasCompletedOnce) {
    localStorage.setItem("hasCompletedOnce", "true");
    window.location.href = "first.html";
  } else if (isPb) {
    window.location.href = "personal_best.html";
  } else {
    window.location.href = "results.html";
  }
}

// ---------- Cursor ----------
function setCursor(spans, index) {
  spans.forEach(s => s.classList.remove("cursor"));
  if (spans[index]) spans[index].classList.add("cursor");
}

// ---------- Timer controls ----------
function startTimerOnce(mode) {
  if (timerStarted) return;
  timerStarted = true;
  if (mode === "timed") startCountdown(60);
  else startCountup();
}

function startCountdown(startAt = 60) {
  const countdownEl = document.getElementById("statT");
  if (!countdownEl) return;

  let count = startAt;
  renderTime(countdownEl, count);

  intervalId = setInterval(() => {
    count -= 1;
    renderTime(countdownEl, count);
    if (count <= 0) {
      clearInterval(intervalId);
      intervalId = null;
      // Save final stats before navigating
      finishTestAndGo();
    }
  }, 1000);
}

function startCountup() {
  const countdownEl = document.getElementById("statT");
  if (!countdownEl) return;

  let count = 0;
  renderTime(countdownEl, count);
  intervalId = setInterval(() => {
    count += 1;
    renderTime(countdownEl, count);
  }, 1000);
}

function renderTime(el, seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  el.textContent = `${m}:${s}`;
}

// ---------- Level/Mode selection ----------
function difficulty(level) {
  localStorage.setItem("level", level);
  let quotes;
  if (level === "easy") {
    quotes = ["The morning sky was bright and clear. Birds flew over the rooftops as people left their homes. A few cars moved slowly down the street. Everything felt calm and simple, just like an ordinary day.", 
                "Lena placed her books on the table and smiled. She liked reading stories about animals and faraway places. Her little brother sat beside her, drawing pictures with his crayons. They enjoyed quiet afternoons together.",
                "At the beach, waves rolled gently onto the sand. Children built small castles, laughing as the water washed around their feet. Parents watched from nearby chairs, happy to see everyone having fun. The sun warmed the shore.",
                "The bakery smelled wonderful in the early hours. Fresh bread, warm pies, and sweet cakes filled the shelves. People lined up to buy breakfast before work. The baker greeted each person with a friendly smile.",
                "In the park, a dog chased a red ball across the grass. Its owner walked behind, trying to keep up. A few joggers passed by on the path, enjoying the cool air. It was a simple and pleasant scene."
    ]
  } else if (level === "medium") {
    quotes = ["The old train station had become a favorite meeting place for travelers and locals alike. Although the building was aging, its tall windows still let in plenty of warm sunlight. People often gathered there to share stories, study maps, or simply watch the trains arrive and leave.", 
            "When Victor stepped into the art studio, he was immediately greeted by the scent of paint and the soft sound of brushes tapping against glass jars. Each canvas told a different story, ranging from peaceful landscapes to energetic abstract shapes. He found himself lost in the colors.", 
            "During the school science fair, students filled the gym with projects of all kinds. Some built small robots, others demonstrated chemical reactions, and a few created detailed models of planets. The excitement in the room grew as judges moved from one display to another.", 
            "Despite the warm weather, the library was cool and quiet inside. Rows of books stretched down long aisles, and the soft glow of lamps created a peaceful atmosphere. Many visitors stayed for hours, reading or completing assignments in comfortable chairs.",
            "At the community garden, volunteers worked together to plant new seeds for the season. They watered the soil, pulled out weeds, and carefully marked each section with wooden signs. With patience and teamwork, they hoped to see a beautiful harvest in the coming months."
    ]
  } else {
    quotes = ["Although the research team had spent years preparing for the expedition, nothing could have fully anticipated the sheer complexity of the ecosystem they encountered once they descended into the cavernous rainforest basin. Layers of humidity clung to every surface, creating an environment where moss, insects, and microorganisms thrived in ways rarely documented. As the scientists attempted to catalog the species that appeared before them—many of which displayed traits that challenged long‑held assumptions about evolutionary stability—they found themselves compelled to reevaluate not only their methodologies but also their underlying expectations. What began as a structured investigation gradually became a philosophical journey, forcing them to confront the uncomfortable idea that the natural world might forever remain partially unknowable, no matter how sophisticated their tools became.", 
            "The rapid expansion of interconnected digital systems has created a paradox in modern society: the more efficient our technologies become, the more vulnerable we are to subtle disruptions that ripple across entire networks. A minor software malfunction in a single data center, for instance, can cascade through dependent services with astonishing speed, temporarily halting logistics chains, communication platforms, and financial transactions. Engineers tasked with maintaining these systems increasingly rely on predictive models and adaptive algorithms that monitor thousands of variables simultaneously, yet even these tools occasionally struggle to account for human behavior, environmental fluctuations, or rare anomalies. This delicate balance between control and unpredictability has prompted scholars to argue that digital resilience is no longer merely a technical challenge but a cultural and psychological one as well.", 
            "Historical archives reveal that periods of innovation often arise not from stability but from moments of uncertainty, when existing structures begin to fracture and new possibilities demand attention. During such transitions, individuals are pushed to reconsider long‑held beliefs, explore unconventional ideas, and challenge the assumptions that previously guided their choices. What makes these eras particularly fascinating is the tension between progress and resistance: while some embrace emerging opportunities with enthusiasm, others cling to familiar traditions, fearing that change may lead to unforeseen consequences. This conflict—between the desire to advance and the instinct to preserve—creates a dynamic landscape in which cultures evolve, sometimes gradually and sometimes through sudden, dramatic shifts.", 
            "As the expedition advanced deeper into the tundra, the team encountered geological formations that appeared to defy conventional explanation. Jagged cliffs twisted in patterns suggesting multiple cycles of tectonic upheaval, yet the surrounding sediment layers implied a far more stable history. Intrigued, the geologists conducted a series of analyses, extracting mineral samples and scanning the terrain with specialized instruments designed to detect traces of ancient seismic activity. Their findings, however, only deepened the mystery: isotopic markers indicated that the region had experienced several intense but localized events, each separated by long periods of quiet. These irregular rhythms raised profound questions about planetary processes—questions that hinted at mechanisms not yet accounted for in current scientific models.",
            "In the quiet hours of the early morning, when most of the city still slept, the observatory came alive with activity as astronomers synchronized their instruments for a rare celestial event. High‑resolution sensors calibrated themselves against the faint glow of distant stars, while computers processed streams of data that flowed continuously from satellites orbiting far above Earth. The researchers understood that each measurement carried enormous significance: a slight shift in brightness, an unexpected flare, or an unusual spectral pattern could reveal phenomena that reshaped entire theories about cosmic formation. Yet despite the enormity of their task, a sense of calm determination filled the room, driven by the shared belief that discovery—no matter how uncertain or difficult—remains one of humanity’s most compelling pursuits."
    ]
  }
  const rand = Math.floor(Math.random() * quotes.length);
  localStorage.setItem("quote", quotes[rand]);
}

function mode(type) {
  localStorage.setItem("mode", type);
}

function levelMapToElementId(level) {
  if (level === "easy") return "easy2";
  if (level === "medium") return "medium2";
  if (level === "hard") return "hard2";
  return null;
}

function highlightSelected(selectOrId) {
  const el = typeof selectOrId === "string" ? document.getElementById(selectOrId) : selectOrId;
  if (!el) {
    console.warn("highlightSelected: element not found for", selectOrId);
    return;
  }
  el.style.outline = "2px solid hsl(214, 100%, 55%)";
  el.style.outlineOffset = "2px";
}

// ---------- Results pages ----------
function safeGetResultsOrRedirect() {
  const raw = localStorage.getItem("results");
  if (!raw) {
    window.location.href = "index.html";
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    window.location.href = "index.html";
    return null;
  }
}

function bindResultsCommon() {
  const wpmR   = document.getElementById("e5");
  const accR   = document.getElementById("n0");
  const corrR  = document.getElementById("outlookC");
  const wrongR = document.getElementById("outlookD");
  const resultB = document.getElementById("b_result");

  const results = safeGetResultsOrRedirect();
  if (!results) return;

  if (wpmR)   wpmR.textContent = String(results.wpm);
  if (accR)   accR.textContent = `${results.accuracy}%`;
  if (corrR)  corrR.textContent = String(results.correctTyped);
  if (wrongR) wrongR.textContent = String(results.wrongTyped);
  if (resultB) {
    resultB.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  }
}

function initResultPage() { bindResultsCommon(); }
function initFirstPage()  { bindResultsCommon(); }
function initPbPage()     { bindResultsCommon(); }
