"""Accounts, sessions and progress for the Python course server."""

from contextlib import contextmanager
from hashlib import scrypt, sha256
from hmac import compare_digest
from http import HTTPStatus
from http.cookies import CookieError, SimpleCookie
import json
from pathlib import Path
import re
import secrets
import sqlite3
from threading import BoundedSemaphore, Lock
from time import monotonic, time
from urllib.parse import urlsplit

COOKIE = "ielts_session"
SESSION_AGE = 7 * 86400
AUTH_WINDOW = 300
USERNAME = re.compile(r"[a-z0-9][a-z0-9_.-]{2,31}")
DUMMY_SALT = bytes(16)


class APIError(Exception):
    def __init__(self, status, message):
        self.status = status
        self.message = message


def password_hash(password, salt):
    return scrypt(password.encode("utf-8"), salt=salt, n=2**15, r=8, p=3, maxmem=64 * 1024**2)


def token_hash(token):
    return sha256(token.encode("ascii")).hexdigest()


def public_origin(value):
    url = urlsplit(value)
    port = url.port
    if (url.scheme != "https" or not url.hostname or url.username is not None
            or url.path not in ("", "/") or url.query or url.fragment):
        raise ValueError("Dùng địa chỉ dạng https://hoc.example.com")
    host = url.hostname.lower()
    if ":" in host:
        host = f"[{host}]"
    return f"https://{host}:{port}" if port and port != 443 else f"https://{host}"


