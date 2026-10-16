"use strict";
(function(){
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const KEY="tidekin-guest-v1";
const A={
 skin:["#f5c9a8","#dfaa88","#b77e61","#895b48","#f8dcc5"],
 hair:["#3b2930","#7a4535","#cd8a54","#e8c287","#b6b4dc"],
 outfit:["#e78da2","#b5a2ea","#93b9cd","#8cc5ae","#f2b16f"],
 style:[["soft","✿"],["bob","◕"],["buns","♡"],["curly","〰"],["short","✦"]]
};
const catalog=[
 ["bed","🛏️","Cozy bed"],["sofa","🛋️","Cloud sofa"],["desk","🖥️","Study desk"],
 ["chair","🪑","Chair"],["table","☕","Tea table"],["plant","🌿","Happy plant"],
 ["lamp","💡","Glow lamp"],["bookshelf","📚","Book nook"],["rug","🧶","Soft rug"],
 ["stool","🪑","Stool"],["cabinet","🪟","Cabinet"]
];
const state={token:null,me:null,room:null,visitCode:null,game:null,ws:null,
 editing:false,selected:null,stamp:null,saveTimer:null,saving:Promise.resolve(),revision:0,
 lastInteraction:Date.now(),idle:false,connectionFailures:0,toastTimer:null};
const fonts={"blush":"#f9dee7","cream":"#ffeedc","sage":"#d9ebe3","sky":"#dbebfa","lilac":"#eae1f9"};
const names={"blush":"Blush","cream":"Vanilla","sage":"Sage","sky":"Daydream","lilac":"Lilac"};
const foot={"honey":"#efd9b7","birch":"#f4e8d8","walnut":"#c6a792","rose":"#efced1"};
const notify=(message,seconds=2800)=>{
 const n=$("#toast");n.textContent=message;n.hidden=false;
 clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>n.hidden=true,seconds);
};
const request=async(path,{method="GET",data=null,token=state.token}={})=>{
 const response=await fetch(path,{method,headers:{
   ...(data!==null?{"Content-Type":"application/json"}:{}),...(token?{Authorization:"Bearer "+token}:{})
 },body:data===null?undefined:JSON.stringify(data),cache:"no-store",credentials:"same-origin"});
 const json=await response.json().catch(()=>({error:"Unexpected server response"}));
 if(!response.ok)throw Error(json.error||"Request failed");
 return json;
};
const owner=()=>!!state.me&&!!state.room&&state.room.ownerId===state.me.id;
const ownCode=()=>state.me?.roomCode;
function setSaved(status,msg){
 $("#saveLabel").textContent=msg||status;
 const d=$("#saveDot");d.className=status==="saving"?"saving":status==="error"?"error":"";
}
function updateTitle(){
 if(!state.me||!state.room)return;
 const isOwner=owner();
 $("#railName").textContent=state.me.name;$("#crumbRoom").textContent=isOwner?"My nook":"Visiting";
 $("#mainHeading").replaceChildren(document.createTextNode((isOwner?"Welcome home, ":"Hello, ")+state.me.name+" "),
 Object.assign(document.createElement("span"),{textContent:"✿"}));
 $("#mainSubheading").textContent=isOwner?"A place to slow down, make memories, and simply be.":"You're spending a little time in someone else's world.";
 $("#roomTitle").textContent=state.room.name||"Cozy nook";$("#roomMood").textContent=state.room.activity||"Relaxing";
 $("#roomMeta").textContent=(isOwner?"PERSONAL SPACE":"FRIEND'S NOOK")+" · 2.5D";
 $("#visitBanner").hidden=isOwner;
 $("#visitName").textContent=state.room.ownerName||"a neighbor";
 $("#decorateButton").disabled=!isOwner;
 $("#studioEditToggle").disabled=!isOwner;
 $("#editRoomName").value=state.room.name;
 $("#activitySelect").value=state.room.activity;
 $("#editNickname").value=state.me.name;
 $("#myRoomCode").textContent=state.me.roomCode;
 $("#worldTip").textContent=isOwner?(state.editing?"Long-press and drag furniture. Tap empty floor to place a piece.":"Your world, your pace. Tap to take a little walk."):"Have a look around — your host's furniture stays just as they left it.";
 $$("[data-nav=home]").forEach(b=>b.classList.toggle("active",isOwner));
}
function painter(){
 if(!state.game){
  state.game=new TidekinGame($("#worldCanvas"),{
   canEdit:()=>owner(),
   onMove:(x,y)=>sendWs({type:"move",x,y}),
   onSelect:id=>{
    state.selected=id;
    const item=state.room?.furniture.find(f=>f.id===id);
    $("#selectedFurniture").hidden=!item;
    if(item)$("#selectedFurnitureName").textContent=catalog.find(row=>row[0]===item.type)?.[2]||item.type;
   },
   onPlace:(type,x,y)=>{
    if(!owner())return;
    if(state.room.furniture.length>=30){notify("Your room is full for now — remove something first.");return;}
    const item={id:"item-"+crypto.randomUUID().replace(/-/g,"").slice(0,14),type,x:Math.round(x*10)/10,y:Math.round(y*10)/10,rotation:0};
    state.room.furniture.push(item);state.game.setRoom(state.room);state.stamp=null;state.game.setStamp(null);
    paintCatalog();scheduleSave();notify("Placed your new "+(catalog.find(r=>r[0]===type)?.[2]||"furniture")+" ✧");
   },
   onRearrange:furniture=>{
    if(!owner())return;
    state.room.furniture=furniture;scheduleSave();
   }
  });
 }
 state.game.setMe(state.me.id,state.me.name,state.me.avatar);
 state.game.setRoom(state.room);
 $("#sceneLoading").hidden=true;
 showAvatarPreview();
 updateTitle();buildPalette();paintCatalog();
}
function showAvatarPreview(){
 const c=$("#avatarCanvas"),g=c.getContext("2d");g.clearRect(0,0,c.width,c.height);
 g.save();g.translate(130,245);TidekinDrawAvatar(g,0,0,state.me.avatar,0,1.47,1);g.restore();
}
function changeAvatar(patch){
 state.me.avatar={...state.me.avatar,...patch};
 state.game?.setAvatar(state.me.avatar);
 showAvatarPreview();buildPalette();scheduleSave();
}
function paintSwatch(holder,color,selected,callback,label){
 const b=document.createElement("button");b.type="button";b.style.setProperty("--swatch",color);
 b.classList.toggle("selected",selected===color);b.title=label||color;b.setAttribute("aria-label",label||color);
 b.setAttribute("aria-pressed",selected===color?"true":"false");
 b.addEventListener("click",()=>callback(color));holder.append(b);
}
function buildPalette(){
 if(!state.me||!state.room)return;
 const hair=$("#hairStyles");hair.replaceChildren();
 for(const [id,em] of A.style){const b=document.createElement("button");b.type="button";b.textContent=em;
   b.title=id;b.setAttribute("aria-label",id+" hairstyle");b.classList.toggle("selected",state.me.avatar.style===id);
   b.addEventListener("click",()=>changeAvatar({style:id}));hair.append(b);}
 for(const key of ["skin","hair","outfit"]){const holder=$("#"+key+"Swatches");holder.replaceChildren();
   for(const color of A[key])paintSwatch(holder,color,state.me.avatar[key],c=>changeAvatar({[key]:c}),key+" "+color);
 }
 const wall=$("#wallSwatches");wall.replaceChildren();
 for(const [id,color] of Object.entries(fonts))paintSwatch(wall,color,state.room.wallpaper,id2=>{
   if(!owner())return notify("Only the room owner can change the walls.");
   state.room.wallpaper=id;state.game.setRoom(state.room);buildPalette();scheduleSave();
 },names[id]);
 const floor=$("#floorSwatches");floor.replaceChildren();
 for(const [id,color] of Object.entries(foot))paintSwatch(floor,color,state.room.floor,()=>{
   if(!owner())return notify("Only the room owner can change the floor.");
   state.room.floor=id;state.game.setRoom(state.room);buildPalette();scheduleSave();
 },id+" floor");
}
function paintCatalog(){
 const box=$("#furnitureCatalog");box.replaceChildren();
 for(const [type,emoji,label] of catalog){const b=document.createElement("button");b.type="button";
   b.classList.toggle("selected",state.stamp===type);b.title="Place "+label;
   const face=document.createElement("span");face.textContent=emoji;
   const desc=document.createElement("small");desc.textContent=label;
   b.append(face,desc);
   b.addEventListener("click",()=>{
     if(!owner())return notify("You can decorate only your own home.");
     setEditing(true);state.stamp=type;state.game.setStamp(type);paintCatalog();
     notify("Tap a free spot in your room to place "+label.toLowerCase()+".");
   });box.append(b);}
}
function setEditing(enabled){
 state.editing=!!enabled&&owner();
 state.selected=null;state.stamp=null;
 state.game?.setEditing(state.editing);
 $("#canvasStage").classList.toggle("editing",state.editing);
 $("#decorateButton").classList.toggle("active",state.editing);
 $("#studioEditToggle").classList.toggle("active",state.editing);
 $("#studioEditToggle").textContent=state.editing?"✓ Done decorating":"✧ Start decorating →";
 $("#worldTip").textContent=state.editing?"Tap furniture to select it. Drag to move it.":"Your world, your pace. Tap to take a little walk.";
 $("#stageHint").textContent=state.editing?"✧ Drag furniture or choose a piece to place":"👆 Tap anywhere on the floor to wander";
 $("#selectedFurniture").hidden=true;paintCatalog();
}
function scheduleSave(){
 if(!state.me||!state.token)return;
 state.revision++;setSaved("saving","Tucking away your changes…");
 clearTimeout(state.saveTimer);state.saveTimer=setTimeout(saveNow,620);
}
function saveNow(){
 if(!state.me||!state.token)return Promise.resolve();
 clearTimeout(state.saveTimer);
 const version=state.revision;
 const patch={name:state.me.name,avatar:structuredClone(state.me.avatar)};
 if(owner()){
  patch.room={name:state.room.name,wallpaper:state.room.wallpaper,floor:state.room.floor,
     activity:state.room.activity,furniture:structuredClone(state.room.furniture)};
 }
 state.saving=state.saving.catch(()=>{}).then(async()=>{
   try{
    const result=await request("/api/me",{method:"PUT",data:patch});
    state.me.name=result.name;state.me.avatar=result.avatar;
    if(version===state.revision)setSaved("saved","All your little changes are safe ♡");
   }catch(err){
    setSaved("error","Couldn't save — tap ↻ to retry");
    notify("Saving failed: "+err.message,5000);
   }
 });
 return state.saving;
}
function setActiveTab(tab){
 $$("[data-tab]").forEach(b=>{b.classList.toggle("active",b.dataset.tab===tab);b.setAttribute("aria-selected",String(b.dataset.tab===tab));});
 $$("[data-studio]").forEach(p=>p.hidden=p.dataset.studio!==tab);
 if(tab==="decor"&&!owner())notify("Decorating is available only inside your own room.");
}
function showPanel(tab){
 closeSheets();
 if(tab)setActiveTab(tab);
 $("#studioPanel").classList.add("show");
 if(matchMedia("(max-width:1160px)").matches)$("#sheetBackdrop").hidden=false;
}
function hidePanel(){
 $("#studioPanel").classList.remove("show");
 $("#sheetBackdrop").hidden=true;
}
function closeSheets(){
 $("#friendsSheet").hidden=true;$("#seasideSheet").hidden=true;
 $("#sheetBackdrop").hidden=!$("#studioPanel").classList.contains("show");
}
function showSheet(id){
 hidePanel();$("#friendsSheet").hidden=id!=="friends";$("#seasideSheet").hidden=id!=="seaside";
 $("#sheetBackdrop").hidden=false;
}
function allClosed(){closeSheets();hidePanel();}
function doNav(section){
 if(section==="home"){goHome();allClosed();}
 if(section==="visit"){showSheet("friends");}
 if(section==="seaside"){showSheet("seaside");}
 if(section==="decorate"){setActiveTab("decor");setEditing(true);showPanel("decor");}
 if(section==="avatar"){showPanel("avatar");}
 if(section==="settings"){showPanel("room");}
}
function copyText(text){
 if(navigator.clipboard?.writeText)return navigator.clipboard.writeText(text);
 const t=document.createElement("textarea");t.value=text;document.body.append(t);t.select();
 const ok=document.execCommand?.("copy");t.remove();return ok?Promise.resolve():Promise.reject(Error("Clipboard unavailable"));
}
function inviteLink(){return location.origin+"/?visit="+state.me.roomCode;}
async function copyInvite(){
 if(!state.me)return;
 try{await copyText(inviteLink());notify("Invite link copied! Share it with your favorite person ♡");}
 catch{notify("Your invite link: "+inviteLink(),6000);}
}
function socketClose(){if(state.ws){state.ws.onclose=null;state.ws.close();state.ws=null;}}
function connect(){
 if(!state.token||!state.room)return;
 socketClose();
 const url=(location.protocol==="https:"?"wss://":"ws://")+location.host+"/live";
 const ws=new WebSocket(url);state.ws=ws;
 ws.addEventListener("open",()=>{state.connectionFailures=0;ws.send(JSON.stringify({type:"join",token:state.token,code:state.room.code}));});
 ws.addEventListener("message",e=>{
   let msg;try{msg=JSON.parse(e.data);}catch{return;}
   if(ws!==state.ws)return;
   if(msg.type==="joined"){
     if(msg.room?.code===state.room?.code){state.room=msg.room;state.game?.setRoom(state.room);updateTitle();buildPalette();}
     state.game?.setVisitors(msg.players);showPresence(msg.players);return;
   }
   if(msg.type==="presence"){state.game?.setVisitors(msg.players);showPresence(msg.players);return;}
   if(msg.type==="room-update"&&msg.room?.code===state.room?.code){
     if(!owner()||!state.editing){state.room=msg.room;state.game?.setRoom(msg.room);updateTitle();buildPalette();}
     return;
   }
   if(msg.type==="move"){state.game?.updatePosition(msg.id,msg.x,msg.y);return;}
   if(msg.type==="wave"){state.game?.wave(msg.id);if(msg.id!==state.me.id)notify("Someone sent a little wave your way ♡");return;}
   if(msg.type==="error")notify(msg.message,3500);
 });
 ws.addEventListener("close",()=>{
   if(ws!==state.ws)return;
   state.connectionFailures++;
   $("#presenceSubtitle").textContent="Reconnecting to the neighborhood…";
   setTimeout(()=>{if(state.ws===ws&&state.room)connect();},Math.min(15000,1100*Math.pow(1.7,state.connectionFailures)));
 });
 ws.addEventListener("error",()=>{});
}
function showPresence(players=[]){
 const other=players.filter(p=>p.id!==state.me.id),host=players.find(p=>p.id===state.room.ownerId);
 $("#visitCount").textContent=other.length?other.length+" neighbor"+(other.length>1?"s":"")+" here":"Just you for now";
 $("#presenceSubtitle").textContent=owner()?(other.length?"You're together in your nook ♡":"Your room is ready for friends"):(host?(host.idle?"Host is idle":"Host is here with you"):"Host is currently away");
 $("#visitCount").parentElement.parentElement.title=other.map(p=>p.name+(p.idle?" (idle)":" (online)")).join(", ")||"No other guests in this room";
}
function sendWs(object){if(state.ws?.readyState===WebSocket.OPEN)state.ws.send(JSON.stringify(object));}
async function joinRoom(code){
 code=String(code||"").trim().replace(/\s/g,"").toUpperCase();
 if(!/^[A-HJ-NP-Z2-9]{7}$/.test(code))throw Error("Room codes have 7 letters or numbers.");
 if(code===ownCode()){goHome();return;}
 const data=await request("/api/rooms/"+encodeURIComponent(code),{token:null});
 state.room=data.room;state.visitCode=code;setEditing(false);state.game.setRoom(state.room);
 updateTitle();buildPalette();showPresence(data.players);
 history.replaceState(null,"",location.pathname+"?visit="+code);
 connect();allClosed();notify("Welcome to "+data.room.ownerName+"'s little nook ✿");
}
function goHome(){
 if(!state.me||!state.game)return;
 if(state.room.code===ownCode()){hidePanel();return;}
 state.room=structuredClone(state.me.room);state.visitCode=null;state.game.setRoom(state.room);setEditing(false);
 updateTitle();buildPalette();history.replaceState(null,"",location.pathname);connect();
 notify("You're back in your little nook ♡");
}
async function register(name){
 const created=await request("/api/guest",{method:"POST",data:{name},token:null});
 state.token=created.token;state.me={id:created.id,name:created.name,avatar:created.avatar,roomCode:created.roomCode,room:created.room};
 localStorage.setItem(KEY,state.token);return created;
}
async function startGame(){
 $("#loading").hidden=true;$("#onboarding").hidden=true;$("#gameApp").hidden=false;
 state.room=structuredClone(state.me.room);
 painter();connect();
 const visit=new URLSearchParams(location.search).get("visit");
 if(visit&&visit.toUpperCase()!==ownCode()){
   try{await joinRoom(visit);}catch(err){notify("Couldn't visit the room: "+err.message,4700);history.replaceState(null,"",location.pathname);}
 }
}
function initUI(){
 $("#startForm").addEventListener("submit",async e=>{
   e.preventDefault();const name=$("#startName").value.trim(),button=$("#startButton");button.disabled=true;
   $("#startError").textContent="";
   try{await register(name);await startGame();}
   catch(err){$("#startError").textContent=err.message;button.disabled=false;}
 });
 $$("[data-nav]").forEach(b=>b.addEventListener("click",()=>doNav(b.dataset.nav)));
 $$("[data-mobile]").forEach(b=>b.addEventListener("click",()=>{
   const route=b.dataset.mobile;
   $$("[data-mobile]").forEach(x=>x.classList.toggle("active",x===b));
   doNav(route==="decor"?"decorate":route);
 }));
 $("#topInvite").addEventListener("click",()=>showSheet("friends"));
 $("#quickInvite").addEventListener("click",()=>showSheet("friends"));
 $("#railIdentity").addEventListener("click",()=>showPanel("room"));
 $("#topProfile").addEventListener("click",()=>showPanel("avatar"));
 $("#shorePreview").addEventListener("click",()=>showSheet("seaside"));
 $("#openSettings").addEventListener("click",()=>showPanel("room"));
 $("#studioEditToggle").addEventListener("click",()=>setEditing(!state.editing));
 $("#decorateButton").addEventListener("click",()=>{
   if(!owner())return notify("Only the owner can decorate this nook.");
   setEditing(!state.editing);if(state.editing){setActiveTab("decor");if(matchMedia("(max-width:1160px)").matches)showPanel("decor");}
 });
 $("#waveButton").addEventListener("click",()=>{state.game?.wave(state.me.id);sendWs({type:"wave"});notify("A little wave for everyone here ♡");});
 $("#saveSnapshot").addEventListener("click",()=>{
   try{const url=state.game.exportPNG(),a=document.createElement("a");a.href=url;a.download="tidekin-"+(state.room.code||"nook")+".png";a.click();notify("Your little room portrait is ready ♡");}
   catch{notify("Could not save the picture on this device.");}
 });
 $("#returnHome").addEventListener("click",goHome);
 $$("[data-tab]").forEach(b=>b.addEventListener("click",()=>setActiveTab(b.dataset.tab)));
 $("#rotateFurniture").addEventListener("click",()=>{
   if(!owner()||!state.selected)return;
   const item=state.room.furniture.find(f=>f.id===state.selected);if(!item)return;
   item.rotation=(item.rotation+1)%4;state.game.setRoom(state.room);scheduleSave();notify("Furniture rotated ↻");
 });
 $("#removeFurniture").addEventListener("click",()=>{
   if(!owner()||!state.selected)return;
   state.room.furniture=state.room.furniture.filter(f=>f.id!==state.selected);
   state.game.setRoom(state.room);state.selected=null;$("#selectedFurniture").hidden=true;
   scheduleSave();notify("Moved that piece into storage.");
 });
 $("#editRoomName").addEventListener("change",e=>{if(owner()){state.room.name=e.target.value.trim().slice(0,38)||"My little nook";updateTitle();scheduleSave();}});
 $("#activitySelect").addEventListener("change",e=>{if(owner()){state.room.activity=e.target.value;updateTitle();scheduleSave();}});
 $("#editNickname").addEventListener("change",e=>{const name=e.target.value.trim();if(name.length<2)return notify("Nickname should have 2 characters or more");
   state.me.name=name;state.game.setMe(state.me.id,name,state.me.avatar);updateTitle();scheduleSave();});
 $("#saveRoomButton").addEventListener("click",async()=>{
   if(!owner())return notify("You can change only your own room.");
   state.room.name=$("#editRoomName").value.trim().slice(0,38)||state.room.name;
   state.room.activity=$("#activitySelect").value;
   const nick=$("#editNickname").value.trim();if(nick.length>=2)state.me.name=nick;
   state.game.setMe(state.me.id,state.me.name,state.me.avatar);updateTitle();
   state.revision++;await saveNow();notify("Your space feels just right ♡");
 });
 $("#manualSave").addEventListener("click",()=>{state.revision++;saveNow();});
 $("#copyInviteLink").addEventListener("click",copyInvite);
 $("#copyRoomCode").addEventListener("click",async()=>{try{await copyText(state.me.roomCode);notify("Room code copied!");}catch{notify("Room code: "+state.me.roomCode);}});
 $("#visitForm").addEventListener("submit",async e=>{
   e.preventDefault();$("#visitError").textContent="";
   try{await joinRoom($("#visitCode").value);}catch(err){$("#visitError").textContent=err.message;}
 });
 $("#sheetBackdrop").addEventListener("click",allClosed);
 $$("[data-close-sheet]").forEach(b=>b.addEventListener("click",allClosed));
 window.addEventListener("keydown",e=>{if(e.key==="Escape")allClosed();});
 document.addEventListener("visibilitychange",()=>{
  if(document.hidden){state.idle=true;sendWs({type:"idle",idle:true});}
  else{state.idle=false;state.lastInteraction=Date.now();sendWs({type:"idle",idle:false});}
 });
 const interact=()=>{
   state.lastInteraction=Date.now();
   if(state.idle){state.idle=false;sendWs({type:"idle",idle:false});}
 };
 document.addEventListener("pointerdown",interact,{passive:true});
 document.addEventListener("keydown",interact,{passive:true});
 setInterval(()=>{
   if(!state.idle&&Date.now()-state.lastInteraction>90000){state.idle=true;sendWs({type:"idle",idle:true});}
 },15000);
}
async function boot(){
 initUI();
 const token=localStorage.getItem(KEY);
 if(token){
  try{
    state.token=token;const me=await request("/api/me");
    state.me=me;await startGame();return;
  }catch(err){console.warn("Guest session needs a fresh start:",err.message);state.token=null;localStorage.removeItem(KEY);}
 }
 $("#loading").hidden=true;$("#onboarding").hidden=false;
}
boot();
})();
