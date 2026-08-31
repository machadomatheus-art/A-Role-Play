import { auth, db, storage } from "../firebase-config.js";
import { doc,getDoc,setDoc,updateDoc,deleteDoc,onSnapshot,collection,query,arrayUnion,arrayRemove,serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { updateProfile,updatePassword,signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { enableARolePlayPushNotifications } from "../notification.js";

const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const initials=n=>{let a=String(n||"Usuário").trim().split(/\s+/);return (a[0]?.[0]||"?")+(a.length>1?a.at(-1)[0]:"");};
const svg=(n,c="")=>{const p={back:'<path d="M19 12H5"/><path d="m11 18-6-6 6-6"/>',gear:'<path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="M19 15a7.5 7.5 0 0 0 0-6M9 5.5a7.5 7.5 0 0 0 6 0M5.5 9a7.5 7.5 0 0 0 0 6M9 18.5a7.5 7.5 0 0 0 6 0"/>',plus:'<circle cx="9" cy="8" r="3.5"/><path d="M3 20c.7-3.2 2.7-5 6-5s5.3 1.8 6 5"/><path d="M19 10v7M15.5 13.5h7"/>',minus:'<circle cx="9" cy="8" r="3.5"/><path d="M3 20c.7-3.2 2.7-5 6-5s5.3 1.8 6 5"/><path d="M16 13.5h7"/>',copy:'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"/>',check:'<path d="m5 12 4 4L19 6"/>',x:'<path d="m6 6 12 12M18 6 6 18"/>',camera:'<path d="M4 8h3l1.5-2h7L17 8h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"/><circle cx="12" cy="14" r="3.5"/>',user:'<circle cx="12" cy="8" r="3.5"/><path d="M4.5 21c.8-4.1 3.2-6 7.5-6s6.7 1.9 7.5 6"/>',bell:'<path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M10 21h4"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3.9 1.8c-1.1.9-1.7 1.3-1.7 2.7"/><path d="M12 17h.01"/>',logout:'<path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4"/><path d="m14 8 4 4-4 4"/><path d="M18 12H9"/>'};return `<svg class="${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${p[n]}</svg>`};

export function render(){
  const root=document.createElement("div");
  root.className="profile-view";
  const u=auth.currentUser;
  if(!u){window.router?.navigate("/auth");return root;}

  let me={uid:u.uid,username:u.displayName||"Usuário",avatarDataUrl:"",friends:[],pendingFriendRequests:[]};
  let friends=[],requests=[],sentRequests=[],modal=null;

  root.innerHTML=`<style>
  .profile-view{min-height:100dvh;background:var(--bg-primary);color:var(--text-primary)}.ps{max-width:760px;margin:auto;min-height:100dvh;border:1px solid var(--border-color);display:flex;flex-direction:column}.ph{height:62px;display:flex;align-items:center;justify-content:space-between;padding:0 10px;border-bottom:1px solid var(--border-color);background:linear-gradient(180deg,var(--bg-secondary),var(--bg-primary));position:sticky;top:0;z-index:5}.ph h1{font-size:1.05rem;margin:0}.ib{width:42px;height:42px;border:0;background:transparent;color:var(--text-secondary);border-radius:50%;display:grid;place-items:center}.ib svg{width:22px;height:22px}.menu-wrap{position:relative}.profile-menu{position:absolute;right:0;top:48px;width:210px;padding:6px;background:var(--bg-surface);border:1px solid var(--border-color);border-radius:14px;box-shadow:0 12px 30px #0004;z-index:30}.profile-menu button{width:100%;min-height:44px;border:0;border-radius:10px;background:transparent;color:var(--text-primary);display:flex;align-items:center;gap:11px;padding:0 12px;text-align:left;font:700 .84rem inherit}.profile-menu button:active{background:var(--bg-primary)}.profile-menu svg{width:19px;height:19px;flex:none;color:var(--text-secondary)}.profile-menu .danger{color:#d96b6b}.profile-menu .danger svg{color:#d96b6b}.body{overflow:auto;padding-bottom:100px}.hero{text-align:center;padding:28px 18px 24px;border-bottom:1px solid var(--border-color);background:radial-gradient(circle at 50% 0,color-mix(in srgb,var(--accent-primary) 14%,transparent),transparent 55%)}.aw{position:relative;display:inline-block}.av{width:112px;height:112px;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:var(--bg-surface);border:1px solid var(--border-color);color:var(--accent-secondary);font-size:2rem;font-weight:800}.av img{width:100%;height:100%;object-fit:cover}.cam{position:absolute;right:0;bottom:0;width:36px;height:36px;border-radius:50%;border:3px solid var(--bg-primary);background:var(--accent-primary);color:white;display:grid;place-items:center;cursor:pointer}.cam svg{width:17px}.name{margin:12px 0 4px;font-size:1.35rem}.sub{margin:0;color:var(--text-secondary);font-size:.82rem}.uid{margin:15px auto 0;display:flex;align-items:center;gap:7px;width:max-content;max-width:95%;padding:8px 10px 8px 13px;border:1px solid var(--border-color);border-radius:11px;background:var(--bg-surface)}.uidv{font:.72rem ui-monospace,monospace;max-width:260px;overflow:hidden;text-overflow:ellipsis}.cp{border:0;background:transparent;color:var(--text-secondary);width:30px;height:30px}.cp svg{width:17px}.sec h2{font-size:.9rem;margin:18px 16px 9px}.count{color:var(--text-muted);font-size:.75rem}.req,.sent,.fr{border-top:1px solid var(--border-color);display:flex;align-items:center;gap:11px;padding:11px 15px}.ma{width:46px;height:46px;border-radius:50%;overflow:hidden;background:var(--bg-surface);display:grid;place-items:center;flex:none;color:var(--accent-secondary);font-weight:800}.ma img{width:100%;height:100%;object-fit:cover}.info{min-width:0;flex:1}.fn{font-weight:700;font-size:.92rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fu{font:.69rem ui-monospace,monospace;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis}.sa,.ra{display:flex;gap:6px;align-items:center}.pending{font-size:.68rem;color:var(--text-muted);white-space:nowrap}.cancelreq{width:38px;height:38px;border-radius:50%;border:1px solid var(--border-color);background:var(--bg-surface);color:var(--text-secondary)}.ra button{width:38px;height:38px;border-radius:50%;border:1px solid var(--border-color);background:var(--bg-surface)}.ok{color:#60b878}.no{color:#df6b6b}.frwrap{position:relative;background:#b52323;overflow:hidden;border-bottom:1px solid var(--border-color)}.rm{position:absolute;inset:0 0 0 auto;width:88px;border:0;background:#b52323;color:white;display:grid;place-items:center}.rm svg{width:23px}.fc{position:relative;z-index:1;display:flex;align-items:center;gap:11px;padding:10px 15px;min-height:72px;background:var(--bg-primary);transform:translateX(0);transition:.18s}.fc.sw{transform:translateX(-88px)}.empty{text-align:center;padding:32px 20px;color:var(--text-secondary)}.fab{position:fixed;right:max(18px,calc((100vw - 760px)/2 + 18px));bottom:20px;width:58px;height:58px;border:0;border-radius:50%;background:var(--accent-primary);color:white;display:grid;place-items:center;box-shadow:0 9px 25px #0005;z-index:10}.fab svg{width:27px}.mb{position:fixed;inset:0;background:#000b;z-index:100;display:flex;align-items:flex-end;justify-content:center;padding:14px}.modal{width:100%;max-width:520px;max-height:88dvh;overflow:auto;background:var(--bg-surface);border:1px solid var(--border-color);border-radius:20px;color:var(--text-primary)}.mh{padding:16px 18px;border-bottom:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center}.mh h3{margin:0;font-size:1rem}.mbody{padding:18px}.mi{width:100%;height:46px;box-sizing:border-box;padding:0 12px;border-radius:10px;border:1px solid var(--border-color);background:var(--bg-primary);color:var(--text-primary);outline:0}.mf{display:flex;gap:8px;padding:0 18px 18px}.btn{flex:1;min-height:44px;border-radius:10px;border:1px solid var(--border-color);background:var(--bg-primary);color:var(--text-primary);font-weight:750}.primary{background:var(--accent-primary);color:white;border-color:transparent}.toast{position:fixed;left:50%;bottom:90px;transform:translate(-50%,15px);opacity:0;background:#181818;color:#fff;padding:11px 16px;border-radius:11px;z-index:200;transition:.2s}.toast.show{opacity:1;transform:translate(-50%,0)}.crop-area{width:min(100%,380px);aspect-ratio:1/1;margin:auto;overflow:hidden;position:relative;background:#111;border-radius:12px;touch-action:none}.crop-img{position:absolute;max-width:none;user-select:none;pointer-events:none;transform-origin:center}.crop-grid{position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,transparent 33.1%,#fff7 33.3%,transparent 33.6%,transparent 66.4%,#fff7 66.6%,transparent 66.9%),linear-gradient(0deg,transparent 33.1%,#fff7 33.3%,transparent 33.6%,transparent 66.4%,#fff7 66.6%,transparent 66.9%)}.crop-controls{display:flex;align-items:center;gap:10px;margin-top:14px}.crop-controls input{flex:1}.crop-tip{text-align:center;color:var(--text-secondary);font-size:.75rem;margin:10px 0 0}
  .crop-fullscreen{position:fixed;inset:0;background:#000;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:18px;box-sizing:border-box;touch-action:none}.crop-fullscreen .crop-viewport{position:relative;width:min(100%,760px);height:min(78dvh,760px);display:grid;place-items:center;overflow:hidden;touch-action:none;background:#000}.crop-fullscreen .crop-viewport::after{content:"";position:absolute;width:var(--crop-size);height:var(--crop-size);border:1px solid #fff;box-shadow:0 0 0 9999px #0008;pointer-events:none;box-sizing:border-box}.crop-fullscreen .crop-img{position:absolute;max-width:none;user-select:none;pointer-events:none;will-change:left,top,width,height}.crop-fullscreen .crop-img.crop-snap{transition:left .16s cubic-bezier(.2,.8,.2,1),top .16s cubic-bezier(.2,.8,.2,1)}.crop-fullscreen .crop-grid{position:absolute;width:var(--crop-size);height:var(--crop-size);border:0;pointer-events:none;background:linear-gradient(90deg,transparent 33.1%,#fff6 33.3%,transparent 33.6%,transparent 66.4%,#fff6 66.6%,transparent 66.9%),linear-gradient(0deg,transparent 33.1%,#fff6 33.3%,transparent 33.6%,transparent 66.4%,#fff6 66.6%,transparent 66.9%)}.crop-bottom{height:44px;display:flex;align-items:center;justify-content:center;color:#aaa;font-size:.74rem}.crop-actions{background:#000!important;border:0!important;padding:10px 18px 18px!important}.crop-save-floating{position:absolute;right:18px;bottom:max(18px,env(safe-area-inset-bottom));z-index:20;min-height:46px;padding:0 20px;border:0;border-radius:999px;background:var(--accent-primary);color:#fff;font-weight:800;box-shadow:0 8px 24px #0008}.crop-save-floating:disabled{opacity:.65}.crop-preparing{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:30;color:#fff;background:#111d;padding:12px 16px;border-radius:12px;font-size:.82rem;text-align:center;display:none}.crop-preparing.show{display:block}.crop-actions .btn{background:#181818;border-color:#333}.crop-actions .primary{background:var(--accent-primary);border-color:transparent}.crop-fullscreen+.crop-bottom{display:none}.crop-fullscreen{border-radius:0!important}.crop-fullscreen .crop-viewport{border-radius:0!important}@media(max-width:699px){.mb:has(.crop-fullscreen){padding:0;align-items:stretch;background:#000}.mb:has(.crop-fullscreen) .modal{max-width:none;max-height:none;height:100dvh;border:0;border-radius:0;background:#000;display:flex;flex-direction:column}.mb:has(.crop-fullscreen) .mh{position:absolute;top:0;left:0;right:0;z-index:5;border:0;background:linear-gradient(#0008,transparent);padding:8px}.mb:has(.crop-fullscreen) .mh h3{display:none}.mb:has(.crop-fullscreen) .mh .close{color:#fff}.mb:has(.crop-fullscreen) .mbody{padding:0;flex:1;display:flex;flex-direction:column;overflow:hidden}.mb:has(.crop-fullscreen) .mf{display:none}.crop-fullscreen .crop-viewport{width:100vw;height:calc(100dvh - 150px)}.crop-zoom-hint{opacity:.9}.crop-actions{padding-bottom:max(18px,env(safe-area-inset-bottom))!important}}
  @media(min-width:700px){.mb{align-items:center}.modal{border-radius:20px}}
  </style><div class="ps"><header class="ph"><button class="ib" id="back">${svg("back")}</button><h1>Perfil</h1><div class="menu-wrap"><button class="ib" id="settings" aria-label="Menu" aria-expanded="false">${svg("gear")}</button><div class="profile-menu" id="profileMenu" hidden><button type="button" data-menu="profile">${svg("user")}<span>Editar perfil</span></button><button type="button" data-menu="notifications">${svg("bell")}<span>Notificações</span></button><button type="button" data-menu="support">${svg("help")}<span>Contatar o suporte</span></button><button type="button" data-menu="logout" class="danger">${svg("logout")}<span>Sair</span></button></div></div></header><main class="body"><section class="hero"><div class="aw"><div class="av" id="avatar"></div><button type="button" class="cam" id="cam" aria-label="Trocar foto">${svg("camera")}</button><input id="photo" type="file" accept="image/*" hidden></div><h2 class="name" id="name"></h2><p class="sub"></p><div class="uid"><span class="uidv">${esc(u.uid)}</span><button class="cp" id="copy">${svg("copy")}</button></div></section><section class="sec" id="sentsec" hidden><h2>Solicitações enviadas <span class="count" id="sentcount"></span></h2><div id="sentrequests"></div></section><section class="sec" id="reqsec" hidden><h2>Pedidos de amizade <span class="count" id="reqcount"></span></h2><div id="requests"></div></section><section class="sec"><h2>Amigos <span class="count" id="fcount">0</span></h2><div id="friends"></div></section></main><button type="button" class="fab" id="add">${svg("plus")}</button></div>`;

  const $=s=>root.querySelector(s);
  const toast=m=>{let t=document.createElement("div");t.className="toast";t.textContent=m;root.append(t);requestAnimationFrame(()=>t.classList.add("show"));setTimeout(()=>t.remove(),2400)};
  const close=()=>{modal?.remove();modal=null};
  const open=(title,body,actions="")=>{close();let b=document.createElement("div");b.className="mb";b.innerHTML=`<section class="modal"><div class="mh"><h3>${title}</h3><button type="button" class="ib close">${svg("x")}</button></div><div class="mbody">${body}</div>${actions}</section>`;document.body.append(b);modal=b;b.querySelector(".close").onclick=close;b.onclick=e=>{if(e.target===b)close()};return b};
  const copy=async()=>{try{await navigator.clipboard.writeText(u.uid);toast("UID copiado.")}catch{toast("Não foi possível copiar o UID.")}};
  const avatarCache=new Map();
  const getAvatar=async id=>{
    if(avatarCache.has(id)) return avatarCache.get(id);
    try{
      const s=await getDoc(doc(db,"users",id,"profile","avatar"));
      const data=s.exists()?s.data():{};
      const value=data.dataUrl||"";
      avatarCache.set(id,value);
      return value;
    }catch(e){console.warn("Avatar:",id,e);return ""}
  };
  const av=d=>{let a=$("#avatar"),src=d.avatarDataUrl||"";a.innerHTML=src?`<img src="${esc(src)}">`:`<span>${esc(initials(d.username))}</span>`};
  const loadFriends=async ids=>{let out=[];for(const id of ids||[]){try{let s=await getDoc(doc(db,"users",id));if(s.exists()){let d=s.data();const avatar=await getAvatar(id);out.push({uid:id,username:d.username||"Usuário",avatarDataUrl:avatar})}}catch(e){console.warn(e)}}return out};

  const render=async()=>{me.pendingFriendRequests=Array.isArray(me.pendingFriendRequests)?me.pendingFriendRequests:[];$("#name").textContent=me.username||"Usuário";av(me);friends=await loadFriends(me.friends);$("#fcount").textContent=friends.length;$("#friends").innerHTML=friends.length?friends.map(f=>`<div class="frwrap" data-id="${esc(f.uid)}"><button type="button" class="rm">${svg("minus")}</button><div class="fc"><div class="ma">${f.avatarDataUrl?`<img src="${esc(f.avatarDataUrl)}">`:`<span>${esc(initials(f.username))}</span>`}</div><div class="info"><div class="fn">${esc(f.username)}</div><div class="fu">${esc(f.uid)}</div></div></div></div>`).join(""):`<div class="empty">Você ainda não tem amigos.<br><small>Use o botão + para adicionar alguém pelo UID.</small></div>`;root.querySelectorAll(".frwrap").forEach(row=>{let c=row.querySelector(".fc"),x=0,s=0,d=false;c.onpointerdown=e=>{s=x=e.clientX;d=true;c.setPointerCapture?.(e.pointerId);c.style.transition="none"};c.onpointermove=e=>{if(d){x=e.clientX;c.style.transform=`translateX(${Math.max(-88,Math.min(0,x-s))}px)`}};c.onpointerup=()=>{d=false;c.style.transition="";c.style.transform="";if(x-s<-42)c.classList.add("sw");else if(x-s>20)c.classList.remove("sw")};row.querySelector(".rm").onclick=()=>removeFriend(row.dataset.id)})};
  const renderReq=async()=>{requests=await Promise.all(requests.map(async r=>({...r,avatarDataUrl:await getAvatar(r.uid)})));$("#reqsec").hidden=!requests.length;$("#reqcount").textContent=requests.length||"";$("#requests").innerHTML=requests.map(r=>`<div class="req" data-id="${esc(r.uid)}"><div class="ma">${r.avatarDataUrl?`<img src="${esc(r.avatarDataUrl)}">`:`<span>${esc(initials(r.username))}</span>`}</div><div class="info"><div class="fn">${esc(r.username||"Usuário")}</div><div class="fu">${esc(r.uid)}</div></div><div class="ra"><button type="button" class="ok" data-a="y">${svg("check")}</button><button type="button" class="no" data-a="n">${svg("x")}</button></div></div>`).join("");root.querySelectorAll("#requests [data-id]").forEach(r=>{r.querySelector('[data-a="y"]').onclick=()=>answer(r.dataset.id,true);r.querySelector('[data-a="n"]').onclick=()=>answer(r.dataset.id,false)})};
  const renderSent=async()=>{sentRequests=await Promise.all((sentRequests||[]).map(async r=>({...r,avatarDataUrl:await getAvatar(r.uid)})));const mine=(sentRequests||[]).filter(r=>!(me.friends||[]).includes(r.uid));$("#sentsec").hidden=!mine.length;$("#sentcount").textContent=mine.length||"";$("#sentrequests").innerHTML=mine.map(r=>`<div class="sent req" data-id="${esc(r.uid)}"><div class="ma">${r.avatarDataUrl?`<img src="${esc(r.avatarDataUrl)}">`:`<span>${esc(initials(r.username))}</span>`}</div><div class="info"><div class="fn">${esc(r.username||"Usuário")}</div><div class="fu">${esc(r.uid)}</div></div><div class="sa"><span class="pending">Pendente</span><button type="button" class="cancelreq" title="Cancelar" data-a="c">${svg("x")}</button></div></div>`).join("");root.querySelectorAll("#sentrequests [data-id]").forEach(r=>r.querySelector('[data-a="c"]').onclick=()=>cancelRequest(r.dataset.id))};

  const cancelRequest=async id=>{try{await deleteDoc(doc(db,"users",u.uid,"sentFriendRequests",id));await deleteDoc(doc(db,"users",id,"friendRequests",u.uid));const item=(me.pendingFriendRequests||[]).find(x=>x.uid===id);if(item){await updateDoc(doc(db,"users",u.uid),{pendingFriendRequests:arrayRemove(item)})}sentRequests=sentRequests.filter(x=>x.uid!==id);renderSent();toast("Solicitação cancelada.")}catch(e){console.error("Erro ao cancelar solicitação:",e);toast(`Não foi possível cancelar: ${e?.code||e?.message||"erro desconhecido"}`)}};

  const answer=async(id,yes)=>{try{const incomingRef=doc(db,"users",u.uid,"friendRequests",id);const incoming=await getDoc(incomingRef);if(!incoming.exists())throw new Error("Solicitação não encontrada.");const senderRef=doc(db,"users",id);const senderSnap=await getDoc(senderRef);const sender=senderSnap.exists()?senderSnap.data():{};const pending=(sender.pendingFriendRequests||[]).find(x=>x.uid===u.uid);if(yes){await updateDoc(doc(db,"users",u.uid),{friends:arrayUnion(id)});await updateDoc(senderRef,{friends:arrayUnion(u.uid),pendingFriendRequests:pending?arrayRemove(pending):[]})}else if(pending){await updateDoc(senderRef,{pendingFriendRequests:arrayRemove(pending)})}await deleteDoc(incomingRef);try{await deleteDoc(doc(db,"users",id,"sentFriendRequests",u.uid))}catch(cleanupError){console.warn("Não foi possível limpar a solicitação enviada do remetente:",cleanupError)}toast(yes?"Amizade aceita.":"Pedido recusado.")}catch(e){console.error("Erro ao processar pedido:",e);toast(`Não foi possível processar: ${e?.code||e?.message||"erro desconhecido"}`)}};


  const removeFriend=id=>{let f=friends.find(x=>x.uid===id);let m=open("Desfazer amizade?",`<p>Deseja realmente desfazer a amizade com <b>${esc(f?.username||"este usuário")}</b>?</p>`,`<div class="mf"><button type="button" class="btn" id="cancel">Cancelar</button><button type="button" class="btn primary" id="yes">Desfazer</button></div>`);m.querySelector("#cancel").onclick=close;m.querySelector("#yes").onclick=async()=>{try{await updateDoc(doc(db,"users",u.uid),{friends:arrayRemove(id)});await updateDoc(doc(db,"users",id),{friends:arrayRemove(u.uid)});close();toast("Amizade desfeita.")}catch(e){console.error(e);toast("Não foi possível desfazer a amizade.")}}};

  const openCrop=async file=>{
    const MAX_INPUT_DIM=4096;
    const TARGET_BYTES=900*1024;
    const normalizeImage=async sourceFile=>{
      const makeBlob=async(bitmap,w,h,quality)=>{
        const c=document.createElement("canvas");
        c.width=w;c.height=h;
        const ctx=c.getContext("2d",{alpha:false});
        ctx.fillStyle="#000";ctx.fillRect(0,0,w,h);
        ctx.drawImage(bitmap,0,0,w,h);
        return new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error("Não foi possível normalizar a imagem.")),"image/jpeg",quality));
      };
      let bitmap=null;
      try{
        bitmap=await createImageBitmap(sourceFile,{imageOrientation:"from-image"});
      }catch{
        bitmap=await createImageBitmap(sourceFile);
      }
      let w=bitmap.width,h=bitmap.height;
      const ratio=Math.min(1,MAX_INPUT_DIM/Math.max(w,h));
      w=Math.max(1,Math.round(w*ratio));h=Math.max(1,Math.round(h*ratio));
      let quality=.88,blob=await makeBlob(bitmap,w,h,quality);
      while(blob.size>TARGET_BYTES&&quality>.58){
        quality-=.07;
        blob=await makeBlob(bitmap,w,h,quality);
      }
      bitmap.close?.();
      return blob;
    };

    let normalized;
    try{
      normalized=await normalizeImage(file);
    }catch(e){
      console.error("Falha ao preparar imagem:",e);
      toast("Não foi possível preparar essa imagem.");
      return;
    }
    const src=URL.createObjectURL(normalized);
    const img=new Image();
    img.decoding="async";
    img.onload=()=>{
      const m=open("Editar foto",`<div class="crop-fullscreen" id="cropArea"><div class="crop-viewport"><img class="crop-img" id="cropImg" src="${src}"><div class="crop-grid"></div></div><div class="crop-bottom"><span class="crop-zoom-hint">Aperte com dois dedos para ampliar</span></div><div class="crop-preparing" id="cropStatus"></div><button type="button" class="crop-save-floating" id="cropSave">Salvar foto</button></div>`,``);
      const viewport=m.querySelector(".crop-viewport"),im=m.querySelector("#cropImg"),save=m.querySelector("#cropSave"),status=m.querySelector("#cropStatus");
      let zoom=1,px=0,py=0,drag=false,startX=0,startY=0,startPx=0,startPy=0,pinch=false,pinchStartDist=0,pinchStartZoom=1,pinchCenterX=0,pinchCenterY=0,snapTimer=0;
      const getSize=()=>{const r=viewport.getBoundingClientRect(),gap=Math.max(18,Math.min(28,r.width*.055));return Math.max(240,Math.min(r.width-gap*2,r.height-gap*2))};
      const metrics=()=>{const size=getSize(),w=img.naturalWidth,h=img.naturalHeight,fit=Math.max(size/w,size/h),scale=fit*zoom;return {size,w,h,scale,cw:w*scale,ch:h*scale,left:(viewport.clientWidth-size)/2,top:(viewport.clientHeight-size)/2}};
      const limits=()=>{const q=metrics();return {q,minX:q.size-q.cw,maxX:0,minY:q.size-q.ch,maxY:0}};
      const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
      const draw=(animate=false)=>{const q=metrics();im.style.width=q.cw+"px";im.style.height=q.ch+"px";im.style.left=q.left+px+"px";im.style.top=q.top+py+"px";viewport.style.setProperty("--crop-size",q.size+"px");if(animate)im.classList.add("crop-snap");else im.classList.remove("crop-snap")};
      const snap=()=>{const l=limits(),nx=clamp(px,l.minX,l.maxX),ny=clamp(py,l.minY,l.maxY);if(Math.abs(nx-px)>.1||Math.abs(ny-py)>.1){px=nx;py=ny;draw(true);clearTimeout(snapTimer);snapTimer=setTimeout(()=>im.classList.remove("crop-snap"),180)}else draw(false)};
      const setZoom=(z,cx=viewport.clientWidth/2,cy=viewport.clientHeight/2)=>{const old=metrics(),oldScale=old.scale;zoom=clamp(z,1,5);const next=metrics(),factor=next.scale/oldScale||1;px=cx-(cx-px)*factor;py=cy-(cy-py)*factor;const l=limits();px=clamp(px,l.minX,l.maxX);py=clamp(py,l.minY,l.maxY);draw(false)};
      const distance=(a,b)=>Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY),midpoint=(a,b)=>({x:(a.clientX+b.clientX)/2,y:(a.clientY+b.clientY)/2});
      const pointers=new Map();
      viewport.onpointerdown=e=>{pointers.set(e.pointerId,e);viewport.setPointerCapture?.(e.pointerId);if(pointers.size===2){pinch=true;drag=false;const ps=[...pointers.values()];pinchStartDist=distance(ps[0],ps[1]);pinchStartZoom=zoom;const mid=midpoint(ps[0],ps[1]),r=viewport.getBoundingClientRect();pinchCenterX=mid.x-r.left;pinchCenterY=mid.y-r.top}else if(pointers.size===1){drag=true;startX=e.clientX;startY=e.clientY;startPx=px;startPy=py}};
      viewport.onpointermove=e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,e);if(pointers.size===2){const ps=[...pointers.values()],d=distance(ps[0],ps[1]);if(pinchStartDist)setZoom(pinchStartZoom*(d/pinchStartDist),pinchCenterX,pinchCenterY)}else if(drag&&!pinch){px=startPx+(e.clientX-startX);py=startPy+(e.clientY-startY);draw(false)}};
      const endPointer=e=>{pointers.delete(e.pointerId);if(pointers.size===0){drag=false;pinch=false;snap()}else if(pointers.size===1){const p=[...pointers.values()][0];drag=true;startX=p.clientX;startY=p.clientY;startPx=px;startPy=py;pinch=false}};
      viewport.onpointerup=endPointer;viewport.onpointercancel=endPointer;
      viewport.onwheel=e=>{e.preventDefault();const r=viewport.getBoundingClientRect();setZoom(zoom*(e.deltaY<0?1.08:.93),e.clientX-r.left,e.clientY-r.top);snap()};
      save.onclick=async()=>{
        save.disabled=true;save.textContent="Preparando...";status.textContent="Gerando foto...";status.classList.add("show");
        try{
          snap();await new Promise(r=>requestAnimationFrame(r));
          const q=metrics(),size=q.size,canvas=document.createElement("canvas");canvas.width=canvas.height=384;
          const ctx=canvas.getContext("2d",{alpha:false});ctx.fillStyle="#000";ctx.fillRect(0,0,512,512);
          ctx.drawImage(img,(px<0?-px:0)/q.scale,(py<0?-py:0)/q.scale,size/q.scale,size/q.scale,0,0,512,512);
          let quality=.9,blob=await new Promise((res,rej)=>canvas.toBlob(b=>b?res(b):rej(new Error("Não foi possível gerar o JPEG.")),"image/jpeg",quality));
          while(blob.size>180*1024&&quality>.45){quality-=.05;blob=await new Promise((res,rej)=>canvas.toBlob(b=>b?res(b):rej(new Error("Não foi possível comprimir o avatar.")),"image/jpeg",quality))}
          status.textContent="Convertendo...";save.textContent="Convertendo...";
          const dataUrl=await new Promise((resolve,reject)=>{
            const reader=new FileReader();
            reader.onload=()=>resolve(reader.result);
            reader.onerror=()=>reject(new Error("Não foi possível converter o avatar para Base64."));
            reader.readAsDataURL(blob);
          });
          const base64Bytes=String(dataUrl).length;
          if(base64Bytes>850*1024) throw new Error("Avatar comprimido ainda ficou grande demais para o documento do Firestore.");
          save.textContent="Salvando...";status.textContent="Salvando avatar...";
          await setDoc(doc(db,"users",u.uid,"profile","avatar"),{
            dataUrl,
            mimeType:"image/jpeg",
            bytes:blob.size,
            updatedAt:serverTimestamp()
          });
          avatarCache.set(u.uid,dataUrl);
          me.avatarDataUrl=dataUrl;
          av(me);
          URL.revokeObjectURL(src);close();toast("Foto atualizada.");
        }catch(e){console.error("Erro completo ao salvar avatar:",e);console.error("code:",e?.code,"message:",e?.message,"serverResponse:",e?.serverResponse);save.disabled=false;save.textContent="Salvar foto";status.classList.remove("show");toast(`Erro ao salvar avatar: ${e?.code||e?.message||"verifique o console"}`)}
      };
      const init=()=>{draw(false);snap()};requestAnimationFrame(init);window.addEventListener("resize",init,{once:false});
    };
    img.onerror=()=>{URL.revokeObjectURL(src);toast("Não foi possível abrir essa imagem. Tente outra foto.")};
    img.src=src;
  };

  $("#back").onclick=()=>window.router?.navigate("/home");$("#copy").onclick=copy;
  $("#cam").onclick=e=>{$("#photo").click()};$("#photo").addEventListener("change",e=>{const f=e.target.files?.[0];if(f){if(!f.type.startsWith("image/"))toast("Selecione uma imagem.");else if(f.size>50e6)toast("Essa imagem excede o limite de 50 MB.");else openCrop(f)}e.target.value=""});

  $("#add").onclick=()=>{let m=open("Adicionar amigo",`<p style="color:var(--text-secondary);font-size:.82rem">Digite o UID exato do seu colega para enviar uma solicitação.</p><input class="mi" id="fid" placeholder="UID do usuário" autocomplete="off">`,`<div class="mf"><button type="button" class="btn" id="cancel">Cancelar</button><button type="button" class="btn primary" id="send">Enviar solicitação</button></div>`);m.querySelector("#cancel").onclick=close;m.querySelector("#send").onclick=async()=>{let id=m.querySelector("#fid").value.trim(),b=m.querySelector("#send");if(!id||id===u.uid)return toast("UID inválido.");b.disabled=true;b.textContent="Enviando...";try{const [targetSnap,meSnap]=await Promise.all([getDoc(doc(db,"users",id)),getDoc(doc(db,"users",u.uid))]);if(!targetSnap.exists())throw Error("notfound");const md=meSnap.data()||{},td=targetSnap.data()||{};if((md.friends||[]).includes(id))throw Error("friends");if((sentRequests||[]).some(x=>x.uid===id))throw Error("pending");if((requests||[]).some(x=>x.uid===id))throw Error("incoming");const payload={uid:u.uid,username:me.username||md.username||"Usuário",createdAt:serverTimestamp()};const sent={uid:id,username:td.username||"Usuário"};await setDoc(doc(db,"users",id,"friendRequests",u.uid),payload);await setDoc(doc(db,"users",u.uid,"sentFriendRequests",id),sent);await setDoc(doc(db,"users",u.uid),{pendingFriendRequests:arrayUnion(sent)},{merge:true});sentRequests=[...sentRequests.filter(x=>x.uid!==id),sent];renderSent();close();toast("Solicitação enviada.")}catch(e){console.error("Erro ao enviar solicitação:",e);b.disabled=false;b.textContent="Enviar solicitação";toast(e.message==="notfound"?"Usuário não encontrado.":e.message==="friends"?"Vocês já são amigos.":e.message==="pending"?"Solicitação já enviada.":e.message==="incoming"?"Esse usuário já enviou uma solicitação para você.":`Não foi possível enviar: ${e?.code||e?.message||"erro desconhecido"}`)}}};

  const menu=$("#profileMenu"),settings=$("#settings");
  const closeMenu=()=>{menu.hidden=true;settings.setAttribute("aria-expanded","false")};
  settings.onclick=e=>{e.stopPropagation();menu.hidden=!menu.hidden;settings.setAttribute("aria-expanded",String(!menu.hidden))};
  menu.onclick=async e=>{const b=e.target.closest("button[data-menu]");if(!b)return;const action=b.dataset.menu;closeMenu();if(action==="logout"){signOut(auth).catch(err=>{console.error(err);toast("Não foi possível sair." )});return}if(action==="support"){window.location.href="mailto:machado.matheus@live.com?subject=Suporte%20-%20RPG";return}if(action==="notifications"){
      try{
        b.disabled=true;
        const token=await enableARolePlayPushNotifications();
        b.disabled=false;
        if(token) toast("Notificações ativadas neste aparelho.");
        else toast("Permissão de notificações não concedida.");
      }catch(e){
        console.error("[A Role Play] Erro ao ativar notificações:",e);
        b.disabled=false;
        toast(`Não foi possível ativar notificações: ${e?.message||e?.code||"erro desconhecido"}`);
      }
      return;
    }if(action==="profile"){const m=open("Editar perfil",`<label>Nome de usuário</label><input class="mi" id="newname" maxlength="30" value="${esc(me.username)}"><div style="height:12px"></div><label>E-mail</label><input class="mi" id="newemail" type="email" value="${esc(u.email||"")}" placeholder="Seu e-mail"><p style="color:var(--text-muted);font-size:.72rem;margin:8px 0 14px">A alteração do e-mail e da senha pode exigir autenticação recente.</p><button type="button" class="btn" id="requestEmail" style="width:100%;margin-bottom:8px">Solicitar troca de e-mail</button><button type="button" class="btn" id="requestPassword" style="width:100%">Solicitar troca de senha</button>`,`<div class="mf"><button type="button" class="btn" id="cancel">Cancelar</button><button type="button" class="btn primary" id="save">Salvar nome</button></div>`);m.querySelector("#cancel").onclick=close;m.querySelector("#save").onclick=async()=>{const n=m.querySelector("#newname").value.trim();if(n.length<3||n.length>30)return toast("Nome deve ter entre 3 e 30 caracteres.");try{if(n!==me.username){await updateProfile(u,{displayName:n});await updateDoc(doc(db,"users",u.uid),{username:n});me.username=n}close();toast("Perfil atualizado.")}catch(e){console.error(e);toast("Não foi possível atualizar o perfil.")}};m.querySelector("#requestEmail").onclick=async()=>{const email=m.querySelector("#newemail").value.trim();if(!email||!email.includes("@"))return toast("Digite um e-mail válido.");try{await updateProfile(u,{displayName:me.username});await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js").then(({sendEmailVerification})=>sendEmailVerification(u));toast("Solicitação iniciada. Verifique seu e-mail.")}catch(e){console.error(e);toast(e.code==="auth/requires-recent-login"?"Entre novamente para solicitar a troca.":"Não foi possível solicitar a troca.")}};m.querySelector("#requestPassword").onclick=async()=>{try{const {sendPasswordResetEmail}=await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js");await sendPasswordResetEmail(auth,u.email);toast("Link para trocar a senha enviado para seu e-mail.")}catch(e){console.error(e);toast("Não foi possível enviar o link de troca de senha.")}};}};
  document.addEventListener("click",e=>{if(!e.target.closest(".menu-wrap"))closeMenu()});

  onSnapshot(doc(db,"users",u.uid),async s=>{if(s.exists()){me={uid:u.uid,...s.data()};me.avatarDataUrl=await getAvatar(u.uid);await render();await renderSent()}},e=>console.error("Perfil:",e));
  onSnapshot(query(collection(db,"users",u.uid,"sentFriendRequests")),s=>{sentRequests=s.docs.map(d=>({uid:d.id,...d.data()}));renderSent()},e=>{console.error("Solicitações enviadas:",e);sentRequests=[];renderSent()});
  onSnapshot(query(collection(db,"users",u.uid,"friendRequests")),s=>{requests=s.docs.map(d=>({uid:d.id,...d.data()})).filter(r=>!r.cancelled);renderReq()},e=>{console.error("Pedidos recebidos:",e);requests=[];renderReq()});
  render();return root;
}
