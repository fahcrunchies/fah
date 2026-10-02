let cfg = null;
let draft = {
  name:"",
  mobile:"",
  qty:1,
  calc:null,
  paymentTime:"",
  paymentUpiId:"",
  paymentUpiUrl:"",
  recordId:null
};

const $ = id => document.getElementById(id);
const show = id => $(id).hidden = false;
const hide = id => $(id).hidden = true;

function saveDraft(){
  localStorage.setItem("fah_customer_draft_v2", JSON.stringify(draft));
}
function loadDraft(){
  try { return {...draft, ...(JSON.parse(localStorage.getItem("fah_customer_draft_v2"))||{})}; }
  catch { return draft; }
}
function validMobile(v){ return /^[6-9]\d{9}$/.test(v); }

function renderConfig(){
  $("product-name").textContent = cfg.product_name;
  $("product-flavour").textContent = cfg.flavour;
  $("product-price").textContent = FAH.rupee(cfg.selling_price);
  $("summary-product").textContent = `${cfg.product_name} — ${cfg.flavour}`;
}

function renderSummary(){
  let qty = Math.max(1, Math.min(Number($("qty").value)||1, Number(cfg.max_qty)||20));
  $("qty").value = qty;
  draft.qty = qty;
  draft.calc = FAH.calc(qty, cfg);
  const c = draft.calc;
  $("summary-qty").textContent = c.qty;
  $("summary-price").textContent = FAH.rupee(c.unit_price);
  $("summary-subtotal").textContent = FAH.rupee(c.subtotal);
  $("summary-cgst").textContent = FAH.rupee(c.cgst);
  $("summary-sgst").textContent = FAH.rupee(c.sgst);
  $("summary-igst").textContent = FAH.rupee(c.igst);
  $("summary-total").textContent = FAH.rupee(c.total);
  $("row-cgst").hidden = !cfg.tax_enabled || cfg.tax_mode === "IGST";
  $("row-sgst").hidden = !cfg.tax_enabled || cfg.tax_mode === "IGST";
  $("row-igst").hidden = !cfg.tax_enabled || cfg.tax_mode !== "IGST";
  $("payment-total").textContent = FAH.rupee(c.total);
  $("modal-payment-total").textContent = FAH.rupee(c.total);
  $("modal-instruction-total").textContent = FAH.rupee(c.total);
  saveDraft();
}

function setupMenu(){
  const btn = document.querySelector(".menu-btn"), nav = $("menu");
  btn?.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(open));
  });
}

async function init(){
  cfg = await FAH.getSettings();
  renderConfig();
  draft = loadDraft();
  if (draft.name) $("customer-name").value = draft.name;
  if (draft.mobile) $("customer-mobile").value = draft.mobile;
  if (draft.qty) $("qty").value = draft.qty;
  renderSummary();
  setupMenu();
}
init();

$("details-continue").addEventListener("click", () => {
  const name = $("customer-name").value.trim();
  const mobile = $("customer-mobile").value.trim();
  if (!name) { $("details-error").textContent = "Please enter your name."; return; }
  if (!validMobile(mobile)) { $("details-error").textContent = "Please enter a valid 10-digit Indian mobile number."; return; }
  $("details-error").textContent = "";
  draft.name = name;
  draft.mobile = mobile;
  saveDraft();
  show("step-quantity");
  $("step-quantity").scrollIntoView({behavior:"smooth", block:"start"});
  renderSummary();
});

$("qty-minus").addEventListener("click", () => {
  $("qty").value = Math.max(1, Number($("qty").value || 1) - 1);
  renderSummary();
});
$("qty-plus").addEventListener("click", () => {
  $("qty").value = Math.min(Number(cfg.max_qty)||20, Number($("qty").value || 1) + 1);
  renderSummary();
});
$("qty").addEventListener("input", renderSummary);

function getUpiIdFromPaymentUrl(paymentUrl) {
  const fallback = String(cfg?.upi_id || "").trim();
  const raw = String(paymentUrl || "").trim();
  if (!raw) return fallback;
  try {
    const parsed = new URL(raw);
    return String(parsed.searchParams.get("pa") || fallback).trim();
  } catch {
    const match = raw.match(/[?&]pa=([^&]+)/i);
    return match ? decodeURIComponent(match[1]) : fallback;
  }
}

