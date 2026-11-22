"""Serve the offline IELTS course on localhost with Python 3."""

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
import re
import sqlite3
from threading import Timer
import webbrowser

from accounts import Accounts, public_origin

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"


class CourseHandler(SimpleHTTPRequestHandler):
    timeout = 15

    def do_GET(self):
        if self.path.startswith("/api/"):
            return self.server.accounts.respond(self, "GET")
        return super().do_GET()

    def do_POST(self):
        return self.server.accounts.respond(self, "POST")

    def end_headers(self):
        self.send_header("X-Frame-Options", "DENY")
        super().end_headers()

    def send_head(self):
        self.byte_count = None
        path = Path(self.translate_path(self.path))
        if path.suffix.lower() != ".mp3" or not path.is_file():
            return super().send_head()

        # Safari uses byte ranges to load and seek in HTML audio.
        audio = path.open("rb")
        size = os.fstat(audio.fileno()).st_size
        first, last = 0, size - 1
        requested = self.headers.get("Range")
        match = re.fullmatch(r"bytes=(\d*)-(\d*)", requested or "")
        if match and any(match.groups()):
            start, end = match.groups()
            if start:
                first = int(start)
                if end:
                    last = min(last, int(end))
            else:
                first = max(0, size - int(end))
            if first > last:
                audio.close()
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{size}")
                self.send_header("Content-Length", "0")
                self.end_headers()
                return None

        self.send_response(206 if match and any(match.groups()) else 200)
        self.send_header("Content-Type", "audio/mpeg")
        self.send_header("Accept-Ranges", "bytes")
        if match and any(match.groups()):
            self.send_header("Content-Range", f"bytes {first}-{last}/{size}")
        self.byte_count = last - first + 1
        self.send_header("Content-Length", str(self.byte_count))
        self.end_headers()
        audio.seek(first)
        return audio

    def copyfile(self, source, outputfile):
        if self.byte_count is None:
            return super().copyfile(source, outputfile)
        remaining = self.byte_count
        while remaining:
            block = source.read(min(64 * 1024, remaining))
            if not block:
                break
            outputfile.write(block)
            remaining -= len(block)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "4173")))
    parser.add_argument("--host", choices=("127.0.0.1", "localhost"), default="127.0.0.1")
    # The preview launcher passes this flag. The server always honors the requested port.
    parser.add_argument("--strictPort", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--data-dir", type=Path, default=os.environ.get("IELTS_DATA_DIR", ROOT / ".ielts-data"),
                        help="Keep accounts and progress in this directory")
    parser.add_argument("--public-origin", help="HTTPS origin when using a reverse proxy")
    parser.add_argument("--open", action="store_true", help="Open the course in your default browser")
    args = parser.parse_args()
    if not (DIST / "course-data.js").is_file():
        parser.exit(1, "Chạy python3 build_course.py để tạo dữ liệu khóa học.\n")
    handler = partial(CourseHandler, directory=str(DIST))
    try:
        server = ThreadingHTTPServer((args.host, args.port), handler)
    except OSError as error:
        parser.exit(1, f"Không mở được cổng {args.port}. {error}\n")
    with server:
        try:
            directory = args.data_dir.resolve()
            if directory == DIST or DIST in directory.parents:
                raise ValueError("Đặt kho tài khoản bên ngoài thư mục dist.")
            origin = public_origin(args.public_origin) if args.public_origin else None
            server.accounts = Accounts(directory, origin)
        except (ValueError, OSError, sqlite3.Error) as error:
            parser.exit(1, f"Không mở được kho tài khoản. {error}\n")
        url = f"http://localhost:{server.server_port}/"
        print(f"IELTS 6.0 đang chạy tại {url}", flush=True)
        if args.open:
            opener = Timer(0.25, webbrowser.open, args=[url])
            opener.daemon = True
            opener.start()
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nĐã dừng máy chủ.")


if __name__ == "__main__":
    main()
