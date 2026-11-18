"""Merge extracted questions (data/extracted.json) with answer files (data/answers/<mockId>.json)
into data/bank_full.json (every question, any status) and the website's bank public/questions.json
(only `verified` questions and the passages they use, compact JSON, each tagged with a topic category).

Usage: python3 scripts/build_bank.py

Answer file format (one per mock, keyed by question number as a string):
{
  "25": {
    "answer": "a",                      # a|b|c|d
    "explanation": "Short reason.",
    "sources": [{"title": "PIB, 12 Jun 2026", "url": "https://..."}],
    "status": "verified",               # verified | needs_review | disputed
    "note": "optional reviewer note",
    # optional overrides when extraction/OCR text needs fixing:
    "question": "...", "options": ["..", "..", "..", ".."]
  }
}
A passage text override can be given as "_passages": {"<passage index>": {"title": "..", "text": ".."}}.
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXTRACTED = os.path.join(ROOT, 'data', 'extracted.json')
ANSWERS = os.path.join(ROOT, 'data', 'answers')
OUT = os.path.join(ROOT, 'public', 'questions.json')
FULL = os.path.join(ROOT, 'data', 'bank_full.json')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from categorize import CATEGORIES, OVERRIDES, classify  # noqa: E402


def main():
    mocks = json.load(open(EXTRACTED))
    passages, questions = {}, []
    problems = []
    for m in mocks:
        if m.get('skip'):
            continue
        mid = m['mockId']
        ans = {}
        path = os.path.join(ANSWERS, f'{mid}.json')
        if os.path.exists(path):
            ans = json.load(open(path))
        povr = ans.get('_passages', {})
        for i, p in enumerate(m.get('passages', [])):
            o = povr.get(str(i), {})
            passages[f'{mid}-p{i}'] = {
                'id': f'{mid}-p{i}',
                'title': o.get('title', p['title']),
                'text': o.get('text', p['text']),
            }
        for q in m.get('questions', []):
            a = ans.get(str(q['n']), {})
            opts = a.get('options', q['options'])
            item = {
                'id': f"{mid}-q{q['n']}",
                'mock': m['mockName'],
                'mockId': mid,
                'number': q['n'],
                'passageId': f"{mid}-p{q['passage']}" if q['passage'] is not None else None,
                'question': a.get('question', q['question']),
                'options': opts,
                'answer': a.get('answer'),
                'explanation': a.get('explanation', ''),
                'sources': a.get('sources', []),
                'status': a.get('status', 'unanswered'),
            }
            if m.get('textQuality') == 'ocr' and item['status'] == 'unanswered':
                item['status'] = 'ocr_review'  # OCR text must be proof-read first
            if not opts or len(opts) != 4 or not all(o.strip() for o in opts) or not item['question'].strip():
                problems.append(f"{item['id']}: options missing/invalid")
                item['status'] = 'broken'
            if item['answer'] and item['answer'] not in 'abcd':
                problems.append(f"{item['id']}: bad answer {item['answer']}")
            questions.append(item)
    from collections import Counter, defaultdict
    # topic category per passage (questions inherit it); standalone questions classified on their own
    byp = defaultdict(list)
    for q in questions:
        byp[q['passageId']].append(q)
    for pid, ql in byp.items():
        if pid is None:
            for q in ql:
                q['category'] = classify('', q['question'] + ' ' + ' '.join(q['options'] or []))
            continue
        p = passages[pid]
        cat = OVERRIDES.get(pid) or classify(
            p['title'], p['text'] + ' ' + ' '.join(q['question'] + ' ' + ' '.join(q['options'] or []) for q in ql))
        p['category'] = cat
        for q in ql:
            q['category'] = cat
    stats = Counter(q['status'] for q in questions)
    meta = {
        'title': 'CLAT Current Affairs & GK question bank',
        'mocks': len({q['mockId'] for q in questions}),
        'questionCount': len(questions),
        'statusCounts': dict(stats),
        'categories': CATEGORIES,
    }
    full = {'meta': meta, 'passages': passages, 'questions': questions}
    json.dump(full, open(FULL, 'w'), ensure_ascii=False, indent=1)
    # website bank: verified only
    live = [q for q in questions if q['status'] == 'verified']
    live_p = {pid: passages[pid] for pid in {q['passageId'] for q in live if q['passageId']}}
    site = {
        'meta': dict(meta, liveQuestions=len(live), liveMocks=len({q['mockId'] for q in live})),
        'passages': live_p,
        'questions': live,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(site, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(f"wrote {FULL}: {len(questions)} questions, status={dict(stats)}")
    print(f"wrote {OUT}: {len(live)} verified questions, {len(live_p)} passages, "
          f"categories={dict(Counter(q['category'] for q in live))}")
    for p in problems:
        print('PROBLEM', p)


if __name__ == '__main__':
    main()
