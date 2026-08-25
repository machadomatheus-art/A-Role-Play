// js/views/character-sheet.js
// Ficha universal de personagem: configuração dinâmica, aprovação, bloqueio e layout.
import { auth, db } from "../firebase-config.js";
import { doc, getDoc, getDocs, collection, onSnapshot, setDoc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const S = { tableId:null, table:null, user:null, isMaster:false, config:null, layout:null, characters:new Map(), npcs:new Map(), members:[], selectedId:null, selectedNpcId:null, character:null, editing:false, saving:false, activeMasterNpcId:null };
const A = v => Array.isArray(v) ? v : [];
const O = v => v && typeof v === "object" && !Array.isArray(v) ? v : {};
const esc = v => String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const I = (name, size=15) => {
  const icons = {
    sword: { viewBox:"1 3 19 20", fill:"none", stroke:"currentColor", paths:`<path d="M14.5 4.5 19.5 9.5"/><path d="m13 6 5 5"/><path d="m4 20 6.5-6.5"/><path d="m8 21 1.5-3.5L5 14l-3 3 6 6Z"/><path d="m12 12 5-5"/>` },
    masks: { viewBox:"0 0 837.393 837.393", fill:"currentColor", stroke:"none", paths:`<path d="M587.189 42.891c-251.765 0-250.069 49.777-250.069 49.777v138.337c46.761-4.182 78.887-11.315 99.643-17.66 30.896-9.449 43.254-18.961 45.434-20.792 4.639-5.68 11.164-8.57 18.082-8.57 2.881 0 5.816.493 8.723 1.499 10.033 3.473 16.145 13.631 16.145 24.238v199.995c19.525-9.69 40.525-14.617 63.166-14.689 6.012.287 12.48.682 21.482 1.856 8.049 1.553 15.299 3.007 22.793 5.636 14.734 5.142 29.074 12.438 41.898 22.846 23.062 18.236 43.092 46.461 47.125 79.766.664 5.482-3.572 8.666-8.912 7.26-25.621-6.744-45.219-8.074-64.453-9.537l-30.977-1.365-31.209-.475c-17.832.188-39.225.295-59.973 1.65-.312.018-.637.053-.941.072-.09 55.205-12.475 107.135-34.154 152.363 29.631 14.457 62.125 22.469 96.242 22.469 138.158 0 250.158-130.961 250.158-292.441V92.667c0 0 1.545-49.776-250.211-49.776Zm165.674 271.518c-30.062 23.151-73.361 20.952-100.91-6.596-27.547-27.548-29.746-70.846-6.596-100.909 3.369-4.376 9.762-4.34 13.666-.434l94.271 94.272c3.909 3.905 3.944 10.298-.431 13.667Z"/><path d="M500.262 209.719S454.701 259.505 250.149 259.505C45.613 259.505 0 209.719 0 209.719V502.16c0 161.488 112.009 292.342 250.122 292.342 138.149 0 250.14-130.852 250.14-292.342V209.719Zm-421.036 263.185c-5.523 0-10.069-4.496-9.357-9.971 4.887-37.627 37.059-66.69 76.018-66.69s71.13 29.063 76.018 66.69c.711 5.477-3.834 9.971-9.357 9.971H79.226Zm305.238 98.908c-4.08 33.207-24.146 61.348-47.154 79.66-26.293 20.334-55.646 30.25-88.373 30.34-6.03-.279-12.438-.574-21.492-1.84-8.058-1.562-15.309-2.908-22.802-5.646-14.726-5.15-29.057-12.445-41.853-22.748-23.04-18.227-43.111-46.533-47.157-79.846-.666-5.482 3.567-8.666 8.908-7.258 25.631 6.76 45.273 8.143 64.515 9.518l30.968 1.365 31.165.494c17.822-.09 39.224-.189 60.024-1.652 19.242-1.391 38.85-2.783 64.364-9.605 5.403-1.444 9.627 1.72 8.953 7.198Zm36.571-98.908H287.714c-5.522 0-10.068-4.496-9.356-9.971 4.888-37.627 37.059-66.69 76.018-66.69s71.13 29.063 76.019 66.69c.711 5.477-3.834 9.971-9.357 9.971Z"/>` },
    skull: { viewBox:"2.5 2.5 27 27", fill:"currentColor", stroke:"none", paths:`<path d="M6.5 3C5.671875 3 5 3.671875 5 4.5c0 .234375.0625.460938.15625.65625C4.960938 5.0625 4.734375 5 4.5 5 3.671875 5 3 5.671875 3 6.5S3.671875 8 4.5 8c.570313 0 1.058594-.3125 1.3125-.78125l2.71875 2.75C7.828125 11.007813 7.335938 12.214844 7.125 13.5 6.796875 15.492188 7.183594 17.371094 8 19v1c0 .710938.265625 1.359375.6875 1.875l-2.875 2.875C5.554688 24.296875 5.058594 24 4.5 24 3.671875 24 3 24.671875 3 25.5S3.671875 27 4.5 27c.234375 0 .460938-.0625.65625-.15625C5.058594 27.039063 5 27.265625 5 27.5 5 28.328125 5.671875 29 6.5 29S8 28.328125 8 27.5c0-.558594-.296875-1.054687-.75-1.3125l3.25-3.25c.164063.0275.328125.0625.5.0625 0 1.644531 1.355469 3 3 3h4c1.644531 0 3-1.355469 3-3 .171875 0 .335937-.035437.5-.0625l3.25 3.25c-.453125.257813-.75.753906-.75 1.3125 0 .828125.671875 1.5 1.5 1.5s1.5-.671875 1.5-1.5c0-.234375-.058594-.460937-.15625-.65625.195313.09375.421875.15625.65625.15625.828125 0 1.5-.671875 1.5-1.5s-.671875-1.5-1.5-1.5c-.558594 0-1.054687.296875-1.3125.75l-2.875-2.875C23.734375 21.359375 24 20.710938 24 20v-.96875C24.617188 17.8125 25 16.457031 25 15c0-1.863281-.582031-3.59375-1.5625-5.03125l2.75-2.75C26.441406 7.6875 26.929688 8 27.5 8 28.328125 8 29 7.328125 29 6.5S28.328125 5 27.5 5c-.234375 0-.460937.0625-.65625.15625C26.9375 4.960938 27 4.734375 27 4.5 27 3.671875 26.328125 3 25.5 3S24 3.671875 24 4.5c0 .570313.3125 1.058594.78125 1.3125l-2.65625 2.625C20.5 6.921875 18.320313 5.988281 15.9375 6c-.332031 0-.660156.023438-.9995.0625-2.941406.222656-3.723 1.0625-5.094 2.34375L7.21875 5.8125C7.6875 5.558594 8 5.070313 8 4.5 8 3.671875 7.328125 3 6.5 3Z"/><path d="M15.96875 8C19.871094 7.976563 23 11.109375 23 15c0 1.230469-.316406 2.371094-.875 3.375L22 18.625V20c0 .566406-.433594 1-1 1h-2v2c0 .566406-.433594 1-1 1h-4c-.566406 0-1-.433594-1-1v-2h-2c-.566406 0-1-.433594-1-1v-1.375l-.125-.25c-.730469-1.320313-1.058594-2.882813-.78125-4.5625.492187-3.015625 3.054687-5.40625 6.09375-5.75.265625-.03125.519531-.0625.78125-.0625Z"/><path d="M13 15c-1.105469 0-2 .894531-2 2s.894531 2 2 2 2-.894531 2-2-.894531-2-2-2Zm6 0c-1.105469 0-2 .894531-2 2s.894531 2 2 2 2-.894531 2-2-.894531-2-2-2Z"/><path d="M15 20v2h2v-2z"/>` },
    npc: { viewBox:"0 0 837.393 837.393", fill:"currentColor", stroke:"none", paths:`<path d="M587.189 42.891c-251.765 0-250.069 49.777-250.069 49.777v138.337c46.761-4.182 78.887-11.315 99.643-17.66 30.896-9.449 43.254-18.961 45.434-20.792 4.639-5.68 11.164-8.57 18.082-8.57 2.881 0 5.816.493 8.723 1.499 10.033 3.473 16.145 13.631 16.145 24.238v199.995c19.525-9.69 40.525-14.617 63.166-14.689 6.012.287 12.48.682 21.482 1.856 8.049 1.553 15.299 3.007 22.793 5.636 14.734 5.142 29.074 12.438 41.898 22.846 23.062 18.236 43.092 46.461 47.125 79.766.664 5.482-3.572 8.666-8.912 7.26-25.621-6.744-45.219-8.074-64.453-9.537l-30.977-1.365-31.209-.475c-17.832.188-39.225.295-59.973 1.65-.312.018-.637.053-.941.072-.09 55.205-12.475 107.135-34.154 152.363 29.631 14.457 62.125 22.469 96.242 22.469 138.158 0 250.158-130.961 250.158-292.441V92.667c0 0 1.545-49.776-250.211-49.776Zm165.674 271.518c-30.062 23.151-73.361 20.952-100.91-6.596-27.547-27.548-29.746-70.846-6.596-100.909 3.369-4.376 9.762-4.34 13.666-.434l94.271 94.272c3.909 3.905 3.944 10.298-.431 13.667Z"/><path d="M500.262 209.719S454.701 259.505 250.149 259.505C45.613 259.505 0 209.719 0 209.719V502.16c0 161.488 112.009 292.342 250.122 292.342 138.149 0 250.14-130.852 250.14-292.342V209.719Zm-421.036 263.185c-5.523 0-10.069-4.496-9.357-9.971 4.887-37.627 37.059-66.69 76.018-66.69s71.13 29.063 76.018 66.69c.711 5.477-3.834 9.971-9.357 9.971H79.226Zm305.238 98.908c-4.08 33.207-24.146 61.348-47.154 79.66-26.293 20.334-55.646 30.25-88.373 30.34-6.03-.279-12.438-.574-21.492-1.84-8.058-1.562-15.309-2.908-22.802-5.646-14.726-5.15-29.057-12.445-41.853-22.748-23.04-18.227-43.111-46.533-47.157-79.846-.666-5.482 3.567-8.666 8.908-7.258 25.631 6.76 45.273 8.143 64.515 9.518l30.968 1.365 31.165.494c17.822-.09 39.224-.189 60.024-1.652 19.242-1.391 38.85-2.783 64.364-9.605 5.403-1.444 9.627 1.72 8.953 7.198Zm36.571-98.908H287.714c-5.522 0-10.068-4.496-9.356-9.971 4.888-37.627 37.059-66.69 76.018-66.69s71.13 29.063 76.019 66.69c.711 5.477-3.834 9.971-9.357 9.971Z"/>` },
    edit: { viewBox:"3 4 18 17", fill:"none", stroke:"currentColor", paths:`<path d="m4 20 4.2-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z"/><path d="m13.5 7.5 3 3"/>` },
    save: { viewBox:"0 0 24 24", fill:"none", stroke:"currentColor", paths:`<path d="M5 3h12l3 3v15H5z"/><path d="M8 3v6h8V3M9 21v-6h6v6"/>` },
    trash: { viewBox:"0 0 24 24", fill:"none", stroke:"currentColor", paths:`<path d="M4 7h16M10 11v6M14 11v6M9 7l1-3h4l1 3M6 7l1 14h10l1-14"/>` },
    gear: { viewBox:"0 0 24 24", fill:"none", stroke:"currentColor", paths:`<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.3 3h-4.6l-.3 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2l.3 2.6h4.6l.3-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z"/>` },
    check: { viewBox:"0 0 24 24", fill:"none", stroke:"currentColor", paths:`<path d="m5 12 4 4L19 6"/>` },
    stop: { viewBox:"0 0 24 24", fill:"none", stroke:"currentColor", paths:`<rect x="6" y="6" width="12" height="12" rx="2"/>` },
    undo: { viewBox:"0 0 24 24", fill:"none", stroke:"currentColor", paths:`<path d="M9 7 4 12l5 5"/><path d="M4 12h9a6 6 0 0 1 6 6"/>` },
    plus: { viewBox:"0 0 24 24", fill:"none", stroke:"currentColor", paths:`<path d="M12 5v14M5 12h14"/>` }
  };
  const icon=icons[name]||icons.check;
  const strokeAttrs=icon.stroke==='none' ? '' : `stroke="${icon.stroke}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"`;
  return `<svg class="cs-icon" width="${size}" height="${size}" viewBox="${icon.viewBox}" fill="${icon.fill}" ${strokeAttrs} aria-hidden="true">${icon.paths}</svg>`;
};
const uid = p => `${p}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
const code = x => String(x?.code||x?.key||x?.id||x?.name||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]/g,"").slice(0,3).toUpperCase();
const label = x => String(x?.name||x?.label||x?.title||"Sem nome");
function nav(p){ window.router?.navigate ? window.router.navigate(p) : (history.pushState({},"",p),dispatchEvent(new PopStateEvent("popstate"))); }
function toast(m,t="info"){ document.querySelector(".cs-toast")?.remove(); const e=document.createElement("div"); e.className=`cs-toast ${t}`; e.textContent=m; document.body.appendChild(e); requestAnimationFrame(()=>e.classList.add("show")); setTimeout(()=>e.remove(),2600); }

function layoutOf(raw){
  const defaults=[
    ["identity","Identidade",1], ["attributes","Atributos",2], ["resources","Recursos",2],
    ["skills","Perícias",1], ["abilities","Habilidades",1], ["equipment","Equipamentos",1], ["states","Estados",2]
  ].map((x,i)=>({id:x[0],label:x[1],columns:x[2],visible:true,order:i,fieldIds:[],fieldColumns:{}}));
  const src=A(raw?.sections), map=new Map(src.map(x=>[x.id,x]));
  const base=defaults.map(x=>({...x,...O(map.get(x.id)),fieldIds:A(map.get(x.id)?.fieldIds),fieldColumns:O(map.get(x.id)?.fieldColumns)}));
  const legacyCustom=map.has("customFields") ? [{...O(map.get("customFields")),id:"customFields",label:map.get("customFields")?.label||"Campos personalizados",columns:map.get("customFields")?.columns||2,visible:map.get("customFields")?.visible!==false,fieldIds:A(map.get("customFields")?.fieldIds),fieldColumns:O(map.get("customFields")?.fieldColumns),order:map.get("customFields")?.order??base.length}] : [];
  const groups=A(raw?.customGroups).map((g,i)=>({id:g.id||`customGroup_${i}`,label:g.label||"Nova seção",columns:g.columns||1,visible:g.visible!==false,order:g.order??(base.length+legacyCustom.length+i),fieldIds:A(g.fieldIds),fieldColumns:O(g.fieldColumns)}));
  return {version:3,sections:[...base,...legacyCustom,...groups].sort((a,b)=>(a.order??0)-(b.order??0)).map((x,i)=>({...x,order:i,fieldIds:[...new Set(A(x.fieldIds))],fieldColumns:O(x.fieldColumns)}))};
}
function configOf(table){
  const c=O(table.configuration);
  const e=O(c.equipmentSettings || c.equipment);
  return {
    attributes:A(c.attributes), resources:A(c.resources), skills:A(c.skills), abilities:A(c.abilities), states:A(c.states), customFields:A(c.customFields),
    equipmentSettings:{enabled:!!e.enabled,equipmentTypes:A(e.equipmentTypes),currencyTypes:A(e.currencyTypes),financeEnabled:!!e.financeEnabled,loadSystem:e.loadSystem||"",loadUnit:e.loadUnit||"",slotCount:e.slotCount??"",maxItemsPerSlot:e.maxItemsPerSlot??"",weightLimit:e.weightLimit??"",weightUnit:e.weightUnit||"",unitMax:e.unitMax??"",customEquipmentName:e.customEquipmentName||"",customEquipmentMax:e.customEquipmentMax??""},
    layout:layoutOf(c.characterSheetLayout)
  };
}
function fresh(uidValue,characterId=uidValue){
  return {
    uid:uidValue, ownerUid:uidValue, characterId, tableId:S.tableId, status:"draft", alive:true, editingAllowed:true,
    profile:{name:"",imageUrl:""},
    createdAt:null,
    attributes:S.config.attributes.map(x=>({id:x.id||uid("attribute"),code:x.code||code(x),name:label(x),value:x.defaultValue??x.initialValue??0})),
    resources:S.config.resources.map(x=>({id:x.id||uid("resource"),code:x.code||code(x),name:label(x),value:x.defaultValue??x.initialValue??0})),
    skills:S.config.skills.map(x=>({id:x.id||uid("skill"),code:x.code||code(x),name:label(x),enabled:false})),
    abilities:S.config.abilities.map(x=>({id:x.id||uid("ability"),name:x.name||x.label||"",description:x.description||"",cost:x.cost||""})),
    equipment:[], finances:{}, states:[],
    customFields:S.config.customFields.map(x=>({id:x.id||uid("field"),code:x.code||code(x),name:label(x),type:x.type||"text",value:x.defaultValue??""})),
    values:{}
  };
  c.resources.forEach((resource,index)=>{
    const cfg=S.config.resources[index];
    const max=maxValueOf(cfg,c);
    if(max!==null)resource.value=max;
  });
  return c;
}
function normalize(raw,uidValue,characterId=null){ const b=fresh(uidValue,characterId||raw?.characterId||uidValue),c={...b,...O(raw)}; c.uid=uidValue; c.ownerUid=raw?.ownerUid||raw?.uid||uidValue; c.characterId=characterId||raw?.characterId||uidValue; c.profile={...b.profile,...O(raw?.profile)}; for(const k of ["attributes","resources","skills","abilities","equipment","finances","states","customFields"]) if(A(raw?.[k]).length) c[k]=raw[k]; c.values=O(raw?.values); return c; }
function valueMap(c){
  const m={};
  for(const list of [c.attributes,c.resources]) A(list).forEach(x=>{const k=String(x.code||code(x)).toUpperCase(),n=Number(x.value??x.current??x.amount??0);if(k&&Number.isFinite(n))m[k]=n;});
  Object.entries(O(c.values)).forEach(([k,v])=>{const n=Number(v);if(Number.isFinite(n))m[code({code:k})]=n;});
  return m;
}
function formula(v,c){
  const s=String(v??"").trim(); if(!/^\[.*\]$/.test(s)) return null;
  const exp=s.slice(1,-1).trim(),m=valueMap(c),tokens=exp.match(/[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9_]*|!!|!|\d+(?:[.,]\d+)?|[+\-*/()]/g); if(!tokens)return null;
  let base=null,js="";
  for(const raw of tokens){const t=raw.replace(",",".");
    if(/^[A-Za-zÀ-ÿ]/.test(t)){const k=code({code:t});if(!(k in m))return null;base??=k;js+=m[k];}
    else if(t==="!!"){if(!base)return null;const resource=A(c.resources).find(x=>String(x.code||code(x)).toUpperCase()===base);const max=Number(String(resource?.maxValue??resource?.maximum??resource?.max??resource?.limit??"").replace(",","."));if(!Number.isFinite(max))return null;js+=max;}
    else if(t==="!"){if(!base)return null;js+=m[base]??0;}
    else if(/^\d/.test(t))js+=t;
    else if("+-*/()".includes(t))js+=t;
    else return null;
  }
  try{const r=Function('"use strict";return ('+js+')')();return Number.isFinite(r)?r:null;}catch(e){return null;}
}
const shown=(v,c)=>{const r=formula(v,c);return r===null?v:r;};
function formulaRequired(v){ return /^\s*\[.*\]\s*$/.test(String(v??"")); }
function numericLimit(v,c){ const n=formula(v,c); if(n!==null)return n; const x=Number(v); return Number.isFinite(x)?x:null; }
function parserChoices(mode,c){const out=[];const add=(x,k)=>{const n=label(x),co=String(x.code||code(x)).slice(0,3).toUpperCase();if(co&&!out.some(z=>z.code===co))out.push({name:n,code:co,kind:k});};if(mode!=="cost")A(S.config.attributes).forEach(x=>add(x,"Atributo"));A(S.config.resources).forEach(x=>add(x,"Recurso"));return out.slice(0,4);}
function attachFormulaAutocomplete(el,mode,c){let menu=null;const close=()=>{menu?.remove();menu=null};el.addEventListener("input",()=>{const v=el.value||"",pos=el.selectionStart??v.length,left=v.slice(0,pos),m=left.lastIndexOf("[");if(m<0||left.slice(m+1).includes("]")){close();return}const choices=parserChoices(mode,c);if(!choices.length){close();return}close();menu=document.createElement("div");menu.className="cs-parser-menu";choices.forEach(x=>{const b=document.createElement("button");b.type="button";b.innerHTML=`<strong>${esc(x.name)}</strong><small>${esc(x.code)} · ${esc(x.kind)}</small>`;b.onclick=()=>{const before=v.slice(0,m),after=v.slice(pos);el.value=before+"["+x.code+"]"+after;const cursor=before.length+x.code.length+1;el.focus();el.setSelectionRange(cursor,cursor);el.dispatchEvent(new Event("input",{bubbles:true}));close()};menu.appendChild(b)});document.body.appendChild(menu);const r=el.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(window.innerWidth-300,r.left))+"px";menu.style.top=Math.max(8,r.top-menu.offsetHeight-6)+"px";});el.addEventListener("blur",()=>setTimeout(close,150));}
function input(value,on,area=false){const e=document.createElement(area?"textarea":"input");e.className="cs-input";if(area)e.rows=4;else e.type="text";e.value=value??"";e.addEventListener("input",()=>on(e.value,e));return e;}
function sectionShell(sec){const e=document.createElement("section");e.className="cs-section";e.dataset.sectionId=sec.id;e.innerHTML=`<div class="cs-section-header"><h2>${esc(sec.label)}</h2></div>`;return e;}
function configured(id){ if(id==="identity")return true; if(id==="equipment")return S.config.equipmentSettings.enabled; if(id==="finance")return S.config.equipmentSettings.financeEnabled && A(S.config.equipmentSettings.currencyTypes).length>0; return A(S.config[id]).length>0; }

function renderIdentity(sec,c,edit){
  const b=document.createElement("div");b.className="cs-section-body cs-identity";
  const f=document.createElement("div");f.className="cs-identity-fields";
  const n=document.createElement("div");n.className="cs-field";n.innerHTML="<label>Nome do personagem</label>";
  if(edit)n.appendChild(input(c.profile.name,v=>{c.profile.name=v}));else{const x=document.createElement("div");x.className="cs-static";x.textContent=c.profile.name||"Sem nome";n.appendChild(x)}
  f.appendChild(n);b.appendChild(f);sec.appendChild(b);
}

function maxValueOf(cfg,c,fallback=null){
  const raw=cfg?.max??cfg?.maximum??cfg?.maxValue??cfg?.limit??cfg?.capacity??fallback;
  if(raw===undefined||raw===null||raw==="")return null;
  const n=numericLimit(raw,c);
  return n!==null?n:null;
}
function currentValueOf(cur){return cur?.current??cur?.value??cur?.amount??cur?.quantity??0;}
function numericDisplay(value){
  if(value===null||value===undefined||value==="")return "";
  const text=String(value).trim().replace(",",".");
  if(!/^[+-]?\d+(?:\.\d+)?$/.test(text))return String(value);
  const n=Number(text);
  if(!Number.isFinite(n))return String(value);
  return String(n);
}
function slotStacks(set,item){
  if(set.loadSystem!=="slot"||!item.fractional)return [Math.max(0,Number(item.load)||0)];
  const max=Math.max(1,Number(set.maxItemsPerSlot)||1);
  let remaining=Math.max(0,Number(item.load)||0);
  const stacks=[];
  while(remaining>max){stacks.push(max);remaining-=max;}
  if(remaining>0||!stacks.length)stacks.push(remaining);
  return stacks;
}
function currentMaxText(cur,cfg,c,unit=""){
  const current=currentValueOf(cur);
  const max=maxValueOf(cfg,c);
  const currentText=numericDisplay(current);
  const maxText=numericDisplay(max);
  if(max===null)return `${currentText}${unit?` ${unit}`:""}`;
  return `${currentText}/${maxText}${unit?` ${unit}`:""}`;
}
function calculateResourceValues(c){
  return A(S.config.resources).map(x=>maxValueOf(x,c));
}
function refreshCalculatedResources(c){
  const root=document.querySelector(".cs-content"); if(!root)return;
  A(c.resources).forEach((r,i)=>{
    const card=root.querySelector(`[data-resource-index="${i}"]`);
    const value=card?.querySelector(".cs-resource-value");
    if(value)value.textContent=currentMaxText(r,S.config.resources[i],c);
  });
}

function renderBoundValue(sec,key,c,edit){
  const cfg=A(S.config[key]), b=document.createElement("div");
  if(key==="resources")calculateResourceValues(c); b.className="cs-section-body cs-grid";
  cfg.forEach((x,i)=>{
    const cur=c[key][i]||(c[key][i]={id:x.id||uid(key.slice(0,-1)),code:x.code||code(x),name:label(x),value:x.defaultValue??x.initialValue??0});
    const card=document.createElement("div");card.className="cs-card";card.dataset.layoutFieldId=`base:${key}:${i}`;
    if(key==="resources")card.dataset.resourceIndex=i;
    card.innerHTML=`<div class="cs-item-title"><strong>${esc(label(x))}</strong><span class="cs-title-actions">${x.code||code(x)?`<small>${esc(x.code||code(x))}</small>`:""}</span></div>`;const hb=helpButton(x.description);if(hb)card.querySelector(".cs-title-actions").appendChild(hb);
    const field=document.createElement("div");field.className="cs-field";
    const maxRaw=x.max??x.maximum??x.maxValue??"";
    const max=numericLimit(maxRaw,c);
    field.classList.toggle("cs-bound-value-field",key==="attributes");
    field.innerHTML=`<label>${key==="resources"?"Valor atual":(max!==null?"Valor atual / máximo":"Valor")}</label>`;
    if(key==="resources"){
      const st=document.createElement("div");st.className="cs-static cs-resource-full cs-resource-value";st.textContent=currentMaxText(cur,x,c);field.appendChild(st);
    }else if(edit){
      const el=input(numericDisplay(currentValueOf(cur)),(v,node)=>{
        if(max!==null && v!=="" && Number.isFinite(Number(v)) && Number(v)>max){ node.value=String(max); cur.value=max; toast(`O valor máximo de ${label(x)} é ${max}.`,`error`); return; }
        cur.value=v;
        if(key==="attributes")refreshCalculatedResources(c);
      });
      el.inputMode="decimal"; el.classList.add("cs-bound-number"); field.appendChild(el);
    }else{const st=document.createElement("div");st.className="cs-static cs-bound-number";st.textContent=currentMaxText(cur,x,c);field.appendChild(st)}
    if(key!=="resources"&&max!==null){const info=document.createElement("small");info.className="cs-limit";info.textContent=`Máximo definido pelo mestre: ${shown(maxRaw,c)}`;field.appendChild(info);}
    card.appendChild(field);b.appendChild(card);
  });
  sec.appendChild(b);
}

function renderSkills(sec,c,edit){
  const cfg=A(S.config.skills),b=document.createElement("div");b.className="cs-section-body cs-grid";
  cfg.forEach((x,i)=>{
    const cur=c.skills[i]||(c.skills[i]={id:x.id||uid("skill"),code:x.code||code(x),name:label(x),enabled:false});
    const card=document.createElement("div");card.className="cs-card cs-skill-card";card.dataset.layoutFieldId=`base:skills:${i}`;
    card.innerHTML=`<div class="cs-item-title"><strong>${esc(label(x))}</strong><span class="cs-title-actions">${x.code||code(x)?`<small>${esc(x.code||code(x))}</small>`:""}</span></div>${x.description?`<div class="cs-desc">${esc(x.description)}</div>`:""}`;const hb=helpButton(x.description);if(hb)card.querySelector(".cs-title-actions").appendChild(hb);
    const row=document.createElement("label");row.className="cs-switch-row";row.innerHTML=`<span>${cur.enabled?"Ativa":"Inativa"}</span><span class="cs-switch"><input type="checkbox" ${cur.enabled?"checked":""}><i></i></span>`;
    if(edit){const cb=row.querySelector("input");cb.addEventListener("change",()=>{cur.enabled=cb.checked;row.querySelector("span").textContent=cb.checked?"Ativa":"Inativa";});}else row.querySelector("input").disabled=true;
    card.appendChild(row);b.appendChild(card);
  });
  sec.appendChild(b);
}

function resourceFormulaInfo(c){
  const map={};
  A(S.config.resources).forEach(x=>{const k=String(x.code||code(x)).toUpperCase();if(k)map[k]=true;});
  return map;
}
function resourceCostParts(v){return String(v??"").match(/\[[^\]]+\]/g)||[];}
function resourceCostValue(v,c){
  const s=String(v??"").trim(); if(!s)return null;
  const parts=resourceCostParts(s); if(!parts.length || parts.join("")!==s)return null;
  let total=0;
  for(const part of parts){
    const exp=part.slice(1,-1).trim();
    const m=exp.match(/^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9_]*)([+-])(!|\d+(?:[.,]\d+)?)(?:\/(\d+(?:[.,]\d+)?))?$/);
    if(!m)return null;
    const k=String(m[1]||"").slice(0,3).toUpperCase(),allowed=resourceFormulaInfo(c); if(!allowed[k])return null;
    const base=Number(A(c.resources).find(r=>String(r.code||code(r)).toUpperCase()===k)?.value); if(!Number.isFinite(base))return null;
    const operand=m[3]==="!"?base:Number(m[3].replace(",","."));
    const signed=m[2]==="+"?base+operand:base-operand;
    const divisor=m[4]?Number(m[4].replace(",",".")):1; if(!Number.isFinite(divisor)||divisor===0)return null;
    total+=Math.abs(signed/divisor);
  }
  return Number.isFinite(total)?total:null;
}
function resourceFormulaValid(v,c){return resourceCostValue(v,c)!==null;}

function renderAbilities(sec,c,edit){
  const cfg=A(S.config.abilities),b=document.createElement("div");b.className="cs-section-body cs-grid";
  cfg.forEach((x,i)=>{
    const cur=c.abilities[i]||(c.abilities[i]={id:x.id||uid("ability"),name:x.name||x.label||"",description:x.description||"",cost:x.cost||""});
    const card=document.createElement("div");card.className="cs-card cs-ability-card";card.dataset.layoutFieldId=`base:abilities:${i}`;
    const type=x.type||x.kind||x.category||"";
    if(type){const typeEl=document.createElement("div");typeEl.className="cs-ability-type";typeEl.textContent=type;card.appendChild(typeEl);}
    if(edit){
      const nf=document.createElement("div");nf.className="cs-field";nf.innerHTML="<label>Nome</label>";nf.appendChild(input(cur.name,v=>cur.name=v));card.appendChild(nf);
      const df=document.createElement("div");df.className="cs-field";df.innerHTML="<label>Descrição</label>";const di=input(cur.description,v=>cur.description=v,true);attachFormulaAutocomplete(di,"description",c);df.appendChild(di);card.appendChild(df);
      const cf=document.createElement("div");cf.className="cs-field";cf.innerHTML="<label>Custo (fórmula de recurso)</label>";
      const ci=input(cur.cost,(v,node)=>{cur.cost=v;node.classList.toggle("cs-invalid",v!==""&&!resourceFormulaValid(v,c));});attachFormulaAutocomplete(ci,"cost",c);ci.placeholder="Ex.: [MAN+1][VID+!/2]";cf.appendChild(ci);
      const hint=document.createElement("small");hint.className="cs-hint";hint.textContent="Use somente recursos configurados nesta mesa, entre [ ].";cf.appendChild(hint);card.appendChild(cf);
    }else{
      card.innerHTML+=`<div class="cs-item-title"><strong>${esc(cur.name||"Sem nome")}</strong></div><div class="cs-field"><label>Descrição</label><div class="cs-static">${esc(shown(cur.description,c))}</div></div><div class="cs-field"><label>Custo</label><div class="cs-static">${esc(cur.cost||"—")}${resourceCostValue(cur.cost,c)!==null?` <span class="cs-formula-result">(${resourceCostValue(cur.cost,c)})</span>`:""}</div></div>`;
    }
    b.appendChild(card);
  });
  sec.appendChild(b);
}

function dropdown(value,options,on,disabled=false){
  const wrap=document.createElement("div");wrap.className="cs-dropdown";
  const btn=document.createElement("button");btn.type="button";btn.className="cs-input cs-dropdown-button";btn.textContent=value||"Selecione...";btn.disabled=disabled;
  const menu=document.createElement("div");menu.className="cs-dropdown-menu";
  A(options).forEach(v=>{const o=document.createElement("button");o.type="button";o.className="cs-dropdown-option";o.textContent=v;o.addEventListener("click",()=>{btn.textContent=v;menu.hidden=true;on(v)});menu.appendChild(o)});
  btn.addEventListener("click",e=>{e.stopPropagation();document.querySelectorAll(".cs-dropdown-menu").forEach(x=>{if(x!==menu)x.hidden=true});menu.hidden=!menu.hidden});
  document.addEventListener("click",()=>{menu.hidden=true},{once:true});
  wrap.append(btn,menu);return wrap;
}

function helpButton(description){if(!description)return null;const b=document.createElement("button");b.type="button";b.className="cs-help";b.textContent="?";b.title="Ver descrição";b.onclick=e=>{e.stopPropagation();document.querySelector(".cs-description-modal")?.remove();const bg=document.createElement("div");bg.className="cs-modal-bg cs-description-modal";bg.style.zIndex="100000";bg.innerHTML=`<div class="cs-modal cs-description-dialog"><header><div><h2>Descrição</h2></div><button class="cs-close" type="button">×</button></header><div class="cs-description-content"></div></div>`;bg.querySelector(".cs-description-content").textContent=description;bg.querySelector(".cs-close").onclick=()=>bg.remove();bg.onclick=x=>{if(x.target===bg)bg.remove()};document.body.appendChild(bg)};return b;}

function inventoryLoad(set,item){
  const max=Math.max(1,Number(set.maxItemsPerSlot)||1);
  if(set.loadSystem==="slot"){
    const units=Math.max(0,Number(item.load)||0);
    const slots=item.fractional?Math.max(1,Math.ceil(units/max)):1;
    return {current:item.fractional?units:1,max,slots,unit:"slot"};
  }
  if(set.loadSystem==="weight")return {current:Number(item.load)||0,max:Number(set.weightLimit)||null,unit:set.weightUnit||set.loadUnit||"kg"};
  if(set.loadSystem==="unit")return {current:Number(item.load)||0,max:Number(set.unitMax)||null,unit:set.loadUnit||"un"};
  if(set.loadSystem==="custom")return {current:Number(item.load)||0,max:Number(set.customEquipmentMax)||null,unit:set.loadUnit||set.customEquipmentName||""};
  return {current:0,max:null,unit:""};
}
function inventorySlots(set,equipment){
  if(set.loadSystem!=="slot") return 0;
  return A(equipment).reduce((sum,it)=>sum+inventoryLoad(set,it).slots,0);
}
function inventoryCapacityText(set,equipment){
  if(set.loadSystem==="slot"){const used=inventorySlots(set,equipment);return `${used}/${Number(set.slotCount)||"∞"} slots`;}
  const total=A(equipment).reduce((sum,it)=>sum+(Number(inventoryLoad(set,it).current)||0),0);
  if(set.loadSystem==="weight"){const unit=set.weightUnit||set.loadUnit||"kg",max=Number(set.weightLimit);return Number.isFinite(max)&&max>0?`${total}/${max} ${unit}`:`${total} ${unit}`;}
  if(set.loadSystem==="unit"){const max=Number(set.unitMax),unit=set.loadUnit||"un";return Number.isFinite(max)&&max>0?`${total}/${max} ${unit}`:`${total} ${unit}`;}
  if(set.loadSystem==="custom"){const max=Number(set.customEquipmentMax),unit=set.loadUnit||set.customEquipmentName||"";return Number.isFinite(max)&&max>0?`${total}/${max}${unit?` ${unit}`:""}`:`${total}${unit?` ${unit}`:""}`;}
  return "Inventário";
}
function loadFieldForEquipment(set,item,c,edit,card){
  const system=set.loadSystem;if(system==="free")return;
  const field=document.createElement("div");field.className="cs-field cs-load-field";
  if(system==="slot"){
    const toggle=document.createElement("label");toggle.className="cs-fraction-toggle";toggle.innerHTML=`<input type="checkbox" ${item.fractional?"checked":""}><span class="cs-toggle-track"><i></i></span><span>Usar carga fracionária</span>`;
    const cb=toggle.querySelector("input"),wrap=document.createElement("div");wrap.className="cs-fraction-wrap";
    const max=Math.max(1,Number(set.maxItemsPerSlot)||1);
    const val=input(item.fractional?(item.load??""):"",(v,node)=>{const n=Number(String(v).replace(",","."));if(!Number.isFinite(n)||n<0){return}item.load=n;node.classList.remove("cs-invalid");});val.inputMode="numeric";val.placeholder=`Unidades (máx. ${max} por slot)`;val.disabled=!item.fractional||!edit;
    const info=document.createElement("small");info.className="cs-limit";info.textContent=`Até ${max} unidades por slot. Quantidades maiores ocupam automaticamente mais slots.`;
    wrap.append(val,info);wrap.hidden=!item.fractional;cb.disabled=!edit;
    cb.addEventListener("change",()=>{item.fractional=cb.checked;if(!cb.checked){item.load=1;val.value="";}else if(!item.load||Number(item.load)<1)item.load=1;val.disabled=!cb.checked||!edit;wrap.hidden=!cb.checked;});
    field.append(toggle,wrap);
  }else if(system==="weight"){
    const unit=set.weightUnit||set.loadUnit||"kg";field.innerHTML=`<label>Peso (${esc(unit)})</label>`;const val=input(item.load??"",v=>item.load=v);val.inputMode="decimal";val.disabled=!edit;field.appendChild(val);
  }else if(system==="unit"){
    field.innerHTML="<label>Quantidade / unidades</label>";const val=input(item.load??"",v=>item.load=v);val.inputMode="decimal";val.disabled=!edit;field.appendChild(val);
  }else if(system==="custom"){
    field.innerHTML=`<label>${esc(set.customEquipmentName||"Carga")}</label>`;const val=input(item.load??"",v=>item.load=v);val.disabled=!edit;field.appendChild(val);
  }
  card.appendChild(field);
}
function renderEquipment(sec,c,edit){
  const set=S.config.equipmentSettings,b=document.createElement("div");b.className="cs-section-body";
  const used=inventorySlots(set,c.equipment),maxSlots=Math.max(0,Number(set.slotCount)||0);
  const bar=document.createElement("div");bar.className="cs-equipment-summary";bar.innerHTML=`<div><strong>Equipamentos</strong><span class="cs-slot-counter">${esc(inventoryCapacityText(set,c.equipment))}</span></div>`;b.appendChild(bar);
  const list=document.createElement("div");list.className="cs-equip-list";
  A(c.equipment).forEach((item,i)=>{
    if(!edit && set.loadSystem==="slot" && item.fractional){
      const stacks=slotStacks(set,item);
      stacks.forEach(stack=>{
        const card=document.createElement("div");card.className="cs-card cs-equipment-card";
        const max=Math.max(1,Number(set.maxItemsPerSlot)||1);
        card.innerHTML=`<div class="cs-item-title"><strong>${esc(item.name||"Sem nome")}</strong><small>${esc(item.type||"")}</small></div><div class="cs-meta cs-equipment-load">${numericDisplay(stack)}/${numericDisplay(max)}</div>${item.description?`<div class="cs-desc">${esc(shown(item.description,c))}</div>`:""}`;
        list.appendChild(card);
      });
      return;
    }
    const card=document.createElement("div");card.className="cs-card cs-equipment-card";
    if(edit){
      card.innerHTML=`<div class="cs-field"><label>Nome</label></div><div class="cs-field"><label>Tipo</label></div><div class="cs-field cs-description-field"><label>Descrição</label></div><button type="button" class="cs-danger cs-remove">Remover</button>`;
      card.children[0].appendChild(input(item.name,v=>item.name=v));card.children[1].appendChild(dropdown(item.type,set.equipmentTypes,v=>item.type=v));const ed=input(item.description,v=>item.description=v,true);attachFormulaAutocomplete(ed,"description",c);card.children[2].appendChild(ed);loadFieldForEquipment(set,item,c,edit,card);
      card.querySelector(".cs-remove").onclick=()=>{c.equipment.splice(i,1);renderCharacter()};
    }else{
      const load=inventoryLoad(set,item);
      let loadText="";
      if(set.loadSystem!=="free"){
        if(set.loadSystem==="slot")loadText=item.fractional?`${numericDisplay(load.current)}/${numericDisplay(load.max)}`:`1 slot`;
        else loadText=`${numericDisplay(load.current)}${load.max!==null?`/${numericDisplay(load.max)}`:""}${load.unit?` ${esc(load.unit)}`:""}`;
      }
      card.innerHTML=`<div class="cs-item-title"><strong>${esc(item.name||"Sem nome")}</strong><small>${esc(item.type||"")}</small></div><div class="cs-meta cs-equipment-load">${loadText||"—"}</div>${item.description?`<div class="cs-desc">${esc(shown(item.description,c))}</div>`:""}`;
      list.appendChild(card);
      return;
    }
    list.appendChild(card);
  });
  if(!A(c.equipment).length)list.innerHTML="<div class='cs-empty'>Nenhum equipamento cadastrado.</div>";
  b.appendChild(list);
  if(edit){const add=document.createElement("button");add.type="button";add.className="cs-primary cs-add-equipment";add.textContent="+ Adicionar equipamento";add.disabled=set.loadSystem==="slot"&&maxSlots>0&&used>=maxSlots;add.onclick=()=>{c.equipment.push({id:uid("equipment"),name:"",type:set.equipmentTypes[0]||"",load:set.loadSystem==="slot"?1:"",fractional:false,description:""});renderCharacter()};b.appendChild(add);}
  sec.appendChild(b);
}

function currencyConfigEntry(raw,key){
  if(raw&&typeof raw==="object"&&!Array.isArray(raw))return raw;
  const limits=O(S.config.equipmentSettings.currencyLimits||S.config.equipmentSettings.financeLimits);
  return {name:key,max:limits[key]};
}
function renderFinance(sec,c,edit){
  const set=S.config.equipmentSettings,b=document.createElement("div");b.className="cs-section-body cs-grid";
  const cur=c.finances||(c.finances={});
  A(set.currencyTypes).forEach((currency,i)=>{
    const entry=currencyConfigEntry(currency,String(currency));
    const key=String(entry.name||entry.label||entry.code||currency).trim();if(!key)return;
    const card=document.createElement("div");card.className="cs-card";
    const f=document.createElement("div");f.className="cs-field";
    const max=maxValueOf(entry,c);f.innerHTML=`<label>${esc(key)}${max!==null?" · atual / máximo":""}</label>`;
    const current=cur[key]??entry.defaultValue??entry.initialValue??0;
    if(edit){const val=input(numericDisplay(current),v=>{cur[key]=v});val.inputMode="decimal";f.appendChild(val);}
    else{const st=document.createElement("div");st.className="cs-static";st.textContent=max!==null?`${numericDisplay(current)}/${numericDisplay(max)}`:numericDisplay(current);f.appendChild(st);}
    if(max!==null){const info=document.createElement("small");info.className="cs-limit";info.textContent=`Máximo definido pelo mestre: ${shown(entry.max??entry.maximum??entry.maxValue,c)}`;f.appendChild(info);}
    card.appendChild(f);b.appendChild(card);
  });
  sec.appendChild(b);
}

function renderCustomFieldsInto(sec,c,edit,fieldIds=null,layoutSec=null){
 const layoutConfig=layoutSec||S.layout.sections.find(z=>z.id===sec.dataset.sectionId);
 const assignedIds=new Set(S.layout.sections.flatMap(z=>A(z.fieldIds)));
 const cfg=A(S.config.customFields).filter((x,i)=>!fieldIds ? !assignedIds.has(x.id||code(x)) : fieldIds.includes(x.id||code(x))); if(!cfg.length)return;
 const b=document.createElement("div");b.className="cs-section-body cs-grid";
 cfg.forEach((x)=>{const id=x.id||code(x),i=S.config.customFields.indexOf(x),cur=c.customFields[i]||(c.customFields[i]={id,code:x.code||code(x),name:label(x),type:x.type||"text",value:x.defaultValue??""});const max=maxValueOf(x,c);const card=document.createElement("div");card.className="cs-card";card.dataset.customFieldId=id;card.innerHTML=`<div class="cs-item-title"><strong>${esc(label(x))}</strong><span class="cs-title-actions"></span></div><div class="cs-field"><label>${max!==null?"Valor atual / máximo":"Valor"}</label></div>`;const hb=helpButton(x.description);if(hb)card.querySelector(".cs-title-actions").appendChild(hb);const f=card.querySelector(".cs-field");if(edit){const t=String(x.type||"text").toLowerCase();if(["selection","select","seleção"].includes(t)){const opts=Array.isArray(x.options)?x.options:String(x.options||"").split(";").map(v=>v.trim()).filter(Boolean);f.appendChild(dropdown(cur.value,opts,v=>cur.value=v,!edit));}else if(["textarea","longtext"].includes(t))f.appendChild(input(cur.value,v=>cur.value=v,true));else f.appendChild(input(numericDisplay(currentValueOf(cur)),v=>cur.value=v));}else{const st=document.createElement("div");st.className="cs-static";st.textContent=max!==null?`${numericDisplay(currentValueOf(cur))}/${numericDisplay(max)}`:numericDisplay(cur.value);f.appendChild(st)}if(max!==null){const info=document.createElement("small");info.className="cs-limit";info.textContent=`Máximo definido pelo mestre: ${shown(x.max??x.maximum??x.maxValue,c)}`;f.appendChild(info)}b.appendChild(card);});sec.appendChild(b);
}

function renderCustom(sec,c,edit){ renderCustomFieldsInto(sec,c,edit,null); }
function applySectionFieldLayout(sectionEl,layoutSec){
  const body=sectionEl.querySelector('.cs-section-body');if(!body)return;
  const cards=[...body.querySelectorAll('.cs-card')];if(!cards.length)return;
  const byId=new Map(cards.map(card=>[card.dataset.customFieldId||card.dataset.layoutFieldId,card]));
  const order=A(layoutSec.fieldIds);const used=new Set();let rank=0;
  order.forEach(fid=>{const card=byId.get(fid);if(!card)return;used.add(fid);const cols=Math.max(1,Math.min(4,Number(layoutSec.columns)||1));card.style.order=String(rank);card.style.gridColumn=String((rank%cols)+1);rank++;});
  cards.forEach(card=>{const id=card.dataset.customFieldId||card.dataset.layoutFieldId;if(!used.has(id))card.style.order=String(rank++);});
}
function renderSection(sec,c,edit){if(sec.visible===false)return null;const isGroup=String(sec.id).startsWith("customGroup_");if(!configured(sec.id)&&!isGroup)return null;const e=sectionShell(sec);if(sec.id==="identity")renderIdentity(e,c,edit);else if(sec.id==="attributes"||sec.id==="resources")renderBoundValue(e,sec.id,c,edit);else if(sec.id==="skills")renderSkills(e,c,edit);else if(sec.id==="abilities")renderAbilities(e,c,edit);else if(sec.id==="equipment")renderEquipment(e,c,edit);else if(sec.id==="customFields")renderCustomFieldsInto(e,c,edit,A(sec.fieldIds).length?A(sec.fieldIds):null,sec);else if(isGroup)renderCustomFieldsInto(e,c,edit,A(sec.fieldIds),sec);else renderBoundValue(e,sec.id,c,edit);if(sec.id!=="customFields"&&!isGroup&&A(sec.fieldIds).length)renderCustomFieldsInto(e,c,edit,A(sec.fieldIds),sec);e.style.setProperty("--cols",Math.max(1,Math.min(4,Number(sec.columns)||1)));applySectionFieldLayout(e,sec);return e;}

function normalizedCharacterName(value){return String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLocaleLowerCase("pt-BR");}
async function characterNameAvailable(nameValue,excludeId=null){const wanted=normalizedCharacterName(nameValue);if(!wanted)return false;const snap=await getDocs(collection(db,"tables",S.tableId,"characters"));return !snap.docs.some(x=>x.id!==excludeId&&normalizedCharacterName(x.data()?.profile?.name||x.data()?.name||"")===wanted);}
function characterIsDead(c){return c?.status==="dead"||c?.alive===false||!!c?.death;}
function npcCharacters(){return [...S.npcs.values()];}
function npcIsDead(c){return c?.status==="dead"||c?.alive===false||!!c?.death;}
function npcNameAvailable(nameValue,excludeId=null){const wanted=normalizedCharacterName(nameValue);if(!wanted)return false;return !npcCharacters().some(x=>x.npcId!==excludeId&&normalizedCharacterName(x.profile?.name||x.name||"")===wanted);}
function npcFresh(id=uid("npc")){const c=fresh(S.user.uid,id);c.uid=S.user.uid;c.ownerUid=S.user.uid;c.npcId=id;c.characterId=id;c.tableId=S.tableId;c.type="npc";c.status="draft";c.alive=true;c.editingAllowed=true;return c;}
async function createNpc(){if(!S.isMaster)return;const id=uid("npc");const c=npcFresh(id);try{await setDoc(doc(db,"tables",S.tableId,"npcs",id),{...c,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});S.npcs.set(id,c);S.selectedNpcId=id;openMasterNpcSheet(id,true);toast("Novo NPC criado.","success");}catch(e){console.error(e);toast("Não foi possível criar o NPC.","error");}}
async function saveNpc(){if(!S.character||!S.selectedNpcId||S.saving)return;const name=String(S.character.profile?.name||"").trim();if(!name)return toast("Dê um nome ao NPC antes de salvar.","error");if(!npcNameAvailable(name,S.selectedNpcId))return toast("Já existe um NPC com esse nome nesta mesa.","error");S.saving=true;try{const id=S.selectedNpcId;const data={...S.character,uid:S.user.uid,ownerUid:S.user.uid,npcId:id,characterId:id,tableId:S.tableId,type:"npc",updatedAt:serverTimestamp()};await setDoc(doc(db,"tables",S.tableId,"npcs",id),data,{merge:true});S.npcs.set(id,normalize(data,S.user.uid,id));S.character=S.npcs.get(id);S.editing=false;toast("NPC salvo.","success");rerenderMasterSheet();}catch(e){console.error(e);toast("Não foi possível salvar o NPC.","error");}finally{S.saving=false;}}
async function deleteNpc(){
  if(!S.isMaster||!S.selectedNpcId)return;
  const id=S.selectedNpcId;
  const npc=S.npcs.get(id)||S.character;
  const name=String(npc?.profile?.name||npc?.name||"este NPC").trim();
  if(!confirm(`Excluir definitivamente o NPC "${name}"?\n\nEsta ação não pode ser desfeita.`))return;
  try{
    if(S.activeMasterNpcId===id){
      await updateDoc(doc(db,"tables",S.tableId),{activeMasterNpcId:null,activeMasterNpcAt:null,activeMasterNpcBy:null});
      S.activeMasterNpcId=null;
      if(S.table)S.table.activeMasterNpcId=null;
    }
    await deleteDoc(doc(db,"tables",S.tableId,"npcs",id));
    S.npcs.delete(id);
    S.selectedNpcId=null;
    S.character=null;
    S.editing=false;
    document.querySelector(".cs-npc-fullscreen")?.remove();
    toast("NPC excluído definitivamente.","success");
    rerenderMasterSheet();
  }catch(e){
    console.error(e);
    toast("Não foi possível excluir o NPC.","error");
  }
}

async function toggleNpcDeath(dead){if(!S.selectedNpcId)return;try{const ref=doc(db,"tables",S.tableId,"npcs",S.selectedNpcId);await updateDoc(ref,{status:dead?"dead":"draft",alive:!dead,death:dead?{at:serverTimestamp(),by:S.user.uid}:null,updatedAt:serverTimestamp()});if(dead&&S.activeMasterNpcId===S.selectedNpcId)await setActiveMasterNpc(null);toast(dead?"NPC enviado para o cemitério.":"NPC restaurado.","success");}catch(e){console.error(e);toast("Não foi possível atualizar o NPC.","error");}}
async function setActiveMasterNpc(npcId){if(!S.isMaster)return;try{await updateDoc(doc(db,"tables",S.tableId),{activeMasterNpcId:npcId||null,activeMasterNpcAt:npcId?serverTimestamp():null,activeMasterNpcBy:npcId?S.user.uid:null});S.activeMasterNpcId=npcId||null;S.table.activeMasterNpcId=npcId||null;toast(npcId?"Ficha do NPC agora está em uso nas rolagens.":"Ficha do NPC retirada das rolagens.","success");rerenderMasterSheet();}catch(e){console.error(e);toast("Não foi possível definir a ficha ativa.","error");}}
function playerCharacters(){return [...S.characters.values()].filter(c=>(c.ownerUid||c.uid)===S.user.uid);}
function hasAlivePlayerCharacter(){return playerCharacters().some(c=>!characterIsDead(c));}
async function savePlayerCharacter(){if(!S.character||S.saving)return;const nameValue=String(S.character.profile?.name||"").trim();
if(!characterIsDead(S.character)&&playerCharacters().some(c=>c.characterId!==S.character.characterId&&!characterIsDead(c))){toast("Você já possui um personagem vivo nesta mesa.","error");return;}if(nameValue&&!await characterNameAvailable(nameValue,S.character.characterId||S.selectedId)){toast("Já existe um personagem com esse nome nesta mesa.","error");return;}S.saving=true;try{const idValue=S.character.characterId||S.selectedId||S.character.uid;await setDoc(doc(db,"tables",S.tableId,"characters",idValue),{...S.character,uid:S.user.uid,ownerUid:S.user.uid,characterId:idValue,tableId:S.tableId,updatedAt:serverTimestamp()},{merge:true});S.character.uid=S.user.uid;S.character.ownerUid=S.user.uid;S.character.characterId=idValue;toast("Ficha salva.","success");renderCharacter();}catch(e){console.error(e);toast("Não foi possível salvar a ficha.","error");}finally{S.saving=false;}}
async function submit(){if(!S.character||S.saving)return;const nameValue=String(S.character.profile?.name||"").trim();if(!nameValue){toast("Dê um nome ao personagem antes de enviar a ficha.","error");return;}if(!await characterNameAvailable(nameValue,S.character.characterId||S.selectedId)){toast("Já existe um personagem com esse nome nesta mesa.","error");return;}const invalid=A(S.character.abilities).find(a=>a.cost&&!resourceFormulaValid(a.cost,S.character));if(invalid){toast(`O custo da habilidade "${invalid.name||"Sem nome"}" deve usar somente recursos e uma fórmula entre [ ].`,"error");return;}S.saving=true;try{const idValue=S.character.characterId||S.selectedId||S.character.uid;const p={...S.character,uid:S.user.uid,ownerUid:S.user.uid,characterId:idValue,tableId:S.tableId,status:"pending",alive:true,editingAllowed:false,submittedAt:serverTimestamp(),rejectionReason:"",updatedAt:serverTimestamp()};await setDoc(doc(db,"tables",S.tableId,"characters",idValue),p,{merge:true});S.character.status="pending";S.character.editingAllowed=false;S.editing=false;toast("Ficha enviada para aprovação.","success");renderCharacter();}catch(e){console.error(e);toast("Não foi possível enviar a ficha.","error");}finally{S.saving=false;}}
function rerenderMasterSheet(){const m=document.querySelector(".cs-master-fullscreen");if(m)renderCharacter(m,m.classList.contains("cs-npc-fullscreen"));else renderCharacter();}
async function masterSave(){if(!S.character||S.saving)return;S.saving=true;try{const idValue=S.character.characterId||S.character.uid;await setDoc(doc(db,"tables",S.tableId,"characters",idValue),{...S.character,tableId:S.tableId,uid:S.character.ownerUid||S.character.uid,ownerUid:S.character.ownerUid||S.character.uid,characterId:idValue,updatedAt:serverTimestamp()},{merge:true});S.editing=false;toast("Ficha salva.","success");rerenderMasterSheet();}catch(e){console.error(e);toast("Não foi possível salvar a ficha.","error");}finally{S.saving=false;}}
async function decide(kind){if(!S.character)return;try{const ref=doc(db,"tables",S.tableId,"characters",S.character.characterId||S.character.uid);if(kind==="approve"){const owner=S.character.ownerUid||S.character.uid;const aliveOther=[...S.characters.values()].some(c=>(c.characterId||c.uid)!==(S.character.characterId||S.character.uid)&&(c.ownerUid||c.uid)===owner&&!characterIsDead(c));if(aliveOther){toast("Este player já possui um personagem vivo. Não é possível aprovar outro.","error");return;}}if(kind==="approve"){await updateDoc(ref,{status:"approved",editingAllowed:false,approvedAt:serverTimestamp(),rejectedAt:null,rejectionReason:"",updatedAt:serverTimestamp()});S.character.status="approved";S.character.editingAllowed=false;S.character.rejectionReason="";}if(kind==="reject"){const reason=prompt("Motivo da devolução (opcional):","")||"";await updateDoc(ref,{status:"rejected",editingAllowed:true,rejectedAt:serverTimestamp(),rejectionReason:reason,updatedAt:serverTimestamp()});S.character.status="rejected";S.character.editingAllowed=true;S.character.rejectionReason=reason;}if(kind==="unlock"){await updateDoc(ref,{editingAllowed:true,updatedAt:serverTimestamp()});S.character.editingAllowed=true;}if(kind==="lock"){await updateDoc(ref,{editingAllowed:false,updatedAt:serverTimestamp()});S.character.editingAllowed=false;}toast(kind==="approve"?"Ficha aprovada e bloqueada.":kind==="reject"?"Ficha devolvida para edição.":kind==="unlock"?"Edição liberada.":"Ficha bloqueada.","success");rerenderMasterSheet();}catch(e){console.error(e);toast("Não foi possível atualizar a ficha.","error");}}
function openLayout(){
  const draft=JSON.parse(JSON.stringify(S.layout));
  draft.sections=A(draft.sections).map((x,i)=>({...x,fieldIds:[...new Set(A(x.fieldIds))],fieldColumns:O(x.fieldColumns),order:i}));
  const custom=A(S.config.customFields).map((x,i)=>({id:x.id||code(x)||`field_${i}`,label:label(x),description:x.description||""}));
  const fieldById=new Map(custom.map(x=>[x.id,x]));
  const m=document.createElement("div");m.className="cs-layout-fullscreen";
  m.innerHTML=`<div class="cs-layout-editor-full"><header class="cs-layout-editor-head"><div><h2>Editar layout da ficha</h2><p>Segure por um instante o campo ou a alça da sessão para arrastar. Clique normal não move nada.</p></div><button class="cs-close" type="button">×</button></header><div class="cs-layout-editor-body"><aside class="cs-field-palette"><div class="cs-palette-head"><strong>Campos criados</strong><span class="cs-palette-count">0</span><button type="button" class="cs-palette-toggle" aria-label="Recolher campos">−</button></div><p class="cs-palette-help">Segure um campo para colocá-lo em uma sessão. Campos já alocados ficam aqui como referência.</p><div class="cs-palette-list"></div></aside><main class="cs-session-list"></main></div><footer class="cs-layout-editor-foot"><button class="cs-secondary cs-cancel">Cancelar</button><button class="cs-primary cs-layout-save">Salvar layout</button></footer></div>`;
  document.body.appendChild(m);
  const list=m.querySelector('.cs-session-list'),palette=m.querySelector('.cs-palette-list'),paletteBox=m.querySelector('.cs-field-palette');
  let drag=null,placeholder=null,scrollRaf=0,pressTimer=null,pressState=null;
  const assigned=()=>new Set(draft.sections.flatMap(x=>A(x.fieldIds)));
  const makePlaceholder=(cls,height)=>{const p=document.createElement('div');p.className=`cs-drop-placeholder ${cls||''}`;p.style.height=`${Math.max(38,height||0)}px`;return p;};
  const cleanup=()=>{if(pressTimer){clearTimeout(pressTimer);pressTimer=null;}placeholder?.remove();placeholder=null;document.body.classList.remove('cs-layout-dragging');if(drag?.el){drag.el.style.display="";drag.el.classList.remove('is-dragging');}drag=null;pressState=null;cancelAnimationFrame(scrollRaf);};
  const autoScroll=y=>{const top=92,bottom=window.innerHeight-92;if(y<top||y>bottom){cancelAnimationFrame(scrollRaf);scrollRaf=requestAnimationFrame(()=>{const d=y<top?-(6+Math.min(22,(top-y)/3)):(6+Math.min(22,(y-bottom)/3));list.scrollTop+=d;});}};
  const uniqueFields=()=>{const seen=new Set();draft.sections.forEach(sec=>{sec.fieldIds=A(sec.fieldIds).filter(fid=>{if(seen.has(fid))return false;const ok=fieldById.has(fid)||String(fid).startsWith('base:');if(ok)seen.add(fid);return ok;});sec.fieldColumns=O(sec.fieldColumns);Object.keys(sec.fieldColumns).forEach(fid=>{if(!sec.fieldIds.includes(fid))delete sec.fieldColumns[fid];});});};
  const baseFieldsForSection=sec=>{if(sec.id==='identity')return [{id:'base:identity:0',label:'Identidade'}];return A(S.config[sec.id]).map((x,i)=>({id:`base:${sec.id}:${i}`,label:label(x),description:x.description||''}));};
  const ensureSectionFields=sec=>{const base=baseFieldsForSection(sec).map(x=>x.id),existing=A(sec.fieldIds);sec.fieldIds=[...existing.filter((fid,i,a)=>a.indexOf(fid)===i&&(base.includes(fid)||fieldById.has(fid))),...base.filter(fid=>!existing.includes(fid))];sec.fieldColumns=O(sec.fieldColumns);};
  const sectionEl=id=>list.querySelector(`.cs-layout-section[data-id="${CSS.escape(id)}"]`);
  const orderedFromDOM=secEl=>{if(!secEl)return[];const out=[];secEl.querySelectorAll('.cs-layout-fields').forEach(col=>[...col.children].forEach(el=>{if(el.classList.contains('cs-layout-field')&&el.dataset.fieldId)out.push(el.dataset.fieldId);}));return [...new Set(out)];};
  const moveSectionPlaceholder=y=>{if(!drag)return;const els=[...list.querySelectorAll('.cs-layout-section')].filter(el=>el!==drag.el);let target=null;for(const el of els){const r=el.getBoundingClientRect();if(y<r.top+r.height/2){target=el;break;}}if(target)list.insertBefore(placeholder,target);else list.appendChild(placeholder);};
  const moveFieldPlaceholder=(secEl,x,y)=>{if(!secEl||!placeholder)return;const cols=[...secEl.querySelectorAll('.cs-layout-fields')];if(!cols.length)return;let col=cols.find(c=>{const r=c.getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top-10&&y<=r.bottom+10;});if(!col)col=cols.reduce((best,c)=>{const a=c.getBoundingClientRect(),b=best.getBoundingClientRect();return Math.abs((a.left+a.right)/2-x)<Math.abs((b.left+b.right)/2-x)?c:best},cols[0]);const els=[...col.children].filter(el=>el.classList.contains('cs-layout-field')&&el!==drag?.el&&el!==placeholder);let target=null;for(const el of els){const r=el.getBoundingClientRect();if(y<r.top+r.height/2){target=el;break;}}if(target)col.insertBefore(placeholder,target);else col.appendChild(placeholder);};
  const beginSection=el=>{if(!el||drag)return;drag={type:'section',id:el.dataset.id,el};el.classList.add('is-dragging');placeholder=makePlaceholder('cs-section-placeholder',el.offsetHeight);el.parentNode.insertBefore(placeholder,el);el.style.display='none';document.body.classList.add('cs-layout-dragging');};
  const beginField=el=>{if(!el||drag)return;drag={type:'field',id:el.dataset.fieldId,from:el.dataset.sectionId,el};el.classList.add('is-dragging');placeholder=makePlaceholder('cs-field-placeholder',el.offsetHeight);el.parentNode.insertBefore(placeholder,el);el.style.display='none';document.body.classList.add('cs-layout-dragging');};
  const beginPalette=el=>{if(!el||drag||assigned().has(el.dataset.fieldId))return;drag={type:'palette-field',id:el.dataset.fieldId,el};el.classList.add('is-dragging');placeholder=makePlaceholder('cs-field-placeholder',el.offsetHeight);document.body.classList.add('cs-layout-dragging');};
  const finishSection=()=>{if(!drag||drag.type!=='section')return;const moved=draft.sections.find(x=>x.id===drag.id),ordered=[];for(const el of list.children){if(el===placeholder){if(moved)ordered.push(moved);}else if(el.classList.contains('cs-layout-section')){const sec=draft.sections.find(x=>x.id===el.dataset.id);if(sec&&!ordered.includes(sec))ordered.push(sec);}}if(moved&&!ordered.includes(moved))ordered.push(moved);draft.sections=ordered.map((x,i)=>({...x,order:i}));cleanup();render();};
  const removeFieldFromAll=fid=>draft.sections.forEach(sec=>{sec.fieldIds=A(sec.fieldIds).filter(x=>x!==fid);sec.fieldColumns=O(sec.fieldColumns);delete sec.fieldColumns[fid];});
  const finishField=()=>{if(!drag||drag.type!=='field')return;const fid=drag.id,targetEl=placeholder?.closest('.cs-layout-section'),target=targetEl&&draft.sections.find(x=>x.id===targetEl.dataset.id);if(!target){cleanup();render();return;}if(String(fid).startsWith('base:')&&target.id!==drag.from){cleanup();render();return;}const targetColEl=placeholder?.parentElement?.classList.contains('cs-layout-fields')?placeholder.parentElement:null;const cols=[...targetEl.querySelectorAll('.cs-layout-fields')],col=Math.max(1,cols.indexOf(targetColEl)+1);let order=orderedFromDOM(targetEl).filter(x=>x!==fid);const anchor=placeholder&&targetColEl?[...targetColEl.children].filter(el=>el.classList.contains('cs-layout-field')&&el!==drag.el&&el!==placeholder).indexOf([...targetColEl.children].find(el=>el===placeholder)): -1;let pos=order.length;if(anchor>=0){const ids=[...targetColEl.children].filter(el=>el.classList.contains('cs-layout-field')&&el!==drag.el&&el!==placeholder).map(el=>el.dataset.fieldId);const ai=order.indexOf(ids[anchor]);if(ai>=0)pos=ai;}removeFieldFromAll(fid);order.splice(Math.max(0,pos),0,fid);target.fieldIds=[...new Set(order)];target.fieldColumns=O(target.fieldColumns);target.fieldColumns[fid]=col;uniqueFields();cleanup();render();};
  const dropPaletteToSession=()=>{if(!drag||drag.type!=='palette-field')return;const fid=drag.id,targetEl=placeholder?.closest('.cs-layout-section'),target=targetEl&&draft.sections.find(x=>x.id===targetEl.dataset.id),targetColEl=placeholder?.parentElement?.classList.contains('cs-layout-fields')?placeholder.parentElement:null;if(!target||!targetColEl||assigned().has(fid)){cleanup();render();return;}const col=Math.max(1,[...targetEl.querySelectorAll('.cs-layout-fields')].indexOf(targetColEl)+1);const order=orderedFromDOM(targetEl);const ids=[...targetColEl.children].filter(el=>el.classList.contains('cs-layout-field')&&el!==placeholder).map(el=>el.dataset.fieldId);const anchor=ids.findIndex(id=>id===placeholder?.previousElementSibling?.dataset?.fieldId);let pos=order.length;if(anchor>=0){const ai=order.indexOf(ids[anchor]);if(ai>=0)pos=ai+1;}else if(placeholder?.nextElementSibling?.dataset?.fieldId){const ai=order.indexOf(placeholder.nextElementSibling.dataset.fieldId);if(ai>=0)pos=ai;}order.splice(Math.max(0,pos),0,fid);target.fieldIds=[...new Set(order)];target.fieldColumns=O(target.fieldColumns);target.fieldColumns[fid]=col;uniqueFields();cleanup();render();};
  const returnFieldToPalette=()=>{if(!drag||drag.type!=='field'||!fieldById.has(drag.id))return false;removeFieldFromAll(drag.id);cleanup();render();return true;};
  const renderPalette=()=>{palette.innerHTML='';const set=assigned();const count=m.querySelector('.cs-palette-count');if(count)count.textContent=String(custom.length);if(!custom.length){palette.innerHTML='<div class="cs-empty">Nenhum campo personalizado foi criado pelo mestre.</div>';return;}custom.forEach(f=>{const item=document.createElement('div');item.className='cs-palette-item';item.dataset.fieldId=f.id;item.innerHTML=`<span class="cs-drag">⠿</span><div><strong>${esc(f.label)}</strong>${f.description?`<small>${esc(f.description)}</small>`:''}</div>`;if(set.has(f.id)){item.classList.add('is-assigned');const mark=document.createElement('small');mark.className='cs-palette-assigned';mark.textContent='Já alocado';item.querySelector('div').appendChild(mark);}palette.appendChild(item);});};
  const fieldCard=(sec,fid)=>{const f=fieldById.get(fid)||baseFieldsForSection(sec).find(x=>x.id===fid);if(!f)return null;const el=document.createElement('div');el.className='cs-layout-field';el.dataset.fieldId=fid;el.dataset.sectionId=sec.id;el.innerHTML=`<span class="cs-field-drag-handle cs-drag" title="Segure para arrastar">⠿</span><div><strong>${esc(f.label)}</strong>${f.description?`<small>${esc(f.description)}</small>`:''}</div>`;return el;};
  function render(){uniqueFields();draft.sections.forEach(ensureSectionFields);list.innerHTML='';draft.sections.forEach(sec=>{const colsCount=Math.max(1,Math.min(4,Number(sec.columns)||1)),wrap=document.createElement('section');wrap.className='cs-layout-section';wrap.dataset.id=sec.id;const removable=String(sec.id).startsWith('customGroup_');wrap.innerHTML=`<div class="cs-layout-section-head"><span class="cs-section-drag-handle cs-drag" title="Segure para arrastar a sessão">☷</span><input class="cs-section-title" value="${esc(sec.label||'Nova seção')}"><div class="cs-section-tools"><span>Colunas</span><button type="button" data-minus>−</button><strong class="cs-col-value">${colsCount}</strong><button type="button" data-plus>+</button>${removable?'<button type="button" class="cs-delete-section" title="Excluir sessão">×</button>':''}</div></div><div class="cs-layout-columns"></div>`;wrap.querySelector('.cs-section-title').oninput=e=>sec.label=e.target.value;wrap.querySelector('[data-minus]').onclick=()=>{sec.columns=Math.max(1,colsCount-1);Object.keys(O(sec.fieldColumns)).forEach(fid=>{sec.fieldColumns[fid]=Math.min(Number(sec.fieldColumns[fid])||1,sec.columns)});render();};wrap.querySelector('[data-plus]').onclick=()=>{sec.columns=Math.min(4,colsCount+1);render();};wrap.querySelector('.cs-delete-section')?.addEventListener('click',()=>{if(confirm(`Excluir a sessão "${sec.label||'Nova seção'}"? Os campos criados voltarão para o menu.`)){draft.sections=draft.sections.filter(x=>x.id!==sec.id);render();}});const cols=wrap.querySelector('.cs-layout-columns');cols.style.setProperty('--editor-cols',colsCount);for(let c=1;c<=colsCount;c++){const col=document.createElement('div');col.className='cs-layout-column';col.dataset.column=String(c);col.innerHTML=`<div class="cs-column-label">coluna ${c}</div><div class="cs-layout-fields"></div>`;cols.appendChild(col);}A(sec.fieldIds).forEach(fid=>{const el=fieldCard(sec,fid);if(!el)return;const c=Math.min(Math.max(1,Number(O(sec.fieldColumns)[fid])||1),colsCount);wrap.querySelector(`.cs-layout-column[data-column="${c}"] .cs-layout-fields`).appendChild(el);});list.appendChild(wrap);});const add=document.createElement('button');add.type='button';add.className='cs-create-section';add.textContent='+ CRIAR SESSÃO';add.onclick=()=>{draft.sections.push({id:`customGroup_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,label:'Nova seção',columns:1,visible:true,order:draft.sections.length,fieldIds:[],fieldColumns:{}});render();};list.appendChild(add);renderPalette();}
  render();
  m.querySelector('.cs-palette-toggle').onclick=()=>{const collapsed=paletteBox.classList.toggle('is-collapsed');m.querySelector('.cs-palette-toggle').textContent=collapsed?'+':'−';m.querySelector('.cs-palette-help').hidden=collapsed;palette.hidden=collapsed;};
  const startPress=(e,el,type)=>{if(e.button!==undefined&&e.button!==0)return;if(type==='section'&&e.target.closest('input,button'))return;if(type==='field'&&e.target.closest('button,input,textarea,select'))return;if(type==='palette-field'&&el.classList.contains('is-assigned'))return;const sx=e.clientX,sy=e.clientY,pointerId=e.pointerId;let moved=false;pressState={el,type,pointerId};pressTimer=setTimeout(()=>{if(!pressState||pressState.el!==el)return;drag?null:(type==='section'?beginSection(el):type==='field'?beginField(el):beginPalette(el));},450);const move=ev=>{if(!pressState||ev.pointerId!==pointerId)return;const dist=Math.hypot(ev.clientX-sx,ev.clientY-sy);if(!drag&&dist>10){moved=true;clearTimeout(pressTimer);pressTimer=null;document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);pressState=null;return;}if(!drag)return;ev.preventDefault();autoScroll(ev.clientY);if(type==='section')moveSectionPlaceholder(ev.clientY);else{const overPalette=paletteBox.contains(document.elementFromPoint(ev.clientX,ev.clientY));if(type==='field'&&overPalette){if(!placeholder?.classList.contains('cs-palette-return-placeholder')){placeholder?.remove();placeholder=document.createElement('div');placeholder.className='cs-drop-placeholder cs-palette-return-placeholder';placeholder.textContent='Solte aqui para devolver ao menu';placeholder.style.height='42px';palette.appendChild(placeholder);}return;}if(type==='field'&&placeholder?.classList.contains('cs-palette-return-placeholder')){placeholder.remove();placeholder=makePlaceholder('cs-field-placeholder',drag.el.offsetHeight);const origin=sectionEl(drag.from);origin?.querySelector('.cs-layout-fields')?.appendChild(placeholder);}const under=document.elementFromPoint(ev.clientX,ev.clientY)?.closest('.cs-layout-fields');if(under)moveFieldPlaceholder(under.closest('.cs-layout-section'),ev.clientX,ev.clientY);else if(type==='palette-field'){const underSection=document.elementFromPoint(ev.clientX,ev.clientY)?.closest('.cs-layout-section');if(underSection){if(!placeholder||!placeholder.classList.contains('cs-field-placeholder')){placeholder=makePlaceholder('cs-field-placeholder',42);}if(!placeholder.parentElement)underSection.querySelector('.cs-layout-fields')?.appendChild(placeholder);moveFieldPlaceholder(underSection,ev.clientX,ev.clientY);}}}};
  const up=ev=>{if(!pressState||ev.pointerId!==pointerId)return;clearTimeout(pressTimer);pressTimer=null;document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);const wasDrag=!!drag;pressState=null;if(!wasDrag)return;if(type==='section')finishSection();else if(type==='palette-field')dropPaletteToSession();else if(placeholder?.classList.contains('cs-palette-return-placeholder'))returnFieldToPalette();else finishField();};
  document.addEventListener('pointermove',move,{passive:false});document.addEventListener('pointerup',up,{once:true});document.addEventListener('pointercancel',up,{once:true});};
  m.addEventListener('pointerdown',e=>{const field=e.target.closest('.cs-layout-field'),sectionHandle=e.target.closest('.cs-section-drag-handle'),paletteItem=e.target.closest('.cs-palette-item');if(field&&e.target.closest('.cs-field-drag-handle'))return startPress(e,field,'field');if(sectionHandle){const sec=sectionHandle.closest('.cs-layout-section');if(sec)return startPress(e,sec,'section');}if(paletteItem)return startPress(e,paletteItem,'palette-field');});
  m.querySelector('.cs-close').onclick=()=>m.remove();m.querySelector('.cs-cancel').onclick=()=>m.remove();m.querySelector('.cs-layout-save').onclick=async()=>{uniqueFields();draft.sections=draft.sections.map((sec,i)=>({...sec,order:i,columns:Math.max(1,Math.min(4,Number(sec.columns)||1)),fieldIds:[...new Set(A(sec.fieldIds))],fieldColumns:Object.fromEntries(Object.entries(O(sec.fieldColumns)).filter(([fid,col])=>sec.fieldIds.includes(fid)&&Number(col)>=1&&Number(col)<=Math.max(1,Number(sec.columns)||1)))}));draft.customGroups=draft.sections.filter(x=>String(x.id).startsWith('customGroup_'));try{await updateDoc(doc(db,'tables',S.tableId),{'configuration.characterSheetLayout':draft,updatedAt:serverTimestamp()});S.layout=layoutOf(draft);toast('Layout salvo.','success');m.remove();rerenderMasterSheet();}catch(e){console.error(e);toast('Não foi possível salvar o layout.','error');}};
}
function statusText(s){return ({draft:"Rascunho",pending:"Pendente de aprovação",approved:"Aprovada",rejected:"Devolvida para edição",dead:"Personagem morto"})[s]||"Rascunho";}
async function createNewCharacter(){
  if(S.isMaster||!S.user)return;
  const chars=playerCharacters();
  if(chars.some(c=>!characterIsDead(c))){toast("Você já possui um personagem vivo nesta mesa.","error");return;}
  const characterId=uid("character");
  const c=fresh(S.user.uid,characterId);
  c.ownerUid=S.user.uid;
  c.uid=S.user.uid;
  c.characterId=characterId;
  c.tableId=S.tableId;
  c.status="draft";
  c.alive=true;
  c.editingAllowed=true;
  c.createdAt=serverTimestamp();
  c.updatedAt=serverTimestamp();
  try{
    await setDoc(doc(db,"tables",S.tableId,"characters",characterId),c,{merge:true});
    // Mantém a instância local sem transformar a ficha morta anterior em ficha atual.
    S.characters.set(characterId,normalize(c,S.user.uid,characterId));
    S.selectedId=characterId;
    S.character=S.characters.get(characterId);
    S.editing=true;
    toast("Nova ficha criada. Preencha e envie para aprovação.","success");
    renderCharacter();
  }catch(e){
    console.error(e);
    toast("Não foi possível criar a nova ficha.","error");
  }
}
function playerPicker(root){
  const p=root.querySelector(".cs-picker");if(!p)return;
  const chars=playerCharacters().sort((a,b)=>{const ad=a.createdAt?.toMillis?a.createdAt.toMillis():Number(a.createdAt)||0;const bd=b.createdAt?.toMillis?b.createdAt.toMillis():Number(b.createdAt)||0;return ad-bd||String(a.characterId).localeCompare(String(b.characterId));});
  const alive=chars.filter(c=>!characterIsDead(c)), dead=chars.filter(characterIsDead);
  p.innerHTML=`<div class="cs-picker-title"><strong>Meus personagens</strong><span>${chars.length}</span></div>`;
  const section=(title,list,cls)=>{if(!list.length)return;const h=document.createElement("div");h.className=`cs-picker-section-title ${cls||""}`;h.textContent=title;p.appendChild(h);list.forEach(c=>{const b=document.createElement("button");b.type="button";b.className=`cs-player ${S.selectedId===c.characterId?"selected":""}`;b.innerHTML=`<span><strong>${esc(c.profile?.name||"Sem nome")}</strong><small>${esc(statusText(c.status||"draft"))}${characterIsDead(c)?" · Registro histórico":" · Vivo"}</small></span>`;b.onclick=()=>{S.selectedId=c.characterId;S.character=c;S.editing=false;renderCharacter();};p.appendChild(b);});};
  section("Personagem atual",alive,"cs-alive-section");
  section("Cemitério",dead,"cs-dead-section");
  if(!alive.length){const b=document.createElement("button");b.type="button";b.className="cs-primary cs-new-character";b.textContent="+ Criar nova ficha";b.onclick=createNewCharacter;p.appendChild(b);}
}

