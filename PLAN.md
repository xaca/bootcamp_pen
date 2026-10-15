# Orbit Editor — Implementation Plan

A free classroom web editor for bootcamps with students aged **12–16**. Several teachers can run bootcamps at the same time, each in their own space. Teachers create a class and share a link; students start from a **blank page** and write HTML, CSS and JS (with AI help), see a live preview, save their work, and publish a shareable page. Bilingual: English and Spanish.

**Constraint: zero budget.** Everything runs on the Firebase **Spark (free) plan** — no Cloud Functions, no Secret Manager, no paid APIs. On Spark, hitting a quota pauses the service; it never produces a bill.

Stack: Vite + React + TypeScript · Firebase Spark (Auth, Firestore, Hosting, App Check) · CodeMirror 6.

---

## 1. Requirements

| Who | Can |
|---|---|
| **Teacher** | Open their **personal link** once — then the site remembers them (no account, no password), see only their own classes, create a class, share join link/QR, choose the class AI tool, watch student code live, unpublish pages, close the class |
| **Student** | Open the class link — no account, identified only by an anonymous Firebase `uid` — start from a blank page, write code in three tabs with live preview, Save, Publish → shareable URL, use AI help |
| **Hidden from students** | Doctype, `<head>`, Tailwind and GSAP imports — always loaded, never visible |
| **Languages** | Full UI, editor hints, AI prompts and friendly error messages in EN + ES |

---

## 2. One workspace (no stages)

Every student always sees the same editor: **`index.html`, `style.css`, `script.js`, the live preview and ✨ AI help**. There are no stages to unlock.

> Earlier versions had three teacher-controlled stages (1 · HTML + CSS → 2 · adds JS → 3 · adds AI) so a class could unlock features step by step. It was removed (2026-10-14) to keep things simple: the teacher guides the order in class, not the app.

### How the preview renders what students type

The preview has to show something sensible on **every keystroke**, including half-written code:

| What the student types | What happens |
|---|---|
| Unclosed tag `<h1>Hola` | Rendered (the browser closes it) |
| Half-typed attribute `<p class="text-red` | The unfinished tag is ignored until it's complete; the rest of the page and its JS keep working |
| Unclosed comment `<!--` or `<style>` | Same: it can't swallow the rest of the page |
| A full document pasted from an AI (`<!DOCTYPE html><html><head>…`) | `<head>` content (styles, `tailwind.config`) goes to the head, `<body>` to the body; Tailwind/GSAP CDN scripts are dropped because they're already loaded |
| Tailwind v3 classes, `md:`/`hover:` variants, arbitrary values `bg-[#123456]`, `tailwind.config` custom colors | Work (Tailwind v3 Play CDN build is preloaded) |
| Plain HTML without classes: `<h1>`, `<a>`, `<ul>`, `<button>` | Looks like normal HTML: big bold headings, blue underlined links, bullets, visible buttons (see "Beginner base styles") |
| Classes on a pasted `<html>` / `<body>` (`class="bg-gray-100"`) | Kept |

How:

1. **Tidy the HTML first.** `normalizeHtml()` runs the student's HTML through the browser's own parser (`DOMParser`) and splits it into head and body parts.
2. **Libraries load in the `<head>`,** before any student HTML, so nothing typed can block Tailwind or GSAP.
3. **Beginner base styles.** Tailwind's reset (Preflight) makes plain HTML look broken: `<h1>` becomes normal text, links lose their color and underline, lists lose bullets, buttons look like text. A small `<style type="text/tailwindcss">` with `@layer base` puts the browser's usual look back. Headings always get their normal size and weight; spacing, link, list and button styles apply only to elements **without a `class`**, so Tailwind-built pages (`<ul class="flex">`, `<a class="text-white">`) keep Tailwind's look. Being in the lowest layer, any Tailwind class still wins.
4. **No flashing, no jumping.** Each change renders in a hidden frame; it replaces the visible one only after it has loaded and painted, with the scroll position restored. Updates are debounced 400 ms while typing.

---

## 3. Architecture

```
React SPA (Vite + TS) ─ react-i18next (en/es)
  ├── /teacher        dashboard (+ /teacher/join/:code invite, /t/:key personal link)
  ├── /c/:joinCode    student join + editor
  └── /p/:slug        published page (separate lightweight entry, sandboxed)
        │
Firebase Spark (free)
  ├── Auth            Anonymous only (teachers and students); no Google, no email
  ├── Firestore       teachers, classes, students, projects, published
  ├── Hosting         SPA + public/vendor (Tailwind, GSAP)
  └── App Check       reCAPTCHA v3 (free)
```

