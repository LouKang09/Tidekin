"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {spawn}=require("node:child_process"),{setTimeout:pause}=require("node:timers/promises"),net=require("node:net");
const {chromium}=require("playwright");
async function port(){return new Promise((resolve,reject)=>{const s=net.createServer();s.once("error",reject);s.listen(0,"127.0.0.1",()=>{const p=s.address().port;s.close(()=>resolve(p));});});}
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"tidekin-browser-")),PORT=await port(),origin="http://127.0.0.1:"+PORT;
 const child=spawn(process.execPath,["server.js"],{cwd:path.resolve(__dirname,".."),env:{...process.env,PORT:String(PORT),DATA_DIR:dir},stdio:["ignore","pipe","pipe"]});
 let browser=null;const errors=[],pages=[];child.stderr.on("data",chunk=>errors.push("SERVER: "+String(chunk)));
 try{
  let ready=false;
  for(let i=0;i<80;i++){
   try{if((await fetch(origin+"/health")).ok){ready=true;break;}}catch{}
   await pause(100);
  }
  assert.ok(ready,"App should start");
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  const ctx1=await browser.newContext({viewport:{width:1400,height:900}});
  const page1=await ctx1.newPage();pages.push(page1);
  page1.on("pageerror",err=>errors.push("OWNER: "+err.message));
  await page1.goto(origin,{waitUntil:"domcontentloaded"});
  await page1.locator("#startName").fill("Luna");
  await page1.locator("#startButton").click();
  await page1.locator("#gameApp").waitFor({state:"visible",timeout:10000});
  await page1.locator("#sceneLoading").waitFor({state:"hidden",timeout:10000});
  await pause(450);
  const canvasColors=await page1.evaluate(()=>{
   const c=document.querySelector("#worldCanvas"),ctx=c.getContext("2d");
   const points=[[100,80],[500,250],[280,340],[800,390],[500,520]].map(([x,y])=>[...ctx.getImageData(x,y,1,1).data].join(","));
   return new Set(points).size;
  });
  assert.ok(canvasColors>=4,"The illustrated room should render multiple distinct colors");
  const code=(await page1.locator("#myRoomCode").textContent()).trim();
  assert.match(code,/^[A-HJ-NP-Z2-9]{7}$/);
  await page1.locator('[data-tab="room"]').click();
  await page1.locator("#editRoomName").fill("Sunset Nook");
  await page1.locator("#activitySelect").selectOption("Studying");
  await page1.locator("#saveRoomButton").click();
  await page1.waitForFunction(()=>document.querySelector("#saveLabel").textContent.includes("safe"),null,{timeout:10000});
  const beforeReload=(await page1.request.get(origin+"/api/rooms/"+code)).json();
  const savedRoom=await beforeReload;
  process.stdout.write("Room before reload: "+JSON.stringify({name:savedRoom.room.name,activity:savedRoom.room.activity})+"\\n");
  await page1.reload({waitUntil:"domcontentloaded"});
  await page1.locator("#gameApp").waitFor({state:"visible"});
  await page1.locator("#sceneLoading").waitFor({state:"hidden"});
  assert.equal((await page1.locator("#roomTitle").textContent()).trim(),"Sunset Nook");
  await page1.locator('[data-tab="decor"]').click();
  await page1.locator("#studioEditToggle").click();
  await page1.locator("#furnitureCatalog button").nth(5).click(); // plant
  const canvas=page1.locator("#worldCanvas"),bounds=await canvas.boundingBox();
  await canvas.click({position:{x:bounds.width*.55,y:bounds.height*.64}});
  await page1.waitForFunction(()=>document.querySelector("#saveLabel").textContent.includes("safe"),{timeout:10000});
  const r=await (await page1.request.get(origin+"/api/rooms/"+code)).json();
  assert.equal(r.room.furniture.length,10,"Adding furniture must persist to backend");
  // Second browser is a completely separate guest with a fresh local identity.
  const ctx2=await browser.newContext({viewport:{width:414,height:896},isMobile:true,hasTouch:true});
  const page2=await ctx2.newPage();pages.push(page2);page2.on("pageerror",err=>errors.push("VISITOR: "+err.message));
  await page2.goto(origin+"/?visit="+code,{waitUntil:"domcontentloaded"});
  await page2.locator("#startName").fill("Kai");
  await page2.locator("#startButton").click();
  await page2.locator("#gameApp").waitFor({state:"visible"});
  await page2.locator("#visitBanner").waitFor({state:"visible",timeout:10000});
  assert.match(await page2.locator("#visitName").textContent(),/Luna/);
  assert.equal(await page2.locator("#decorateButton").isDisabled(),true,"Guests cannot edit host's room");
  await page1.waitForFunction(()=>document.querySelector("#visitCount").textContent.includes("neighbor"),{timeout:10000});
  await page2.locator("#waveButton").click();
  await page1.locator("#toast").waitFor({state:"visible",timeout:10000});
  const screenshots=path.join(process.cwd(),"test-artifacts");fs.mkdirSync(screenshots,{recursive:true});
  await page1.screenshot({path:path.join(screenshots,"tidekin-desktop.png"),fullPage:true});
  await page2.screenshot({path:path.join(screenshots,"tidekin-mobile.png"),fullPage:true});
  await page1.setViewportSize({width:390,height:844});
  await page1.reload({waitUntil:"domcontentloaded"});
  await page1.locator("#mobileNav").waitFor({state:"visible"});
  await page1.locator("#worldCanvas").waitFor({state:"visible"});
  assert.equal((await page1.locator("#roomTitle").textContent()).trim(),"Sunset Nook");
  assert.deepEqual(errors,[],"No JavaScript or server errors");
  process.stdout.write("Tidekin browser smoke test passed (room render, decor, reload, live friend visit, mobile).\n");
 }finally{
  if(browser)await browser.close();
  child.kill("SIGTERM");await pause(180);
  fs.rmSync(dir,{recursive:true,force:true});
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
