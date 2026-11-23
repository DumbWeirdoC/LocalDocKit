import io
import os
import re
import shutil
import subprocess
import tempfile
import zipfile
from typing import List, Tuple, Dict, Any, Optional
from urllib.parse import urlparse
import pypdf
from PIL import Image


def find_system_browser() -> Optional[str]:
    """
    Finds Edge, Chrome, Brave or Chromium binary on the host system.
    """
    candidates = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"),
        r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
    ]
    for path in candidates:
        if os.path.exists(path):
            return path

    for name in ["msedge", "chrome", "google-chrome", "chromium", "brave"]:
        found = shutil.which(name)
        if found:
            return found
    return None


def grab_url_to_pdf(url: str, landscape: bool = False) -> Tuple[bytes, str]:
    """
    Captures a live webpage into a pixel-perfect PDF using headless Edge/Chrome.
    Returns (pdf_bytes, filename).
    """
    cleaned = url.strip()
    if not cleaned:
        raise ValueError("URL cannot be empty.")

    if not re.match(r"^https?://", cleaned, re.IGNORECASE):
        cleaned = f"https://{cleaned}"

    parsed = urlparse(cleaned)
    domain = parsed.netloc.replace(":", "_").replace(".", "_") or "webpage"
    path_slug = re.sub(r"[^\w\-]", "_", parsed.path.strip("/")).strip("_")
    slug = f"{domain}_{path_slug}" if path_slug else domain
    if len(slug) > 40:
        slug = slug[:40]
    out_filename = f"{slug}.pdf"

    browser = find_system_browser()
    if not browser:
        raise ValueError("No compatible browser (Edge, Chrome, or Chromium) found on this machine to capture the webpage.")

    with tempfile.TemporaryDirectory() as tmpdir:
        out_pdf = os.path.join(tmpdir, "output.pdf")
        user_data = os.path.join(tmpdir, "browser_profile")
        cmd = [
            browser,
            "--headless",
            "--disable-gpu",
            "--no-sandbox",
            f"--user-data-dir={user_data}",
            f"--print-to-pdf={out_pdf}",
            "--no-pdf-header-footer",
        ]
        if landscape:
            cmd.append("--landscape")
        cmd.append(cleaned)

        try:
            subprocess.run(cmd, check=True, timeout=35, capture_output=True)
        except subprocess.TimeoutExpired:
            raise ValueError("Webpage capture timed out after 35 seconds. The target site may be unreachable or blocked.")
        except subprocess.CalledProcessError as e:
            err = e.stderr.decode("utf-8", errors="ignore") if e.stderr else "Unknown error"
            raise ValueError(f"Browser capture failed: {err}")

        if not os.path.exists(out_pdf) or os.path.getsize(out_pdf) == 0:
            raise ValueError("Browser could not generate a PDF for this URL. Please verify the URL is accessible.")

        with open(out_pdf, "rb") as f:
            pdf_bytes = f.read()

        return pdf_bytes, out_filename


def inspect_pdf(pdf_bytes: bytes) -> Dict[str, Any]:
    """
    Inspects PDF metadata and returns page count and encryption status.
    """
    try:
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        if reader.is_encrypted:
            return {
                "success": False,
                "error": "This PDF is encrypted or password-protected.",
                "encrypted": True,
                "page_count": 0,
                "size_bytes": len(pdf_bytes)
            }
        return {
            "success": True,
            "error": None,
            "encrypted": False,
            "page_count": len(reader.pages),
            "size_bytes": len(pdf_bytes)
        }
    except Exception as exc:
        return {
            "success": False,
            "error": f"Invalid or unreadable PDF: {str(exc)}",
            "encrypted": False,
            "page_count": 0,
            "size_bytes": len(pdf_bytes)
        }


def merge_pdfs(pdf_files: List[Tuple[str, bytes]]) -> Tuple[bytes, str]:
    """
    Merges multiple PDF byte streams in order.
    Returns (merged_bytes, filename).
    """
    if not pdf_files:
        raise ValueError("No PDF files provided to merge.")

    writer = pypdf.PdfWriter()

    for idx, (filename, content) in enumerate(pdf_files):
        try:
            reader = pypdf.PdfReader(io.BytesIO(content))
            if reader.is_encrypted:
                raise ValueError(f"File '{filename}' is password-protected. Please unlock it first.")
            writer.append(reader)
        except Exception as exc:
            if "password-protected" in str(exc):
                raise
            raise ValueError(f"Could not read PDF '{filename}': {str(exc)}")

    output_stream = io.BytesIO()
    writer.write(output_stream)
    output_stream.seek(0)
    return output_stream.getvalue(), "merged_document.pdf"


