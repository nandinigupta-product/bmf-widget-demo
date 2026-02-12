(function () {
  const DEFAULTS = {
    product: "forex_card", // forex_card | currency_notes
    city_code: "delhi",
    currency: "USD",
    amount: "1000",

    themePrimary: "#e31b23",
    themeText: "#111827",
    themeMuted: "#6b7280",
    themeBorder: "#e5e7eb",
    themeBg: "#ffffff",
  };

  const PRODUCTS = [
    { value: "forex_card", label: "Forex Card" },
    { value: "currency_notes", label: "Currency Notes" },
  ];

  // “Manual from website” starter set (expand later)
  // Source: BMF sitemap + nav pages show these city pages clearly.
  const CITIES = [
    { value: "delhi", label: "Delhi" },
    { value: "mumbai", label: "Mumbai" },
    { value: "bangalore", label: "Bangalore" },
    { value: "hyderabad", label: "Hyderabad" },
    { value: "chennai", label: "Chennai" },
    { value: "kolkata", label: "Kolkata" },
    { value: "pune", label: "Pune" },
    { value: "chandigarh", label: "Chandigarh" },
    { value: "jaipur", label: "Jaipur" },
    { value: "noida", label: "Noida" },
    { value: "gurgaon", label: "Gurgaon" },
    { value: "ahmedabad", label: "Ahmedabad" },
  ];

  // Keep as you had (expand anytime)
  const CURRENCIES = [
    "USD","EUR","GBP","AED","SAR","CAD","AUD","SGD","THB","JPY","CHF","HKD","NZD","SEK"
  ];

  // Rate API (you shared)
  const BMF_RATE_API =
    "https://www.bookmyforex.com/api/secure/v1/get-full-rate-card?city_code=";

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => {
      const m = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
      return m[c] || c;
    });
  }

  function formatINR(n) {
    if (!isFinite(n)) return "—";
    return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
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

  function toNumber(x) {
    const n = Number(String(x ?? "").replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : null;
  }

  // ---- Robust parsing helpers (because we don’t know exact JSON shape yet) ----

  function deepFindRatesObject(json) {
    // Try common containers
    const candidates = [
      json,
      json?.data,
      json?.result,
      json?.payload,
      json?.response,
    ].filter(Boolean);

    for (const c of candidates) {
      // If there is an array of currency rows somewhere
      if (Array.isArray(c?.rates)) return { kind: "array", data: c.rates };
      if (Array.isArray(c?.rate_card)) return { kind: "array", data: c.rate_card };
      if (Array.isArray(c?.rateCard)) return { kind: "array", data: c.rateCard };

      // Sometimes it’s keyed by currency code directly
      if (c?.rates && typeof c.rates === "object") return { kind: "map", data: c.rates };
      if (c?.rate_card && typeof c.rate_card === "object") return { kind: "map", data: c.rate_card };
      if (c?.rateCard && typeof c.rateCard === "object") return { kind: "map", data: c.rateCard };

      // Sometimes nested: currencies / currencyRates
      if (Array.isArray(c?.currencies)) return { kind: "array", data: c.currencies };
      if (Array.isArray(c?.currencyRates)) return { kind: "array", data: c.currencyRates };
    }
    return null;
  }

  function extractBuySellFromRow(row, ccy) {
    // Guess field names
    const code =
      row?.currency ||
      row?.currency_code ||
      row?.ccy ||
      row?.code ||
      row?.symbol;

    if (!code || String(code).toUpperCase() !== String(ccy).toUpperCase()) return null;

    // Buy/Sell fields can be named in many ways
    const buy =
      toNumber(row?.buy) ??
      toNumber(row?.buy_rate) ??
      toNumber(row?.buyRate) ??
      toNumber(row?.card_buy) ??
      toNumber(row?.cash_buy) ??
      toNumber(row?.buying_rate);

    const sell =
      toNumber(row?.sell) ??
      toNumber(row?.sell_rate) ??
      toNumber(row?.sellRate) ??
      toNumber(row?.card_sell) ??
      toNumber(row?.cash_sell) ??
      toNumber(row?.selling_rate);

    // Sometimes rate is inside nested object
    const nestedBuy =
      buy ??
      toNumber(row?.rates?.buy) ??
      toNumber(row?.rates?.BUY) ??
      toNumber(row?.rates?.buy_rate) ??
      toNumber(row?.card?.buy) ??
      toNumber(row?.cash?.buy);

    const nestedSell =
      sell ??
      toNumber(row?.rates?.sell) ??
      toNumber(row?.rates?.SELL) ??
      toNumber(row?.rates?.sell_rate) ??
      toNumber(row?.card?.sell) ??
      toNumber(row?.cash?.sell);

    if (nestedBuy == null && nestedSell == null) return null;
    return { buy: nestedBuy, sell: nestedSell };
  }

  function extractTat(json) {
    // If API returns explicit delivery SLA somewhere, pick it up.
    // Otherwise return null and we’ll fallback to rule-based copy.
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
      if (typeof c === "number" && Number.isFinite(c)) return `${c}`;
      if (c && typeof c === "object") {
        // If it’s an object, stringify a human-ish summary
        if (c?.text) return String(c.text);
        if (c?.message) return String(c.message);
      }
    }
    return null;
  }

  async function fetchBmfRateCard(cityCode) {
    const url = BMF_RATE_API + encodeURIComponent(cityCode || "");
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error(`BMF Rate API failed: ${res.status}`);
    return await res.json();
  }

  async function getBuySellRate({ cityCode, currency }) {
    const json = await fetchBmfRateCard(cityCode);

    const tat = extractTat(json);

    const ratesObj = deepFindRatesObject(json);
    if (!ratesObj) {
      return { buy: null, sell: null, tat, raw: json };
    }

    if (ratesObj.kind === "array") {
      for (const row of ratesObj.data) {
        const r = extractBuySellFromRow(row, currency);
        if (r) return { ...r, tat, raw: json };
      }
      return { buy: null, sell: null, tat, raw: json };
    }

    if (ratesObj.kind === "map") {
      // Try direct lookup by currency
      const key = String(currency).toUpperCase();
      const direct = ratesObj.data[key] || ratesObj.data[String(currency)] || null;

      if (direct) {
        // Direct object might already have buy/sell
        const buy =
          toNumber(direct?.buy) ??
          toNumber(direct?.buy_rate) ??
          toNumber(direct?.buyRate) ??
          toNumber(direct?.card_buy) ??
          toNumber(direct?.cash_buy);

        const sell =
          toNumber(direct?.sell) ??
          toNumber(direct?.sell_rate) ??
          toNumber(direct?.sellRate) ??
          toNumber(direct?.card_sell) ??
          toNumber(direct?.cash_sell);

        return { buy, sell, tat, raw: json };
      }

      // Otherwise scan map values
      for (const k of Object.keys(ratesObj.data)) {
        const r = extractBuySellFromRow(ratesObj.data[k], currency);
        if (r) return { ...r, tat, raw: json };
      }
      return { buy: null, sell: null, tat, raw: json };
    }

    return { buy: null, sell: null, tat, raw: json };
  }

  function renderOne(el) {
    const product = el.getAttribute("data-product") || DEFAULTS.product;
    const city_code = el.getAttribute("data-city-code") || DEFAULTS.city_code;
    const currency = el.getAttribute("data-currency") || DEFAULTS.currency;
    const amount = el.getAttribute("data-amount") || DEFAULTS.amount;

    const themePrimary = el.getAttribute("data-theme-primary") || DEFAULTS.themePrimary;
    const themeText = el.getAttribute("data-theme-text") || DEFAULTS.themeText;
    const themeMuted = el.getAttribute("data-theme-muted") || DEFAULTS.themeMuted;
    const themeBorder = el.getAttribute("data-theme-border") || DEFAULTS.themeBorder;
    const themeBg = el.getAttribute("data-theme-bg") || DEFAULTS.themeBg;

    const uid = `bmfqo_${Math.random().toString(16).slice(2)}`;

    el.innerHTML = `
      <style>
        #${uid}.bmfqo {
          font-family: inherit;
          color: ${themeText};
          max-width: 760px;
        }
        #${uid} .bmfqo-card {
          background: ${themeBg};
          border: 1px solid ${themeBorder};
          border-radius: 16px;
          padding: 16px;
          box-shadow: 0 6px 22px rgba(17, 24, 39, 0.08);
        }
        #${uid} .bmfqo-title {
          font-weight: 800;
          font-size: 16px;
          margin-bottom: 12px;
        }
        #${uid} .bmfqo-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }
        @media (max-width: 860px) {
          #${uid} .bmfqo-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 520px) {
          #${uid} .bmfqo-grid { grid-template-columns: 1fr; }
        }
        #${uid} .bmfqo-field label {
          display: block;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          color: ${themeMuted};
          margin-bottom: 6px;
        }
        #${uid} .bmfqo-control {
          width: 100%;
          height: 44px;
          border: 1px solid ${themeBorder};
          border-radius: 12px;
          padding: 0 12px;
          font-size: 14px;
          outline: none;
          background: #fff;
        }
        #${uid} .bmfqo-control:focus {
          border-color: ${themePrimary};
          box-shadow: 0 0 0 3px rgba(227, 27, 35, 0.15);
        }
        #${uid} .bmfqo-row {
          display: flex;
          gap: 12px;
          align-items: center;
          margin-top: 12px;
          flex-wrap: wrap;
        }
        #${uid} .bmfqo-ratebox {
          flex: 1;
          min-width: 260px;
          border: 1px dashed ${themeBorder};
          border-radius: 12px;
          padding: 10px 12px;
          background: rgba(17,24,39,0.02);
        }
        #${uid} .bmfqo-ratebox .line1 {
          font-size: 13px;
          color: ${themeMuted};
          margin-bottom: 6px;
        }
        #${uid} .bmfqo-ratebox .line2 {
          font-size: 14px;
          font-weight: 800;
        }
        #${uid} .bmfqo-ratebox .line3 {
          margin-top: 6px;
          font-size: 12px;
          color: ${themeMuted};
        }
        #${uid} .bmfqo-btn {
          height: 44px;
          padding: 0 16px;
          border: 0;
          border-radius: 12px;
          background: ${themePrimary};
          color: white;
          font-weight: 900;
          letter-spacing: 0.03em;
          cursor: pointer;
          text-transform: uppercase;
        }
        #${uid} .bmfqo-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        #${uid} .bmfqo-note {
          margin-top: 10px;
          font-size: 12px;
          color: ${themeMuted};
        }
        #${uid} .bmfqo-error {
          margin-top: 10px;
          font-size: 12px;
          color: ${themePrimary};
          font-weight: 800;
          display: none;
        }
      </style>

      <div id="${uid}" class="bmfqo">
        <div class="bmfqo-card">
          <div class="bmfqo-title">Book an Order</div>

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
                ${buildSelect(CITIES, city_code)}
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
              <input class="bmfqo-control" data-role="amount" inputmode="decimal" value="${esc(amount)}" />
            </div>
          </div>

          <div class="bmfqo-row">
            <div class="bmfqo-ratebox">
              <div class="line1">
                Buy Rate = <span data-role="rate">—</span>
                <span style="margin-left:10px;">Sell Rate = <span data-role="sellrate">—</span></span>
              </div>
              <div class="line2">Estimated INR: ₹ <span data-role="inr">—</span></div>
              <div class="line3">Delivery: <span data-role="tat">—</span></div>
            </div>

            <button class="bmfqo-btn" data-role="cta" disabled>BOOK THIS ORDER</button>
          </div>

          <div class="bmfqo-note">
            Rates are fetched from BookMyForex’s rate-card API (city-based). Final payable may differ based on product, denomination availability, and serviceability.
          </div>

          <div class="bmfqo-error" data-role="error"></div>
        </div>
      </div>
    `;

    const root = el.querySelector(`#${uid}`);
    const $product = root.querySelector('[data-role="product"]');
    const $city = root.querySelector('[data-role="city"]');
    const $currency = root.querySelector('[data-role="currency"]');
    const $amount = root.querySelector('[data-role="amount"]');
    const $rate = root.querySelector('[data-role="rate"]');
    const $sellrate = root.querySelector('[data-role="sellrate"]');
    const $inr = root.querySelector('[data-role="inr"]');
    const $tat = root.querySelector('[data-role="tat"]');
    const $cta = root.querySelector('[data-role="cta"]');
    const $error = root.querySelector('[data-role="error"]');

    let isLoading = false;

    function showError(msg) {
      $error.style.display = "block";
      $error.textContent = msg;
    }
    function clearError() {
      $error.style.display = "none";
      $error.textContent = "";
    }

    function getAmountNumber() {
      const v = String($amount.value || "").replace(/,/g, "").trim();
      const n = Number(v);
      return isFinite(n) && n > 0 ? n : null;
    }

    function fallbackTatText() {
      // Based on BMF copy
      return "Same-day if processed before 1 PM; otherwise next working day.";
    }

    async function recompute() {
      clearError();
      const amt = getAmountNumber();
      if (!amt) {
        $rate.textContent = "—";
        $sellrate.textContent = "—";
        $inr.textContent = "—";
        $tat.textContent = "—";
        $cta.disabled = true;
        return;
      }

      if (isLoading) return;

      isLoading = true;
      $cta.disabled = true;
      $rate.textContent = "Loading…";
      $sellrate.textContent = "Loading…";
      $tat.textContent = "Loading…";

      try {
        const cityCode = $city.value;
        const ccy = $currency.value;

        const { buy, sell, tat } = await getBuySellRate({
          cityCode,
          currency: ccy,
        });

        if (buy == null && sell == null) {
          $rate.textContent = "—";
          $sellrate.textContent = "—";
          $inr.textContent = "—";
          $tat.textContent = tat || fallbackTatText();
          showError("Couldn’t read rates from the API response. (API format may have changed.)");
          return;
        }

        $rate.textContent = buy != null ? `₹ ${buy.toFixed(4)}` : "—";
        $sellrate.textContent = sell != null ? `₹ ${sell.toFixed(4)}` : "—";

        // For “estimated INR”, use BUY if available; else fall back to SELL
        const useRate = buy != null ? buy : sell;
        $inr.textContent = useRate != null ? formatINR(amt * useRate) : "—";

        $tat.textContent = tat || fallbackTatText();
        $cta.disabled = false;
      } catch (e) {
        $rate.textContent = "—";
        $sellrate.textContent = "—";
        $inr.textContent = "—";
        $tat.textContent = fallbackTatText();
        showError("Unable to fetch live rates right now. Please try again.");
      } finally {
        isLoading = false;
      }
    }

    let t = null;
    function debounceRecompute() {
      if (t) clearTimeout(t);
      t = setTimeout(recompute, 350);
    }

    $currency.addEventListener("change", recompute);
    $city.addEventListener("change", recompute);
    $amount.addEventListener("input", debounceRecompute);

    $product.addEventListener("change", () => {
      // If later you want different endpoints/logic for forex_card vs currency_notes,
      // you can branch here based on $product.value.
      recompute();
    });

    $cta.addEventListener("click", () => {
      const productVal = $product.value;
      const cityCode = $city.value;
      const ccyVal = $currency.value;
      const amtVal = getAmountNumber();

      const url =
        "https://www.bookmyforex.com/?" +
        new URLSearchParams({
          bmf_product: productVal,
          bmf_city_code: cityCode,
          bmf_ccy: ccyVal,
          bmf_amt: amtVal != null ? String(amtVal) : "",
        }).toString();

      window.location.href = url;
    });

    recompute();
  }

  function init() {
    document.querySelectorAll('[data-bmf-widget="quick-order"]').forEach(renderOne);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
