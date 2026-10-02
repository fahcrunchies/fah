let allRows = [];
let currentCfg = null;

const $ = id => document.getElementById(id);
const rupee = n => FAH.rupee(n);

async function requireAdmin(){
  if(!FAH.supabase){ location.replace("admin-login.html"); return null; }
  const {data:{session}} = await FAH.supabase.auth.getSession();
  if(!session){ location.replace("admin-login.html"); return null; }
  return session;
}

function fillSettings(cfg){
  const f=$("settings-form");
  for(const [k,v] of Object.entries(cfg)){
    const el=f.elements[k];
    if(!el) continue;
    el.value = v;
  }
}

function readSettings(){
  const f=$("settings-form");
  return {
    product_name:f.elements.product_name.value.trim(),
    flavour:f.elements.flavour.value.trim(),
    selling_price:Number(f.elements.selling_price.value)||0,
    product_cost:Number(f.elements.product_cost.value)||0,
    max_qty:Math.max(1,parseInt(f.elements.max_qty.value,10)||1),
    upi_id:f.elements.upi_id.value.trim(),
    receiver_name:f.elements.receiver_name.value.trim(),
    upi_url:f.elements.upi_url.value.trim(),
    qr_image_url:f.elements.qr_image_url.value.trim(),
    instagram_url:f.elements.instagram_url.value.trim(),
    feedback_url:f.elements.feedback_url.value.trim(),
    cgst:Number(f.elements.cgst.value)||0,
    sgst:Number(f.elements.sgst.value)||0,
    igst:Number(f.elements.igst.value)||0,
    tax_enabled:f.elements.tax_enabled.value==="true",
    tax_mode:f.elements.tax_mode.value,
    campaign_headline:f.elements.campaign_headline.value.trim(),
    campaign_message:f.elements.campaign_message.value.trim(),
    reward_message:f.elements.reward_message.value.trim(),
    thank_you_message:f.elements.thank_you_message.value.trim()
  };
}

function duplicateIds(rows){
  const map=new Map();
  for(const r of rows){
    const key=[String(r.mobile||"").trim(),Number(r.total||0).toFixed(2),new Date(r.payment_time||r.created_at).toISOString().slice(0,10)].join("|");
    if(!map.has(key)) map.set(key,[]);
    map.get(key).push(r.id);
  }
  const dup=new Set();
  for(const ids of map.values()) if(ids.length>1) ids.forEach(id=>dup.add(id));
  return dup;
}

function statCards(rows){
  const packs=rows.reduce((s,r)=>s+Number(r.quantity||0),0);
  const revenue=rows.reduce((s,r)=>s+Number(r.total||0),0);
  const feedback=rows.filter(r=>r.feedback_completed).length;
  const insta=rows.filter(r=>r.instagram_followed).length;
  const creative=rows.filter(r=>r.creative_post_intent).length;
  const submitted=rows.filter(r=>["Submitted","Verified","Reward Given"].includes(r.creative_post_status)).length;
  const reward=rows.filter(r=>["Given","Approved"].includes(r.reward_status)).length;
  const dup=duplicateIds(rows).size;
  $("stats").innerHTML=[
    ["Customers",rows.length],["Packs",packs],["Reported Revenue",rupee(revenue)],
    ["Feedback",feedback],["Instagram",insta],["Social Promotion Claimed",creative],
    ["Social Promotion Submitted",submitted],["Rewards",reward],["Possible Duplicates",dup]
  ].map(([a,b])=>`<div class="admin-stat"><span>${a}</span><b>${b}</b></div>`).join("");
}

function pill(text,kind=""){
  return `<span class="admin-pill ${kind}">${text}</span>`;
}