def parse_page_ranges(range_str: str, max_pages: int) -> List[int]:
    """
    Parses user-entered page range string like '1-3, 5, 8-10' (1-indexed).
    Returns a sorted list of unique 0-indexed page indices within [0, max_pages - 1].
    """
    selected = set()
    cleaned = range_str.strip()
    if not cleaned:
        raise ValueError("Page range expression cannot be empty.")

    chunks = [c.strip() for c in cleaned.split(",") if c.strip()]
    for chunk in chunks:
        match_range = re.match(r"^(\d+)\s*-\s*(\d+)$", chunk)
        match_single = re.match(r"^(\d+)$", chunk)
        if match_range:
            start = int(match_range.group(1))
            end = int(match_range.group(2))
            if start > end:
                start, end = end, start
            for p in range(start, end + 1):
                if 1 <= p <= max_pages:
                    selected.add(p - 1)
        elif match_single:
            p = int(match_single.group(1))
            if 1 <= p <= max_pages:
                selected.add(p - 1)
        else:
            raise ValueError(f"Invalid range format: '{chunk}'. Use e.g. '1-3, 5, 8-10'.")

    if not selected:
        raise ValueError(f"No pages in range '{range_str}' match the document (1 to {max_pages} pages).")

    return sorted(list(selected))


def split_pdf(
    pdf_bytes: bytes,
    original_filename: str,
    split_mode: str,
    custom_range: Optional[str] = None
) -> Tuple[bytes, str, str]:
    """
    Splits a PDF by custom range (returns a single PDF) or every page into a ZIP.
    Returns (result_bytes, filename, media_type).
    """
    reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
    if reader.is_encrypted:
        raise ValueError("Cannot split password-protected PDF.")

    total_pages = len(reader.pages)
    if total_pages == 0:
        raise ValueError("PDF contains no pages.")

    base_name = original_filename.rsplit(".", 1)[0] if "." in original_filename else "document"

    if split_mode == "range":
        if not custom_range:
            raise ValueError("Page range is required for custom range split.")
        page_indices = parse_page_ranges(custom_range, total_pages)
        writer = pypdf.PdfWriter()
        for idx in page_indices:
            writer.add_page(reader.pages[idx])

        output_stream = io.BytesIO()
        writer.write(output_stream)
        output_stream.seek(0)
        return output_stream.getvalue(), f"{base_name}_extracted.pdf", "application/pdf"

    elif split_mode == "all":
        # Split every page into individual PDFs inside a ZIP
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            for i, page in enumerate(reader.pages):
                writer = pypdf.PdfWriter()
                writer.add_page(page)
                page_stream = io.BytesIO()
                writer.write(page_stream)
                page_stream.seek(0)
                zip_file.writestr(f"{base_name}_page_{i + 1}.pdf", page_stream.getvalue())

        zip_buffer.seek(0)
        return zip_buffer.getvalue(), f"{base_name}_split_pages.zip", "application/zip"
    else:
        raise ValueError(f"Unknown split mode '{split_mode}'.")


def compress_pdf(pdf_bytes: bytes, original_filename: str, level: str = "medium") -> Tuple[bytes, str, Dict[str, Any]]:
    """
    Compresses a PDF file using pypdf lossless stream compression and object deduplication.
    Returns (compressed_bytes, filename, stats_dict).
    """
    reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
    if reader.is_encrypted:
        raise ValueError("Cannot compress password-protected PDF.")

    original_size = len(pdf_bytes)
    writer = pypdf.PdfWriter(clone_from=reader)

    # 1. Compress content streams on all pages
    for page in writer.pages:
        page.compress_content_streams()

    # 2. Object compression & deduplication
    try:
        writer.compress_identical_objects(remove_identicals=True, remove_orphans=True)
    except Exception:
        pass

    # 3. Optional image re-compression for medium and high levels
    if level in ("medium", "high"):
        target_quality = 70 if level == "medium" else 45
        for page in writer.pages:
            try:
                for img_obj in page.images:
                    try:
                        raw_image = Image.open(io.BytesIO(img_obj.data))
                        if level == "high" and (raw_image.width > 1800 or raw_image.height > 1800):
                            raw_image.thumbnail((1800, 1800), Image.Resampling.LANCZOS)
                        if raw_image.mode in ("RGBA", "P"):
                            raw_image = raw_image.convert("RGB")
                        img_obj.replace(raw_image, quality=target_quality)
                    except Exception:
                        continue
            except Exception:
                continue

    output_stream = io.BytesIO()
    writer.write(output_stream)
    output_stream.seek(0)
    compressed_bytes = output_stream.getvalue()

    # If compression didn't save size, use the smaller one
    final_bytes = compressed_bytes if len(compressed_bytes) < original_size else pdf_bytes
    final_size = len(final_bytes)
    saved_bytes = max(0, original_size - final_size)
    saved_percent = round((saved_bytes / original_size) * 100, 1) if original_size > 0 else 0

    base_name = original_filename.rsplit(".", 1)[0] if "." in original_filename else "document"
    out_filename = f"{base_name}_compressed.pdf"

    stats = {
        "original_size": original_size,
        "final_size": final_size,
        "saved_bytes": saved_bytes,
        "saved_percent": saved_percent,
        "level": level
    }
    return final_bytes, out_filename, stats


