"""Print one mock's extracted CA&GK questions for answer research. Usage: python3 scripts/show_mock.py <mockId> [full]"""
import json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
mid = sys.argv[1]; full = len(sys.argv) > 2
m = [x for x in json.load(open(os.path.join(ROOT, 'data', 'extracted.json'))) if x['mockId'] == mid][0]
print('FILE', m['file'], m['range'], m.get('textQuality', ''))
shown = set()
for i, p in enumerate(m['passages'] + [None]):
    if p is not None:
        print(f"\n[P{i}] {p['title']}\n{p['text'] if full else p['text'][:350]}")
    for q in m['questions']:
        if q['passage'] == (i if p is not None else None) and q['n'] not in shown:
            shown.add(q['n'])
            print(f"\nQ{q['n']}. {q['question']}")
            for l, o in zip('abcd', q['options'] or []):
                print(f"  ({l}) {o}")
