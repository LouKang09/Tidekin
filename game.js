"use strict";
/* Tidekin's world is rendered entirely on Canvas 2D with hand-authored, layered illustration.
   No Three.js, 3D meshes, textures, or model loader. */
(function(){
const C={blush:{wall:"#f9dee7",side:"#efd1e0",trim:"#e7b9cf"},cream:{wall:"#ffeedc",side:"#f3dfd0",trim:"#dfc8ba"},sage:{wall:"#d9ebe3",side:"#cee5d9",trim:"#aacdc3"},sky:{wall:"#dbebfa",side:"#cfdfed",trim:"#a6c9df"},lilac:{wall:"#eae1f9",side:"#ded2f1",trim:"#c6b5e6"}};
const F={honey:["#efd9b7","#e6c9a3","#d7b88e"],birch:["#f4e8d8","#e9d9c8","#dbbdad"],walnut:["#c6a792","#b89480","#987260"],rose:["#efced1","#e3bbc5","#d6a4b4"]};
const W=1000,H=650,n=9,TW=35,TH=17,OX=500,OY=180;
const Sprites={
 image:new Image(), ready:false, failed:false, columns:1, tileW:112, tileH:152,
 draw(g,x,y,phase="idle",time=0,scale=1,facing=1){
  if(!this.ready)return false;
  const row=phase==="walk"?1:0;
  const frame=0; // First deployed preview: a real idle pose and an animated walk pose
  const movementBob=phase==="walk"?Math.sin(time*.017)*2:Math.sin(time*.004)*.8;
  const w=112*scale,h=152*scale;
  g.save();
  g.translate(x,y);
  if(facing<0)g.scale(-1,1);
  // feet are located 83% down the tile; align them to the isometric floor
  g.drawImage(this.image,0,row*152,112,152,-w/2,-h*.83+movementBob,w,h);
  g.restore();
  return true;
 }
};
Sprites.image.onload=()=>{Sprites.ready=true;window.dispatchEvent(new Event("tidekin-sprites-loaded"));};
Sprites.image.onerror=()=>{Sprites.failed=true;};
Sprites.image.src="/assets/boy-sprite.webp?v=2";
window.TidekinSprites=Sprites;
const lighter=(hex,f=.22)=>{const v=parseInt(hex.slice(1),16);let r=(v>>16)&255,g=(v>>8)&255,b=v&255;return "rgb("+Math.round(r+(255-r)*f)+","+Math.round(g+(255-g)*f)+","+Math.round(b+(255-b)*f)+")";};
const darker=(hex,f=.18)=>{const v=parseInt(hex.slice(1),16);return "rgb("+Math.round((v>>16&255)*(1-f))+","+Math.round((v>>8&255)*(1-f))+","+Math.round((v&255)*(1-f))+")";};
const proj=(x,y,z=0)=>({x:OX+(x-y)*TW,y:OY+(x+y)*TH-z*40});
const invert=(x,y)=>{const a=(x-OX)/TW,b=(y-OY)/TH;return {x:(a+b)/2,y:(b-a)/2};};
function polygon(g,points,fill,stroke=null,width=1){g.beginPath();g.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++)g.lineTo(points[i].x,points[i].y);g.closePath();g.fillStyle=fill;g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.stroke();}}
function line(g,points,color,width=1){g.beginPath();g.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++)g.lineTo(points[i].x,points[i].y);g.strokeStyle=color;g.lineWidth=width;g.stroke();}
function round(g,x,y,w,h,r,color){g.beginPath();g.roundRect(x,y,w,h,r);g.fillStyle=color;g.fill();}
function ellipse(g,x,y,rx,ry,color){g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fillStyle=color;g.fill();}
function circ(g,x,y,r,color){g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fillStyle=color;g.fill();}
function box(g,x,y,w,d,h,color,topColor=color,rot=0){
 const a=rot%2?[d,w]:[w,d];w=a[0];d=a[1];
 const x0=x-w/2,y0=y-d/2;
 const a0=proj(x0,y0),b0=proj(x0+w,y0),c0=proj(x0+w,y0+d),d0=proj(x0,y0+d);
 const aa=proj(x0,y0,h),bb=proj(x0+w,y0,h),cc=proj(x0+w,y0+d,h),dd=proj(x0,y0+d,h);
 polygon(g,[d0,c0,cc,dd],darker(color,.14));polygon(g,[b0,c0,cc,bb],darker(color,.24));
 polygon(g,[aa,bb,cc,dd],topColor,darker(color,.12),.7);
 return {a:aa,b:bb,c:cc,d:dd,base:{a:a0,b:b0,c:c0,d:d0}};
}
function subdiamond(g,x,y,w,d,z,color,rot=0){const [ww,dd]=rot%2?[d,w]:[w,d],x0=x-ww/2,y0=y-dd/2;polygon(g,[proj(x0,y0,z),proj(x0+ww,y0,z),proj(x0+ww,y0+dd,z),proj(x0,y0+dd,z)],color);}
const star=(g,x,y,r,color)=>{g.save();g.translate(x,y);g.rotate(Math.PI/4);g.fillStyle=color;g.beginPath();g.moveTo(-r*.22,-r*.22);g.quadraticCurveTo(0,-r*1.55,r*.22,-r*.22);g.quadraticCurveTo(r*1.55,0,r*.22,r*.22);g.quadraticCurveTo(0,r*1.55,-r*.22,r*.22);g.quadraticCurveTo(-r*1.55,0,-r*.22,-r*.22);g.fill();g.restore();};
function drawAvatar(g,x,y,avatar,phase=0,scale=1,number=0){
 avatar=avatar||{skin:"#f5c9a8",hair:"#3b2930",outfit:"#e78da2",style:"soft"};
 g.save();g.translate(x,y);g.scale(scale,scale);
 ellipse(g,0,1,28,8,"#81708b31");
 const bob=Math.sin(phase)*2;
 const bodyColor=avatar.outfit||"#e78da2",hair=avatar.hair||"#3b2930",skin=avatar.skin||"#f5c9a8";
 const move=Math.abs(phase)>0.1?Math.sin(phase*2)*2:0;
 round(g,-21,-23+bob,18,24,7,"#e4d8dd");round(g,4+move,-23+bob,18,24,7,"#e4d8dd");
 round(g,-25,-8+bob,23,10,5,"#faeff5");round(g,2+move,-8+bob,24,10,5,"#faeff5");
 ellipse(g,-23,-10+bob,12,4,"#ba9eab35");ellipse(g,17+move,-10+bob,12,4,"#ba9eab35");
 // backpack / shirt
 round(g,-26,-69+bob,52,48,22,darker(bodyColor,.15));
 round(g,-24,-71+bob,48,52,18,bodyColor);
 // sleeve + little fingers
 g.save();g.rotate(-.10);
 ellipse(g,-30,-51+bob,10,20,bodyColor);ellipse(g,-32,-32+bob,7,9,skin);
 ellipse(g,30,-51+bob,10,20,bodyColor);ellipse(g,32,-32+bob,7,9,skin);
 g.restore();
 round(g,-6,-70+bob,12,12,6,lighter(bodyColor,.46));
 ellipse(g,-10,-44+bob,2,2,"#fff9f8c0");ellipse(g,10,-44+bob,2,2,"#fff9f8c0");
 // oversized hair behind head
 if(["bob","buns","curly"].includes(avatar.style))ellipse(g,0,-101+bob,43,43,hair);
 else ellipse(g,0,-111+bob,42,36,hair);
 // ears and face
 circ(g,-37,-99+bob,9,skin);circ(g,37,-99+bob,9,skin);
 ellipse(g,0,-103+bob,36,38,skin);
 // cheek blush
 ellipse(g,-25,-96+bob,9,5,"#ed9ba49c");ellipse(g,25,-96+bob,9,5,"#ed9ba49c");
 // eyes
 ellipse(g,-15,-105+bob,4.4,6.3,"#473844");ellipse(g,15,-105+bob,4.4,6.3,"#473844");
 circ(g,-13.6,-107+bob,1.4,"white");circ(g,16.2,-107+bob,1.4,"white");
 g.strokeStyle="#9b5f64";g.lineWidth=1.5;g.beginPath();g.arc(0,-95+bob,4,.08,Math.PI-.08);g.stroke();
 // hair in front and different silhouettes
 ellipse(g,0,-133+bob,34,18,hair);
 polygon(g,[{x:-33,y:-129+bob},{x:-24,y:-121+bob},{x:-18,y:-113+bob},{x:-5,y:-131+bob},{x:12,y:-122+bob},{x:22,y:-127+bob},{x:34,y:-119+bob},{x:30,y:-142+bob}],hair);
 if(avatar.style==="buns"){circ(g,-35,-132+bob,17,hair);circ(g,35,-132+bob,17,hair);circ(g,-36,-132+bob,7,lighter(hair,.11));circ(g,34,-134+bob,7,lighter(hair,.11));}
 if(avatar.style==="curly"){for(let i=0;i<7;i++){const a=Math.PI+(i/6)*Math.PI;circ(g,Math.cos(a)*31,-112+bob+Math.sin(a)*25,10,hair);}}
 if(avatar.style==="bob"){ellipse(g,-33,-107+bob,13,28,hair);ellipse(g,33,-107+bob,13,28,hair);}
 if(avatar.style==="short"){g.save();g.translate(19,-140+bob);g.rotate(.5);ellipse(g,0,0,19,9,hair);g.restore();}
 // hair highlight
 g.strokeStyle=lighter(hair,.25);g.lineWidth=2;g.lineCap="round";g.beginPath();g.moveTo(-18,-143+bob);g.quadraticCurveTo(-8,-148+bob,0,-145+bob);g.stroke();
 if(number)star(g,38,-159+bob,5,"#fff6c2");
 g.restore();
}
class TidekinGame{
 constructor(canvas,opts={}){
  this.canvas=canvas;this.ctx=canvas.getContext("2d",{alpha:false});this.opts=opts;this.room=null;
  this.me={id:"me",x:4.5,y:5.7,tx:4.5,ty:5.7,avatar:null,name:"Me"};
  this.others=new Map();this.editing=false;this.stamp=null;this.selected=null;this.drag=null;
  this.waveIds=new Map();this.clock=0;this.furnitureHit=[];this.active=true;this.lastTs=0;
  this.bind();this.frame=this.frame.bind(this);requestAnimationFrame(this.frame);
 }
 setRoom(room){this.room=structuredClone(room);this.selected=null;this.stamp=null;}
 setMe(id,name,avatar){this.me.id=id;this.me.name=name;this.me.avatar=avatar;}
 setAvatar(avatar){this.me.avatar=avatar;}
 setVisitors(players){
  const next=new Map();
  for(const p of players||[]){
   if(p.id===this.me.id)continue;
   const previous=this.others.get(p.id);
   next.set(p.id,{...p,x:previous?.x??p.x,y:previous?.y??p.y,tx:p.x,ty:p.y});
  }
  this.others=next;
 }
 updatePosition(id,x,y){if(id===this.me.id)return;const p=this.others.get(id);if(p){p.tx=x;p.ty=y;}}
 moveTo(x,y,notify=true){this.me.tx=Math.max(.3,Math.min(8.7,x));this.me.ty=Math.max(.3,Math.min(8.7,y));if(notify)this.opts.onMove?.(this.me.tx,this.me.ty);}
 setEditing(value){this.editing=value;this.selected=null;this.stamp=null;this.drag=null;this.opts.onSelect?.(null);}
 setStamp(value){this.stamp=value;this.selected=null;this.opts.onSelect?.(null);}
 wave(id){this.waveIds.set(id,performance.now());}
 floorFrom(point){const xy=invert(point.x,point.y);return {x:Math.max(.3,Math.min(8.7,xy.x)),y:Math.max(.3,Math.min(8.7,xy.y))};}
 canvasPoint(e){const rect=this.canvas.getBoundingClientRect();return {x:(e.clientX-rect.left)*W/rect.width,y:(e.clientY-rect.top)*H/rect.height};}
 furnitureAt(point){
  if(!this.room)return null;
  const ordered=[...this.room.furniture].sort((a,b)=>(a.x+a.y)-(b.x+b.y)).reverse();
  for(const f of ordered){
    const p=proj(f.x,f.y),size=f.type==="rug"?70:f.type==="bookshelf"?69:f.type==="bed"?68:48;
    if(Math.abs(point.x-p.x)<size && point.y>p.y-122&&point.y<p.y+24)return f;
  }
  return null;
 }
 bind(){
  this.canvas.addEventListener("pointerdown",e=>{
    if(!this.room)return;
    const pt=this.canvasPoint(e);
    if(this.editing && this.opts.canEdit?.()){
      if(this.stamp){
        const floor=this.floorFrom(pt);
        this.opts.onPlace?.(this.stamp,floor.x,floor.y);this.stamp=null;return;
      }
      const found=this.furnitureAt(pt);
      if(found){
        this.selected=found.id;this.opts.onSelect?.(found.id);
        this.drag={id:found.id,moved:false,start:pt};
        this.canvas.setPointerCapture?.(e.pointerId);
        return;
      }
      this.selected=null;this.opts.onSelect?.(null);return;
    }
    const ptWorld=this.floorFrom(pt);
    this.moveTo(ptWorld.x,ptWorld.y);
  });
  this.canvas.addEventListener("pointermove",e=>{
    if(!this.drag||!this.room)return;
    const p=this.canvasPoint(e);
    if(Math.hypot(p.x-this.drag.start.x,p.y-this.drag.start.y)<5&&!this.drag.moved)return;
    this.drag.moved=true;
    const item=this.room.furniture.find(f=>f.id===this.drag.id);
    if(!item)return;
    const floor=this.floorFrom(p);
    item.x=Math.round(floor.x*10)/10;item.y=Math.round(floor.y*10)/10;
  });
  const stop=()=>{
    if(this.drag?.moved)this.opts.onRearrange?.(structuredClone(this.room.furniture));
    this.drag=null;
  };
  this.canvas.addEventListener("pointerup",stop);this.canvas.addEventListener("pointercancel",stop);
 }
 background(g,time){
  const sky=g.createLinearGradient(0,0,0,H);sky.addColorStop(0,"#e3e8fd");sky.addColorStop(.57,"#fce5ed");sky.addColorStop(1,"#fceee2");
  g.fillStyle=sky;g.fillRect(0,0,W,H);
  circ(g,814,112,44,"#fff9e9aa");circ(g,814,112,26,"#fffdf6");
  const clouds=[[114,145,1],[875,234,.7],[215,90,.6],[735,66,.5]];
  clouds.forEach(([x,y,s],i)=>{g.save();g.translate(x+Math.sin(time*.0001+i)*12,y);g.scale(s,s);
    ellipse(g,0,0,57,18,"#ffffff9e");circ(g,-27,-15,23,"#ffffffe0");circ(g,8,-23,34,"#ffffffdd");circ(g,34,-9,21,"#ffffffe0");g.restore();
  });
  // distant organic hills and shoreline
  g.fillStyle="#e6ddd9a2";g.beginPath();g.moveTo(0,420);g.bezierCurveTo(190,325,240,490,415,427);
  g.bezierCurveTo(600,342,700,455,1000,350);g.lineTo(1000,H);g.lineTo(0,H);g.fill();
  g.fillStyle="#d1e5dac4";g.beginPath();g.moveTo(0,507);g.bezierCurveTo(210,460,240,545,440,492);
  g.bezierCurveTo(640,443,810,529,1000,471);g.lineTo(1000,H);g.lineTo(0,H);g.fill();
  for(let i=0;i<18;i++){const x=24+(i*71)%974,y=498+(i*51)%105;
    star(g,x,y,2.5+(i%3),"#fffdfbd4");
  }
 }
 drawIsland(g){
  ellipse(g,500,490,360,87,"#817c9250");
  polygon(g,[proj(0,9),proj(9,9),proj(9,0),proj(0,0)],"#d6c3ad");
  const tl=proj(0,9),bt=proj(9,9),rt=proj(9,0);
  polygon(g,[tl,bt,{x:bt.x,y:bt.y+34},{x:tl.x,y:tl.y+34}],"#d0b59c");
  polygon(g,[bt,rt,{x:rt.x,y:rt.y+34},{x:bt.x,y:bt.y+34}],"#bb9c8b");
  line(g,[{x:tl.x,y:tl.y+34},{x:bt.x,y:bt.y+34},{x:rt.x,y:rt.y+34}],"#b18f80",2);
  // tiny flowers outside the house island
  for(let i=0;i<34;i++){const x=185+(i*79)%635,y=487+(i*29)%93;
    const distance=Math.abs(x-500);
    if(distance>285&&y<527)continue;
    const color=["#fff6c9","#f5b2c5","#e9f0ff"][i%3];
    star(g,x,y,3,color);circ(g,x,y,1.5,"#d89eb6");
  }
 }
 drawWalls(g){
  const p=proj(0,0),l=proj(0,9),r=proj(9,0),height=136;
  const ltop={x:l.x,y:l.y-height},ptop={x:p.x,y:p.y-height},rtop={x:r.x,y:r.y-height};
  const theme=C[this.room?.wallpaper]||C.blush;
  polygon(g,[ltop,ptop,p,l],theme.wall,"#eacddb8e",1);
  polygon(g,[ptop,rtop,r,p],theme.side,"#dbbcce8e",1);
  // graceful skirting boards and crown molding
  line(g,[ltop,ptop,rtop],lighter(theme.trim,.19),5);
  line(g,[l,p,r],theme.trim,6);
  const interpolate=(a,b,t,z=0)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t-z});
  // illustrated window on right side
  const s=interpolate(p,r,.24,100),e=interpolate(p,r,.64,100),s2={x:s.x,y:s.y+68},e2={x:e.x,y:e.y+68};
  polygon(g,[s,e,e2,s2],"#fdf8f1");
  const inset=7;
  polygon(g,[{x:s.x+inset,y:s.y+inset},{x:e.x-inset,y:e.y+inset},
             {x:e2.x-inset,y:e2.y-inset},{x:s2.x+inset,y:s2.y-inset}],"#a8d9e8");
  const xi=(s.x+e.x)/2,yi=(s.y+e.y)/2;
  line(g,[{x:xi,y:yi+7},{x:xi,y:yi+62}],"#fff8ea",5);
  line(g,[{x:s.x+7,y:s.y+37},{x:e.x-7,y:e.y+37}],"#fff8ea",4);
  circ(g,xi+26,yi+16,10,"#fff9cc"); // scenic sun
  // poster on left side
  const l1=interpolate(p,l,.28,106),l2=interpolate(p,l,.48,106);
  polygon(g,[l1,l2,{x:l2.x,y:l2.y+62},{x:l1.x,y:l1.y+62}],"#fffaf3");
  polygon(g,[{x:l1.x-3,y:l1.y+6},{x:l2.x+3,y:l2.y+6},{x:l2.x+3,y:l2.y+53},{x:l1.x-3,y:l1.y+53}],"#c0d6cd");
  const m={x:(l1.x+l2.x)/2,y:(l1.y+l2.y)/2};
  circ(g,m.x,m.y+23,12,"#f8e6b1");ellipse(g,m.x,m.y+47,22,11,"#8db6a7");
  line(g,[{x:l1.x-6,y:l1.y+65},{x:l2.x+6,y:l2.y+65}],lighter(theme.trim,.09),4);
  // a garland across the rear top
  g.beginPath();g.moveTo(l.x+25,l.y-height+9);g.quadraticCurveTo(p.x-52,p.y-height+60,p.x,p.y-height+15);
  g.quadraticCurveTo(p.x+145,p.y-height+60,r.x-23,r.y-height+8);g.strokeStyle="#faf2df";g.lineWidth=2;g.stroke();
  for(let t=0;t<=12;t++){const x=220+t*46,y=t<7?210-t*20+Math.sin(t*.9)*10:70+(t-7)*24+Math.sin(t*.9)*10;
    circ(g,x,y,3.7,"#fff3ce");
  }
 }
 drawFloor(g){
  const cols=F[this.room?.floor]||F.honey;
  for(let x=0;x<n;x++)for(let y=0;y<n;y++){
    const fill=(x+y)%2===0?cols[0]:cols[1];
    polygon(g,[proj(x,y),proj(x+1,y),proj(x+1,y+1),proj(x,y+1)],fill,"#ffffff42",.7);
    // wood grain, subtle painted variation
    if((x+y*3)%4===1){
      const a=proj(x+.19,y+.33),b=proj(x+.73,y+.33);line(g,[a,b],"#ffffff2b",1.2);
    }
  }
  line(g,[proj(0,9),proj(9,9),proj(9,0)],"#fff9eea8",3);
 }
 drawFurniture(g,f,t){
  const p=proj(f.x,f.y),r=f.rotation||0,type=f.type;
  const unitScale=1;
  ellipse(g,p.x,p.y,29,9,"#56445720");
  if(type==="rug"){
    g.save();g.translate(p.x,p.y);g.rotate(-.03);ellipse(g,0,0,81,38,"#dac4e2");ellipse(g,0,0,72,31,"#f7ebf3");
    g.strokeStyle="#e7cbd9";g.lineWidth=1.5;g.beginPath();g.ellipse(0,0,58,22,0,0,Math.PI*2);g.stroke();
    for(let i=0;i<12;i++){const a=i*Math.PI/6;circ(g,Math.cos(a)*63,Math.sin(a)*27,2.5,"#f9d9bb");}g.restore();return;
  }
  if(type==="bed"){
    box(g,f.x,f.y,2.6,2.35,.43,"#d2ad9d","#e5bfb4",r);
    box(g,f.x,f.y,2.44,2.2,.58,"#fff7e9","#fff9f2",r);
    subdiamond(g,f.x+.23,f.y+.23,1.95,1.69,.65,"#e1a5ad",r);
    subdiamond(g,f.x+.4,f.y+.43,1.60,1.26,.68,"#f8c9cc",r);
    subdiamond(g,f.x-.66,f.y-.62,1,.65,.69,"#fffef8",r);
    star(g,p.x+22,p.y-21,4,"#fffaf6");
  }else if(type==="sofa"){
    box(g,f.x,f.y,2.4,1.35,.55,"#d9a0ad","#f4b7bb",r);
    box(g,f.x-.36,f.y-.38,2.5,.5,1.2,"#dfaeb5","#f3c1c3",r);
    subdiamond(g,f.x+.2,f.y+.25,1.72,.70,.65,"#f9d2d4",r);
    // pillows
    circ(g,p.x-16,p.y-29,12,"#fdf0e4");circ(g,p.x+18,p.y-19,10,"#e7c9e7");
  }else if(type==="desk"){
    for(let xx of [-.69,.69])for(let yy of [-.33,.33])box(g,f.x+xx,f.y+yy,.20,.18,.91,"#b88b6f","#d4aa8d");
    box(g,f.x,f.y,2.0,1.10,1.04,"#e0baa1","#f8dfc1",r);
    // monitor with glow
    const screen=proj(f.x-.27,f.y-.21,1.78);
    round(g,screen.x-24,screen.y-23,48,29,4,"#6d7795");round(g,screen.x-21,screen.y-20,42,23,3,"#a4ced0");
    ellipse(g,screen.x,screen.y+6,18,5,"#b8a49c");circ(g,p.x+28,p.y-45,7,"#f5eacd");
  }else if(type==="chair"){
    box(g,f.x,f.y,.9,.82,.70,"#bf9cb2","#efcad3",r);
    box(g,f.x-.28,f.y-.25,.20,.96,1.65,"#a98ca4","#dbb7cf",r);
    box(g,f.x,f.y,.75,.72,.82,"#ddbdd3","#f8dce4",r);
  }else if(type==="table"){
    for(let xx of [-.35,.35])for(let yy of [-.35,.35])box(g,f.x+xx,f.y+yy,.13,.13,.72,"#c2947c","#dcae91");
    box(g,f.x,f.y,1.42,1.25,.83,"#dbb095","#f9dac4",r);
    const c=proj(f.x,f.y,1.05);circ(g,c.x,c.y-5,6,"#fef2dc");ellipse(g,c.x,c.y-12,8,5,"#f2a3b8");
  }else if(type==="plant"){
    const base=proj(f.x,f.y,.45);
    box(g,f.x,f.y,.59,.6,.5,"#ce9d88","#edc0a7",r);
    for(let i=0;i<9;i++){const a=i*Math.PI*2/9,offset=Math.sin(t*.001+i)*1.3;
      g.save();g.translate(base.x,base.y-15);
      g.rotate(a*.8);
      ellipse(g,Math.cos(a)*14,Math.sin(a)*16-18+offset,8,21,i%2?"#86bda5":"#699b84");g.restore();
    }
    circ(g,base.x,base.y-16,5,"#658f79");
  }else if(type==="lamp"){
    const b=proj(f.x,f.y,1.7);ellipse(g,p.x,p.y-5,15,6,"#e4b7a8");
    line(g,[{x:p.x,y:p.y-7},{x:b.x,y:b.y+7}],"#c6a38b",4);
    polygon(g,[{x:b.x-22,y:b.y+3},{x:b.x-13,y:b.y-30},{x:b.x+13,y:b.y-30},{x:b.x+22,y:b.y+3}],"#fff1c9");
    ellipse(g,b.x,b.y+4,22,5,"#e8cfab");
    circ(g,b.x,b.y-13,18,"#fff5d12e");
  }else if(type==="bookshelf"||type==="cabinet"){
    box(g,f.x,f.y,1.5,.78,2.65,"#bd967d","#e4ba9f",r);
    if(type==="bookshelf"){
      for(let row=0;row<3;row++){
        const shelf=proj(f.x+.18,f.y+.11,.52+row*.65);
        round(g,shelf.x-23,shelf.y-24,49,42,2,"#b18470");
        for(let i=0;i<6;i++){const heights=[24,31,28,35,24,29];round(g,shelf.x-21+i*8,shelf.y+14-heights[i],7,heights[i],1,
          ["#ecafae","#afbdc8","#f0d5a7","#a7b8a3","#c7aed1","#e9b5a2"][i]);}
      }
    }else{
      round(g,p.x-20,p.y-95,34,42,4,"#f5dcc7");circ(g,p.x+8,p.y-69,2,"#b68e7a");
    }
  }else if(type==="stool"){
    for(let i=-1;i<=1;i+=2)box(g,f.x+i*.21,f.y,.16,.18,.62,"#b48c8a","#dfb8a9");
    box(g,f.x,f.y,.86,.82,.75,"#d1a6a1","#f0ccbe",r);
  }
 }
 paint(g,t){
  this.background(g,t);this.drawIsland(g);
  if(!this.room)return;
  this.drawWalls(g);this.drawFloor(g);
  // All room pieces, visitors, and owner live in a single painter's-depth ordering pass.
  const objects=this.room.furniture.map(f=>({kind:"f",f,x:f.x,y:f.y,key:f.x+f.y}));
  objects.push({kind:"me",x:this.me.x,y:this.me.y,key:this.me.x+this.me.y});
  for(const p of this.others.values())objects.push({kind:"guest",p,x:p.x,y:p.y,key:p.x+p.y});
  objects.sort((a,b)=>a.key-b.key);
  for(const o of objects){
   if(o.kind==="f"){
    this.drawFurniture(g,o.f,t);
    if(this.selected===o.f.id&&this.editing){
      const p=proj(o.f.x,o.f.y);
      g.save();g.setLineDash([5,4]);g.lineWidth=2;g.strokeStyle="#9075da";g.beginPath();g.ellipse(p.x,p.y-28,66,35,0,0,2*Math.PI);g.stroke();g.restore();
      round(g,p.x-35,p.y-93,70,23,10,"#ffffffed");g.fillStyle="#856fb6";g.textAlign="center";g.font="800 12px Nunito";g.fillText("↔ drag me",p.x,p.y-77);
    }
   }else{
    const person=o.kind==="me"?this.me:o.p,pp=proj(person.x,person.y);
    const bob=Math.sin(t*.012)*2;
    const isOwner=person.id===this.me.id;
    const moving=Math.hypot((person.tx??person.x)-person.x,(person.ty??person.y)-person.y)>.035;
    if(moving && Math.abs((person.tx??person.x)-person.x)>.03)person.facing=(person.tx<person.x)?-1:1;
    const avatarScale=isOwner?1.53:1.42;
    if(!Sprites.draw(g,pp.x,pp.y,moving?"walk":"idle",t,avatarScale,person.facing||1))
      drawAvatar(g,pp.x,pp.y,person.avatar,bob,isOwner?.86:.79,0);
    const w=Math.max(68,Math.min(124,(person.name||"Neighbor").length*7+23));
    round(g,pp.x-w/2,pp.y-146,w,25,12,"#fffdf4f0");
    g.fillStyle="#7b6b92";g.font="900 12px Nunito";g.textAlign="center";
    g.fillText((person.name||"Neighbor").slice(0,18),pp.x,pp.y-130);
    if(person.id===this.me.id)circ(g,pp.x+w/2-5,pp.y-140,4,"#88c8a7");
    if(person.id!==this.me.id&&person.idle)circ(g,pp.x+w/2-5,pp.y-140,4,"#e5bca0");
    const wave=this.waveIds.get(person.id);
    if(wave&&t-wave<2200){
      const y=pp.y-181-((t-wave)/2200)*35;
      g.globalAlpha=Math.max(0,1-(t-wave)/2200);
      round(g,pp.x+12,y-9,36,29,10,"#fffef1");g.fillStyle="#d796b5";g.font="21px sans-serif";g.fillText("♡",pp.x+30,y+12);g.globalAlpha=1;
    }
   }
  }
  // soft overlay sparkles and friendly painterly room details
  for(let i=0;i<9;i++){
   const x=220+(i*113)%570,y=426+(i*19)%45;
   star(g,x,y,1.7+(i%3)*.8,"#fffaf3b7");
  }
 }
 frame(ts){
  if(!this.active)return;
  this.clock=ts;
  const dt=Math.min(.05,(ts-(this.lastTs||ts))/1000);this.lastTs=ts;
  const ease=(p)=>{const dx=(p.tx??p.x)-p.x,dy=(p.ty??p.y)-p.y;const dist=Math.hypot(dx,dy);if(dist>.014){const speed=Math.min(dist,dt*2.4);p.x+=dx/dist*speed;p.y+=dy/dist*speed;}else{p.x=p.tx??p.x;p.y=p.ty??p.y;}};
  ease(this.me);this.others.forEach(ease);
  const g=this.ctx;g.clearRect(0,0,W,H);this.paint(g,ts);
  requestAnimationFrame(this.frame);
 }
 exportPNG(){return this.canvas.toDataURL("image/png");}
}
window.TidekinGame=TidekinGame;
window.TidekinDrawAvatar=drawAvatar;
window.TidekinPalette={walls:C,floors:F};
})();
