import"./modulepreload-polyfill-B5Qt9EMX.js";/* empty css                 *//* empty css               */import{S as u}from"./smooth-toast-2nWdVltP.js";import"./app-Btji-69o.js";import"./map-fast-BOPcN3hr.js";let w=[],b=[];async function f(o,e,n){const s=document.getElementById(o);if(!s)return;const t=s.querySelector("button"),r=s.querySelector("div.absolute"),c=r.querySelector("input"),p=r.querySelector(".options-list"),x=t.querySelector(".selected-text"),L=s.querySelector('input[type="hidden"]');let k=e||[];t.addEventListener("click",i=>{i.stopPropagation(),document.querySelectorAll('[id$="-dropdown"] div.absolute').forEach(a=>{a!==r&&a.classList.add("hidden")}),r.classList.toggle("hidden"),r.classList.contains("hidden")||(c.value="",m(""),c.focus())});const m=(i="")=>{p.innerHTML="";const a=k.filter(d=>d.toLowerCase().includes(i.toLowerCase()));if(a.length===0){p.innerHTML='<div class="px-3 py-2 text-xs text-gray-500 text-center">No results found</div>';return}a.forEach(d=>{const l=document.createElement("div");l.className="px-3 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-white cursor-pointer rounded transition-colors flex items-center gap-2",l.innerHTML=`<span>${d}</span>`,l.addEventListener("click",()=>{x.textContent=d,x.classList.remove("text-gray-400"),x.classList.add("text-white"),L.value=d,r.classList.add("hidden"),n&&n(d)}),p.appendChild(l)})};c.addEventListener("input",i=>{m(i.target.value)}),c.addEventListener("click",i=>i.stopPropagation()),document.addEventListener("click",i=>{s.contains(i.target)||r.classList.add("hidden")})}async function M(){try{const e=await(await fetch("/api/countries")).json();if(!Array.isArray(e))return;e.sort();const n=()=>{$()};f("origin-dropdown",e,n),f("dest-dropdown",e,n)}catch(o){console.error("Failed to load countries",o),u.error("Could not load country list.")}}function $(){const o=document.getElementById("origin-country").value,e=document.getElementById("dest-country").value;let n=w;o&&(n=n.filter(t=>t.from===o)),e&&(n=n.filter(t=>t.to===e)),v("active-routes-body",n,"active");let s=b;o&&(s=s.filter(t=>t.from===o)),e&&(s=s.filter(t=>t.to===e)),v("historical-routes-body",s,"historical")}function g(o){const e={Stable:"bg-emerald-500/15 text-emerald-400 border-emerald-500/20",Monitor:"bg-yellow-500/15 text-yellow-400 border-yellow-500/20","Review Recommended":"bg-orange-500/15 text-orange-400 border-orange-500/20","Action Required":"bg-red-500/15 text-red-400 border-red-500/20",Archived:"bg-gray-500/15 text-gray-400 border-gray-500/20"};return`<span class="px-2 py-0.5 rounded text-[10px] border ${e[o]||e.Monitor}">${o}</span>`}function y(o){if(!o||o===0)return"";const e=o>0?"text-red-400":"text-emerald-400",n=o>0?"↑":"↓";return`<span class="text-xs font-medium ${e} ml-1">${n} ${Math.abs(o).toFixed(1)}</span>`}function R(o){if(!o)return"Unknown";const e=new Date(o),s=Math.round((new Date-e)/(1e3*60*60));return s<1?"Just now":s<24?`${s} hours ago`:e.toLocaleDateString()}async function h(o){try{const e=await fetch(`/api/routes?type=${o}`);if(!e.ok)throw new Error("Failed to fetch routes");return await e.json()}catch(e){return console.error(e),[]}}async function E(){w=await h("active"),b=await h("historical"),$()}function v(o,e,n){const s=document.getElementById(o);if(e.length===0){s.innerHTML=`<tr><td colspan="6" class="py-8 text-center text-gray-600">No ${n} routes found matching filters.</td></tr>`;return}n==="active"?s.innerHTML=e.map(t=>`
                    <tr class="hover:bg-white/5 transition group">
                        <td class="px-6 py-4 font-medium text-white">
                            <div class="flex items-center gap-2">
                                <span>${t.from} <span class="text-gray-600">➝</span> ${t.to}</span>
                            </div>
                        </td>
                        <td class="px-6 py-4">
                            <span class="capitalize px-2 py-1 rounded bg-white/5 text-xs border border-white/10">
                                ${t.mode==="Sea"?"🚢":t.mode==="Air"?"✈️":"🚛"} ${t.mode}
                            </span>
                        </td>
                        <td class="px-6 py-4">
                            ${g(t.status)}
                        </td>
                        <td class="px-6 py-4">
                            <div class="flex items-center">
                                <span class="font-bold text-white text-lg">${t.risk_score.toFixed(1)}</span>
                                ${y(t.risk_delta)}
                            </div>
                        </td>
                        <td class="px-6 py-4 text-xs text-gray-400">
                            ${t.owner||"Unassigned"}
                        </td>
                        <td class="px-6 py-4 text-right">
                            <button onclick="viewRoute('${t.id}')" class="text-indigo-400 hover:text-white text-xs font-bold uppercase tracking-wider mr-3">View</button>
                            <button onclick="openEditModal('${t.id}', '${t.status}', '${t.notes||""}')" class="text-gray-500 hover:text-white text-xs font-bold uppercase tracking-wider">Edit</button>
                        </td>
                    </tr>
                `).join(""):s.innerHTML=e.map(t=>`
                    <tr class="hover:bg-white/5 transition">
                        <td class="px-6 py-4 font-medium text-white text-xs text-gray-400">${t.id}</td>
                        <td class="px-6 py-4">
                            <div class="flex flex-col">
                                <span class="text-white font-medium">${t.from} ➝ ${t.to}</span>
                                <span class="text-gray-500 text-xs">${t.mode} Route</span>
                            </div>
                        </td>
                        <td class="px-6 py-4">
                             <div class="flex items-center">
                                <span class="font-bold text-gray-300">${t.risk_score.toFixed(1)}</span>
                                ${y(t.risk_delta)}
                            </div>
                        </td>
                        <td class="px-6 py-4">
                            ${g(t.status)}
                        </td>
                        <td class="px-6 py-4 text-xs">${R(t.last_updated)}</td>
                        <td class="px-6 py-4 text-right">
                            <button onclick="viewRoute('${t.id}')" class="text-indigo-400 hover:text-indigo-300 mr-3 text-sm">View</button>
                             <button onclick="openEditModal('${t.id}', '${t.status}', '${t.notes||""}')" class="text-gray-500 hover:text-white text-sm">Edit</button>
                        </td>
                    </tr>
                `).join("")}window.viewRoute=function(o){window.location.href=`/intelligence?route_id=${o}`};window.openEditModal=function(o,e,n){document.getElementById("edit-route-id").value=o,document.getElementById("edit-status").value=e,document.getElementById("edit-notes").value=n,document.getElementById("edit-modal").classList.remove("hidden")};window.closeEditModal=function(){document.getElementById("edit-modal").classList.add("hidden")};window.saveRouteChanges=async function(){const o=document.getElementById("edit-route-id").value,e=document.getElementById("edit-status").value,n=document.getElementById("edit-notes").value;try{(await fetch(`/api/routes/${o}`,{method:"PUT",body:JSON.stringify({status:e,notes:n}),headers:{"Content-Type":"application/json"}})).ok?(closeEditModal(),u.success("Route updated successfully"),E()):u.error("Failed to save changes")}catch(s){console.error(s),u.error("Error saving changes")}};document.addEventListener("DOMContentLoaded",()=>{M(),E()});
