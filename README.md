# TN Election Analyzer — Render Deployment Guide

## 📁 Project Structure
```
tn-election-analyzer/
├── client/                  # React frontend
│   ├── public/index.html
│   ├── src/
│   │   ├── App.jsx          # Main dashboard
│   │   └── index.js         # Entry point
│   └── package.json
├── server/                  # Node.js API
│   ├── index.js             # Express server
│   └── package.json
├── parser/                  # Python PDF parsers
│   ├── parse_form20.py      # ⚠️ COPY FROM YOUR LOCAL
│   ├── parse_booth_list.py  # Booth list parser
│   └── requirements.txt
├── booth_lists/             # Drop booth PDFs here
│   └── AC064_booths.pdf     # Example
├── Dockerfile               # Multi-stage build
├── render.yaml              # Render blueprint
├── .dockerignore
├── .gitignore
└── package.json             # Root scripts
```

## 🚀 Deploy to Render (Free Tier) — Step by Step

### Step 1: Prepare your repo

```bash
# Create a new folder or use this one
cd tn-election-analyzer

# ⚠️ IMPORTANT: Copy your parse_form20.py into parser/
cp /path/to/your/local/parser/parse_form20.py parser/

# (Optional) Copy any booth list PDFs
cp /path/to/AC064_booths.pdf booth_lists/
cp /path/to/AC070_booths.pdf booth_lists/
```

### Step 2: Push to GitHub

```bash
git init
git add .
git commit -m "TN Election Analyzer - Render deploy"

# Create a repo on GitHub (private is fine)
# Go to https://github.com/new → name it "tn-election-analyzer"

git remote add origin https://github.com/YOUR_USERNAME/tn-election-analyzer.git
git branch -M main
git push -u origin main
```

### Step 3: Deploy on Render

1. Go to **https://render.com** → Sign up (free, no card needed)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account → Select **tn-election-analyzer** repo
4. Configure:
   - **Name**: `tn-election-analyzer`
   - **Region**: Singapore (closest to Chennai)
   - **Runtime**: **Docker**
   - **Instance Type**: **Free**
   - **Docker File Path**: `./Dockerfile`
5. Click **"Deploy Web Service"**
6. Wait 3–5 minutes for the first build

### Step 4: Your app is live! 🎉

You'll get a URL like:
```
https://tn-election-analyzer.onrender.com
```

Share this URL with your party president to test.

---

## ⚠️ Free Tier Notes

| Aspect | Detail |
|--------|--------|
| **Cost** | ₹0 — completely free |
| **Sleep** | App sleeps after 15 min idle, wakes in ~30 sec on next visit |
| **RAM** | 512 MB (sufficient for PDF parsing) |
| **Storage** | Ephemeral — uploaded booth_lists are lost on redeploy |
| **Bandwidth** | 100 GB/month |

### Keep it awake (optional)
Sign up at **https://uptimerobot.com** (free) and add an HTTP monitor pointing to:
```
https://tn-election-analyzer.onrender.com/health
```
Set interval to 5 minutes. This prevents the sleep timeout.

---

## 🔧 Local Development

```bash
# Terminal 1: Start server
cd server && npm install && node index.js

# Terminal 2: Start React dev server
cd client && npm install && npm start

# Opens at http://localhost:3000 (proxies API to :3001)
```

---

## 📊 Adding Booth Lists After Deploy

Since free tier storage is ephemeral, include booth PDFs in the repo:

```bash
# Add a new booth list
cp AC059_booths.pdf booth_lists/
git add booth_lists/AC059_booths.pdf
git commit -m "Add Dharmapuri booth list"
git push
# Render auto-redeploys
```

---

## 🔄 Updating the App

Any `git push` to main branch triggers auto-redeploy on Render:

```bash
# Make changes...
git add .
git commit -m "Fix XYZ"
git push
# Render rebuilds automatically in 3-5 min
```
