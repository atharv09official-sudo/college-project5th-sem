import"./modulepreload-polyfill-B5Qt9EMX.js";/* empty css                 *//* empty css               */import{S as x,U as p}from"./smooth-toast-2nWdVltP.js";window.SmoothToast=x;function y(e){return e>=7?"text-red-400":e>=4?"text-yellow-400":"text-emerald-400"}function w(e){return e>=7?"bg-red-400":e>=4?"bg-yellow-400":"bg-emerald-400"}function $(e){return"$".repeat(e)}function k(e,s,l){const a=y(e.risk_score),r=w(e.risk_score),t=s?"border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.15)]":"border-white/5 hover:border-white/10",i=s?"bg-emerald-900/10":"";let c="";e.feasibility==="Limited"&&(c=`
                    <div class="mt-3 p-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex gap-2 items-start">
                        <span>⚠️</span>
                        <div>
                            <span class="font-bold">Limited Feasibility:</span> ${e.feasibility_reason}
                        </div>
                    </div>
                `);let d="",v="",g="bg-white/5 hover:bg-white/10 text-gray-300",n="Select this Route";return s&&(d=`
                    <div class="absolute -top-3 right-4 px-3 py-1 bg-emerald-600 text-white text-[10px] uppercase font-bold tracking-wider rounded-full shadow-lg border border-emerald-400">
                        AI Recommended
                    </div>
                `,v=`
                    <div class="mb-4 text-xs text-emerald-300 font-medium bg-emerald-500/10 p-2 rounded border border-emerald-500/20">
                        ✨ ${l}
                    </div>
                `,g="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/50"),`
                <div class="glass-panel rounded-xl p-6 border ${t} relative transition-all duration-300 ${i}">
                    ${d}
                    
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <h3 class="text-lg font-bold text-white">${e.name}</h3>
                            <p class="text-xs text-gray-400">${e.details}</p>
                        </div>
                        <div class="text-right">
                             <div class="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Risk Score</div>
                             <div class="text-2xl font-bold ${a}">${e.risk_score}</div>
                        </div>
                    </div>

                    ${v}

                    <!-- Risk Bar -->
                    <div class="w-full bg-gray-800 rounded-full h-1.5 mb-6 overflow-hidden">
                        <div class="${r} h-full rounded-full" style="width: ${e.risk_score*10}%"></div>
                    </div>

                    <!-- Stats Grid -->
                    <div class="grid grid-cols-2 gap-4 mb-6 text-sm">
                        <div class="p-3 rounded-lg bg-black/20 border border-white/5">
                            <div class="text-gray-500 text-xs mb-1">Transit Time</div>
                            <div class="text-white font-mono font-medium">${e.transit_time} Days</div>
                        </div>
                        <div class="p-3 rounded-lg bg-black/20 border border-white/5">
                            <div class="text-gray-500 text-xs mb-1">Cost Index</div>
                            <div class="text-white font-mono font-medium tracking-widest text-xs" title="$${e.cost_usd}">${$(e.cost_index)}</div>
                        </div>
                        <div class="p-3 rounded-lg bg-black/20 border border-white/5">
                            <div class="text-gray-500 text-xs mb-1">Primary Risk</div>
                            <div class="text-white font-medium truncate" title="${e.primary_risk}">${e.primary_risk}</div>
                        </div>
                        <div class="p-3 rounded-lg bg-black/20 border border-white/5">
                            <div class="text-gray-500 text-xs mb-1">Reliability</div>
                            <div class="${e.reliability.includes("High")?"text-emerald-400":"text-yellow-400"} font-medium">${e.reliability}</div>
                        </div>
                    </div>

                    ${c}

                    <div class="mt-4 pt-4 border-t border-white/5">
                        <button onclick="selectRoute('${e.id}')" class="w-full py-2.5 rounded-lg text-sm font-medium transition ${g}">
                            ${n}
                        </button>
                    </div>
                </div>
            `}async function f(e,s,l){const a=document.getElementById(e);if(!a)return;const r=a.querySelector("button"),t=a.querySelector("div.absolute"),i=t.querySelector("input"),c=t.querySelector(".options-list"),d=r.querySelector(".selected-text"),v=a.querySelector('input[type="hidden"]');let g=s||[];r.addEventListener("click",o=>{o.stopPropagation(),document.querySelectorAll('[id$="-dropdown"] div.absolute').forEach(m=>{m!==t&&m.classList.add("hidden")}),t.classList.toggle("hidden"),t.classList.contains("hidden")||(i.value="",n(""),i.focus())});const n=(o="")=>{c.innerHTML="";const m=g.filter(u=>u.toLowerCase().includes(o.toLowerCase()));if(m.length===0){c.innerHTML='<div class="px-3 py-2 text-xs text-gray-500 text-center">No results found</div>';return}m.forEach(u=>{const b=document.createElement("div");b.className="px-3 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-white cursor-pointer rounded transition-colors flex items-center gap-2",b.innerHTML=`<span>${u}</span>`,b.addEventListener("click",()=>{d.textContent=u,d.classList.remove("text-gray-400"),d.classList.add("text-white"),v.value=u,t.classList.add("hidden")}),c.appendChild(b)})};i.addEventListener("input",o=>{n(o.target.value)}),i.addEventListener("click",o=>o.stopPropagation()),document.addEventListener("click",o=>{a.contains(o.target)||t.classList.add("hidden")})}async function L(){try{const s=await(await fetch("/api/countries")).json();if(!Array.isArray(s))return;s.sort(),f("origin-dropdown",s),f("dest-dropdown",s)}catch(e){console.error("Failed to load countries",e),x.error("Could not load country list.")}}async function h(){const e=document.getElementById("origin-country").value,s=document.getElementById("dest-country").value,l=document.getElementById("btn-compare"),a=l.innerHTML;l.innerHTML='<svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Analyzing...',l.disabled=!0;const r=document.getElementById("routes-container");r.innerHTML=`
                <div class="flex flex-col items-center justify-center h-64">
                    <div class="text-indigo-400 animate-pulse text-lg font-medium">Analyzing global logistics networks...</div>
                    <div class="text-gray-500 text-xs mt-2">Calculating risk, cost, and transit times</div>
                </div>
            `;try{const t=await fetch(`/api/route-options?from=${encodeURIComponent(e)}&to=${encodeURIComponent(s)}`);if(!t.ok)throw new Error("Failed to fetch route data");const i=await t.json();document.getElementById("origin-label").textContent=i.origin,document.getElementById("dest-label").textContent=i.destination;const c=document.getElementById("ai-suggestions-list");c.innerHTML=i.ai_suggestions.map(n=>`
                    <div class="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-200">
                        ${n}
                    </div>
                `).join("");const d={Sea:[],Air:[],Road:[]};i.routes.forEach(n=>{d[n.mode]&&d[n.mode].push(n)}),r.innerHTML="";const v={Sea:"🚢",Air:"✈️",Road:"🚚"};let g=!1;for(const[n,o]of Object.entries(d)){if(o.length===0)continue;g=!0;const m=`
                        <div class="animate-fade-in-up">
                            <div class="flex items-center gap-2 mb-4 px-1">
                                <span class="text-xl">${v[n]}</span>
                                <h2 class="text-lg font-bold text-white uppercase tracking-wide">${n} Routes</h2>
                                <div class="h-px bg-white/10 flex-grow ml-4"></div>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                ${o.map(u=>k(u,u.id===i.recommendation.id,i.recommendation.reasoning)).join("")}
                            </div>
                        </div>
                    `;r.innerHTML+=m}g||(r.innerHTML=`
                        <div class="text-center py-12 text-gray-400">
                            No viable routes found between these locations.
                        </div>
                    `),x.success("Analysis complete")}catch(t){console.error(t),r.innerHTML=`
                    <div class="text-center py-12 text-red-400">
                        Failed to load comparison data. Please try again.
                    </div>
                `,x.error("Analysis failed")}finally{l.innerHTML=a,l.disabled=!1}}window.selectRoute=function(e){console.log("Selected route:",e),x.success("Route selected! Redirecting to planner...")};document.addEventListener("DOMContentLoaded",()=>{p.initProfileMenu(),p.initSession(),p.initTheme(),L(),document.getElementById("btn-compare").addEventListener("click",h),h()});
