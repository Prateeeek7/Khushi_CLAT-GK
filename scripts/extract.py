"""Extract the 'Current Affairs including General Knowledge' section from the mock PDFs.

Usage: python3 scripts/extract.py <pdf_dir> <out_json>
Deduplicates identical PDFs by SHA1. Text-based PDFs are read with PyMuPDF;
image-only PDFs are OCR'd with tesseract (300 dpi).
"""
import fitz, glob, hashlib, json, os, re, subprocess, sys, tempfile

NOISE = [
    re.compile(r'^\s*Head Office:.*$'),
    re.compile(r'^\s*Page \d+ of \d+\s*$'),
    re.compile(r'^\s*@CLAT_OWNER\s*$'),
    re.compile(r'^\s*\d\s*$'),  # stray page-logo digit
    re.compile(r'^\s*=+PAGE.*$'),
]

OCR_CACHE = os.environ.get('OCR_CACHE', os.path.join(tempfile.gettempdir(), 'clat_ocr_cache'))

def needs_ocr(page):
    """Image-only page, or a page that is one full-page scan with a (poor) OCR text layer."""
    t = page.get_text()
    if len(t.strip()) < 50:
        return True
    imgs = page.get_image_info()
    area = page.rect.width * page.rect.height
    return any((i['bbox'][2]-i['bbox'][0])*(i['bbox'][3]-i['bbox'][1]) > 0.85*area for i in imgs)

def page_texts(path, sha):
    d = fitz.open(path)
    out = []
    os.makedirs(OCR_CACHE, exist_ok=True)
    for i, p in enumerate(d):
        if needs_ocr(p):
            cache = os.path.join(OCR_CACHE, f'{sha}_{i}.txt')
            if os.path.exists(cache):
                t = open(cache).read()
            else:
                pix = p.get_pixmap(dpi=300)
                with tempfile.TemporaryDirectory() as td:
                    png = os.path.join(td, 'p.png'); pix.save(png)
                    t = subprocess.run(['tesseract', png, '-', '--psm', '4'], capture_output=True, text=True).stdout
                open(cache, 'w').write(t)
            out.append(('ocr', t))
        else:
            out.append(('text', p.get_text()))
    return out

def clean_lines(text):
    lines = []
    for l in text.splitlines():
        if any(n.match(l) for n in NOISE):
            continue
        lines.append(l.rstrip())
    return lines

def norm(s):
    s = re.sub(r'[ \t]+', ' ', s)
    s = re.sub(r'\s*\n\s*', '\n', s)
    return s.strip()

def para(s):
    """Join hard-wrapped lines; keep blank-line paragraph breaks."""
    parts = re.split(r'\n\s*\n', s.strip())
    return '\n\n'.join(re.sub(r'\s*\n\s*', ' ', p).strip() for p in parts if p.strip())

SEC_HEAD = re.compile(r'^\s*SECTION\b|^\s*Section\s+[IVX]+\s*([-–—:]|$)')  # case-sensitive: 'Section 7 of the Act' in passages must not match
DIR_RANGE = re.compile(r'Directions\s*\(\s*Q\.?\s*(\d+)\s*[-–—]\s*Q?\.?\s*(\d+)\s*\)', re.I)
PASSAGE = re.compile(r'^\s*Passage\s*:?\s*\(\s*Q\.?\s*(\d+)\s*[-–—"]+\s*Q?\.?\s*(\d+)\s*\)\s*[:.]?\s*(.*)$', re.I)
ROMAN = re.compile(r'^\s*([IVXL]{1,6})\s*[.)]\s*(.*)$')
CONTENTS_RANGE = re.compile(r'(\d{1,3})\s*[-–—]\s*(\d{1,3})')

def split_options(body):
    """Return (stem, [a,b,c,d]) using the last ordered (a)..(d) markers (case-insensitive)."""
    pos = {}
    end = len(body)
    for letter in 'dcba':
        # marker must start a line or follow whitespace (so 'Article 19(1)(a)' / '51A(a)' are not markers)
        ms = [m for m in re.finditer(r'(?:(?<=\s)|^)\(\s*%s\s*\)' % letter, body[:end], re.I)]
        if not ms:
            return body, None
        pos[letter] = ms[-1]
        end = ms[-1].start()
    stem = body[:pos['a'].start()]
    opts = []
    for i, letter in enumerate('abcd'):
        s = pos[letter].end()
        e = pos['abcd'[i+1]].start() if i < 3 else len(body)
        opts.append(re.sub(r'\s+', ' ', body[s:e]).strip())
    return stem, opts

def find_range(lines, kind):
    # 1) contents page
    for idx, (pg, l) in enumerate(lines[:400]):
        if pg > 3: break
        if re.search(r'current\s+affairs', l, re.I):
            win = ' '.join(x for _, x in lines[idx:idx+5])
            m = CONTENTS_RANGE.search(win)
            if m:
                a, b = int(m.group(1)), int(m.group(2))
                if 0 < a < b <= 200 and 15 <= b - a <= 45:
                    return a, b, 'contents'
    return (51, 80, 'default-ailet') if kind == 'AILET' else (25, 52, 'default-clat')

def qline(l, n):
    m = re.match(r'^\s*(?:Q\.?\s*)?(\d{1,3})\s*[.,)]\s*(.*)$', l)
    if m and int(m.group(1)) == n:
        return m.group(2)
    return None

