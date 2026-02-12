(function () {
  function render(el) {
    const product = el.getAttribute("data-product") || "forex_card";
    const currency = el.getAttribute("data-currency") || "USD";
    const amount = el.getAttribute("data-amount") || "1000";
    const cta = el.getAttribute("data-cta") || "Book now";

    el.innerHTML = `
      <div style="border:1px solid #ddd;border-radius:12px;padding:16px;max-width:520px">
        <div style="font-weight:600;margin-bottom:8px">Quick Order</div>
        <div style="margin-bottom:12px;font-size:14px;line-height:1.4">
          <div><b>Product:</b> ${product}</div>
          <div><b>Currency:</b> ${currency}</div>
          <div><b>Amount:</b> ${amount}</div>
        </div>
        <button style="padding:10px 14px;border-radius:10px;border:0;cursor:pointer">
          ${cta}
        </button>
      </div>
    `;

    el.querySelector("button").addEventListener("click", () => {
      // Replace with real funnel URL later
      const url =
        "https://www.bookmyforex.com/?" +
        new URLSearchParams({
          bmf_product: product,
          bmf_ccy: currency,
          bmf_amt: amount,
        }).toString();

      window.location.href = url;
    });
  }

  document
    .querySelectorAll('[data-bmf-widget="quick-order"]')
    .forEach(render);
})();
