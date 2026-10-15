# Orbit Editor

A free classroom web editor for students aged 12–16. Several teachers can run bootcamps at the same time, each in their own space. Teachers create a class and share a link; students write HTML, CSS and JS (Tailwind and GSAP are preloaded but hidden), save their work and publish a shareable page. English and Spanish.

Runs entirely on the Firebase **Spark (free)** plan — no server code. See [PLAN.md](PLAN.md) for the full design.

## One-time Firebase setup

In the [Firebase console](https://console.firebase.google.com/project/editorweb-29040):

1. **Authentication → Sign-in method**: enable **Anonymous**. Nobody uses Google or email — teachers and students are both anonymous.
2. **Firestore Database**: create the database (production mode).
3. **Registration code for teachers**: in Firestore, create a collection `config` with a document `registration` and a string field `code` (e.g. `ORBIT-BOOTCAMP-2026`, the longer the better). Then share the **teacher invite link** with your teachers: `https://editorweb-29040.web.app/teacher/join/ORBIT-BOOTCAMP-2026`.
4. Deploy the security rules and the site:

   ```bash
   firebase login
   npm run deploy        # builds, then deploys Hosting + Firestore rules
   ```

Optional: to enable **App Check**, create a reCAPTCHA v3 key, put it in `.env.local` as `VITE_RECAPTCHA_SITE_KEY` (see `.env.example`), register it in Firebase → App Check, and only then turn on enforcement.

## Development

```bash
npm install
npm run dev          # http://localhost:5173  (copies Tailwind v3/GSAP into public/vendor first)
npm test             # unit tests
npm run test:rules   # security rules tests (Firestore emulator, requires Java)
npm run lint
npm run reset:classes   # before a bootcamp: delete classes, students, projects, published pages
npm run reset:all       # same + teacher spaces (keeps config/registration); asks for confirmation
```

Staff instructions for teachers, mentors and the admin are in the app at `/guide` (home page → "Instructions for teachers and mentors", password `1041`).

## Teachers: one personal link, no password

- **First time**: open the invite link → type your name → **Start**. Then save your **personal link** (Send to my WhatsApp / Email it to me / Copy / QR).
- **Next times**: same computer → open the site → Teacher (already in). Another computer → open your personal link.
- **Lost link**: in Firestore, the `teacherKeys` collection lists every teacher by `name`; the document id is their key. Their link is `https://editorweb-29040.web.app/t/<document id>`.
- When the personal link opens, the address bar changes to `/teacher`, so the key never shows on a projector.

## Routes

| Route | Who | What |
|---|---|---|
| `/` | everyone | Enter a class code or go to the teacher dashboard |
| `/teacher` | teachers (personal link) | Create classes, follow students |
| `/teacher/join/:code` | new teachers | Invite link from the organizer: type your name, get your personal link |
| `/t/:key` | a teacher | Personal link: signs this browser in, then shows `/teacher` |
| `/guide` | teachers, mentors, admin | Staff guide (password `1041`) |
| `/c/:code` | students (anonymous) | Join with a name, then the editor |
| `/p/:slug` | public | A published page |

## The student editor

One workspace for everyone: `index.html`, `style.css`, `script.js`, a live preview and ✨ AI help (copy prompt → Gemini/ChatGPT → paste answer → review diff → Apply). Tailwind CSS v3 and GSAP are preloaded and hidden.
