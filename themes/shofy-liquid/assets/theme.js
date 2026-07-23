/* Shofy (Liquid) theme — client behaviour. No network calls except cart. */
(function () {
  "use strict";

  /* ---- generic crossfade slider (hero + testimonials) ---- */
  document.querySelectorAll("[data-slider]").forEach(function (root) {
    var slides = Array.prototype.slice.call(root.querySelectorAll("[data-slide]"));
    var dots = Array.prototype.slice.call(root.querySelectorAll("[data-slider-dot]"));
    if (slides.length < 2) return;
    var i = 0, timer = null;
    var delay = parseInt(root.getAttribute("data-autoplay"), 10) || 5000;
    function show(n) {
      i = (n + slides.length) % slides.length;
      slides.forEach(function (s, k) { s.classList.toggle("is-active", k === i); });
      dots.forEach(function (d, k) { d.classList.toggle("is-active", k === i); });
    }
    function start() { stop(); timer = setInterval(function () { show(i + 1); }, delay); }
    function stop() { if (timer) clearInterval(timer); }
    dots.forEach(function (d) { d.addEventListener("click", function () { show(parseInt(d.getAttribute("data-slider-dot"), 10)); start(); }); });
    root.addEventListener("mouseenter", stop);
    root.addEventListener("mouseleave", start);
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
  }

  /* ---- PDP thumbnails ---- */
  document.querySelectorAll("[data-pdp-thumbs]").forEach(function (strip) {
    var main = document.getElementById("pdp-main-img");
    if (!main) return;
    strip.querySelectorAll(".sf-pdp-thumb").forEach(function (thumb) {
      thumb.addEventListener("click", function () {
        var full = thumb.getAttribute("data-full");
        if (full) main.setAttribute("src", full);
        strip.querySelectorAll(".sf-pdp-thumb").forEach(function (t) { t.classList.toggle("is-active", t === thumb); });
      });
    });
  });

  /* ---- add to cart ---- */
  function countryFromPath() {
    var seg = (location.pathname.split("/")[1] || "").toLowerCase();
    return /^[a-z]{2,3}$/.test(seg) ? seg : "us";
  }
  function setCartCount(n) {
    var link = document.querySelector(".sf-cart");
    if (!link) return;
    var badge = link.querySelector(".sf-cart-count");
    if (!badge) { badge = document.createElement("span"); badge.className = "sf-cart-count"; link.appendChild(badge); }
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
          if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || "Add to Cart"; }
          if (res.ok) {
            if (typeof res.d.item_count === "number") setCartCount(res.d.item_count);
            if (msg) { msg.hidden = false; msg.textContent = "Added to your cart."; }
          } else if (msg) { msg.hidden = false; msg.textContent = (res.d && res.d.error) || "Could not add to cart."; }
        })
        .catch(function () {
          if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || "Add to Cart"; }
          if (msg) { msg.hidden = false; msg.textContent = "Could not add to cart."; }
        });
    });
  });

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
      form.innerHTML = '<p style="margin:0">Thanks — you are on the list' + (input && input.value ? " (" + input.value.replace(/[<>]/g, "") + ")" : "") + ".</p>";
    });
  });
})();