No server code. **All authorization lives in Firestore security rules.**

### Hidden wrapper

One function builds the document for both the editor preview and the published page, so they always match:

```ts
const buildDoc = ({ html, css, js }: Code) => {
  const { head, body } = normalizeHtml(html)   // tidy + split what the student typed
  return `<!doctype html>
<html><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <script src="/vendor/tailwind.js"></script>          <!-- Tailwind v3 Play CDN build -->
  <script src="/vendor/gsap.min.js"></script>
  <script src="/vendor/ScrollTrigger.min.js"></script>
  ${head}
  <style>${css}</style>
</head><body>
  ${body}
  <script>${guardLoops(js)}</script>
</body></html>`
}
```

---

## 4. Identity (no accounts for anyone)

Teachers and students are all signed in with Firebase **Anonymous Auth**. Nobody uses Google, email or passwords.

### 4.1 Teachers: a personal link, nothing to remember

A teacher is busy with 30 students. Getting into the dashboard must take **one click and zero memory**: no code to write down, no PIN to type, no password to reset.

**The idea:** each teacher gets a **personal access link**, like `https://editorweb-29040.web.app/t/k7Qm4tZp9xR2vB8nW3cY`. Opening it on any computer signs them in. The browser remembers them, so after the first time they just open the site.

| When | Who | What they do |
|---|---|---|
| **Setup (once per bootcamp)** | Organizer | Shares one **teacher invite link** (e.g. `…/teacher/join/ORBIT-BOOTCAMP-2026`) in the teachers' WhatsApp group. |
| **First time** | Teacher | Opens the invite link → types **their name** → **Start**. They're in the dashboard. Nothing else to fill in. |
| **Keep your link** (shown once, right after) | Teacher | "Save your personal link for other computers": **Send to my WhatsApp**, **Email it to me**, **Copy**, or a **QR** to scan with their phone. One tap, then **Continue**. Can be reopened anytime from **My link** in the dashboard. |
| **Every next time, same computer** | Teacher | Open the site → **Teacher** → already in. |
| **Another computer** | Teacher | Open their personal link (from WhatsApp/email/bookmark) → in. |
| **Lost the link** | Organizer | Finds the teacher by name in Firestore (`teacherKeys`) and resends the link. |

**What the teacher never does:** invent or type a password, remember a code, type the registration code, or repeat a PIN.

**Projector safety:** the dashboard is often projected. As soon as the personal link opens, the address bar changes to plain `/teacher`, so the secret never shows on screen. The link is only shown again if the teacher clicks **My link**.

**How it works without a server:**

- The secret in the link is a random **access key** (20 characters, ~100 bits). Holding it is the proof; it's far harder to guess than a code + 6-digit PIN, so no lock-out is needed.
- Opening the link writes a **session** for the browser's anonymous `uid`; the rules accept it only if that access key exists and points to this teacher space. Everything else (teacher permissions, separate spaces, classes storing only the internal `teacherId`) stays exactly as today.
- The invite link carries the **registration code**, so only people the organizer invited can create a teacher space. Teachers never type it.
- **Exit** on a shared computer removes that browser's session; the personal link still works elsewhere.

**Replaced (2026-10-14):** teacher code (e.g. `MARIA-7K2Q9P`) + 6-digit PIN + typed registration code. Teacher spaces created that way can't be entered anymore; create them again with the invite link. Their old `teacherLogins`/`teacherSecrets` documents can be deleted in the console.

**If someone else is signed in on the computer** when a teacher opens the invite link, the app asks: *Go to María's dashboard* or *I'm someone else* (signs María out on this computer first).

### 4.2 Students: anonymous uid

- Opening `/c/:joinCode` signs the student in anonymously. The `uid` is the student's only identity; it is stored in the browser and reused on every visit from the same device and browser.
- At join the student types a **display name** (first name or nickname). It's just a label so the teacher can recognise the project and the published badge can say "Made by Ana" — not an account.
- **Lost `uid`** (cleared browser, incognito, different computer): the student joins again and gets a new `uid`; the teacher can **move** the old work to the new entry from the dashboard.
- Use the same computer and normal (non-incognito) browser window each class.

