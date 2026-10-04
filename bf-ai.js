// BODY FORGE AI - real analysis helpers (window.BFAI)
// 1) Metrics (BMI, BMR, calories, protein) are computed locally - no internet needed.
// 2) Chat + photo analysis use the Anthropic API when an API key is saved in this browser.
//    Without a key the app falls back to built-in rule-based answers.
// NOTE: the key is stored in localStorage and sent straight from the browser. Fine for a
// personal/college demo; for production put the key on a server instead.

const KEY_NAME = "bodyForgeApiKey";
const MODEL = "claude-sonnet-4-6";

function getKey() { try { return localStorage.getItem(KEY_NAME) || ""; } catch (e) { return ""; } }
function setKey(k) { try { localStorage.setItem(KEY_NAME, k.trim()); } catch (e) {} }
function promptKey() {
  const k = prompt("Paste your Anthropic API key to enable real AI (stored only in this browser).\nLeave empty to keep using offline mode:", getKey());
  if (k !== null) setKey(k);
  return getKey();
}

function metrics(p) {
  if (!p) return null;
  const w = parseFloat(p.weight), h = parseFloat(p.height), a = parseFloat(p.age);
  if (!w || !h || !a) return null;
  const m = h / 100, bmi = w / (m * m);
  const category = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal" : bmi < 30 ? "Overweight" : "Obese";
  const male = String(p.gender || "").toLowerCase().startsWith("m");
  const bmr = 10 * w + 6.25 * h - 5 * a + (male ? 5 : -161);
  const lvl = String(p.fitnessLevel || "").toLowerCase();
  const factor = lvl.includes("adv") ? 1.725 : lvl.includes("inter") ? 1.55 : 1.375;
  const tdee = bmr * factor;
  const goal = String(p.goal || "").toLowerCase();
  let calories = tdee, protein = 1.6;
  if (goal.includes("loss") || goal.includes("fat") || goal.includes("lose")) { calories = tdee - 400; protein = 2.0; }
  else if (goal.includes("muscle") || goal.includes("gain") || goal.includes("bulk")) { calories = tdee + 300; protein = 2.0; }
  return {
    bmi: +bmi.toFixed(1), category,
    bmr: Math.round(bmr), tdee: Math.round(tdee),
    calories: Math.round(Math.max(calories, male ? 1500 : 1200)),
    protein: Math.round(protein * w),
    healthyMin: +(18.5 * m * m).toFixed(1), healthyMax: +(24.9 * m * m).toFixed(1)
  };
}

async function ask(messages, system, maxTokens = 700) {
  const key = getKey();
  if (!key) throw new Error("no-key");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages })
  });
  if (!res.ok) throw new Error("API " + res.status);
  const data = await res.json();
  return data.content.filter(c => c.type === "text").map(c => c.text).join("\n");
}

function systemPrompt(profile) {
  const m = metrics(profile);
  let s = "You are Body Forge AI, a friendly fitness and nutrition coach inside a college project app. " +
    "Give practical, safe, concise advice (under 150 words). You are not a doctor; suggest seeing one for medical issues.";
  if (profile) s += "\nUser profile: " + JSON.stringify(profile);
  if (m) s += "\nComputed metrics: " + JSON.stringify(m);
  return s;
}

async function analyzePhoto(dataUrl, profile) {
  const match = /^data:(image\/[a-z]+);base64,(.+)$/.exec(dataUrl || "");
  if (!match) throw new Error("bad-image");
  return ask([{ role: "user", content: [
    { type: "image", source: { type: "base64", media_type: match[1], data: match[2] } },
    { type: "text", text: "Give a brief, respectful visual fitness assessment of this photo: general body type, posture observations, 2-3 areas to focus on, and 4 short training/nutrition recommendations tailored to the profile. Do not state exact body-fat or weight numbers and do not diagnose. Use short plain lines starting with an emoji." }
  ]}], systemPrompt(profile), 600);
}

