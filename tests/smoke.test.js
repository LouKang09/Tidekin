"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),net=require("node:net");
const {spawn}=require("node:child_process"),{mkdtempSync,rmSync}=require("node:fs");
const {tmpdir}=require("node:os"),path=require("node:path");
const {setTimeout:delay}=require("node:timers/promises");
const WebSocket=require("ws");
async function freePort(){return new Promise((resolve,reject)=>{const s=net.createServer();s.on("error",reject);s.listen(0,"127.0.0.1",()=>{const port=s.address().port;s.close(()=>resolve(port));});});}
test("Tidekin guest rooms, validation, furniture persistence and live visits",{timeout:45000},async()=>{
 const directory=mkdtempSync(path.join(tmpdir(),"tidekin-test-")),port=await freePort();
 const origin="http://127.0.0.1:"+port;
 const child=spawn(process.execPath,["server.js"],{cwd:path.join(__dirname,".."),env:{...process.env,PORT:String(port),DATA_DIR:directory},stdio:["ignore","pipe","pipe"]});
 let stderr="";child.stderr.on("data",c=>stderr+=String(c));const sockets=[];
 async function api(route,method="GET",payload,token,originHeader=origin){
   const r=await fetch(origin+route,{method,headers:{
     ...(method!=="GET"?{"Origin":originHeader,"Content-Type":"application/json"}:{}),
     ...(token?{Authorization:"Bearer "+token}:{})
   },body:method==="GET"?undefined:JSON.stringify(payload)});
   return {status:r.status,body:await r.json().catch(()=>({}))};
 }
 function makeSocket(){
   const ws=new WebSocket(origin.replace("http","ws")+"/live",{origin});
   sockets.push(ws);return ws;
 }
 async function untilMessage(ws,predicate,timeout=5000){
   return new Promise((resolve,reject)=>{
     const timer=setTimeout(()=>{ws.off("message",listener);reject(Error("Timed out waiting for websocket response"));},timeout);
     function listener(buffer){let msg;try{msg=JSON.parse(String(buffer));}catch{return;}if(predicate(msg)){clearTimeout(timer);ws.off("message",listener);resolve(msg);}}
     ws.on("message",listener);
   });
 }
 try{
   let up=false;
   for(let i=0;i<75;i++){
     if(child.exitCode!==null)throw Error(stderr||"Server died");
     try{if((await api("/health")).status===200){up=true;break;}}catch{}
     await delay(90);
   }
   assert.equal(up,true,"Server should become ready");
   for(const file of ["/","/app.js","/game.js","/styles.css","/favicon.svg","/manifest.webmanifest"]){
     const r=await fetch(origin+file);assert.equal(r.status,200,file);
   }
   assert.equal((await api("/api/me")).status,401);
   assert.equal((await api("/api/guest","POST",{name:"Demo"},null,"https://wrong-origin.test")).status,403);
   const x=await api("/api/guest","POST",{name:"Luna"}),y=await api("/api/guest","POST",{name:"Kai"});
   assert.equal(x.status,201,JSON.stringify(x.body));assert.equal(y.status,201,JSON.stringify(y.body));
   assert.match(x.body.roomCode,/^[A-HJ-NP-Z2-9]{7}$/);
   assert.notEqual(x.body.roomCode,y.body.roomCode);
   const owner=x.body,visitor=y.body;
   const firstRoom=(await api("/api/rooms/"+owner.roomCode)).body.room;
   assert.equal(firstRoom.ownerName,"Luna");
   assert.equal(firstRoom.furniture.length,9);
   const invalid=await api("/api/me","PUT",{room:{furniture:[{id:"wrong",type:"unapproved",x:4,y:4,rotation:0}]}},owner.token);
   assert.equal(invalid.status,400);
   const updated=await api("/api/me","PUT",{name:"Luna Love",avatar:{skin:"#dfaa88",hair:"#7a4535",outfit:"#93b9cd",style:"buns"},room:{
      name:"Sunflower nook",wallpaper:"sage",floor:"birch",activity:"Studying",
      furniture:[...firstRoom.furniture,{id:"extra-plant",type:"plant",x:7.7,y:7.1,rotation:0}]
   }},owner.token);
   assert.equal(updated.status,200,JSON.stringify(updated.body));
   assert.equal(updated.body.room.furniture.length,10);
   assert.equal(updated.body.room.wallpaper,"sage");
   const lookup=await api("/api/rooms/"+owner.roomCode);
   assert.equal(lookup.body.room.name,"Sunflower nook");
   assert.equal(lookup.body.room.ownerName,"Luna Love");
   const ws1=makeSocket();
   await new Promise((resolve,reject)=>{ws1.once("open",resolve);ws1.once("error",reject);});
   const joined1=untilMessage(ws1,m=>m.type==="joined");
   ws1.send(JSON.stringify({type:"join",token:owner.token,code:owner.roomCode}));
   assert.equal((await joined1).you,owner.id);
   const ws2=makeSocket();
   await new Promise((resolve,reject)=>{ws2.once("open",resolve);ws2.once("error",reject);});
   const joined2=untilMessage(ws2,m=>m.type==="joined");
   ws2.send(JSON.stringify({type:"join",token:visitor.token,code:owner.roomCode}));
   const j2=await joined2;assert.equal(j2.room.code,owner.roomCode);
   assert.equal(j2.players.length,2);
   const move=untilMessage(ws1,m=>m.type==="move"&&m.id===visitor.id);
   ws2.send(JSON.stringify({type:"move",x:6.4,y:5.6}));
   assert.equal((await move).x,6.4);
   const wave=untilMessage(ws2,m=>m.type==="wave"&&m.id===owner.id);
   ws1.send(JSON.stringify({type:"wave"}));
   await wave;
   const firstPlayer=(await api("/api/me","GET",undefined,owner.token)).body;
   assert.equal(firstPlayer.room.wallpaper,"sage");
   const visitorRoom=(await api("/api/me","GET",undefined,visitor.token)).body;
   assert.notEqual(visitorRoom.room.code,owner.roomCode,"Visitor cannot overwrite someone else's room");
 }finally{
   for(const ws of sockets){try{ws.terminate();}catch{}}
   child.kill("SIGTERM");await delay(160);
   rmSync(directory,{recursive:true,force:true});
 }
});
