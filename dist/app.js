"use strict";

const course = window.COURSE;
const lessons = new Map(course.lessons.map(lesson => [lesson.id, lesson]));
const main = document.querySelector("#main");
const notice = document.querySelector("#notice");
const trackInput = document.querySelector("#track");
const STORE_KEY = "ielts36-progress-v1";
const VERSION = course.version;
const tracks = { academic: "Academic", general: "General Training" };
const bands = ["listening", "reading", "writing", "speaking"];
const skillNames = {
  assessment: "Đánh giá", foundation: "Nền tảng", listening: "Nghe", reading: "Đọc",
  writing: "Viết", speaking: "Nói", grammar: "Ngữ pháp", pronunciation: "Phát âm",
  vocabulary: "Từ vựng", practice: "Bài luyện", guide: "Hướng dẫn"
};
const pages = {
  home: "Tổng quan", roadmap: "Lộ trình", lessons: "Bài học",
  assessments: "Đánh giá", notes: "Sổ lỗi", settings: "Cài đặt", lesson: "Bài học"
};
const phases = [
  { from: 1, to: 8, title: "Xây nền tảng", description: "Phát âm, từ vựng, câu đơn và giao tiếp cơ bản. Đo lại ở M08." },
  { from: 9, to: 16, title: "Phát triển bốn kỹ năng", description: "Đọc, nghe đoạn dài hơn. Viết và nói có lý do, ví dụ. Đo lại ở M16." },
  { from: 17, to: 24, title: "Làm quen đề IELTS", description: "Học từng dạng câu. Bấm giờ đủ bốn kỹ năng trong M24." },
  { from: 25, to: 30, title: "Luyện có giờ và chữa lỗi", description: "Làm đề mới ở M30 và so với kết quả M24." },
  { from: 31, to: 36, title: "Mô phỏng trước ngày thi", description: "Sửa kỹ năng yếu. Làm hai đề mới tại M35 và M36." }
];
const milestones = ["M00", "M08", "M16", "M24", "M30", "M35", "M36"];
const mockIds = milestones.slice(3);
const dayNames = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ nhật"];
const dayFocus = ["Ngữ pháp và phát âm", "Nghe và nhại lại", "Đọc và tìm căn cứ", "Viết và sửa bài", "Nói và nghe lại", "Ôn tập và đánh giá", "Nghỉ hoặc học bù"];
const dayMinutes = [90, 90, 90, 90, 90, 150, 0];

const council = "https://takeielts.britishcouncil.org/prepare";
const ielts = "https://ielts.org/take-a-test";
const learnEnglish = "https://learnenglish.britishcouncil.org";
const resources = {
  familiarisation: [`${council}/ielts-free-practice-mock-tests/ielts-familiarisation-test`, "British Council · Đề làm quen trên máy tính"],
  ready: [`${council}/ielts-ready`, "British Council · IELTS Ready"],
  idp: ["https://ielts.idp.com/vietnam/about/news-and-articles/article-ielts-computer-trial-at-home/en-gb", "IDP · Thi thử trên máy tính"],
  scoring: [`${ielts}/your-results/ielts-scoring-in-detail`, "IELTS · Cách tính band và tiêu chí chấm"],
  a1: [`${learnEnglish}/skills/listening/a1-listening`, "British Council · Nghe A1"],
  a2: [`${learnEnglish}/skills/listening/a2-listening`, "British Council · Nghe A2"],
  a1reading: [`${learnEnglish}/skills/reading/a1-reading`, "British Council · Đọc A1"],
  a2reading: [`${learnEnglish}/skills/reading/a2-reading`, "British Council · Đọc A2"],
  b1: [`${learnEnglish}/skills/listening/b1-listening`, "British Council · Nghe B1"],
  b1reading: [`${learnEnglish}/skills/reading/b1-reading`, "British Council · Đọc B1"],
  grammar: [`${learnEnglish}/grammar/a1-a2-grammar`, "British Council · Ngữ pháp A1–A2"]
};

function initialState() {
  return {
    settings: { start: "2026-11-23", track: "academic", makeup: {}, minimum: {} },
    sessions: {}, completed: {}, answers: {}, submissions: {}, drafts: {}, checks: {},
    selfScores: {}, results: {}, timers: {}, notes: [], lastLesson: null
  };
}

function dateValue(input) {
  if (typeof input !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return false;
  const parsed = new Date(`${input}T12:00:00Z`);
  return Number.isFinite(+parsed) && parsed.toISOString().slice(0, 10) === input;
}

function record(value, predicate) {
  return Object.fromEntries(Object.entries(value ?? {}).filter(([key, item]) => predicate(key, item)));
}

function integer(value, minimum, maximum) {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

function isBand(value) {
  return typeof value === "number" && integer(value * 2, 0, 18);
}

function textValue(value, max = 30000) {
  return typeof value === "string" && value.length <= max;
}

function validPracticeKey(key) {
  const match = /^([A-Z0-9-]+)(?:\.(academic|general))?:(\d+)$/.exec(key);
  if (!match) return false;
  const [, id, track, index] = match;
  const lesson = lessons.get(id);
  return Boolean(lesson?.practice?.[index]) && Boolean(track) === Boolean(lesson.mock);
}

function validAnswers(lesson, value) {
  return record(value, (key, answer) => {
    const [group, index] = key.split(":");
    return /^\d+:\d+$/.test(key) && !!lesson.groups?.[group]?.questions[index] && textValue(answer, 500);
  });
}

function restoreState(input) {
  const restored = initialState();
  if (!input || typeof input !== "object" || Array.isArray(input)) return restored;

  const settings = input.settings ?? {};
  if (dateValue(settings.start) && settings.start >= "1900-01-01" && settings.start <= "9996-12-31") restored.settings.start = settings.start;
  if (Object.hasOwn(tracks, settings.track)) restored.settings.track = settings.track;
  restored.settings.makeup = record(settings.makeup, (key, value) => /^\d{1,2}$/.test(key) && integer(+key, 1, 36) && integer(value, 1, 2));
  restored.settings.minimum = record(settings.minimum, (key, value) => bands.includes(key) && isBand(value));
  restored.sessions = record(input.sessions, (key, value) => /^([1-9]|[12]\d|3[0-6])(b[12])?:[0-6]$/.test(key) && integer(value, 1, 600));
  restored.completed = record(input.completed, (key, value) => lessons.has(key) && dateValue(value));
  for (const [id, value] of Object.entries(input.answers ?? {})) {
    if (lessons.has(id)) restored.answers[id] = validAnswers(lessons.get(id), value);
  }
  for (const [id, value] of Object.entries(input.submissions ?? {})) {
    if (lessons.has(id) && dateValue(value?.date)) {
      restored.submissions[id] = { date: value.date, answers: validAnswers(lessons.get(id), value.answers) };
    }
  }
  restored.drafts = record(input.drafts, (key, value) => validPracticeKey(key) && textValue(value));
  restored.checks = record(input.checks, (key, value) => validPracticeKey(key) && Array.isArray(value) && value.every(item => integer(item, 0, 3)));
  restored.selfScores = record(input.selfScores, (key, value) => validPracticeKey(key) && integer(value, 0, 4));
  for (const [key, value] of Object.entries(input.results ?? {})) {
    if (!/^(M24|M30|M35|M36)\.(academic|general)$/.test(key) || !dateValue(value?.date) || !textValue(value.test, 160)) continue;
    restored.results[key] = {
      test: value.test, date: value.date,
      bands: record(value.bands, (skill, band) => bands.includes(skill) && isBand(band)),
      raw: record(value.raw, (skill, points) => ["listening", "reading"].includes(skill) && integer(points, 0, 40))
    };
  }
  restored.timers = record(input.timers, (key, value) => /^[ML][A-Z\d.:-]+$/i.test(key) && integer(value?.remaining, 0, 4500)
    && (value.deadline === null || integer(value.deadline, 0, 8640000000000000)));
  if (Array.isArray(input.notes)) {
    restored.notes = input.notes.filter(note => note && /^[\w-]{1,80}$/.test(note.id) && dateValue(note.date)
      && [...bands, "grammar", "pronunciation", "vocabulary"].includes(note.skill)
      && textValue(note.error, 2000) && textValue(note.fix, 2000) && typeof note.done === "boolean");
  }
  if (lessons.has(input.lastLesson)) restored.lastLesson = input.lastLesson;
  return restored;
}

let storageProblem = false;
let state;
try {
  state = restoreState(JSON.parse(localStorage.getItem(STORE_KEY)));
} catch {
  state = initialState();
  storageProblem = true;
}

function showNotice(message, error = false) {
  notice.textContent = message;
  notice.toggleAttribute("data-error", error);
  notice.hidden = false;
}

function persist() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    storageProblem = false;
    return true;
  } catch {
    storageProblem = true;
    showNotice("Trình duyệt chưa lưu được thay đổi. Hãy tải bản sao lưu trong Cài đặt trước khi đóng trang.", true);
    return false;
  }
}

