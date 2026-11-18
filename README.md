# CLAT GK · Current Affairs Desk

A practice site for the Current Affairs & General Knowledge section of CLAT. Questions come in passage sets the way the real paper sets them: one passage, then the 4–6 questions on it.

- **1,155 verified questions** from 43 mock papers, each with an explanation and a source.
- **Quizzes** of 10, 15 or 20 questions, as whole passage sets or mixed, filtered by topic. A CLAT-pace timer is optional.
- **Exam tools:** question palette, mark for review, bookmarks, keyboard shortcuts (press `?` in a quiz), and autosave that survives a refresh.
- **Results** use CLAT marking (+1 / −0.25), with a by-topic breakdown and a full review grouped by passage.
- **Revision** keeps every wrong answer in a mistake log. Practise just those; a question moves to *Learned* once you get it right.
- **Analytics** shows the score trend, accuracy by topic and time per question, and suggests what to practise next.

No backend. All progress is kept in the browser (`localStorage`), and Settings can export or import it as JSON.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (node:test)
npm run validate   # checks the question bank's integrity
npm run build      # production build into dist/
npm run preview    # serve the build
```

Node 18 or newer.

## Deploy on Vercel

Import the repository in Vercel. The settings come from `vercel.json`:

- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`

You don't need environment variables or rewrites: the app uses hash routes (`#/practice`, `#/revision/…`), so every URL is served by `index.html`. Hashed assets are cached as immutable, and `questions.json` is revalidated on every request, so an updated bank shows up straight away.

## Project layout

```
src/
  App.jsx              loads public/questions.json, hash routing
  pages/               Dashboard, Practice, Quiz, Results, Revision, Analytics, Settings
  components/          Shell (navigation), Charts (SVG), ui primitives, icons
  lib/                 quiz selection & scoring, storage store, analytics, router
public/questions.json  the live bank (verified questions only)
data/                  extraction output, answer research, the full bank
scripts/               Python pipeline (PDF → JSON → bank) and the bank validator
tests/                 unit tests
```

## Rebuilding the question bank

The mock PDFs are not in this repository. If you have them in the parent folder:

```bash
python3 scripts/extract.py .. data/raw_extraction.json     # PDF text and OCR (needs tesseract)
python3 scripts/finalize_extraction.py                     # → data/extracted.json
python3 scripts/build_bank.py                              # → data/bank_full.json, public/questions.json
npm run validate
```

Answers, explanations and sources live in `data/answers/<mock>.json`. Only questions marked `verified` go live.

## Content note

The question text is taken from third-party CLAT mock papers and is used here for personal exam practice. The explanations and sources were researched separately.
