#!/usr/bin/env python3
"""
Parse booth list files into a dict keyed by Polling Station No.
Supported formats: pipe-separated markdown table (.txt), PDF, DOCX, CSV, XLSX.

Output:
{
  "1": {
    "locality": "Meppathurai",
    "pincode":  "606802",
    "building": "Panchayat Union Middle School, New Building Room No 8",
    "area":     "1. Ward 1 Old Colony North Street\n2. ...",
    "gender":   "All Voters"
  }, ...
}
"""
import sys, json, re, traceback
from pathlib import Path

# ── helpers ───────────────────────────────────────────────────────────────────
def ws(s):
    """Collapse whitespace."""
    return re.sub(r'\s+', ' ', str(s or '')).strip()

def clean_area(raw):
    """Convert '<br>' delimiters to newlines, strip blanks, remove 999. Overseas."""
    text = re.sub(r'<br\s*/?>', '\n', raw, flags=re.I)
    lines = []
    for line in text.split('\n'):
        line = line.strip()
        if not line:
            continue
        # Keep 999.Overseas but mark it; caller can filter if needed
        lines.append(line)
    return '\n'.join(lines)

def parse_row(row, col_map):
    """Extract booth fields from one data row using col_map."""
    def get(key):
        idx = col_map.get(key)
        return ws(row[idx]) if idx is not None and idx < len(row) else ''

    booth_no   = get('booth')
    locality   = get('locality')
    building   = get('building')
    area_raw   = get('area')
    gender     = get('gender')

    # Validate: booth_no must be numeric (or simple alphanumeric like '1A')
    if not booth_no or not re.search(r'\d', booth_no):
        return None, None
    # Skip separator rows like '------'
    if re.match(r'^[-=\s]+$', booth_no):
        return None, None
    # Skip header rows
    if any(k in booth_no.lower() for k in ['polling', 'station', 'sl', 'serial', 'no.']):
        return None, None

    locality_short = re.sub(r'\s*\d{6}\s*$', '', locality).strip()
    pincode        = (re.search(r'\d{6}', locality) or type('',(),{'group':lambda *a:''})()).group(0) if re.search(r'\d{6}', locality) else ''

    return str(booth_no), {
        'locality': locality_short or locality,
        'pincode':  pincode,
        'building': building,
        'area':     clean_area(area_raw),
        'gender':   gender or 'All Voters',
    }

def detect_col_map(header_cells):
    """Map column roles to indices from header row."""
    col_map = {}
    for i, cell in enumerate(header_cells):
        c = cell.lower().strip()
        # Booth / PS number — match: "Polling Station No", "PS No", "PS No.", "Station No"
        if not col_map.get('booth') and re.search(r'(polling\s+station\s+no|^ps\s*no\.?$|station\s+no)', c):
            col_map['booth'] = i
        # Locality — match: "Locality of Polling Station", "Locality", etc.
        elif re.search(r'locality', c):
            col_map['locality'] = i
        # Building — match: "Building in which", "Building", etc.
        elif re.search(r'building', c):
            col_map['building'] = i
        # Polling Area
        elif re.search(r'polling\s+area', c):
            col_map['area'] = i
        # Gender — match: "Whether for all voters", "men only", "women only"
        elif re.search(r'whether|men only|women only|all\s+voter', c):
            col_map['gender'] = i
        # Skip known non-booth columns so they don't accidentally match
        # "Sl. No", "Sl No", "Part No" — just ignore these
    return col_map