class Accounts:
    def __init__(self, directory, origin=None):
        directory = Path(directory)
        directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        self.path = directory / "accounts.sqlite3"
        self.path.touch(mode=0o600, exist_ok=True)
        self.origin = origin
        self.hash_slots = BoundedSemaphore(2)
        self.limit_lock = Lock()
        self.attempts = {}
        self.limit_reset = 0
        with self.connect() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL,
                    salt BLOB NOT NULL, password_hash BLOB NOT NULL,
                    revision INTEGER NOT NULL DEFAULT 0, progress TEXT NOT NULL DEFAULT '{}'
                );
                CREATE TABLE IF NOT EXISTS sessions (
                    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
                    expires INTEGER NOT NULL
                );
            """)

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path)
        db.row_factory = sqlite3.Row
        try:
            with db:
                yield db
        finally:
            db.close()

    def limit(self, peer, username):
        now = monotonic()
        with self.limit_lock:
            if now >= self.limit_reset:
                self.attempts.clear()
                self.limit_reset = now + AUTH_WINDOW
            limits = [(("peer", peer), 120), (("name", username), 12)]
            if any(self.attempts.get(key, 0) >= maximum for key, maximum in limits):
                raise APIError(HTTPStatus.TOO_MANY_REQUESTS, "Quá nhiều lần thử. Hãy chờ vài phút.")
            for key, _maximum in limits:
                self.attempts[key] = self.attempts.get(key, 0) + 1

    def authenticate(self, body, register, peer, secure):
        username = body.get("username")
        password = body.get("password")
        username = username.strip().lower() if isinstance(username, str) else ""
        if not USERNAME.fullmatch(username):
            raise APIError(400, "Tên đăng nhập cần 3–32 ký tự gồm chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.")
        if not isinstance(password, str) or not 10 <= len(password) <= 128:
            raise APIError(400, "Mật khẩu cần từ 10 đến 128 ký tự.")
        self.limit(peer, username)
        if not self.hash_slots.acquire(blocking=False):
            raise APIError(429, "Máy chủ đang xử lý đăng nhập. Hãy thử lại sau ít giây.")
        salt = secrets.token_bytes(16)
        try:
            if register:
                digest = password_hash(password, salt)
            else:
                with self.connect() as db:
                    user = db.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
                digest = password_hash(password, user["salt"] if user else DUMMY_SALT)
                if not user or not compare_digest(digest, user["password_hash"]):
                    raise APIError(401, "Tên đăng nhập hoặc mật khẩu chưa đúng.")
        except UnicodeEncodeError as error:
            raise APIError(400, "Mật khẩu chứa ký tự không hợp lệ.") from error
        finally:
            self.hash_slots.release()

        token = secrets.token_urlsafe(32)
        now = int(time())
        with self.connect() as db:
            if register:
                user_id = secrets.token_hex(16)
                created = db.execute(
                    "INSERT INTO users (id, username, salt, password_hash) VALUES (?, ?, ?, ?) ON CONFLICT(username) DO NOTHING",
                    (user_id, username, salt, digest),
                )
                if not created.rowcount:
                    raise APIError(409, "Tên đăng nhập này đã được sử dụng.")
            else:
                user_id = user["id"]
            db.execute("DELETE FROM sessions WHERE expires <= ?", (now,))
            db.execute("INSERT INTO sessions VALUES (?, ?, ?)", (token_hash(token), user_id, now + SESSION_AGE))
        return self.session_cookie(token, SESSION_AGE, secure)

    @staticmethod
    def session_cookie(token, age, secure):
        return f"{COOKIE}={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age={age}" + ("; Secure" if secure else "")

    @staticmethod
    def session_token(cookie_header):
        cookie = SimpleCookie()
        try:
            cookie.load(cookie_header)
        except CookieError:
            return None
        token = cookie[COOKIE].value if COOKIE in cookie else ""
        return token_hash(token) if re.fullmatch(r"[A-Za-z0-9_-]{43}", token) else None

    def lookup(self, token):
        if token is None:
            return None
        with self.connect() as db:
            return db.execute("""
                SELECT id, username, revision, progress
                FROM users JOIN sessions ON users.id = sessions.user_id
                WHERE token_hash = ? AND expires > ?
            """, (token, int(time()))).fetchone()

    def save_progress(self, user, body):
        revision = body.get("revision")
        progress = body.get("progress")
        if type(revision) is not int or not 0 <= revision < 2**53 or not isinstance(progress, dict):
            raise APIError(400, "Dữ liệu tiến độ chưa đúng định dạng.")
        try:
            encoded = json.dumps(progress, separators=(",", ":"), allow_nan=False)
        except (ValueError, RecursionError) as error:
            raise APIError(400, "Dữ liệu tiến độ chưa đúng định dạng.") from error
        with self.connect() as db:
            result = db.execute("""
                UPDATE users SET progress = ?, revision = revision + 1
                WHERE id = ? AND revision = ?
            """, (encoded, user["id"], revision))
            if not result.rowcount:
                raise APIError(409, "Tiến độ đã được cập nhật ở tab hoặc thiết bị khác.")
        return {"revision": revision + 1}

    def respond(self, handler, method):
        host = handler.headers.get("Host", "").lower()
        port = handler.server.server_port
        local_hosts = {f"localhost:{port}", f"127.0.0.1:{port}"}
        secure = self.origin is not None and host == urlsplit(self.origin).netloc
        allowed_origin = self.origin if secure else f"http://{host}"
        try:
            if not secure and host not in local_hosts:
                raise APIError(403, "Địa chỉ máy chủ chưa được cấu hình.")
            path = handler.path
            if method == "GET" and path == "/api/account":
                user = self.lookup(self.session_token(handler.headers.get("Cookie", "")))
                data = {"user": {"id": user["id"], "username": user["username"]},
                        "revision": user["revision"], "progress": json.loads(user["progress"])} if user else {"user": None}
                return self.send(handler, 200, data)
            if method != "POST" or path not in ("/api/register", "/api/login", "/api/logout", "/api/progress"):
                raise APIError(404, "Không tìm thấy chức năng.")
            if handler.headers.get("Origin") != allowed_origin:
                raise APIError(403, "Hãy mở giao diện trên cùng địa chỉ với máy chủ.")
            body = self.read_body(handler, 8 * 1024 * 1024 if path == "/api/progress" else 8192)
            token = self.session_token(handler.headers.get("Cookie", ""))
            user = self.lookup(token)
            if path in ("/api/register", "/api/login"):
                if user:
                    raise APIError(409, "Đã có tài khoản đăng nhập. Tải lại trang trước khi đổi tài khoản.")
                cookie = self.authenticate(body, path.endswith("/register"), handler.client_address[0], secure)
                return self.send(handler, 201 if path.endswith("/register") else 200, {}, cookie)
            if not user or body.get("account") != user["id"]:
                raise APIError(401, "Phiên đăng nhập đã thay đổi. Hãy tải lại và đăng nhập.")
            if path == "/api/logout":
                with self.connect() as db:
                    db.execute("DELETE FROM sessions WHERE token_hash = ?", (token,))
                return self.send(handler, 200, {}, self.session_cookie("", 0, secure))
            return self.send(handler, 200, self.save_progress(user, body))
        except APIError as error:
            return self.send(handler, error.status, {"error": error.message})
        except sqlite3.Error:
            return self.send(handler, 503, {"error": "Kho dữ liệu đang bận. Hãy thử lại."})

    @staticmethod
    def read_body(handler, limit):
        if handler.headers.get_content_type() != "application/json":
            raise APIError(415, "Cần gửi dữ liệu JSON.")
        try:
            length = int(handler.headers.get("Content-Length", "0"))
            if length > limit:
                raise APIError(413, "Dữ liệu gửi lên quá lớn.")
            if length < 1 or handler.headers.get("Transfer-Encoding"):
                raise ValueError
            def reject_constant(_value):
                raise ValueError
            data = json.loads(handler.rfile.read(length).decode("utf-8"), parse_constant=reject_constant)
            if not isinstance(data, dict):
                raise ValueError
            return data
        except (ValueError, RecursionError) as error:
            raise APIError(400, "Dữ liệu gửi lên chưa hợp lệ.") from error

    @staticmethod
    def send(handler, status, data, cookie=None):
        payload = json.dumps(data).encode("utf-8")
        handler.send_response(status)
        handler.send_header("Content-Type", "application/json; charset=utf-8")
        handler.send_header("Content-Length", str(len(payload)))
        handler.send_header("Cache-Control", "no-store")
        handler.send_header("X-Content-Type-Options", "nosniff")
        handler.send_header("Cross-Origin-Resource-Policy", "same-origin")
        if cookie:
            handler.send_header("Set-Cookie", cookie)
        handler.end_headers()
        handler.wfile.write(payload)
