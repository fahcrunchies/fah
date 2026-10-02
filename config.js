/* FAH configuration + Supabase client */
const FAH_SUPABASE_URL = window.FAH_SUPABASE_URL || "https://liriobketiuikyvbejba.supabase.co";
const FAH_SUPABASE_PUBLISHABLE_KEY = window.FAH_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_ncAryAxZZ7TsLT2KlGIk0g_qYSDYvJB";

const fahSupabase = (window.supabase && FAH_SUPABASE_URL.startsWith("http") && !FAH_SUPABASE_PUBLISHABLE_KEY.startsWith("PASTE_"))
  ? window.supabase.createClient(FAH_SUPABASE_URL, FAH_SUPABASE_PUBLISHABLE_KEY)
  : null;

const FAH_DEFAULTS = {
  product_name: "FAH Crunchies",
  flavour: "Desi Masala",
  selling_price: 69,
  product_cost: 25,
  max_qty: 20,
  tax_enabled: true,
  tax_mode: "CGST_SGST",
  cgst: 2.5,
  sgst: 2.5,
  igst: 0,
  upi_id: "sumanthkumar1202-4@okhdfcbank",
  receiver_name: "Sumanth Bodicharla",
  upi_url: "upi://pay?pa=sumanthkumar1202-4@okhdfcbank&pn=Sumanth+Bodicharla&cu=INR",
  qr_image_url: "",
  instagram_url: "https://www.instagram.com/fah_findallhappiness",
  feedback_url: "", // Set this in Admin Settings; the customer can also use the Feedback QR on the back of the pack
  campaign_headline: "Want another pack of happiness? 👀",
  campaign_message: "Follow FAH on Instagram, fill in our feedback form, and promote FAH Crunchies in your own creative way on social media. Tag @fah_findallhappiness, then show us your feedback submission and social-media post to claim another pack FREE, subject to verification.",
  reward_message: "Follow FAH, fill in the feedback form, and promote FAH Crunchies in your own creative way on social media. Tag @fah_findallhappiness and show us your feedback submission and post to claim another pack FREE, subject to verification.",
  thank_you_message: "Thanks for choosing FAH! ❤️ You didn't just buy a snack — you became part of our journey. Your feedback helps us make FAH better. Your support helps a small brand grow. Now go enjoy your Crunchies! 😋 Find All Happiness. One Crunch at a Time. ❤️"
};

function fahRound2(n){ return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }
function fahRupee(n){
  const x = fahRound2(n);
  return "₹" + x.toLocaleString("en-IN", {minimumFractionDigits: x % 1 ? 2 : 0, maximumFractionDigits: 2});
}
function fahCalc(qty, cfg){
  const subtotal = fahRound2(Number(qty) * Number(cfg.selling_price || 0));
  let cgst = 0, sgst = 0, igst = 0;
  if (cfg.tax_enabled) {
    if (cfg.tax_mode === "IGST") igst = fahRound2(subtotal * Number(cfg.igst || 0) / 100);
    else {
      cgst = fahRound2(subtotal * Number(cfg.cgst || 0) / 100);
      sgst = fahRound2(subtotal * Number(cfg.sgst || 0) / 100);
    }
  }
  return {qty:Number(qty), unit_price:Number(cfg.selling_price||0), subtotal, cgst, sgst, igst, total:fahRound2(subtotal+cgst+sgst+igst)};
}
function fahBuildUpiLink(cfg){
  // Use the exact UPI URL entered/saved by the admin. Do not rebuild, encode,
  // or modify the URL on the customer side.
  return String(cfg.upi_url || "").trim();
}

async function fahGetSettings(){
  if (!fahSupabase) return {...FAH_DEFAULTS};
  const {data, error} = await fahSupabase.from("fah_settings").select("*").eq("id", 1).maybeSingle();
  if (error || !data) return {...FAH_DEFAULTS};
  return {...FAH_DEFAULTS, ...data};
}
async function fahSaveSettings(settings){
  if (!fahSupabase) throw new Error("Supabase is not configured.");
  const payload = {...settings, id:1, updated_at:new Date().toISOString()};
  const {data,error} = await fahSupabase.from("fah_settings").upsert(payload, {onConflict:"id"}).select().single();
  if(error) throw error;
  return {...FAH_DEFAULTS,...data};
}

window.FAH = {
  supabase:fahSupabase,
  DEFAULTS:FAH_DEFAULTS,
  getSettings:fahGetSettings,
  saveSettings:fahSaveSettings,
  calc:fahCalc,
  rupee:fahRupee,
  buildUpiLink:fahBuildUpiLink
};
