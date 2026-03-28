const express = require('express');
const multer  = require('multer');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const { spawn } = require('child_process');
const os      = require('os');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ── Serve React build (production) ──────────────────────────────
const clientBuild = path.join(__dirname, '..', 'client', 'build');
if (fs.existsSync(clientBuild)) {
  app.use(express.static(clientBuild));
}

// ── File upload config ──────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(os.tmpdir(), 'tn-election-uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `form20-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`)
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) =>
    file.mimetype === 'application/pdf' ? cb(null, true) : cb(new Error('Only PDF files allowed'), false),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// ── Health check (keeps Render free tier awake) ─────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── PDF Parse API ───────────────────────────────────────────────
app.post('/api/parse', upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No PDF uploaded' });

  const filePath     = req.file.path;
  const parserScript = path.join(__dirname, '..', 'parser', 'parse_form20.py');
  const pythonCmd    = process.platform === 'win32' ? 'python' : 'python3';

  try {
    const raw = await runParser(pythonCmd, parserScript, filePath);
    fs.unlink(filePath, () => {});
    if (raw.error) return res.status(422).json({ error: raw.error, details: raw.traceback });
    res.json(postProcess(raw));
  } catch (err) {
    fs.unlink(filePath, () => {});
    res.status(500).json({ error: err.message });
  }
});

// ── Booth List API ──────────────────────────────────────────────
app.get('/api/booth-list/:acNum', async (req, res) => {
  const acNum    = req.params.acNum.padStart(3, '0');
  const boothDir = path.join(__dirname, '..', 'booth_lists');

  if (!fs.existsSync(boothDir)) {
    return res.json({ found: false, error: 'booth_lists directory not found' });
  }

  const files    = fs.readdirSync(boothDir);
  const patterns = [
    `AC${acNum}_booths`, `AC${acNum.replace(/^0+/, '')}_booths`,
    `ac${acNum}_booths`, `ac${acNum.replace(/^0+/, '')}_booths`,
    `${acNum}_booths`,   `${acNum.replace(/^0+/, '')}_booths`,
  ];

  let boothFile = null;
  for (const f of files) {
    const lower = f.toLowerCase().replace(/[-\s]/g, '_');
    if (patterns.some(p => lower.startsWith(p.toLowerCase()))) {
      boothFile = path.join(boothDir, f);
      break;
    }
  }

  if (!boothFile) {
    return res.json({ found: false, error: `No booth list for AC ${acNum}` });
  }

  const parserScript = path.join(__dirname, '..', 'parser', 'parse_booth_list.py');
  const pythonCmd    = process.platform === 'win32' ? 'python' : 'python3';

  try {
    const result = await new Promise((resolve, reject) => {
      let out = '', err = '';
      const p = spawn(pythonCmd, [parserScript, boothFile], { timeout: 60000 });
      p.stdout.on('data', d => out += d);
      p.stderr.on('data', d => err += d);
      p.on('close', () => {
        try { resolve(JSON.parse(out)); }
        catch (e) { reject(new Error(`Parser output invalid: ${out.slice(0, 300)}`)); }
      });
      p.on('error', e => reject(new Error(`Python failed: ${e.message}`)));
    });

    if (result.booths && Object.keys(result.booths).length > 0) {
      res.json({ found: true, booths: result.booths, count: result.count, filename: path.basename(boothFile) });
    } else {
      res.json({ found: false, error: 'Parser returned no booths', filename: path.basename(boothFile) });
    }
  } catch (err) {
    res.json({ found: false, error: err.message });
  }
});

// ── Booth List Upload (so users can upload booth PDFs via UI) ────
const boothUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, '..', 'booth_lists');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, file.originalname)
  }),
  limits: { fileSize: 20 * 1024 * 1024 }
});

app.post('/api/booth-list/upload', boothUpload.single('boothFile'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ success: true, filename: req.file.originalname });
});

