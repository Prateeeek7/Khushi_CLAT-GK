# CLAT GK Quiz — Progress

_Last updated: 2026-11-18 (session 7: UI rebuild + Vercel deploy)_

A React + Vite quiz website that serves random 10/15/20-question quizzes from the
**Current Affairs including General Knowledge** sections of the LegalEdge CLAT/AILET 2027 mock
PDFs in `/Users/pratikkumar/Desktop/CLAT/`. It has no backend. The question bank is a static JSON
file (`public/questions.json`) that the app fetches.

## Quick start
```bash
cd /Users/pratikkumar/Desktop/CLAT/quiz-project
npm install          # first time only
npm run dev          # http://localhost:5173
npm run build        # production build -> dist/
npm run validate     # structural checks on public/questions.json
npm test             # unit tests for quiz selection, scoring, storage, analytics
```

Repo: https://github.com/Prateeeek7/Khushi_CLAT-GK (repo root = this `quiz-project` folder; the PDFs are
not in it). Deploy: import into Vercel. `vercel.json` sets Vite, `npm run build` and `dist`; hash routing means no
rewrites are needed.

## Layout
```
quiz-project/
  scripts/extract.py             PDF -> raw JSON (CA&GK section only; tesseract OCR for scanned pages)
  scripts/finalize_extraction.py raw JSON -> data/extracted.json (mock ids/names, de-dup, watermark cleanup)
  scripts/build_bank.py          data/extracted.json + data/answers/*.json -> public/questions.json
  scripts/validate-bank.mjs      structural checks (npm run validate)
  scripts/report.py              writes data/EXTRACTION_REPORT.md (per-mock completeness + answer status)
  scripts/show_mock.py           prints one mock's questions for answer research
  data/raw_extraction.json       raw extractor output (kept so OCR does not need re-running)
  data/extracted.json            all extracted questions + passages: the source of truth for question text
  data/answers/<mockId>.json     researched answers, explanations, sources (one file per mock)
  data/EXTRACTION_REPORT.md      per-mock table: expected vs extracted, text quality, answer status
  public/questions.json          generated bank the website loads (do not edit by hand)
  scripts/categorize.py          keyword topic classifier (8 categories) used by build_bank.py
  src/App.jsx                    loads the bank, hash routes
  src/pages/                     Dashboard, Practice, Quiz, Results, Revision, Analytics, Settings
  src/components/                Shell (sidebar / mobile tab bar), Charts (hand-rolled SVG), ui, Icon
  src/lib/                       quiz.js (passage-set selection, scoring), storage.js + store.js
                                 (localStorage key `clatgk:v1`), session.js, analytics.js, router.js
  tests/lib.test.mjs             node:test unit tests
```

## Completed (session 1)
### Priority 1: PDF extraction (done)
- 96 PDFs in the folder reduce to **61 unique files** (SHA-1 de-dup). Three are answer keys (`(AK)`), and two
  scanned copies duplicate text PDFs (Mock 11 (1), Mock 12 (1); question text was compared). That leaves
  **56 unique mock papers**.
