# 📄 LocalDocKit

> **Privacy-First, 100% Offline Local Web Suite for PDF & Image Utilities**

LocalDocKit is a clean, lightweight, completely local web application that provides an all-in-one suite of PDF and Image manipulation tools directly inside your browser.

All processing runs entirely on your local machine using Python. **Zero files are uploaded to external servers, zero paid APIs are used, and zero third-party CDNs are required.**

---

## 🌟 Key Features

### 1. 📑 PDF Merge
- Combine multiple PDF files into a single consolidated document.
- Visual file queue with file size previews.
- Reorder documents on the fly using Move Up / Move Down controls before merging.
- Easily remove individual documents or clear the list.

### 2. ✂️ PDF Split & Extraction
- Inspect uploaded PDFs instantly to see page count and document status.
- **Custom Range Mode**: Extract specific pages or ranges (e.g. `1-3, 5, 8-10`) into a new single PDF.
- **Split Every Page Mode**: Split each page into its own individual PDF packaged neatly into a downloadable `.zip` archive.

### 3. 🗜️ PDF Compression & Optimization
- Reduce PDF file size by deduplicating internal objects and optimizing content streams.
- Three tailored compression profiles:
  - **Low**: Lossless stream compression and orphan object cleanup.
  - **Medium (Recommended)**: Stream optimization + 70% image compression balance.
  - **High**: Maximum reduction with 45% image downscaling and aggressive compression.
- Live Before vs. After comparison card showing exact space saved in KB/MB and percentage.

### 4. 🖼️ Image Converter & Privacy Cleaner
- Batch convert images between **WebP**, **PNG**, and **JPEG**.
- Configurable quality slider (10% to 100%).
- **Strip EXIF & GPS Metadata** (enabled by default): Automatically removes private GPS location tags, camera metadata, timestamps, and lens information from photos.
- Optional proportional image resizing by max width (e.g., scale high-res photos down to 1920px).
- Generates single file download or a bundled `.zip` archive for batch conversions.

### 5. 🌐 Webpage to PDF Grabber
- Capture and convert any live website, blog post, or article into a clean, pixel-perfect PDF.
- Preserves full HTML formatting, CSS stylesheets, fonts, and images (rendered via built-in Chromium engine).
- Supports Portrait and Landscape orientations.
- Includes quick presets for common testing sites.

---

## ⚡ Real-Time Progress & Estimated Time Remaining (ETR)

All 5 tools feature an integrated live progress indicator:
- **Visual Progress Bar**: Real-time animated progress track.
- **Percentage Indicator**: 0% to 100% completion status.
- **Dynamic Time Estimation**: Live countdown calculating remaining seconds (`⏳ Estimated: ~3s remaining`) based on elapsed time and current progress.

---

## 🔒 Privacy & Architecture Highlights

- **100% Offline & Self-Contained**: The frontend interface uses pure semantic HTML5, CSS variables, and Vanilla JavaScript with inline SVG icons. It works without internet access and requires no external CDNs or Node.js/npm dependencies.
- **In-Memory Stream Processing**: Files are processed in memory using Python byte streams and cleaned up immediately after request completion.
- **Light / Dark Mode**: Built-in modern slate & obsidian dark theme alongside a crisp light mode, switchable with a single click and remembered locally.
- **Zero-Click Auto-Launch**: Starting `python app.py` binds to an available local port and opens the app in your default browser.

---

## 🚀 Quick Start Guide

### Option A: Standalone Portable EXE (No Python Required)
1. Head over to the **[GitHub Releases](https://github.com/DumbWeirdoC/LocalDocKit/releases)** tab.
2. Download **`LocalDocKit.exe`**.
3. Double-click to launch! The local server starts and automatically opens the dashboard in your default browser.

---

### Option B: Run from Source or Batch Launcher
```bash
git clone https://github.com/DumbWeirdoC/LocalDocKit.git
cd LocalDocKit
```

**On Windows:**
Double-click `Launch-LocalDocKit.bat` (it automatically sets up the virtual environment, verifies dependencies, and launches the app).

**Or manually via Terminal:**
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```
> LocalDocKit will start on `http://127.0.0.1:8001` (or next available port) and open your browser automatically.

#### Optional CLI Flags:
- Run on custom port: `python app.py --port 8080`
- Run headless (without opening browser): `python app.py --no-browser`

---

## 📁 Project Structure

```text
LocalDocKit/
│
├── app.py              # FastAPI server endpoints, lifecycle management & auto-launch
├── processors.py       # Core PDF (pypdf) and image (Pillow) manipulation logic
├── requirements.txt    # Minimal dependencies (fastapi, uvicorn, pypdf, Pillow, python-multipart)
├── .gitignore          # Git exclusion rules
├── README.md           # Documentation and guides
│
└── static/             # 100% self-contained frontend (zero CDN dependencies)
    ├── index.html      # Responsive dashboard with 4 dedicated tool panels
    ├── style.css       # Clean light/dark mode stylesheet with CSS variables
    └── script.js       # Client logic: drag-and-drop, reordering, validation & downloads
```

---

## 📜 License

Open source and free for personal and commercial use under the standard MIT terms.