function renderCharts(rows){
  const byDay={};
  for(const r of rows){
    const d=new Date(r.created_at).toISOString().slice(0,10);
    byDay[d] ??= {customers:0,revenue:0};
    byDay[d].customers++;
    byDay[d].revenue+=Number(r.total||0);
  }
  const days=Object.keys(byDay).sort().slice(-14);
  const maxC=Math.max(1,...days.map(d=>byDay[d].customers));
  const maxR=Math.max(1,...days.map(d=>byDay[d].revenue));
  $("customers-chart").innerHTML=days.length?days.map(d=>{
    const h=Math.max(4,byDay[d].customers/maxC*160);
    return `<div class="bar-item" style="height:${h}px" title="${d}: ${byDay[d].customers}"><span>${byDay[d].customers}</span></div>`;
  }).join(""):`<p class="note">No data yet.</p>`;
  $("revenue-chart").innerHTML=days.length?days.map(d=>{
    const h=Math.max(4,byDay[d].revenue/maxR*160);
    return `<div class="bar-item" style="height:${h}px" title="${d}: ${rupee(byDay[d].revenue)}"></div>`;
  }).join(""):`<p class="note">No data yet.</p>`;
}

function renderRows(){
  const q=$("search").value.trim().toLowerCase();
  const filter=$("filter").value;
  const dups=duplicateIds(allRows);
  let rows=allRows.filter(r=>{
    const matchesSearch=!q || [r.id,r.name,r.mobile].some(v=>String(v||"").toLowerCase().includes(q));
    if(!matchesSearch) return false;
    if(filter==="paid") return r.payment_status==="Customer Reported Paid" || r.payment_status==="Verified Paid";
    if(filter==="feedback") return !!r.feedback_completed;
    if(filter==="instagram") return !!r.instagram_followed;
    if(filter==="creative") return !!r.creative_post_intent;
    if(filter==="submitted") return ["Submitted","Verified","Reward Given"].includes(r.creative_post_status);
    if(filter==="reward") return ["Given","Approved"].includes(r.reward_status);
    if(filter==="duplicate") return dups.has(r.id);
    return true;
  });
  $("count").textContent=`Showing ${rows.length} of ${allRows.length} records`;
  $("orders-body").innerHTML=rows.map(r=>{
    const gst=Number(r.cgst||0)+Number(r.sgst||0)+Number(r.igst||0);
    const creative=r.creative_post_status||"Not Started";
    const proof=r.creative_post_proof ? `<a href="${r.creative_post_proof}" target="_blank" rel="noopener">View</a>`:"-";
    return `<tr class="${dups.has(r.id)?"duplicate":""}">
      <td>${r.id}</td>
      <td>${new Date(r.created_at).toLocaleString()}</td>
      <td>${escapeHtml(r.name)}</td>
      <td>${escapeHtml(r.mobile)}</td>
      <td>${r.quantity}</td>
      <td>${rupee(r.product_price)}</td>
      <td>${rupee(r.subtotal)}</td>
      <td>${rupee(r.cgst)}</td>
      <td>${rupee(r.sgst)}</td>
      <td>${rupee(gst)}</td>
      <td><b>${rupee(r.total)}</b></td>
      <td>${r.payment_time?new Date(r.payment_time).toLocaleString():"-"}</td>
      <td>${pill(r.payment_status||"-",r.payment_status==="Verified Paid"?"good":"warn")}</td>
      <td>${escapeHtml(r.upi_receiver||"-")}</td>
      <td>${r.feedback_completed?pill("Yes","good"):pill("No")}</td>
      <td>${r.instagram_followed?pill("Yes","good"):pill("No")}</td>
      <td>${pill(creative,creative==="Verified"||creative==="Reward Given"?"good":creative==="Rejected"?"bad":"warn")}</td>
      <td>${proof}</td>
      <td>${dups.has(r.id)?pill("Possible duplicate","dup"):"-"}</td>
      <td>${pill(r.reward_status||"Not Requested",r.reward_status==="Given"?"good":"")}</td>
      <td><button class="btn small" data-edit="${r.id}">Edit</button></td>
    </tr>`;
  }).join("");
  document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openEdit(b.dataset.edit));
}

