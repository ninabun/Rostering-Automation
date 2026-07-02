const DAYS = 28;
const WEEKS = 4;
const LAST_DAY = DAYS - 1;
const STORE_KEY = "ai-rostering-platform-demo-v1";
const MAX_VERSION_HISTORY = 30;
const SHIFT_HOURS = { A: 8.8, P: 8.8, N: 10, D1: 8.8, O: 0, WO: 0, AL: 0, NDD: 0, CCLV: 0, "": 0 };
const SHIFT_OPTIONS = ["A", "P", "N", "D1", "O", "WO", "AL", "CO", "NDD", "CCLV"];
const RANK_ORDER = { WM: 1, Manager: 1, APN: 2, RNM: 3, LocumRN: 4, RN: 5, Midwife: 5, "Std/M": 6, Student: 6 };
const DAY_SHIFTS = new Set(["A", "D1"]);
const NIGHT_SHIFTS = new Set(["N"]);
const WORK_SHIFTS = new Set(["A", "P", "N", "D1"]);
const DEFAULT_CHINESE_NAMES = {
  M01: "賴巧雯",
  A01: "張可璇",
  A02: "黃詩韻",
  A03: "簡鈺青",
  A04: "梁凱婷"
};

if (new URLSearchParams(window.location.search).get("resetDemo") === "1") {
  localStorage.removeItem(STORE_KEY);
}

const shiftLegend = [
  ["A", "07:00 - 15:48"],
  ["P", "13:00 - 21:48"],
  ["N", "21:15 - 07:15"],
  ["D1", "08:00 - 16:48"],
  ["O", "Day off"],
  ["WO", "Weekly off"],
  ["AL", "Annual leave"],
  ["CO", "Compensation off"],
  ["NDD", "Non-duty day"],
  ["CCLV", "Child care leave"]
];

const defaultCriteria = {
  aCore: 6,
  pCore: 6,
  nCore: 2,
  studentExtraMax: 2,
  maxWeeklyDuties: 5,
  managerWeekdayDuty: "D1",
  requireNightPrevA: true,
  requireNightNextO: true,
  studentsAsExtra: true,
  sequenceRules: []
};

function makeStaff(id, rank, apptDate, name, cName = "", catg = "Pln.", balances = {}) {
  return {
    id,
    rank,
    role: rankToRole(rank),
    apptDate,
    name,
    cName,
    catg,
    balances: {
      annualEntitlement: balances.annualEntitlement ?? 21,
      annualRemaining: balances.annualRemaining ?? 21,
      compensationOff: balances.compensationOff ?? 0,
      workingOff: balances.workingOff ?? 0
    },
    owing: { SH: 0, PH: 0, O: 0, WO: 0 }
  };
}

function rankToRole(rank) {
  if (rank === "WM" || rank === "Manager") return "Manager";
  if (rank === "Std/M" || rank === "Student") return "Student";
  return rank;
}

function defaultState() {
  return {
    activeDepartmentId: "ward-c2",
    departments: [
      {
        id: "ward-c2",
        name: "C2 Obstetric & Gynaecology",
        organization: "Queen Elizabeth Hospital",
        preparedBy: "WM Lei Hau Man",
        startDate: "2026-07-01",
        criteria: { ...defaultCriteria },
        requests: [],
        versions: [],
        roster: {},
        staff: [
          makeStaff("M01", "WM", "02/08/2023", "LEI, HAU MAN", DEFAULT_CHINESE_NAMES.M01),
          makeStaff("A01", "APN", "01/09/2018", "CHEUNG, HO SHUEN", DEFAULT_CHINESE_NAMES.A01),
          makeStaff("A02", "APN", "01/03/2022", "WONG, SZE WAN STELLA", DEFAULT_CHINESE_NAMES.A02),
          makeStaff("A03", "APN", "01/02/2023", "KAN, YUK CHING", DEFAULT_CHINESE_NAMES.A03),
          makeStaff("A04", "APN", "15/09/2025", "LEUNG, HOI TING", DEFAULT_CHINESE_NAMES.A04),
          ...Array.from({ length: 18 }, (_, i) => makeStaff(`R${String(i + 1).padStart(2, "0")}`, i < 8 ? "RNM" : "RN", "01/01/2024", `${i < 8 ? "RNM" : "RN"} SAMPLE ${String(i + 1).padStart(2, "0")}`)),
          ...Array.from({ length: 6 }, (_, i) => makeStaff(`S${String(i + 1).padStart(2, "0")}`, "Student", "01/09/2025", `STUDENT SAMPLE ${String(i + 1).padStart(2, "0")}`))
        ]
      },
      {
        id: "clinic-demo",
        name: "Specialist Outpatient Clinic",
        organization: "Demo Hospital",
        preparedBy: "Clinic Manager",
        startDate: "2026-07-01",
        criteria: { ...defaultCriteria, aCore: 4, pCore: 3, nCore: 0, studentExtraMax: 1, requireNightPrevA: false, requireNightNextO: false },
        requests: [],
        versions: [],
        roster: {},
        staff: [
          makeStaff("CM01", "Manager", "01/01/2022", "CLINIC MANAGER"),
          ...Array.from({ length: 10 }, (_, i) => makeStaff(`CN${i + 1}`, "RN", "01/01/2024", `CLINIC NURSE ${i + 1}`)),
          makeStaff("CS01", "Student", "01/09/2025", "CLINIC STUDENT 1")
        ]
      }
    ]
  };
}

let state = loadState();
let lastExportUrl = "";
let generating = false;