function buildDynamicQrUpiUrl(total) {
  const base = String(cfg?.upi_url || "").trim();
  const fallbackId = String(cfg?.upi_id || "").trim();
  const fallbackName = String(cfg?.receiver_name || "").trim();

  let query = "";
  const qIndex = base.indexOf("?");
  if (qIndex >= 0) query = base.slice(qIndex + 1);

  const params = new URLSearchParams(query);
  if (!params.get("pa") && fallbackId) params.set("pa", fallbackId);
  if (!params.get("pn") && fallbackName) params.set("pn", fallbackName);
  params.set("am", Number(total).toFixed(2));
  params.set("cu", "INR");

  return `upi://pay?${params.toString()}`;
}

function makeBrandedQrDataUrl(upiUrl, amount) {
  return new Promise((resolve, reject) => {
    if (!window.QRCode) {
      reject(new Error("QR generator library did not load."));
      return;
    }

    // Generate the QR itself separately from the final downloadable image.
    // This lets us add a real white "quiet zone" around all four sides.
    const qrSize = 640;
    const quietZone = 96;
    const finalSize = qrSize + (quietZone * 2);

    const host = document.createElement("div");
    host.style.position = "fixed";
    host.style.left = "-10000px";
    host.style.top = "0";
    host.style.width = `${qrSize}px`;
    host.style.height = `${qrSize}px`;
    host.style.background = "#fff";
    host.setAttribute("aria-hidden", "true");
    document.body.appendChild(host);

    new QRCode(host, {
      text: upiUrl,
      width: qrSize,
      height: qrSize,
      // M keeps the QR less dense while the small center branding remains
      // covered by enough error correction for normal gallery scanning.
      correctLevel: QRCode.CorrectLevel.M
    });

    const finish = () => {
      const source = host.querySelector("canvas") || host.querySelector("img");
      if (!source) {
        host.remove();
        reject(new Error("QR image was not generated."));
        return;
      }

      const draw = (sourceImage) => {
        const canvas = document.createElement("canvas");
        canvas.width = finalSize;
        canvas.height = finalSize;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          host.remove();
          reject(new Error("Could not create QR canvas."));
          return;
        }

        // IMPORTANT:
        // Keep this entire outer area plain white. This is the QR quiet zone
        // required by scanners and is intentionally not a decorative border.
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, finalSize, finalSize);

        // Put the actual QR away from every edge.
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sourceImage, quietZone, quietZone, qrSize, qrSize);

        // Small center branding only. Do not make this box large because it
        // covers QR modules and can prevent gallery scanners from decoding.
        const centerX = quietZone + (qrSize / 2);
        const centerY = quietZone + (qrSize / 2);
        const boxW = 108;
        const boxH = 70;
        const radius = 10;

        ctx.fillStyle = "#fff";
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(
            centerX - boxW / 2,
            centerY - boxH / 2,
            boxW,
            boxH,
            radius
          );
        } else {
          ctx.rect(
            centerX - boxW / 2,
            centerY - boxH / 2,
            boxW,
            boxH
          );
        }
        ctx.fill();

        ctx.fillStyle = "#000";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.font = "900 34px Arial, sans-serif";
        ctx.fillText("FAH", centerX, centerY - 12);

        ctx.font = "900 21px Arial, sans-serif";
        ctx.fillText(
          `₹${Number(amount).toLocaleString("en-IN", {
            minimumFractionDigits: Number(amount) % 1 ? 2 : 0,
            maximumFractionDigits: 2
          })}`,
          centerX,
          centerY + 19
        );

        host.remove();
        resolve(canvas.toDataURL("image/png"));
      };

      if (source instanceof HTMLCanvasElement) {
        draw(source);
      } else {
        const image = new Image();
        image.onload = () => draw(image);
        image.onerror = () => {
          host.remove();
          reject(new Error("QR image could not be loaded."));
        };
        image.src = source.src;
      }
    };

    // qrcodejs renders asynchronously in some browsers.
    setTimeout(finish, 80);
  });
}