### 4.3 Guide: reopening a session

Nobody has a password, so "your session" is **the browser you used**. It is kept automatically.

**Student — same computer and browser (normal case)**

1. Open the class link again (or go to the site, type the class code, **Join class**).
2. The editor opens straight away with the last saved work. No name is asked again.
3. This works even if the teacher has **closed** the class (closing only blocks new students and publishing).

What is saved: everything up to the last **Save**, `Ctrl/Cmd+S`, autosave (at most once a minute) or switching tabs. The page warns before closing with unsaved changes.

**Student — different computer, cleared browser or private window**

1. Open the class link and join again **with the same name**. The editor starts empty.
2. Tell the teacher. In the dashboard the student now appears twice.
3. Teacher: on the **old** entry, click **Move work** → choose the **new** entry → **Move work**.
4. The recovered work appears in the student's editor within a few seconds (no reload needed), with a short notice. The published link (if any) keeps working.

**Teacher — reopening the dashboard**

- Same browser: open the site → **Teacher**; you stay in until you click **Exit**.
- Another computer: open your **personal link** (the one you sent to your WhatsApp/email, or scan its QR).
- Lost the link: ask the organizer to resend it.

**Tips to avoid lost sessions:** same computer every class, normal (not private) window, don't clear browsing data during the bootcamp, and use **Save** before leaving.

### 4.4 Guide: following student progress (teacher)

1. Go to `/teacher` → click the class.
2. The **Students** table updates live — no need to reload. The header shows how many are active now; sort by **last activity** (default) or **name**:

| Column | What it tells you |
|---|---|
| **Student** | Name typed at join. **Green dot** = active now (saved in the last 2 minutes). **✨ AI** tag = the last change came from AI help. |
| **Last save** | "just now", "3 minutes ago"… Saves happen on Save, `Ctrl/Cmd+S`, tab switch, or autosave (≤ 1 min), so it can lag up to a minute behind the student's screen. |
| **Progress** | Non-empty lines written per file: `HTML 24 · CSS 10 · JS 3`. |
| **Page** | **Open ↗** once the student has published; "—" means not published yet. |

3. **View code** opens the student's three files (read-only) next to a live preview. It refreshes by itself every time the student saves — handy on a projector.
4. Other actions per student: **Unpublish** (remove a page), **Move work** (recover a lost session, see 4.3), **Remove** (delete the student and their work).
5. Class controls: **open/close** the class, change the **AI tool** or **default language**, show the **join link / QR**.
6. The **? Help** link in the dashboard header shows this guide in the app (EN/ES).

### 4.5 Staff guide (`/guide`, password 1041)

The home page has a link **📘 Instructions for teachers and mentors**. It opens `/guide`, which asks for the password **1041** and then shows a step-by-step guide in EN/ES:

| For | Sections |
|---|---|
| **Teachers and mentors** | 1. Enter your dashboard · 2. Create a class and let students in · 3. During the class · 4. Common student questions (closed tab, other computer, page link, broken page, lost changes) · 5. End of class |
| **Bootcamp admin** | A. Before the bootcamp (reset, registration code, invite link, rehearsal) · B. During (lost teacher link, unpublish, daily limit) · C. After |

- The password is a **soft lock** to keep students out of staff instructions. It lives in the app's code, so it is not real security: the guide never contains secrets (the teacher invite link and registration code are *not* in it — the admin shares them in the teachers' group).
- Once unlocked, the guide stays open until the browser tab is closed (`sessionStorage`).
- The in-dashboard **? Help** (section 4.4) stays as the quick version for teachers.

### 4.6 Resetting Firestore before a bootcamp

Run from a computer with the project and the Firebase CLI logged in (`firebase login`):

| Command | Deletes | Keeps |
|---|---|---|
| `npm run reset:classes` | classes (+ students), projects, published pages | teacher spaces and their personal links, `config/registration` |
| `npm run reset:all` | everything above + teacher spaces (`teachers` + sessions, `teacherKeys`, `teacherInvites`, old `teacherLogins`/`teacherSecrets`) | `config/registration` |

