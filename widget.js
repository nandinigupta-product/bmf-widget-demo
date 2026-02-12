/**
 * BMF Quick Order Widget (final)
 * - Works on WordPress pages (SEO/blog + homepage)
 * - City dropdown uses official BMF city codes (DEL, GUR, etc.) from Cities_list.json
 * - Rates fetched from BMF Rate API:
 *    https://www.bookmyforex.com/api/secure/v1/get-full-rate-card?city_code=<CODE>
 * - Robust JSON parsing: finds currency node anywhere, extracts buy/sell-like fields
 * - Auto-adopts BMF-ish theme by sniffing page computed styles (with safe fallbacks)
 *
 * Embed example (WordPress Custom HTML block):
 *  <div
 *    data-bmf-widget="quick-order"
 *    data-product="forex_card"
 *    data-city-code="DEL"
 *    data-currency="USD"
 *    data-amount="1000"
 *  ></div>
 *  <script async src="https://<your-host>/widget.js?v=1"></script>
 */
(function () {
  // ---------------------------
  // CONFIG + CONSTANTS
  // ---------------------------
  const DEFAULTS = {
    product: "forex_card", // forex_card | currency_notes
    city_code: "DEL",
    currency: "USD",
    amount: "1000",

    // theme fallbacks (if style-sniff fails)
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

  // ✅ Official serviceable cities (codes + descriptions) from your Cities_list.json
  // NOTE: Icons/aliases kept only where present; we primarily use code + description.
  const CITIES = {
    GUR: { description: "Gurugram / Gurgaon", icon: "https://cdn.bookmyforex.com/city-image/gurgaon.png" },
    DEL: { description: "Delhi", icon: "https://cdn.bookmyforex.com/city-image/delhi.png" },
    NOI: { description: "Noida" },
    MUM: { description: "Mumbai", icon: "https://cdn.bookmyforex.com/city-image/mumbai.png" },
    BNG: { description: "Bengaluru", icon: "https://cdn.bookmyforex.com/city-image/bangalore.png" },
    AHM: { description: "Ahmedabad", icon: "https://cdn.bookmyforex.com/city-image/ahmedabad.png" },
    HUA: { description: "Hubballi" },
    CHE: { description: "Chennai", icon: "https://cdn.bookmyforex.com/city-image/chennai.png" },
    HYD: { description: "Hyderabad", icon: "https://cdn.bookmyforex.com/city-image/hyderabad.png" },
    JAI: { description: "Jaipur", icon: "https://cdn.bookmyforex.com/city-image/jaipur.png" },
    KOC: { description: "Kochi", icon: "https://cdn.bookmyforex.com/city-image/kochi.png" },
    KOL: { description: "Kolkata", icon: "https://cdn.bookmyforex.com/city-image/kolkata.png" },
    LUC: { description: "Lucknow", icon: "https://cdn.bookmyforex.com/city-image/lucknow.png" },
    PTN: { description: "Patna", icon: "https://cdn.bookmyforex.com/city-image/patna.png" },
    PUN: { description: "Pune", icon: "https://cdn.bookmyforex.com/city-image/pune.png" },
    RNC: { description: "Ranchi", icon: "https://cdn.bookmyforex.com/city-image/ranchi.png" },
    SUR: { description: "Surat", icon: "https://cdn.bookmyforex.com/city-image/surat.png" },
    TRY: { description: "Trichy", icon: "https://cdn.bookmyforex.com/city-image/trichy.png" },
    VAD: { description: "Vadodara", icon: "https://cdn.bookmyforex.com/city-image/vadodara.png" },
    VIZ: { description: "Vizag", icon: "https://cdn.bookmyforex.com/city-image/vizag.png" },
    AGR: { description: "Agra", icon: "https://cdn.bookmyforex.com/city-image/agra.png" },
    BHO: { description: "Bhopal", icon: "https://cdn.bookmyforex.com/city-image/bhopal.png" },
    BHU: { description: "Bhubaneswar", icon: "https://cdn.bookmyforex.com/city-image/bhubaneswar.png" },
    CHA: { description: "Chandigarh", icon: "https://cdn.bookmyforex.com/city-image/chandigarh.png" },
    COO: { description: "Coimbatore", icon: "https://cdn.bookmyforex.com/city-image/coimbatore.png" },
    GOA: { description: "Goa", icon: "https://cdn.bookmyforex.com/city-image/goa.png" },
    GUW: { description: "Guwahati", icon: "https://cdn.bookmyforex.com/city-image/guwahati.png" },
    HAR: { description: "Haridwar", icon: "https://cdn.bookmyforex.com/city-image/haridwar.png" },
    IND: { description: "Indore", icon: "https://cdn.bookmyforex.com/city-image/indore.png" },
    JOD: { description: "Jodhpur", icon: "https://cdn.bookmyforex.com/city-image/jodhpur.png" },
    LUD: { description: "Ludhiana", icon: "https://cdn.bookmyforex.com/city-image/ludhiana.png" },
    NAG: { description: "Nagpur", icon: "https://cdn.bookmyforex.com/city-image/nagpur.png" },
  };

  const CURRENCIES = [
    "USD","EUR","GBP","AED","SAR","CAD","AUD","SGD","THB","JPY","CHF","HKD","NZD","SEK","NOK","DKK"
  ];

  const BMF_RATE_API =
    "https://www.bookmyforex.com/api/secure/v1/get-full-rate-card?city_code=";

  // ---------------------------
  // UTILS
  // ---------------------------
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

  function nowTimeStr() {
    try {
      return new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
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

  function buildCityOptions(selectedCode) {
    const entries = Object.entries(CITIES);
    entries.sort((a, b) => (a[1]?.description || a[0]).localeCompare(b[1]?.description || b[0]));
    return entries
      .map(([code, meta]) => {
        const label = meta?.description || code;
        const selected = String(code) === String(selectedCode) ? "selected" : "";
        return `<option value="${esc(code)}" ${selected}>${esc(label)}</option>`;
      })
      .join("");
  }

  function normalizeAmountInput(raw) {
    const cleaned = String(raw || "").replace(/,/g, "").trim();
    if (!cleaned) return { num: null, cleaned: "" };
    const num = Number(cleaned);
    if (!isFinite(num) || num <= 0) return { num: null, cleaned };
    return { num, cleaned };
  }

  function prettifyAmount(raw) {
    const { num } = normalizeAmountInput(raw);
    if (!num) return raw;
    return num.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  }

  // ---------------------------
  // THEME SNIFF (BMF look & feel)
  // ---------------------------
  function sniffTheme() {
    const theme = { ...DEFAULTS };

    const bodyStyle = getComputedStyle(document.body || document.documentElement);
    theme.fontFamily = bodyStyle.fontFamily || "inherit";

    // Try to find BMF-like CTA button
    const btnCandidate =
      Array.from(document.querySelectorAll("button, a"))
        .find((el) => (el.textContent || "").trim().toUpperCase().includes("BOOK")) ||
      document.querySelector("button") ||
      document.querySelector("a");

    // Try to find input/select on the page
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

    // Defaults if not sniffed
    theme.btnText = theme.btnText || "#ffffff";
    theme.btnShadow = theme.btnShadow || "0 10px 22px rgba(0,0,0,0.12)";
    theme.btnWeight = theme.btnWeight || "900";
    theme.btnLetterSpacing = theme.btnLetterSpacing || "0.03em";
    theme.inputRadius = theme.inputRadius || theme.radius;
    theme.inputHeight = theme.inputHeight || "44px";
    theme.inputBg = theme.inputBg || "#fff";

    return theme;
  }

  // ---------------------------
  // API: fetch & parse rates
  // ---------------------------
  async function fetchBmfRateCard(cityCode) {
    const url = BMF_RATE_API + encodeURIComponent(cityCode || "");
    const res = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`BMF Rate API failed: ${res.status}`);
    return await res.json();
  }

  // Find the node for a currency anywhere in the JSON
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

  // Extract buy/sell-ish fields from the currency node (defensive mapping)
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
      toNum(node.rates?.buy) ??
      toNum(node.rates?.BUY);

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
      toNum(node.rates?.sell) ??
      toNum(node.rates?.SELL);

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

  // ---------------------------
  // RENDER
  // ---------------------------
  function renderOne(el) {
    const product = el.getAttribute("data-product") || DEFAULTS.product;
    const city_code = el.getAttribute("data-city-code") || DEFAULTS.city_code;
    const currency = el.getAttribute("data-currency") || DEFAULTS.currency;
    const amount = el.getAttribute("data-amount") || DEFAULTS.amount;

    const sniffed = sniffTheme();

    // Allow overrides via data-theme-*
    const theme = {
      ...sniffed,
      themePrimary: el.getAttribute("data-theme-primary") || sniffed.themePrimary,
      themeText: el.getAttribute("data-theme-text") || sniffed.themeText,
      themeMuted: el.getAttribute("data-theme-muted") || sniffed.themeMuted,
      themeBorder: el.getAttribute("data-theme-border") || sniffed.themeBorder,
      themeBg: el.getAttribute("data-theme-bg") || sniffed.themeBg,
    };

    const uid = `bmfqo_${Math.random().toString(16).slice(2)}`;

    el.innerHTML = `
      <style>
        #${uid}.bmfqo {
          font-family: ${esc(theme.fontFamily || "inherit")};
          color: ${esc(theme.themeText)};
          max-width: 820px;
        }
        #${uid} .bmfqo-card {
          background: ${esc(theme.themeBg)};
          border: 1px solid ${esc(theme.themeBorder)};
          border-radius: ${esc(theme.radius)};
          overflow: hidden;
          box-shadow: ${esc(theme.shadow)};
        }
        #${uid} .bmfqo-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: rgba(227, 27, 35, 0.06);
          border-bottom: 1px solid ${esc(theme.themeBorder)};
        }
        #${uid} .bmfqo-title {
          font-weight: 900;
          font-size: 14px;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }
        #${uid} .bmfqo-sub {
          font-size: 12px;
          color: ${esc(theme.themeMuted)};
          margin-top: 2px;
        }
        #${uid} .bmfqo-pill {
          font-size: 12px;
          font-weight: 800;
          color: ${esc(theme.themePrimary)};
          background: rgba(227, 27, 35, 0.10);
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid rgba(227, 27, 35, 0.18);
          white-space: nowrap;
        }

        #${uid} .bmfqo-body { padding: 16px; }

        #${uid} .bmfqo-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }
        @media (max-width: 860px) { #${uid} .bmfqo-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 520px) { #${uid} .bmfqo-grid { grid-template-columns: 1fr; } }

        #${uid} .bmfqo-field label {
          display: block;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.02em;
          color: ${esc(theme.themeMuted)};
          margin-bottom: 6px;
          text-transform: uppercase;
        }

        #${uid} .bmfqo-control {
          width: 100%;
          height: ${esc(theme.inputHeight)};
          border: 1px solid ${esc(theme.themeBorder)};
          border-radius: ${esc(theme.inputRadius)};
          padding: 0 12px;
          font-size: 14px;
          outline: none;
          background: ${esc(theme.inputBg)};
          color: ${esc(theme.themeText)};
        }
        #${uid} select.bmfqo-control { cursor: pointer; }

        #${uid} .bmfqo-control:focus {
          border-color: ${esc(theme.themePrimary)};
          box-shadow: 0 0 0 3px rgba(227, 27, 35, 0.14);
        }

        #${uid} .bmfqo-row {
          display: flex;
          gap: 12px;
          align-items: center;
          margin-top: 14px;
          flex-wrap: wrap;
        }

        #${uid} .bmfqo-ratebox {
          flex: 1;
          min-width: 280px;
          border: 1px solid ${esc(theme.themeBorder)};
          border-radius: ${esc(theme.radius)};
          padding: 12px 14px;
          background: rgba(17,24,39,0.02);
        }
        #${uid} .bmfqo-ratebox .line1 {
          font-size: 12px;
          color: ${esc(theme.themeMuted)};
          margin-bottom: 6px;
          display: flex;
          justify-content: space-between;
          gap: 10px;
        }
        #${uid} .bmfqo-ratebox .line2 {
          font-size: 15px;
          font-weight: 900;
        }
        #${uid} .bmfqo-ratebox .line3 {
          margin-top: 8px;
          font-size: 12px;
          color: ${esc(theme.themeMuted)};
          line-height: 1.35;
        }

        #${uid} .bmfqo-btn {
          height: ${esc(theme.inputHeight)};
          padding: 0 18px;
          border: 0;
          border-radius: ${esc(theme.inputRadius)};
          background: ${esc(theme.themePrimary)};
          color: ${esc(theme.btnText || "#fff")};
          font-weight: ${esc(theme.btnWeight)};
          letter-spacing: ${esc(theme.btnLetterSpacing)};
          cursor: pointer;
          text-transform: uppercase;
          box-shadow: ${esc(theme.btnShadow)};
        }
        #${uid} .bmfqo-btn:disabled { opacity: 0.55; cursor: not-allowed; box-shadow: none; }

        #${uid} .bmfqo-note {
          margin-top: 10px;
          font-size: 12px;
          color: ${esc(theme.themeMuted)};
          line-height: 1.35;
        }

        #${uid} .bmfqo-error {
          margin-top: 10px;
          font-size: 12px;
          color: ${esc(theme.themePrimary)};
          font-weight: 900;
          display: none;
        }
      </style>

      <div id="${uid}" class="bmfqo">
        <div class="bmfqo-card">
          <div class="bmfqo-head">
            <div>
              <div class="bmfqo-title">Book an Order</div>
              <div class="bmfqo-sub">City-based rates • then continue to checkout</div>
            </div>
            <div class="bmfqo-pill" data-role="status">Live rates</div>
          </div>

          <div class="bmfqo-body">
            <div class="bmfqo-grid">
              <div class="bmfqo-field">
                <label>Product</label>
                <select class="bmfqo-control" data-role="product">
                  ${buildSelect(PRODUCTS, product)}
                </select>
              </div>

              <div class="bmfqo-field">
                <label>City</label>
                <select class="bmfqo-control" data-role="city">
                  ${buildCityOptions(city_code)}
                </select>
              </div>

              <div class="bmfqo-field">
                <label>Currency</label>
                <select class="bmfqo-control" data-role="currency">
                  ${buildSelect(CURRENCIES, currency)}
                </select>
              </div>

              <div class="bmfqo-field">
                <label>Amount</label>
                <input class="bmfqo-control" data-role="amount" inputmode="decimal" value="${esc(
                  prettifyAmount(amount)
                )}" />
              </div>
            </div>

            <div class="bmfqo-row">
              <div class="bmfqo-ratebox">
                <div class="line1">
                  <span>
                    Buy: <b>₹ <span data-role="buy">—</span></b>
                    &nbsp;&nbsp;|&nbsp;&nbsp;
                    Sell: <b>₹ <span data-role="sell">—</span></b>
                  </span>
                  <span data-role="updated"></span>
                </div>

                <div class="line2">
                  Total Amount: ₹ <span data-role="inr">—</span>
                </div>

                <div class="line3">
                  Delivery: <span data-role="tat">—</span>
                </div>
              </div>

              <button class="bmfqo-btn" data-role="cta" disabled>Book this order</button>
            </div>

            <div class="bmfqo-note">
              Note: Final payable can vary by product, denomination availability, and serviceability.
            </div>

            <div class="bmfqo-error" data-role="error"></div>
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
      const { num } = normalizeAmountInput($amount.value);
      return num;
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
        const json = await fetchBmfRateCard(cityCode);
        const node = findCurrencyNode(json, ccy);
        const { buy, sell } = pickBuySell(node);
        const tat = extractTat(json) || fallbackTatText();

        const useRate = buy != null ? buy : sell;

        if (useRate == null) {
          $buy.textContent = "—";
          $sell.textContent = "—";
          $inr.textContent = "—";
          $tat.textContent = tat;
          $updated.textContent = `Updated ${nowTimeStr()}`;
          showError("Rates received but could not map currency fields (schema changed).");
          return;
        }

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
        showError("Unable to fetch live rates right now. Please try again.");
      } finally {
        isLoading = false;
      }
    }

    // Debounce typing + format amount on blur
    let t = null;
    function debounceRecompute() {
      if (t) clearTimeout(t);
      t = setTimeout(recompute, 350);
    }

    $currency.addEventListener("change", recompute);
    $city.addEventListener("change", recompute);
    $product.addEventListener("change", recompute);

    $amount.addEventListener("input", debounceRecompute);
    $amount.addEventListener("blur", () => {
      $amount.value = prettifyAmount($amount.value);
      recompute();
    });

    $cta.addEventListener("click", () => {
      const productVal = $product.value;
      const cityVal = $city.value;
      const ccyVal = $currency.value;
      const amtVal = getAmountNumber();

      // Redirect (update to your exact funnel URL later if needed)
      const url =
        "https://www.bookmyforex.com/?" +
        new URLSearchParams({
          bmf_product: productVal,
          bmf_city_code: cityVal,
          bmf_ccy: ccyVal,
          bmf_amt: amtVal != null ? String(amtVal) : "",
        }).toString();

      window.location.href = url;
    });

    // Initial compute
    recompute();
  }

  function init() {
    document.querySelectorAll('[data-bmf-widget="quick-order"]').forEach(renderOne);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
