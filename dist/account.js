"use strict";

const account = (() => {
  const button = document.querySelector("#account-open");
  const dialog = document.querySelector("#account-dialog");
  const heading = document.querySelector("#account-heading");
  const form = document.querySelector("#account-form");
  const name = form.elements.username;
  const password = form.elements.password;
  const submit = document.querySelector("#account-submit");
  const switchMode = document.querySelector("#account-switch");
  const signedIn = document.querySelector("#account-signed-in");
  const message = document.querySelector("#account-message");
  const status = document.querySelector("#account-status");
  const retry = document.querySelector("#account-retry");
  const useServer = document.querySelector("#account-use-server");
  const logout = document.querySelector("#account-logout");
  const changeKey = "ielts36-account-changed";

  let user = null;
  let revision = 0;
  let pending = null;
  let active = null;
  let timeout;
  let conflict = false;
  let action = "login";
  let applyProgress;

  async function request(path, values) {
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), values ? 20000 : 5000);
    try {
      const response = await fetch(`/api/${path}`, {
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
        ...(values ? {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values)
        } : {})
      });
      const data = await response.json();
      if (!response.ok) throw Object.assign(new Error(data.error), { status: response.status });
      return data;
    } catch (error) {
      if (error.status) throw error;
      throw new Error("Chưa kết nối được máy chủ tài khoản. Hãy kiểm tra cửa sổ đang chạy start.py hoặc kết nối mạng.");
    } finally {
      clearTimeout(deadline);
    }
  }

  function pendingKey() {
    return `ielts36-pending-${user.id}`;
  }

  function remember() {
    try {
      if (pending) sessionStorage.setItem(pendingKey(), JSON.stringify({ revision, progress: pending }));
      else sessionStorage.removeItem(pendingKey());
    } catch {
      // The in-memory copy is still available for sending or exporting.
    }
  }

  function syncStatus(text) {
    status.textContent = text;
    retry.hidden = !pending || conflict;
    useServer.hidden = !conflict;
  }

  function queue(progress) {
    pending = JSON.parse(JSON.stringify(progress));
    remember();
    syncStatus(conflict ? "Có thay đổi trên thiết bị khác" : "Đang đồng bộ");
    clearTimeout(timeout);
    if (!conflict) timeout = setTimeout(flush, 450);
  }

  async function sendProgress() {
    while (pending && !conflict) {
      const snapshot = pending;
      try {
        let saved;
        try {
          saved = await request("progress", { account: user.id, revision, progress: snapshot });
        } catch (error) {
          if (error.status !== 409) throw error;
          // A prior write can succeed even when its response does not reach the browser.
          const latest = await request("account");
          if (latest.user?.id !== user.id || JSON.stringify(latest.progress) !== JSON.stringify(snapshot)) throw error;
          saved = latest;
        }
        revision = saved.revision;
        if (pending === snapshot) pending = null;
        remember();
      } catch (error) {
        conflict = error.status === 409;
        syncStatus(conflict ? "Có thay đổi trên thiết bị khác" : "Chưa đồng bộ");
        message.textContent = conflict
          ? "Tiến độ trên máy chủ đã đổi. Nếu muốn giữ bản đang mở, hãy tải bản sao lưu trong Cài đặt trước khi chọn Dùng bản máy chủ."
          : error.message;
        return false;
      }
    }
    if (!pending) {
      message.textContent = "";
      syncStatus("Đã đồng bộ");
    }
    return !pending;
  }

  function flush() {
    if (!pending) return Promise.resolve(true);
    if (conflict) return Promise.resolve(false);
    clearTimeout(timeout);
    if (!active) active = sendProgress().finally(() => { active = null; });
    return active;
  }

  function notifyAndReload() {
    try {
      localStorage.setItem(changeKey, String(Date.now()));
    } catch {
      // The current tab can still reload when storage is unavailable.
    }
    location.reload();
  }

  function setMode(mode) {
    action = mode;
    const registering = mode === "register";
    heading.textContent = registering ? "Đăng ký tài khoản" : "Đăng nhập";
    submit.textContent = registering ? "Tạo tài khoản" : "Đăng nhập";
    switchMode.textContent = registering ? "Đã có tài khoản" : "Tạo tài khoản mới";
    document.querySelector("#account-rules").hidden = !registering;
    password.autocomplete = registering ? "new-password" : "current-password";
    password.value = "";
    message.textContent = "";
  }

  button.addEventListener("click", () => {
    if (user) {
      heading.textContent = "Tài khoản";
      document.querySelector("#account-username").textContent = user.username;
    } else {
      setMode("login");
    }
    dialog.showModal();
  });

  switchMode.addEventListener("click", () => {
    setMode(action === "login" ? "register" : "login");
    name.focus();
  });

  dialog.addEventListener("close", () => { password.value = ""; });
  function changingAccount() {
    return submit.disabled || logout.disabled || useServer.disabled;
  }

  dialog.addEventListener("cancel", event => {
    if (changingAccount()) event.preventDefault();
  });
  document.querySelector("#account-close").addEventListener("click", () => {
    if (!changingAccount()) dialog.close();
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    submit.disabled = true;
    switchMode.disabled = true;
    message.textContent = "";
    try {
      await request(action, { username: name.value, password: password.value });
      notifyAndReload();
    } catch (error) {
      message.textContent = error.message;
    } finally {
      submit.disabled = false;
      switchMode.disabled = false;
    }
  });

  retry.addEventListener("click", flush);

  useServer.addEventListener("click", async () => {
    useServer.disabled = true;
    try {
      const latest = await request("account");
      if (latest.user?.id !== user.id) throw new Error("Phiên đăng nhập đã thay đổi. Hãy tải lại trang.");
      revision = latest.revision;
      pending = null;
      conflict = false;
      remember();
      applyProgress(latest.progress);
      message.textContent = "Đã tải tiến độ từ máy chủ.";
      syncStatus("Đã đồng bộ");
    } catch (error) {
      message.textContent = error.message;
    } finally {
      useServer.disabled = false;
    }
  });

  logout.addEventListener("click", async () => {
    logout.disabled = true;
    try {
      if (!await flush()) return;
      await request("logout", { account: user.id });
      notifyAndReload();
    } catch (error) {
      message.textContent = error.message;
    } finally {
      logout.disabled = false;
    }
  });

  window.addEventListener("online", flush);
  window.addEventListener("storage", event => {
    if (event.key === changeKey) location.reload();
  });
  window.addEventListener("beforeunload", event => {
    if (!pending) return;
    event.preventDefault();
    event.returnValue = "";
  });

  async function initialize(loadProgress) {
    applyProgress = loadProgress;
    if (location.protocol === "file:") return;
    button.hidden = false;
    button.disabled = true;
    try {
      const data = await request("account");
      user = data.user;
      if (!user) return;
      revision = data.revision;
      let unsent;
      try {
        unsent = JSON.parse(sessionStorage.getItem(pendingKey()));
      } catch {
        // A new login can use the server copy when local session storage is unavailable.
      }
      button.textContent = user.username;
      form.hidden = true;
      signedIn.hidden = false;
      if (unsent?.progress && JSON.stringify(unsent.progress) !== JSON.stringify(data.progress)) {
        pending = unsent.progress;
        applyProgress(pending);
        if (unsent.revision === revision) {
          syncStatus("Đang đồng bộ");
          void flush();
        } else {
          conflict = true;
          syncStatus("Có thay đổi trên thiết bị khác");
          message.textContent = "Hãy tải bản sao lưu trong Cài đặt nếu muốn giữ bản đang mở trước khi chọn Dùng bản máy chủ.";
        }
      } else {
        remember();
        applyProgress(data.progress);
        syncStatus("Đã đồng bộ");
      }
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  }

  return { initialize, queue, get user() { return user; } };
})();
