(() => {
"use strict";
const $ = id => document.getElementById(id);
const SpeechAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
const ttsSupported = ("speechSynthesis" in window) && ("SpeechSynthesisUtterance" in window);
const urls = Object.freeze({
 classroom:["Google Classroom","https://classroom.google.com/"],
 drive:["Google Drive","https://drive.google.com/"],
 canva:["Canva","https://www.canva.com/"],
 docs:["Google Docs","https://docs.google.com/document/"],
 sheets:["Google Sheets","https://docs.google.com/spreadsheets/"],
 gmail:["Gmail","https://mail.google.com/"]
});
const rules=[
 [/classroom|คลาสรูม|ห้องเรียน/i,"classroom"],[/canva|แคนวา|แคนว่า/i,"canva"],
 [/ไดรฟ์|drive/i,"drive"],[/docs|ด็อก|เอกสารกูเกิล/i,"docs"],
 [/sheets|ชีต|ตารางคะแนน/i,"sheets"],[/gmail|จีเมล|อีเมล/i,"gmail"],
 [/บอกเวลา|กี่โมง|ตอนนี้เวลา/i,"time"],[/วันที่|วันนี้วันอะไร|วันอะไร/i,"date"],
 [/วิธีใช้|ช่วยเหลือ|คำสั่งอะไร|ทำอะไรได้/i,"help"],[/อ่านบันทึก|อ่านโน้ต/i,"readNotes"]
];
const store={
 get(key){try{return localStorage.getItem(key)||""}catch{return ""}},
 set(key,value){try{localStorage.setItem(key,value);return true}catch{return false}},
 remove(key){try{localStorage.removeItem(key)}catch{}}
};
let speech=null;
let speechWatchdog=0;
let history=[];
try {const old=JSON.parse(store.get("mjv11.history")||"[]");if(Array.isArray(old))history=old.slice(0,40)}catch{}
$("notes").value=store.get("mjv11.notes");
function renderHistory(){
 const target=$("activity");target.replaceChildren();
 if(!history.length){const p=document.createElement("p");p.className="fine";p.textContent="ยังไม่มีคำสั่ง";target.append(p);return}
 for(const item of history){if(!item||typeof item.message!=="string")continue;
  const div=document.createElement("div");div.className="activity-row";
  const t=document.createElement("time");t.textContent=item.at||"";
  const body=document.createElement("span");body.textContent=item.message;
  div.append(t,body);target.append(div);
 }
}
function log(message){history.unshift({at:new Date().toLocaleString("th-TH"),message:String(message)});history=history.slice(0,40);store.set("mjv11.history",JSON.stringify(history));renderHistory()}
function status(message){$("status").textContent=message}
let currentUtterance=null, speechTimer=0, ttsAttempted=false, ttsStarted=false;
const JARVIS_RECORDING = "https://resource2.heygen.ai/text_to_speech/8f1bdae5d24f414ab7bb1c2e4df3455e/bba701d6054041ed881626391e02865c/id=bac1d339640742d9aedf3700460ff3da.mp3";
function playRecordedGreeting(){
 const box=$("recordedAudioWrap"),audio=$("recordedAudio");
 box.hidden=false;
 if(!audio.src)audio.src=JARVIS_RECORDING;
 audio.volume=1;
 audio.onplaying=()=>{ttsInfo("กำลังเล่นเสียงทักทายจากไฟล์ MP3 ไม่ใช้ระบบ TTS ของเบราว์เซอร์",true)};
 audio.onended=()=>ttsInfo("ไฟล์เสียงทักทายเล่นจบแล้ว",true);
 audio.onerror=()=>{
  ttsInfo("โหลดไฟล์เสียงไม่ได้ อาจมีปัญหาการเชื่อมต่อเซิร์ฟเวอร์เสียง",true);
  const fallback=$("linkFallback");fallback.hidden=false;
  const link=document.createElement("a");link.href=JARVIS_RECORDING;
  link.target="_blank";link.rel="noopener noreferrer";link.textContent="แตะเพื่อเปิดไฟล์เสียงโดยตรง";
  fallback.replaceChildren(link);
 };
 try{
  const played=audio.play();
  if(played&&typeof played.catch==="function")played.catch(e=>{
   ttsInfo("เบราว์เซอร์ยังไม่เริ่มเล่นเสียง: "+e.name+" โปรดแตะ Play ในแถบเครื่องเล่นเสียง",true);
  });
 }catch(e){ttsInfo("เล่นไฟล์เสียงไม่ได้: "+e.message,true)}
}

function ttsInfo(message, record=false){
 const label=$("ttsDebug");
 if(label)label.textContent="สถานะเสียงตอบ: "+message;
 if(record)log("TTS: "+message);
}
function listVoices(){
 if(!ttsSupported)return [];
 try{return speechSynthesis.getVoices()||[]}catch{return []}
}
function updateVoiceInfo(){
 const voices=listVoices();
 const thai=voices.filter(v=>String(v.lang).toLowerCase().startsWith("th"));
 const english=voices.filter(v=>String(v.lang).toLowerCase().startsWith("en"));
 const inv=$("voiceInventory");
 if(inv)inv.textContent=voices.length+" เสียง (ไทย "+thai.length+", อังกฤษ "+english.length+")";
 if(!ttsSupported){$("tts").textContent="ไม่พบระบบ TTS";$("tts").className="bad"}
 else if(voices.length===0){$("tts").textContent="มี API แต่ไม่พบเสียงติดตั้ง";$("tts").className="warning"}
 else if(thai.length===0){$("tts").textContent="ไม่พบเสียงภาษาไทย";$("tts").className="warning"}
 else{$("tts").textContent="พบเสียงไทย (ยังต้องฟังทดสอบ)";$("tts").className="good"}
}
function stopTts(){
 clearTimeout(speechTimer);
 currentUtterance=null;
 if(ttsSupported){try{speechSynthesis.cancel()}catch{}}
}
function say(message, lang="th-TH", isTest=false){
 if(!ttsSupported){
  if(lang==="th-TH"&&String(message).includes("สวัสดีครับครูณัฐ"))return playRecordedGreeting();
  ttsInfo("ไม่มี TTS สำหรับพูดข้อความใหม่อิสระ ตอนนี้ใช้เสียงทักทาย MP3 แทนได้",true);return;
 }
 // Do not repeatedly attempt an engine that did not start; manual tests can retry.
 if(!isTest&&ttsAttempted&&!ttsStarted)return;
 ttsAttempted=true;
 stopTts();
 updateVoiceInfo();
 const voices=listVoices();
 const voice=voices.find(v=>String(v.lang).toLowerCase().startsWith(lang.slice(0,2).toLowerCase()));
 const noVoice=voices.length===0?" (เบราว์เซอร์แจ้งว่าไม่มีรายการเสียง)":
  (!voice?" (ไม่พบเสียงภาษาที่ต้องการ)":"");
 try{
  const utter=new SpeechSynthesisUtterance(String(message));
  utter.lang=lang;utter.rate=.95;utter.volume=1;
  if(voice)utter.voice=voice;
  currentUtterance=utter;
  let started=false;
  ttsInfo("ส่งคำขอพูด "+lang+noVoice+" กำลังรอผล...");
  utter.onstart=()=>{
   if(currentUtterance!==utter)return;
   started=true;ttsStarted=true;
   ttsInfo("ระบบรายงานว่ากำลังพูด "+lang+" (หากไม่ได้ยิน ให้ตรวจเสียงสื่อและบลูทูธ)",true);
  };
  utter.onend=()=>{
   if(currentUtterance!==utter)return;
   clearTimeout(speechTimer);currentUtterance=null;
   ttsInfo("ระบบแจ้งว่าพูดจบแล้ว แต่ยังตรวจไม่ได้ว่าลำโพงมีเสียงจริง",true);
  };
  utter.onerror=e=>{
   if(currentUtterance!==utter)return;
   clearTimeout(speechTimer);currentUtterance=null;
   ttsInfo("ข้อผิดพลาด "+String(e.error||"unknown")+noVoice+" กรุณาดูประวัติคำสั่ง",true);
  };
  speechTimer=setTimeout(()=>{
   if(currentUtterance!==utter)return;
   ttsInfo(started?"ระบบเริ่มพูดแล้วแต่ยังไม่ส่งสถานะจบ":"ไม่ได้รับสถานะเริ่มพูดภายใน 12 วินาที อาจไม่มีเสียง TTS ในเครื่อง",true);
   currentUtterance=null;
   try{speechSynthesis.cancel()}catch{}
  },12000);
  speechSynthesis.speak(utter);
 }catch(e){stopTts();ttsInfo("เริ่มเสียงไม่สำเร็จ: "+e.message,true)}
}
async function testSpeaker(){
 const Ctx=window.AudioContext||window.webkitAudioContext;
 if(!Ctx){ttsInfo("ไม่รองรับ Web Audio API ในเบราว์เซอร์นี้",true);return}
 let ctx;
 try{
  ctx=new Ctx();
  if(ctx.state==="suspended")await ctx.resume();
  const oscillator=ctx.createOscillator(), volume=ctx.createGain();
  oscillator.type="sine";oscillator.frequency.value=660;volume.gain.value=.12;
  oscillator.connect(volume);volume.connect(ctx.destination);
  const start=ctx.currentTime;
  volume.gain.setValueAtTime(.0001,start);
  volume.gain.exponentialRampToValueAtTime(.12,start+.03);
  volume.gain.exponentialRampToValueAtTime(.0001,start+.65);
  oscillator.start(start);oscillator.stop(start+.7);
  oscillator.onended=()=>{ctx.close().catch(()=>{})};
  ttsInfo("เล่นเสียงปี๊บแล้ว หากไม่ได้ยินให้เพิ่มระดับเสียงสื่อ (Media) และตรวจบลูทูธ",true);
 }catch(e){if(ctx)ctx.close().catch(()=>{});ttsInfo("เปิดลำโพงผ่าน Web Audio ไม่สำเร็จ: "+e.message,true)}
}
function respond(message,read=true){status(message);log("จาร์วิส: "+message);if(read)say(message)}
function openSite(action){
 const entry=urls[action];if(!entry)return;
 const name=entry[0],url=entry[1];
 const box=$("linkFallback");box.replaceChildren();
 const link=document.createElement("a");link.href=url;link.target="_blank";link.rel="noopener noreferrer";link.textContent="แตะเพื่อเปิด "+name;
 box.append("หากเว็บไซต์ไม่เปิดขึ้นอัตโนมัติ: ",link);box.hidden=false;
 try{
  const tab=window.open(url,"_blank","noopener,noreferrer");
  // Some mobile browsers block popups triggered after speech recognition.
  if(!tab)status("เลือกแตะลิงก์เพื่อเปิด "+name+" ได้เลยครับ");
 }catch{status("แตะลิงก์เพื่อเปิด "+name+" ครับ")}
 log("เปิดเว็บไซต์: "+name);
}
function saveNote(silent=false){
 const ok=store.set("mjv11.notes",$("notes").value);
 $("saveInfo").textContent=ok?"บันทึกไว้ในเบราว์เซอร์นี้แล้ว":"บันทึกไม่สำเร็จ กรุณาส่งออกไฟล์";
 if(!silent)log(ok?"บันทึกสำเร็จ":"บันทึกไม่สำเร็จ");
 return ok;
}
function appendNote(note){
 const value=String(note||"").trim();
 if(!value){respond("กรุณาบอกข้อความที่จะจดครับ");return}
 $("notes").value+=($("notes").value?"\n":"")+value;
 saveNote(true);respond("จดบันทึกให้แล้วครับ");
}
function execute(action){
 if(urls[action])return openSite(action);
 if(action==="time")return respond("ขณะนี้เวลา "+new Intl.DateTimeFormat("th-TH",{hour:"2-digit",minute:"2-digit"}).format(new Date())+" นาฬิกาครับ");
 if(action==="date")return respond("วันนี้ "+new Intl.DateTimeFormat("th-TH",{dateStyle:"full"}).format(new Date())+" ครับ");
 if(action==="help")return respond("ลองพูดหรือพิมพ์ เปิด Canva เปิด Classroom เปิด Drive บอกเวลา บอกวันที่ จดบันทึก ตามด้วยข้อความ หรือ อ่านบันทึก ครับ");
 if(action==="readNotes")return respond($("notes").value.trim().slice(0,400)||"ยังไม่มีบันทึกครับ");
}
function send(text){
 const original=String(text||"").trim().slice(0,300);if(!original)return;
 $("command").value="";log("ครูณัฐ: "+original);
 const simplified=original.replace(/^(จาร์วิส|jarvis)[\s,:：，]*/i,"").trim();
 const note=simplified.match(/^(จดบันทึก|จดโน้ต|บันทึกว่า|จดไว้ว่า)\s*(.*)/i);
 if(note)return appendNote(note[2]);
 const match=rules.find(row=>row[0].test(simplified));
 if(match)return execute(match[1]);
 respond("ตอนนี้รองรับคำสั่งพื้นฐานเท่านั้น กดวิธีสั่งงานเพื่อดูคำสั่งที่ใช้ได้ครับ");
}
function listen(){
 if(!SpeechAPI){
  respond("เบราว์เซอร์นี้ยังไม่รองรับการแปลงเสียงเป็นข้อความ กรุณาใช้ช่องพิมพ์คำสั่งครับ",false);
  return;
 }
 if(speech){try{speech.stop()}catch{}return}
 const r=new SpeechAPI();
 speech=r;
 r.lang="th-TH";r.continuous=false;r.interimResults=true;r.maxAlternatives=1;
 let hasResult=false, lastHeard="", hasError=false;
 const setText=t=>{if($("heardText"))$("heardText").textContent=t};
 function reset(){
  clearTimeout(speechWatchdog);speechWatchdog=0;
  if(speech===r)speech=null;
  $("btnListen").classList.remove("listening");
  $("btnListen").textContent="🎙 เริ่มพูดคำสั่ง";
 }
 function timeout(){
  if(speech!==r||hasResult)return;
  hasError=true;
  status("ระบบรับเสียงไม่ส่งผลกลับภายใน 15 วินาที ลองพิมพ์คำสั่งหรือใช้ไมโครโฟนบนแป้นพิมพ์ครับ");
  setText("ยังไม่มีข้อความที่แปลงจากเสียงได้");
  log("VOICE TIMEOUT: เบราว์เซอร์ไม่ส่งผลการรู้จำเสียงกลับมา");
  try{r.abort()}catch{}
  reset();
 }
 r.onstart=()=>{
  $("btnListen").classList.add("listening");
  $("btnListen").textContent="■ หยุดฟัง";
  status("เริ่มรับเสียงแล้ว กรุณาพูดคำสั่งไทยสั้น ๆ");
  setText("กำลังรอผลการรู้จำเสียง...");
  log("VOICE START: เริ่มระบบรู้จำเสียง");
 };
 r.onaudiostart=()=>{log("VOICE AUDIO: เริ่มเปิดช่องรับเสียง")};
 r.onspeechstart=()=>{status("ตรวจพบเสียงพูด กำลังแปลงเป็นข้อความ...")};
 r.onresult=e=>{
  const results=e.results;
  if(!results||!results.length)return;
  const index=Math.max(0,e.resultIndex||0);
  const item=results[index];
  const transcript=item&&item[0]&&item[0].transcript;
  if(!transcript)return;
  lastHeard=String(transcript).trim();
  setText("Jarvis ได้ยิน: "+lastHeard+(item.isFinal?"":" (กำลังยืนยัน)"));
  status("ได้ยิน: "+lastHeard);
  if(item.isFinal&&!hasResult){
   hasResult=true;
   log("VOICE RESULT: "+lastHeard);
   reset();
   try{r.stop()}catch{}
   send(lastHeard);
  }
 };
 r.onnomatch=()=>{hasError=true;status("ได้ยินเสียงแต่แปลงเป็นคำสั่งไม่ได้ ลองพูดชัด ๆ หรือพิมพ์แทนครับ");log("VOICE NO MATCH")};
 r.onerror=e=>{
  hasError=true;
  const error=String(e.error||"unknown");
  const help={
   "not-allowed":"เบราว์เซอร์ไม่ได้รับอนุญาตให้ใช้ไมโครโฟน",
   "service-not-allowed":"บริการรู้จำเสียงถูกปิดหรือไม่รองรับ",
   "language-not-supported":"บริการรู้จำเสียงไม่รองรับภาษาไทย",
   "network":"บริการรู้จำเสียงเชื่อมต่อไม่ได้",
   "no-speech":"ไม่ได้ยินเสียงพูด",
   "audio-capture":"เบราว์เซอร์รับข้อมูลจากไมโครโฟนไม่ได้"
  };
  status("รู้จำเสียงไม่สำเร็จ: "+(help[error]||error)+" ใช้ช่องพิมพ์คำสั่งได้ครับ");
  log("VOICE ERROR: "+error);
  reset();
  try{r.abort()}catch{}
 };
 r.onend=()=>{
  reset();
  if(!hasResult&&!hasError){
   if(lastHeard){log("VOICE PARTIAL: "+lastHeard);send(lastHeard)}
   else {status("ยังไม่ได้รับข้อความจากเสียง ลองใช้ปุ่มทดสอบไมโครโฟนหรือพิมพ์คำสั่งครับ");log("VOICE END: ไม่มีข้อความจากเสียง")}
  }
 };
 speechWatchdog=setTimeout(timeout,15000);
 try{r.start()}catch(e){hasError=true;reset();respond("เริ่มรับเสียงไม่ได้: "+e.message,false)}
}
async function micTest(){
 if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){
  $("micState").textContent="ไม่รองรับหรือไม่ใช้ HTTPS";$("micState").className="bad";
  respond("เบราว์เซอร์ไม่เปิดให้ใช้ไมโครโฟน กรุณาใช้ HTTPS หรือตรวจสอบสิทธิ์",false);return
 }
 try{
  const stream=await navigator.mediaDevices.getUserMedia({audio:true});
  stream.getTracks().forEach(t=>t.stop());
  $("micState").textContent="อนุญาตแล้ว";$("micState").className="good";
  respond("ไมโครโฟนได้รับอนุญาตแล้ว ขั้นต่อไปลองทดสอบการรับเสียงภาษาไทยครับ",false)
 }catch(e){$("micState").textContent="ปฏิเสธ/ขัดข้อง";$("micState").className="bad";respond("ไม่สามารถเข้าถึงไมโครโฟน: "+e.name,false)}
}
function exportNotes(){
 const notes=$("notes").value;
 if(!notes.trim()){respond("ยังไม่มีข้อความให้ส่งออกครับ",false);return}
 const blob=new Blob(["\ufeff"+notes],{type:"text/plain;charset=utf-8"});
 const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="my-jarvis-notes.txt";a.click();
 setTimeout(()=>URL.revokeObjectURL(url),3000);log("ส่งออกไฟล์บันทึกแล้ว")
}
function capabilities(){
 $("network").textContent=navigator.onLine?"● LOCAL MODE · ONLINE":"● LOCAL MODE · OFFLINE";
 $("asr").textContent=SpeechAPI?"พบ API (ต้องทดสอบไทย)":"ไม่พบ API";
 $("asr").className=SpeechAPI?"good":"warning";
 updateVoiceInfo();
 $("voiceInfo").textContent=SpeechAPI?"กดปุ่มเริ่มพูดคำสั่ง แล้วอนุญาตไมโครโฟน การรองรับภาษาไทยต้องทดสอบจริง":"เบราว์เซอร์นี้ไม่รองรับการแปลงเสียงด้วย Web Speech API สามารถพิมพ์คำสั่งได้";
 $("btnListen").disabled=!SpeechAPI;
 if(!isSecureContext)$("micState").textContent="ต้องเปิดผ่าน HTTPS"
}
$("commandForm").addEventListener("submit",e=>{e.preventDefault();send($("command").value)});
$("btnListen").addEventListener("click",listen);
$("btnSpeak").addEventListener("click",()=>say("สวัสดีครับครูณัฐ ผมจาร์วิส พร้อมรับคำสั่งครับ","th-TH",true));
$("btnRecorded").addEventListener("click",playRecordedGreeting);
$("btnSpeakEn").addEventListener("click",()=>say("Hello, this is Jarvis. Audio system test.","en-US",true));
$("btnBeep").addEventListener("click",testSpeaker);
$("btnStop").addEventListener("click",()=>{if($("recordedAudio"))$("recordedAudio").pause();stopTts();if(speech)try{speech.stop()}catch{}status("หยุดเสียงแล้วครับ");ttsInfo("หยุดเสียงแล้ว")});
$("quickGrid").addEventListener("click",e=>{const b=e.target.closest("[data-action]");if(b)execute(b.dataset.action)});
$("btnMicTest").addEventListener("click",micTest);
$("btnSave").addEventListener("click",()=>saveNote());
$("btnExport").addEventListener("click",exportNotes);
$("btnClear").addEventListener("click",()=>{history=[];store.remove("mjv11.history");renderHistory()});
window.addEventListener("online",capabilities);window.addEventListener("offline",capabilities);
if(ttsSupported)speechSynthesis.addEventListener?.("voiceschanged",capabilities);
if("serviceWorker" in navigator&&window.isSecureContext)navigator.serviceWorker.register("./sw.js").catch(()=>{});
renderHistory();capabilities();setTimeout(updateVoiceInfo,1700);log("My Jarvis v1.1.3 เริ่มใช้งาน");
})();