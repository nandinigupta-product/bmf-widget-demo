(function () {
  const DEFAULTS = {
    product: "forex_card",
    city: "Delhi",
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

  const CITIES = [
    "Delhi","Mumbai","Bangalore","Hyderabad","Chennai","Pune","Kolkata","Ahmedabad",
    "Gurgaon","Noida","Jaipur","Lucknow","Chandigarh","Kochi","Indore",
  ];

  const CURRENCIES = ["USD","EUR","GBP","AED","SAR","CAD","AUD","SGD","THB","JPY","CHF","HKD"];

  // Simple in-memory cache to reduce API calls
  const RATE_CACHE = new Map(); // key: "USD->INR" => { rate, ts }
  const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

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

  async function fetchRate(fromCcy, toCcy) {
    const key = `${fromCcy}->${toCcy}`;
    const cached = RATE_CACHE.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached;

    const url = `https://api.frankfurter.dev/latest?from=${encodeURIComponent(fromCcy)}&to=${encodeURIComponent(
      toCcy
    )}`;

    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error(`Rate API failed: ${res.status}`);
    const data = await res.json();
    const rate = data?.rates?.[toCcy];
    if (!rate) throw new Error("Rate missing");

    const out = { rate, ts: Date.now() };
    RATE_CACHE.set(key, out);
    return out;
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

  function normalizeAmountInput(raw) {
    // Allow digits + dot only
    const cleaned = String(raw || "").replace(/,/g, "").trim();
    // prevent weird inputs
    if (!cleaned) return { num: null, cleaned: "" };
    const num = Number(cleaned);
    if (!isFinite(num) || num <= 0) return { num: null, cleaned };
    return { num, cleaned };
  }

  function prettifyAmount(raw) {
    const { num } = normalizeAmountInput(raw);
    if (!num) return raw;
    // keep up to 2 decimals in display
    return num.toLocaleString("en-IN", { maximumFractionDigits: 2 });
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
        #${uid}.bmfqo {
          font-family: inherit;
          color: ${themeText};
          max-width: 820px;
        }
        #${uid} .bmfqo-card {
          background: ${themeBg};
          border: 1px solid ${themeBorder};
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 10px 28px rgba(17, 24, 39, 0.10);
        }
        #${uid} .bmfqo-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: rgba(227, 27, 35, 0.06);
          border-bottom: 1px solid ${themeBorder};
        }
        #${uid} .bmfqo-title {
          font-weight: 800;
          font-size: 14px;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }
        #${uid} .bmfqo-sub {
          font-size: 12px;
          color: ${themeMuted};
        }
        #${uid} .bmfqo-body { padding: 16px; }

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
          color: ${themeMuted};
          margin-bottom: 6px;
        }

        #${uid} .bmfqo-control {
          width: 100%;
          height: 46px;
          border: 1px solid ${themeBorder};
          border-radius: 12px;
          padding: 0 12px;
          font-size: 14px;
          outline: none;
          background: #fff;
        }
        #${uid} select.bmfqo-control { cursor: pointer; }

        #${uid} .bmfqo-control:focus {
          border-color: ${themePrimary};
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
          border: 1px solid ${themeBorder};
          border-radius: 14px;
          padding: 12px 14px;
          background: rgba(17,24,39,0.02);
        }
        #${uid} .bmfqo-ratebox .line1 {
          font-size: 12px;
          color: ${themeMuted};
          margin-bottom: 6px;
          display: flex;
          justify-content: space-between;
          gap: 10px;
        }
        #${uid} .bmfqo-ratebox .line2 {
          font-size: 15px;
          font-weight: 900;
        }

        #${uid} .bmfqo-btn {
          height: 46px;
          padding: 0 18px;
          border: 0;
          border-radius: 12px;
          background: ${themePrimary};
          color: white;
          font-weight: 900;
          letter-spacing: 0.03em;
          cursor: pointer;
          text-transform: uppercase;
          box-shadow: 0 10px 22px rgba(227, 27, 35, 0.22);
        }
        #${uid} .bmfqo-btn:disabled { opacity: 0.55; cursor: not-allowed; box-shadow: none; }

        #${uid} .bmfqo-note {
          margin-top: 10px;
          font-size: 12px;
          color: ${themeMuted};
          line-height: 1.35;
        }
        #${uid} .bmfqo-error {
          margin-top: 10px;
          font-size: 12px;
          color: ${themePrimary};
          font-weight: 800;
          display: none;
        }

        #${uid} .bmfqo-pill {
          font-size: 12px;
          font-weight: 800;
          color: ${themePrimary};
          background: rgba(227, 27, 35, 0.10);
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid rgba(227, 27, 35, 0.18);
          white-space: nowrap;
        }
      </style>

      <div id="${uid}" class="bmfqo">
        <div class="bmfqo-card">
          <div class="bmfqo-head">
            <div>
              <div class="bmfqo-title">Book an Order</div>
              <div class="bmfqo-sub">Instant estimate • then continue to checkout</div>
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
                <input class="bmfqo-control" data-role="amount" inputmode="decimal" value="${esc(
                  prettifyAmount(amount)
                )}" />
              </div>
            </div>

            <div class="bmfqo-row">
              <div class="bmfqo-ratebox">
                <div class="line1">
                  <span>Rate</span>
                  <span data-role="updated"></span>
                </div>
                <div class="line2">
                  1 <span data-role="ccy">USD</span> = ₹ <span data-role="rate">—</span>
                </div>
                <div class="bmfqo-note" style="margin-top:8px">
                  Total Amount: ₹ <b><span data-role="inr">—</span></b>
                </div>
              </div>

              <button class="bmfqo-btn" data-role="cta" disabled>Book this order</button>
            </div>

            <div class="bmfqo-note">
              This uses a public reference FX rate for an estimate. Final payable on BookMyForex can vary by product & city availability.
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
    const $rate = root.querySelector('[data-role="rate"]');
    const $inr = root.querySelector('[data-role="inr"]');
    const $cta = root.querySelector('[data-role="cta"]');
    const $error = root.querySelector('[data-role="error"]');
    const $updated = root.querySelector('[data-role="updated"]');
    const $ccy = root.querySelector('[data-role="ccy"]');
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
      const from = $currency.value;

      $ccy.textContent = from;

      if (!amt) {
        $rate.textContent = "—";
        $inr.textContent = "—";
        $updated.textContent = "";
        $cta.disabled = true;
        return;
      }

      if (isLoading) return;

      isLoading = true;
      $cta.disabled = true;
      $status.textContent = "Fetching…";
      $rate.textContent = "…";
      $updated.textContent = "";

      try {
        const { rate } = await fetchRate(from, "INR");
        $rate.textContent = formatRate(rate);
        $inr.textContent = formatINR(amt * rate);
        $updated.textContent = `Updated ${nowTimeStr()}`;
        $cta.disabled = false;
        $status.textContent = "Live rates";
      } catch (e) {
        $rate.textContent = "—";
        $inr.textContent = "—";
        $cta.disabled = true;
        showError("Unable to fetch live rates right now. Please try again.");
      } finally {
        isLoading = false;
      }
    }

    // Debounce typing + format on blur
    let t = null;
    function debounceRecompute() {
      if (t) clearTimeout(t);
      t = setTimeout(recompute, 300);
    }

    $currency.addEventListener("change", recompute);
    $amount.addEventListener("input", debounceRecompute);
    $amount.addEventListener("blur", () => {
      $amount.value = prettifyAmount($amount.value);
      recompute();
    });

    // Product/city changes don’t affect public reference rate (yet), but keep for redirect params
    $product.addEventListener("change", () => {});
    $city.addEventListener("change", () => {});

    $cta.addEventListener("click", () => {
      const productVal = $product.value;
      const cityVal = $city.value;
      const ccyVal = $currency.value;
      const amtVal = getAmountNumber();

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

    recompute();
  }

  function init() {
    document.querySelectorAll('[data-bmf-widget="quick-order"]').forEach(renderOne);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