def extract(path, sha):
    pages = page_texts(path, sha)
    ocr = any(k == 'ocr' for k, _ in pages)
    lines = []
    for i, (_, t) in enumerate(pages):
        for l in clean_lines(t):
            lines.append((i + 1, l))
    kind = 'AILET' if 'AILET' in os.path.basename(path).upper() else 'CLAT'
    qa, qb, rsrc = find_range(lines, kind)
    body_from = next((i for i, (pg, _) in enumerate(lines) if pg >= 3), 0)
    # locate first question qa
    # anchor at the CA&GK section heading when present (avoids '25.' lines inside earlier sections)
    CA_HEAD = re.compile(r'SECTION.{0,12}(CURRENT\s+AFFAIRS|GENERAL\s+KNOWLEDGE)|^\s*SECTION\s+II\s*$|^\s*Section\s+II\s*([-–—:]|$)', re.I)
    for idx in range(body_from, len(lines)):
        if CA_HEAD.search(lines[idx][1]):
            body_from = idx; break
    first = None
    for idx in range(body_from, len(lines)):
        if qline(lines[idx][1], qa) is not None:
            # must be preceded (within 150 lines) by a section heading
            first = idx; break
    if first is None:
        return {'error': f'Q{qa} not found', 'ocr': ocr, 'range': [qa, qb]}
    start = first
    while start > body_from and not SEC_HEAD.match(lines[start][1]):
        start -= 1
    header = lines[start][1].strip()
    end = len(lines)
    for idx in range(first, len(lines)):
        if SEC_HEAD.match(lines[idx][1]):
            end = idx; break
    sec = lines[start+1:end]
    expected = qa
    passages, questions = [], []
    cur_passage, cur_q, buf, mode = None, None, [], 'passage'
    def new_passage(pg, title=''):
        nonlocal cur_passage
        cur_passage = {'title': title, 'text': '', 'page': pg}
        passages.append(cur_passage)
    def flush():
        nonlocal buf
        text = '\n'.join(buf)
        if mode == 'passage':
            if cur_passage is None and text.strip():
                new_passage(sec[0][0] if sec else 0)
            # 'Passage (Q.x-Q.y): <first line of prose>' — a "title" followed by a lowercase
            # continuation line is really the start of the passage text
            if cur_passage is not None and cur_passage['title'] and not cur_passage['text'] \
                    and text.strip() and (text.strip()[0].islower() or len(cur_passage['title']) > 78):
                text = cur_passage['title'] + ' ' + text.strip()
                cur_passage['title'] = ''
            if cur_passage is not None:
                cur_passage['text'] = (cur_passage['text'] + '\n\n' + para(text)).strip()
        elif cur_q is not None:
            cur_q['raw'] = text
        buf = []
    use_roman = not any(PASSAGE.match(l) for _, l in sec)  # roman-numeral headings only in AIOM-style papers
    for pg, l in sec:
        if DIR_RANGE.search(l) and not PASSAGE.match(l):
            continue
        m = PASSAGE.match(l)
        r = ROMAN.match(l) if use_roman else None
        # a roman-numeral heading starts a new passage only before the first question or right after a
        # complete (a)-(d) option block (so 'I./II.' items inside match-the-following stems are kept)
        if r and not (not questions or (mode == 'q' and re.search(r'(?:(?<=\s)|^)\(\s*d\s*\)', '\n'.join(buf), re.I))):
            r = None
        if r and len(r.group(2)) >= 160:
            r = None
        if m or r:
            flush(); mode = 'passage'
            title = (m.group(3) if m else r.group(2)).strip()
            if title.lower().startswith('passage:'):
                title = title[8:].strip()
            if title and len(title) < 120 and not title.endswith('.'):
                new_passage(pg, title)
            else:
                new_passage(pg)
                if title: buf.append(title)
            continue
        rest = qline(l, expected) if expected <= qb else None
        if rest is not None:
            flush()
            cur_q = {'n': expected, 'page': pg, 'passage': len(passages) - 1 if passages else None}
            questions.append(cur_q)
            expected += 1
            mode = 'q'
            if rest.strip(): buf.append(rest)
            continue
        buf.append(l)
    flush()
    for q in questions:
        stem, opts = split_options(q.pop('raw', ''))
        q['question'] = para(stem)
        q['options'] = opts
    for p in passages:
        p['text'] = re.sub(r'^Passage\s*:\s*', '', p['text'])
    return {'ocr': ocr, 'kind': kind, 'header': header, 'range': [qa, qb], 'range_source': rsrc,
            'passages': passages, 'questions': questions}

def main():
    src, out = sys.argv[1], sys.argv[2]
    seen = {}
    results = []
    for f in sorted(glob.glob(os.path.join(src, '*.pdf'))):
        h = hashlib.sha1(open(f, 'rb').read()).hexdigest()
        if h in seen:
            continue
        seen[h] = f
        r = extract(f, h)
        r['file'] = os.path.basename(f); r['sha1'] = h
        results.append(r)
        n = len(r.get('questions', []))
        exp = (r['range'][1] - r['range'][0] + 1) if 'range' in r else '?'
        bad = sum(1 for q in r.get('questions', []) if not q['options'])
        longd = sum(1 for q in r.get('questions', []) if q['options'] and len(q['options'][3]) > 200)
        print(f"{r['file'][:50]:50s} {r.get('error','')} {r.get('range')} {r.get('range_source','')} found={n}/{exp} badopts={bad} longD={longd} psg={len(r.get('passages',[]))} ocr={r['ocr']} hdr={r.get('header','')[:40]}")
    json.dump(results, open(out, 'w'), indent=1, ensure_ascii=False)

if __name__ == '__main__':
    main()