function fmt(t) {
  return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>");
}

function shrinkImage(dataUrl, max = 800) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.75));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}


// ---------- OFFLINE SMART ENGINE (no internet, no key) ----------
function coach(q, p) {
  q = String(q).toLowerCase(); const m = metrics(p); const n = p && p.name ? p.name.split(" ")[0] : "";
  const has = (...w) => w.some(x => q.includes(x));
  if (has("hello", "hi ", "hey") || q.trim() === "hi") return "Hi" + (n ? " " + n : "") + "! 👋 Ask me about workouts, diet, calories, protein, recovery or your goal.";
  if (m && has("calorie", "kcal", "how much should i eat", "maintenance")) return "🔥 Based on your profile, you burn about <strong>" + m.tdee + " kcal/day</strong>. For your goal (" + p.goal + ") aim for <strong>" + m.calories + " kcal/day</strong>.";
  if (m && has("protein")) return "🥩 Your protein target is about <strong>" + m.protein + " g/day</strong>. Spread it over 3-4 meals: eggs, paneer, dal, curd, chicken, fish, soy.";
  if (m && has("bmi", "overweight", "underweight", "ideal weight", "healthy weight")) return "⚖️ Your BMI is <strong>" + m.bmi + "</strong> (" + m.category + "). A healthy range for your height is <strong>" + m.healthyMin + "-" + m.healthyMax + " kg</strong>. BMI is a rough guide and ignores muscle mass.";
  if (has("lose", "fat", "belly", "weight loss", "cut")) return "📉 For fat loss: eat ~300-500 kcal below maintenance" + (m ? " (about " + m.calories + " kcal for you)" : "") + ", lift 3-4x/week, walk 8-10k steps daily, keep protein high and sleep 7-8 hours. Aim to lose 0.25-0.75 kg per week.";
  if (has("muscle", "bulk", "gain", "mass")) return "💪 For muscle gain: eat ~250-300 kcal above maintenance" + (m ? " (about " + m.calories + " kcal)" : "") + ", train each muscle 2x/week, add weight or reps gradually, and get " + (m ? m.protein + " g" : "1.6-2 g/kg") + " protein daily.";
  if (has("workout", "exercise", "routine", "split", "how many days", "frequency")) return "🏋️ " + ({beginner: "As a beginner, do 3 full-body days per week with rest days between.", intermediate: "At intermediate level, an upper/lower split 4 days a week works well.", advanced: "At advanced level, push/pull/legs plus upper/lower (5 days) works well."}[String((p && p.fitnessLevel) || "beginner").toLowerCase()] || "3-4 workout days per week is a good start.") + " Open <strong>My Smart Plan</strong> for your full weekly schedule.";
  if (has("rest", "recover", "sleep", "sore")) return "🛌 Sleep 7-9 hours, keep 1-2 full rest days weekly, and avoid training the same muscle two days in a row. Mild soreness is normal; sharp pain is not.";
  if (has("water", "hydrat")) return "💧 Aim for roughly " + (p && p.weight ? (parseFloat(p.weight) * 0.035).toFixed(1) : "2.5-3.5") + " litres of water daily, more when you sweat a lot.";
  if (has("supplement", "creatine", "whey")) return "💊 Food comes first. Whey is just convenient protein; creatine monohydrate (3-5 g/day) is the most researched supplement. Check with a doctor if you have a health condition.";
  if (has("injur", "pain", "hurt", "doctor")) return "⚠️ Stop the exercise that causes sharp or lasting pain and see a doctor or physiotherapist. I can't diagnose injuries.";
  if (has("breakfast", "meal", "diet", "eat", "food")) return "🥗 A balanced plate: half vegetables, a quarter protein, a quarter carbs, plus a little healthy fat." + (m ? " Your target is " + m.calories + " kcal and " + m.protein + " g protein." : "") + " See <strong>My Smart Plan</strong> for a full day of meals.";
  return null;
}

