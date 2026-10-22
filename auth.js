// WanderPath — frontend authentication layer.
// Talks to the real backend (server/) via fetch + httpOnly session cookie.
// No password or token is ever stored in localStorage/sessionStorage.

const WP_AUTH = (() => {
  const depth = (document.body.dataset.depth || "0") === "1" ? "../" : "";

  async function api(path, options = {}) {
    const res = await fetch(`${depth}api${path}`, {
      method: options.method || "GET",
      credentials: "include",
      headers: options.body ? { "Content-Type": "application/json" } : {},
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    let data = {};
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) {
      const err = new Error(data.error || "Something went wrong.");
      err.status = res.status;
      err.errors = data.errors;
      throw err;
    }
    return data;
  }

  let currentUser = null;

  async function fetchMe() {
    try {
      const data = await api("/auth/me");
      currentUser = data.user;
    } catch (e) {
      currentUser = null;
    }
    return currentUser;
  }

  function initials(name) {
    return (name || "?").split(" ").filter(Boolean).map(p => p[0].toUpperCase()).slice(0, 2).join("");
  }

  function paintNavbar() {
    const guestEls = document.querySelectorAll('[data-auth="guest"]');
    const userEls = document.querySelectorAll('[data-auth="user"]');
    const adminEls = document.querySelectorAll('[data-auth="admin"]');

    guestEls.forEach(el => el.style.display = currentUser ? "none" : "");
    userEls.forEach(el => el.style.display = currentUser ? "" : "none");
    adminEls.forEach(el => el.style.display = currentUser && currentUser.role === "admin" ? "" : "none");

    if (currentUser) {
      document.querySelectorAll(".user-menu-avatar").forEach(el => el.textContent = initials(currentUser.name));
      document.querySelectorAll(".user-menu-name").forEach(el => el.textContent = currentUser.name.split(" ")[0]);
      document.querySelectorAll(".mobile-user-summary").forEach(el => el.textContent = `Signed in as ${currentUser.name}`);
    }
  }

  function wireUserMenu() {
    const menu = document.querySelector(".user-menu");
    const btn = document.querySelector(".user-menu-btn");
    if (!menu || !btn) return;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.classList.toggle("open");
    });
    document.addEventListener("click", () => menu.classList.remove("open"));
  }

  function wireLogout() {
    document.querySelectorAll("[data-logout]").forEach(el => {
      el.addEventListener("click", async (e) => {
        e.preventDefault();
        try { await api("/auth/logout", { method: "POST" }); } catch (err) { /* ignore */ }
        currentUser = null;
        window.location.href = `${depth}index.html`;
      });
    });
  }

  function toast(message, type = "success") {
    let el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.className = `toast show ${type}`;
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), 3200);
  }

  /** Redirects guests away from a protected page, preserving where they wanted to go. */
  async function guard() {
    const protectedPage = document.body.dataset.protected === "true";
    const adminPage = document.body.dataset.adminOnly === "true";
    if (!protectedPage && !adminPage) return true;

    await fetchMe();
    if (!currentUser) {
      sessionStorage.setItem("wp_redirect_message", "Please log in to continue.");
      window.location.href = `${depth}login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
      return false;
    }
    if (adminPage && currentUser.role !== "admin") {
      window.location.href = `${depth}dashboard.html`;
      return false;
    }
    return true;
  }

  async function init() {
    const ok = await guard();
    if (ok === false) return; // navigating away already

    if (!currentUser) await fetchMe();
    paintNavbar();
    wireUserMenu();
    wireLogout();

    const msg = sessionStorage.getItem("wp_redirect_message");
    if (msg && document.getElementById("auth-redirect-banner")) {
      document.getElementById("auth-redirect-banner").textContent = msg;
      document.getElementById("auth-redirect-banner").style.display = "flex";
      sessionStorage.removeItem("wp_redirect_message");
    }

    document.dispatchEvent(new CustomEvent("wp-auth-ready", { detail: { user: currentUser } }));
  }

  document.addEventListener("DOMContentLoaded", init);

  return { api, toast, getUser: () => currentUser, refresh: fetchMe, depth: () => depth };
})();

// ---------------------------------------------------------------------
// Site-wide "requires login" hooks: Save to Favorites buttons and the
// real booking form on tour detail pages. These attach once the DOM is
// ready and work whether or not the page itself is protected.
// ---------------------------------------------------------------------
document.addEventListener("wp-auth-ready", () => {
  const user = WP_AUTH.getUser();
  const depth = WP_AUTH.depth();

  // ---- Favorite destination buttons: [data-favorite-slug][data-favorite-name]
  document.querySelectorAll("[data-favorite-slug]").forEach(btn => {
    const slug = btn.dataset.favoriteSlug;
    const name = btn.dataset.favoriteName || slug;

    const setSaved = (saved) => {
      btn.classList.toggle("is-saved", saved);
      btn.innerHTML = saved ? "&#10084; Saved to Favorites" : "&#9825; Save to Favorites";
    };

    if (user) {
      WP_AUTH.api("/favorites").then(({ favorites }) => {
        setSaved(favorites.some(f => f.destinationSlug === slug));
      }).catch(() => {});
    }

    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      if (!WP_AUTH.getUser()) {
        sessionStorage.setItem("wp_redirect_message", "Please log in to continue.");
        window.location.href = `${depth}login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      const saved = btn.classList.contains("is-saved");
      try {
        if (saved) {
          await WP_AUTH.api(`/favorites/${encodeURIComponent(slug)}`, { method: "DELETE" });
          setSaved(false);
          WP_AUTH.toast("Removed from favorites.");
        } else {
          await WP_AUTH.api("/favorites", { method: "POST", body: { destinationSlug: slug, destinationName: name } });
          setSaved(true);
          WP_AUTH.toast("Added to favorites!");
        }
      } catch (err) {
        WP_AUTH.toast(err.message, "error");
      }
    });
  });

  // ---- Real booking form on tour detail pages: form[data-real-booking]
  const bookingForm = document.querySelector("form[data-real-booking]");
  if (bookingForm) {
    // Logged-in travelers shouldn't retype details we already have.
    if (user) {
      const nameInput = bookingForm.querySelector('input[type="text"]');
      const emailInput = bookingForm.querySelector('input[type="email"]');
      if (nameInput && !nameInput.value) nameInput.value = user.name;
      if (emailInput && !emailInput.value) emailInput.value = user.email;
    }
    bookingForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!WP_AUTH.getUser()) {
        sessionStorage.setItem("wp_redirect_message", "Please log in to continue.");
        window.location.href = `${depth}login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      const btn = bookingForm.querySelector('button[type="submit"]');
      const original = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Booking...";
      try {
        const travelDate = bookingForm.querySelector('input[type="date"]').value;
        const travelers = bookingForm.querySelector("select")?.value || "2 Adults";
        await WP_AUTH.api("/bookings", {
          method: "POST",
          body: {
            tourSlug: bookingForm.dataset.tourSlug,
            tourTitle: bookingForm.dataset.tourTitle,
            travelDate,
            travelers,
          },
        });
        btn.textContent = "Booked ✓";
        WP_AUTH.toast("Booking confirmed! Check My Dashboard.");
        setTimeout(() => { btn.textContent = original; btn.disabled = false; bookingForm.reset(); }, 2400);
      } catch (err) {
        WP_AUTH.toast(err.message, "error");
        btn.textContent = original;
        btn.disabled = false;
      }
    });
  }

  // ---- Save tour buttons: [data-save-tour-slug]
  document.querySelectorAll("[data-save-tour-slug]").forEach(btn => {
    const slug = btn.dataset.saveTourSlug;
    const title = btn.dataset.saveTourTitle || slug;
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      if (!WP_AUTH.getUser()) {
        sessionStorage.setItem("wp_redirect_message", "Please log in to continue.");
        window.location.href = `${depth}login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      try {
        await WP_AUTH.api("/saved-tours", { method: "POST", body: { tourSlug: slug, tourTitle: title } });
        WP_AUTH.toast("Tour saved!");
      } catch (err) {
        WP_AUTH.toast(err.message, "error");
      }
    });
  });
});
