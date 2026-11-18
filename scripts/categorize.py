"""Keyword-based topic classifier for CA&GK passages/questions.

Each passage (or standalone question) gets exactly one category: the one with the highest weighted
keyword score (title hits count triple). Used by build_bank.py; tweak KEYWORDS to re-tune.
"""
import re

CATEGORIES = [
    'Polity & Constitution',
    'Law & Judiciary',
    'International Relations',
    'Economy & Trade',
    'Environment & Geography',
    'Science & Technology',
    'Sports',
    'History, Art & Culture',
]

KEYWORDS = {
    'Polity & Constitution': ['constitution', 'amendment', 'article', 'parliament', 'lok sabha', 'rajya sabha', 'election',
        'electoral', 'governor', 'president of india', 'vice-president', 'panchayat', 'federal', 'delimitation', 'schedule',
        'union territory', 'statehood', 'anti-defection', 'tenth schedule', 'fundamental right', 'directive principle',
        'ucc', 'uniform civil code', 'emergency', 'lokpal', 'cag', 'finance commission', 'pesa', 'reservation', 'speaker',
        'money bill', 'bill', 'state legislature', 'women\'s reservation', 'keralam', 'national honour'],
    'Law & Judiciary': ['supreme court', 'high court', 'judgment', 'judicial', 'bench', 'tribunal', 'bail', 'sedition',
        'uapa', 'euthanasia', 'act,', 'penal', 'bns', 'crpc', 'bnss', 'custodial', 'right to be forgotten', 'privacy',
        'justice', 'chief justice', 'judges', 'litigation', 'court of arbitration', 'places of worship', 'pocso', 'fcra',
        'paper leak', 'unfair means', 'compensation', 'homemaker', 'menstrual leave', 'labour code', 'right to education'],
    'International Relations': ['summit', 'g7', 'g20', 'brics', 'sco', 'nato', 'united nations', 'un security council',
        'bilateral', 'treaty', 'diplomatic', 'diplomacy', 'iran', 'israel', 'ukraine', 'russia', 'china', 'nepal', 'pakistan',
        'bangladesh', 'myanmar', 'nordic', 'asean', 'bimstec', 'quad', 'greenland', 'gaza', 'hormuz', 'makkah', 'saudi',
        'canada', 'australia', 'european union', 'imec', 'chabahar', 'indus waters', 'shaksgam', 'opec', 'fatf', 'who',
        'pax silica', 'strategic partnership', 'foreign policy', 'defence', 'military', 'war', 'ceasefire', 'nuclear weapon',
        'sipri', 'border dispute', 'alliance'],
    'Economy & Trade': ['gdp', 'economy', 'economic', 'budget', 'fiscal', 'inflation', 'rbi', 'monetary', 'repo', 'tariff',
        'trade', 'free trade', 'fta', 'cepa', 'ceta', 'export', 'import', 'gst', 'tax', 'bank', 'bonds', 'upi', 'payment',
        'npci', 'rupee', 'investment', 'wpi', 'price index', 'mineral', 'mines', 'rural employment', 'mgnrega', 'vb-g ram g',
        'rozgar', 'jal jeevan', 'sdg', 'sustainable development goals', 'world bank', 'income', 'fertiliser', 'crude', 'oil',
        'gold', 'labour', 'index'],
    'Environment & Geography': ['ramsar', 'wetland', 'climate', 'el niño', 'el nino', 'monsoon', 'flood', 'cloudburst',
        'earthquake', 'seismic', 'volcano', 'river', 'glacier', 'himalaya', 'aravalli', 'forest', 'biodiversity', 'wildlife',
        'tiger', 'big cat', 'pollution', 'air quality', 'cop30', 'cop 30', 'emission', 'ozone', 'arctic', 'ocean', 'wetlands',
        'ethanol', 'renewable', 'green hydrogen', 'nagoya', 'conservation', 'snow leopard', 'disaster', 'enso', 'la niña',
        'southern oscillation', 'trade winds', 'rainfall', 'sea surface'],
    'Science & Technology': ['isro', 'space', 'satellite', 'rocket', 'launch vehicle', 'gaganyaan', 'artemis', 'nasa',
        'quantum', 'artificial intelligence', ' ai ', 'ai impact', 'semiconductor', 'chip', 'processor', 'microprocessor',
        'digital', 'cyber', 'data protection', 'technology', 'vikram-1', 'skyroot', 'virus', 'nipah', 'vaccine', 'health survey',
        'nfhs', 'nuclear energy', 'shanti', 'reactor', 'bhashini', 'indian standard time', 'hydrogen train', 'telecom'],
    'Sports': ['commonwealth games', 'olympic', 'world cup', 'fifa', 'cricket', 'javelin', 'athlete', 'medal', 'kho kho',
        'archery', 'paralympic', 'doping', 'wada', 'sports award', 'khel ratna', 'arjuna award', 'chess', 'football',
        'tournament', 'championship', 'sports', 'sportspersons', 'coach', 'khel'],
    'History, Art & Culture': ['heritage', 'unesco', 'harappan', 'mohenjo', 'buddha', 'sarnath', 'temple', 'bhojshala',
        'vande mataram', 'anandamath', 'jnanpith', 'padma', 'award', 'film award', 'literature', 'poet', 'museum', 'ancient',
        'dynasty', 'empire', 'battle', 'panipat', 'komagata', 'ghadar', 'freedom struggle', 'ambedkar', 'mahad', 'magsaysay',
        'republic day', 'kumbh', 'festival', 'classical language', 'archaeolog', 'colonial', 'rebellion', 'merian',
        'padma vibhushan', 'padma shri', 'bharat ratna', 'parade', 'national song'],
}


_PREFIX = {'archaeolog', 'colonial', 'electoral', 'diploma', 'conservation'}
_RX = {}


def _rx(w):
    if w not in _RX:
        w2 = w.strip()
        tail = '' if w2 in _PREFIX else r'(?![a-z])'
        _RX[w] = re.compile(r'(?<![a-z])' + re.escape(w2) + tail)
    return _RX[w]


def _score(text, words):
    t = text.lower()
    return sum(len(_rx(w).findall(t)) for w in words)


def classify(title, text):
    scores = {c: 3 * _score(title, KEYWORDS[c]) + _score(text, KEYWORDS[c]) for c in CATEGORIES}
    best = max(CATEGORIES, key=lambda c: (scores[c], -CATEGORIES.index(c)))
    return best if scores[best] > 0 else 'General Knowledge'

# Manual corrections where keyword scoring picks the wrong topic (passage id -> category).
OVERRIDES = {
    'clat-mock-21-p2': 'Polity & Constitution',      # Panchayat Advancement Index
    'clat-aiom-mock-02-p0': 'Science & Technology',  # SHANTI nuclear energy Act
    'clat-mock-02-p4': 'History, Art & Culture',     # Maha Kumbh
    'clat-mock-26-p2': 'Polity & Constitution',      # Uttarakhand fully literate (ULLAS)
    'clat-mock-35-p3': 'International Relations',    # UNSC reform bid
    'clat-mock-35-p4': 'History, Art & Culture',     # Cultural diplomacy
}
