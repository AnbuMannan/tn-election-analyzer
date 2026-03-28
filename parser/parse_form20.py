#!/usr/bin/env python3
"""
Tamil Nadu Form 20 Election Result PDF Parser - v5 FINAL
Handles all known TN Assembly Election PDF formats:
  FORMAT A (Dharmapuri 2021): Name+Party in same cell via dual x-offset char streams
  FORMAT B (Kilpennathur, Gingee): Separate rows for name and party before data
Includes: Postal ballot vote extraction, correct constituency name for all formats
"""
import sys, json, re, traceback
from collections import defaultdict, Counter

try:
    import pdfplumber
except ImportError:
    print(json.dumps({"error": "pdfplumber not installed. Run: pip install pdfplumber"}))
    sys.exit(1)

# ── Party mappings ─────────────────────────────────────────────────────────────
FORMAT_A_PARTIES = [
    'APTAMK','AIADMK','ADMK','DMSK','DHMK','AMMK','MNM','PMK','NTK','BSP','BJP',
    'CPI','CPM','VCK','DMK','PTK','MDMK','INC','TNMM','IUML','TMC',
    'My India Party','MMP','RPI','AMK','VTTK','IND'
]

PARTY_FULL_NAME_MAP = [
    ('dravidamunnetrakazhagam',    'DMK'),
    ('dravidakazhagammunnetra',    'DMK'),
    ('bahujansamaj',               'BSP'),
    ('annadravidarkazhagam',       'ADMK'),
    ('annakazhagamdravidar',       'ADMK'),
    ('aiadmk',                     'AIADMK'),
    ('ammakazagammunnetra',        'AMMK'),   # KP specific
    ('ammakazagam',                'AMMK'),   # catches AmmaKazagamMunnettraMakkal
    ('ammamunnettramakkal',        'AMMK'),
    ('ammamakkalkazagam',          'AMMK'),
    ('ammamakkal',                 'AMMK'),
    ('makkalneedhimaiam',          'MNM'),
    ('makkalneethimaiam',          'MNM'),
    ('makkalneedhi',               'MNM'),
    ('naamtamilar',                'NTK'),
    ('pattalimakkal',              'PMK'),
    ('thozhilalarkal',             'VTTK'),
    ('veeraththiyagi',             'VTTK'),
    ('makkalmunnetraperavai',      'MMP'),
    ('makkalmunnetra',             'MMP'),
    ('republicanparty',            'RPI'),
    ('anaithumakkal',              'AMK'),
    ('myindiaparty',               'My India Party'),
    ('dhmk',                       'DHMK'),
    ('dmsk',                       'DMSK'),
    ('aptamk',                     'APTAMK'),
    ('iuml',                       'IUML'),
    ('independent',                'IND'),
]

SUMMARY_KEYS = [
    'totalvalidvotes','nota','rejectedvotes','totalvotes','tenderedvotes',
    'noofrejectedvotes','nooftenderedvotes','votesfornotaoption',
    'totalofvalidvotes','validvotes','totalnoofvotes','totalevmvotes',
    'recordedatpolling','totalofvotes'
]

def clean_number(val):
    if val is None: return 0
    s = str(val).strip().replace(',','').replace(' ','').replace('\n','')
    if not s or s == '-': return 0
    try: return int(float(s))
    except: return 0

def is_summary_text(text):
    t = re.sub(r'\s+','', text.lower())
    return any(k in t for k in SUMMARY_KEYS + [
        'postalballot','totalvotespolled','recordedonpostal','postalvotes',
        'electorsinassembly','nooftendered'
    ])

def map_full_party(text):
    n = re.sub(r'[^a-z]', '', text.lower())
    for substr, code in PARTY_FULL_NAME_MAP:
        if substr in n:
            return code
    return 'IND'