function escapeHTML(value = "") {
  const escaped = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(value).replace(/[&<>"']/g, char => escaped[char]);
}

function localDate() {
  const current = new Date();
  const offset = current.getTimezoneOffset() * 60000;
  return new Date(+current - offset).toISOString().slice(0, 10);
}

function dateShift(day, offset) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function dateLabel(day, year = false) {
  const [yyyy, month, date] = day.split("-");
  return year ? `${date}/${month}/${yyyy}` : `${date}/${month}`;
}

function firstMonday(day) {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return dateShift(day, (8 - weekday) % 7);
}

function schedule() {
  let date = firstMonday(state.settings.start);
  return course.weeks.map(week => {
    const makeup = state.settings.makeup[week.number] ?? 0;
    const entry = { ...week, start: date, end: dateShift(date, 6), makeup };
    date = dateShift(date, 7 * (makeup + 1));
    return entry;
  });
}

function currentWeek(calendar) {
  const today = localDate();
  const current = calendar.find(week => today < dateShift(week.start, 7 * (week.makeup + 1)));
  return current ?? calendar.at(-1);
}

function inTrack(lesson) {
  return !lesson.track || lesson.track === state.settings.track;
}

function weekLessons(week) {
  return [...week.lessons, ...(week[state.settings.track] ?? [])].map(id => lessons.get(id));
}

function weekPhase(number) {
  return phases.find(phase => number <= phase.to);
}

function minutesText(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return [hours && `${hours} giờ`, remainder && `${remainder} phút`].filter(Boolean).join(" ") || "0 giờ";
}

function pageHead(title, description = "", extra = "") {
  return `<div class="page-head">${extra}<h1>${escapeHTML(title)}</h1>
    ${description ? `<p>${escapeHTML(description)}</p>` : ""}</div>`;
}

function buttonLink(hash, label, kind = "") {
  return `<a class="button ${kind}" href="#${hash}">${escapeHTML(label)}</a>`;
}

function lessonLink(lesson) {
  return `<li><a class="lesson-link" href="#lesson/${lesson.id}">
    <span class="lesson-code">${lesson.id}</span><span>${escapeHTML(lesson.title)}</span></a></li>`;
}

function icon(name) {
  return `<img src="assets/icons/${name}.png" alt="" width="21" height="21">`;
}

function metric(name, value, symbol, detail = "") {
  return `<div class="panel metric">
    <span class="metric-icon">${icon(symbol)}</span>
    <div><span class="metric-label">${escapeHTML(name)}</span>
    <strong class="metric-value">${escapeHTML(value)}</strong>
    ${detail ? `<span class="metric-label">${escapeHTML(detail)}</span>` : ""}</div>
    </div>`;
}

function dailySessions(week, start, suffix = "", editable = false) {
  const scope = `${week.number}${suffix}`;
  return `<ul class="day-list">${dayNames.map((day, index) => {
    const key = `${scope}:${index}`;
    const planned = dayMinutes[index];
    const logged = state.sessions[key] ?? 0;
    const label = `${day} · ${dateLabel(dateShift(start, index))}`;
    return `<li><div class="day-row"><label class="check-label">
      <input type="checkbox" data-session="${key}" ${logged ? "checked" : ""}>
      <span>${editable ? label : day}<span class="muted"> · ${dayFocus[index]}</span></span></label>
      ${editable
        ? `<input type="number" class="session-minutes" data-session-minutes="${key}" min="0" max="600" value="${logged || ""}" placeholder="${planned || "0"}" aria-label="Phút thực học ${label}">`
        : `<small class="muted">${logged || planned ? `${logged || planned} phút` : "Tùy chọn"}</small>`}
      </div></li>`;
  }).join("")}</ul>`;
}

function nextLesson(calendar) {
  const last = lessons.get(state.lastLesson);
  if (last && !state.completed[last.id] && inTrack(last)) return last;
  if (!state.completed.M00) return lessons.get("M00");
  if (!state.completed.U01) return lessons.get("U01");
  const content = weekLessons(currentWeek(calendar));
  return content.find(lesson => !state.completed[lesson.id]) ?? content[0] ?? lessons.get("U01");
}

function upcomingMilestone() {
  for (const id of milestones) {
    if (id === "M08" || id === "M16") {
      const retry = `${id}R`;
      const result = foundationResult(id);
      const makeup = state.settings.makeup[lessons.get(id).week];
      if (result.pass || foundationResult(retry).pass) continue;
      if (result.scored && makeup) return retry;
      if (result.scored || !state.completed[id]) return id;
    } else if (mockIds.includes(id) ? !state.results[mockKey(id)] : !state.completed[id]) {
      return id;
    }
  }
}

function homeView() {
  const calendar = schedule();
  const week = currentWeek(calendar);
  const next = nextLesson(calendar);
  const upcoming = upcomingMilestone();
  const nextMilestone = lessons.get(upcoming);
  const sessions = Object.values(state.sessions);
  const inMakeup = localDate() > week.end && week.makeup && localDate() <= dateShift(week.end, week.makeup * 7);
  const weekLabel = localDate() < calendar[0].start ? "Chuẩn bị" : inMakeup ? "Ôn bù" : `Tuần ${week.number}`;
  const plannedStart = dateLabel(week.start);
  const milestoneWeek = calendar[nextMilestone?.week - 1];
  const milestoneDate = milestoneWeek
    ? dateLabel(dateShift(milestoneWeek.start, 5 + (nextMilestone.retestOf ? 7 * milestoneWeek.makeup : 0)))
    : "Trước tuần 1";
  const featured = weekLessons(week);
  if (!state.completed.M00 && week.number === 1) featured.unshift(lessons.get("M00"));
  return `<section class="hero">
    <div>
      <span class="eyebrow">Lộ trình 36 tuần · 10 giờ mỗi tuần</span>
      <h1>Tiếng Anh từ nền tảng<br><em>đến IELTS 6.0</em></h1>
      <p>Học bằng hướng dẫn tiếng Việt. Bắt đầu từ câu đơn và tiến tới luyện đủ bốn kỹ năng IELTS.</p>
      <div class="actions">${buttonLink(`lesson/${next.id}`, "Học tiếp", "button-primary")}
        ${buttonLink(state.completed.M00 ? "roadmap" : "lesson/M00", state.completed.M00 ? "Xem lộ trình" : "Làm bài đầu vào M00", "button-secondary")}</div>
    </div>
  </section>
  <section class="metrics" aria-label="Tiến độ hiện tại">
    ${metric("Đang học", weekLabel, "flag", weekLabel === "Chuẩn bị" ? `Tuần 1 từ ${plannedStart}` : weekPhase(week.number).title)}
    ${metric("Đã ghi", `${sessions.length} buổi`, "clock", minutesText(sessions.reduce((sum, value) => sum + value, 0)))}
    ${metric("Mốc kế tiếp", upcoming || "Hoàn tất", "chart", upcoming ? milestoneDate : "")}
  </section>
  <div class="split">
    <section class="panel">
      <div class="panel-head"><h2>Lịch tuần ${week.number}</h2><a href="#roadmap/${week.number}">Chi tiết tuần</a></div>
      ${dailySessions(week, week.start)}
    </section>
    <div class="stack">
      <section class="panel">
        <div class="panel-head"><h2>Bài học tuần này</h2><a href="#lessons">Tất cả bài</a></div>
        <ul class="lesson-list">${featured.map(lessonLink).join("")}</ul>
      </section>
      <section class="panel">
        <h2>Đầu ra tuần ${week.number}</h2><p>${escapeHTML(week.goal)}</p>
        <p><a href="#assessments${upcoming ? `/${upcoming}` : ""}">Mở bảng đánh giá</a></p>
      </section>
    </div>
  </div>`;
}

const openWeeks = new Set();

function weekSummary(week, requested) {
  const selected = week.number === requested || openWeeks.has(week.number);
  const retest = lessons.get(`M${String(week.number).padStart(2, "0")}R`);
  const focus = { ...week, ...week.byTrack?.[state.settings.track] };
  return `<details class="panel week" id="week-${week.number}" data-week="${week.number}" ${selected ? "open" : ""}>
    <summary><span>Tuần ${week.number}</span>${escapeHTML(week.title)}
      <span class="week-date">${dateLabel(week.start)} – ${dateLabel(week.end, true)}</span>
      ${week.makeup ? `<span class="badge badge-warn">+${week.makeup} tuần ôn bù</span>` : ""}</summary>
    <div class="week-body">
      <p><strong>Nghe và đọc</strong> · ${escapeHTML(focus.receptive)}</p>
      <p><strong>Viết và nói</strong> · ${escapeHTML(focus.productive)}</p>
      <p><strong>Đầu ra</strong> · ${escapeHTML(focus.goal)}</p>
      <div class="split">
        <div><h3>Buổi học · 10 giờ dự kiến</h3>${dailySessions(week, week.start, "", true)}</div>
        <div><h3>Bài học</h3><ul class="lesson-list">${weekLessons(week).map(lessonLink).join("")}</ul>
          <div class="week-extra"><label class="field"><span>Ôn bù sau tuần ${week.number}</span>
            <select data-makeup="${week.number}">
              ${[0, 1, 2].map(value => `<option value="${value}" ${week.makeup === value ? "selected" : ""}>${value ? `${value} tuần ôn bù` : "Không thêm"}</option>`).join("")}
            </select></label>
            ${retest && week.makeup ? `<p>${buttonLink(`lesson/${retest.id}`, `Mở bài đo lại ${retest.id}`, "button-small")}</p>` : ""}
          </div>
        </div>
      </div>
      ${Array.from({ length: week.makeup }, (_, index) => {
        const start = dateShift(week.start, (index + 1) * 7);
        return `<details class="compact"><summary>Tuần ôn bù ${index + 1} · ${dateLabel(start)} – ${dateLabel(dateShift(start, 6), true)}</summary>
          <div>${dailySessions(week, start, `b${index + 1}`, true)}</div></details>`;
      }).join("")}
    </div>
  </details>`;
}

function roadmapView(requested) {
  const calendar = schedule();
  const final = calendar.at(-1);
  const declared = calendar[0].start === state.settings.start ? "" : `Ngày chọn ${dateLabel(state.settings.start, true)}. Tuần 1 mở vào thứ Hai kế tiếp. `;
  const fullDescription = `${declared}${dateLabel(calendar[0].start, true)} – ${dateLabel(dateShift(final.end, final.makeup * 7), true)} · 36 tuần học, 360 giờ theo lịch mẫu.`;
  return `${pageHead("Lộ trình 36 tuần", fullDescription)}
    <div class="actions lesson-tools">
      ${buttonLink("lesson/M00", "M00 · Đo điểm xuất phát")}
      ${buttonLink("settings", "Đổi ngày bắt đầu")}
    </div>
    ${phases.map(phase => `<section aria-labelledby="phase-${phase.from}">
      <div class="phase-title"><h2 id="phase-${phase.from}">Tuần ${phase.from}–${phase.to} · ${phase.title}</h2><p class="muted">${phase.description}</p></div>
      ${calendar.slice(phase.from - 1, phase.to).map(week => weekSummary(week, requested)).join("")}
    </section>`).join("")}`;
}

let lessonFilter = { query: "", skill: "" };

function fold(text) {
  return text.toLocaleLowerCase("vi").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/g, "d");
}

function lessonCards() {
  const query = fold(lessonFilter.query.trim());
  const matches = course.lessons.filter(lesson => inTrack(lesson)
    && (!lessonFilter.skill || lesson.skill === lessonFilter.skill)
    && (!query || fold([lesson.id, lesson.title, lesson.intro, skillNames[lesson.skill],
      ...(lesson.sections ?? []).map(section => section.title)].join(" ")).includes(query)));
  return `<p class="small muted" role="status">${matches.length} bài</p>
    <div class="lesson-grid">${matches.map(lesson => `<article class="panel lesson-card">
      <div class="between"><span class="lesson-code">${lesson.id}</span>
      <small class="muted">${state.completed[lesson.id] ? "Đã hoàn thành" : skillNames[lesson.skill]}</small></div>
      <a href="#lesson/${lesson.id}">${escapeHTML(lesson.title)}</a>
      <small class="muted">${lesson.week ? `Tuần ${lesson.week}` : "Trước tuần 1"}${lesson.track ? ` · ${tracks[lesson.track]}` : ""}</small>
    </article>`).join("")}</div>`;
}

function lessonsView() {
  return `${pageHead("Bài học", "Tìm theo mã bài, kỹ năng hoặc chủ đề.")}
    <div class="search-tools">
      <label class="field"><span>Tìm bài học</span><input type="search" id="lesson-search" value="${escapeHTML(lessonFilter.query)}" placeholder="Ví dụ U01 hoặc chào hỏi"></label>
      <label class="field"><span>Lọc kỹ năng</span><select id="lesson-skill"><option value="">Tất cả</option>
      ${Object.entries(skillNames).filter(([key]) => key !== "practice").map(([key, value]) => `<option value="${key}" ${key === lessonFilter.skill ? "selected" : ""}>${value}</option>`).join("")}</select></label>
    </div><div id="lesson-results" class="stack">${lessonCards()}</div>`;
}

function textBlock(section) {
  return `<section class="panel"><div class="copy" ${section.lang ? `lang="${section.lang}"` : ""}>
    ${section.title ? `<h2>${escapeHTML(section.title)}</h2>` : ""}
    ${section.paragraphs.map(p => `<p>${escapeHTML(p.replace(/^•\s*/, ""))}</p>`).join("")}
  </div></section>`;
}

function contentTable(rows) {
  return `<div class="panel table-wrap"><table><thead><tr>${rows[0].map(c => `<th scope="col">${escapeHTML(c)}</th>`).join("")}</tr></thead>
    <tbody>${rows.slice(1).map(row => `<tr>${row.map(c => `<td>${escapeHTML(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function officialResources(items) {
  return `<ul>${items.map(([url, label]) => `<li><a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(label)}</a></li>`).join("")}</ul>`;
}

function trackResources() {
  const general = state.settings.track === "general";
  return [
    [`${council}/ielts-free-practice-mock-tests/${general ? "general-training" : "academic"}`, `British Council · Bộ bài thi thử ${tracks[state.settings.track]}`],
    [`${ielts}/preparation-resources/sample-test-questions/${general ? "general-training-test" : "academic-test"}`, `IELTS · Câu hỏi mẫu ${tracks[state.settings.track]}`]
  ];
}

function lessonScope(lesson) {
  return lesson.mock ? mockKey(lesson.id) : lesson.id;
}

function audioPanel(lesson) {
  const code = lesson.audio;
  const transcript = course.audio[code];
  const locked = lesson.groups?.some(group => group.skill === "listening") && !state.submissions[lesson.id];
  return `<section class="panel" id="lesson-audio">
    <div class="panel-head"><h2>Bài nghe</h2><span class="lesson-code">${code}.mp3</span></div>
    <audio controls preload="metadata" src="audio/${code}.mp3" aria-label="Âm thanh ${code}" data-lesson-audio></audio>
    <div class="audio-controls">
      <button type="button" class="button button-small" data-rewind>Tua lại 5 giây</button>
      <label class="track-field">Tốc độ <select data-rate>
      ${[0.65, 0.8, 1, 1.15, 1.25, 1.5].map(rate => `<option value="${rate}" ${rate === 1 ? "selected" : ""}>${rate}×</option>`).join("")}</select></label>
    </div>
    <p id="audio-error" class="incorrect small" role="status" hidden></p>
    <p class="small muted audio-hint" id="transcript-hint" ${locked ? "" : "hidden"}>Lời nghe sẽ mở sau khi chấm bài.</p>
    <details class="model" id="audio-transcript" ${locked ? "hidden" : ""}><summary>Mở lời bài nghe</summary>
      <div dir="ltr" lang="en">${transcript.map(line => `<p>${transcript.length > 1 ? `<span class="muted">${line.voice}. </span>` : ""}${escapeHTML(line.text)}</p>`).join("")}</div></details>
  </section>`;
}

function normalizeAnswer(answer) {
  return String(answer ?? "").normalize("NFKC").toLowerCase()
    .replace(/[’‘]/g, "'").replace(/[?!.,;]+(?=\s|$)/g, "")
    .replace(/\s+/g, " ").trim();
}

function optionValue(option) {
  return option.split(". ", 1)[0];
}

function matchesAnswer(question, value) {
  return question.answers.some(answer => normalizeAnswer(value) === normalizeAnswer(answer));
}

function rubricKey(lesson, index) {
  return `${lessonScope(lesson)}:${index}`;
}

function scoreOf(lesson) {
  const submission = state.submissions[lesson.id];
  if (!submission) return null;
  const totals = {};
  lesson.groups.forEach((group, g) => group.questions.forEach((question, i) => {
    if (!question.answers) return;
    const total = totals[group.skill] ??= { scored: 0, count: 0 };
    total.count += 1;
    if (matchesAnswer(question, submission.answers[`${g}:${i}`])) total.scored += 1;
  }));
  return totals;
}

function scoresText(totals) {
  return Object.entries(totals).map(([skill, { scored, count }]) => `${skillNames[skill]} ${scored}/${count}`).join(" · ");
}

function questionFeedback(question, answer, submitted) {
  if (!question.answers) return submitted ? `<span class="muted">Đối chiếu</span> · ${escapeHTML(question.model)}` : "";
  if (!submitted) return "";
  const correct = matchesAnswer(question, answer);
  const key = question.answers[0];
  const option = question.options?.find(item => optionValue(item).toLowerCase() === key.toLowerCase());
  return correct ? `<strong class="correct">Đúng</strong> · ${escapeHTML(option ?? key)}`
    : `<strong class="incorrect">${answer ? "Chưa đúng" : "Bỏ trống"}</strong> · Đáp án ${escapeHTML(option ?? key)}`;
}

function quizPanel(lesson) {
  const answers = state.answers[lesson.id] ?? {};
  const submission = state.submissions[lesson.id];
  let number = 1;
  const groups = lesson.groups.map((group, g) => {
    const start = number;
    number += group.questions.length;
    return `<fieldset class="panel">
      <legend>${escapeHTML(group.title)}</legend>
      ${group.instruction ? `<p class="muted">${escapeHTML(group.instruction)}</p>` : ""}
      ${group.passage ? `<div class="passage" lang="en">${escapeHTML(group.passage)}</div>` : ""}
      <ol class="questions" start="${start}">${group.questions.map((question, i) => {
        const key = `${g}:${i}`;
        const value = answers[key] ?? "";
        const control = question.options
          ? `<select name="${key}" data-answer="${key}" aria-describedby="answer-${g}-${i}">
            <option value="">Chọn đáp án</option>${question.options.map(option => {
              const label = optionValue(option);
              return `<option value="${escapeHTML(label)}" ${value === label ? "selected" : ""}>${escapeHTML(option)}</option>`;
            }).join("")}</select>`
          : `<input name="${key}" data-answer="${key}" value="${escapeHTML(value)}" maxlength="500" spellcheck="false" autocomplete="off" aria-describedby="answer-${g}-${i}">`;
        return `<li><label><span>${escapeHTML(question.prompt)}${question.model ? ` <small class="muted">· Tự đối chiếu</small>` : ""}</span>${control}</label>
          <small class="answer" id="answer-${g}-${i}">${questionFeedback(question, submission?.answers[key], submission)}</small></li>`;
      }).join("")}</ol>
    </fieldset>`;
  }).join("");
  return `<form id="quiz-form" class="stack">${groups}
    <div class="panel"><button class="button button-primary" type="submit">Chấm bài</button>
    <p class="result" id="quiz-result" tabindex="-1" role="status" ${submission ? "" : "hidden"}>${submission ? scoresText(scoreOf(lesson)) : ""}</p></div>
  </form>`;
}

function selfScoreText(key) {
  return state.selfScores[key] === undefined ? "" : `Đã lưu ${state.selfScores[key]}/4`;
}

function practicePanel(lesson, item, index) {
  const key = rubricKey(lesson, index);
  const draft = state.drafts[key] ?? "";
  const checks = state.checks[key] ?? [];
  const speaking = item.kind === "speaking";
  const scored = ["M08", "M08R", "M16", "M16R"].includes(lesson.id);
  const heading = lesson.practice.filter(p => p.kind === item.kind).length > 1
    ? `${skillNames[item.kind]} · Bài ${index + 1}` : `Luyện ${skillNames[item.kind].toLowerCase()}`;
  const textArea = speaking ? "Từ khóa và góp ý sau khi nói" : "Bản nháp bài viết";
  return `<section class="panel practice" id="practice-${index}" data-practice="${key}">
    <div class="panel-head"><h2>${heading}</h2><span class="small muted" data-draft-status="${key}">${draft ? "Đã có bản nháp" : "Bản nháp tự lưu"}</span></div>
    <p>${escapeHTML(item.prompt)}</p>
    <label class="field"><span>${textArea}</span><textarea data-draft="${key}" maxlength="30000">${escapeHTML(draft)}</textarea></label>
    ${!speaking ? `<p class="word-count small muted" data-words="${key}">${wordCount(draft)} từ</p>` : ""}
    ${speaking ? `<div class="audio-controls">
      <button class="button" data-record="${key}" type="button" ${pendingCapture?.key === key ? "disabled" : ""}>${capture?.key === key ? "Dừng thu âm" : "Thu âm"}</button>
      <span class="small muted" data-mic-status="${key}" role="status">${capture?.key === key ? "Đang thu âm" : ""}</span></div><div data-recording="${key}"></div>` : ""}
    ${item.rubric.length ? `<fieldset class="rubric"><legend>Bảng tiêu chí${scored ? " · 1 điểm mỗi mục" : ""}</legend>
      ${item.rubric.map((row, index) => `<label class="check-label"><input type="checkbox" data-rubric="${key}" value="${index}" ${checks.includes(index) ? "checked" : ""}><span>${escapeHTML(row)}</span></label>`).join("")}
      ${scored ? `<div class="actions"><button class="button button-small" data-save-self="${key}" type="button">Lưu điểm tự chấm</button>
        <span data-rubric-score="${key}" role="status" class="small muted">${selfScoreText(key)}</span></div>` : ""}</fieldset>` : ""}
    ${item.model ? `<details class="model"><summary>Xem bài mẫu</summary><div lang="en">${escapeHTML(item.model)}</div></details>` : ""}
  </section>`;
}

function wordCount(text) {
  return text.trim().match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

const timerLengths = { listening: 30, reading: 60, writing: 60, speaking: 14 };

function timerControl(scope, title, minutes) {
  return `<div class="timer" data-timer="${scope}" data-minutes="${minutes}">
    <span class="timer-label">${title}</span>
    <output aria-label="Thời gian còn lại ${title}"></output>
    <button class="button button-small" type="button" data-toggle-timer>Bắt đầu</button>
    <button class="button button-small" type="button" data-reset-timer>Đặt lại</button>
    <span class="small incorrect" data-timer-done hidden>Hết giờ</span></div>`;
}

function mockPanel(lesson) {
  const exam = lesson.id;
  const resource = exam === "M24" ? resources.familiarisation : exam === "M30" ? resources.ready : resources.idp;
  return `<section class="panel">
    <h2>Đề thi thử ${tracks[state.settings.track]}</h2>
    <p>Chọn đề đầy đủ chưa làm. Giữ mỗi phần Nghe và Đọc đủ 40 câu. Với phần Nói, chọn đủ ba Part. Các nguồn dưới đây mở ở tab mới và cần mạng.</p>
    ${officialResources([resource, ...trackResources()])}
    <p class="small muted">Dùng một lượt phát cho Listening. Làm hai Task Writing trong 60 phút, gợi ý chia 20 và 40 phút.</p>
    ${Object.entries(timerLengths).map(([skill, minutes]) => timerControl(`${mockKey(exam)}:${skill}`, skillNames[skill], minutes)).join("")}
    ${buttonLink(`assessments/${exam}`, "Nhập điểm và tên đề")}
  </section>`;
}

function lessonResources(lesson) {
  if (lesson.id === "SRC") return [resources.a1, resources.a1reading, resources.a2, resources.a2reading, resources.b1, resources.b1reading,
    resources.grammar, ...trackResources(), resources.familiarisation, resources.ready, resources.idp, resources.scoring];
  if (lesson.id === "EXAM") return [...trackResources(), resources.scoring];
  if (lesson.id === "U01") return [resources.a1, resources.a1reading];
  if (lesson.id === "M08R") return [resources.a1, resources.a1reading];
  if (lesson.id === "M16R") return [resources.a2, resources.a2reading, resources.b1, resources.b1reading];
  if (lesson.id === "W-HOW" || lesson.id === "S-HOW") return [resources.scoring];
  return [];
}

function nextUnit(lesson) {
  if (lesson.id === "M00") return lessons.get("U01");
  if (lesson.week < 36 && /^[UM]\d{2}R?$/.test(lesson.id)) {
    return lessons.get(course.weeks[lesson.week]?.lessons[0]);
  }
  return null;
}

function lessonStep(lesson) {
  const next = nextUnit(lesson);
  const completed = state.completed[lesson.id];
  const scoreLink = lesson.skill === "assessment" ? buttonLink(`assessments/${lesson.id}`, "Xem bảng điểm") : "";
  return `<div class="panel lesson-end actions">
    <button class="button ${completed ? "" : "button-primary"}" type="button" data-complete>${completed ? "Đã hoàn thành · Bỏ đánh dấu" : `Hoàn thành ${lesson.id}`}</button>
    ${next ? buttonLink(`lesson/${next.id}`, `Học tiếp ${next.id}`) : ""}${scoreLink}
    ${lesson.week ? buttonLink(`roadmap/${lesson.week}`, `Lịch tuần ${lesson.week}`) : ""}
  </div>`;
}

function lessonView(lesson) {
  if (!lesson) return `${pageHead("Bài học chưa có")}${buttonLink("lessons", "Về danh sách bài học")}`;
  if (!inTrack(lesson)) {
    return `${pageHead(lesson.title, `Bài này thuộc hệ ${tracks[lesson.track]}. Dùng mục Hệ IELTS ở đầu trang để mở bài.`)}
      ${buttonLink("lessons", "Về danh sách bài học")}`;
  }
  const resources = lessonResources(lesson);
  const tag = `<p class="eyebrow">${lesson.id} · ${lesson.week ? `Tuần ${lesson.week}` : "Trước tuần 1"}${lesson.minutes ? ` · ${lesson.minutes} phút` : ""}</p>`;
  return `<div class="wide">
    ${pageHead(lesson.title, lesson.intro, tag)}
    <div class="actions lesson-tools">
      ${buttonLink("lessons", "Tất cả bài học")}
      ${lesson.audio ? `<button class="button" data-scroll="lesson-audio">Bài nghe</button>` : ""}
      ${lesson.groups ? `<button class="button" data-scroll="quiz-form">Bài tập</button>` : ""}
      ${lesson.practice ? `<button class="button" data-scroll="practice-0">Luyện viết và nói</button>` : ""}
      ${lesson.id === "M00" ? buttonLink("lesson/U01", "Học tiếp U01") : ""}
    </div>
    <div class="chapter-content">
      ${lesson.audio ? audioPanel(lesson) : ""}
      ${lesson.mock ? mockPanel(lesson) : ""}
      ${lesson.minutes ? `<section class="panel"><h2>Thời gian làm bài</h2>${timerControl(lesson.id, "Toàn bài", lesson.minutes)}</section>` : ""}
      ${(lesson.sections ?? []).map(textBlock).join("")}
      ${lesson.table ? contentTable(lesson.table) : ""}
      ${lesson.groups ? quizPanel(lesson) : ""}
      ${(lesson.practice ?? []).map((item, index) => practicePanel(lesson, item, index)).join("")}
      ${lesson.review ? `<section class="panel"><h2>Sau khi chấm</h2><p>${escapeHTML(lesson.review)}</p></section>` : ""}
      ${resources.length ? `<section class="panel"><h2>Bài luyện bổ sung</h2><p class="muted">Các liên kết này cần mạng.</p>${officialResources(resources)}</section>` : ""}
    </div>${lessonStep(lesson)}
  </div>`;
}

function foundationResult(id) {
  const lesson = lessons.get(id);
  const totals = scoreOf(lesson);
  const writing = state.selfScores[rubricKey(lesson, 0)];
  const speaking = state.selfScores[rubricKey(lesson, 1)];
  return {
    totals, writing, speaking,
    scored: Boolean(totals) && writing !== undefined && speaking !== undefined,
    pass: totals?.listening?.scored >= 7 && totals?.reading?.scored >= 7 && writing >= 3 && speaking >= 3
  };
}

function mockKey(id) {
  return `${id}.${state.settings.track}`;
}

function overall(scores = {}) {
  if (!bands.every(skill => isBand(scores[skill]))) return null;
  return Math.round(bands.reduce((sum, skill) => sum + scores[skill], 0) / 2) / 2;
}

function bandText(value) {
  return value === undefined || value === null ? "—" : value.toFixed(1);
}

function floorResults(scores) {
  const requested = Object.entries(state.settings.minimum);
  return requested.filter(([skill, value]) => scores[skill] < value).map(([skill, value]) => `${skillNames[skill]} dưới ${bandText(value)}`);
}

function formatAssessment(lesson, date) {
  const id = lesson.id;
  const { totals, writing, speaking, scored, pass } = foundationResult(id);
  const retry = lessons.get(`${id}R`);
  const retryResult = retry ? foundationResult(retry.id) : null;
  const fail = scored && !pass && !retryResult?.pass && id !== "M00";
  const status = id === "M00" ? "" : pass || retryResult?.pass ? "Đạt mốc luyện" : fail ? "Cần ôn bù" : "Chờ đủ điểm";
  return `<section class="panel" data-assessment="${id}">
    <div class="panel-head"><h2>${id} · ${escapeHTML(lesson.title)}</h2>${status ? `<span class="badge ${fail ? "badge-warn" : ""}">${status}</span>` : ""}</div>
    <p class="small muted">${date}${state.submissions[id] ? ` · Chấm ngày ${dateLabel(state.submissions[id].date, true)}` : ""}</p>
    <p>${totals ? scoresText(totals) : id === "M00" ? "Nghe /5 · Đọc /5 · Ngữ pháp /10" : "Nghe —/10 · Đọc —/10"}
      ${id === "M00" ? "" : ` · Viết ${writing ?? "—"}/4 · Nói ${speaking ?? "—"}/4`}</p>
    ${id === "M00" ? "<p>Lưu bài viết và bản ghi nói trong M00 để đối chiếu về sau.</p>" : "<p>Ngưỡng bài luyện là Nghe và Đọc ≥ 7/10, Viết và Nói ≥ 3/4.</p>"}
    ${retryResult?.scored ? `<p>Đo lại · ${scoresText(retryResult.totals)} · Viết ${retryResult.writing}/4 · Nói ${retryResult.speaking}/4</p>` : ""}
    ${fail ? "<p>Ôn kỹ năng dưới ngưỡng 1–2 tuần, rồi làm bài mới cùng mức.</p>" : ""}
    <div class="actions">
      ${buttonLink(`lesson/${id}`, `Mở ${id}`)}
      ${retry ? buttonLink(`roadmap/${lesson.week}`, "Xếp tuần ôn bù") + buttonLink(`lesson/${retry.id}`, `Bài đo lại ${retry.id}`) : ""}
    </div>
  </section>`;
}

function mockForm(lesson, date) {
  const id = lesson.id;
  const result = state.results[mockKey(id)];
  const overallBand = overall(result?.bands);
  const label = `${id} · ${lesson.title}`;
  return `<section class="panel" data-assessment="${id}">
    <div class="panel-head"><h2>${escapeHTML(label)}</h2><span class="badge">${tracks[state.settings.track]}</span></div>
    <p class="small muted">${date} · Bốn kỹ năng</p>
    ${buttonLink(`lesson/${id}`, "Mở đề và đồng hồ")}
    <form data-mock="${id}" class="stack">
      <div class="fields">
        <label class="field"><span>Tên đề hoặc mã đề</span><input name="test" maxlength="160" value="${escapeHTML(result?.test)}" required></label>
        <label class="field"><span>Ngày làm</span><input type="date" name="date" value="${result?.date ?? localDate()}" required></label>
      </div>
      <div class="fields">${["listening", "reading"].map(skill => `<label class="field"><span>${skillNames[skill]} · Câu đúng /40</span>
        <input type="number" min="0" max="40" name="raw-${skill}" value="${result?.raw[skill] ?? ""}"></label>`).join("")}</div>
      <div class="fields">${bands.map(skill => `<label class="field"><span>Band ${skillNames[skill]}</span>
        <input type="number" min="0" max="9" step="0.5" name="${skill}" value="${result?.bands[skill] ?? ""}"></label>`).join("")}</div>
      <p class="small muted">Dùng hướng dẫn quy đổi Nghe và Đọc của đề. Nhập band Viết và Nói khi có kết quả chấm theo tiêu chí.</p>
      <div class="actions"><button class="button button-primary" type="submit">Lưu điểm ${id}</button>
      <strong>${overallBand === null ? "Overall hiện khi đủ bốn band" : `Overall ${bandText(overallBand)}`}</strong></div>
    </form>
  </section>`;
}

function comparisonPanel() {
  const results = mockIds.map(id => [id, state.results[mockKey(id)]]);
  const finals = results.slice(-2).map(([id, result]) => {
    const band = overall(result?.bands);
    if (band === null) return `${id} · Chờ đủ bốn band`;
    const misses = floorResults(result.bands);
    if (band >= 6 && !misses.length) return `${id} · Đạt overall ${bandText(band)} và các sàn đã nhập`;
    return `${id} · ${[band < 6 ? `Overall ${bandText(band)} dưới 6.0` : `Overall ${bandText(band)}`, ...misses].join(" · ")}`;
  });
  const initial = overall(results[0][1]?.bands);
  const mid = overall(results[1][1]?.bands);
  const change = initial !== null && mid !== null ? mid - initial : null;
  return `<section class="panel"><h2>So sánh các lần thi thử</h2>
    <p>Mục tiêu overall 6.0 · ${tracks[state.settings.track]}. <a href="#settings">Nhập sàn từng kỹ năng</a></p>
    <div class="table-wrap"><table class="score-table"><thead><tr><th scope="col">Mốc</th><th scope="col">Nghe</th><th scope="col">Đọc</th><th scope="col">Viết</th><th scope="col">Nói</th><th scope="col">Overall</th></tr></thead>
    <tbody>${results.map(([id, result]) => `<tr><th scope="row">${id}</th>${bands.map(skill => `<td>${bandText(result?.bands[skill])}</td>`).join("")}
      <td><strong>${bandText(overall(result?.bands))}</strong></td></tr>`).join("")}</tbody></table></div>
    ${change !== null ? `<p>Overall M30 so với M24 · ${change > 0 ? "+" : ""}${bandText(change)} band</p>` : ""}
    <ul class="comparison">${finals.map(item => `<li>${escapeHTML(item)}</li>`).join("")}</ul>
    ${officialResources([resources.scoring])}
  </section>`;
}

function assessmentsView(requested) {
  const calendar = schedule();
  const lesson = lessons.get(requested);
  const target = lesson?.retestOf ?? requested;
  const planned = id => {
    const week = lessons.get(id).week;
    return week ? `Tuần ${week} · ${dateLabel(dateShift(calendar[week - 1].start, 5), true)}` : "Trước tuần 1";
  };
  const mockSections = mockIds.map(id => `<details class="compact" ${id === target ? "open" : ""}>
    <summary>${id} · ${escapeHTML(lessons.get(id).title)} · ${planned(id)}</summary>
    <div>${mockForm(lessons.get(id), planned(id))}</div></details>`).join("");
  return `${pageHead("Đánh giá", "Theo dõi điểm nền tảng và đối chiếu kết quả thi thử qua từng mốc.")}
    <div class="stack">
      ${["M00", "M08", "M16"].map(id => formatAssessment(lessons.get(id), planned(id))).join("")}
      ${comparisonPanel()}${mockSections}
    </div>`;
}

function notesView() {
  const list = [...state.notes].reverse();
  const skillOptions = [...bands, "grammar", "pronunciation", "vocabulary"];
  return `<div class="wide">${pageHead("Sổ lỗi", "Ghi câu sai, cách sửa và ngày bạn sẽ thử lại.")}
    <div class="stack">
      <section class="panel"><h2>Ghi lỗi mới</h2>
        <form id="note-form" class="stack">
          <div class="fields">
            <label class="field"><span>Kỹ năng</span><select name="skill">${skillOptions.map(skill => `<option value="${skill}">${skillNames[skill]}</option>`).join("")}</select></label>
            <label class="field"><span>Ngày luyện lại</span><input type="date" name="date" value="${localDate()}" required></label>
          </div>
          <label class="field"><span>Lỗi hoặc câu cần sửa</span><textarea name="error" maxlength="2000" required></textarea></label>
          <label class="field"><span>Việc sẽ làm để sửa</span><textarea name="fix" maxlength="2000" required></textarea></label>
          <div><button type="submit" class="button button-primary">Lưu lỗi</button></div>
        </form>
      </section>
      <section class="panel"><h2>Đã ghi · ${list.length}</h2>
        ${list.length ? `<ul class="plain-list">${list.map(note => `<li>
            <div class="between"><span class="badge">${skillNames[note.skill]}</span><small class="muted">Luyện lại ${dateLabel(note.date, true)}</small></div>
            <p class="note-text"><strong>${escapeHTML(note.error)}</strong></p><p class="note-text">${escapeHTML(note.fix)}</p>
            <label class="check-label"><input type="checkbox" data-note="${note.id}" ${note.done ? "checked" : ""}>Đã luyện lại</label>
          </li>`).join("")}</ul>` : "<p>Chưa có lỗi nào được ghi.</p>"}
      </section>
    </div>
  </div>`;
}

function settingsView() {
  const { start, minimum } = state.settings;
  return `<div class="wide">${pageHead("Cài đặt", "Lịch học và dữ liệu được lưu trong trình duyệt bạn đang dùng.")}
    <div class="stack">
      <section class="panel"><h2>Lịch học và mục tiêu</h2>
        <form id="settings-form" class="stack">
          <label class="field"><span>Ngày bắt đầu</span><input type="date" name="start" value="${start}" min="1900-01-01" max="9996-12-31" required></label>
          <p class="small muted">Buổi đầu của tuần 1 là thứ Hai trùng ngày chọn hoặc thứ Hai kế tiếp. M00 có thể làm trước đó.</p>
          <div><h3>Sàn band từng kỹ năng</h3><p class="small muted">Chỉ điền những mức nơi nhận hồ sơ yêu cầu. Mục tiêu overall là 6.0.</p></div>
          <div class="fields">${bands.map(skill => `<label class="field"><span>${skillNames[skill]}</span>
            <input type="number" min="0" max="9" step="0.5" name="floor-${skill}" value="${minimum[skill] ?? ""}" placeholder="Tùy chọn"></label>`).join("")}</div>
          <div class="actions"><button type="submit" class="button button-primary">Lưu cài đặt</button>${buttonLink("roadmap", "Xếp tuần ôn bù")}</div>
        </form>
      </section>
      <section class="panel"><h2>Sao lưu và chuyển máy</h2>
        <p>Tải tệp JSON chứa tiến độ, bài làm, điểm, sổ lỗi và bản ghi âm. Khi nhập, các mục trùng dùng dữ liệu từ bản sao lưu và các mục khác vẫn được giữ.</p>
        <div class="actions lesson-end">
          <button class="button" type="button" id="backup-download">Tải bản sao lưu</button>
          <button class="button" type="button" id="backup-choose">Nhập bản sao lưu</button>
          <input type="file" id="backup-file" accept=".json,application/json" hidden>
        </div>
      </section>
      <section class="panel"><h2>Dùng ngoại tuyến</h2>
        <p>Bài học và MP3 đi kèm thư mục tải về. Bạn có thể tắt mạng khi chạy trên localhost. Dùng cùng địa chỉ và trình duyệt để tiếp tục tiến độ. Đề thi thử và các liên kết nguồn cần mạng.</p>
        <p class="small muted">Phiên bản ${VERSION}</p>
      </section>
    </div></div>`;
}

let database;

function recordingStore() {
  if (!database) {
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open("ielts36-recordings", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("clips", { keyPath: "key" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Recording storage is blocked"));
    });
  }
  return database;
}

async function recordingTransaction(mode, fn) {
  const db = await recordingStore();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("clips", mode);
    const request = fn(transaction.objectStore("clips"));
    transaction.oncomplete = () => resolve(request?.result);
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

let capture = null;
let pendingCapture = null;
const transientClips = new Map();
const clipURLs = new Map();

function mediaLabel(key, message, error = false) {
  const label = main.querySelector(`[data-mic-status="${key}"]`);
  if (label) {
    label.textContent = message;
    label.classList.toggle("incorrect", error);
  }
}

function setMicButton(key, label, disabled = false) {
  const button = main.querySelector(`[data-record="${key}"]`);
  if (button) {
    button.textContent = label;
    button.disabled = disabled;
  }
}

async function loadClip(key) {
  const section = main.querySelector(`[data-recording="${key}"]`);
  if (!section) return;
  const clip = transientClips.get(key) ?? await recordingTransaction("readonly", store => store.get(key)).catch(() => null);
  if (!section.isConnected || !clip?.blob?.size) return;
  if (clipURLs.has(key)) URL.revokeObjectURL(clipURLs.get(key));
  const url = URL.createObjectURL(clip.blob);
  clipURLs.set(key, url);
  const extension = clip.blob.type.startsWith("audio/mp4") ? "m4a" : clip.blob.type.startsWith("audio/ogg") ? "ogg" : "webm";
  section.innerHTML = `<audio controls src="${url}" aria-label="Bản ghi luyện nói"></audio>
    <a download="${key.replace(":", "-")}.${extension}" href="${url}">Tải bản ghi</a>`;
}

function stopCapture() {
  if (capture?.recorder.state === "recording") capture.recorder.stop();
}

async function startCapture(key) {
  if (capture?.key === key) {
    stopCapture();
    return;
  }
  if (pendingCapture || capture) return;
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    mediaLabel(key, "Thu âm cần trình duyệt hỗ trợ và trang localhost. Bạn vẫn có thể lưu từ khóa.", true);
    return;
  }

  const pending = { key, host: main.querySelector(`[data-record="${key}"]`) };
  pendingCapture = pending;
  setMicButton(key, "Đang xin quyền", true);
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (!pending.host.isConnected) {
      stream.getTracks().forEach(track => track.stop());
      return;
    }
    const formats = ["audio/mp4", "audio/webm;codecs=opus", "audio/ogg;codecs=opus"];
    const mimeType = formats.find(type => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    const chunks = [];
    let failed = false;
    const stopAt = setTimeout(stopCapture, 15 * 60 * 1000);
    recorder.addEventListener("dataavailable", event => {
      if (event.data.size) chunks.push(event.data);
    });
    recorder.addEventListener("error", () => {
      failed = true;
      mediaLabel(key, "Thu âm bị gián đoạn. Hãy thử lại.", true);
    });
    recorder.addEventListener("stop", async () => {
      clearTimeout(stopAt);
      stream.getTracks().forEach(track => track.stop());
      if (capture?.recorder === recorder) capture = null;
      setMicButton(key, "Thu âm");
      if (failed) return;
      const blob = new Blob(chunks, { type: recorder.mimeType || chunks[0]?.type });
      if (!blob.size) {
        mediaLabel(key, "Bản ghi trống. Hãy thử thu âm lại.", true);
        return;
      }
      const clip = { key, blob };
      transientClips.set(key, clip);
      try {
        await recordingTransaction("readwrite", store => store.put(clip));
        transientClips.delete(key);
        mediaLabel(key, "Đã lưu bản ghi");
      } catch {
        mediaLabel(key, "Bản ghi tạm có thể tải về ngay. Trình duyệt chưa lưu được sau khi tải lại.", true);
      }
      await loadClip(key);
    });
    recorder.start();
    capture = { key, recorder };
    setMicButton(key, "Dừng thu âm");
    mediaLabel(key, "Đang thu âm");
  } catch (error) {
    stream?.getTracks().forEach(track => track.stop());
    setMicButton(key, "Thu âm");
    mediaLabel(key, error.name === "NotAllowedError" ? "Hãy cho phép dùng micro rồi bấm Thu âm." :
      "Chưa mở được micro. Kiểm tra thiết bị và thử lại.", true);
  } finally {
    pendingCapture = null;
  }
}

function clipData(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function exportBackup() {
  const button = document.querySelector("#backup-download");
  button.disabled = true;
  let readRecordings = true;
  try {
    const saved = await recordingTransaction("readonly", store => store.getAll()).catch(() => {
      readRecordings = false;
      return [];
    });
    const available = new Map(saved.map(clip => [clip.key, clip]));
    transientClips.forEach((clip, key) => available.set(key, clip));
    const recordings = await Promise.all([...available.values()].map(async clip => ({
      key: clip.key, mime: clip.blob.type, data: await clipData(clip.blob)
    })));
    const backup = { format: "english-tools", schema: 1, progress: state, recordings };
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `ielts-tien-do-${localDate()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showNotice(readRecordings ? "Đã tạo bản sao lưu." : "Đã tạo bản sao lưu tiến độ. Trình duyệt chưa đọc được kho bản ghi.", !readRecordings);
  } catch {
    showNotice("Chưa tạo được bản sao lưu. Hãy thử lại.", true);
  } finally {
    button.disabled = false;
  }
}

function mergeProgress(existing, imported) {
  const merged = { ...existing, settings: imported.settings, lastLesson: imported.lastLesson ?? existing.lastLesson };
  for (const key of ["sessions", "completed", "submissions", "drafts", "checks", "selfScores", "results", "timers"]) {
    merged[key] = { ...existing[key], ...imported[key] };
  }
  merged.answers = { ...existing.answers };
  for (const [id, answers] of Object.entries(imported.answers)) {
    merged.answers[id] = { ...existing.answers[id], ...answers };
  }
  const notes = new Map(existing.notes.map(note => [note.id, note]));
  imported.notes.forEach(note => notes.set(note.id, note));
  merged.notes = [...notes.values()];
  return merged;
}

function importedClips(value) {
  if (!Array.isArray(value)) throw new Error("Invalid audio");
  return value.map(clip => {
    if (!clip || !validPracticeKey(clip.key) || !/^audio\/(?:mp4|webm|ogg)(?:;.*)?$/i.test(clip.mime) || typeof clip.data !== "string") {
      throw new Error("Invalid audio");
    }
    const bytes = Uint8Array.from(atob(clip.data), character => character.charCodeAt(0));
    return { key: clip.key, blob: new Blob([bytes], { type: clip.mime }) };
  });
}

async function importBackup(file) {
  let backup;
  let imported;
  let clips;
  try {
    backup = JSON.parse(await file.text());
    if (backup?.format !== "english-tools" || backup.schema !== 1 || !backup.progress?.settings) throw new Error("Invalid backup");
    imported = restoreState(backup.progress);
    clips = importedClips(backup.recordings ?? []);
  } catch {
    showNotice("Tệp chưa đúng định dạng sao lưu của website.", true);
    return;
  }

  const before = state;
  state = mergeProgress(state, imported);
  if (!persist()) {
    state = before;
    return;
  }
  let audioRestored = true;
  if (clips.length) {
    try {
      await recordingTransaction("readwrite", store => clips.forEach(clip => store.put(clip)));
      clips.forEach(clip => transientClips.delete(clip.key));
    } catch {
      audioRestored = false;
      clips.forEach(clip => transientClips.set(clip.key, clip));
    }
  }
  render();
  showNotice(audioRestored ? "Đã nhập bản sao lưu." : "Đã nhập tiến độ. Hãy tải lại bản sao lưu trước khi đóng trang để giữ các bản ghi tạm.", !audioRestored);
}

function readRoute() {
  const [part, target] = location.hash.slice(1).split("/");
  return { view: Object.hasOwn(pages, part) ? part : "home", target };
}

let currentRoute = readRoute();

function currentLesson() {
  return currentRoute.view === "lesson" ? lessons.get(currentRoute.target) : null;
}

function render({ scroll = false } = {}) {
  const { view, target } = currentRoute;
  if (capture && !main.querySelector(`[data-record="${capture.key}"]`)) stopCapture();
  clipURLs.forEach(url => URL.revokeObjectURL(url));
  clipURLs.clear();
  trackInput.value = state.settings.track;
  document.querySelector("#view-label").textContent = pages[view];
  document.querySelectorAll("[data-nav]").forEach(link => {
    if (link.dataset.nav === (view === "lesson" ? "lessons" : view)) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  const viewHandlers = {
    home: homeView, roadmap: () => roadmapView(/^\d+$/.test(target) ? Number(target) : 0),
    lessons: lessonsView, lesson: () => lessonView(currentLesson()), assessments: () => assessmentsView(target),
    notes: notesView, settings: settingsView
  };
  main.innerHTML = viewHandlers[view]();
  const lesson = currentLesson();
  document.title = `${lesson?.title ?? pages[view]} · IELTS 6.0`;
  if (scroll) {
    const location = view === "roadmap" ? document.getElementById(`week-${target}`)
      : view === "assessments" ? [...main.querySelectorAll("[data-assessment]")].find(section =>
        section.dataset.assessment === (lessons.get(target)?.retestOf ?? target)) : null;
    const first = location ?? main;
    first.scrollIntoView({ block: "start" });
    main.focus({ preventScroll: true });
  }
  main.querySelectorAll("[data-recording]").forEach(node => loadClip(node.dataset.recording));
  const audio = main.querySelector("[data-lesson-audio]");
  audio?.addEventListener("error", () => {
    const message = document.querySelector("#audio-error");
    message.textContent = "Chưa phát được MP3. Tải lại trang hoặc kiểm tra thư mục dist/audio.";
    message.hidden = false;
  });
  refreshTimers();
}

function refreshTimers() {
  for (const row of main.querySelectorAll("[data-timer]")) {
    const saved = state.timers[row.dataset.timer];
    const count = remainingTime(saved, Number(row.dataset.minutes) * 60);
    const display = `${String(Math.floor(count / 60)).padStart(2, "0")}:${String(count % 60).padStart(2, "0")}`;
    if (row.querySelector("output").textContent !== display) row.querySelector("output").textContent = display;
    const button = row.querySelector("[data-toggle-timer]");
    const title = saved?.deadline && count > 0 ? "Tạm dừng" : saved && count > 0 ? "Tiếp tục" : "Bắt đầu";
    if (button.textContent !== title) button.textContent = title;
    button.disabled = count === 0;
    row.querySelector("[data-timer-done]").hidden = count > 0;
  }
}

function remainingTime(saved, initial) {
  if (!saved) return initial;
  return saved.deadline ? Math.max(0, Math.ceil((saved.deadline - Date.now()) / 1000)) : saved.remaining;
}

function toggleTimer(row, reset) {
  const key = row.dataset.timer;
  if (reset) delete state.timers[key];
  else {
    const saved = state.timers[key];
    const remaining = remainingTime(saved, Number(row.dataset.minutes) * 60);
    state.timers[key] = { remaining, deadline: saved?.deadline ? null : Date.now() + remaining * 1000 };
  }
  persist();
  refreshTimers();
}

function gradeQuiz() {
  const lesson = currentLesson();
  state.submissions[lesson.id] = { date: localDate(), answers: { ...state.answers[lesson.id] } };
  persist();
  lesson.groups.forEach((group, g) => group.questions.forEach((question, i) => {
    const feedback = document.getElementById(`answer-${g}-${i}`);
    feedback.innerHTML = questionFeedback(question, state.submissions[lesson.id].answers[`${g}:${i}`], true);
  }));
  const result = document.querySelector("#quiz-result");
  result.textContent = scoresText(scoreOf(lesson));
  result.hidden = false;
  result.focus();
  const transcript = document.querySelector("#audio-transcript");
  if (transcript) {
    transcript.hidden = false;
    document.querySelector("#transcript-hint").hidden = true;
  }
}

function numberFields(form, names, prefix = "") {
  const data = new FormData(form);
  return Object.fromEntries(names.flatMap(name => {
    const raw = data.get(prefix + name);
    return raw === "" ? [] : [[name, Number(raw)]];
  }));
}

function saveMock(form) {
  const id = form.dataset.mock;
  const key = mockKey(id);
  const data = new FormData(form);
  const test = data.get("test").trim();
  const date = data.get("date");
  if (!test || !dateValue(date)) {
    showNotice("Điền tên đề và ngày làm để lưu điểm.", true);
    return;
  }
  const duplicate = mockIds.some(other => other !== id
    && fold(state.results[mockKey(other)]?.test ?? "") === fold(test));
  if (duplicate) {
    showNotice("Tên đề đã có ở một mốc khác. Hãy chọn bộ đề mới hoặc nhập mã phân biệt.", true);
    return;
  }
  state.results[key] = {
    test, date, bands: numberFields(form, bands), raw: numberFields(form, ["listening", "reading"], "raw-")
  };
  const saved = persist();
  currentRoute.target = id;
  history.replaceState(null, "", `#assessments/${id}`);
  render();
  if (saved) showNotice(`Đã lưu điểm ${id}.`);
}

function saveSettings(form) {
  const start = new FormData(form).get("start");
  if (!dateValue(start) || start < "1900-01-01" || start > "9996-12-31") {
    showNotice("Chọn ngày bắt đầu hợp lệ.", true);
    return;
  }
  state.settings.start = start;
  state.settings.minimum = numberFields(form, bands, "floor-");
  if (persist()) showNotice("Đã lưu ngày bắt đầu và sàn band. Các mốc đã dời theo lịch.");
}

function saveNote(form) {
  const data = new FormData(form);
  const error = data.get("error").trim();
  const fix = data.get("fix").trim();
  const date = data.get("date");
  if (!error || !fix || !dateValue(date)) {
    showNotice("Điền lỗi, việc sẽ sửa và ngày luyện lại.", true);
    return;
  }
  state.notes.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    error, fix, date, skill: data.get("skill"), done: false });
  const saved = persist();
  render();
  if (saved) showNotice("Đã ghi lỗi và việc sẽ sửa.");
}

function updateSession(key, minutes) {
  if (minutes) state.sessions[key] = minutes;
  else delete state.sessions[key];
  persist();
}

main.addEventListener("submit", event => {
  const form = event.target;
  event.preventDefault();
  if (form.id === "quiz-form") gradeQuiz();
  if (form.id === "settings-form") saveSettings(form);
  if (form.id === "note-form") saveNote(form);
  if (form.hasAttribute("data-mock")) saveMock(form);
});

main.addEventListener("input", event => {
  const target = event.target;
  if (target.id === "lesson-search") {
    lessonFilter.query = target.value;
    document.querySelector("#lesson-results").innerHTML = lessonCards();
    return;
  }
  if (target.dataset.draft) {
    const key = target.dataset.draft;
    state.drafts[key] = target.value;
    const saved = persist();
    main.querySelector(`[data-draft-status="${key}"]`).textContent = saved ? "Đã lưu bản nháp" : "Bản nháp đang mở";
    const words = main.querySelector(`[data-words="${key}"]`);
    if (words) words.textContent = `${wordCount(target.value)} từ`;
  }
  if (target.dataset.answer) {
    const id = currentLesson().id;
    (state.answers[id] ??= {})[target.dataset.answer] = target.value;
    persist();
  }
});

main.addEventListener("change", async event => {
  const target = event.target;
  const data = target.dataset;
  if (target.id === "lesson-skill") {
    lessonFilter.skill = target.value;
    document.querySelector("#lesson-results").innerHTML = lessonCards();
  }
  if (target.id === "backup-file" && target.files[0]) {
    const file = target.files[0];
    target.value = "";
    await importBackup(file);
  }
  if ("rate" in data) main.querySelector("[data-lesson-audio]").playbackRate = Number(target.value);
  if (data.session) {
    const day = Number(data.session.split(":")[1]);
    updateSession(data.session, target.checked ? dayMinutes[day] || 90 : 0);
    const field = main.querySelector(`[data-session-minutes="${data.session}"]`);
    if (field) field.value = state.sessions[data.session] ?? "";
    else {
      render();
      main.querySelector(`[data-session="${data.session}"]`)?.focus({ preventScroll: true });
    }
  }
  if (data.sessionMinutes) {
    if (target.value !== "" && !target.checkValidity()) {
      target.reportValidity();
      return;
    }
    const key = data.sessionMinutes;
    updateSession(key, Number(target.value));
    main.querySelector(`[data-session="${key}"]`).checked = Boolean(state.sessions[key]);
  }
  if (data.makeup) {
    const week = Number(data.makeup);
    if (Number(target.value)) state.settings.makeup[week] = Number(target.value);
    else delete state.settings.makeup[week];
    openWeeks.add(week);
    const saved = persist();
    render();
    main.querySelector(`[data-makeup="${week}"]`)?.focus({ preventScroll: true });
    if (saved) showNotice("Đã cập nhật lịch các tuần và mốc đánh giá sau đó.");
  }
  if (data.rubric) {
    const key = data.rubric;
    state.checks[key] = [...main.querySelectorAll(`[data-rubric="${key}"]:checked`)].map(input => Number(input.value));
    persist();
  }
  if (data.note) {
    const note = state.notes.find(note => note.id === data.note);
    note.done = target.checked;
    persist();
  }
});

main.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;
  const data = button.dataset;
  if (data.scroll) document.getElementById(data.scroll)?.scrollIntoView();
  if ("rewind" in data) {
    const audio = main.querySelector("[data-lesson-audio]");
    if (audio.readyState) audio.currentTime = Math.max(0, audio.currentTime - 5);
  }
  if ("toggleTimer" in data || "resetTimer" in data) toggleTimer(button.closest("[data-timer]"), "resetTimer" in data);
  if (data.saveSelf) {
    state.selfScores[data.saveSelf] = state.checks[data.saveSelf]?.length ?? 0;
    if (persist()) main.querySelector(`[data-rubric-score="${data.saveSelf}"]`).textContent = selfScoreText(data.saveSelf);
  }
  if (data.record) startCapture(data.record);
  if ("complete" in data) {
    const lesson = currentLesson();
    if (state.completed[lesson.id]) delete state.completed[lesson.id];
    else state.completed[lesson.id] = localDate();
    persist();
    const end = main.querySelector(".lesson-end");
    end.outerHTML = lessonStep(lesson);
    main.querySelector("[data-complete]").focus({ preventScroll: true });
  }
  if (button.id === "backup-download") exportBackup();
  if (button.id === "backup-choose") document.querySelector("#backup-file").click();
});

main.addEventListener("toggle", event => {
  if (!event.target.dataset.week || !event.target.isConnected) return;
  const week = Number(event.target.dataset.week);
  if (event.target.open) openWeeks.add(week);
  else openWeeks.delete(week);
}, true);

trackInput.addEventListener("change", () => {
  stopCapture();
  state.settings.track = trackInput.value;
  const saved = persist();
  render();
  if (saved) showNotice(`Đã đổi sang ${tracks[state.settings.track]}. Reading và Writing Task 1 đổi từ tuần 17.`);
});

document.querySelector(".skip-link").addEventListener("click", event => {
  event.preventDefault();
  main.focus();
});

function visit() {
  currentRoute = readRoute();
  const lesson = currentLesson();
  if (lesson && inTrack(lesson) && state.lastLesson !== lesson.id) {
    state.lastLesson = lesson.id;
    persist();
  }
}

window.addEventListener("hashchange", () => {
  notice.hidden = true;
  stopCapture();
  visit();
  render({ scroll: true });
});

visit();
render({ scroll: currentRoute.view !== "home" });
if (storageProblem) showNotice("Trình duyệt chưa đọc được tiến độ cũ. Bạn vẫn có thể học và dùng bản sao lưu.", true);
if (location.protocol === "file:") showNotice("Đang mở tệp trực tiếp. Dùng localhost để thu âm và lưu tiến độ ổn định.");
setInterval(refreshTimers, 500);