- Each paper's CA&GK question range comes from its contents page (e.g. `Current Affairs and General
  Knowledge 25-52`; AILET is 51–80; AILET Mock 06 is 131–150; CLAT Mock 11 is 51–78).
- Extraction starts at the CA&GK `SECTION` heading and stops at the next `SECTION` heading, so no
  questions from other sections leak in. Questions are matched by sequential numbering.
- Passages are preserved: `Passage (Q.x-Q.y): Title` (CLAT style), roman-numeral headings (AIOM style)
  and `Passage: (Q.x-Q.y)` variants. Each question links to its passage via `passageId`.
- Result: **all 1,584 expected questions extracted** (see `data/EXTRACTION_REPORT.md`). CLAT Mock 09's OCR was
  unusable, so its CA&GK section was hand-transcribed from page images into `data/manual/clat-mock-09.json`;
  `finalize_extraction.py` substitutes any `data/manual/<mockId>.json` for the OCR output.
- Watermarks (`Toprankers.com tr-…`) and page furniture (`USE FOR ROUGH WORK`, etc.) are stripped.
  Option markers ignore `(a)` that occurs inside text such as `Article 19(1)(a)` or `51A(a)`.

### Priority 2: Question bank (partly done)
- Schema per question: `id, mock, mockId, number, passageId, question, options[4], answer (a-d),
  explanation, sources[{title,url?}], status`.
- `status` values: `verified` (served in quizzes), `needs_review` (answer drafted, a fact is not fully
  confirmed), `unanswered`, `ocr_review` (scanned paper whose text must be proof-read first),
  `broken` (extraction gap). **Only `verified` questions are served.**
- **Answered so far (43 mocks = every CLAT paper; 1,155 verified, 49 needs_review):**
  `clat-real-mock-01, clat-mock-02, 03, 04, 05, 06, 08, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26,
  27, 28, 29, 30, 31, 32, 33, 34, 35, 38, 39, 40, 41, clat-aiom-mock-01, 02, clat-bootcamp-mock-01, 37,
  clat-additional-mock-01, and the scanned clat-mock-09 (manual transcription) and clat-mock-10 (OCR text
  corrected through `question`/`options`/`_passages` overrides in its answer file)`.
- **AILET mocks are intentionally skipped (user decision, session 5).** Their questions stay in the bank as
  `unanswered`, so they are never served. Answer them later only if the user asks. Each answer was checked against
  standard references (Constitution, statutes, Wikipedia) and, for 2025–26 events, web news sources
  (cited in `sources`).
- Mock 26 was cross-checked against its official answer key PDF. The key's letters for Q51 and Q52
  contradict its own explanations; corrected to (b), with a note in the answer file.
- Mock 13 was cross-checked against its scanned answer key (OCR). All letters agree except Q25, where the
  key's (b) is doubtful and the question is held as needs_review.

### Priority 3: Core website (done)
- React 18 + Vite 5 app, responsive (checked at 375 px mobile width with no horizontal scroll, and on desktop).
- Home (stats) → Setup (10/15/20 questions; All / With passage / Standalone) → Quiz (question palette,
  prev/next, select/deselect answer, collapsible passage panel) → Result (CLAT marking +1/−0.25, full
  review with correct answer, explanation and sources).
- Random selection: Fisher–Yates shuffle over the verified pool (`src/quiz.js`).
- `npm run build` passes. The flow was verified end to end in the browser.

### Session 7: exam-prep UI rebuild (done)
- Quizzes are served as passage sets: a passage plus all of its questions, in paper order. The last set is trimmed so
  the count is exactly 10/15/20. Practice also offers a mixed format, topic filters and an "unattempted only" option.
- Quiz screen: sticky passage pane, palette (answered / marked / skipped), mark for review, bookmarks,
  CLAT-pace timer with auto-submit, keyboard shortcuts (`?`), and autosave/resume across refresh.
- Revision: every wrong answer goes to a mistake log in localStorage. Practise only those; a mistake moves to
  Learned when answered correctly. There is also a Bookmarks tab.
- Analytics: score trend (chart/table), accuracy by topic, time per question, "focus next".
- Settings: theme, export/import/reset progress.
- Verified in the browser on desktop and at 375 px; tests, validation and the build pass.

## Pending
1. **Answer the remaining mocks.** For each mockId in
   `data/EXTRACTION_REPORT.md` with 0 verified, run `python3 scripts/show_mock.py <mockId>` (add `full` to
   see whole passages), research the answers, and write `data/answers/<mockId>.json` in the same format as
   the existing files. **All CLAT mocks are done.** Only AILET 01–13 remain, skipped by user decision.
2. (Only if AILET is ever taken up again) cross-check against `LE • AILET 2027 MOCK 05 (AK)` (scanned). Treat key
   letters as hints only, because the Mock 26 and Mock 13 keys both had doubtful letters.
3. **OCR papers:** CLAT 09 and 10 are done. Only `ailet-mock-02` (skipped) is still `ocr_review`. For any
   future OCR'd paper, either fix text via the `question` / `options` / `_passages` override fields in the
   answer file (see the `scripts/build_bank.py` docstring) or, if the OCR is unusable, hand-transcribe into
   `data/manual/<mockId>.json` (format documented in `scripts/finalize_extraction.py`).
4. Resolve the `needs_review` items (a few have extraction gaps: clat-mock-21 Q51 and clat-mock-25 Q38 lost list items — restore text from the PDF via the `question` override). Each has a `note` explaining what is unconfirmed; list them with
   `python3 -c "import json;print([q['id'] for q in json.load(open('public/questions.json'))['questions'] if q['status']=='needs_review'])"`.
   Several have no answer yet (answer: null), e.g. clat-mock-05 Q33, clat-mock-16 Q26, clat-mock-21 Q46, clat-mock-25 Q38, clat-mock-30 Q43.
5. UI ideas: filter by mock, and a full-length 30-question timed mock mode.

## Known issues
- Some passage titles are really the first line of prose (e.g. "In January 2026, India and the EU
  concluded a landmark Free Trade…"). The text still reads correctly because the title is shown as the
  passage heading followed by the rest. This is cosmetic.
- Passage text loses some paragraph breaks where the PDF had no blank line.
- The OCR cache lives in the session scratchpad. If extraction is re-run, OCR (~250 pages, slow) is
  redone unless `OCR_CACHE` points at a kept cache. `data/raw_extraction.json` already contains the OCR
  output, so normally you only need `finalize_extraction.py` onward.

## Rebuild pipeline
```bash
cd /Users/pratikkumar/Desktop/CLAT/quiz-project
# only if extraction logic changes (slow when OCR cache is missing):
#   OCR_CACHE=/path/to/cache python3 scripts/extract.py .. data/raw_extraction.json
python3 scripts/finalize_extraction.py data/raw_extraction.json
python3 scripts/build_bank.py        # merges data/answers/*.json
npm run validate
python3 scripts/report.py
npm run build
```
Answer files are keyed by question number, so re-running extraction does not invalidate them, as long
as the mock's passages and question numbering stay the same.
