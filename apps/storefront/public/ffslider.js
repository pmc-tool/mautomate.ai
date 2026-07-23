/* ffslider — the layered hero_slider runtime (ARCH-SLIDER §2.3).
 * Dependency-free IIFE, ~2 KB. CSS does all layout and animation; this
 * only switches slides: autoplay (per-slide override, pause on hover),
 * arrows, dots, swipe, aria-live announcement, and entrance stamping
 * (adds `ffs-in` to a layer after its data-ffs-delay — the preset CSS
 * does the actual animating). Binds ONLY data-ffs-* markers, so it can
 * never touch a theme's own [data-hero] slider and vice versa.
 * Double-load safe: the window guard makes a second tag a no-op. */
;(function () {
  "use strict"
  if (window.__ffslider) return
  window.__ffslider = 1

  function init(root) {
    if (root.__ffs) return
    root.__ffs = 1
    root.classList.add("ffs-js")
    var slides = [].slice.call(root.querySelectorAll(":scope > .ffs-slide"))
    if (!slides.length) return
    var dots = [].slice.call(root.querySelectorAll("[data-ffs-dot]"))
    var autoplay = parseInt(root.getAttribute("data-ffs-autoplay") || "0", 10) || 0
    var pauseOnHover = root.hasAttribute("data-ffs-pause")
    var live = document.createElement("div")
    live.setAttribute("aria-live", "polite")
    live.style.cssText =
      "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)"
    root.appendChild(live)

    var cur = 0
    var timer = null
    var timeouts = []

    function stampEntrances(slide) {
      ;[].slice.call(slide.querySelectorAll("[data-ffs-delay]")).forEach(function (el) {
        el.classList.remove("ffs-in")
        timeouts.push(
          setTimeout(function () {
            el.classList.add("ffs-in")
          }, parseInt(el.getAttribute("data-ffs-delay") || "0", 10) || 0)
        )
      })
    }

    function show(n) {
      n = ((n % slides.length) + slides.length) % slides.length
      timeouts.forEach(clearTimeout)
      timeouts = []
      slides.forEach(function (s, i) {
        s.classList.toggle("ffs-active", i === n)
        s.classList.toggle("ffs-before", i < n)
        if (i !== n) {
          ;[].slice.call(s.querySelectorAll(".ffs-in")).forEach(function (el) {
            el.classList.remove("ffs-in")
          })
        }
      })
      dots.forEach(function (d, i) {
        d.classList.toggle("ffs-active", i === n)
      })
      cur = n
      stampEntrances(slides[n])
      live.textContent = "Slide " + (n + 1) + " of " + slides.length
    }

    function delayFor(n) {
      var d = parseInt(slides[n].getAttribute("data-ffs-duration") || "0", 10)
      return d > 0 ? d : autoplay
    }

    function stop() {
      if (timer) clearTimeout(timer)
      timer = null
    }

    function start() {
      stop()
      if (!autoplay || slides.length < 2) return
      timer = setTimeout(function () {
        show(cur + 1)
        start()
      }, delayFor(cur))
    }

    var prev = root.querySelector("[data-ffs-prev]")
    var next = root.querySelector("[data-ffs-next]")
    if (prev)
      prev.addEventListener("click", function () {
        show(cur - 1)
        start()
      })
    if (next)
      next.addEventListener("click", function () {
        show(cur + 1)
        start()
      })
    dots.forEach(function (d) {
      d.addEventListener("click", function () {
        show(parseInt(d.getAttribute("data-ffs-dot"), 10) || 0)
        start()
      })
    })

    if (pauseOnHover) {
      root.addEventListener("mouseenter", stop)
      root.addEventListener("mouseleave", start)
    }

    // Swipe: pointer events, 40px horizontal threshold, vertical scroll wins.
    var px = 0,
      py = 0,
      swiping = false
    root.addEventListener(
      "pointerdown",
      function (e) {
        px = e.clientX
        py = e.clientY
        swiping = true
      },
      { passive: true }
    )
    root.addEventListener(
      "pointerup",
      function (e) {
        if (!swiping) return
        swiping = false
        var dx = e.clientX - px
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - py)) {
          show(dx < 0 ? cur + 1 : cur - 1)
          start()
        }
      },
      { passive: true }
    )

    show(0)
    start()
  }

  function boot() {
    ;[].slice.call(document.querySelectorAll(".ffs[data-ffs]")).forEach(init)
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot)
  } else {
    boot()
  }
})()