const POOL = {
  chest: ["Push-ups", "Bench press", "Incline dumbbell press", "Chest fly"],
  back: ["Pull-ups / lat pulldown", "Bent-over row", "Seated cable row", "Superman hold"],
  legs: ["Squats", "Lunges", "Romanian deadlift", "Calf raises", "Glute bridge"],
  shoulders: ["Overhead press", "Lateral raises", "Face pulls"],
  arms: ["Biceps curl", "Triceps dips", "Hammer curl", "Triceps pushdown"],
  core: ["Plank", "Leg raises", "Crunches", "Russian twists"]
};
const pick = (g, n) => POOL[g].slice(0, n);

function makePlan(p) {
  const m = metrics(p); if (!m) return null;
  const lvl = String(p.fitnessLevel || "beginner").toLowerCase();
  const goal = String(p.goal || "").toLowerCase();
  const fat = /loss|fat|lose/.test(goal), mus = /muscle|gain|bulk/.test(goal);
  const reps = fat ? "3 x 12-15" : mus ? "4 x 6-10" : "3 x 10-12";
  const cardio = fat ? "Finisher: 15-20 min brisk walk/cycling" : "Optional: 10 min easy cardio";
  let days;
  if (lvl.includes("adv")) days = [["Push", [...pick("chest", 3), ...pick("shoulders", 2), "Triceps pushdown"]], ["Pull", [...pick("back", 3), ...pick("arms", 2).slice(0, 1), "Hammer curl"]], ["Legs", pick("legs", 5)], ["Upper", [...pick("chest", 2), ...pick("back", 2), ...pick("shoulders", 1)]], ["Lower + Core", [...pick("legs", 3), ...pick("core", 2)]]];
  else if (lvl.includes("inter")) days = [["Upper A", [...pick("chest", 2), ...pick("back", 2), ...pick("shoulders", 1)]], ["Lower A", [...pick("legs", 4), "Plank"]], ["Upper B", [...pick("back", 2), ...pick("chest", 1), ...pick("arms", 2)]], ["Lower B + Core", [...pick("legs", 3), ...pick("core", 2)]]];
  else days = [["Full body A", ["Squats", "Push-ups", "Bent-over row", "Plank"]], ["Full body B", ["Lunges", "Overhead press", "Seated cable row", "Crunches"]], ["Full body C", ["Romanian deadlift", "Incline dumbbell press", "Pull-ups / lat pulldown", "Leg raises"]]];
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const slots = {3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5]}[days.length];
  const week = names.map((d, i) => { const k = slots.indexOf(i); return k < 0 ? {day: d, title: "Rest / light walk", ex: []} : {day: d, title: days[k][0], ex: days[k][1].map(e => e + " - " + reps), cardio}; });
  const c = m.calories, pr = m.protein;
  const meals = [["Breakfast", .25, "Oats or idli/dosa + eggs or paneer + fruit"], ["Lunch", .30, "Rice/chapati + dal + vegetables + curd, plus chicken/fish/soy chunks"], ["Snack", .15, "Roasted chana, peanuts/nuts, banana or whey shake"], ["Dinner", .30, "Chapati + paneer/egg/chicken/fish + vegetable curry + salad"]].map(([n, f, t]) => ({meal: n, kcal: Math.round(c * f), protein: Math.round(pr * f), text: t}));
  return {metrics: m, week, meals, tips: ["Drink about " + (parseFloat(p.weight) * 0.035).toFixed(1) + " L water daily", "Sleep 7-9 hours", "Add weight or reps every 1-2 weeks", "Re-weigh yourself every 2 weeks and update Progress"]};
}

window.BFAI = { coach, makePlan, getKey, setKey, promptKey, metrics, ask, systemPrompt, analyzePhoto, fmt, shrinkImage, hasKey: () => !!getKey() };
