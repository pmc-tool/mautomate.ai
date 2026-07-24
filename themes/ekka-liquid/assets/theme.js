/* Ekka (Liquid) theme — client behaviour. No network calls except cart. */
(function () {
  "use strict";

  /* ---- hero slider ---- */
  document.querySelectorAll("[data-hero]").forEach(function (hero) {
    var slides = Array.prototype.slice.call(hero.querySelectorAll(".ek-hero-slide"));
    var dots = Array.prototype.slice.call(hero.querySelectorAll("[data-hero-dot]"));
    if (slides.length < 2) return;
    var i = 0, timer = null;
    var delay = parseInt(hero.getAttribute("data-autoplay"), 10) || 6000;
    function show(n) {
      i = (n + slides.length) % slides.length;
      slides.forEach(function (s, k) { s.classList.toggle("is-active", k === i); });
      dots.forEach(function (d, k) { d.classList.toggle("is-active", k === i); });
    }
    function start() { stop(); timer = setInterval(function () { show(i + 1); }, delay); }
    function stop() { if (timer) clearInterval(timer); }
    var prev = hero.querySelector("[data-hero-prev]");
    var next = hero.querySelector("[data-hero-next]");
    if (prev) prev.addEventListener("click", function (e) { e.preventDefault(); show(i - 1); start(); });
    if (next) next.addEventListener("click", function (e) { e.preventDefault(); show(i + 1); start(); });
    dots.forEach(function (d) { d.addEventListener("click", function () { show(parseInt(d.getAttribute("data-hero-dot"), 10)); start(); }); });
    hero.addEventListener("mouseenter", stop);
    hero.addEventListener("mouseleave", start);
    start();
  });

  /* ---- product tabs ---- */
  document.querySelectorAll("[data-tabs]").forEach(function (root) {
    var btns = Array.prototype.slice.call(root.querySelectorAll("[data-tab-btn]"));
    var panels = Array.prototype.slice.call(root.querySelectorAll("[data-tab-panel]"));
    btns.forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        var idx = btn.getAttribute("data-tab-btn");
        btns.forEach(function (b) { b.classList.toggle("is-active", b === btn); });
        panels.forEach(function (p) { p.classList.toggle("is-active", p.getAttribute("data-tab-panel") === idx); });
      });
    });
  });

  /* ---- category showcase tabs ---- */
  document.querySelectorAll("[data-cat-tabs]").forEach(function (root) {
    var btns = Array.prototype.slice.call(root.querySelectorAll("[data-cat-btn]"));
    var panels = Array.prototype.slice.call(root.querySelectorAll("[data-cat-panel]"));
    btns.forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        var idx = btn.getAttribute("data-cat-btn");
        btns.forEach(function (b) { b.classList.toggle("is-active", b === btn); });
        panels.forEach(function (p) { p.classList.toggle("is-active", p.getAttribute("data-cat-panel") === idx); });
      });
    });
  });

  /* ---- countdown ---- */
  document.querySelectorAll("[data-countdown]").forEach(function (el) {
    var target = Date.parse(el.getAttribute("data-countdown"));
    if (isNaN(target)) target = Date.now() + 10 * 864e5;
    var c = {
      days: el.querySelector('[data-cd="days"]'), hours: el.querySelector('[data-cd="hours"]'),
      minutes: el.querySelector('[data-cd="minutes"]'), seconds: el.querySelector('[data-cd="seconds"]')
    };
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    function tick() {
      var d = Math.max(0, target - Date.now());
      if (c.days) c.days.textContent = pad(Math.floor(d / 864e5));
      if (c.hours) c.hours.textContent = pad(Math.floor(d / 36e5) % 24);
      if (c.minutes) c.minutes.textContent = pad(Math.floor(d / 6e4) % 60);
      if (c.seconds) c.seconds.textContent = pad(Math.floor(d / 1e3) % 60);
    }
    tick(); setInterval(tick, 1000);
  });

  /* ---- mobile nav ---- */
  var toggle = document.querySelector("[data-nav-toggle]");
  var mnav = document.querySelector("[data-mobile-nav]");
  if (toggle && mnav) {
    toggle.addEventListener("click", function () {
      var open = mnav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("click", function (e) {
      if (!mnav.classList.contains("is-open")) return;
      if (mnav.contains(e.target) || toggle.contains(e.target)) return;
      mnav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    });
  }

  /* ---- PDP thumbnails ---- */
  document.querySelectorAll("[data-pdp-thumbs]").forEach(function (strip) {
    var main = document.getElementById("pdp-main-img");
    if (!main) return;
    strip.querySelectorAll(".ek-pdp-thumb").forEach(function (thumb) {
      thumb.addEventListener("click", function () {
        var full = thumb.getAttribute("data-full");
        if (full) main.setAttribute("src", full);
        strip.querySelectorAll(".ek-pdp-thumb").forEach(function (t) { t.classList.toggle("is-active", t === thumb); });
      });
    });
  });

  /* ---- add to cart ---- */
  function countryFromPath() {
    var seg = (location.pathname.split("/")[1] || "").toLowerCase();
    return /^[a-z]{2,3}$/.test(seg) ? seg : "us";
  }
  function setCartCount(n) {
    var link = document.querySelector(".ek-cart");
    if (!link) return;
    var badge = link.querySelector(".ek-cart-count");
    if (!badge) { badge = document.createElement("span"); badge.className = "ek-cart-count"; link.appendChild(badge); }
    badge.textContent = n;
  }
  document.querySelectorAll("[data-add-to-cart]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var sel = form.querySelector("[data-variant-select]");
      var variantId = sel ? sel.value : "";
      var qtyEl = form.querySelector("[data-qty]");
      var qty = qtyEl ? parseInt(qtyEl.value, 10) || 1 : 1;
      var btn = form.querySelector("[data-add-btn]");
      var msg = form.querySelector("[data-cart-msg]");
      if (!variantId) { if (msg) { msg.hidden = false; msg.textContent = "Please choose a variant."; } return; }
      if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = "Adding..."; }
      fetch("/api/theme-cart", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variant_id: variantId, quantity: qty, country: countryFromPath() })
      })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || "Add To Cart"; }
          if (res.ok) {
            if (typeof res.d.item_count === "number") setCartCount(res.d.item_count);
            if (msg) { msg.hidden = false; msg.textContent = "Added to your cart."; }
          } else if (msg) { msg.hidden = false; msg.textContent = (res.d && res.d.error) || "Could not add to cart."; }
        })
        .catch(function () {
          if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || "Add To Cart"; }
          if (msg) { msg.hidden = false; msg.textContent = "Could not add to cart."; }
        });
    });
  });

  /* ---- cart page: quantity / remove / promo code. Mutations post to the
     same-origin /api/theme-cart bridge; on success the page reloads so the
     server re-renders the Liquid cart with authoritative totals. ---- */
  var cartPage = document.querySelector("[data-cart-page]");
  if (cartPage) {
    var cartBusy = false;
    var cartLineMsg = cartPage.querySelector("[data-cart-msg]");
    var promoMsg = cartPage.querySelector("[data-promo-msg]");
    var showCartMsg = function (el, text) {
      var target = el || cartLineMsg;
      if (target) { target.hidden = false; target.textContent = text; }
    };
    var cartMutate = function (payload, msgEl) {
      if (cartBusy) return;
      cartBusy = true;
      cartPage.classList.add("is-busy");
      fetch("/api/theme-cart", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          if (res.ok) { location.reload(); return; }
          cartBusy = false;
          cartPage.classList.remove("is-busy");
          showCartMsg(msgEl, (res.d && res.d.error) || "Could not update your cart.");
        })
        .catch(function () {
          cartBusy = false;
          cartPage.classList.remove("is-busy");
          showCartMsg(msgEl, "Could not update your cart.");
        });
    };
    Array.prototype.forEach.call(cartPage.querySelectorAll("[data-cart-line]"), function (line) {
      var lineId = line.getAttribute("data-cart-line");
      var input = line.querySelector("[data-qty-input]");
      function currentQty() {
        var n = input ? parseInt(input.value, 10) : NaN;
        return isNaN(n) ? 1 : n;
      }
      function setQty(n) {
        if (n <= 0) { cartMutate({ action: "remove", line_id: lineId }); }
        else { cartMutate({ action: "update", line_id: lineId, quantity: n }); }
      }
      var minus = line.querySelector("[data-qty-minus]");
      var plus = line.querySelector("[data-qty-plus]");
      var remove = line.querySelector("[data-line-remove]");
      if (minus) minus.addEventListener("click", function () { setQty(currentQty() - 1); });
      if (plus) plus.addEventListener("click", function () { setQty(currentQty() + 1); });
      if (remove) remove.addEventListener("click", function () { cartMutate({ action: "remove", line_id: lineId }); });
      if (input) input.addEventListener("change", function () {
        var n = parseInt(input.value, 10);
        if (isNaN(n) || n < 0) { input.value = "1"; n = 1; }
        setQty(n);
      });
    });
    var promoForm = cartPage.querySelector("[data-promo-form]");
    if (promoForm) {
      promoForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var input = promoForm.querySelector("input[name=code]");
        var code = input && input.value ? input.value.trim() : "";
        if (!code) { showCartMsg(promoMsg, "Enter a promo code."); return; }
        cartMutate({ action: "promo_add", code: code }, promoMsg);
      });
    }
    Array.prototype.forEach.call(cartPage.querySelectorAll("[data-promo-remove]"), function (btn) {
      btn.addEventListener("click", function () {
        cartMutate({ action: "promo_remove", code: btn.getAttribute("data-promo-remove") || "" }, promoMsg);
      });
    });
  }

  /* ---- contact form — posts to the storefront bridge, which stores the
     message tenant-stamped via POST /store/contact ---- */
  document.querySelectorAll("[data-contact-form]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var msg = form.querySelector("[data-cort-msg]") || form.querySelector("[data-contact-msg]");
      var val = function (sel) {
        var el = form.querySelector(sel);
        return el && el.value ? el.value.trim() : "";
      };
      var name = val("[name=name]");
      var email = val("[name=email]");
      var subject = val("[name=subject]");
      var message = val("[name=message]");
      if (!name || !email || !message) {
        if (msg) { msg.hidden = false; msg.textContent = "Please fill in your name, email and message."; }
        return;
      }
      var fields = form.querySelectorAll("input,textarea,button");
      Array.prototype.forEach.call(fields, function (el) { el.disabled = true; });
      fetch("/api/theme-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name, email: email, subject: subject, message: message }),
      })
        .then(function (r) { if (!r.ok) { throw new Error("send failed"); } return r.json(); })
        .then(function () {
          if (msg) { msg.hidden = false; msg.textContent = "Thanks — your message has been sent. We'll be in touch soon."; }
        })
        .catch(function () {
          Array.prototype.forEach.call(fields, function (el) { el.disabled = false; });
          if (msg) { msg.hidden = false; msg.textContent = "Sorry — your message could not be sent. Please try again."; }
        });
    });
  });

  /* ---- newsletter (presentational) ---- */
  document.querySelectorAll("[data-newsletter]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = form.querySelector("input[type=email]");
      form.innerHTML = '<p style="margin:6px 10px">Thanks — you are on the list' + (input && input.value ? " (" + input.value.replace(/[<>]/g, "") + ")" : "") + ".</p>";
    });
  });
})();
