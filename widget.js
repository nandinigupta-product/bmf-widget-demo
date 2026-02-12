(function () {
  const DEFAULTS = {
    product: "forex_card", // forex_card | currency_notes
    city: "Delhi",
    currency: "USD",
    amount: "1000",
    themePrimary: "#e31b23", // close to BMF red vibe (override via data-theme-primary)
    themeText: "#111827",
    themeMuted: "#6b7280",
    themeBorder: "#e5e7eb",
    themeBg: "#ffffff",
  };

  const PRODUCTS = [
    { value: "forex_card", label: "Forex Card" },
    { value: "currency_notes", label: "Currency Notes" },
  ];

  // Starter list (expand anytime)
  const CITIES = [
    "Delhi",
    "Mumbai",
    "Bangalore",
    "Hyderabad",
    "Chennai",
    "Pune",
    "Kolkata",
    "Ahmedabad",
    "Gurgaon",
    "Noida",
    "Jaipur",
    "Lucknow",
    "Chandigarh",
    "Kochi",
    "Indore",
  ];

  // Common travel currencies (Frankfurter supports INR + USD etc.)
  const CURRENCIES = [
    "USD",
    "EUR",
    "GBP",
    "AED",
    "SAR",
    "CAD",
    "AUD",
    "SGD",
    "THB",
    "JPY",
    "CHF",
    "HKD",
  ];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => {
      const m = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
      return m[c] || c;
    });
  }

  function formatINR(n) {
    if (!isFinite(n)) return "—";
    // Indian number format (simple)
    return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  }

  async function fetchRate(fromCcy, toCcy) {
    // Frankfurter latest endpoint
    const url = `https://api.frankfurter.dev/latest?from=${encodeURIComponent(fromCcy)}&to=${encodeURIComponent(
      toCcy
    )}`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error(`Rate API failed: ${res.status}`);
    const data = await res.json();
    const rate = data?.rates?.[toCcy];
    if (!rate) throw new Error("Rate missing");
    return rate;
  }

  function buildSelect(options, value) {
    return options
      .map((o) => {
        const v = typeof o === "string" ? o : o.value;
        const l = typeof o === "string" ? o : o.label;
        const selected = v === value ? "selected" : "";
        return `<option value="${esc(v)}" ${selected}>${esc(l)}</option>`;
      })
      .join("");
  }

  function renderOne(el) {
    const product = el.getAttribute("data-product") || DEFAULTS.product;
    const city = el.getAttribute("data-city") || DEFAULTS.city;
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
        /* Scoped styles */
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
          font-weight: 700;
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
          font-weight: 700;
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
          font-weight: 700;
        }
        #${uid} .bmfqo-btn {
          height: 44px;
          padding: 0 16px;
          border: 0;
          border-radius: 12px;
          background: ${themePrimary};
          color: white;
          font-weight: 800;
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
          font-weight: 700;
          display: none;
        }
      </style>

      <div id="${uid}" class="bmfqo">
        <div class="bmfqo-card">
          <div class="bmfqo-title">Book An Order</div>

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
                ${buildSelect(CITIES, city)}
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
              <div class="line1">Rate = <span data-role="rate">—</span></div>
              <div class="line2">Total Amount: ₹ <span data-role="inr">—</span></div>
            </div>

            <button class="bmfqo-btn" data-role="cta" disabled>BOOK THIS ORDER</button>
          </div>

          <div class="bmfqo-note">
            Live rate shown via a public reference-rate API. Final payable may differ on BookMyForex based on product & city availability.
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
    const $inr = root.querySelector('[data-role="inr"]');
    const $cta = root.querySelector('[data-role="cta"]');
    const $error = root.querySelector('[data-role="error"]');

    let lastRate = null;
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

    async function recompute() {
      clearError();
      const amt = getAmountNumber();
      const from = $currency.value;

      if (!amt) {
        $rate.textContent = "—";
        $inr.textContent = "—";
        $cta.disabled = true;
        return;
      }

      // Avoid spamming API on every keypress if already fetching
      if (isLoading) return;

      isLoading = true;
      $cta.disabled = true;
      $rate.textContent = "Loading…";

      try {
        const r = await fetchRate(from, "INR");
        lastRate = r;

        $rate.textContent = `₹ ${r.toFixed(4)}`;
        $inr.textContent = formatINR(amt * r);
        $cta.disabled = false;
      } catch (e) {
        $rate.textContent = "—";
        $inr.textContent = "—";
        showError("Unable to fetch live rates right now. Please try again.");
      } finally {
        isLoading = false;
      }
    }

    // Simple debounce for amount typing
    let t = null;
    function debounceRecompute() {
      if (t) clearTimeout(t);
      t = setTimeout(recompute, 300);
    }

    $currency.addEventListener("change", recompute);
    $amount.addEventListener("input", debounceRecompute);

    // Product/city changes don’t affect public reference rate, but keep for UI + later wiring
    $product.addEventListener("change", () => {});
    $city.addEventListener("change", () => {});

    $cta.addEventListener("click", () => {
      const productVal = $product.value;
      const cityVal = $city.value;
      const ccyVal = $currency.value;
      const amtVal = getAmountNumber();

      // This just redirects to homepage with params for now (wire to real funnel later)
      const url =
        "https://www.bookmyforex.com/?" +
        new URLSearchParams({
          bmf_product: productVal,
          bmf_city: cityVal,
          bmf_ccy: ccyVal,
          bmf_amt: amtVal != null ? String(amtVal) : "",
        }).toString();

      window.location.href = url;
    });

    // initial compute
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