function loadState() {
  const saved = localStorage.getItem(STORE_KEY);
  let loaded;
  try {
    loaded = saved ? JSON.parse(saved) : defaultState();
  } catch {
    localStorage.removeItem(STORE_KEY);
    loaded = defaultState();
  }
  for (const department of loaded.departments) {
    department.versions = (department.versions || []).slice(0, MAX_VERSION_HISTORY);
    department.lastGenerated = department.lastGenerated || null;
    department.criteria.sequenceRules = department.criteria.sequenceRules || [];
    for (const person of department.staff) {
      if (DEFAULT_CHINESE_NAMES[person.id] && (!person.cName || /[ÃÂèåæéç]/.test(person.cName))) {
        person.cName = DEFAULT_CHINESE_NAMES[person.id];
      }
      person.balances = {
        annualEntitlement: person.balances?.annualEntitlement ?? 21,
        annualRemaining: person.balances?.annualRemaining ?? 21,
        compensationOff: person.balances?.compensationOff ?? 0,
        workingOff: person.balances?.workingOff ?? 0
      };
    }
  }
  return loaded;
}

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function dept() {
  return state.departments.find(item => item.id === state.activeDepartmentId) || state.departments[0];
}

function dateAt(index) {
  const d = new Date(`${dept().startDate}T00:00:00`);
  d.setDate(d.getDate() + index);
  return d;
}

function dateDisplay(index, includeYear = false) {
  const d = dateAt(index);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return includeYear ? `${dd}/${mm}/${d.getFullYear()}` : `${dd}/${mm}`;
}

function dayName(index) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dateAt(index).getDay()];
}

function sortedStaff() {
  return [...dept().staff].sort((a, b) => (RANK_ORDER[a.rank] || 99) - (RANK_ORDER[b.rank] || 99) || a.name.localeCompare(b.name));
}

function emptyRoster() {
  const roster = {};
  for (const person of dept().staff) roster[person.id] = Array(DAYS).fill("");
  return roster;
}

function isManager(person) {
  return person.role === "Manager";
}

function isStudent(person) {
  return person.role === "Student";
}

function isCoreStaff(person) {
  return !isManager(person) && !isStudent(person);
}

function isWorkDuty(duty) {
  return WORK_SHIFTS.has(duty);
}

function requestFor(staffId, day) {
  return dept().requests.find(request => request.staffId === staffId && request.day === day);
}

function isLocked(staffId, day) {
  return Boolean(requestFor(staffId, day));
}

function weeklyDuties(roster, staffId, week) {
  return roster[staffId].slice(week * 7, week * 7 + 7).filter(isWorkDuty).length;
}

function weeklyHours(roster, staffId, week) {
  return roster[staffId].slice(week * 7, week * 7 + 7).reduce((sum, duty) => sum + (SHIFT_HOURS[duty] || 0), 0);
}

function countDuty(roster, day, group, mode = "all") {
  return dept().staff.filter(person => {
    if (mode === "core" && !isCoreStaff(person)) return false;
    if (mode === "student" && !isStudent(person)) return false;
    const duty = roster[person.id]?.[day];
    if (group === "A") return DAY_SHIFTS.has(duty);
    if (group === "P") return duty === "P";
    if (group === "N") return NIGHT_SHIFTS.has(duty);
    return duty === group;
  }).length;
}

function requirement(group) {
  const c = dept().criteria;
  if (group === "A") return Number(c.aCore);
  if (group === "P") return Number(c.pCore);
  if (group === "N") return Number(c.nCore);
  return 0;
}

function canPlace(roster, person, day, duty) {
  if (day < 0 || day > LAST_DAY) return false;
  const current = roster[person.id][day];
  const request = requestFor(person.id, day);
  if (request && request.duty !== duty) return false;
  if (current && current !== duty) return false;
  if (day > 0 && NIGHT_SHIFTS.has(roster[person.id][day - 1]) && !["O", "WO"].includes(duty)) return false;
  const previousRequired = requiredNextDuty(roster[person.id][day - 1]);
  if (day > 0 && previousRequired && duty !== previousRequired) return false;
  const nextRequired = requiredNextDuty(duty);
  const nextDuty = roster[person.id][day + 1];
  if (nextRequired && day < LAST_DAY && nextDuty && nextDuty !== nextRequired) return false;
  const extra = isWorkDuty(duty) && !isWorkDuty(current) ? 1 : 0;
  return weeklyDuties(roster, person.id, Math.floor(day / 7)) + extra <= Number(dept().criteria.maxWeeklyDuties);
}

function place(roster, person, day, duty) {
  if (day < 0 || day > LAST_DAY) return;
  if (!isLocked(person.id, day) || requestFor(person.id, day)?.duty === duty) roster[person.id][day] = duty;
  const nextRequired = requiredNextDuty(duty);
  if (nextRequired && day < LAST_DAY && !roster[person.id][day + 1] && canPlace(roster, person, day + 1, nextRequired)) {
    roster[person.id][day + 1] = nextRequired;
  }
}

function requiredNextDuty(duty) {
  if (!duty) return "";
  const rule = (dept().criteria.sequenceRules || []).find(item => item.enabled !== false && item.from === duty);
  return rule?.to || "";
}

function canNightBlock(roster, person, day) {
  const c = dept().criteria;
  if (!canPlace(roster, person, day, "N")) return false;
  if (c.requireNightPrevA && day > 0 && !canPlace(roster, person, day - 1, "A")) return false;
  if (c.requireNightNextO && day < LAST_DAY && !canPlace(roster, person, day + 1, "O")) return false;
  return true;
}

function placeNightBlock(roster, person, day) {
  const c = dept().criteria;
  if (c.requireNightPrevA && day > 0) place(roster, person, day - 1, "A");
  place(roster, person, day, "N");
  if (c.requireNightNextO && day < LAST_DAY) place(roster, person, day + 1, "O");
}

function isUnassigned(roster, person, day) {
  return !roster[person.id]?.[day];
}