def clean_candidate_name(raw):
    name = raw.strip()
    # Remove leading lowercase run (noise from line-break fragments like 'se' from 'SubashChandrabo\nse')
    name = re.sub(r'^[a-z]+', '', name)
    name = re.sub(r'^[^A-Za-z]+', '', name)
    name = re.sub(r'[^A-Za-z0-9\s\.\@\(\)]+$', '', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name

# ── Format A: x-offset stream separation ──────────────────────────────────────
def extract_format_a_header(page, cx0, cx1, table_top):
    try:
        chars = page.crop((cx0, table_top - 5, cx1, table_top + 95)).chars
    except:
        return None, None
    if not chars:
        return None, None

    by_x = defaultdict(list)
    for c in sorted(chars, key=lambda c: c['top']):
        by_x[round(c['x0'] - cx0, 1)].append(c['text'])

    streams = {xo: ''.join(clist)[::-1].strip() for xo, clist in by_x.items()}
    all_rev = ''.join(streams.values()).lower().replace(' ','')

    if any(k in all_rev for k in SUMMARY_KEYS):
        return None, 'SUMMARY'
    if any(s in all_rev for s in ['slno','pollingstationno','stationno']):
        return None, None

    name_xo = max(by_x.keys(), key=lambda xo: len(by_x[xo]))
    name_text = streams[name_xo]
    name_clean = clean_candidate_name(name_text)

    found_party = 'IND'
    for xo, rev_text in sorted(streams.items()):
        if xo == name_xo: continue
        rev_s = rev_text.strip()
        for party in FORMAT_A_PARTIES:
            if rev_s == party or rev_s.startswith(party):
                found_party = party
                break
        if found_party != 'IND': break

    if found_party == 'IND':
        for party in FORMAT_A_PARTIES:
            if party in name_text:
                found_party = party
                name_clean = clean_candidate_name(name_text.replace(party, ''))
                break

    display = f"{name_clean} ({found_party})" if name_clean and len(name_clean) > 1 else f"Candidate ({found_party})"
    return display, found_party

# ── Constituency + electors extraction ────────────────────────────────────────
def extract_meta(first_text, table_row0_text=""):
    constituency = "Unknown"
    electors = 0

    patterns = [
        r'(?:No\.?\s*&?\s*Name[^:]*:|constituency:?)\s*(?:\.+)?\s*(\d+)[.\-\s]+([A-Z][A-Za-z\s]+?)(?:\s+Assembly|\s+Total|\s*\n|\s*$)',
        r'[Nn]ame of [Aa]ssembly[^:]*?[:.]+\s*(\d+)-([A-Za-z\s]+?)(?:\s+Assembly|\s+Election|\n)',
        r'Assembly Constituency\s*:\s*(\d+)\s*[-\u2013]\s*([A-Za-z\s]+?)(?:\n|Total|Date)',
        r':\s*(\d+)\s*[-\u2013]\s*([A-Za-z\s]+?)(?:\n|Total|Date|General)',
    ]
    for text in [first_text, table_row0_text]:
        if not text: continue
        for pat in patterns:
            m = re.search(pat, text, re.I)
            if m:
                num = m.group(1).strip()
                name = m.group(2).strip().title()
                if 2 < len(name) < 50:
                    constituency = f"{num} - {name}"
                    break
        if constituency != "Unknown":
            break

    # Electors - handle both '253562' and '....253562' formats
    for text in [first_text, table_row0_text]:
        if not text: continue
        m = re.search(r'Electors[^:0-9.]*?[.:\s]+([\d,]+)', text, re.I)
        if m:
            electors = clean_number(m.group(1))
            break

    return constituency, electors

# ── Format detection ───────────────────────────────────────────────────────────
def detect_format(table_rows):
    for i, row in enumerate(table_rows[:10]):
        if not row: continue
        non_empty = [str(c).strip() for c in row if c and str(c).strip() and re.match(r'^\d+$', str(c).strip())]
        if len(non_empty) >= 5:
            try:
                nums = [int(v) for v in non_empty[:8]]
                if nums[:3] == [1, 2, 3]:
                    return 'B', i
            except: pass
    return 'A', None

# ── Format B header extraction ─────────────────────────────────────────────────
def extract_format_b_headers(table_rows, col_nums_idx):
    name_idx  = col_nums_idx - 2
    party_idx = col_nums_idx - 1

    name_row  = table_rows[name_idx]  if 0 <= name_idx  < len(table_rows) else []
    party_row = table_rows[party_idx] if 0 <= party_idx < len(table_rows) else []
    col_nums  = table_rows[col_nums_idx]

    # Count sequential columns
    n_cols = 0
    start_col = 2  # default: data cols start at table index 2
    # Try from col index 2 first
    for cell in col_nums[2:]:
        if cell and re.match(r'^\d+$', str(cell).strip()):
            n_cols += 1
        else:
            if n_cols > 0: break

    # Fallback: maybe cols start at index 0
    if n_cols == 0:
        start_col = 0
        for cell in col_nums:
            if cell and re.match(r'^\d+$', str(cell).strip()):
                n_cols += 1
            else:
                if n_cols > 0: break

    headers = []
    for i in range(n_cols):
        col_idx = i + start_col

        name_raw = ''
        if col_idx < len(name_row) and name_row[col_idx]:
            name_raw = str(name_row[col_idx]).replace('\n', '').strip()
        name_clean = clean_candidate_name(name_raw[::-1])

        party_code = 'IND'
        if party_row and col_idx < len(party_row) and party_row[col_idx]:
            party_raw = str(party_row[col_idx]).replace('\n', '').strip()
            party_code = map_full_party(party_raw[::-1])

        display = f"{name_clean} ({party_code})" if name_clean and len(name_clean) > 1 else f"Candidate ({party_code})"
        headers.append({'col_idx': col_idx, 'name': display, 'party': party_code})

    return headers, n_cols, start_col

# ── Postal ballot extraction ───────────────────────────────────────────────────
def extract_postal_votes(all_table_rows, n_candidate_cols):
    """Find postal ballot row and extract per-candidate vote counts."""
    for row in all_table_rows:
        if not row: continue
        row_text = ' '.join(str(c or '') for c in row[:4]).lower()
        if 'postal' in row_text or 'ballot' in row_text:
            # Values start after label columns (find first numeric run)
            vals = []
            started = False
            for c in row:
                v = clean_number(c)
                s = str(c or '').strip()
                if s and re.match(r'^[\d,]+$', s):
                    vals.append(v)
                    started = True
                elif started and not s:
                    vals.append(0)
            if len(vals) >= n_candidate_cols:
                return vals[:n_candidate_cols]
            # If shorter, pad
            if vals:
                return (vals + [0]*n_candidate_cols)[:n_candidate_cols]
    return None

# ── Main parser ────────────────────────────────────────────────────────────────
def parse_pdf(filepath):
    all_rows = []
    constituency_name = "Unknown"
    total_electors = 0
    column_headers = []
    headers_extracted = False
    pdf_format = 'A'
    postal_votes = None
    all_table_rows_flat = []
    data_col_start = 2  # which table column index is the first data column

    with pdfplumber.open(filepath) as pdf:
        num_pages = len(pdf.pages)
        first_text = pdf.pages[0].extract_text() or ""

        for page_num, page in enumerate(pdf.pages):
            raw_tables = page.extract_tables()
            if not raw_tables:
                continue

            for table in raw_tables:
                if not table or len(table) < 3:
                    continue

                all_table_rows_flat.extend(table)

                # Detect format and extract headers on first valid table
                if not headers_extracted:
                    fmt, col_nums_idx = detect_format(table)
                    pdf_format = fmt

                    # Get constituency info
                    title_text = str(table[0][0] or '') if table and table[0] else ''
                    constituency_name, total_electors = extract_meta(first_text, title_text)

                    if fmt == 'A':
                        found_tables = page.find_tables()
                        if found_tables:
                            ft = found_tables[0]
                            table_top = ft.bbox[1]
                            data_row_obj = None
                            for row_obj in ft.rows:
                                try:
                                    cx0, ct, cx1, cb = row_obj.cells[0]
                                    txt = (page.within_bbox((cx0, ct, cx1, cb)).extract_text() or '').strip()
                                    if re.match(r'^\d+$', txt) and int(txt) < 5000:
                                        data_row_obj = row_obj
                                        break
                                except: continue
                            if data_row_obj:
                                hdrs = []
                                for i, cell in enumerate(data_row_obj.cells):
                                    cx0, ct, cx1, cb = cell
                                    display, party = extract_format_a_header(page, cx0, cx1, table_top)
                                    hdrs.append({'col_idx': i, 'name': display, 'party': party})
                                if len(hdrs) > 5:
                                    column_headers = hdrs
                                    headers_extracted = True
                                    data_col_start = 2
                    else:
                        hdrs, n_cols, start_col = extract_format_b_headers(table, col_nums_idx)
                        if hdrs:
                            # Prepend dummy entries for SlNo and BoothNo columns if needed
                            prefix = [{'col_idx': i, 'name': None, 'party': None} for i in range(start_col)]
                            column_headers = prefix + hdrs
                            headers_extracted = True
                            data_col_start = start_col

                # Determine data start row index
                data_start = 0
                if pdf_format == 'B':
                    _, cn_idx = detect_format(table)
                    if cn_idx is not None:
                        data_start = cn_idx + 1

                # Extract data rows
                for row_i, row in enumerate(table):
                    if row_i < data_start: continue
                    if not row: continue

                    cells = [str(c).strip().replace('\n', ' ') if c is not None else '' for c in row]
                    if len(cells) < 5: continue

                    # Serial number in first cell
                    sl_no = cells[0].strip()
                    if not re.match(r'^\d+$', sl_no): continue
                    if int(sl_no) > 5000: continue

                    # Booth ID in second cell
                    booth_id = cells[1].strip()
                    if not booth_id: continue

                    # Skip summary rows
                    if is_summary_text(' '.join(cells[:4])): continue

                    vote_data = list(cells[data_col_start:])
                    while vote_data and vote_data[-1] == '': vote_data.pop()
                    if len(vote_data) < 5: continue

                    values = [clean_number(v) for v in vote_data]
                    if sum(values) == 0: continue
                    check = values[:25] if len(values) > 25 else values
                    if max(check) > 50000: continue

                    all_rows.append({
                        "booth": booth_id, "values": values,
                        "page": page_num + 1, "_sl": int(sl_no)
                    })

    all_rows.sort(key=lambda x: x.pop('_sl', 0))

    if not all_rows:
        return {
            "constituency": constituency_name, "totalElectors": total_electors,
            "rows": [], "columns": [], "partyMap": {}, "totalBooths": 0,
            "pageCount": num_pages, "columnCount": 0, "postalVotes": None,
            "error": "No data rows extracted"
        }

    # Normalize column counts
    cnt = Counter(len(r['values']) for r in all_rows)
    most_common = cnt.most_common(1)[0][0]
    norm = []
    for r in all_rows:
        v = r['values']
        if len(v) < most_common: v += [0] * (most_common - len(v))
        elif len(v) > most_common: v = v[:most_common]
        norm.append({"booth": r['booth'], "values": v, "page": r['page']})
    all_rows = norm

    # Build column name list + partyMap
    if pdf_format == 'A':
        data_hdrs = [h for h in column_headers if h['col_idx'] >= 2]
        columns, party_map = [], {}
        for i in range(most_common):
            match = next((h for h in data_hdrs if h['col_idx'] == i + 2), None)
            if match and match['name']:
                columns.append(match['name'])
                if match['party'] and match['party'] not in ('SUMMARY', None):
                    party_map[str(i)] = match['party']
            else:
                columns.append(f'Col{i+1}')
    else:
        cand_hdrs = [h for h in column_headers if h.get('name')]
        columns, party_map = [], {}
        for i in range(most_common):
            if i < len(cand_hdrs):
                h = cand_hdrs[i]
                columns.append(h['name'] or f'Col{i+1}')
                if h['party']:
                    party_map[str(i)] = h['party']
            else:
                columns.append(f'Col{i+1}')

    # Enforce standard trailing summary column labels
    SUMMARY_LABELS = ['Total Valid Votes', 'Rejected Votes', 'NOTA', 'Total Votes', 'Tendered Votes']
    for i, lbl in enumerate(SUMMARY_LABELS):
        pos = most_common - len(SUMMARY_LABELS) + i
        if 0 <= pos < most_common:
            cl = columns[pos].lower().replace(' ', '')
            if any(k in cl for k in ['total', 'nota', 'rejected', 'tendered', 'col', 'valid']):
                columns[pos] = lbl

    # Number of candidate columns = total - 5 summary cols
    n_cand_cols = most_common - 5
    if n_cand_cols < 1:
        n_cand_cols = most_common - 3

    # Extract postal votes
    pv = extract_postal_votes(all_table_rows_flat, n_cand_cols)
    if pv:
        if len(pv) < n_cand_cols:
            pv = pv + [0] * (n_cand_cols - len(pv))
        postal_votes = pv[:n_cand_cols]

    return {
        "constituency": constituency_name,
        "totalElectors": total_electors,
        "rows": all_rows,
        "columns": columns,
        "partyMap": party_map,
        "totalBooths": len(all_rows),
        "pageCount": num_pages,
        "columnCount": most_common,
        "nCandidateCols": n_cand_cols,
        "postalVotes": postal_votes,
        "pdfFormat": pdf_format,
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python parse_form20.py <pdf_path>"}))
        sys.exit(1)
    try:
        result = parse_pdf(sys.argv[1])
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e), "traceback": traceback.format_exc()}))
        sys.exit(1)