function masterPicker(root){
  const p=root.querySelector(".cs-picker");if(!p)return;
  const all=[...S.characters.values()].sort((a,b)=>{const ad=a.createdAt?.toMillis?a.createdAt.toMillis():Number(a.createdAt)||0;const bd=b.createdAt?.toMillis?b.createdAt.toMillis():Number(b.createdAt)||0;return ad-bd||String(a.characterId).localeCompare(String(b.characterId));});
  const alive=all.filter(c=>!characterIsDead(c)),dead=all.filter(characterIsDead);
  p.innerHTML=`<div class="cs-picker-title"><strong>Personagens</strong><span>${all.length}</span></div>`;
  const renderGroup=(title,list,cls)=>{if(!list.length)return;const h=document.createElement("div");h.className=`cs-picker-section-title ${cls||""}`;h.textContent=title;p.appendChild(h);list.forEach(c=>{const mem=S.members.find(m=>m.uid===(c.ownerUid||c.uid));const b=document.createElement("button");b.type="button";b.className=`cs-player ${S.selectedId===c.characterId?"selected":""}`;b.innerHTML=`<span><strong>${esc(c.profile?.name||"Sem nome")}</strong><small>${esc(mem?.username||mem?.displayName||"Player")} · ${esc(statusText(c.status||"draft"))}${characterIsDead(c)?" · Registro histórico":" · Vivo"}</small></span>`;b.onclick=()=>openMasterSheet(c.characterId||c.uid);p.appendChild(b);});};
  renderGroup("Personagens vivos",alive,"cs-alive-section");
  renderGroup("Cemitério",dead,"cs-dead-section");
  S.members.filter(x=>x.uid!==S.table.ownerId).forEach(mem=>{if(![...S.characters.values()].some(c=>(c.ownerUid||c.uid)===mem.uid)){const b=document.createElement("button");b.type="button";b.className="cs-player";b.innerHTML=`<span><strong>Ficha não preenchida</strong><small>${esc(mem.username||mem.displayName||"Player")}</small></span>`;b.onclick=()=>openMasterSheet(mem.uid);p.appendChild(b);}});
  const npcTitle=document.createElement("div");npcTitle.className="cs-picker-section-title cs-npc-section";npcTitle.innerHTML=`${I("npc")} NPCs (${npcCharacters().length})`;p.appendChild(npcTitle);
  const npcAlive=npcCharacters().filter(c=>!npcIsDead(c)),npcDead=npcCharacters().filter(npcIsDead);
  npcAlive.forEach(c=>{const b=document.createElement("button");b.type="button";b.className=`cs-player cs-npc-player ${S.selectedNpcId===c.npcId?"selected":""}`;b.innerHTML=`<span><strong>${I("npc")} ${esc(c.profile?.name||"Sem nome")}</strong><small>${S.activeMasterNpcId===c.npcId?"✓ Em uso nas rolagens":"NPC · Vivo"}</small></span>`;b.onclick=()=>openMasterNpcSheet(c.npcId);p.appendChild(b);});
  npcDead.forEach(c=>{const b=document.createElement("button");b.type="button";b.className=`cs-player cs-npc-player ${S.selectedNpcId===c.npcId?"selected":""}`;b.innerHTML=`<span><strong>${I("skull")} ${esc(c.profile?.name||"Sem nome")}</strong><small>NPC · Cemitério</small></span>`;b.onclick=()=>openMasterNpcSheet(c.npcId);p.appendChild(b);});
  const npcAdd=document.createElement("button");npcAdd.type="button";npcAdd.className="cs-secondary cs-new-character";npcAdd.innerHTML=`${I("plus")} Criar ficha de NPC`;npcAdd.onclick=createNpc;p.appendChild(npcAdd);
  const layout=document.createElement("button");layout.type="button";layout.className="cs-primary cs-layout-main";layout.innerHTML=`${I("gear")} Configurar layout`;layout.onclick=openLayout;p.appendChild(layout);
}