function workCount(roster, staffId, duty) {
  return roster[staffId].filter(value => value === duty).length;
}

function createRandom(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = value * 16807 % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function shuffle(items, random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function generateRoster() {
  if (generating) return;
  generating = true;
  const status = document.getElementById("statusText");
  if (status) status.textContent = "Generating roster...";

  try {
    const d = dept();
    const c = d.criteria;
    const seed = Date.now() + Math.floor(Math.random() * 100000);
    const random = createRandom(seed);
    const roster = emptyRoster();
    const staff = shuffle(sortedStaff(), random);
    const core = staff.filter(isCoreStaff);
    const students = staff.filter(isStudent);
    const randomRank = new Map(staff.map(person => [person.id, random()]));

    for (const person of staff) {
      for (let day = 0; day < DAYS; day++) {
        const request = requestFor(person.id, day);
        if (request) roster[person.id][day] = request.duty;
      }
    }

    for (const person of staff.filter(isManager)) {
      for (let day = 0; day < DAYS; day++) {
        const weekday = dateAt(day).getDay();
        if (!isLocked(person.id, day)) roster[person.id][day] = weekday >= 1 && weekday <= 5 ? c.managerWeekdayDuty : "WO";
      }
    }

    const dayOrder = shuffle(Array.from({ length: DAYS }, (_, i) => i), random);
    for (const day of dayOrder) {
      for (const [group, duty] of [["N", "N"], ["A", "A"], ["P", "P"]]) {
        let attempts = 0;
        while (countDuty(roster, day, group, "core") < requirement(group)) {
          if (attempts++ > core.length + 2) break;
          const candidate = shuffle(core, random)
            .filter(person => isUnassigned(roster, person, day))
            .filter(person => duty === "N" ? canNightBlock(roster, person, day) : canPlace(roster, person, day, duty))
            .sort((a, b) => workCount(roster, a.id, duty) - workCount(roster, b.id, duty) || weeklyHours(roster, a.id, Math.floor(day / 7)) - weeklyHours(roster, b.id, Math.floor(day / 7)) || randomRank.get(a.id) - randomRank.get(b.id))[0];
          if (!candidate) break;
          if (duty === "N") placeNightBlock(roster, candidate, day);
          else place(roster, candidate, day, duty);
        }
      }
    }

    for (const day of dayOrder) {
      for (const duty of ["A", "P"]) {
        let attempts = 0;
        while (countDuty(roster, day, duty, "student") < Number(c.studentExtraMax)) {
          if (attempts++ > students.length + 2) break;
          const candidate = shuffle(students, random)
            .filter(person => isUnassigned(roster, person, day))
            .filter(person => canPlace(roster, person, day, duty))
            .sort((a, b) => weeklyHours(roster, a.id, Math.floor(day / 7)) - weeklyHours(roster, b.id, Math.floor(day / 7)) || randomRank.get(a.id) - randomRank.get(b.id))[0];
          if (!candidate) break;
          place(roster, candidate, day, duty);
        }
      }
    }

    for (const person of staff.filter(person => !isManager(person))) {
      for (let week = 0; week < WEEKS; week++) {
        let attempts = 0;
        while (weeklyDuties(roster, person.id, week) < Number(c.maxWeeklyDuties)) {
          if (attempts++ > 8) break;
          const start = week * 7;
          const emptyDay = shuffle(Array.from({ length: 7 }, (_, offset) => start + offset), random).find(day => !roster[person.id][day] && canPlace(roster, person, day, "A"));
          if (emptyDay === undefined) break;
          const duty = workCount(roster, person.id, "A") <= workCount(roster, person.id, "P") ? "A" : "P";
          place(roster, person, emptyDay, canPlace(roster, person, emptyDay, duty) ? duty : "A");
        }
      }
    }

    for (const person of staff) {
      for (let day = 0; day < DAYS; day++) {
        if (!roster[person.id][day]) roster[person.id][day] = "O";
        if (NIGHT_SHIFTS.has(roster[person.id][day]) && c.requireNightNextO && day < LAST_DAY && !isLocked(person.id, day + 1)) roster[person.id][day + 1] = "O";
      }
    }

    d.roster = roster;
    saveRosterVersion(d, roster, seed);
    saveState();
    render();
  } finally {
    generating = false;
  }
}

function scheduleGenerateRoster() {
  const status = document.getElementById("statusText");
  if (status) status.textContent = "Generating roster...";
  setTimeout(generateRoster, 0);
}

function saveRosterVersion(department, roster, seed) {
  department.versions = department.versions || [];
  const stamp = new Date().toISOString();
  const samePeriodCount = department.versions.filter(version => version.startDate === department.startDate).length;
  const version = {
    id: `${department.startDate}-${Date.now()}`,
    startDate: department.startDate,
    label: `${department.startDate} v${samePeriodCount + 1}`,
    createdAt: stamp,
    seed,
    roster: JSON.parse(JSON.stringify(roster)),
    requestCount: department.requests.length,
    criteria: JSON.parse(JSON.stringify(department.criteria))
  };
  department.versions.unshift(version);
  department.versions = department.versions.slice(0, MAX_VERSION_HISTORY);
  department.lastGenerated = { label: version.label, createdAt: version.createdAt, seed: version.seed };
}

function loadLatestVersionForCurrentDate() {
  const d = dept();
  const version = (d.versions || []).find(item => item.startDate === d.startDate);
  if (!version) return false;
  d.roster = JSON.parse(JSON.stringify(version.roster));
  d.lastGenerated = { label: version.label, createdAt: version.createdAt, seed: version.seed };
  saveState();
  render();
  return true;
}

function loadRosterVersion(versionId) {
  const d = dept();
  const version = (d.versions || []).find(item => item.id === versionId);
  if (!version) return;
  d.startDate = version.startDate;
  d.roster = JSON.parse(JSON.stringify(version.roster));
  d.lastGenerated = { label: version.label, createdAt: version.createdAt, seed: version.seed };
  saveState();
  render();
}

function generationStatus() {
  const generated = dept().lastGenerated;
  if (!generated) return "";
  return ` | Showing ${generated.label}, generated ${new Date(generated.createdAt).toLocaleTimeString()}`;
}

function validationText(roster) {
  const c = dept().criteria;
  let gaps = 0;
  let studentOverflow = 0;
  let sequence = 0;
  for (let day = 0; day < DAYS; day++) {
    for (const group of ["A", "P", "N"]) if (countDuty(roster, day, group, "core") < requirement(group)) gaps++;
    for (const group of ["A", "P"]) if (countDuty(roster, day, group, "student") > Number(c.studentExtraMax)) studentOverflow++;
  }
  for (const person of dept().staff.filter(isCoreStaff)) {
    for (let day = 0; day < DAYS; day++) {
      if (!NIGHT_SHIFTS.has(roster[person.id]?.[day])) continue;
      if (c.requireNightPrevA && day > 0 && roster[person.id][day - 1] !== "A") sequence++;
      if (c.requireNightNextO && day < LAST_DAY && roster[person.id][day + 1] !== "O") sequence++;
    }
    for (let day = 0; day < LAST_DAY; day++) {
      const required = requiredNextDuty(roster[person.id]?.[day]);
      if (required && roster[person.id]?.[day + 1] !== required) sequence++;
    }
  }
  if (!gaps && !studentOverflow && !sequence) return "Automation OK: staffing, student cap and sequence criteria met";
  return `${gaps} staffing gaps, ${studentOverflow} student overflows, ${sequence} sequence issues`;
}

function render() {
  renderDepartmentControls();
  renderRequestControls();
  renderLegend();
  renderRoster();
  renderStaff();
  renderRequestsLog();
  renderBalances();
  renderHistory();
  renderCriteria();
  renderPitch();
  saveState();
}

function renderDepartmentControls() {
  const d = dept();
  document.getElementById("departmentSelect").innerHTML = state.departments.map(item => `<option value="${item.id}">${item.name}</option>`).join("");
  document.getElementById("departmentSelect").value = d.id;
  document.getElementById("startDate").value = d.startDate;
  document.getElementById("periodLabel").textContent = `${d.name}: ${dateDisplay(0, true)} - ${dateDisplay(LAST_DAY, true)}`;
}

function renderRequestControls() {
  const staffSelect = document.getElementById("requestStaff");
  staffSelect.innerHTML = sortedStaff().map(person => `<option value="${person.id}">${person.rank} - ${person.name}</option>`).join("");
  document.getElementById("requestDay").innerHTML = Array.from({ length: DAYS }, (_, i) => `<option value="${i}">${dateDisplay(i)} ${dayName(i)}</option>`).join("");
  document.getElementById("requestDuty").innerHTML = SHIFT_OPTIONS.map(code => `<option value="${code}">${code}</option>`).join("");
  const list = document.getElementById("requestList");
  list.innerHTML = dept().requests.length ? dept().requests.map((request, index) => {
    const person = dept().staff.find(item => item.id === request.staffId);
    const type = request.type === "fixed" ? "Fixed" : "Request";
    const note = request.note ? ` Â· ${request.note}` : "";
    return `<div class="request-item"><span>${type}: ${person?.name || request.staffId} Â· ${dateDisplay(request.day)} Â· <b>${request.duty}</b>${note}</span><button data-remove-request="${index}">x</button></div>`;
  }).join("") : `<p>No request yet.</p>`;
}

function renderLegend() {
  document.getElementById("sideLegend").innerHTML = shiftLegend.map(([code, time]) => `<div class="legend-item"><span class="code duty-${code.toLowerCase()}">${code}</span><span>${time}</span></div>`).join("");
}

function renderRoster() {
  const d = dept();
  const roster = d.roster && Object.keys(d.roster).length ? d.roster : emptyRoster();
  const days = Array.from({ length: DAYS }, (_, i) => i);
  const head = `
    <div class="sheet-head">
      <div>
        <div class="meta-line"><strong>Department:</strong><span>${d.name}</span></div>
        <div class="meta-line"><strong>Prepared by:</strong><span>${d.preparedBy}</span></div>
      </div>
      <div class="center">
        <div class="title">AI Rostering Automation</div>
        <div class="subtitle">Duty Roster (Generated)</div>
        <div>From ${dateDisplay(0, true)} To ${dateDisplay(LAST_DAY, true)}</div>
        <div>${d.organization}</div>
      </div>
      <div class="right">
        <div class="meta-line"><strong>Model:</strong><span>Criteria-based demo</span></div>
        <div class="meta-line"><strong>Generated:</strong><span>${new Date().toLocaleDateString("en-GB")}</span></div>
      </div>
    </div>`;
  const tableHead = `
    <thead>
      <tr>
        <th class="rank-col" rowspan="2">Rank</th><th class="appt-col" rowspan="2">Appt. Date</th><th class="name-col" rowspan="2">Name</th><th class="cname-col" rowspan="2">C. Name</th><th class="cat-col" rowspan="2">Catg.</th>
        ${days.map(i => `<th class="day-col ${isWeekend(i) ? "weekend" : ""}">${dateDisplay(i)}</th>`).join("")}
        <th class="owing-col divider-left" colspan="4">Owing</th>
      </tr>
      <tr>${days.map(i => `<th class="day-col ${isWeekend(i) ? "weekend" : ""}">${dayName(i)}</th>`).join("")}<th class="owing-col divider-left">SH</th><th class="owing-col">PH</th><th class="owing-col">O</th><th class="owing-col">WO</th></tr>
    </thead>`;
  const body = sortedStaff().map((person, index) => {
    const prev = sortedStaff()[index - 1];
    const cells = days.map(i => {
      const duty = roster[person.id]?.[i] || "";
      const request = requestFor(person.id, i);
      const cls = `duty-${duty.toLowerCase()} ${isLocked(person.id, i) ? "locked" : ""}`;
      const title = request?.note ? `${request.type || "request"}: ${request.note}` : "";
      const marker = request ? `<span class="request-marker">${request.type === "fixed" ? "F" : "R"}</span>` : "";
      return `<td class="duty-cell ${cls}" title="${title}">${duty}${marker}</td>`;
    }).join("");
    return `<tr class="${prev && prev.rank !== person.rank ? "divider-top" : ""}"><td class="rank-col left-cell">${person.rank}</td><td>${person.apptDate}</td><td class="name-col">${person.name}</td><td>${person.cName || ""}</td><td>${person.catg}</td>${cells}<td class="divider-left">${person.owing?.SH ?? 0}</td><td>${person.owing?.PH ?? 0}</td><td>${person.owing?.O ?? 0}</td><td>${person.owing?.WO ?? 0}</td></tr>`;
  }).join("");
  const summary = [
    ["A core", "A", "core"], ["P core", "P", "core"], ["N core", "N", "core"], ["Student A extra", "A", "student"], ["Student P extra", "P", "student"]
  ].map(([label, group, mode]) => `<tr class="summary-row"><td colspan="5" class="summary-label">${label}</td>${days.map(i => `<td>${countDuty(roster, i, group, mode)}</td>`).join("")}<td class="divider-left"></td><td></td><td></td><td></td></tr>`).join("");
  document.getElementById("rosterView").innerHTML = `<div class="roster-sheet">${head}<table>${tableHead}<tbody>${body}${summary}</tbody></table></div>`;
  document.getElementById("statusText").textContent = `${validationText(roster)}${generationStatus()}`;
}

function renderStaff() {
  document.getElementById("staffView").innerHTML = `
    <div class="editor-grid">
      <form id="staffForm" class="editor-card">
        <h2>Add / Edit Staff</h2>
        <input id="staffOriginalId" type="hidden">
        <label>ID<input id="staffId" required placeholder="RN001"></label>
        <label>Rank<select id="staffRank">${Object.keys(RANK_ORDER).map(rank => `<option value="${rank}">${rank}</option>`).join("")}</select></label>
        <label>Appointment date<input id="staffAppt" placeholder="01/01/2026"></label>
        <label>English name<input id="staffName" required placeholder="CHAN, TAI MAN"></label>
        <label>Chinese name<input id="staffCName"></label>
        <label>Category<input id="staffCatg" placeholder="Pln."></label>
        <label>Annual leave entitled<input id="staffAnnualEntitled" type="number" min="0" step="0.5" value="21"></label>
        <label>Annual leave remaining<input id="staffAnnualRemain" type="number" min="0" step="0.5" value="21"></label>
        <label>Compensation off<input id="staffCompOff" type="number" min="0" step="0.5" value="0"></label>
        <label>Working off<input id="staffWorkingOff" type="number" min="0" step="0.5" value="0"></label>
        <div class="card-actions">
          <button id="staffSubmitBtn" type="submit">Add staff</button>
          <button id="cancelStaffEditBtn" type="button">Cancel edit</button>
        </div>
      </form>
      <div class="staff-grid">${sortedStaff().map(person => `<div class="staff-card"><strong>${person.name}</strong><span>${person.rank} · ${person.apptDate} · ${person.cName || "No Chinese name"} · ${person.catg}</span><span>AL ${person.balances?.annualRemaining ?? 0}/${person.balances?.annualEntitlement ?? 0} · CO ${person.balances?.compensationOff ?? 0} · WO ${person.balances?.workingOff ?? 0}</span><div class="card-actions"><button data-edit-staff="${person.id}">Edit</button><button data-remove-staff="${person.id}">Remove</button></div></div>`).join("")}</div>
    </div>`;
}

function renderRequestsLog() {
  const rows = dept().requests.map((request, index) => {
    const person = dept().staff.find(item => item.id === request.staffId);
    return `<tr>
      <td>${index + 1}</td>
      <td>${request.type === "fixed" ? "Fixed assignment" : "Staff request"}</td>
      <td class="left-cell">${person?.name || request.staffId}</td>
      <td>${dateDisplay(request.day)} ${dayName(request.day)}</td>
      <td>${request.duty}</td>
      <td class="left-cell">${request.note || ""}</td>
      <td><button data-remove-request="${index}">Remove</button></td>
    </tr>`;
  }).join("");
  document.getElementById("requestsView").innerHTML = `
    <div class="editor-card">
      <h2>Request / Fixed Assignment Log</h2>
      <p>All staff requests and fixed assignments are listed here. Roster cells show R for request and F for fixed assignment.</p>
      <div class="table-wrap compact-wrap">
        <table class="balance-table">
          <thead><tr><th>#</th><th>Type</th><th>Staff</th><th>Date</th><th>Duty</th><th>Note</th><th>Action</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="7">No requests yet.</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;
}

function resetStaffForm() {
  const form = document.getElementById("staffForm");
  if (!form) return;
  form.reset();
  document.getElementById("staffOriginalId").value = "";
  document.getElementById("staffAnnualEntitled").value = 21;
  document.getElementById("staffAnnualRemain").value = 21;
  document.getElementById("staffCompOff").value = 0;
  document.getElementById("staffWorkingOff").value = 0;
  document.getElementById("staffSubmitBtn").textContent = "Add staff";
}

function usedBalance(person, duty) {
  const roster = dept().roster || {};
  return (roster[person.id] || []).filter(value => value === duty).length;
}

function renderBalances() {
  const rows = sortedStaff().map(person => {
    const b = person.balances || {};
    const alUsed = usedBalance(person, "AL");
    const coUsed = usedBalance(person, "CO");
    const woUsed = usedBalance(person, "WO");
    return `<tr>
      <td class="left-cell">${person.name}</td>
      <td>${person.rank}</td>
      <td>${b.annualEntitlement ?? 0}</td>
      <td>${b.annualRemaining ?? 0}</td>
      <td>${alUsed}</td>
      <td>${Math.max(0, (b.annualRemaining ?? 0) - alUsed)}</td>
      <td>${b.compensationOff ?? 0}</td>
      <td>${coUsed}</td>
      <td>${Math.max(0, (b.compensationOff ?? 0) - coUsed)}</td>
      <td>${b.workingOff ?? 0}</td>
      <td>${woUsed}</td>
      <td>${Math.max(0, (b.workingOff ?? 0) - woUsed)}</td>
    </tr>`;
  }).join("");
  document.getElementById("balancesView").innerHTML = `
    <div class="editor-card">
      <h2>Vacation / Off Balance</h2>
      <p>Each department owns these balances. AL, CO and WO roster entries are counted here before publishing.</p>
      <div class="table-wrap compact-wrap">
        <table class="balance-table">
          <thead><tr><th>Name</th><th>Rank</th><th>AL Entitled</th><th>AL Opening</th><th>AL Used</th><th>AL Remaining</th><th>CO Opening</th><th>CO Used</th><th>CO Remaining</th><th>WO Opening</th><th>WO Used</th><th>WO Remaining</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function renderHistory() {
  const versions = dept().versions || [];
  const rows = versions.map(version => `<tr>
    <td class="left-cell">${version.label}</td>
    <td>${version.startDate}</td>
    <td>${new Date(version.createdAt).toLocaleString()}</td>
    <td>${version.requestCount ?? 0}</td>
    <td><button data-load-version="${version.id}">Load</button></td>
  </tr>`).join("");
  document.getElementById("historyView").innerHTML = `
    <div class="editor-card">
      <h2>Roster Version History</h2>
      <p>Every Generate stores a version. Changing the start date loads the latest matching version when one exists.</p>
      <div class="table-wrap compact-wrap">
        <table class="balance-table">
          <thead><tr><th>Version</th><th>Start date</th><th>Generated at</th><th>Requests</th><th>Action</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="5">No generated versions yet.</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;
}
function renderCriteria() {
  const d = dept();
  const c = d.criteria;
  document.getElementById("criteriaView").innerHTML = `
    <div class="criteria-layout">
      <form id="criteriaForm" class="editor-card">
        <h2>Department Criteria</h2>
        <div class="criteria-section">
          <h3>Department Profile</h3>
          <label>Department name<input id="criteriaDeptName" value="${d.name}"></label>
          <label>Organization<input id="criteriaOrg" value="${d.organization}"></label>
        </div>
        <div class="criteria-section">
          <h3>Staffing Requirement</h3>
          <label>A core minimum<input id="criteriaA" type="number" min="0" value="${c.aCore}"></label>
          <label>P core minimum<input id="criteriaP" type="number" min="0" value="${c.pCore}"></label>
          <label>N core minimum<input id="criteriaN" type="number" min="0" value="${c.nCore}"></label>
          <label>Student extra max<input id="criteriaStudent" type="number" min="0" value="${c.studentExtraMax}"></label>
        </div>
        <div class="criteria-section">
          <h3>Fairness / Workload</h3>
          <label>Max duties per week<input id="criteriaMaxWeek" type="number" min="1" value="${c.maxWeeklyDuties}"></label>
          <label>Manager weekday duty<input id="criteriaManagerDuty" value="${c.managerWeekdayDuty}"></label>
        </div>
        <div class="criteria-section">
          <h3>Night Sequence</h3>
          <label class="check-row"><input id="criteriaPrevA" type="checkbox" ${c.requireNightPrevA ? "checked" : ""}> N requires previous A</label>
          <label class="check-row"><input id="criteriaNextO" type="checkbox" ${c.requireNightNextO ? "checked" : ""}> N requires next O</label>
        </div>
        <div class="criteria-section">
          <h3>Custom Sequence Rules</h3>
          <p>Bounded rule builder: choose what must happen on the next day after a duty.</p>
          <div class="inline-rule">
            <select id="ruleFromDuty">${SHIFT_OPTIONS.map(code => `<option value="${code}">${code}</option>`).join("")}</select>
            <span>next day must be</span>
            <select id="ruleToDuty">${SHIFT_OPTIONS.map(code => `<option value="${code}">${code}</option>`).join("")}</select>
            <button id="addSequenceRuleBtn" type="button">Add rule</button>
          </div>
          <div class="rule-list">${(c.sequenceRules || []).length ? c.sequenceRules.map((rule, index) => `<div class="rule-item"><span>${rule.from} -> ${rule.to}</span><button type="button" data-remove-sequence-rule="${index}">Remove</button></div>`).join("") : `<p>No custom sequence rules yet.</p>`}</div>
        </div>
        <div class="criteria-section">
          <h3>Leave / Off Balance</h3>
          <p>AL, CO and WO are tracked per staff member in the Balances tab. Departments should enter opening balances before generating a monthly roster.</p>
        </div>
        <button type="submit">Save criteria</button>
      </form>
      <div class="editor-card">
        <h2>Criteria Input Guide</h2>
        <p>Each department owns its own criteria. The automation engine only uses the rules entered here, plus staff requests and fixed assignments.</p>
        <p>Fixed assignments cover training, clinic sessions, borrowed-out days, study days, or any duty that must be locked before automation runs.</p>
        <p>Recommended workflow: update staff and balances, add requests/fixed duties, confirm criteria, then generate and review warnings.</p>
      </div>
    </div>`;
}
function renderPitch() {
  document.getElementById("pitchView").innerHTML = `
    <div class="pitch-grid">
      <div class="editor-card"><h2>Problem</h2><p>Roster creation is manual, repetitive and hard to audit. Each department has different rules.</p></div>
      <div class="editor-card"><h2>Solution</h2><p>A criteria-based automation engine: departments enter staff, requests and rules; the system generates a usable roster.</p></div>
      <div class="editor-card"><h2>Pilot</h2><p>Start with one department, validate staff lifecycle, safety rules, requests and manager workflow, then roll out by duplicating department templates.</p></div>
      <div class="editor-card"><h2>Demo Flow</h2><p>1. Select department. 2. Update staff and balances. 3. Add requests/fixed duty. 4. Edit criteria. 5. Generate. 6. Export or print.</p></div>
      <div class="editor-card"><h2>Department Data</h2><p>Each department manages employee list, appointment date, rank, category, vacation balance, compensation off, working off, duty requests and locked external assignments.</p></div>
    </div>`;
}

function isWeekend(day) {
  const weekday = dateAt(day).getDay();
  return weekday === 0 || weekday === 6;
}

function exportCsv() {
  const d = dept();
  const roster = d.roster && Object.keys(d.roster).length ? d.roster : emptyRoster();
  const dayHeaders = Array.from({ length: DAYS }, (_, i) => `${dateDisplay(i)} ${dayName(i)}`);
  const balanceHeaders = ["AL Entitled", "AL Remaining", "CO Balance", "WO Balance"];
  const weeklyHeaders = Array.from({ length: WEEKS }, (_, week) => `Week ${week + 1} Hours`);
  const header = ["Rank", "Appt. Date", "Name", "C. Name", "Catg.", ...dayHeaders, "SH", "PH", "O", "WO", ...weeklyHeaders, "Total Hours", ...balanceHeaders];
  const rows = [];

  rows.push(["Department", d.name]);
  rows.push(["Organization", d.organization]);
  rows.push(["Period", `${dateDisplay(0, true)} - ${dateDisplay(LAST_DAY, true)}`]);
  rows.push(["Generated version", d.lastGenerated?.label || "Current draft"]);
  rows.push([]);
  rows.push(header);

  for (const person of sortedStaff()) {
    const weekly = Array.from({ length: WEEKS }, (_, week) => weeklyHours(roster, person.id, week));
    const total = weekly.reduce((sum, hours) => sum + hours, 0);
    const dutyCells = Array.from({ length: DAYS }, (_, day) => {
      const duty = roster[person.id]?.[day] || "";
      const request = requestFor(person.id, day);
      if (!request) return duty;
      return `${duty} ${request.type === "fixed" ? "(F)" : "(R)"}`;
    });

    rows.push([
      person.rank,
      person.apptDate,
      person.name,
      person.cName || "",
      person.catg,
      ...dutyCells,
      person.owing?.SH ?? 0,
      person.owing?.PH ?? 0,
      person.owing?.O ?? 0,
      person.owing?.WO ?? 0,
      ...weekly.map(hours => hours.toFixed(1)),
      total.toFixed(1),
      person.balances?.annualEntitlement ?? 0,
      person.balances?.annualRemaining ?? 0,
      person.balances?.compensationOff ?? 0,
      person.balances?.workingOff ?? 0
    ]);
  }

  rows.push([]);
  rows.push(["Summary", "", "", "", "", ...dayHeaders]);
  [
    ["A core", "A", "core"],
    ["P core", "P", "core"],
    ["N core", "N", "core"],
    ["Student A extra", "A", "student"],
    ["Student P extra", "P", "student"]
  ].forEach(([label, group, mode]) => {
    rows.push([label, "", "", "", "", ...Array.from({ length: DAYS }, (_, day) => countDuty(roster, day, group, mode))]);
  });

  const csv = "\uFEFF" + rows.map(row => row.map(cell => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  if (lastExportUrl) URL.revokeObjectURL(lastExportUrl);
  const fileName = `${d.id}-${d.startDate}-full-roster.csv`;
  lastExportUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));

  const link = document.createElement("a");
  link.href = lastExportUrl;
  link.download = fileName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();

  const status = document.getElementById("statusText");
  status.textContent = "";
  status.append(document.createTextNode(`${validationText(roster)}${generationStatus()} | Export ready: `));
  const visibleLink = document.createElement("a");
  visibleLink.href = lastExportUrl;
  visibleLink.download = fileName;
  visibleLink.textContent = "Download CSV";
  status.append(visibleLink);
}

window.addEventListener("beforeunload", () => {
  if (lastExportUrl) URL.revokeObjectURL(lastExportUrl);
});

document.addEventListener("click", event => {
  const removeRequest = event.target.dataset.removeRequest;
  if (removeRequest !== undefined) {
    dept().requests.splice(Number(removeRequest), 1);
    generateRoster();
    return;
  }
  const removeStaff = event.target.dataset.removeStaff;
  if (removeStaff) {
    const d = dept();
    d.staff = d.staff.filter(person => person.id !== removeStaff);
    d.requests = d.requests.filter(request => request.staffId !== removeStaff);
    generateRoster();
    return;
  }
  const editStaff = event.target.dataset.editStaff;
  if (editStaff) {
    const person = dept().staff.find(item => item.id === editStaff);
    if (!person) return;
    document.querySelector('[data-view="staff"]').click();
    document.getElementById("staffId").value = person.id;
    document.getElementById("staffOriginalId").value = person.id;
    document.getElementById("staffRank").value = person.rank;
    document.getElementById("staffAppt").value = person.apptDate;
    document.getElementById("staffName").value = person.name;
    document.getElementById("staffCName").value = person.cName || "";
    document.getElementById("staffCatg").value = person.catg || "Pln.";
    document.getElementById("staffAnnualEntitled").value = person.balances?.annualEntitlement ?? 21;
    document.getElementById("staffAnnualRemain").value = person.balances?.annualRemaining ?? 21;
    document.getElementById("staffCompOff").value = person.balances?.compensationOff ?? 0;
    document.getElementById("staffWorkingOff").value = person.balances?.workingOff ?? 0;
    document.getElementById("staffSubmitBtn").textContent = "Save changes";
    return;
  }
  if (event.target.id === "cancelStaffEditBtn") {
    resetStaffForm();
    return;
  }
  const loadVersion = event.target.dataset.loadVersion;
  if (loadVersion) {
    loadRosterVersion(loadVersion);
    return;
  }
  if (event.target.id === "addSequenceRuleBtn") {
    const from = document.getElementById("ruleFromDuty").value;
    const to = document.getElementById("ruleToDuty").value;
    const rules = dept().criteria.sequenceRules || [];
    dept().criteria.sequenceRules = rules.filter(rule => rule.from !== from);
    dept().criteria.sequenceRules.push({ from, to, enabled: true });
    generateRoster();
    return;
  }
  const removeSequenceRule = event.target.dataset.removeSequenceRule;
  if (removeSequenceRule !== undefined) {
    dept().criteria.sequenceRules.splice(Number(removeSequenceRule), 1);
    generateRoster();
    return;
  }
});

document.addEventListener("submit", event => {
  event.preventDefault();
  if (event.target.id === "staffForm") {
    const d = dept();
    const id = document.getElementById("staffId").value.trim();
    const originalId = document.getElementById("staffOriginalId").value.trim();
    const rank = document.getElementById("staffRank").value;
    if (originalId && originalId !== id) {
      d.requests.forEach(request => {
        if (request.staffId === originalId) request.staffId = id;
      });
    }
    d.staff = d.staff.filter(person => person.id !== id && person.id !== originalId);
    d.staff.push(makeStaff(id, rank, document.getElementById("staffAppt").value.trim() || "01/01/2026", document.getElementById("staffName").value.trim(), document.getElementById("staffCName").value.trim(), document.getElementById("staffCatg").value.trim() || "Pln.", {
      annualEntitlement: Number(document.getElementById("staffAnnualEntitled").value),
      annualRemaining: Number(document.getElementById("staffAnnualRemain").value),
      compensationOff: Number(document.getElementById("staffCompOff").value),
      workingOff: Number(document.getElementById("staffWorkingOff").value)
    }));
    resetStaffForm();
    generateRoster();
  }
  if (event.target.id === "criteriaForm") {
    const d = dept();
    d.name = document.getElementById("criteriaDeptName").value.trim();
    d.organization = document.getElementById("criteriaOrg").value.trim();
    d.criteria.aCore = Number(document.getElementById("criteriaA").value);
    d.criteria.pCore = Number(document.getElementById("criteriaP").value);
    d.criteria.nCore = Number(document.getElementById("criteriaN").value);
    d.criteria.studentExtraMax = Number(document.getElementById("criteriaStudent").value);
    d.criteria.maxWeeklyDuties = Number(document.getElementById("criteriaMaxWeek").value);
    d.criteria.managerWeekdayDuty = document.getElementById("criteriaManagerDuty").value.trim() || "D1";
    d.criteria.requireNightPrevA = document.getElementById("criteriaPrevA").checked;
    d.criteria.requireNightNextO = document.getElementById("criteriaNextO").checked;
    generateRoster();
  }
});

document.getElementById("departmentSelect").addEventListener("change", event => {
  state.activeDepartmentId = event.target.value;
  render();
});
document.getElementById("addDeptBtn").addEventListener("click", () => {
  const name = prompt("Department name");
  if (!name) return;
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `dept-${Date.now()}`;
  state.departments.push({ id, name, organization: "Demo Organization", preparedBy: "Roster Manager", startDate: dept().startDate, criteria: { ...defaultCriteria }, requests: [], versions: [], roster: {}, staff: [] });
  state.activeDepartmentId = id;
  render();
});
document.getElementById("startDate").addEventListener("change", event => {
  dept().startDate = event.target.value;
  if (!loadLatestVersionForCurrentDate()) generateRoster();
});
document.getElementById("addRequestBtn").addEventListener("click", () => {
  const d = dept();
  const staffId = document.getElementById("requestStaff").value;
  const day = Number(document.getElementById("requestDay").value);
  const duty = document.getElementById("requestDuty").value;
  const type = document.getElementById("requestType").value;
  const note = document.getElementById("requestNote").value.trim();
  d.requests = d.requests.filter(request => !(request.staffId === staffId && request.day === day));
  d.requests.push({ staffId, day, duty, type, note });
  generateRoster();
});
document.getElementById("generateBtn").addEventListener("click", scheduleGenerateRoster);
document.getElementById("exportBtn").addEventListener("click", exportCsv);
document.getElementById("printBtn").addEventListener("click", () => window.print());
document.getElementById("resetBtn").addEventListener("click", () => {
  localStorage.removeItem(STORE_KEY);
  state = defaultState();
  generateRoster();
});
document.querySelectorAll(".tabs button").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tabs button").forEach(tab => tab.classList.remove("active"));
    button.classList.add("active");
    ["roster", "staff", "requests", "balances", "history", "criteria", "pitch"].forEach(view => document.getElementById(`${view}View`).classList.toggle("hidden", button.dataset.view !== view));
  });
});

if (!dept().roster || !Object.keys(dept().roster).length) generateRoster();
else render();


