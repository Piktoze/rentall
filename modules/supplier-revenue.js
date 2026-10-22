// V104 — remove demo economics from canonical supplier dashboard
function renderLiveRevenueV104(){
 const bars=document.getElementById('v104RevenueBars');if(!bars)return;
 const rows=typeof supplierFinanceRowsV95==='function'?supplierFinanceRowsV95():[];
 const listings=typeof supplierOwnedListings==='function'?supplierOwnedListings():[];
 const byId=new Map(listings.map(l=>[String(l.id),l]));
 const categories=new Map();
 rows.forEach(r=>{
   const listing=byId.get(String(r.booking.listingId));
   const category=listing?.category||'Other';
   const cur=categories.get(category)||{gross:0,fee:0,net:0};
   cur.gross+=r.gross;cur.fee+=r.fee;cur.net+=r.net;categories.set(category,cur);
 });
 const sorted=[...categories.entries()].sort((x,y)=>y[1].gross-x[1].gross);
 const max=Math.max(1,...sorted.map(([,v])=>v.gross));
 bars.innerHTML=sorted.length?sorted.map(([name,v])=>`<div class="revenue-row"><div><span>${escapeHtml(name)}</span><b>${money(v.gross)}</b></div><div class="bar"><i style="width:${Math.max(4,Math.round(v.gross/max*100))}%"></i></div></div>`).join(''):'<div class="v104-empty-revenue">No eligible booking revenue yet.</div>';
 const gross=rows.reduce((s,r)=>s+r.gross,0),fees=rows.reduce((s,r)=>s+r.fee,0),net=rows.reduce((s,r)=>s+r.net,0);
 const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};
 set('v104Gross',money(gross));set('v104Fees',money(fees));set('v104Net',money(net));
}
const v104RenderBookings=renderBookings;
renderBookings=async function(){await v104RenderBookings();renderLiveRevenueV104()};
document.addEventListener('DOMContentLoaded',()=>{
 // Legacy demo inventory is retained only as old-source compatibility; canonical inventory is V94 live workspace.
 const legacy=document.getElementById('inventoryGrid');if(legacy){const section=legacy.closest('.dashboard-panel');if(section)section.hidden=true}
 renderLiveRevenueV104();
});