def parse_rows(all_rows):
    """Given a list of rows (each a list of strings), return booths dict."""
    booths   = {}
    col_map  = {}
    header_found = False

    for row in all_rows:
        if not row: continue
        cells = [ws(c) for c in row]

        # Detect header row — look for key column names
        joined = ' '.join(cells).lower()
        if not header_found and (
            'polling station no' in joined or
            'ps no' in joined or
            ('locality' in joined and ('building' in joined or 'polling area' in joined))
        ):
            col_map = detect_col_map(cells)
            header_found = True
            continue

        # Skip separator rows (all cells are dashes/equals)
        if all(re.match(r'^[-=\s|]+$', c) for c in cells if c):
            continue

        if not col_map:
            # Fallback: try to infer from column count
            n = len(cells) if cells else 0
            if n >= 7:
                # 7-col format: Sl.No | Part No | PS No | Locality | Building | Polling Area | Gender
                col_map = {
                    'booth':    2,
                    'locality': 3,
                    'building': 4,
                    'area':     5,
                    'gender':   6,
                }
            else:
                # 6-col format: Sl.No | Polling Station No | Locality | Building | Polling Area | Gender
                col_map = {
                    'booth':    1,
                    'locality': 2,
                    'building': 3,
                    'area':     4,
                    'gender':   5,
                }

        key, info = parse_row(cells, col_map)
        if key and info:
            booths[key] = info

    return booths

# ── Format-specific readers ───────────────────────────────────────────────────

def read_txt(filepath):
    """Pipe-separated or tab-separated text / markdown table."""
    for enc in ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252']:
        try:
            content = Path(filepath).read_text(encoding=enc)
            break
        except:
            content = ''

    rows = []
    for line in content.splitlines():
        line = line.strip()
        if not line:
            continue
        # Pipe-separated markdown table row: | a | b | c |
        if '|' in line:
            parts = [p.strip() for p in line.split('|')]
            # Remove empty first/last elements from leading/trailing pipes
            if parts and parts[0] == '':  parts = parts[1:]
            if parts and parts[-1] == '': parts = parts[:-1]
            rows.append(parts)
        elif '\t' in line:
            rows.append(line.split('\t'))
        else:
            rows.append([line])

    return parse_rows(rows)

def read_csv(filepath):
    import csv
    for enc in ['utf-8', 'utf-8-sig', 'latin-1']:
        try:
            with open(filepath, encoding=enc, newline='') as f:
                rows = list(csv.reader(f))
            return parse_rows(rows)
        except: pass
    return {}

def read_xlsx(filepath):
    try:
        import openpyxl
        wb = openpyxl.load_workbook(filepath, data_only=True)
        ws = wb.active
        rows = [[str(c.value or '') for c in row] for row in ws.iter_rows()]
        return parse_rows(rows)
    except: return {}

def read_docx(filepath):
    try:
        from docx import Document
        doc = Document(filepath)
        rows = []
        for table in doc.tables:
            for row in table.rows:
                rows.append([ws(cell.text) for cell in row.cells])
        return parse_rows(rows)
    except: return {}

def read_pdf(filepath):
    try:
        import pdfplumber
        rows = []
        with pdfplumber.open(filepath) as pdf:
            for page in pdf.pages:
                for table in (page.extract_tables() or []):
                    rows.extend(table)
        return parse_rows(rows)
    except: return {}

def parse_file(filepath):
    ext = Path(filepath).suffix.lower()
    readers = {
        '.txt':  read_txt,
        '.md':   read_txt,
        '.csv':  read_csv,
        '.tsv':  read_txt,
        '.xlsx': read_xlsx,
        '.xls':  read_xlsx,
        '.docx': read_docx,
        '.pdf':  read_pdf,
    }
    fn = readers.get(ext)
    if fn:
        result = fn(filepath)
        if result: return result
    # Fallback: try all readers
    for fn in [read_txt, read_pdf, read_docx, read_csv, read_xlsx]:
        try:
            result = fn(filepath)
            if result: return result
        except: pass
    return {}

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Usage: parse_booth_list.py <file>'}))
        sys.exit(1)
    try:
        booths = parse_file(sys.argv[1])
        print(json.dumps({'booths': booths, 'count': len(booths)}, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'error': str(e), 'traceback': traceback.format_exc()}))
        sys.exit(1)
