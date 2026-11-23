import io
import json
import os
import socket
import sys
import threading
import time
import webbrowser
from contextlib import asynccontextmanager
from typing import List, Optional

import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

from processors import (
    inspect_pdf,
    merge_pdfs,
    split_pdf,
    compress_pdf,
    batch_process_images,
    grab_url_to_pdf,
)
from pydantic import BaseModel

HOST = "127.0.0.1"
DEFAULT_PORT = 8001
ACTUAL_PORT = DEFAULT_PORT
AUTO_OPEN_BROWSER = True


def find_available_port(start_port: int = 8001, max_attempts: int = 100) -> int:
    """Finds an available TCP port starting from start_port."""
    for port in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind((HOST, port))
                return port
            except OSError:
                continue
    return start_port


@asynccontextmanager
async def lifespan(app: FastAPI):
    def open_browser():
        if not AUTO_OPEN_BROWSER:
            return
        time.sleep(0.8)
        url = f"http://{HOST}:{ACTUAL_PORT}"
        print(f"\n[LocalDocKit] Opening dashboard in browser: {url}")
        try:
            webbrowser.open(url)
        except Exception as e:
            print(f"[LocalDocKit] Note: Could not auto-open browser ({e}). Please visit {url} directly.")

    threading.Thread(target=open_browser, daemon=True).start()
    yield


app = FastAPI(
    title="LocalDocKit",
    description="Privacy-First Offline PDF & Image Utility Suite",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Original-Size", "X-Final-Size", "X-Saved-Percent", "X-Saved-Bytes"]
)

# Static files directory
if getattr(sys, "frozen", False):
    BASE_DIR = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(sys.executable)))
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

STATIC_DIR = os.path.join(BASE_DIR, "static")
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
async def root():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "LocalDocKit is running. Place index.html in static/ folder."}


# 1. PDF Inspect
@app.post("/api/pdf/inspect")
async def api_pdf_inspect(file: UploadFile = File(...)):
    try:
        content = await file.read()
        res = inspect_pdf(content)
        res["filename"] = file.filename
        return res
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# 2. PDF Merge
@app.post("/api/pdf/merge")
async def api_pdf_merge(
    files: List[UploadFile] = File(...),
    order: Optional[str] = Form(None)
):
    try:
        if len(files) < 2:
            raise HTTPException(status_code=400, detail="Please upload at least 2 PDF files to merge.")

        # Read all files
        file_map = {}
        for f in files:
            file_map[f.filename] = await f.read()

        ordered_files = []
        if order:
            try:
                order_list = json.loads(order)
                for name in order_list:
                    if name in file_map:
                        ordered_files.append((name, file_map[name]))
            except Exception:
                ordered_files = [(f.filename, file_map[f.filename]) for f in files]
        else:
            ordered_files = [(f.filename, file_map[f.filename]) for f in files]

        merged_bytes, out_filename = merge_pdfs(ordered_files)

        return Response(
            content=merged_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{out_filename}"'
            }
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Merge failed: {str(exc)}")


# 3. PDF Split
@app.post("/api/pdf/split")
async def api_pdf_split(
    file: UploadFile = File(...),
    mode: str = Form(...),  # "range" or "all"
    range_str: Optional[str] = Form(None)
):
    try:
        content = await file.read()
        result_bytes, filename, media_type = split_pdf(
            content,
            file.filename,
            split_mode=mode,
            custom_range=range_str
        )
        return Response(
            content=result_bytes,
            media_type=media_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Split failed: {str(exc)}")


# 4. PDF Compress
@app.post("/api/pdf/compress")
async def api_pdf_compress(
    file: UploadFile = File(...),
    level: str = Form("medium")  # "low", "medium", "high"
):
    try:
        content = await file.read()
        compressed_bytes, filename, stats = compress_pdf(content, file.filename, level)

        return Response(
            content=compressed_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "X-Original-Size": str(stats["original_size"]),
                "X-Final-Size": str(stats["final_size"]),
                "X-Saved-Percent": str(stats["saved_percent"]),
                "X-Saved-Bytes": str(stats["saved_bytes"])
            }
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Compression failed: {str(exc)}")


# 5. Image Converter & Privacy Cleaner
@app.post("/api/image/convert")
async def api_image_convert(
    files: List[UploadFile] = File(...),
    format: str = Form("WEBP"),
    quality: int = Form(85),
    strip_metadata: bool = Form(True),
    max_width: int = Form(0)
):
    try:
        if not files:
            raise HTTPException(status_code=400, detail="Please upload at least one image.")

        images_data = []
        for f in files:
            content = await f.read()
            images_data.append((f.filename, content))

        result_bytes, filename, media_type = batch_process_images(
            images=images_data,
            target_format=format,
            quality=quality,
            strip_metadata=strip_metadata,
            max_width=max_width
        )

        return Response(
            content=result_bytes,
            media_type=media_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Image processing failed: {str(exc)}")


# 6. PDF Grabber (URL to PDF)
class GrabRequest(BaseModel):
    url: str
    landscape: bool = False


@app.post("/api/pdf/grab")
async def api_pdf_grab(req: GrabRequest):
    try:
        pdf_bytes, filename = grab_url_to_pdf(req.url, req.landscape)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Webpage capture failed: {str(exc)}")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="LocalDocKit - Privacy-First Offline PDF & Image Suite")
    parser.add_argument("--port", type=int, default=0, help="Port to run server on (default: auto/8001)")
    parser.add_argument("--host", type=str, default=HOST, help="Host to bind (default: 127.0.0.1)")
    parser.add_argument("--no-browser", action="store_true", help="Do not open browser automatically")
    args = parser.parse_args()

    global ACTUAL_PORT, AUTO_OPEN_BROWSER
    if args.port and args.port > 0:
        ACTUAL_PORT = args.port
    else:
        ACTUAL_PORT = find_available_port(DEFAULT_PORT)

    if args.no_browser:
        AUTO_OPEN_BROWSER = False

    print("=" * 64)
    print("   📄 LocalDocKit - Offline PDF & Image Processing Suite 🖼️")
    print(f"   Server running at: http://{args.host}:{ACTUAL_PORT}")
    print("   100% Local & Privacy-Protected. Press CTRL+C to terminate.")
    print("=" * 64)

    uvicorn.run(
        app,
        host=args.host,
        port=ACTUAL_PORT,
        log_level="info"
    )


if __name__ == "__main__":
    import multiprocessing
    multiprocessing.freeze_support()
    main()
