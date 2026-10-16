"use strict";
const http=require("node:http"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {WebSocketServer,WebSocket}=require("ws");
const PORT=Number(process.env.PORT||3000),dir=process.env.DATA_DIR||path.join(__dirname,".local-data");
fs.mkdirSync(dir,{recursive:true});
const pathDb=path.join(dir,"world.json");
const WORLD_SIZE=9;
const allowedFurniture=new Set(["bed","sofa","desk","chair","table","plant","lamp","bookshelf","rug","stool","cabinet"]);
const wallpapers=new Set(["blush","cream","sage","sky","lilac"]);
const floors=new Set(["honey","birch","walnut","rose"]);
const statuses=new Set(["Relaxing","Studying","Sleeping","Creating","Daydreaming"]);
const hairStyles=new Set(["soft","bob","buns","curly","short"]);
const colors={skin:new Set(["#f5c9a8","#dfaa88","#b77e61","#895b48","#f8dcc5"]),hair:new Set(["#3b2930","#7a4535","#cd8a54","#e8c287","#b6b4dc"]),outfit:new Set(["#e78da2","#b5a2ea","#93b9cd","#8cc5ae","#f2b16f"])};
const defaults=[
{id:"bed-a",type:"bed",x:1.5,y:1.65,rotation:0},
{id:"rug-a",type:"rug",x:4.15,y:5.1,rotation:0},
{id:"sofa-a",type:"sofa",x:2.5,y:5.7,rotation:0},
{id:"desk-a",type:"desk",x:6.4,y:1.7,rotation:0},
{id:"chair-a",type:"chair",x:6.7,y:3.35,rotation:0},
{id:"plant-a",type:"plant",x:8.25,y:2.25,rotation:0},
{id:"lamp-a",type:"lamp",x:1.1,y:5.15,rotation:0},
{id:"table-a",type:"table",x:4.7,y:4.7,rotation:0},
{id:"bookshelf-a",type:"bookshelf",x:7.8,y:0.72,rotation:0}
];
const fresh=()=>({players:{},rooms:{}});
let db;
try{db=JSON.parse(fs.readFileSync(pathDb,"utf8"));if(!db.players||!db.rooms)throw Error("invalid schema");}
catch(e){if(e.code!=="ENOENT")throw e;db=fresh();}
function persist(){
 const tmp=pathDb+"."+crypto.randomBytes(5).toString("hex")+".tmp";
 fs.writeFileSync(tmp,JSON.stringify(db),{mode:0o600});fs.renameSync(tmp,pathDb);
}
const maxClean=(value,max=40)=>typeof value==="string"?value.trim().replace(/[\x00-\x1f\x7f<>]/g,"").slice(0,max):"";
const digest=t=>crypto.createHash("sha256").update(t).digest("hex");
const authToken=req=>String(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
function identity(token){
 if(!token||token.length>150)return null;
 const h=digest(token);
 return Object.values(db.players).find(p=>p.tokenHash===h)||null;
}
const clients=new Set(),bucket=new Map();
function throttle(key,max,windowMs){
 const now=Date.now();
 if(bucket.size>3000)for(const [k,v] of bucket)if(v.until<now)bucket.delete(k);
 const record=bucket.get(key);
 if(!record||record.until<now){bucket.set(key,{until:now+windowMs,count:1});return false;}
 record.count++;return record.count>max;
}
function ipOf(req){return String(req.headers["x-forwarded-for"]||req.socket.remoteAddress||"unknown").split(",")[0].trim().slice(0,64);}
function sameOrigin(req){
 if(!req.headers.origin)return false;
 try{const url=new URL(req.headers.origin),host=String(req.headers["x-forwarded-host"]||req.headers.host||"").split(",")[0].trim();return url.host===host&&(url.protocol==="http:"||url.protocol==="https:");}catch{return false;}
}
function json(res,status,data){
 const body=JSON.stringify(data);
 res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Content-Length":Buffer.byteLength(body),"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});
 res.end(body);
}
function bad(res,status,error){json(res,status,{error});}
function bodyJson(req,limit=30000){
 return new Promise((resolve,reject)=>{
 let text="",length=0;
 req.on("data",c=>{length+=c.length;if(length>limit){reject(Error("Request too large"));req.destroy();return;}text+=c;});
 req.on("end",()=>{try{resolve(JSON.parse(text||"{}"));}catch{reject(Error("Invalid JSON"));}});
 req.on("error",reject);
 });
}
function guestName(input){return maxClean(input,24).replace(/\s+/g," ");}
function avatarClean(input,old={}){
 const result={};
 for(const [key,allowed] of [["skin",colors.skin],["hair",colors.hair],["outfit",colors.outfit],["style",hairStyles]]){
 const candidate=input?.[key];result[key]=allowed.has(candidate)?candidate:old[key]||(key==="style"?"soft":Array.from(allowed)[0]);
 }
 return result;
}
function furnitureClean(items){
 if(!Array.isArray(items)||items.length>30)throw Error("Furniture must have 30 items or fewer");
 const seen=new Set();
 return items.map(item=>{
  const type=maxClean(item?.type,25),id=maxClean(item?.id,46);
  if(!allowedFurniture.has(type)||!/^[A-Za-z0-9_-]{3,46}$/.test(id)||seen.has(id))throw Error("Invalid or duplicate furniture");
  seen.add(id);
  const x=Number(item.x),y=Number(item.y),rotation=Number(item.rotation);
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<.3||x>8.7||y<.3||y>8.7||
   !Number.isInteger(rotation)||rotation<0||rotation>3)throw Error("Furniture is outside the room");
  return {id,type,x:Math.round(x*10)/10,y:Math.round(y*10)/10,rotation};
 });
}
function roomSummary(room){
 const owner=db.players[room.ownerId];
 return {code:room.code,ownerId:room.ownerId,name:room.name,ownerName:owner?.name||"Neighbor",
  ownerAvatar:owner?.avatar||avatarClean({}),wallpaper:room.wallpaper,floor:room.floor,
  furniture:room.furniture,activity:room.activity||"Relaxing",lastSaved:room.updatedAt};
}
function publicMe(p){const room=db.rooms[p.roomCode];return {id:p.id,name:p.name,avatar:p.avatar,roomCode:p.roomCode,room:roomSummary(room)};}
function occupants(code){
 return [...clients].filter(ws=>ws.readyState===WebSocket.OPEN&&ws.playerId&&ws.roomCode===code)
  .map(ws=>({id:ws.playerId,name:db.players[ws.playerId]?.name||"Neighbor",
   avatar:db.players[ws.playerId]?.avatar||avatarClean({}),x:ws.x,y:ws.y,idle:ws.idle===true,
   activity:db.rooms[db.players[ws.playerId]?.roomCode]?.activity||"Relaxing"}));
}
function send(ws,thing){if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(thing));}
function broadcast(code,thing){for(const ws of clients)if(ws.roomCode===code)send(ws,thing);}
function syncPresence(code){if(code)broadcast(code,{type:"presence",players:occupants(code)});}
function roomCode(){
 for(let tries=0;tries<100;tries++){
  const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let code="";
  for(const b of crypto.randomBytes(7).subarray(0,7))code+=alphabet[b%alphabet.length];
  if(!db.rooms[code])return code;
 }throw Error("Could not generate room code");
}
const assets={"/":"index.html","/index.html":"index.html","/styles.css":"styles.css","/app.js":"app.js","/game.js":"game.js","/favicon.svg":"favicon.svg","/manifest.webmanifest":"manifest.webmanifest"};
const mime={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"application/javascript; charset=utf-8",".svg":"image/svg+xml",".webmanifest":"application/manifest+json"};
async function handler(req,res){
 res.setHeader("X-Frame-Options","DENY");res.setHeader("Referrer-Policy","strict-origin-when-cross-origin");
 res.setHeader("Permissions-Policy","camera=(),microphone=(),geolocation=()");
 res.setHeader("X-Content-Type-Options","nosniff");
 if(req.headers["x-forwarded-proto"]==="https")res.setHeader("Strict-Transport-Security","max-age=31536000; includeSubDomains");
 let pathname;
 try{pathname=new URL(req.url,"http://localhost").pathname;}catch{return bad(res,400,"Malformed URL");}
 if(pathname==="/health")return json(res,200,{status:"ok",game:"Tidekin",players:Object.keys(db.players).length});
 if(req.method==="GET"&&pathname==="/api/me"){
  const me=identity(authToken(req));return me?json(res,200,publicMe(me)):bad(res,401,"Sign in to continue");
 }
 if(req.method==="GET"&&pathname.startsWith("/api/rooms/")){
  const code=pathname.slice(11).toUpperCase();
  const room=db.rooms[code];return room?json(res,200,{room:roomSummary(room),players:occupants(code)}):bad(res,404,"Room not found");
 }
 if(req.method==="POST"&&pathname==="/api/guest"){
  if(!sameOrigin(req))return bad(res,403,"Invalid origin");
  if(throttle("join:"+ipOf(req),10,3600000))return bad(res,429,"Too many new guests. Please try again later.");
  const body=await bodyJson(req);
  const name=guestName(body.name);
  if(name.length<2)return bad(res,400,"Please choose a nickname with at least 2 characters");
  const token=crypto.randomBytes(32).toString("base64url"),id=crypto.randomUUID(),code=roomCode();
  const avatar=avatarClean({skin:"#f5c9a8",hair:"#3b2930",outfit:"#e78da2",style:"soft"});
  db.players[id]={id,name,avatar,roomCode:code,tokenHash:digest(token),joinedAt:new Date().toISOString()};
  db.rooms[code]={code,ownerId:id,name:name+"'s nook",wallpaper:"blush",floor:"honey",
    activity:"Relaxing",furniture:structuredClone(defaults),updatedAt:new Date().toISOString()};
  persist();return json(res,201,{token,...publicMe(db.players[id])});
 }
 if(req.method==="PUT"&&pathname==="/api/me"){
  if(!sameOrigin(req))return bad(res,403,"Invalid origin");
  const me=identity(authToken(req));if(!me)return bad(res,401,"Sign in to continue");
  if(throttle("update:"+me.id,100,60000))return bad(res,429,"Too many updates");
  const body=await bodyJson(req);
  if(body.name!==undefined){const name=guestName(body.name);if(name.length<2)return bad(res,400,"Nickname is too short");me.name=name;}
  if(body.avatar!==undefined)me.avatar=avatarClean(body.avatar,me.avatar);
  const room=db.rooms[me.roomCode];
  if(body.room && typeof body.room==="object" && !Array.isArray(body.room)){
   const patch=body.room;
   if(patch.name!==undefined){room.name=maxClean(patch.name,38)||room.name;}
   if(patch.wallpaper!==undefined&&wallpapers.has(patch.wallpaper))room.wallpaper=patch.wallpaper;
   if(patch.floor!==undefined&&floors.has(patch.floor))room.floor=patch.floor;
   if(patch.activity!==undefined&&statuses.has(patch.activity))room.activity=patch.activity;
   if(patch.furniture!==undefined){try{room.furniture=furnitureClean(patch.furniture);}catch(err){return bad(res,400,err.message);}}
  }
  room.updatedAt=new Date().toISOString();persist();
  broadcast(room.code,{type:"room-update",room:roomSummary(room)});
  syncPresence(room.code);
  return json(res,200,publicMe(me));
 }
 if(pathname.startsWith("/api/"))return bad(res,404,"Not found");
 if(req.method!=="GET"&&req.method!=="HEAD")return bad(res,405,"Method not allowed");
 const filename=assets[pathname];if(!filename)return bad(res,404,"Not found");
 fs.readFile(path.join(__dirname,filename),(e,file)=>{
   if(e)return bad(res,404,"Not found");
   res.writeHead(200,{"Content-Type":mime[path.extname(filename)]||"application/octet-stream",
      "Content-Length":file.length,"Cache-Control":filename.endsWith(".html")?"no-cache":"public,max-age=3600"});
   res.end(req.method==="HEAD"?undefined:file);
 });
}
const server=http.createServer((req,res)=>{handler(req,res).catch(e=>{console.error("Request error",e);if(!res.headersSent)bad(res,500,"Server error");else res.destroy();});});
const wss=new WebSocketServer({noServer:true,maxPayload:4096});
server.on("upgrade",(req,socket,head)=>{
 let url;try{url=new URL(req.url,"http://localhost");}catch{socket.destroy();return;}
 if(url.pathname!=="/live"||!sameOrigin(req)){socket.destroy();return;}
 wss.handleUpgrade(req,socket,head,ws=>wss.emit("connection",ws,req));
});
wss.on("connection",ws=>{
 clients.add(ws);ws.isAlive=true;ws.roomCode=null;ws.playerId=null;ws.x=5;ws.y=6;ws.idle=false;ws.lastMove=0;
 ws.on("pong",()=>{ws.isAlive=true;});
 ws.on("message",chunk=>{
  let message;try{message=JSON.parse(String(chunk));}catch{return;}
  if(!message||typeof message!=="object")return;
  if(message.type==="join"){
   const p=identity(String(message.token||"")),code=maxClean(message.code,8).toUpperCase();
   if(!p||!db.rooms[code])return send(ws,{type:"error",message:"Unable to join room"});
   const previous=ws.roomCode;ws.playerId=p.id;ws.roomCode=code;ws.x=5;ws.y=5.6;ws.idle=false;
   if(previous&&previous!==code)syncPresence(previous);
   send(ws,{type:"joined",room:roomSummary(db.rooms[code]),players:occupants(code),you:p.id});
   syncPresence(code);return;
  }
  if(!ws.playerId||!ws.roomCode)return;
  if(message.type==="move"){
   if(Date.now()-ws.lastMove<80)return;
   const x=Number(message.x),y=Number(message.y);
   if(!Number.isFinite(x)||!Number.isFinite(y)||x<.25||x>8.75||y<.25||y>8.75)return;
   ws.x=Math.round(x*100)/100;ws.y=Math.round(y*100)/100;ws.lastMove=Date.now();ws.idle=false;
   broadcast(ws.roomCode,{type:"move",id:ws.playerId,x:ws.x,y:ws.y});return;
  }
  if(message.type==="idle"){ws.idle=message.idle===true;syncPresence(ws.roomCode);return;}
  if(message.type==="wave"){
   if(throttle("wave:"+ws.playerId,8,15000))return;
   broadcast(ws.roomCode,{type:"wave",id:ws.playerId});return;
  }
 });
 ws.on("close",()=>{clients.delete(ws);syncPresence(ws.roomCode);});
 ws.on("error",()=>{clients.delete(ws);syncPresence(ws.roomCode);});
});
const heartbeat=setInterval(()=>{
 for(const ws of clients){if(!ws.isAlive){ws.terminate();continue;}ws.isAlive=false;ws.ping();}
},30000);
server.on("close",()=>clearInterval(heartbeat));
server.listen(PORT,"0.0.0.0",()=>console.log("Tidekin v0.1 on port "+PORT+" — data "+dir));
