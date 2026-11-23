/**
 * LocalDocKit - 100% Offline PDF & Image Processing Suite
 * Vanilla JavaScript (Zero External Dependencies)
 */

document.addEventListener("DOMContentLoaded", () => {
  // Utility: Format bytes
  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  // Toast Helper
  const toastEl = document.getElementById("toast");
  let toastTimer = null;
  function showToast(msg, isError = false) {
    if (toastTimer) clearTimeout(toastTimer);
    toastEl.textContent = msg;
    toastEl.style.borderLeftColor = isError ? "var(--danger)" : "var(--primary)";
    toastEl.classList.add("show");
    toastTimer = setTimeout(() => {
      toastEl.classList.remove("show");
    }, 3200);
  }

  // Trigger File Download from Blob
  function downloadBlob(blob, defaultFilename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = defaultFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // ==========================================
  // UNIFIED LIVE PROGRESS & ETR TRACKER
  // ==========================================
  class ProgressTracker {
    constructor() {
      this.modal = document.getElementById("progressModal");
      this.titleEl = document.getElementById("progressModalTitle");
      this.stepEl = document.getElementById("progressStepText");
      this.fillEl = document.getElementById("modalProgressFill");
      this.percentEl = document.getElementById("modalProgressPercent");
      this.etaEl = document.getElementById("modalProgressEta");

      this.timer = null;
      this.startTime = 0;
      this.currentPercent = 0;
      this.targetPercent = 0;
      this.estimatedTotalSeconds = 5;
    }

    start(title, initialStep, estimatedSeconds = 5) {
      this.titleEl.textContent = title;
      this.stepEl.textContent = initialStep;
      this.currentPercent = 5;
      this.targetPercent = 25;
      this.estimatedTotalSeconds = Math.max(2, estimatedSeconds);
      this.startTime = Date.now();

      this.updateUI(5, this.estimatedTotalSeconds);
      this.modal.style.display = "flex";

      if (this.timer) clearInterval(this.timer);
      this.timer = setInterval(() => this.tick(), 200);
    }

    setStep(stepText, targetPercent) {
      this.stepEl.textContent = stepText;
      if (targetPercent) {
        this.targetPercent = Math.min(94, targetPercent);
      }
    }

    tick() {
      const elapsedSec = (Date.now() - this.startTime) / 1000;

      // Smooth progression towards targetPercent
      if (this.currentPercent < this.targetPercent) {
        this.currentPercent += Math.max(0.6, (this.targetPercent - this.currentPercent) * 0.18);
      } else if (this.currentPercent < 93) {
        // Steady crawl while waiting for server response
        this.currentPercent += 0.35;
      }

      const roundedPercent = Math.min(94, Math.round(this.currentPercent));

      // Calculate Estimated Time Remaining (ETR)
      let remainingSec;
      if (elapsedSec > 0.6 && roundedPercent > 6) {
        const projectedTotal = (elapsedSec / roundedPercent) * 100;
        remainingSec = Math.max(1, Math.round(projectedTotal - elapsedSec));
      } else {
        remainingSec = Math.max(1, Math.round(this.estimatedTotalSeconds - elapsedSec));
      }

      this.updateUI(roundedPercent, remainingSec);
    }

    updateUI(percent, remainingSec) {
      this.fillEl.style.width = `${percent}%`;
      this.percentEl.textContent = `${percent}%`;
      if (percent >= 100) {
        this.etaEl.textContent = "✅ Complete!";
      } else if (remainingSec !== undefined) {
        this.etaEl.textContent = `⏳ Estimated: ~${remainingSec}s remaining`;
      } else {
        this.etaEl.textContent = "⏳ Estimated: calculating...";
      }
    }

    complete(finalStep = "Done! Generating download...") {
      if (this.timer) clearInterval(this.timer);
      this.stepEl.textContent = finalStep;
      this.updateUI(100, 0);

      setTimeout(() => {
        this.modal.style.display = "none";
        this.currentPercent = 0;
        this.fillEl.style.width = "0%";
      }, 700);
    }

    fail() {
      if (this.timer) clearInterval(this.timer);
      this.modal.style.display = "none";
    }
  }

  const tracker = new ProgressTracker();

  // 1. Theme Toggle
  const themeToggle = document.getElementById("themeToggle");
  const themeIconSun = document.getElementById("themeIconSun");
  const themeIconMoon = document.getElementById("themeIconMoon");
  const htmlRoot = document.documentElement;

  function applyTheme(theme) {
    htmlRoot.setAttribute("data-theme", theme);
    localStorage.setItem("localdockit-theme", theme);
    if (theme === "light") {
      themeIconSun.style.display = "none";
      themeIconMoon.style.display = "block";
    } else {
      themeIconSun.style.display = "block";
      themeIconMoon.style.display = "none";
    }
  }

  const savedTheme = localStorage.getItem("localdockit-theme") || "dark";
  applyTheme(savedTheme);

  themeToggle.addEventListener("click", () => {
    const current = htmlRoot.getAttribute("data-theme") || "dark";
    applyTheme(current === "dark" ? "light" : "dark");
  });

  // 2. Navigation Tabs
  const navTabs = document.querySelectorAll(".nav-tab");
  const toolPanels = document.querySelectorAll(".tool-panel");

  navTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      navTabs.forEach((t) => t.classList.remove("active"));
      toolPanels.forEach((p) => p.classList.remove("active"));

      tab.classList.add("active");
      const tabKey = tab.getAttribute("data-tab");
      const targetPanel = document.getElementById(`tab-${tabKey}`);
      if (targetPanel) targetPanel.classList.add("active");
    });
  });

  // Helper for drag & drop
  function setupDropzoneEvents(dropzone, inputEl, handler) {
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handler(Array.from(e.dataTransfer.files));
      }
    });
  }

  // ==========================================
  // TAB 1: PDF MERGE
  // ==========================================
  const mergeDropzone = document.getElementById("mergeDropzone");
  const mergeFileInput = document.getElementById("mergeFileInput");
  const mergeFileListCard = document.getElementById("mergeFileListCard");
  const mergeFileCount = document.getElementById("mergeFileCount");
  const mergeItemsList = document.getElementById("mergeItemsList");
  const clearMergeList = document.getElementById("clearMergeList");
  const startMergeBtn = document.getElementById("startMergeBtn");

  let mergeFiles = [];

  function renderMergeList() {
    mergeItemsList.innerHTML = "";
    mergeFileCount.textContent = mergeFiles.length;

    if (mergeFiles.length === 0) {
      mergeFileListCard.style.display = "none";
      startMergeBtn.disabled = true;
      return;
    }

    mergeFileListCard.style.display = "block";
    startMergeBtn.disabled = mergeFiles.length < 2;

    mergeFiles.forEach((file, index) => {
      const li = document.createElement("li");
      li.className = "file-item";
      li.innerHTML = `
        <div class="file-item-left">
          <span class="file-idx">${index + 1}</span>
          <span class="file-title" title="${file.name}">${file.name}</span>
          <span class="file-size-tag">${formatBytes(file.size)}</span>
        </div>
        <div class="file-item-actions">
          <button type="button" class="order-btn" data-action="up" data-idx="${index}" title="Move Up" ${index === 0 ? "disabled" : ""}>&uarr;</button>
          <button type="button" class="order-btn" data-action="down" data-idx="${index}" title="Move Down" ${index === mergeFiles.length - 1 ? "disabled" : ""}>&darr;</button>
          <button type="button" class="remove-btn" data-action="remove" data-idx="${index}" title="Remove file">&times;</button>
        </div>
      `;
      mergeItemsList.appendChild(li);
    });
  }

  mergeDropzone.addEventListener("click", () => mergeFileInput.click());
  mergeFileInput.addEventListener("change", (e) => {
    addMergeFiles(Array.from(e.target.files));
    mergeFileInput.value = "";
  });

  function addMergeFiles(files) {
    const validPdfs = files.filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (validPdfs.length === 0) {
      showToast("Please select valid PDF files.", true);
      return;
    }
    mergeFiles = mergeFiles.concat(validPdfs);
    renderMergeList();
    showToast(`Added ${validPdfs.length} PDF(s).`);
  }

  setupDropzoneEvents(mergeDropzone, mergeFileInput, addMergeFiles);

  mergeItemsList.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    const idx = parseInt(btn.getAttribute("data-idx"), 10);

    if (action === "up" && idx > 0) {
      const temp = mergeFiles[idx];
      mergeFiles[idx] = mergeFiles[idx - 1];
      mergeFiles[idx - 1] = temp;
      renderMergeList();
    } else if (action === "down" && idx < mergeFiles.length - 1) {
      const temp = mergeFiles[idx];
      mergeFiles[idx] = mergeFiles[idx + 1];
      mergeFiles[idx + 1] = temp;
      renderMergeList();
    } else if (action === "remove") {
      mergeFiles.splice(idx, 1);
      renderMergeList();
    }
  });

  clearMergeList.addEventListener("click", () => {
    mergeFiles = [];
    renderMergeList();
  });

  startMergeBtn.addEventListener("click", async () => {
    if (mergeFiles.length < 2) return;

    tracker.start("Merging PDF Documents", "Combining documents in specified order...", 3);

    const formData = new FormData();
    const orderList = [];

    mergeFiles.forEach((file) => {
      formData.append("files", file);
      orderList.push(file.name);
    });
    formData.append("order", JSON.stringify(orderList));

    setTimeout(() => tracker.setStep("Writing unified document stream...", 65), 500);

    try {
      const res = await fetch("/api/pdf/merge", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Merge failed");
      }

      const blob = await res.blob();
      tracker.complete("Merged successfully! Downloading...");
      downloadBlob(blob, "merged_document.pdf");
      showToast("PDFs merged successfully!");
    } catch (err) {
      tracker.fail();
      showToast(`Error: ${err.message}`, true);
    }
  });

  // ==========================================
  // TAB 2: PDF SPLIT
  // ==========================================
  const splitDropzone = document.getElementById("splitDropzone");
  const splitFileInput = document.getElementById("splitFileInput");
  const splitInspectCard = document.getElementById("splitInspectCard");
  const splitFileName = document.getElementById("splitFileName");
  const splitFileSize = document.getElementById("splitFileSize");
  const splitTotalPages = document.getElementById("splitTotalPages");
  const removeSplitFile = document.getElementById("removeSplitFile");
  const splitOptionsCard = document.getElementById("splitOptionsCard");
  const rangeInputGroup = document.getElementById("rangeInputGroup");
  const splitRangeInput = document.getElementById("splitRangeInput");
  const startSplitBtn = document.getElementById("startSplitBtn");
  const radioRangeBox = document.getElementById("radioRangeBox");
  const radioAllBox = document.getElementById("radioAllBox");

  let currentSplitFile = null;
  let splitPageCount = 0;

  splitDropzone.addEventListener("click", () => splitFileInput.click());
  splitFileInput.addEventListener("change", (e) => {
    if (e.target.files[0]) handleSplitFile(e.target.files[0]);
    splitFileInput.value = "";
  });

  setupDropzoneEvents(splitDropzone, splitFileInput, (files) => {
    if (files[0]) handleSplitFile(files[0]);
  });

  async function handleSplitFile(file) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      showToast("Please choose a valid PDF file.", true);
      return;
    }

    tracker.start("Inspecting PDF", "Reading document pages and structure...", 2);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/pdf/inspect", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Cannot inspect PDF");
      }

      currentSplitFile = file;
      splitPageCount = data.page_count;

      splitFileName.textContent = file.name;
      splitFileSize.textContent = formatBytes(file.size);
      splitTotalPages.textContent = `${splitPageCount} page${splitPageCount > 1 ? "s" : ""}`;

      splitRangeInput.placeholder = `e.g. 1-${Math.min(3, splitPageCount)}`;
      splitRangeInput.value = splitPageCount > 1 ? `1-${Math.min(2, splitPageCount)}` : "1";

      splitDropzone.style.display = "none";
      splitInspectCard.style.display = "flex";
      splitOptionsCard.style.display = "block";
      startSplitBtn.disabled = false;
      tracker.complete("Ready for split!");
      showToast(`Loaded "${file.name}" (${splitPageCount} pages)`);
    } catch (err) {
      tracker.fail();
      showToast(`Error: ${err.message}`, true);
    }
  }

  removeSplitFile.addEventListener("click", () => {
    currentSplitFile = null;
    splitPageCount = 0;
    splitDropzone.style.display = "flex";
    splitInspectCard.style.display = "none";
    splitOptionsCard.style.display = "none";
    startSplitBtn.disabled = true;
  });

  document.querySelectorAll('input[name="splitMode"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      const isRange = e.target.value === "range";
      radioRangeBox.classList.toggle("active", isRange);
      radioAllBox.classList.toggle("active", !isRange);
      rangeInputGroup.style.display = isRange ? "flex" : "none";
    });
  });

  startSplitBtn.addEventListener("click", async () => {
    if (!currentSplitFile) return;

    const mode = document.querySelector('input[name="splitMode"]:checked').value;
    const rangeVal = splitRangeInput.value.trim();

    if (mode === "range" && !rangeVal) {
      showToast("Please enter a page range.", true);
      splitRangeInput.focus();
      return;
    }

    const estSec = mode === "range" ? 3 : Math.min(10, Math.max(3, Math.round(splitPageCount * 0.4)));
    tracker.start("Splitting Document", "Extracting selected pages...", estSec);

    const formData = new FormData();
    formData.append("file", currentSplitFile);
    formData.append("mode", mode);
    if (mode === "range") {
      formData.append("range_str", rangeVal);
    }

    setTimeout(() => tracker.setStep("Packaging output archive...", 60), 600);

    try {
      const res = await fetch("/api/pdf/split", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Split failed");
      }

      const blob = await res.blob();
      const defaultName = mode === "range" ? "extracted_pages.pdf" : "split_pages.zip";
      tracker.complete("Split completed! Downloading...");
      downloadBlob(blob, defaultName);
      showToast("Split completed & downloaded!");
    } catch (err) {
      tracker.fail();
      showToast(`Error: ${err.message}`, true);
    }
  });

  // ==========================================
  // TAB 3: PDF COMPRESS
  // ==========================================
  const compressDropzone = document.getElementById("compressDropzone");
  const compressFileInput = document.getElementById("compressFileInput");
  const compressInspectCard = document.getElementById("compressInspectCard");
  const compressFileName = document.getElementById("compressFileName");
  const compressFileSize = document.getElementById("compressFileSize");
  const removeCompressFile = document.getElementById("removeCompressFile");
  const compressOptionsCard = document.getElementById("compressOptionsCard");
  const compressResultsCard = document.getElementById("compressResultsCard");
  const statOrigSize = document.getElementById("statOrigSize");
  const statCompSize = document.getElementById("statCompSize");
  const statSavedPercent = document.getElementById("statSavedPercent");
  const startCompressBtn = document.getElementById("startCompressBtn");

  let currentCompressFile = null;

  compressDropzone.addEventListener("click", () => compressFileInput.click());
  compressFileInput.addEventListener("change", (e) => {
    if (e.target.files[0]) handleCompressFile(e.target.files[0]);
    compressFileInput.value = "";
  });

  setupDropzoneEvents(compressDropzone, compressFileInput, (files) => {
    if (files[0]) handleCompressFile(files[0]);
  });

  function handleCompressFile(file) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      showToast("Please select a PDF file to compress.", true);
      return;
    }

    currentCompressFile = file;
    compressFileName.textContent = file.name;
    compressFileSize.textContent = formatBytes(file.size);

    compressDropzone.style.display = "none";
    compressInspectCard.style.display = "flex";
    compressOptionsCard.style.display = "block";
    compressResultsCard.style.display = "none";
    startCompressBtn.disabled = false;
    showToast(`Loaded "${file.name}"`);
  }

  removeCompressFile.addEventListener("click", () => {
    currentCompressFile = null;
    compressDropzone.style.display = "flex";
    compressInspectCard.style.display = "none";
    compressOptionsCard.style.display = "none";
    compressResultsCard.style.display = "none";
    startCompressBtn.disabled = true;
  });

  document.querySelectorAll(".level-card").forEach((card) => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".level-card").forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });
  });

  startCompressBtn.addEventListener("click", async () => {
    if (!currentCompressFile) return;

    const level = document.querySelector('input[name="compressLevel"]:checked').value;
    const estSec = level === "high" ? 7 : (level === "medium" ? 5 : 3);

    tracker.start("Compressing & Optimizing PDF", "Analyzing content streams & removing duplicate objects...", estSec);

    const formData = new FormData();
    formData.append("file", currentCompressFile);
    formData.append("level", level);

    setTimeout(() => tracker.setStep("Optimizing embedded images & streams...", 50), 800);
    setTimeout(() => tracker.setStep("Rebuilding optimized PDF file...", 80), 2200);

    try {
      const res = await fetch("/api/pdf/compress", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Compression failed");
      }

      const origSize = parseInt(res.headers.get("X-Original-Size") || currentCompressFile.size, 10);
      const finalSize = parseInt(res.headers.get("X-Final-Size") || "0", 10);
      const savedPercent = res.headers.get("X-Saved-Percent") || "0";

      statOrigSize.textContent = formatBytes(origSize);
      statCompSize.textContent = formatBytes(finalSize);
      statSavedPercent.textContent = `${savedPercent}%`;
      compressResultsCard.style.display = "block";

      const blob = await res.blob();
      const base = currentCompressFile.name.replace(/\.pdf$/i, "");
      tracker.complete(`Finished! Saved ${savedPercent}% size.`);
      downloadBlob(blob, `${base}_compressed.pdf`);
      showToast(`Compression finished! Saved ${savedPercent}%`);
    } catch (err) {
      tracker.fail();
      showToast(`Error: ${err.message}`, true);
    }
  });

  // ==========================================
  // TAB 4: IMAGE CONVERTER & PRIVACY CLEANER
  // ==========================================
  const imageDropzone = document.getElementById("imageDropzone");
  const imageFileInput = document.getElementById("imageFileInput");
  const imageFileListCard = document.getElementById("imageFileListCard");
  const imageFileCount = document.getElementById("imageFileCount");
  const imagePreviewsGrid = document.getElementById("imagePreviewsGrid");
  const clearImageList = document.getElementById("clearImageList");
  const imageOptionsCard = document.getElementById("imageOptionsCard");
  const imageFormatSelect = document.getElementById("imageFormatSelect");
  const imageQualitySlider = document.getElementById("imageQualitySlider");
  const imageQualityVal = document.getElementById("imageQualityVal");
  const imageMaxWidth = document.getElementById("imageMaxWidth");
  const stripMetadataCheck = document.getElementById("stripMetadataCheck");
  const startImageBtn = document.getElementById("startImageBtn");

  let imageFiles = [];

  imageQualitySlider.addEventListener("input", (e) => {
    imageQualityVal.textContent = `${e.target.value}%`;
  });

  imageDropzone.addEventListener("click", () => imageFileInput.click());
  imageFileInput.addEventListener("change", (e) => {
    addImages(Array.from(e.target.files));
    imageFileInput.value = "";
  });

  setupDropzoneEvents(imageDropzone, imageFileInput, addImages);

  function addImages(files) {
    const valid = files.filter((f) => f.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|bmp|gif|tiff)$/i.test(f.name));
    if (valid.length === 0) {
      showToast("Please select valid image files.", true);
      return;
    }
    imageFiles = imageFiles.concat(valid);
    renderImages();
    showToast(`Added ${valid.length} image(s).`);
  }

  function renderImages() {
    imagePreviewsGrid.innerHTML = "";
    imageFileCount.textContent = imageFiles.length;

    if (imageFiles.length === 0) {
      imageFileListCard.style.display = "none";
      imageOptionsCard.style.display = "none";
      startImageBtn.disabled = true;
      return;
    }

    imageFileListCard.style.display = "block";
    imageOptionsCard.style.display = "block";
    startImageBtn.disabled = false;

    imageFiles.forEach((file, index) => {
      const thumb = document.createElement("div");
      thumb.className = "image-preview-thumb";

      const img = document.createElement("img");
      img.className = "thumb-img";
      img.src = URL.createObjectURL(file);
      img.onload = () => URL.revokeObjectURL(img.src);

      const title = document.createElement("div");
      title.className = "thumb-title";
      title.textContent = `${file.name} (${formatBytes(file.size)})`;

      const removeBtn = document.createElement("button");
      removeBtn.className = "thumb-remove";
      removeBtn.innerHTML = "&times;";
      removeBtn.title = "Remove image";
      removeBtn.addEventListener("click", () => {
        imageFiles.splice(index, 1);
        renderImages();
      });

      thumb.appendChild(img);
      thumb.appendChild(title);
      thumb.appendChild(removeBtn);
      imagePreviewsGrid.appendChild(thumb);
    });
  }

  clearImageList.addEventListener("click", () => {
    imageFiles = [];
    renderImages();
  });

  startImageBtn.addEventListener("click", async () => {
    if (imageFiles.length === 0) return;

    const estSec = Math.min(15, Math.max(3, Math.round(imageFiles.length * 0.8)));
    tracker.start("Processing Images", "Converting format & stripping GPS/EXIF tags...", estSec);

    const formData = new FormData();
    imageFiles.forEach((f) => formData.append("files", f));
    formData.append("format", imageFormatSelect.value);
    formData.append("quality", imageQualitySlider.value);
    formData.append("strip_metadata", stripMetadataCheck.checked);
    formData.append("max_width", parseInt(imageMaxWidth.value || "0", 10));

    setTimeout(() => tracker.setStep("Compressing pixels & generating output...", 60), 700);

    try {
      const res = await fetch("/api/image/convert", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Image processing failed");
      }

      const blob = await res.blob();
      let filename = "converted_images.zip";
      if (imageFiles.length === 1) {
        const ext = imageFormatSelect.value.toLowerCase() === "jpeg" ? "jpg" : imageFormatSelect.value.toLowerCase();
        const base = imageFiles[0].name.replace(/\.[^/.]+$/, "");
        filename = `${base}_converted.${ext}`;
      }

      tracker.complete("Images converted & cleaned! Downloading...");
      downloadBlob(blob, filename);
      showToast("Images processed & downloaded!");
    } catch (err) {
      tracker.fail();
      showToast(`Error: ${err.message}`, true);
    }
  });

  // ==========================================
  // TAB 5: PDF GRABBER (URL TO PDF)
  // ==========================================
  const grabberUrlInput = document.getElementById("grabberUrlInput");
  const clearGrabberUrl = document.getElementById("clearGrabberUrl");
  const grabberOrientation = document.getElementById("grabberOrientation");
  const startGrabberBtn = document.getElementById("startGrabberBtn");

  // Presets
  document.querySelectorAll(".preset-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      grabberUrlInput.value = pill.getAttribute("data-url");
      grabberUrlInput.focus();
    });
  });

  clearGrabberUrl.addEventListener("click", () => {
    grabberUrlInput.value = "";
    grabberUrlInput.focus();
  });

  startGrabberBtn.addEventListener("click", async () => {
    const rawUrl = grabberUrlInput.value.trim();
    if (!rawUrl) {
      showToast("Please enter a website URL to grab.", true);
      grabberUrlInput.focus();
      return;
    }

    const isLandscape = grabberOrientation.value === "landscape";
    tracker.start("Grabbing Webpage to PDF", "Connecting to site via Chromium engine...", 6);

    setTimeout(() => tracker.setStep("Rendering HTML, styles, fonts & images...", 40), 900);
    setTimeout(() => tracker.setStep("Generating pixel-perfect PDF document...", 75), 2400);

    try {
      const res = await fetch("/api/pdf/grab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: rawUrl,
          landscape: isLandscape,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to capture webpage");
      }

      // Read filename from Content-Disposition if present
      let outName = "webpage.pdf";
      const disposition = res.headers.get("Content-Disposition");
      if (disposition && disposition.indexOf("filename=") !== -1) {
        const matches = /filename="?([^"]+)"?/.exec(disposition);
        if (matches && matches[1]) outName = matches[1];
      }

      const blob = await res.blob();
      tracker.complete("Webpage captured! Downloading...");
      downloadBlob(blob, outName);
      showToast("Webpage grabbed & downloaded as PDF!");
    } catch (err) {
      tracker.fail();
      showToast(`Error: ${err.message}`, true);
    }
  });
});