function openMasterSheet(uidValue){S.selectedId=uidValue;S.character=S.characters.get(uidValue)||fresh(uidValue,uidValue);S.editing=false;const m=document.createElement("div");m.className="cs-master-fullscreen";m.innerHTML=`<div class="cs-master-sheet"><header><button class="cs-close">×</button><div><strong>${esc(S.character.profile?.name||"Ficha")}</strong><small>${esc(statusText(S.character.status))}</small></div></header><main class="cs-content"></main></div>`;document.body.appendChild(m);m.querySelector(".cs-close").onclick=()=>m.remove();renderCharacter(m);}
function openMasterNpcSheet(npcId,editing=false){S.selectedNpcId=npcId;S.character=S.npcs.get(npcId)||npcFresh(npcId);S.editing=!!editing;const m=document.createElement("div");m.className="cs-master-fullscreen cs-npc-fullscreen";m.innerHTML=`<div class="cs-master-sheet"><header><button class="cs-close">×</button><div><strong>${I("npc")} ${esc(S.character.profile?.name||"Novo NPC")}</strong><small>NPC · ${npcIsDead(S.character)?"Cemitério":"Ficha do mestre"}</small></div></header><main class="cs-content"></main></div>`;document.body.appendChild(m);m.querySelector(".cs-close").onclick=()=>m.remove();renderCharacter(m,true);}


