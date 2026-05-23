(function () {
  function getApiBase() {
    const configured =
      window.FINTRACK_API_BASE ||
      document.querySelector('meta[name="fintrack-api-base"]')?.content ||
      "";

    if (configured.trim()) {
      const clean = configured.trim().replace(/\/+$/, "");
      return clean.endsWith("/api") ? clean : `${clean}/api`;
    }

    const local =
      window.location.protocol === "file:" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "localhost";

    return local ? "http://127.0.0.1:5001/api" : "/api";
  }

  const API = getApiBase();
  const AUTH = API.replace(/\/api\/?$/, "/auth");

  function appUrl() {
    const local =
      window.location.protocol === "file:" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "localhost";
    return local ? "index.html" : "/index.html";
  }

  async function parseResponse(response, fallback) {
    let body = {};
    try { body = await response.json(); } catch (e) {}
    if (!response.ok) {
      throw new Error(body.error || body.message || fallback);
    }
    return body;
  }

  function setMessage(id, text, type) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text || "";
    el.classList.remove("error", "success");
    if (type) el.classList.add(type);
  }

  function setBusy(button, busyText, busy) {
    if (!button) return;
    if (busy) {
      button.dataset.label = button.dataset.label || button.textContent;
      button.innerHTML = `<span class="btn-spinner" aria-hidden="true"></span>${busyText}`;
      button.disabled = true;
    } else {
      button.textContent = button.dataset.label || busyText;
      button.disabled = false;
    }
  }

  function showTab(mode) {
    const isRegister = mode === "register";
    document.getElementById("loginTab")?.classList.toggle("active", !isRegister);
    document.getElementById("registerTab")?.classList.toggle("active", isRegister);
    document.getElementById("loginForm")?.classList.toggle("active", !isRegister);
    document.getElementById("registerForm")?.classList.toggle("active", isRegister);
  }

  function initPasswordToggles() {
    document.querySelectorAll("[data-toggle-password]").forEach((button) => {
      button.addEventListener("click", () => {
        const input = document.getElementById(button.dataset.togglePassword);
        if (!input) return;
        const showing = input.type === "text";
        input.type = showing ? "password" : "text";
        button.textContent = showing ? "Show" : "Hide";
        button.setAttribute("aria-label", showing ? "Show password" : "Hide password");
      });
    });
  }

  function initLoginPage() {
    const loginTab = document.getElementById("loginTab");
    const registerTab = document.getElementById("registerTab");
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");

    if (!loginForm && !registerForm) return;

    const params = new URLSearchParams(window.location.search || "");
    showTab(params.get("mode") === "register" ? "register" : "login");

    loginTab?.addEventListener("click", () => showTab("login"));
    registerTab?.addEventListener("click", () => showTab("register"));

    loginForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = loginForm.querySelector(".auth-submit");
      setMessage("loginMessage", "");
      setBusy(button, "Logging in...", true);

      try {
        await fetch(`${AUTH}/login`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: document.getElementById("loginEmail").value.trim(),
            password: document.getElementById("loginPassword").value,
          }),
        }).then((res) => parseResponse(res, "Could not log in"));

        window.location.href = appUrl();
      } catch (error) {
        setMessage("loginMessage", error.message, "error");
      } finally {
        setBusy(button, "Log in", false);
      }
    });

    registerForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = registerForm.querySelector(".auth-submit");
      setMessage("registerMessage", "");
      setBusy(button, "Creating account...", true);

      try {
        const payload = {
          name: document.getElementById("registerName").value.trim(),
          email: document.getElementById("registerEmail").value.trim(),
          password: document.getElementById("registerPassword").value,
        };
        const confirmPassword = document.getElementById("registerPasswordConfirm").value;

        if (payload.password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }

        const body = await fetch(`${AUTH}/register`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).then((res) => parseResponse(res, "Could not create account"));

        if (body && body.verification_required) {
          // Hard email-verification gate: send the user to the dedicated
          // "check your email" page instead of dropping them on the login tab.
          const email = encodeURIComponent(body.email || payload.email);
          window.location.href = `verify-email.html?email=${email}`;
          return;
        }

        // Fallback: verification not enforced (test/local dev) — backend
        // auto-logged the user in, just bounce them to the app.
        window.location.href = appUrl();
      } catch (error) {
        setMessage("registerMessage", error.message, "error");
      } finally {
        setBusy(button, "Create account", false);
      }
    });
  }

  function initForgotPage() {
    const form = document.getElementById("forgotPasswordForm");
    if (!form) return;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector(".auth-submit");
      setMessage("forgotMessage", "");
      setBusy(button, "Sending...", true);

      try {
        const body = await fetch(`${AUTH}/forgot-password`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: document.getElementById("forgotEmail").value.trim() }),
        }).then((res) => parseResponse(res, "Could not send reset link"));

        setMessage("forgotMessage", body.message || "If that email is registered, a reset link has been sent.", "success");
      } catch (error) {
        setMessage("forgotMessage", error.message, "error");
      } finally {
        setBusy(button, "Send reset link", false);
      }
    });
  }

  function initResetPage() {
    const form = document.getElementById("resetPasswordForm");
    if (!form) return;

    const params = new URLSearchParams(window.location.search || "");
    const token = params.get("token") || "";

    if (!token) {
      setMessage("resetMessage", "This reset link is missing its token.", "error");
      form.querySelector(".auth-submit").disabled = true;
      return;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector(".auth-submit");
      const password = document.getElementById("resetPassword").value;
      const confirm = document.getElementById("resetPasswordConfirm").value;
      setMessage("resetMessage", "");

      if (password !== confirm) {
        setMessage("resetMessage", "Passwords do not match.", "error");
        return;
      }

      setBusy(button, "Updating...", true);

      try {
        const body = await fetch(`${AUTH}/reset-password`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, password }),
        }).then((res) => parseResponse(res, "Could not reset password"));

        setMessage("resetMessage", body.message || "Password updated. You can now log in.", "success");
        setTimeout(() => { window.location.href = "login.html"; }, 1200);
      } catch (error) {
        setMessage("resetMessage", error.message, "error");
      } finally {
        setBusy(button, "Update password", false);
      }
    });
  }

  function initVerifyPage() {
    const tokenState = document.getElementById("verifyTokenState");
    const checkEmailState = document.getElementById("verifyCheckEmailState");
    const fallbackState = document.getElementById("verifyFallbackState");
    if (!tokenState && !checkEmailState && !fallbackState) return;

    const params = new URLSearchParams(window.location.search || "");
    const token = params.get("token") || "";
    const email = params.get("email") || "";

    function showState(el) {
      [tokenState, checkEmailState, fallbackState].forEach((node) => {
        if (node) node.style.display = "none";
      });
      if (el) el.style.display = "block";
    }

    // State A — user clicked the verification link in their email
    if (token) {
      showState(tokenState);
      fetch(`${AUTH}/verify-email`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
        .then((res) => parseResponse(res, "Could not verify email"))
        .then((body) => {
          setMessage("verifyMessage", body.message || "Email verified! Sending you to login…", "success");
          setTimeout(() => { window.location.href = "login.html?verified=1"; }, 1400);
        })
        .catch((error) => {
          setMessage("verifyMessage", error.message, "error");
        });
      return;
    }

    // State B — user just signed up, we're telling them to check their email
    if (email) {
      showState(checkEmailState);
      const addrEl = document.getElementById("checkEmailAddress");
      if (addrEl) addrEl.textContent = email;

      const resendBtn = document.getElementById("resendVerifyBtn");
      if (resendBtn) {
        resendBtn.addEventListener("click", async () => {
          resendBtn.disabled = true;
          resendBtn.textContent = "Sending…";
          setMessage("resendMessage", "");
          try {
            const body = await fetch(`${AUTH}/resend-verification`, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email }),
            }).then((res) => parseResponse(res, "Could not resend verification email"));
            setMessage("resendMessage", body.message || "Verification email sent. Check your inbox.", "success");
            // Cooldown: re-enable after 30 seconds so users can't spam it
            setTimeout(() => {
              resendBtn.disabled = false;
              resendBtn.textContent = "Resend the email";
            }, 30000);
          } catch (error) {
            setMessage("resendMessage", error.message, "error");
            resendBtn.disabled = false;
            resendBtn.textContent = "Resend the email";
          }
        });
      }
      return;
    }

    // State C — no token, no email param → show the fallback message
    showState(fallbackState);
  }

  document.addEventListener("DOMContentLoaded", () => {
    initPasswordToggles();
    initLoginPage();
    initForgotPage();
    initResetPage();
    initVerifyPage();
  });
})();
