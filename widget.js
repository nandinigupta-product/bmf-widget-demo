(function () {
  const DEFAULTS = {
    product: "forex_card",
    city_code: "DEL",
    currency: "USD",
    amount: "1000",

    themePrimary: "#e31b23",
    themeText: "#111827",
    themeMuted: "#6b7280",
    themeBorder: "#e5e7eb",
    themeBg: "#ffffff",
    radius: "12px",
    shadow: "0 10px 28px rgba(17, 24, 39, 0.10)",
  };

  const PRODUCTS = [
    { value: "forex_card", label: "Forex Card" },
    { value: "currency_notes", label: "Currency Notes" },
  ];

  const CURRENCIES = ["USD", "EUR", "GBP", "AED", "SAR", "CAD", "AUD", "SGD", "THB", "JPY", "CHF", "HKD"];

  const BMF_RATE_API =
    "https://www.bookmyforex.com/api/secure/v1/get-full-rate-card?city_code=";

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => {
      const m = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
      return m[c] || c;
    });
  }
  function toNum(v) {
    const n = Number(String(v ?? "").replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : null;
  }
  function formatINR(n) {
    if (!isFinite(n)) return "—";
    return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  }
  function formatRate(n) {
    if (!isFinite(n)) return "—";
    return n.toLocaleString("en-IN", { maximumFractionDigits: 4 });
  }
  function prettifyAmount(raw) {
    const cleaned = String(raw || "").replace(/,/g, "").trim();
    const num = Number(cleaned);
    if (!Number.isFinite(num) || num <= 0) return raw;
    return num.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  }
  function fallbackTatText() {
    return "Same-day if placed by 1PM (working days); otherwise next working day.";
  }
  function buildSelect(options, value) {
    return options
      .map((o) => {
        const v = typeof o === "string" ? o : o.value;
        const l = typeof o === "string" ? o : o.label;
        const selected = String(v) === String(value) ? "selected" : "";
        return `<option value="${esc(v)}" ${selected}>${esc(l)}</option>`;
      })
      .join("");
  }

  function sniffTheme() {
    const theme = { ...DEFAULTS };
    const bodyStyle = getComputedStyle(document.body || document.documentElement);
    theme.fontFamily = bodyStyle.fontFamily || "inherit";

    const btnCandidate =
      Array.from(document.querySelectorAll("button, a"))
        .find((el) => (el.textContent || "").trim().toUpperCase().includes("BOOK")) ||
      document.querySelector("button") ||
      document.querySelector("a");

    const inputCandidate =
      document.querySelector("select") ||
      document.querySelector('input[type="text"]') ||
      document.querySelector("input");

    if (btnCandidate) {
      const s = getComputedStyle(btnCandidate);
      if (s.backgroundColor && s.backgroundColor !== "rgba(0, 0, 0, 0)") theme.themePrimary = s.backgroundColor;
      if (s.color) theme.btnText = s.color;
      if (s.borderRadius) theme.radius = s.borderRadius;
      if (s.boxShadow && s.boxShadow !== "none") theme.btnShadow = s.boxShadow;
      if (s.fontWeight) theme.btnWeight = s.fontWeight;
      if (s.letterSpacing) theme.btnLetterSpacing = s.letterSpacing;
    }
    if (inputCandidate) {
      const s = getComputedStyle(inputCandidate);
      if (s.borderColor) theme.themeBorder = s.borderColor;
      if (s.borderRadius) theme.inputRadius = s.borderRadius;
      if (s.height) theme.inputHeight = s.height;
      if (s.color) theme.themeText = s.color;
      if (s.backgroundColor) theme.inputBg = s.backgroundColor;
    }
    theme.btnText = theme.btnText || "#ffffff";
    theme.btnShadow = theme.btnShadow || "0 10px 22px rgba(0,0,0,0.12)";
    theme.btnWeight = theme.btnWeight || "900";
    theme.btnLetterSpacing = theme.btnLetterSpacing || "0.03em";
    theme.inputRadius = theme.inputRadius || theme.radius;
    theme.inputHeight = theme.inputHeight || "44px";
    theme.inputBg = theme.inputBg || "#fff";
    return theme;
  }

  async function loadCities(citiesUrl) {
    const res = await fetch(citiesUrl);
    if (!res.ok) throw new Error(`Cities JSON fetch failed: ${res.status}`);
    const json = await res.json();
    const citiesObj = json?.cities || json?.data?.cities || json;
    const entries = Object.entries(citiesObj || {})
      .filter(([code, meta]) => /^[A-Z0-9]{2,6}$/.test(String(code)) && meta && typeof meta === "object")
      .map(([code, meta]) => ({ code, label: meta.description || meta.name || code }))
      .sort((a, b) => String(a.label).localeCompare(String(b.label)));
    if (!entries.length) throw new Error("No valid cities found");
    return entries;
  }

  function buildCityOptions(cityArr, selectedCode) {
    return cityArr
      .map(({ code, label }) => {
        const selected = String(code) === String(selectedCode) ? "selected" : "";
        return `<option value="${esc(code)}" ${selected}>${esc(label)}</option>`;
      })
      .join("");
  }

  // ✅ Same-origin secure call (works on bookmyforex.com)
  async function fetchBmfRateCardSameOrigin(cityCode) {
    const url = BMF_RATE_API + encodeURIComponent(cityCode || "");
    const res = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: {
        "accept": "application/json, text/javascript, */*; q=0.01",
        "x-requested-with": "XMLHttpRequest",
      },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Rate API failed: ${res.status} ${text.slice(0, 150)}`);
    try { return JSON.parse(text); } catch { return text; }
  }

  // ✅ Proxy call (works on github.io if you provide a proxy)
  async function fetchBmfRateCardViaProxy(proxyBaseUrl, cityCode) {
    const url = proxyBaseUrl + "?" + new URLSearchParams({ city_code: cityCode || "" }).toString();
    const res = await fetch(url, { method: "GET", headers: { "accept": "application/json" } });
    const text = await res.text();
    if (!res.ok) throw new Error(`Proxy failed: ${res.status} ${text.slice(0, 150)}`);
    try { return JSON.parse(text); } catch { return text; }
  }

  function findCurrencyNode(obj, currency) {
    const target = String(currency).toUpperCase();
    const seen = new Set();
    function walk(x) {
      if (!x || typeof x !== "object") return null;
      if (seen.has(x)) return null;
      seen.add(x);
      if (Array.isArray(x)) {
        for (const it of x) {
          const found = walk(it);
          if (found) return found;
        }
        return null;
      }
      const code = x.currency || x.currency_code || x.ccy || x.code || x.symbol;
      if (code && String(code).toUpperCase() === target) return x;
      if (x[target] && typeof x[target] === "object") return x[target];
      for (const k of Object.keys(x)) {
        const found = walk(x[k]);
        if (found) return found;
      }
      return null;
    }
    return walk(obj);
  }

  function pickBuySell(node) {
    if (!node || typeof node !== "object") return { buy: null, sell: null };

    const buy =
      toNum(node.buy) ??
      toNum(node.buy_rate) ??
      toNum(node.buyRate) ??
      toNum(node.card_buy) ??
      toNum(node.cardBuy) ??
      toNum(node.cash_buy) ??
      toNum(node.cashBuy) ??
      toNum(node.buying_rate) ??
      toNum(node.fx_card_buy) ??
      toNum(node.fxCardBuy) ??
      toNum(node.rates?.buy);

    const sell =
      toNum(node.sell) ??
      toNum(node.sell_rate) ??
      toNum(node.sellRate) ??
      toNum(node.card_sell) ??
      toNum(node.cardSell) ??
      toNum(node.cash_sell) ??
      toNum(node.cashSell) ??
      toNum(node.selling_rate) ??
      toNum(node.fx_card_sell) ??
      toNum(node.fxCardSell) ??
      toNum(node.rates?.sell);

    return { buy, sell };
  }

  function extractTat(json) {
    const candidates = [
      json?.tat,
      json?.delivery_tat,
      json?.deliveryTat,
      json?.delivery_eta,
      json?.deliveryEta,
      json?.sla,
      json?.data?.tat,
      json?.data?.delivery_tat,
      json?.data?.deliveryTat,
      json?.data?.delivery_eta,
      json?.data?.deliveryEta,
      json?.data?.sla,
    ];
    for (const c of candidates) {
      if (typeof c === "string" && c.trim()) return c.trim();
      if (typeof c === "number" && Number.isFinite(c)) return String(c);
      if (c && typeof c === "object") {
        if (c?.text) return String(c.text);
        if (c?.message) return String(c.message);
      }
    }
    return null;
  }

  async function renderOne(el) {
    const product = el.getAttribute("data-product") || DEFAULTS.product;
    const city_code = el.getAttribute("data-city-code") || DEFAULTS.city_code;
    const currency = el.getAttribute("data-currency") || DEFAULTS.currency;
    const amount = el.getAttribute("data-amount") || DEFAULTS.amount;

    const citiesUrl = el.getAttribute("data-cities-url") || "./cities.json";
    const proxyUrl = el.getAttribute("data-proxy-url") || ""; // ✅ required for github.io demo

    const sniffed = sniffTheme();
    const theme = {
      ...sniffed,
      themePrimary: el.getAttribute("data-theme-primary") || sniffed.themePrimary,
      themeText: el.getAttribute("data-theme-text") || sniffed.themeText,
      themeMuted: el.getAttribute("data-theme-muted") || sniffed.themeMuted,
      themeBorder: el.getAttribute("data-theme-border") || sniffed.themeBorder,
      themeBg: el.getAttribute("data-theme-bg") || sniffed.themeBg,
    };

    let cityArr = [];
    try {
      cityArr = await loadCities(citiesUrl);
    } catch (e) {
      cityArr = [
        { code: "DEL", label: "Delhi" },
        { code: "GUR", label: "Gurugram / Gurgaon" },
        { code: "MUM", label: "Mumbai" },
      ];
      console.warn("Cities load failed, using fallback:", e);
    }

    const uid = `bmfqo_${Math.random().toString(16).slice(2)}`;

    el.innerHTML = `
      <style>
        #${uid}.bmfqo { font-family:${esc(theme.fontFamily || "inherit")}; color:${esc(theme.themeText)}; max-width:820px; }
        #${uid} .card { background:${esc(theme.themeBg)}; border:1px solid ${esc(theme.themeBorder)}; border-radius:${esc(theme.radius)}; overflow:hidden; box-shadow:${esc(theme.shadow)}; }
        #${uid} .head { display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:rgba(227,27,35,.06); border-bottom:1px solid ${esc(theme.themeBorder)}; }
        #${uid} .title { font-weight:900; font-size:14px; letter-spacing:.02em; text-transform:uppercase; }
        #${uid} .sub { font-size:12px; color:${esc(theme.themeMuted)}; margin-top:2px; }
        #${uid} .pill { font-size:12px; font-weight:800; color:${esc(theme.themePrimary)}; background:rgba(227,27,35,.10); padding:6px 10px; border-radius:999px; border:1px solid rgba(227,27,35,.18); white-space:nowrap; }
        #${uid} .body { padding:16px; }
        #${uid} .grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
        @media(max-width:860px){ #${uid} .grid{ grid-template-columns:repeat(2,minmax(0,1fr)); } }
        @media(max-width:520px){ #${uid} .grid{ grid-template-columns:1fr; } }
        #${uid} label{ display:block; font-size:12px; font-weight:900; letter-spacing:.02em; color:${esc(theme.themeMuted)}; margin-bottom:6px; text-transform:uppercase; }
        #${uid} .ctl{ width:100%; height:${esc(theme.inputHeight)}; border:1px solid ${esc(theme.themeBorder)}; border-radius:${esc(theme.inputRadius)}; padding:0 12px; font-size:14px; outline:none; background:${esc(theme.inputBg)}; color:${esc(theme.themeText)}; }
        #${uid} .ctl:focus{ border-color:${esc(theme.themePrimary)}; box-shadow:0 0 0 3px rgba(227,27,35,.14); }
        #${uid} .row{ display:flex; gap:12px; align-items:center; margin-top:14px; flex-wrap:wrap; }
        #${uid} .box{ flex:1; min-width:280px; border:1px solid ${esc(theme.themeBorder)}; border-radius:${esc(theme.radius)}; padding:12px 14px; background:rgba(17,24,39,.02); }
        #${uid} .l1{ font-size:12px; color:${esc(theme.themeMuted)}; margin-bottom:6px; display:flex; justify-content:space-between; gap:10px; }
        #${uid} .l2{ font-size:15px; font-weight:900; }
        #${uid} .l3{ margin-top:8px; font-size:12px; color:${esc(theme.themeMuted)}; line-height:1.35; }
        #${uid} .btn{ height:${esc(theme.inputHeight)}; padding:0 18px; border:0; border-radius:${esc(theme.inputRadius)}; background:${esc(theme.themePrimary)}; color:${esc(theme.btnText || "#fff")}; font-weight:${esc(theme.btnWeight || "900")}; letter-spacing:${esc(theme.btnLetterSpacing || "0.03em")}; cursor:pointer; text-transform:uppercase; box-shadow:${esc(theme.btnShadow || "0 10px 22px rgba(0,0,0,0.12)")}; }
        #${uid} .btn:disabled{ opacity:.55; cursor:not-allowed; box-shadow:none; }
        #${uid} .note{ margin-top:10px; font-size:12px; color:${esc(theme.themeMuted)}; line-height:1.35; }
        #${uid} .err{ margin-top:10px; font-size:12px; color:${esc(theme.themePrimary)}; font-weight:900; display:none; }
      </style>

      <div id="${uid}" class="bmfqo">
        <div class="card">
          <div class="head">
            <div>
              <div class="title">Book an Order</div>
              <div class="sub">City-based rates • then continue to checkout</div>
            </div>
            <div class="pill" data-role="status">Live rates</div>
          </div>
          <div class="body">
            <div class="grid">
              <div>
                <label>Product</label>
                <select class="ctl" data-role="product">${buildSelect(PRODUCTS, product)}</select>
              </div>
              <div>
                <label>City</label>
                <select class="ctl" data-role="city">${buildCityOptions(cityArr, city_code)}</select>
              </div>
              <div>
                <label>Currency</label>
                <select class="ctl" data-role="currency">${buildSelect(CURRENCIES, currency)}</select>
              </div>
              <div>
                <label>Amount</label>
                <input class="ctl" data-role="amount" inputmode="decimal" value="${esc(prettifyAmount(amount))}" />
              </div>
            </div>

            <div class="row">
              <div class="box">
                <div class="l1">
                  <span>Buy: <b>₹ <span data-role="buy">—</span></b> | Sell: <b>₹ <span data-role="sell">—</span></b></span>
                  <span data-role="updated"></span>
                </div>
                <div class="l2">Total Amount: ₹ <span data-role="inr">—</span></div>
                <div class="l3">Delivery: <span data-role="tat">—</span></div>
              </div>
              <button class="btn" data-role="cta" disabled>Book this order</button>
            </div>

            <div class="note">
              Note: Final payable can vary by product, denomination availability, and serviceability.
            </div>
            <div class="err" data-role="error"></div>
          </div>
        </div>
      </div>
    `;

    const root = el.querySelector(`#${uid}`);
    const $product = root.querySelector('[data-role="product"]');
    const $city = root.querySelector('[data-role="city"]');
    const $currency = root.querySelector('[data-role="currency"]');
    const $amount = root.querySelector('[data-role="amount"]');

    const $buy = root.querySelector('[data-role="buy"]');
    const $sell = root.querySelector('[data-role="sell"]');
    const $inr = root.querySelector('[data-role="inr"]');
    const $tat = root.querySelector('[data-role="tat"]');
    const $updated = root.querySelector('[data-role="updated"]');

    const $cta = root.querySelector('[data-role="cta"]');
    const $error = root.querySelector('[data-role="error"]');
    const $status = root.querySelector('[data-role="status"]');

    let isLoading = false;

    function showError(msg) {
      $error.style.display = "block";
      $error.textContent = msg;
      $status.textContent = "Rate unavailable";
    }
    function clearError() {
      $error.style.display = "none";
      $error.textContent = "";
      $status.textContent = "Live rates";
    }
    function getAmountNumber() {
      const cleaned = String($amount.value || "").replace(/,/g, "").trim();
      const n = Number(cleaned);
      return Number.isFinite(n) && n > 0 ? n : null;
    }

    async function getRates(cityCode, ccy) {
      // If on BMF domain, secure same-origin should work
      const onBmf = location.hostname.endsWith("bookmyforex.com");

      if (onBmf) {
        return await fetchBmfRateCardSameOrigin(cityCode);
      }

      // If not on BMF domain, require proxy
      if (proxyUrl) {
        return await fetchBmfRateCardViaProxy(proxyUrl, cityCode);
      }

      // No proxy → cannot access secure API cross-origin
      throw new Error("Secure API cannot be called cross-origin. Add data-proxy-url or host demo on bookmyforex.com.");
    }

    async function recompute() {
      clearError();
      const amt = getAmountNumber();
      const cityCode = $city.value;
      const ccy = $currency.value;

      if (!amt) {
        $buy.textContent = "—";
        $sell.textContent = "—";
        $inr.textContent = "—";
        $tat.textContent = "—";
        $updated.textContent = "";
        $cta.disabled = true;
        return;
      }

      if (isLoading) return;
      isLoading = true;

      $cta.disabled = true;
      $status.textContent = "Fetching…";
      $buy.textContent = "…";
      $sell.textContent = "…";
      $tat.textContent = "…";
      $updated.textContent = "";

      try {
        const json = await getRates(cityCode, ccy);

        // If server soft-fails with empty array, treat as error
        const isEmpty =
          (Array.isArray(json) && json.length === 0) ||
          (Array.isArray(json?.data) && json.data.length === 0) ||
          (Array.isArray(json?.rates) && json.rates.length === 0);

        if (isEmpty) {
          throw new Error("Rate API returned empty data (likely missing session/auth context).");
        }

        const node = findCurrencyNode(json, ccy);
        const { buy, sell } = pickBuySell(node);
        const tat = extractTat(json) || fallbackTatText();
        const useRate = buy != null ? buy : sell;

        if (useRate == null) throw new Error("Could not map buy/sell fields from API response.");

        $buy.textContent = buy != null ? formatRate(buy) : "—";
        $sell.textContent = sell != null ? formatRate(sell) : "—";
        $inr.textContent = formatINR(amt * useRate);
        $tat.textContent = tat;
        $updated.textContent = `Updated ${nowTimeStr()}`;
        $cta.disabled = false;
        $status.textContent = "Live rates";
      } catch (e) {
        $buy.textContent = "—";
        $sell.textContent = "—";
        $inr.textContent = "—";
        $tat.textContent = fallbackTatText();
        $updated.textContent = "";
        showError(String(e?.message || "Unable to fetch rates."));
      } finally {
        isLoading = false;
      }
    }

    let t = null;
    $currency.addEventListener("change", recompute);
    $city.addEventListener("change", recompute);
    $product.addEventListener("change", recompute);
    $amount.addEventListener("input", () => {
      if (t) clearTimeout(t);
      t = setTimeout(recompute, 350);
    });
    $amount.addEventListener("blur", () => {
      $amount.value = prettifyAmount($amount.value);
      recompute();
    });

    $cta.addEventListener("click", () => {
      const url =
        "https://www.bookmyforex.com/?" +
        new URLSearchParams({
          bmf_product: $product.value,
          bmf_city_code: $city.value,
          bmf_ccy: $currency.value,
          bmf_amt: String(getAmountNumber() || ""),
        }).toString();
      window.location.href = url;
    });

    recompute();
  }

  async function init() {
    const els = Array.from(document.querySelectorAll('[data-bmf-widget="quick-order"]'));
    for (const el of els) await renderOne(el);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init().catch(console.error));
  } else {
    init().catch(console.error);
  }
})();