function renderCharacter(rootOverride=null,npcOverride=false){
  const root=rootOverride||document.querySelector(".character-sheet-view");if(!root)return;const content=root.querySelector(".cs-content");
  if(!S.character){content.innerHTML=`<div class="cs-empty cs-big">${S.isMaster?"Nenhuma ficha enviada ainda.":"Selecione um personagem ou crie um novo."}</div>`;if(S.isMaster&&!rootOverride)masterPicker(root);else if(!S.isMaster)playerPicker(root);return;}
  if(S.isMaster&&!rootOverride){content.innerHTML=`<div class="cs-master-list-empty"><h2>Fichas dos personagens</h2><p>Clique em uma ficha na lista para abrir em tela cheia.</p></div>`;masterPicker(root);return;}
  const c=S.character;if(npcOverride){const edit=S.editing||!S.npcs.has(S.selectedNpcId);content.innerHTML=`<div class="cs-character-name-banner cs-character-top-name">${I("npc")} ${esc(c.profile?.name||"Novo NPC")}</div><div class="cs-status"><div><strong>${npcIsDead(c)?`${I("skull")} NPC no cemitério`:"NPC do mestre"}</strong><small>${S.activeMasterNpcId===S.selectedNpcId?"Esta ficha está sendo usada nas rolagens do mestre.":"Esta ficha está separada das fichas dos players."}</small></div><span>${edit?"Modo edição":"Somente visualização"}</span></div><div class="cs-actions"></div>`;const actions=content.querySelector(".cs-actions");actions.innerHTML=`${S.activeMasterNpcId===S.selectedNpcId?`<button class="cs-secondary" data-npc-use-off>${I("stop")} Parar de usar</button>`:(!npcIsDead(c)?`<button class="cs-primary cs-npc-use-button" data-npc-use><span class="cs-action-icon">${I("masks",22)}</span><span>Usar esta ficha</span></button>`:"")}${!edit&&!npcIsDead(c)?`<button class="cs-secondary" data-npc-edit>${I("edit")} Editar ficha</button>`:""}${edit?`<button class="cs-primary" data-npc-save>${I("save")} Salvar NPC</button>`:""}${!npcIsDead(c)?`<button class="cs-danger" data-npc-dead>${I("skull")} Enviar para o cemitério</button>`:`<button class="cs-secondary" data-npc-alive>${I("undo")} Restaurar NPC</button>`}<button class="cs-danger" data-npc-delete>${I("trash")} Excluir NPC</button>`;actions.querySelector("[data-npc-use]")?.addEventListener("click",()=>setActiveMasterNpc(S.selectedNpcId));actions.querySelector("[data-npc-use-off]")?.addEventListener("click",()=>setActiveMasterNpc(null));actions.querySelector("[data-npc-edit]")?.addEventListener("click",()=>{S.editing=true;renderCharacter(rootOverride,true)});actions.querySelector("[data-npc-save]")?.addEventListener("click",saveNpc);actions.querySelector("[data-npc-dead]")?.addEventListener("click",()=>toggleNpcDeath(true));actions.querySelector("[data-npc-alive]")?.addEventListener("click",()=>toggleNpcDeath(false));actions.querySelector("[data-npc-delete]")?.addEventListener("click",deleteNpc);for(const sec of S.layout.sections.filter(x=>x.visible!==false)){const el=renderSection(sec,c,edit);if(el)content.appendChild(el);}return;}
  const playerCanEdit=!S.isMaster&&(c.editingAllowed!==false&&["draft","rejected","approved"].includes(c.status||"draft"));const masterCanEdit=S.isMaster&&c.status==="approved"&&S.editing;const edit=S.isMaster?masterCanEdit:playerCanEdit;
  content.innerHTML=`<div class="cs-character-name-banner cs-character-top-name">${esc(c.profile?.name||"Sem nome")}</div><div class="cs-status"><div><strong>${esc(statusText(c.status))}</strong>${c.status==="dead"?`<small>Esta ficha permanece disponível apenas para consulta. Um novo personagem deve usar uma nova ficha.</small>`:(c.rejectionReason?`<small>${esc(c.rejectionReason)}</small>`:"")}</div><span>${c.status==="dead"?"Registro histórico":(edit?"Modo edição":"Somente visualização")}</span></div><div class="cs-actions"></div>`;
  const actions=content.querySelector(".cs-actions");
  if(S.isMaster){
    actions.innerHTML=`${c.status==="pending"?`<button class="cs-primary" data-a="approve">${I("check")} Aprovar</button><button class="cs-danger" data-a="reject">${I("undo")} Devolver</button>`:""}${c.status==="approved"&&!c.editingAllowed?`<button class="cs-secondary" data-a="unlock">Liberar para o player</button>`:""}${c.status==="approved"&&c.editingAllowed?`<button class="cs-secondary" data-a="lock">Bloquear player</button>`:""}${c.status==="approved"&&!S.editing&&c.status!=="dead"?`<button class="cs-secondary" data-a="edit">Editar ficha</button>`:""}${c.status==="approved"&&S.editing?`<button class="cs-primary" data-save-master>${I("save")} Salvar ficha</button>`:""}`;
    actions.querySelector('[data-a="approve"]')?.addEventListener("click",()=>decide("approve"));actions.querySelector('[data-a="reject"]')?.addEventListener("click",()=>decide("reject"));actions.querySelector('[data-a="unlock"]')?.addEventListener("click",()=>decide("unlock"));actions.querySelector('[data-a="lock"]')?.addEventListener("click",()=>decide("lock"));actions.querySelector('[data-a="edit"]')?.addEventListener("click",()=>{S.editing=true;rerenderMasterSheet();});actions.querySelector('[data-save-master]')?.addEventListener("click",masterSave);
  }else{
    actions.innerHTML=(edit&&c.status!=="pending"&&c.status!=="approved"?'<span class="cs-player-help">Preencha a ficha e, quando terminar, envie para aprovação.</span>':"");
  }
  for(const sec of S.layout.sections.filter(x=>x.visible!==false)){const el=renderSection(sec,c,edit);if(el)content.appendChild(el);}
  if(!S.isMaster && ((c.status==="draft"||c.status==="rejected") || (c.status==="approved"&&c.editingAllowed===true)) && edit){const bottom=document.createElement("div");bottom.className="cs-submit-area";bottom.innerHTML=`<p>Quando terminar, envie a ficha para o mestre analisar.</p><button class="cs-primary cs-submit">Enviar para aprovação</button>`;bottom.querySelector(".cs-submit").onclick=submit;content.appendChild(bottom);}
  if(!S.isMaster&&c.status==="approved"&&c.editingAllowed===false){const n=document.createElement("div");n.className="cs-note";n.textContent="Ficha aprovada e bloqueada. O mestre precisa liberar a edição.";content.appendChild(n);}
  if(S.isMaster && !rootOverride)masterPicker(root);else if(!S.isMaster)playerPicker(root);
}