- The script lists what it will delete and asks you to **type the project name** (`editorweb-29040`) to confirm; `-- --yes` skips the question (for automation).
- It uses `firebase firestore:delete <collection> --recursive` per collection — never `--all-collections`, which would also delete the registration code.
- Deletes count toward Spark's **20,000 deletes per day**; a typical bootcamp (a few classes × 30 students) is far below that.
- Published pages are deleted too: collect the links you want to keep before resetting.

### 4.7 Home page: a real welcome

Before, `https://editorweb-29040.web.app` only showed "Build your web page", a class-code box and "I'm a teacher" — it didn't say what Orbit is or who should click what. The home page now looks like this (`src/home/HomePage.tsx`):

```
┌──────────────────────────────────────────────────────────────┐
│ 🪐 Orbit                                           ES | EN    │
│                                                              │
│  Build your first web page                                   │
│  A free classroom editor: HTML, CSS and JavaScript, with     │
│  Tailwind and GSAP ready to use. Publish and share your page.│
│                                                              │
│ ┌─ 🎒 I'm a student ───────────┐ ┌─ 👩‍🏫 I'm a teacher ─────┐ │
│ │ ▶ Continue in "Orbit Club"   │ │ Open your dashboard →    │ │
│ │   (if you joined before)     │ │ First time? Open the     │ │
│ │ 1. Ask your teacher for the  │ │ invite link your admin   │ │
│ │    class code                │ │ shared.                  │ │
│ │ 2. Type it here: [K7QM-4TZP] │ ├──────────────────────────┤ │
│ │ 3. Write your name and start │ │ 📘 Staff guide (1041) →  │ │
│ │ [ Join class ]               │ │ For teachers, mentors    │ │
│ │ Use the same computer every  │ │ and the admin.           │ │
│ │ class to keep your work.     │ └──────────────────────────┘ │
│ └──────────────────────────────┘                              │
│      Free classroom editor · made for bootcamps               │
└──────────────────────────────────────────────────────────────┘
```

- **Two clear doors**: 🎒 students (left, biggest) and 👩‍🏫 teachers + 📘 staff guide (right). On phones they stack.
- **"Continue in <class>"**: the browser remembers the last class it joined (`localStorage`), so a student who closed the tab clicks one button — no link or code needed.
- **Three numbered steps** for students, and a reminder to use the same computer.
- **Teachers**: one button to the dashboard plus where to find the invite link; the staff guide link sits right below.
- **Student top bar shows the class code** (e.g. `K7QM-4TZP`) so students can write it down.
- EN/ES like the rest of the app.

---

## 5. AI help at zero cost

Paid AI APIs need a server to hide the key and cost money per request, so the editor does **not** call an AI API. Students use the **free web chat of the class's AI tool** through a copy/paste bridge.

### 5.1 One AI tool per class

The teacher picks one: `aiTool: "gemini" | "chatgpt"`.

| Tool | Opens | Note (teacher verifies current terms) |
|---|---|---|
| **Gemini** | gemini.google.com | 13+; needs a Google account |
| **ChatGPT** | chatgpt.com | 13+; under 18 needs parental consent |

**Age rule in class:** students **13 or older** use the AI themselves. Students **under 13 work in pairs** with a classmate who is 13+: they share one computer and one project, and the 13+ partner operates the AI chat. The pair joins once with both names as the display name (e.g. "Ana y Luis"). The app never asks for or stores ages.

### 5.2 ✨ AI bridge (copy prompt → paste answer)

1. Student types a request ("haz que mi título aparezca suavemente").
2. App generates a complete prompt in the student's language: the rules (Tailwind and GSAP already loaded, no `<script>`/`<head>`, simple commented code, answer in exactly three fenced blocks `html` / `css` / `js`) + the student's current code + the request.
3. **Copy prompt** → **Open Gemini / ChatGPT** (new tab) → paste → copy the answer → **Paste answer** back.
4. App extracts the code blocks, shows a diff → **Apply** / **Discard** → Undo available.

---

## 6. Decisions