async function prepareDynamicPaymentQR(total) {
  const qr = $("payment-qr");
  const qrPreviewBox = $("qr-preview-box");
  const qrUnavailable = $("qr-unavailable");
  const qrDownload = $("download-payment-qr");

  qr.removeAttribute("src");
  qrPreviewBox.hidden = true;
  qrUnavailable.hidden = true;
  qrDownload.hidden = true;
  qrDownload.disabled = false;
  window.fahGeneratedPaymentQR = "";

  try {
    const upiUrl = buildDynamicQrUpiUrl(total);
    const dataUrl = await makeBrandedQrDataUrl(upiUrl, total);
    window.fahGeneratedPaymentQR = dataUrl;
    qr.src = dataUrl;
    qr.hidden = false;
    qrPreviewBox.hidden = false;
    qrDownload.hidden = false;
  } catch (err) {
    console.error("Dynamic QR generation error:", err);
    qr.hidden = true;
    qrUnavailable.hidden = false;
  }
}

$("review-payment").addEventListener("click", async () => {
  const qty = Number($("qty").value);
  if (!Number.isInteger(qty) || qty < 1 || qty > Number(cfg.max_qty)) {
    $("qty-error").textContent = `Please choose a quantity between 1 and ${cfg.max_qty}.`;
    return;
  }
  $("qty-error").textContent = "";
  renderSummary();
  const link = FAH.buildUpiLink(cfg);

  // Snapshot the exact receiver UPI ID used by this checkout/payment link.
  // This is saved with the campaign record later, so historical data keeps
  // the UPI ID that was actually used even if Admin changes it in the future.
  draft.paymentUpiId = getUpiIdFromPaymentUrl(link);
  draft.paymentUpiUrl = link;
  saveDraft();

  // Option 2 is now a dynamic QR generated from the exact checkout total.
  await prepareDynamicPaymentQR(draft.calc.total);

  // Require the customer to choose a payment method before continuing.
  const paymentDoneBtn = $("after-payment");
  paymentDoneBtn.disabled = true;
  paymentDoneBtn.setAttribute("aria-disabled", "true");

  show("step-payment");
  $("step-payment").scrollIntoView({behavior:"smooth", block:"start"});
});

function activatePaymentCompletedButton() {
  const btn = $("after-payment");
  btn.disabled = false;
  btn.removeAttribute("aria-disabled");
}


async function downloadPaymentQR() {
  const dataUrl = String(window.fahGeneratedPaymentQR || "").trim();
  if (!dataUrl) return;

  const qrDownload = $("download-payment-qr");
  const originalText = qrDownload.textContent;
  qrDownload.disabled = true;
  qrDownload.textContent = "Preparing clear QR...";

  try {
    const amount = Number(draft.calc?.total || 0);
    const safeAmount = amount.toFixed(2).replace(".", "-");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `FAH-payment-QR-Rs-${safeAmount}.png`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();

    // Only unlock this after the generated QR download has been triggered.
    activatePaymentCompletedButton();
    qrDownload.textContent = "Clear QR Downloaded ✓";
    setTimeout(() => { qrDownload.textContent = originalText; }, 2200);
  } catch (err) {
    console.error("QR download error:", err);
    qrDownload.textContent = "Download failed — please try again";
    setTimeout(() => { qrDownload.textContent = originalText; }, 2500);
  } finally {
    qrDownload.disabled = false;
  }
}

$("download-payment-qr").addEventListener("click", downloadPaymentQR);

$("after-payment").addEventListener("click", () => {
  $("payment-modal").hidden = true;
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset()*60000).toISOString().slice(0,16);
  $("payment-time").value = local;
  show("step-payment-time");
  $("step-payment-time").scrollIntoView({behavior:"smooth", block:"start"});
});
$("open-payment-modal").addEventListener("click", () => {
  $("payment-modal").hidden = false;
});
$("close-payment-modal").addEventListener("click", () => {
  $("payment-modal").hidden = true;
});
$("payment-modal").addEventListener("click", e => {
  if (e.target === $("payment-modal")) $("payment-modal").hidden = true;
});