async function load(){
  S.members=[];
  S.characters.clear();
  S.npcs.clear();
  S.selectedId=null;
  S.selectedNpcId=null;
  S.activeMasterNpcId=null;
  S.character=null;
  S.editing=false;
  const t=await getDoc(doc(db,"tables",S.tableId));if(!t.exists())throw Error("Mesa não encontrada.");S.table={id:t.id,...t.data()};if(!A(S.table.members).includes(S.user.uid))throw Error("Você não faz parte desta mesa.");S.isMaster=S.table.ownerId===S.user.uid;S.config=configOf(S.table);S.layout=S.config.layout;S.activeMasterNpcId=S.table.activeMasterNpcId||null;
  if(S.isMaster){for(const memberUid of [...new Set(A(S.table.members))]){const u=await getDoc(doc(db,"users",memberUid));if(u.exists())S.members.push({uid:memberUid,...u.data()});}const cs=await getDocs(collection(db,"tables",S.tableId,"characters"));cs.forEach(x=>S.characters.set(x.id,normalize(x.data(),x.id)));const ns=await getDocs(collection(db,"tables",S.tableId,"npcs"));ns.forEach(x=>{const raw=x.data()||{};S.npcs.set(x.id,normalize(raw,S.user.uid,x.id));});S.selectedId=[...S.characters.keys()].find(x=>x!==S.table.ownerId)||null;S.character=S.selectedId?S.characters.get(S.selectedId):null;}
  else{const cs=await getDocs(collection(db,"tables",S.tableId,"characters"));cs.forEach(x=>{const raw=x.data()||{};const owner=raw.ownerUid||raw.uid;if(owner===S.user.uid)S.characters.set(x.id,normalize(raw,S.user.uid,x.id));});const chars=playerCharacters();const alive=chars.find(c=>!characterIsDead(c));S.selectedId=alive?.characterId||null;S.character=alive||null;S.editing=false;}
}
function styles(){if(document.getElementById("character-sheet-styles"))return;const s=document.createElement("style");s.id="character-sheet-styles";s.textContent=`
.character-sheet-view{width:100%;min-height:100%;padding:1rem;color:var(--text-primary)}.cs-inner{max-width:1180px;margin:auto}.cs-top{display:flex;align-items:center;gap:.8rem;margin-bottom:1rem}.cs-back{width:42px;height:42px;border:1px solid var(--border-color);border-radius:50%;background:var(--bg-card);color:var(--text-primary);font-size:1.4rem;cursor:pointer}.cs-title h1{margin:0;color:var(--accent-purple);font-size:2rem}.cs-title p{margin:.25rem 0;color:var(--text-secondary)}.cs-layout{display:grid;grid-template-columns:250px minmax(0,1fr);gap:1rem}.cs-picker{background:var(--bg-card);border:1px solid var(--border-color);border-radius:14px;padding:.7rem;align-self:start;position:sticky;top:1rem}.cs-picker-title{display:flex;justify-content:space-between;padding:.5rem;border-bottom:1px solid var(--border-color);margin-bottom:.4rem}.cs-picker-title span{color:var(--accent-purple);font-weight:800}.cs-player{display:flex;width:100%;gap:.6rem;align-items:center;border:0;border-radius:10px;background:transparent;color:var(--text-primary);padding:.6rem;text-align:left;cursor:pointer}.cs-player:hover,.cs-player.selected{background:var(--bg-secondary)}.cs-picker-section-title{font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;font-weight:900;color:var(--text-secondary);padding:.7rem .55rem .3rem;border-top:1px solid var(--border-color);margin-top:.35rem}.cs-picker-section-title.cs-dead-section{color:#b66}.cs-new-character{width:100%;margin-top:.7rem}.cs-player span:last-child{min-width:0;display:flex;flex-direction:column}.cs-player small{color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cs-status,.cs-note{display:flex;justify-content:space-between;gap:1rem;padding:.8rem 1rem;background:var(--bg-card);border:1px solid var(--border-color);border-radius:12px;margin-bottom:.8rem}.cs-status small{display:block;color:var(--text-secondary);margin-top:.2rem}.cs-actions{display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:1rem}.cs-actions>button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.28rem;text-align:center}.cs-actions>button>.cs-icon,.cs-actions>button>.cs-action-icon .cs-icon{width:24px!important;height:24px!important;min-width:24px;min-height:24px;display:block;flex:0 0 24px}.cs-action-icon{width:24px;height:24px;display:flex;align-items:center;justify-content:center}.cs-player-help{color:var(--text-secondary);font-size:.88rem}.cs-npc-use-button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.2rem;line-height:1.1}.cs-npc-use-button .cs-action-icon{display:flex;align-items:center;justify-content:center}.cs-npc-use-button .cs-icon{width:24px;height:24px}.cs-primary,.cs-secondary,.cs-danger{min-height:40px;padding:.6rem .85rem;border-radius:9px;font-weight:800;cursor:pointer}.cs-primary{background:var(--accent-purple);border:1px solid var(--accent-purple);color:#fff}.cs-secondary{background:var(--bg-card);border:1px solid var(--border-color);color:var(--text-primary)}.cs-danger{background:var(--bg-card);border:1px solid var(--accent-red);color:var(--accent-red)}.cs-section{background:var(--bg-card);border:1px solid var(--border-color);border-radius:14px;margin-bottom:1rem;overflow:visible;box-shadow:0 4px 18px rgba(0,0,0,.06)}.cs-section-header{padding:1rem;background:var(--bg-secondary);border-radius:13px 13px 0 0}.cs-section-header h2{margin:0;font-size:1.1rem}.cs-section-body{padding:1rem}.cs-grid{display:grid;grid-template-columns:repeat(var(--cols,1),minmax(0,1fr));gap:.75rem}.cs-card{padding:.85rem;border:1px solid var(--border-color);border-radius:11px;background:var(--bg-secondary);min-width:0}.cs-item-title{display:flex;justify-content:space-between;gap:.5rem;margin-bottom:.6rem}.cs-item-title small{color:var(--accent-purple);font-weight:800}.cs-desc{color:var(--text-secondary);font-size:.84rem;margin-bottom:.6rem;white-space:pre-wrap}.cs-field{display:flex;flex-direction:column;gap:.3rem;margin-top:.6rem}.cs-field label{font-size:.78rem;color:var(--text-secondary);font-weight:700}.cs-input{width:100%;box-sizing:border-box;min-height:40px;padding:.6rem .7rem;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-card);color:var(--text-primary);outline:none}.cs-input:focus{border-color:var(--accent-purple)}.cs-input.cs-invalid{border-color:var(--accent-red)}textarea.cs-input{resize:vertical}.cs-static{min-height:40px;box-sizing:border-box;padding:.6rem .7rem;background:var(--bg-card);border-radius:8px;white-space:pre-wrap;overflow-wrap:anywhere}.cs-formula-result{color:var(--accent-purple);font-weight:800}.cs-limit,.cs-hint,.cs-formula{color:var(--text-secondary);font-size:.78rem}.cs-limit{color:var(--accent-purple);font-weight:700}.cs-identity{display:grid;grid-template-columns:100px minmax(0,1fr);gap:1rem}.cs-identity-fields{display:grid;gap:.7rem}.cs-switch-row{display:flex;justify-content:space-between;align-items:center;gap:.8rem;cursor:pointer;color:var(--text-secondary);font-weight:700}.cs-switch{position:relative;width:48px;height:28px;display:inline-block;flex:0 0 auto}.cs-switch input{opacity:0;width:0;height:0}.cs-switch i{position:absolute;inset:0;background:#777;border-radius:999px;transition:.18s}.cs-switch i:before{content:"";position:absolute;width:20px;height:20px;left:4px;top:4px;border-radius:50%;background:#fff;transition:.18s}.cs-switch input:checked+i{background:var(--accent-purple)}.cs-switch input:checked+i:before{transform:translateX(20px)}.cs-toolbar{display:flex;justify-content:space-between;gap:.6rem;margin-bottom:.7rem}.cs-equip-list{display:grid;gap:.7rem}.cs-equipment-card{display:grid;grid-template-columns:1fr 1fr;gap:.55rem}.cs-equipment-card .cs-description-field{grid-column:1/-1}.cs-equipment-card .cs-remove{grid-column:1/-1}.cs-slot-load{display:flex;align-items:center;gap:.7rem}.cs-check{display:flex;align-items:center;gap:.35rem;white-space:nowrap;color:var(--text-secondary);font-size:.8rem}.cs-meta{color:var(--text-secondary);font-size:.82rem}.cs-empty{text-align:center;color:var(--text-secondary);padding:1rem}.cs-big{padding:4rem 1rem;background:var(--bg-card);border:1px solid var(--border-color);border-radius:14px}.cs-note{color:var(--text-secondary)}.cs-submit-area{margin:1.5rem 0 2rem;padding:1.25rem;text-align:center;background:var(--bg-card);border:1px solid var(--border-color);border-radius:14px}.cs-submit-area p{margin:0 0 .8rem;color:var(--text-secondary)}.cs-toast{position:fixed;z-index:30000;left:50%;bottom:1.5rem;transform:translate(-50%,120px);padding:.85rem 1.1rem;border-radius:10px;background:var(--bg-card);border:1px solid var(--border-color);box-shadow:0 8px 30px rgba(0,0,0,.2);transition:.22s}.cs-toast.show{transform:translate(-50%,0)}.cs-toast.success{border-color:#48a868}.cs-toast.error{border-color:var(--accent-red)}.cs-modal-bg{position:fixed;inset:0;z-index:40000;display:grid;place-items:center;padding:1rem;background:rgba(0,0,0,.55)}.cs-modal{width:min(720px,100%);max-height:90vh;overflow:auto;background:var(--bg-card);border:1px solid var(--border-color);border-radius:16px}.cs-modal header,.cs-modal footer{display:flex;justify-content:space-between;gap:1rem;padding:1rem;border-bottom:1px solid var(--border-color)}.cs-modal footer{border-top:1px solid var(--border-color);border-bottom:0;justify-content:flex-end}.cs-modal h2{margin:0}.cs-modal p{margin:.2rem 0;color:var(--text-secondary);font-size:.84rem}.cs-close{border:0;background:transparent;color:var(--text-primary);font-size:1.5rem}.cs-layout-list{padding:1rem;display:grid;gap:.5rem}.cs-layout-row{display:grid;grid-template-columns:28px 1fr auto auto;align-items:center;gap:.6rem;padding:.7rem;border:1px solid var(--border-color);border-radius:10px;background:var(--bg-secondary);cursor:grab}.cs-layout-row.drag{opacity:.4}.cs-layout-row select{display:none}@media(max-width:850px){.cs-layout{grid-template-columns:1fr}.cs-picker{position:static}}@media(max-width:600px){.character-sheet-view{padding:.6rem}.cs-title h1{font-size:1.55rem}.cs-identity{grid-template-columns:1fr}.cs-equipment-card{grid-template-columns:1fr}.cs-equipment-card .cs-description-field,.cs-equipment-card .cs-remove{grid-column:auto}.cs-status{flex-direction:column}.cs-layout-row{grid-template-columns:28px 1fr}.cs-layout-row label{grid-column:2}}
.cs-character-name-banner{font-size:1.9rem;font-weight:900;color:var(--text-primary);padding:.2rem .2rem 1rem}.cs-title-actions{display:flex;align-items:center;gap:.45rem}.cs-help{width:24px;height:24px;border-radius:50%;border:1px solid var(--border-color);background:var(--bg-card);color:var(--accent-purple);font-weight:900;cursor:pointer}.cs-help-popover{position:fixed;z-index:50000;width:min(270px,calc(100vw - 16px));padding:.8rem;border-radius:12px;background:var(--bg-card);border:1px solid var(--border-color);box-shadow:0 10px 30px rgba(0,0,0,.25);color:var(--text-primary);font-size:.85rem;line-height:1.4}.cs-dropdown{position:relative;width:100%}.cs-dropdown-button{text-align:left;cursor:pointer}.cs-dropdown-menu{position:absolute;z-index:60000;left:0;right:0;top:calc(100% + 4px);background:var(--bg-card);border:1px solid var(--border-color);border-radius:12px;padding:.35rem;box-shadow:0 12px 30px rgba(0,0,0,.25);max-height:240px;overflow:auto}.cs-dropdown-menu[hidden]{display:none}.cs-dropdown-option{display:block;width:100%;padding:.7rem;border:0;background:transparent;color:var(--text-primary);text-align:left;border-radius:8px}.cs-dropdown-option:hover{background:var(--bg-secondary)}.cs-master-fullscreen{position:fixed;inset:0;z-index:45000;background:var(--bg-primary);overflow:auto}.cs-master-sheet{min-height:100%;max-width:980px;margin:auto;padding:0 0 2rem}.cs-master-sheet>header{position:sticky;top:0;z-index:100;display:flex;align-items:center;gap:1rem;padding:.75rem 1rem;background:var(--bg-primary)!important;background-image:none!important;opacity:1!important;border-bottom:1px solid var(--border-color);box-shadow:0 3px 14px rgba(0,0,0,.16);isolation:isolate}.cs-master-sheet .cs-content{position:relative;z-index:1}.cs-master-sheet .cs-content .cs-section-header{z-index:1;background:var(--bg-secondary)!important;background-image:none!important;opacity:1!important}.cs-master-sheet>header .cs-close{width:42px;height:42px;border-radius:50%;background:var(--bg-secondary);cursor:pointer}.cs-master-sheet>header div{display:flex;flex-direction:column}.cs-master-sheet>header small{color:var(--text-secondary)}.cs-master-sheet .cs-content{padding:1rem}.cs-layout-main{width:100%;margin-top:.8rem}.cs-drag{font-size:1.3rem;color:var(--text-secondary);touch-action:none}.cs-layout-row{min-height:54px;touch-action:none}.cs-layout-row .cs-dropdown{width:70px}.cs-layout-row .cs-dropdown-button{min-height:34px;padding:.35rem .5rem}.cs-layout-row .cs-switch-row{font-size:.75rem}.cs-toolbar{position:sticky;top:0;z-index:2;padding:.65rem;background:var(--bg-card);border-bottom:1px solid var(--border-color)}.cs-equip-list{padding-top:.2rem}.cs-equipment-card{background:var(--bg-card);box-shadow:0 2px 8px rgba(0,0,0,.06)}.cs-card{box-shadow:0 1px 5px rgba(0,0,0,.04)}.cs-input{min-height:46px;border-radius:12px;font-size:16px}.cs-section-header{position:sticky;top:0;z-index:1}.cs-player{min-height:58px}.cs-picker-title{position:sticky;top:0;background:var(--bg-card);z-index:1}@media(max-width:600px){.character-sheet-view{padding:.45rem}.cs-inner{width:100%}.cs-top{padding:.25rem .25rem .65rem}.cs-title h1{font-size:1.35rem}.cs-title p{font-size:.78rem}.cs-character-name-banner{font-size:1.55rem;padding:.15rem .15rem .8rem}.cs-section{border-radius:16px;margin-bottom:.75rem}.cs-section-header{padding:.85rem}.cs-section-body{padding:.75rem}.cs-card{padding:.75rem;border-radius:14px}.cs-field{margin-top:.5rem}.cs-actions{position:sticky;bottom:.5rem;z-index:20;padding:.5rem;background:color-mix(in srgb,var(--bg-card) 92%,transparent);border:1px solid var(--border-color);border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,.18)}.cs-actions button{flex:1;min-width:120px}.cs-toolbar{flex-direction:column;align-items:stretch}.cs-toolbar .cs-secondary{width:100%}.cs-equipment-card{display:flex;flex-direction:column}.cs-submit-area{margin:1rem 0}.cs-master-sheet .cs-content{padding:.65rem}.cs-master-sheet>header{padding:.6rem .7rem}.cs-modal-bg{padding:0;align-items:end}.cs-modal{width:100%;max-height:92vh;border-radius:18px 18px 0 0}.cs-layout-row{grid-template-columns:30px 1fr auto}.cs-layout-row .cs-switch-row{grid-column:2/-1;justify-content:flex-start}.cs-layout-list{padding:.75rem}}.cs-layout-group-tools{margin:.8rem 1rem;padding:.8rem;border:1px solid var(--border-color);border-radius:12px;display:grid;gap:.6rem}.cs-layout-group-tools small{color:var(--text-secondary)}.cs-field-assignments{display:grid;gap:.45rem}.cs-field-assign{display:grid;grid-template-columns:1fr 180px;gap:.5rem;align-items:center}.cs-field-assign .cs-input{min-height:38px}@media(max-width:600px){.cs-field-assign{grid-template-columns:1fr}.cs-field-assign .cs-dropdown{width:100%}}.cs-description-content{padding:1.2rem;white-space:pre-wrap;line-height:1.55;max-height:65vh;overflow:auto}.cs-parser-menu{position:fixed;z-index:70000;width:min(300px,calc(100vw - 16px));padding:.35rem;background:var(--bg-card);border:1px solid var(--border-color);border-radius:14px;box-shadow:0 14px 35px rgba(0,0,0,.3);display:grid;gap:.25rem}.cs-parser-menu button{display:flex;flex-direction:column;align-items:flex-start;padding:.65rem .75rem;border:0;border-radius:10px;background:transparent;color:var(--text-primary);text-align:left}.cs-parser-menu button:hover{background:var(--bg-secondary)}.cs-parser-menu small{color:var(--text-secondary);margin-top:.15rem}.cs-character-top-name{text-align:center;font-size:2rem;padding:.5rem .5rem 1rem}.cs-master-list-empty{padding:2rem;text-align:center;background:var(--bg-card);border:1px solid var(--border-color);border-radius:16px}.cs-layout-editor{display:flex;flex-direction:column;max-height:calc(100vh - 1rem);height:min(92vh,900px)}.cs-layout-editor .cs-layout-list{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain}.cs-layout-editor .cs-layout-group-tools{flex:0 0 auto;max-height:35vh;overflow:auto}.cs-layout-editor footer{flex:0 0 auto}.cs-layout-row{transition:transform .18s ease,box-shadow .18s ease,opacity .18s ease}.cs-layout-row.is-dragging{opacity:.55;transform:scale(1.03);box-shadow:0 12px 30px rgba(0,0,0,.2)}.cs-drop-placeholder{border:2px dashed var(--accent-purple);border-radius:12px;background:color-mix(in srgb,var(--accent-purple) 10%,transparent);transition:height .18s ease,margin .18s ease}.cs-layout-dragging *{cursor:grabbing!important}.cs-fraction-toggle{display:flex;align-items:center;gap:.7rem;padding:.75rem;border:1px solid var(--border-color);border-radius:12px;background:var(--bg-secondary);cursor:pointer;font-weight:800}.cs-fraction-toggle input{display:none}.cs-fraction-toggle .cs-toggle-track{width:48px;height:28px;border-radius:99px;background:#777;position:relative;flex:0 0 auto;transition:.18s}.cs-fraction-toggle .cs-toggle-track i{position:absolute;width:20px;height:20px;top:4px;left:4px;border-radius:50%;background:#fff;transition:.18s}.cs-fraction-toggle input:checked+.cs-toggle-track{background:var(--accent-purple)}.cs-fraction-toggle input:checked+.cs-toggle-track i{transform:translateX(20px)}.cs-fraction-wrap{margin-top:.5rem}.cs-fraction-wrap[hidden]{display:none!important}.cs-modal-bg{background:rgba(0,0,0,.62)!important;z-index:40000}.cs-modal,.cs-dropdown-menu,.cs-parser-menu{background-color:var(--bg-secondary,#ffffff)!important;background-image:none!important;opacity:1!important;isolation:isolate}.cs-modal{box-shadow:0 18px 50px rgba(0,0,0,.35)}.cs-dropdown{position:relative;z-index:10}.cs-dropdown-menu{z-index:70001!important;color:var(--text-primary)}.cs-dropdown-option{background:transparent;color:var(--text-primary);width:100%;border:0;text-align:left;padding:.7rem .75rem;border-radius:9px}.cs-dropdown-option:hover{background:var(--bg-card)}.cs-parser-menu{z-index:70002!important}.cs-parser-menu button{background:var(--bg-secondary)!important;color:var(--text-primary)!important}.cs-parser-menu button:hover{background:var(--bg-card)!important}.cs-description-dialog{overflow:hidden}.cs-description-content{background:var(--bg-secondary,#fff);color:var(--text-primary);border-top:1px solid var(--border-color)}.cs-layout-editor{width:min(760px,100%);height:min(94dvh,900px)!important;max-height:94dvh!important;overflow:hidden!important}.cs-layout-editor>header{position:sticky;top:0;z-index:4;background:var(--bg-secondary,#fff);flex:0 0 auto}.cs-layout-editor .cs-layout-list{background:var(--bg-card);padding:.75rem;overflow-y:auto!important;overflow-x:hidden!important;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}.cs-layout-editor .cs-layout-group-tools{background:var(--bg-secondary,#fff);max-height:30dvh;overflow-y:auto!important;-webkit-overflow-scrolling:touch}.cs-layout-editor>footer{position:sticky;bottom:0;z-index:4;background:var(--bg-secondary,#fff);box-shadow:0 -8px 20px rgba(0,0,0,.08)}.cs-layout-row{background:var(--bg-secondary,#fff)!important;position:relative;min-height:58px;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}.cs-layout-row.is-dragging{z-index:20;background:var(--bg-secondary,#fff)!important;box-shadow:0 16px 36px rgba(0,0,0,.28);transform:scale(1.025)}.cs-drop-placeholder{background:var(--bg-card)!important;border:2px dashed var(--accent-purple);min-height:58px;box-sizing:border-box}.cs-layout-fullscreen{position:fixed;inset:0;z-index:60000;background:var(--bg-primary,#f7f7f9);color:var(--text-primary);overflow:hidden}.cs-layout-editor-full{height:100dvh;width:100%;display:flex;flex-direction:column;background:var(--bg-primary,#f7f7f9)}.cs-layout-editor-head{flex:0 0 auto;display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:1rem 1.25rem;background:var(--bg-secondary,#fff);border-bottom:1px solid var(--border-color);box-shadow:0 2px 12px rgba(0,0,0,.08)}.cs-layout-editor-head h2{margin:0}.cs-layout-editor-head p{margin:.25rem 0 0;color:var(--text-secondary);font-size:.85rem}.cs-layout-editor-body{flex:1;min-height:0;display:grid;grid-template-columns:280px minmax(0,1fr);gap:1rem;padding:1rem;overflow:hidden}.cs-field-palette{min-width:0;overflow:auto;background:var(--bg-secondary,#fff);border:1px solid var(--border-color);border-radius:16px;padding:.85rem;box-shadow:0 4px 18px rgba(0,0,0,.06)}.cs-palette-head{display:flex;justify-content:space-between;align-items:center;gap:.5rem;padding:.25rem .1rem .6rem;border-bottom:1px solid var(--border-color)}.cs-palette-count{min-width:24px;height:24px;display:grid;place-items:center;border-radius:999px;background:var(--accent-purple);color:#fff;font-size:.75rem;font-weight:900}.cs-field-palette>p{font-size:.8rem;color:var(--text-secondary);line-height:1.4}.cs-palette-list{display:grid;gap:.5rem}.cs-palette-item{display:flex;align-items:flex-start;gap:.6rem;padding:.7rem;border:1px solid var(--border-color);border-radius:11px;background:var(--bg-card,#fff);cursor:grab;box-shadow:0 2px 8px rgba(0,0,0,.05);user-select:none}.cs-palette-item>span{color:var(--text-secondary);font-size:1.2rem}.cs-palette-item div{min-width:0;display:flex;flex-direction:column}.cs-palette-item small,.cs-layout-field small{display:block;color:var(--text-secondary);font-size:.72rem;margin-top:.2rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cs-session-list{min-width:0;overflow:auto;padding:.1rem .25rem 2rem;display:flex;flex-direction:column;gap:1rem}.cs-layout-section{background:var(--bg-secondary,#fff);border:1px solid var(--border-color);border-radius:16px;padding:.8rem;box-shadow:0 4px 18px rgba(0,0,0,.06);min-width:0}.cs-layout-section-head{display:flex;align-items:center;gap:.7rem;margin-bottom:.8rem}.cs-layout-section-head .cs-drag{cursor:grab}.cs-section-title{flex:1;min-width:0;border:0;border-bottom:1px solid var(--border-color);background:transparent;color:var(--text-primary);font-size:1.05rem;font-weight:900;padding:.5rem .2rem;outline:none}.cs-section-title:focus{border-color:var(--accent-purple)}.cs-section-tools{display:flex;align-items:center;gap:.35rem;white-space:nowrap;color:var(--text-secondary);font-size:.78rem;font-weight:800}.cs-section-tools button{width:32px;height:32px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-card,#fff);color:var(--text-primary);font-size:1.2rem;cursor:pointer}.cs-col-value{min-width:18px;text-align:center;color:var(--text-primary)}.cs-layout-columns{display:grid;grid-template-columns:repeat(var(--editor-cols,1),minmax(0,1fr));gap:.7rem;align-items:start}.cs-layout-column{min-width:0;min-height:95px;padding:.55rem;border:1px dashed var(--border-color);border-radius:12px;background:var(--bg-card,#fff)}.cs-column-label{font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-secondary);font-weight:900;padding:0 0 .45rem}.cs-layout-fields{min-height:52px;display:grid;gap:.45rem}.cs-layout-field{display:flex;align-items:center;gap:.55rem;min-width:0;padding:.7rem;border:1px solid var(--border-color);border-radius:10px;background:var(--bg-secondary,#fff);cursor:grab;box-shadow:0 2px 7px rgba(0,0,0,.04);user-select:none}.cs-layout-field>div{min-width:0}.cs-layout-field.is-dragging{opacity:.35}.cs-create-section{flex:0 0 auto;min-height:52px;border:2px dashed var(--border-color);border-radius:14px;background:var(--bg-secondary,#fff);color:var(--accent-purple);font-weight:900;cursor:pointer}.cs-layout-editor-foot{flex:0 0 auto;display:flex;justify-content:flex-end;gap:.6rem;padding:.8rem 1rem;background:var(--bg-secondary,#fff);border-top:1px solid var(--border-color);box-shadow:0 -6px 18px rgba(0,0,0,.08)}.cs-section-placeholder{border:2px dashed var(--accent-purple);border-radius:16px;background:color-mix(in srgb,var(--accent-purple) 8%,transparent)}.cs-field-placeholder{border:2px dashed var(--accent-purple);border-radius:10px;background:color-mix(in srgb,var(--accent-purple) 10%,transparent);min-height:52px;box-sizing:border-box}.cs-layout-fullscreen .cs-modal,.cs-layout-fullscreen .cs-dropdown-menu,.cs-layout-fullscreen .cs-parser-menu,.cs-layout-fullscreen .cs-help-popover{background-color:var(--bg-secondary,#fff)!important;background-image:none!important;opacity:1!important}.cs-modal,.cs-dropdown-menu,.cs-parser-menu,.cs-help-popover,.cs-description-dialog{background-color:var(--bg-secondary,#fff)!important;background-image:none!important;opacity:1!important;isolation:isolate}.cs-dropdown-menu{z-index:70001!important}.cs-parser-menu{z-index:70002!important}.cs-help-popover{z-index:70003!important}.cs-layout-dragging *{cursor:grabbing!important}@media(max-width:900px){.cs-layout-editor-body{grid-template-columns:230px minmax(0,1fr)}}@media(max-width:700px){.cs-layout-editor-body{display:flex;flex-direction:column;overflow:auto;padding:.65rem}.cs-field-palette{flex:0 0 auto;max-height:28dvh}.cs-palette-list{grid-template-columns:repeat(2,minmax(0,1fr))}.cs-layout-columns{grid-template-columns:1fr!important}.cs-layout-editor-head{padding:.75rem}.cs-layout-editor-head p{display:none}.cs-layout-editor-foot{padding-bottom:max(.8rem,env(safe-area-inset-bottom))}}.cs-description-modal{z-index:100000!important}.cs-description-modal .cs-modal{position:relative;z-index:100001!important}.cs-layout-fullscreen{z-index:60000!important}.cs-field-palette,.cs-layout-section,.cs-layout-column,.cs-layout-field,.cs-palette-item,.cs-create-section,.cs-section-tools button{background:#2a1b18!important;color:var(--text-primary);box-shadow:none!important}.cs-field-palette,.cs-layout-section,.cs-layout-column{border-color:#bda37f}.cs-layout-field,.cs-palette-item{border:1px dashed #bda37f!important}.cs-palette-item{padding:.5rem .55rem;font-size:.86rem}.cs-layout-field{padding:.45rem .55rem;min-height:38px;font-size:.88rem}.cs-layout-section{padding:.6rem}.cs-layout-section-head{margin-bottom:.55rem;gap:.45rem}.cs-section-title{font-size:.95rem;padding:.35rem .2rem}.cs-section-tools{gap:.2rem;font-size:.72rem}.cs-section-tools button{width:28px;height:28px;border:1px dashed #bda37f!important}.cs-layout-column{min-height:72px;padding:.4rem;border:1px dashed #bda37f!important}.cs-field-placeholder,.cs-section-placeholder{background:#2a1b18!important;border:2px dashed #d8bd92!important}.cs-palette-toggle{width:30px;height:30px;border:1px dashed #bda37f;border-radius:8px;background:#2a1b18;color:var(--text-primary);font-size:1.1rem;font-weight:900}.cs-field-palette.is-collapsed{max-height:52px;overflow:hidden}.cs-layout-editor-body{touch-action:none}.cs-switch i,.cs-fraction-toggle .cs-toggle-track{background:#777!important}.cs-switch input:checked+i,.cs-fraction-toggle input:checked+.cs-toggle-track{background:#6f2638!important}.cs-delete-section{color:#d78b8b!important}`;
document.head.appendChild(s);const extra=document.createElement("style");extra.textContent=`.cs-npc-section{color:#bda37f!important}.cs-npc-player{border-left:3px solid #bda37f}.cs-npc-fullscreen .cs-master-sheet{border-color:#bda37f}.cs-npc-fullscreen .cs-master-sheet header{background:#2a1b18}.cs-npc-fullscreen .cs-master-sheet header strong{color:#bda37f}`+`.cs-palette-head{display:flex;align-items:center;gap:.4rem}.cs-palette-head strong{margin-right:auto}.cs-palette-count{display:grid;place-items:center;min-width:24px;height:24px;padding:0 .35rem;border-radius:999px;background:#6f2638;color:#fff;font-size:.72rem;font-weight:900}.cs-palette-item.is-assigned{opacity:.58;cursor:not-allowed}.cs-palette-assigned{color:#bda37f!important;font-size:.68rem!important}`;document.head.appendChild(extra);
const wrap=document.createElement("style");wrap.textContent=`
/* Visualização: nunca deixe texto estourar os limites de cards/colunas. */
.cs-content .cs-card,
.cs-content .cs-card *,
.cs-content .cs-item-title,
.cs-content .cs-item-title > *,
.cs-content .cs-field,
.cs-content .cs-field > *,
.cs-content .cs-static,
.cs-content .cs-desc,
.cs-content .cs-limit,
.cs-content .cs-hint,
.cs-content .cs-formula,
.cs-content .cs-ability-type,
.cs-content .cs-section-header,
.cs-content .cs-section-header *{
  min-width:0;
  max-width:100%;
  box-sizing:border-box;
  overflow-wrap:anywhere;
  word-break:break-word;
  white-space:normal;
}
.cs-content .cs-grid{
  min-width:0;
  width:100%;
}
.cs-content .cs-grid{grid-auto-flow:row;align-items:start;}
.cs-content .cs-card{
  overflow-wrap:anywhere;
}
.cs-content .cs-equipment-summary > div{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:.75rem;
  width:100%;
}
.cs-content .cs-equipment-summary > div > strong{
  margin-right:auto;
}
.cs-content .cs-equipment-summary .cs-slot-counter{
  margin-left:auto;
  text-align:right;
  white-space:nowrap;
}
.cs-content .cs-item-title{
  align-items:flex-start;
}
.cs-content .cs-item-title strong{
  flex:1 1 auto;
  min-width:0;
  white-space:normal;
}
.cs-content .cs-title-actions{
  flex:0 1 auto;
  min-width:0;
  display:flex;
  align-items:center;
  flex-wrap:wrap;
  justify-content:flex-end;
}
.cs-content .cs-title-actions small{
  min-width:0;
  white-space:normal;
  overflow-wrap:anywhere;
}
.cs-content input,
.cs-content textarea,
.cs-content select,
.cs-content button{
  min-width:0;
  max-width:100%;
}
@media(max-width:700px){
  .cs-content .cs-item-title{
    flex-wrap:wrap;
  }
  .cs-content .cs-title-actions{
    flex:0 1 auto;
  }
}

.cs-bound-value-field{align-items:center}.cs-bound-value-field>label{text-align:center;width:100%}.cs-bound-number{display:flex!important;align-items:center;justify-content:center;text-align:center;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:.01em}.cs-bound-value-field .cs-limit{text-align:center;width:100%}.cs-bound-value-field .cs-input{font-size:1.05rem;font-weight:800}.cs-bound-value-field .cs-static{font-size:1.08rem}.cs-bound-value-field .cs-input::placeholder{text-align:center}
.cs-icon{display:block;width:15px;height:15px;vertical-align:middle;flex:0 0 15px;overflow:visible}.cs-action-icon .cs-icon{width:22px;height:22px;flex-basis:22px}.cs-item-title .cs-icon,.cs-picker-section-title .cs-icon{margin-right:.28rem}.cs-primary .cs-icon,.cs-secondary .cs-icon,.cs-danger .cs-icon{margin-right:.3rem}.cs-character-name-banner{font-size:1.65rem;font-weight:900;padding:.15rem 0 .65rem}.cs-status{padding:.65rem .8rem;margin-bottom:.65rem}.cs-actions{gap:.4rem;margin-bottom:.7rem}.cs-section{margin-bottom:.65rem;border-radius:13px}.cs-section-header{padding:.72rem .8rem}.cs-section-body{padding:.7rem}.cs-grid{gap:.55rem}.cs-card{padding:.65rem;border-radius:10px}.cs-item-title{margin-bottom:.4rem}.cs-field{margin-top:.4rem;gap:.25rem}.cs-input,.cs-static{min-height:36px;padding:.45rem .55rem}.cs-static.cs-resource-full,.cs-resource-value{font-size:1.15rem;font-weight:900;text-align:center;display:grid;place-items:center}.cs-limit,.cs-hint,.cs-formula{font-size:.7rem}.cs-desc{font-size:.78rem;margin-bottom:.4rem}@media(max-width:600px){.character-sheet-view{padding:.4rem}.cs-top{gap:.55rem;margin-bottom:.65rem}.cs-back{width:36px;height:36px;font-size:1.2rem}.cs-title h1{font-size:1.25rem}.cs-title p{font-size:.72rem}.cs-layout{gap:.65rem}.cs-character-name-banner{font-size:1.4rem;padding-bottom:.5rem}.cs-section-header{padding:.65rem .7rem}.cs-section-body{padding:.6rem}.cs-card{padding:.55rem}.cs-grid{gap:.45rem}.cs-item-title{gap:.35rem}.cs-item-title strong{font-size:.9rem}.cs-field label{font-size:.7rem}.cs-input,.cs-static{font-size:15px;min-height:34px}.cs-static.cs-resource-full,.cs-resource-value{font-size:1.08rem}.cs-actions button{min-height:36px;padding:.45rem .65rem}.cs-player{padding:.45rem}.cs-picker{padding:.55rem}.cs-new-character{margin-top:.5rem}}
`;document.head.appendChild(wrap);}