1. **Sandbox all student and AI code.** Preview and published page use `<iframe sandbox="allow-scripts">` — never `allow-same-origin`.
2. **No accounts for anyone.** Students: anonymous `uid` + display name. Teachers: anonymous `uid` + a personal access link (no password), giving each teacher a separate space (see section 4).
3. **CodeMirror 6** (`@uiw/react-codemirror`), not Monaco — lighter, works on tablets/Chromebooks.
4. **Save + quota-friendly autosave.** Save button and `Ctrl/Cmd+S`; autosave at most every 60 s **only if content changed**, plus on tab hide/close. Never write on every keystroke.
5. **Self-host Tailwind v3 (Play CDN build) and GSAP** in `public/vendor/` with pinned versions — school networks often block CDNs. Tailwind **v3**, not v4, because Gemini and ChatGPT write pages for the v3 CDN, including `tailwind.config = {...}` for custom colors and fonts; v4 crashes on that (`tailwind is not defined`). Students and the AI can put `tailwind.config` at the top of `script.js`.
6. **Infinite-loop protection.** Loop guards injected into student JS; Run/Stop toggle.
7. **Teacher moderation.** Closing a class freezes publishing; teacher can unpublish. ASCII slugs: `orbit-club-jose-7k2`.
8. **AI code needs Apply.** Every AI change is a diff the student accepts; `lastChangeSource` records `"student" | "ai"`.
9. **Rules are the backend.** Every permission (class settings, publishing, moving work) is enforced in `firestore.rules`, tested with the Firestore emulator.
10. **Translate comments, not code.** Hints and prompts follow the student's language; keywords stay English.
11. **Start from a blank page.** New projects have empty `html`, `css` and `js`. Empty editors show a localized placeholder hint (e.g. "Escribe tu primer `<h1>` aquí…") that is display-only and never saved. The preview shows a friendly empty state until the student types.
12. **Friendly console.** Iframe errors forwarded via `postMessage`; common ones mapped to friendly EN/ES text.

---

## 7. Spark quota budget

Free daily limits (Firestore): **50K reads, 20K writes, 20K deletes, 1 GiB stored**. Hosting: **10 GB stored, 360 MB/day transfer**.

Estimate for one class of 30 students, 2-hour session:

| Item | Estimate | Limit |
|---|---|---|
| Autosave + saves (≤ 1/min/student while editing) | ≤ 3,600 writes | 20K writes |
| Teacher live grid (1 read per student save) | ≤ 3,600 reads | 50K reads |
| Student joins, loads, publishes | < 500 ops | — |
| Published page views | 1 read each | 50K reads |
| App bundle + vendor (~1 MB × 30 students) | ~30 MB | 360 MB/day |

→ Comfortably fits **3–4 classes per day**. Guardrails:

- Teacher grid listens to the class's `projects` (one read per student save). The web SDK can't fetch only some fields, and the read count is the same either way.
- `/p/:slug` is a separate small entry (no React editor, no CodeMirror) to save bandwidth.
- Enable Firestore offline persistence so reloads read from cache.
- Code size limit: 100 KB per file.
- Show a friendly "Daily free limit reached, try again tomorrow" message if Firestore returns `resource-exhausted`.

---

## 8. Bilingual (EN/ES)

- `react-i18next` with `src/locales/en.json` and `src/locales/es.json`; all UI strings via `t()`.
- Class `defaultLang`; per-student toggle saved on the student doc.
- Editor hints and AI prompt templates stored in both languages.
- Published badge localized ("Made by Ana" / "Hecho por Ana").
- Slugs strip accents: "José Pérez" → `jose-perez-7k2`.

---

## 9. Firestore data model

```
config/registration               created by the organizer in the console; no browser can read it
  code

teacherKeys/{accessKey}           get by exact key only (no listing) — the key IS the secret
  teacherId, name                   (Phase 8; replaces teacherLogins + teacherSecrets)

teacherInvites/{accessKey}        no browser can read it; only the rules
  registrationCode                  proves the space was created from the organizer's invite link

teachers/{teacherId}              teacherId is random and internal
  name, createdAt

teachers/{teacherId}/sessions/{uid}   one per browser where the teacher entered
  accessKey, createdAt

classes/{classId}                 classId IS the join code, e.g. "K7QM-4TZP"
  teacherId, title, isOpen, defaultLang: "es" | "en"
  aiTool: "gemini" | "chatgpt"
  createdAt

classes/{classId}/students/{uid}
  displayName, lang, joinedAt

projects/{classId}_{uid}
  classId, ownerUid, teacherId, studentName, html, css, js
  updatedAt, publishedSlug | null, lastChangeSource: "student" | "ai"

published/{slug}
  html, css, js, classId, ownerUid, teacherId, studentName, classTitle, lang, publishedAt
```