def convert_and_clean_image(
    image_bytes: bytes,
    original_filename: str,
    target_format: str = "WEBP",
    quality: int = 85,
    strip_metadata: bool = True,
    max_width: int = 0
) -> Tuple[bytes, str, str]:
    """
    Converts image to target_format, strips EXIF metadata, and resizes if requested.
    Returns (converted_bytes, output_filename, mime_type).
    """
    target_format = target_format.upper().strip()
    if target_format not in ("WEBP", "JPEG", "PNG"):
        target_format = "WEBP"

    format_ext_map = {
        "WEBP": (".webp", "image/webp"),
        "JPEG": (".jpg", "image/jpeg"),
        "PNG": (".png", "image/png"),
    }
    ext, mime_type = format_ext_map[target_format]
    base_name = original_filename.rsplit(".", 1)[0] if "." in original_filename else "image"
    out_filename = f"{base_name}_converted{ext}"

    with Image.open(io.BytesIO(image_bytes)) as img:
        # Resize if max_width is set and image is wider
        if max_width > 0 and img.width > max_width:
            aspect_ratio = img.height / img.width
            new_height = max(1, int(max_width * aspect_ratio))
            img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)

        # Handle color mode for JPEG (doesn't support transparency)
        if target_format == "JPEG" and img.mode in ("RGBA", "LA", "P"):
            background = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode == "P":
                img = img.convert("RGBA")
            if "A" in img.mode:
                background.paste(img, mask=img.split()[-1])
            else:
                background.paste(img)
            img = background
        elif target_format != "JPEG" and img.mode not in ("RGB", "RGBA", "L"):
            img = img.convert("RGBA")

        # Strip metadata: Create a clean copy without EXIF dictionary
        if strip_metadata:
            data = list(img.getdata())
            clean_img = Image.new(img.mode, img.size)
            clean_img.putdata(data)
            img = clean_img

        out_buffer = io.BytesIO()
        save_kwargs = {}
        if target_format in ("JPEG", "WEBP"):
            save_kwargs["quality"] = max(10, min(100, quality))
            save_kwargs["optimize"] = True
        elif target_format == "PNG":
            save_kwargs["optimize"] = True

        img.save(out_buffer, format=target_format, **save_kwargs)
        out_buffer.seek(0)
        return out_buffer.getvalue(), out_filename, mime_type


def batch_process_images(
    images: List[Tuple[str, bytes]],
    target_format: str = "WEBP",
    quality: int = 85,
    strip_metadata: bool = True,
    max_width: int = 0
) -> Tuple[bytes, str, str]:
    """
    Batch processes images. If 1 image, returns image. If multiple, returns ZIP.
    Returns (result_bytes, filename, mime_type).
    """
    if not images:
        raise ValueError("No images provided for processing.")

    if len(images) == 1:
        fname, fbytes = images[0]
        return convert_and_clean_image(
            fbytes, fname, target_format, quality, strip_metadata, max_width
        )

    # Multiple images -> package into a ZIP archive
    zip_buffer = io.BytesIO()
    target_format_clean = target_format.upper().strip()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for fname, fbytes in images:
            try:
                proc_bytes, out_fname, _ = convert_and_clean_image(
                    fbytes, fname, target_format_clean, quality, strip_metadata, max_width
                )
                zip_file.writestr(out_fname, proc_bytes)
            except Exception as e:
                # Still include other images if one fails
                continue

    zip_buffer.seek(0)
    return zip_buffer.getvalue(), f"LocalDocKit_converted_images.zip", "application/zip"