function escapeHtml(s){
  return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

async function loadRows(){
  const {data,error}=await FAH.supabase.from("customer_orders").select("*").order("created_at",{ascending:false});
  if(error){ $("count").textContent=error.message; return; }
  allRows=data||[];
  statCards(allRows); renderRows(); renderCharts(allRows);
}

async function openEdit(id){
  const r=allRows.find(x=>String(x.id)===String(id)); if(!r) return;
  $("edit-id").value=r.id;
  $("edit-payment").value=r.payment_status||"Customer Reported Paid";
  $("edit-creative").value=r.creative_post_status||"Not Started";
  $("edit-reward").value=r.reward_status||"Not Requested";
  $("edit-notes").value=r.admin_notes||"";
  $("edit-status").textContent="";
  $("edit-modal").hidden=false;
}

$("close-modal").onclick=()=>$("edit-modal").hidden=true;
$("save-record").onclick=async()=>{
  const id=$("edit-id").value;
  const patch={
    payment_status:$("edit-payment").value,
    creative_post_status:$("edit-creative").value,
    reward_status:$("edit-reward").value,
    admin_notes:$("edit-notes").value.trim()
  };
  const {error}=await FAH.supabase.from("customer_orders").update(patch).eq("id",id);
  if(error){$("edit-status").textContent=error.message;return;}
  $("edit-modal").hidden=true;
  await loadRows();
};

$("settings-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const status=$("settings-status");
  try{
    const file=$("qr-file")?.files?.[0];
    if(file){
      if(!FAH.supabase) throw new Error("Supabase is not configured.");
      const ext=(file.name.split(".").pop()||"png").toLowerCase().replace(/[^a-z0-9]/g,"") || "png";
      const path=`qr/${crypto.randomUUID()}.${ext}`;
      const {error:uploadError}=await FAH.supabase.storage.from("fah-payment-qr").upload(path,file,{upsert:false,contentType:file.type||"image/png"});
      if(uploadError) throw new Error("QR upload failed: "+uploadError.message+" — make sure the fah-payment-qr bucket and storage policies are configured.");
      const {data:urlData}=FAH.supabase.storage.from("fah-payment-qr").getPublicUrl(path);
      $("settings-form").elements.qr_image_url.value=urlData.publicUrl;
    }
    currentCfg=await FAH.saveSettings(readSettings());
    status.hidden=false; status.textContent="Settings saved.";
    setTimeout(()=>status.hidden=true,2500);
  }catch(err){status.hidden=false;status.textContent=err.message;status.classList.remove("ok");status.classList.add("error");}
});

$("search").addEventListener("input",renderRows);
$("filter").addEventListener("change",renderRows);

let csvExportCompleted=false;

$("export").onclick=()=>{
  const rows=allRows, dups=duplicateIds(rows);
  const cols=["id","created_at","name","mobile","quantity","product_name","flavour","product_price","product_cost","subtotal","cgst","sgst","igst","total","payment_time","payment_status","upi_receiver","feedback_completed","instagram_followed","creative_post_intent","creative_post_proof","creative_post_status","reward_status","duplicate_flag","admin_notes"];
  const lines=[cols.join(",")];
  for(const r of rows){
    const copy={...r,duplicate_flag:dups.has(r.id)};
    lines.push(cols.map(c=>`"${String(copy[c]??"").replace(/"/g,'""')}"`).join(","));
  }
  const blob=new Blob([lines.join("\r\n")],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=`fah-campaign-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  csvExportCompleted=true;
  $("delete-campaign").disabled=false;
  $("delete-status").hidden=false;
  $("delete-status").textContent="CSV downloaded. You can now delete the campaign data from Supabase.";
};

$("delete-campaign").onclick=async()=>{
  if(!csvExportCompleted) return;
  const ok=confirm("You have downloaded the CSV. Delete ALL customer and campaign records from the FAH database now? This cannot be undone from the Admin page.");
  if(!ok) return;
  const btn=$("delete-campaign");
  btn.disabled=true;
  btn.textContent="Deleting...";
  const {error}=await FAH.supabase.from("customer_orders").delete().not("id","is",null);
  if(error){
    btn.disabled=false;
    btn.textContent="Delete Campaign Data";
    $("delete-status").hidden=false;
    $("delete-status").textContent="Delete failed: "+error.message;
    return;
  }
  allRows=[];
  csvExportCompleted=false;
  statCards(allRows);
  renderRows();
  renderCharts(allRows);
  btn.textContent="Campaign Data Deleted";
  $("delete-status").hidden=false;
  $("delete-status").textContent="All customer/campaign records were deleted after the CSV export.";
};

$("logout").onclick=async()=>{
  await FAH.supabase.auth.signOut();
  location.replace("admin-login.html");
};

(async()=>{
  const session=await requireAdmin(); if(!session) return;
  currentCfg=await FAH.getSettings();
  fillSettings(currentCfg);
  await loadRows();
})();