`published` is a frozen snapshot: students keep saving without changing the live page; re-publishing overwrites the same slug. Slug creation uses a create-only rule to avoid collisions.

### Security rules (summary)

- **Teacher check** used everywhere: `exists(teachers/{class.teacherId}/sessions/{request.auth.uid})`.
- `config`, `teacherInvites`: never readable by browsers.
- Creating a teacher space (one batch: `teacherKeys`, `teacherInvites`, `teachers`, first session): allowed only if the registration code carried by the invite link matches `config/registration`, and the key is new and ≥ 20 characters.
- `teachers/{id}/sessions/{uid}`: created only for your own `uid`, only when `accessKey` exists in `teacherKeys` and points to this `teacherId`. Readable and deletable ("Exit") only by that `uid`.
- `classes`: created only by a teacher session (with their `teacherId`); `get` by any signed-in user (the join code is the doc id); `list` only your own space's classes.
- `students`, `projects`: a student (`request.auth.uid`) writes only own docs; the class's teacher reads all. Moving work = the teacher copies the code into the new uid's project and deletes the old entry. `teacherId` is stored on projects so the teacher's list query can be authorized.
- Students **cannot** change class settings (`aiTool`, `isOpen`…) or another student's data.
- `projects` writes rejected when any of `html`/`css`/`js` exceeds 100 KB.
- `published`: public read; owner create/update only while class `isOpen`; teacher can delete.

---

## 10. Phases

| # | Phase | Scope | Est. |
|---|---|---|---|
| 0 | **Setup** | Install `firebase react-router react-i18next i18next @uiw/react-codemirror @codemirror/lang-html @codemirror/lang-css @codemirror/lang-javascript`; enable Auth (Anonymous), Firestore, Hosting, App Check on Spark; Firebase emulators; i18n scaffolding; vendor Tailwind + GSAP; routes | ½ day |
| 1 | **Editor** | Split view (preview left, tabs right), CodeMirror dark theme, sandboxed preview with debounce, loop guards, Run/Stop, friendly console, always three tabs | 2 days |
| 2 | **Student flow** | Join → anonymous auth → display name → language → load project or create an empty one; Save + autosave + Ctrl+S; Publish modal with URL + QR | 1 day |
| 3 | **Teacher dashboard** | Teacher entry, classes CRUD, AI tool picker, live student grid, read-only code viewer, move work, unpublish, close class | 2 days |
| 4 | **AI bridge** | Prompt generator (EN/ES), "Open Gemini / ChatGPT" button, paste-answer parser, diff + Apply/Undo | 1 day |
| 5 | **Rules, polish & test** | Security rules + emulator tests, `/p/:slug` light entry + badge, quota error handling, verify both languages, test on school devices, deploy | 1 day |

| 6 | **Teacher PIN access** (replaces Google sign-in) | `config` / `teacherLogins` / `teacherSecrets` / `teachers` / `sessions`; rules rework (`teacherUid` → `teacherId`); "New teacher" and "Enter" screens; Exit; rules tests for PIN checks and teacher separation | 1 day |

| 7 | **Sessions & progress polish** | Student editor picks up moved work automatically (listen to the project doc instead of a one-time load) · "Last save" shown as relative time ("2 min ago") with an **active now** dot (saved < 2 min ago) · sort students by last activity · line count per file as a simple progress hint · teacher **Help** link to the guides in 4.3/4.4 (EN/ES) | 1 day |

| 8 | **One-click teacher access** | Invite link (`/teacher/join/:code`) → name only → in; personal link `/t/:key` (signs in, then the URL becomes `/teacher`); "Keep your link" screen with WhatsApp / email / copy / QR; **My link** in the dashboard; rules: `teacherKeys` + `teacherInvites`, drop PIN checks; update Help guide and rules tests | 1 day |

| 9 | **Welcome home page** | New home (section 4.7): intro, student and teacher doors, numbered steps, "Continue in <class>" (remember last class), staff guide link; class code in the student top bar; EN/ES; check on phone and desktop | ½ day |

**Total: ~11 working days for an MVP. Running cost: $0.**

---

## 11. Later versions (not in v1)

