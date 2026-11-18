"""Turn the raw extractor output into data/extracted.json:
assigns stable mock ids/names, strips watermark noise, and marks files to skip.

Usage: python3 scripts/finalize_extraction.py <raw.json>
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'data', 'extracted.json')
# data/manual/<mockId>.json: hand transcription (from page images) that replaces a badly OCR'd mock's
# passages/questions entirely. Format: {"range":[a,b], "passages":[{title,text,page}],
# "questions":[{n, passage, page, question, options[4]}]}
MANUAL = os.path.join(ROOT, 'data', 'manual')

# Scanned copies whose content duplicates a text-based PDF of the same mock (verified by comparing
# question text): skipped so the bank has no duplicate questions.
DUPLICATE_SCANS = {
    'LE • CLAT 2027 MOCK 11 @CLAT_OWNER (1).pdf',  # same paper as 'MOCK 11 @CLAT_OWNER (2).pdf'
    'LE • CLAT 2027 MOCK 12 @CLAT_OWNER (1).pdf',  # same paper as 'PDF MOCK 12 @CLAT_OWNER.pdf'
}

WATERMARK = re.compile(r'\s*Toprankers\.com(\s+tr-\S+)+\s*')
# trailing page furniture that can bleed into the last option of a section
TRAILER = re.compile(r'\s*(USE FOR ROUGH WORK|SELF-ASSESSMENT|Mock Objection|toprankers|[LT]EGALEDGE).*$', re.I | re.S)


def mock_identity(fname):
    """Return (mockId, mockName) from a PDF filename. Explicit table keeps ids stable."""
    f = fname
    if '(AK)' in f:
        return None, None  # answer-key PDFs: used for cross-checking, not as question sources
    s = re.sub(r'@CLAT_OWNE?R?|\(\d\)|\.pdf', ' ', f, flags=re.I)
    s = s.replace('•', ' ').replace(':', ' ')
    s = re.sub(r'^\s*LE[-\s]+', '', s)
    s = re.sub(r'\s+', ' ', s).strip()
    exam = 'AILET' if 'AILET' in s.upper() else 'CLAT'
    num = re.findall(r'MOCK\s*-*\s*(\d+)', s, re.I)
    n = num[-1].zfill(2) if num else '00'
    if 'Additional' in s:
        return 'clat-additional-mock-01', 'CLAT 2027 Additional Mock 01'
    if 'Bootcamp' in s:
        return f'clat-bootcamp-mock-{n}', f'CLAT 2027 Bootcamp Mock {n}'
    if 'Real' in s:
        return 'clat-real-mock-01', 'Real CLAT 2027 Mock 01'
    aiom = re.search(r'AIOM\s*(\d+)', s)
    if aiom and 'MOCK 10' not in s.upper():
        return f'clat-mock-{n}', f'CLAT 2027 Mock {n} (AIOM {aiom.group(1)})'
    if re.match(r'.*AIOM MOCK \d+', s, re.I):
        return f'clat-aiom-mock-{n}', f'CLAT 2027 AIOM Mock {n}'
    if exam == 'AILET':
        return f'ailet-mock-{n}', f'AILET 2027 Mock {n}'
    return f'clat-mock-{n}', f'CLAT 2027 Mock {n}'


def clean(s):
    return WATERMARK.sub(' ', s).strip() if isinstance(s, str) else s


def main():
    raw = json.load(open(sys.argv[1]))
    out, seen = [], {}
    for m in raw:
        mid, name = mock_identity(m['file'])
        if mid is None or m['file'] in DUPLICATE_SCANS:
            continue
        if mid in seen:  # same mock number from two different files
            mid = f"{mid}-v2"; name = f"{name} (alt)"
        seen[mid] = m['file']
        m = dict(m, mockId=mid, mockName=name)
        manual = os.path.join(MANUAL, f'{mid}.json')
        if os.path.exists(manual):
            t = json.load(open(manual))
            m.update(range=t['range'], passages=t['passages'], questions=t['questions'],
                     ocr=False, textQuality='manual')
            m.pop('error', None)
        for p in m.get('passages', []):
            p['text'] = clean(p['text']); p['title'] = clean(p['title'])
        if m.get('ocr') and m.get('textQuality') != 'manual':
            m['textQuality'] = 'ocr'  # OCR'd scan: text must be proof-read before answers are marked verified
        for q in m.get('questions', []):
            q['question'] = clean(q['question'])
            if q['options']:
                q['options'] = [TRAILER.sub('', clean(o)) for o in q['options']]
        out.append(m)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, 'w'), ensure_ascii=False, indent=1)
    for m in out:
        print(f"{m['mockId']:28s} {m['mockName']:36s} q={len(m.get('questions', []))} {m.get('error', '')}  <- {m['file']}")


if __name__ == '__main__':
    main()