$("submit-payment").addEventListener("click", async () => {
  const t = $("payment-time").value;
  if (!t) { $("payment-time-error").textContent = "Please enter the approximate payment time."; return; }
  if (!draft.name || !draft.mobile || !draft.calc) {
    $("payment-time-error").textContent = "Your checkout session is incomplete. Please restart the purchase flow.";
    return;
  }
  $("payment-time-error").textContent = "";
  $("submit-payment").disabled = true;
  $("submit-payment").textContent = "Saving...";

  const c = draft.calc;
  const recordId = window.crypto.randomUUID();
  const payload = {
    id: recordId,
    name: draft.name,
    mobile: draft.mobile,
    quantity: c.qty,
    product_name: cfg.product_name,
    flavour: cfg.flavour,
    product_price: c.unit_price,
    product_cost: Number(cfg.product_cost||0),
    subtotal: c.subtotal,
    cgst: c.cgst,
    sgst: c.sgst,
    igst: c.igst,
    total: c.total,
    payment_time: new Date(t).toISOString(),
    payment_status: "Customer Reported Paid",
    upi_receiver: String(draft.paymentUpiId || getUpiIdFromPaymentUrl(draft.paymentUpiUrl || FAH.buildUpiLink(cfg)) || cfg.upi_id || "").trim(),
    feedback_completed: false,
    instagram_followed: false,
    creative_post_intent: false,
    creative_post_proof: "",
    creative_post_status: "Not Started",
    reward_status: "Not Requested",
    duplicate_flag: false
  };

  if (!FAH.supabase) {
    $("payment-time-error").textContent = "Supabase is not configured yet. Add your project URL and publishable key in config.js.";
    $("submit-payment").disabled = false;
    $("submit-payment").textContent = "Payment Completed";
    return;
  }

  // Do not call .select() here. Anonymous customers are intentionally NOT allowed
  // to read customer_orders, and .select() would require a SELECT RLS policy.
  // The record id is generated client-side so we already know it after insert.
  const {error} = await FAH.supabase.from("customer_orders").insert(payload);
  if (error) {
    $("payment-time-error").textContent = error.message || "Could not save your submission. Please try again.";
    $("submit-payment").disabled = false;
    $("submit-payment").textContent = "Payment Completed";
    return;
  }

  draft.recordId = recordId;
  draft.paymentTime = t;
  saveDraft();

  $("thank-you-copy").textContent = cfg.thank_you_message;
  $("campaign-headline").textContent = cfg.campaign_headline;
  $("campaign-message").textContent = cfg.campaign_message;
  $("feedback-btn").href = cfg.feedback_url || "#";
  $("instagram-btn").href = cfg.instagram_url || "#";
  $("feedback-btn").style.display = cfg.feedback_url ? "" : "none";
  $("instagram-btn").style.display = cfg.instagram_url ? "" : "none";

  hide("step-details"); hide("step-quantity"); hide("step-payment"); hide("step-payment-time");
  show("step-success");
  $("step-success").scrollIntoView({behavior:"smooth", block:"start"});
  localStorage.removeItem("fah_customer_draft_v2");
});

document.querySelectorAll("[data-campaign]").forEach(btn => {
  btn.addEventListener("click", async () => {
    if (!draft.recordId || !FAH.supabase) return;
    const type = btn.dataset.campaign;
    const patch = type === "creative"
      ? {feedback_completed:true, instagram_followed:true, creative_post_intent:true, creative_post_status:"Pending", reward_status:"Requested"}
      : {feedback_completed:false, instagram_followed:false, creative_post_intent:false, creative_post_status:"Not Started", reward_status:"Not Requested"};

    const {error} = await FAH.supabase.from("customer_orders").update(patch).eq("id", draft.recordId);
    if (error) {
      $("campaign-status").hidden = false;
      $("campaign-status").textContent = "We couldn't save that choice. Please try again.";
      return;
    }

    $("campaign-status").hidden = false;
    $("campaign-status").textContent = type === "creative"
      ? "Amazing! ❤️ Your feedback, FAH follow and social-media promotion are recorded. Please show our team your feedback submission and post so we can verify your FREE pack. 🎁"
      : "No worries dude 😄 Come back when you're ready!";
  });
});