- **🧩 Snippet library** — ready-made Tailwind components and GSAP animations (EN/ES) students insert with Apply/Undo.
- **Optional stages** — if teachers ask for it again: unlock JS and AI help step by step per class.
- **Student return link** — a personal link (like the teacher's) so a student can reopen their work on any computer without the teacher's "Move work".
- **Class gallery** — one page showing every published page of a class, for the end-of-bootcamp showcase.
- **Automatic AI** — a free-tier serverless proxy + free-tier AI API to skip the copy/paste step, if a free option proves reliable.

---

## 12. Implementation status (2026-10-14)

Phases 0–9 are implemented in code (teachers enter with a personal link, no password), plus the staff guide (4.5), the reset scripts (4.6) and the welcome home page (4.7), plus the single-workspace simplification and the rendering improvements in section 2. There is no Google sign-in. Site and security rules are deployed to `editorweb-29040` (2026-10-14), including the staff guide and the welcome home page.

| Area | Where |
|---|---|
| Hidden wrapper, loop guards, console bridge | `src/shared/buildDoc.ts`, `src/shared/loopGuard.ts` |
| AI prompt + answer parser | `src/shared/aiPrompt.ts` |
| Firestore reads/writes | `src/data/db.ts` |
| Student join + editor | `src/student/` |
| Staff guide (password 1041) | `src/guide/GuidePage.tsx` |
| Firestore reset | `scripts/reset-firestore.mjs` (`npm run reset:classes`, `npm run reset:all`) |
| Teacher personal link + invite | `src/teacher/TeacherPage.tsx`, `TeacherJoin.tsx`, `TeacherWelcome.tsx`, `MyLink.tsx`, `src/data/db.ts` (teacher functions) |
| Progress (relative time, active dot, lines) + Help guide | `src/teacher/progress.ts`, `src/teacher/ClassDetail.tsx`, `src/teacher/HelpModal.tsx` |
| Teacher dashboard | `src/teacher/` |
| Published page (no React) | `published.html`, `src/published/main.ts` |
| Security rules + tests | `firestore.rules`, `tests/firestore.rules.test.ts` |
| Translations | `src/locales/en.json`, `src/locales/es.json` |

Notes:

- GSAP's **ScrollTrigger** plugin is also preloaded and registered (useful for landing pages).
- **Fixed (2026-10-14): AI pages needed the Tailwind CDN.** The app preloaded Tailwind v4, but AI-generated pages use the v3 CDN and `tailwind.config`. Now Tailwind v3.4.17's Play CDN build is vendored in `vendor/` (it isn't on npm) and served as `/vendor/tailwind.js`. The AI prompt says "Tailwind v3"; when the AI returns a full HTML document, its `<head>` styles move to `style.css` and its `tailwind.config` to `script.js`. Tailwind's "not for production" warning is hidden from the student console.
- Firebase is pinned to v12 because `@firebase/rules-unit-testing` doesn't support v13 yet.
- **Fixed (2026-10-14): blank `/teacher` page** — `Component auth has not been registered yet`. Two copies of `@firebase/app` were installed (0.16.2 pinned by `firebase@12.19.0`, 0.16.3 pulled in by the other Firebase packages), so Auth registered on a different app instance. Fix: `"overrides": { "@firebase/app": "0.16.2" }` in `package.json`, plus `optimizeDeps.include` for all Firebase entries in `vite.config.ts`. When upgrading Firebase, update or remove the override so it matches the version `firebase` pins.
- Unit tests (`npm test`) pass. The rules tests (`npm run test:rules`) need Java for the emulator and have not been run yet.
- **Simplified (2026-10-14): no stages.** Removed the stage switcher, per-student overrides and the `stage`/`stageOverride` fields (rules too). Existing classes keep an unused `stage` field; that's harmless.
- **Improved (2026-10-14): rendering.** Before, half-typed HTML (`<p class="text-red`, an unclosed `<!--` or `<style>`) swallowed the hidden scripts after it, so GSAP or the student's JS stopped working. Fixed with `normalizeHtml()` + libraries in the head, and the preview now swaps frames without flashing and keeps the scroll position. Verified in Chrome with six typing scenarios and the real `Preview` component.
- **Fixed (2026-10-14): plain `<h1>` and links looked unstyled.** Caused by Tailwind's Preflight reset; fixed with the beginner base styles (section 2). Also: classes on a pasted `<html>`/`<body>` were dropped; now kept. Verified in Chrome with plain HTML, a Tailwind/AI-style page and a full document.
- Verified locally against the live Firebase project (teacher PIN, classes, students).
