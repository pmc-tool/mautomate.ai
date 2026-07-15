/**
 * GET /marketing-chat/widget.js — the embeddable, dependency-free chat loader.
 *
 * A merchant pastes ONE tag into ANY website (their mAutomate storefront, a
 * WordPress site, a landing page):
 *
 *   <script src="https://<backend>/marketing-chat/widget.js"
 *           data-public-key="<chatbot public key>" defer></script>
 *
 * The script reads its own `data-public-key` and its own `src` origin (so it
 * always talks back to the backend that served it, behind any proxy), then runs
 * exactly the same public contract as the React storefront widget:
 *
 *   GET  /marketing-chat/config?public_key=…      -> appearance (or 404 -> render nothing)
 *   POST /marketing-chat/session { public_key }   -> conversation_token
 *   POST /marketing-chat/message { conversation_token, text }
 *   GET  /marketing-chat/messages?conversation_token=…&since=…
 *
 * Served with permissive CORS (it is a public asset) and `no-store` so a merchant
 * editing their bot never gets a stale widget. All styling is injected as a
 * scoped stylesheet under the `mac-` prefix; the host page's CSS is untouched.
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/** Client token storage key — per public key, so two bots never share a thread. */
const SCRIPT = String.raw`(function () {
  "use strict";
  var script =
    document.currentScript ||
    (function () {
      var all = document.getElementsByTagName("script");
      for (var i = all.length - 1; i >= 0; i--) {
        if (all[i].src && all[i].src.indexOf("/marketing-chat/widget.js") !== -1) {
          return all[i];
        }
      }
      return null;
    })();
  if (!script) {
    return;
  }

  var publicKey = script.getAttribute("data-public-key") || "";
  if (!publicKey) {
    return;
  }
  if (window.__mAutomateChat && window.__mAutomateChat[publicKey]) {
    return;
  }
  window.__mAutomateChat = window.__mAutomateChat || {};
  window.__mAutomateChat[publicKey] = true;

  var base = (function () {
    try {
      var u = new URL(script.src, window.location.href);
      return u.origin;
    } catch (e) {
      return "";
    }
  })();

  var TOKEN_KEY = "marketing_chat_token_" + publicKey;
  var POLL_MS = 4000;

  var state = {
    config: null,
    token: null,
    open: false,
    since: null,
    ids: {},
    sending: false,
    timer: null,
  };

  function storeGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }
  function storeSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      /* private mode / quota: the session still works in memory */
    }
  }

  function api(path, options) {
    return fetch(base + path, options).then(function (res) {
      if (!res.ok) {
        throw new Error(String(res.status));
      }
      return res.json();
    });
  }

  function esc(text) {
    var div = document.createElement("div");
    div.textContent = text == null ? "" : String(text);
    return div.innerHTML;
  }

  function time(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) {
      return "";
    }
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function injectStyles(config) {
    var side = config.position === "left" ? "left" : "right";
    // The widget is injected into the merchant storefront, whose theme CSS
    // (Bootstrap etc) targets bare inputs and was stretching ours into an oval,
    // so every visual property below is pinned with !important. The mac-typing
    // rules are the "agent is typing" dots.
    var css =
      ".mac-root{position:fixed;bottom:20px;" + side + ":20px;z-index:2147483000;" +
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;" +
      "display:flex;flex-direction:column;align-items:" + (side === "left" ? "flex-start" : "flex-end") + ";}" +
      ".mac-bubble{width:56px;height:56px;border:0;border-radius:50%;cursor:pointer;color:#fff;" +
      "background:" + config.color + ";box-shadow:0 6px 20px rgba(0,0,0,.22);display:flex;" +
      "align-items:center;justify-content:center;padding:0;transition:transform .15s ease;}" +
      ".mac-bubble:hover{transform:scale(1.05);}" +
      ".mac-bubble img{width:56px;height:56px;border-radius:50%;object-fit:cover;}" +
      ".mac-teaser{max-width:220px;margin-bottom:10px;background:#fff;color:#1f2937;border-radius:12px;" +
      "padding:10px 12px;font-size:13px;line-height:1.4;box-shadow:0 6px 20px rgba(0,0,0,.16);" +
      "cursor:pointer;position:relative;}" +
      ".mac-teaser-close{position:absolute;top:-8px;" + (side === "left" ? "right" : "left") + ":-8px;width:20px;height:20px;" +
      "border-radius:50%;border:0;background:#374151;color:#fff;font-size:12px;line-height:1;cursor:pointer;padding:0;}" +
      ".mac-panel{display:none;flex-direction:column;overflow:hidden;background:#fff;border-radius:14px;" +
      "box-shadow:0 12px 40px rgba(0,0,0,.24);margin-bottom:12px;" +
      "width:" + config.embed_width + "px;height:" + config.embed_height + "px;" +
      "max-width:calc(100vw - 32px);max-height:calc(100vh - 120px);}" +
      ".mac-panel.mac-open{display:flex;}" +
      ".mac-head{display:flex;align-items:center;gap:10px;padding:12px 14px;color:#fff;background:" + config.color + ";}" +
      ".mac-head-avatar{width:34px;height:34px;border-radius:50%;object-fit:cover;background:rgba(255,255,255,.22);" +
      "display:flex;align-items:center;justify-content:center;font-weight:600;font-size:14px;flex:0 0 auto;}" +
      ".mac-head-text{flex:1 1 auto;min-width:0;}" +
      ".mac-title{margin:0;font-size:14px;font-weight:600;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
      ".mac-sub{margin:2px 0 0;font-size:11px;line-height:1.2;opacity:.85;}" +
      ".mac-close{border:0;background:transparent;color:#fff;font-size:20px;line-height:1;cursor:pointer;padding:2px 4px;opacity:.9;}" +
      ".mac-list{flex:1 1 auto;overflow-y:auto;padding:14px;background:#f6f7f9;display:flex;flex-direction:column;gap:10px;}" +
      ".mac-row{display:flex;}" +
      ".mac-row.mac-mine{justify-content:flex-end;}" +
      ".mac-msg{max-width:80%;padding:8px 12px;border-radius:14px;font-size:13px;line-height:1.45;" +
      "white-space:pre-wrap;word-break:break-word;}" +
      ".mac-mine .mac-msg{background:" + config.color + ";color:#fff;border-bottom-right-radius:4px;}" +
      ".mac-them .mac-msg{background:#fff;color:#1f2937;border:1px solid #e5e7eb;border-bottom-left-radius:4px;}" +
      ".mac-meta{margin-top:3px;font-size:10px;color:#9ca3af;}" +
      ".mac-mine .mac-meta{text-align:right;}" +
      ".mac-note{margin:auto;color:#6b7280;font-size:13px;text-align:center;padding:0 12px;}" +
      ".mac-form{display:flex;gap:8px;padding:10px;border-top:1px solid #e5e7eb;background:#fff;}" +
      ".mac-input{flex:1 1 auto !important;min-width:0 !important;width:auto !important;" +
      "height:38px !important;box-sizing:border-box !important;margin:0 !important;" +
      "border:1px solid #e5e7eb !important;border-radius:19px !important;padding:0 14px !important;" +
      "font-size:13px !important;line-height:38px !important;outline:none !important;" +
      "color:#1f2937 !important;background:#f9fafb !important;box-shadow:none !important;" +
      "font-family:inherit !important;appearance:none !important;-webkit-appearance:none !important;}" +
      ".mac-input:focus{border-color:" + config.color + " !important;box-shadow:none !important;}" +
      ".mac-typing{display:flex;align-items:center;gap:4px;padding:10px 14px;background:#fff;" +
      "border:1px solid #eef0f2;border-radius:14px;width:fit-content;}" +
      ".mac-typing span{width:6px;height:6px;border-radius:50%;background:#9ca3af;display:inline-block;" +
      "animation:mac-blink 1.2s infinite ease-in-out;}" +
      ".mac-typing span:nth-child(2){animation-delay:.18s;}" +
      ".mac-typing span:nth-child(3){animation-delay:.36s;}" +
      "@keyframes mac-blink{0%,80%,100%{opacity:.25;transform:translateY(0);}" +
      "40%{opacity:1;transform:translateY(-2px);}}" +
      ".mac-send{border:0;border-radius:50%;width:38px;height:38px;flex:0 0 auto;cursor:pointer;color:#fff;" +
      "background:" + config.color + ";display:flex;align-items:center;justify-content:center;padding:0;}" +
      ".mac-send:disabled{opacity:.45;cursor:default;}" +
      ".mac-brand{padding:6px 10px;text-align:center;font-size:10px;color:#9ca3af;background:#fff;" +
      "border-top:1px solid #f1f2f4;}";
    var style = document.createElement("style");
    style.setAttribute("data-mac", publicKey);
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
  }

  var els = {};

  function render(config) {
    injectStyles(config);

    var root = document.createElement("div");
    root.className = "mac-root";
    root.setAttribute("data-mac-root", publicKey);

    var panel = document.createElement("div");
    panel.className = "mac-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", config.name);

    var avatar = config.avatar
      ? '<img class="mac-head-avatar" src="' + esc(config.avatar) + '" alt="">'
      : '<span class="mac-head-avatar">' + esc(config.name.charAt(0).toUpperCase()) + "</span>";

    panel.innerHTML =
      '<div class="mac-head">' +
      avatar +
      '<div class="mac-head-text"><p class="mac-title">' + esc(config.name) + "</p>" +
      '<p class="mac-sub">We typically reply in a few minutes</p></div>' +
      '<button type="button" class="mac-close" aria-label="Close chat">&times;</button>' +
      "</div>" +
      '<div class="mac-list"></div>' +
      '<form class="mac-form"><input class="mac-input" type="text" autocomplete="off" ' +
      'placeholder="Type your message..." aria-label="Type your message">' +
      '<button class="mac-send" type="submit" aria-label="Send message">' +
      '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
      '<path d="M2 8l12-5.5L9 14l-2.2-4.3L2 8z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>' +
      "</svg></button></form>" +
      (config.show_logo
        ? '<div class="mac-brand">Powered by mAutomate</div>'
        : "");

    var bubble = document.createElement("button");
    bubble.type = "button";
    bubble.className = "mac-bubble";
    bubble.setAttribute("aria-label", "Open chat");
    bubble.innerHTML = config.avatar
      ? '<img src="' + esc(config.avatar) + '" alt="">'
      : '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<path d="M4 5h16v11H9l-4 3v-3H4V5z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';

    var teaser = null;
    if (config.bubble_message) {
      teaser = document.createElement("div");
      teaser.className = "mac-teaser";
      teaser.innerHTML =
        "<span>" + esc(config.bubble_message) + "</span>" +
        '<button type="button" class="mac-teaser-close" aria-label="Dismiss">&times;</button>';
      teaser.addEventListener("click", function (e) {
        if (e.target && e.target.className === "mac-teaser-close") {
          teaser.style.display = "none";
          return;
        }
        toggle(true);
      });
      root.appendChild(teaser);
    }

    root.appendChild(panel);
    root.appendChild(bubble);
    document.body.appendChild(root);

    els = {
      root: root,
      panel: panel,
      bubble: bubble,
      teaser: teaser,
      list: panel.querySelector(".mac-list"),
      form: panel.querySelector(".mac-form"),
      input: panel.querySelector(".mac-input"),
      send: panel.querySelector(".mac-send"),
    };

    bubble.addEventListener("click", function () {
      toggle(!state.open);
    });
    panel.querySelector(".mac-close").addEventListener("click", function () {
      toggle(false);
    });
    els.form.addEventListener("submit", function (e) {
      e.preventDefault();
      submit();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && state.open) {
        toggle(false);
      }
    });

    paint();
  }

  function toggle(open) {
    state.open = !!open;
    els.panel.classList.toggle("mac-open", state.open);
    els.bubble.setAttribute("aria-label", state.open ? "Close chat" : "Open chat");
    if (els.teaser) {
      els.teaser.style.display = state.open ? "none" : "";
    }
    if (state.open) {
      els.input.focus();
      startSession().then(function () {
        poll();
        if (!state.timer) {
          state.timer = window.setInterval(poll, POLL_MS);
        }
      });
    } else if (state.timer) {
      window.clearInterval(state.timer);
      state.timer = null;
    }
  }

  var messages = [];

  function paint() {
    var list = els.list;
    list.innerHTML = "";

    if (!messages.length) {
      var note = document.createElement("div");
      note.className = "mac-note";
      note.textContent =
        state.config.welcome_message || "Send us a message and we will reply here.";
      list.appendChild(note);
      return;
    }

    messages.forEach(function (m) {
      var mine = m.direction === "inbound" || m.author === "contact";
      var row = document.createElement("div");
      row.className = "mac-row " + (mine ? "mac-mine" : "mac-them");
      var wrap = document.createElement("div");
      var body = document.createElement("div");
      body.className = "mac-msg";
      body.textContent = m.body || "";
      if (m.pending) {
        body.style.opacity = "0.7";
      }
      wrap.appendChild(body);
      if (state.config.show_datetime) {
        var meta = document.createElement("div");
        meta.className = "mac-meta";
        meta.textContent = m.pending ? "Sending..." : time(m.sent_at);
        wrap.appendChild(meta);
      }
      row.appendChild(wrap);
      list.appendChild(row);
    });

    // "Agent is typing" — shown from the moment the customer sends until a
    // reply actually lands, so nobody stares at a dead window wondering.
    if (state.typing) {
      var trow = document.createElement("div");
      trow.className = "mac-row";
      var tbub = document.createElement("div");
      tbub.className = "mac-typing";
      tbub.appendChild(document.createElement("span"));
      tbub.appendChild(document.createElement("span"));
      tbub.appendChild(document.createElement("span"));
      trow.appendChild(tbub);
      list.appendChild(trow);
    }

    list.scrollTop = list.scrollHeight;
  }

  function merge(incoming) {
    if (!incoming || !incoming.length) {
      return;
    }
    // A reply landed — stop the dots.
    var fromThem = incoming.some(function (m) {
      return !(m.direction === "inbound" || m.author === "contact");
    });
    if (fromThem) {
      state.typing = false;
      if (state.typingTimer) {
        window.clearTimeout(state.typingTimer);
        state.typingTimer = null;
      }
    }
    incoming.forEach(function (m) {
      if (state.ids[m.id]) {
        return;
      }
      var mine = m.direction === "inbound" || m.author === "contact";
      if (mine) {
        for (var i = messages.length - 1; i >= 0; i--) {
          if (messages[i].pending && (messages[i].body || "") === (m.body || "")) {
            messages.splice(i, 1);
            break;
          }
        }
      }
      state.ids[m.id] = true;
      messages.push(m);
      if (!state.since || new Date(m.sent_at) > new Date(state.since)) {
        state.since = m.sent_at;
      }
    });
    messages.sort(function (a, b) {
      return new Date(a.sent_at) - new Date(b.sent_at);
    });
    paint();
  }

  function startSession() {
    if (state.token) {
      return Promise.resolve(state.token);
    }
    var stored = storeGet(TOKEN_KEY);
    if (stored) {
      state.token = stored;
      return Promise.resolve(stored);
    }
    return api("/marketing-chat/session", {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_key: publicKey }),
    })
      .then(function (data) {
        if (!data || !data.conversation_token) {
          throw new Error("no token");
        }
        state.token = data.conversation_token;
        storeSet(TOKEN_KEY, state.token);
        return state.token;
      })
      .catch(function () {
        return null;
      });
  }

  function poll() {
    if (!state.token) {
      return Promise.resolve();
    }
    var url =
      "/marketing-chat/messages?conversation_token=" +
      encodeURIComponent(state.token) +
      (state.since ? "&since=" + encodeURIComponent(state.since) : "");
    return api(url, { mode: "cors" })
      .then(function (data) {
        merge((data && data.messages) || []);
      })
      .catch(function () {
        /* transient: the next poll retries */
      });
  }

  function submit() {
    var text = (els.input.value || "").trim();
    if (!text || state.sending) {
      return;
    }
    els.input.value = "";
    state.sending = true;
    state.typing = true; // the assistant is composing — show it
    els.send.disabled = true;

    messages.push({
      id: "local-" + Date.now(),
      direction: "inbound",
      author: "contact",
      body: text,
      sent_at: new Date().toISOString(),
      pending: true,
    });
    paint();

    startSession()
      .then(function (token) {
        if (!token) {
          throw new Error("no session");
        }
        return api("/marketing-chat/message", {
          method: "POST",
          mode: "cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversation_token: token, text: text }),
        });
      })
      .then(function () {
        return poll();
      })
      .catch(function () {
        var note = messages[messages.length - 1];
        if (note && note.pending) {
          note.pending = false;
          note.body = text;
        }
        paint();
      })
      .then(function () {
        state.sending = false;
        els.send.disabled = false;
        // Keep the dots up until a reply actually arrives (poll clears them);
        // give up after a while so they can never spin forever.
        if (state.typingTimer) {
          window.clearTimeout(state.typingTimer);
        }
        state.typingTimer = window.setTimeout(function () {
          state.typing = false;
          paint();
        }, 45000);
      });
  }

  function boot() {
    api("/marketing-chat/config?public_key=" + encodeURIComponent(publicKey), {
      mode: "cors",
    })
      .then(function (data) {
        if (!data || !data.chatbot) {
          return;
        }
        state.config = data.chatbot;
        if (document.body) {
          render(state.config);
        } else {
          document.addEventListener("DOMContentLoaded", function () {
            render(state.config);
          });
        }
      })
      .catch(function () {
        /* no live chatbot for this key: render nothing, stay silent */
      });
  }

  boot();
})();
`

/**
 * The loader is a static asset, but it is served by the API so the merchant only
 * ever needs the backend origin. `no-store` keeps a bot's appearance changes from
 * being pinned in a browser/CDN cache; `*` CORS because it is embedded on
 * arbitrary third-party sites.
 */
export const GET = async (_req: MedusaRequest, res: MedusaResponse) => {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8")
  res.setHeader("Cache-Control", "no-store")
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.status(200).send(SCRIPT)
}

export const OPTIONS = async (_req: MedusaRequest, res: MedusaResponse) => {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
  res.setHeader("Access-Control-Max-Age", "86400")
  res.status(204).send("")
}