async function characterSheetView(params={}){
  S.tableId=params.tableId||params.id||null;S.user=auth.currentUser;if(!S.user||!S.tableId){nav("/home");return;}styles();
  try{await load();const app=document.getElementById("app");app.innerHTML=`<div class="character-sheet-view"><div class="cs-inner"><div class="cs-top"><button class="cs-back">‹</button><div class="cs-title"><h1>${I("sword",18)} Ficha de personagem</h1><p>${esc(S.table.name||"Mesa")}</p></div></div><div class="cs-layout"><aside class="cs-picker"></aside><main class="cs-content"></main></div></div></div>`;app.querySelector(".cs-back").onclick=()=>nav("/game/"+encodeURIComponent(S.tableId));renderCharacter();
    if(S.isMaster){onSnapshot(collection(db,"tables",S.tableId,"characters"),snap=>{S.characters.clear();snap.forEach(x=>S.characters.set(x.id,normalize(x.data(),x.id)));if(S.selectedId&&!S.editing)S.character=S.characters.get(S.selectedId)||null;renderCharacter();});onSnapshot(collection(db,"tables",S.tableId,"npcs"),snap=>{S.npcs.clear();snap.forEach(x=>S.npcs.set(x.id,normalize(x.data(),S.user.uid,x.id)));if(S.selectedNpcId&&!S.editing&&document.querySelector(".cs-npc-fullscreen")){S.character=S.npcs.get(S.selectedNpcId)||null;renderCharacter(document.querySelector(".cs-npc-fullscreen"),true);}renderCharacter();});}
    else{onSnapshot(collection(db,"tables",S.tableId,"characters"),snap=>{S.characters.clear();snap.forEach(x=>{const raw=x.data()||{};if((raw.ownerUid||raw.uid)===S.user.uid)S.characters.set(x.id,normalize(raw,S.user.uid,x.id));});const chars=playerCharacters();const alive=chars.find(c=>!characterIsDead(c));if(!S.editing){S.selectedId=alive?.characterId||null;S.character=alive||null;}renderCharacter();});}
    onSnapshot(doc(db,"tables",S.tableId),snap=>{if(snap.exists()){S.table={id:snap.id,...snap.data()};S.config=configOf(S.table);S.layout=S.config.layout;S.activeMasterNpcId=S.table.activeMasterNpcId||null;renderCharacter();}});
  }catch(e){console.error(e);document.getElementById("app").innerHTML=`<div class="character-sheet-view"><div class="cs-inner"><div class="cs-big cs-empty"><h2>Não foi possível abrir a ficha</h2><p>${esc(e.message||"Tente novamente.")}</p><button class="cs-primary" onclick="history.back()">Voltar</button></div></div></div>`;}
}

export { characterSheetView as render, characterSheetView as default };