// ── Python runner ───────────────────────────────────────────────
function runParser(cmd, script, file) {
  return new Promise((resolve, reject) => {
    let out = '', err = '';
    const p = spawn(cmd, [script, file], { timeout: 120000 });
    p.stdout.on('data', d => out += d);
    p.stderr.on('data', d => err += d);
    p.on('close', () => {
      if (err) console.error('Parser stderr:', err.slice(0, 500));
      try { resolve(JSON.parse(out)); }
      catch (e) { reject(new Error(`Parser output invalid: ${out.slice(0, 300)}`)); }
    });
    p.on('error', e => reject(new Error(`Python failed: ${e.message}`)));
  });
}

// ── Post-process parsed data ────────────────────────────────────
function postProcess(data) {
  const { rows, columns, constituency, totalElectors, totalBooths,
          postalVotes, nCandidateCols, pdfFormat,
          evmTotalRow, postalTotalRow, combinedTotalRow } = data;

  const summarySet = new Set();
  ['total valid','rejected','nota','total votes','tendered'].forEach(kw => {
    const idx = columns.findIndex(c => c.toLowerCase().includes(kw));
    if (idx >= 0) summarySet.add(idx);
  });

  const enriched = rows.map(row => {
    const values = row.values || [];
    const candidateVotes = values.filter((_, i) => !summarySet.has(i));
    const notaIdx  = columns.findIndex(c => c.toLowerCase().includes('nota'));
    const rejIdx   = columns.findIndex(c => c.toLowerCase().includes('rejected'));
    const totalIdx = columns.findIndex(c => c.toLowerCase().includes('total votes') && !c.toLowerCase().includes('valid'));
    const nota     = notaIdx  >= 0 ? (values[notaIdx]  || 0) : 0;
    const rejected = rejIdx   >= 0 ? (values[rejIdx]   || 0) : 0;
    const reported = totalIdx >= 0 ? (values[totalIdx] || 0) : 0;
    const computed = candidateVotes.reduce((a, b) => a + b, 0);
    return { ...row, candidateVotes, nota, rejected, reportedTotal: reported || computed };
  });

  const candidateColumns = columns.filter((_, i) => !summarySet.has(i));
  const evmTotals = candidateColumns.map((_, ci) =>
    enriched.reduce((s, r) => s + (r.candidateVotes[ci] || 0), 0)
  );
  const postalTotals   = postalVotes || Array(candidateColumns.length).fill(0);
  const combinedTotals = evmTotals.map((v, i) => v + (postalTotals[i] || 0));

  const officialEVM = evmTotalRow
    ? evmTotalRow.filter((_, i) => !summarySet.has(i)).reduce((s, v) => s + (v || 0), 0)
    : evmTotals.reduce((s, v) => s + v, 0);
  const officialPostal = postalTotalRow
    ? postalTotalRow.filter((_, i) => !summarySet.has(i)).reduce((s, v) => s + (v || 0), 0)
    : postalTotals.reduce((s, v) => s + v, 0);
  const officialCombined = combinedTotalRow
    ? combinedTotalRow.filter((_, i) => !summarySet.has(i)).reduce((s, v) => s + (v || 0), 0)
    : combinedTotals.reduce((s, v) => s + v, 0);

  const totalNOTA     = enriched.reduce((s, r) => s + r.nota, 0);
  const totalRejected = enriched.reduce((s, r) => s + r.rejected, 0);

  return {
    constituency, totalElectors, totalBooths, pdfFormat,
    columns, candidateColumns,
    evmCandidateTotals: evmTotals,
    postalVotes: postalTotals.length === candidateColumns.length ? postalTotals : Array(candidateColumns.length).fill(0),
    candidateTotals: combinedTotals,
    rows: enriched,
    officialEVM, officialPostal, officialCombined,
    totalVotesCast: officialCombined + totalNOTA + totalRejected,
    totalNOTA, totalRejected,
  };
}

// ── SPA fallback ────────────────────────────────────────────────
if (fs.existsSync(clientBuild)) {
  app.get('*', (req, res) => res.sendFile(path.join(clientBuild, 'index.html')));
}

app.listen(PORT, () => console.log(`TN Election API → http://localhost:${PORT}`));
