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
function say(message){
 if(!ttsSupported)return;
 try{
  speechSynthesis.cancel();
  const utter=new SpeechSynthesisUtterance(String(message));
  utter.lang="th-TH";utter.rate=.95;
  const voices=speechSynthesis.getVoices();
  const thai=voices.find(v=>String(v.lang).toLowerCase().startsWith("th"));
  if(thai)utter.voice=thai;
  speechSynthesis.speak(utter);
 }catch(e){log("เสียงพูดตอบขัดข้อง: "+e.message)}
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
 if(!SpeechAPI){respond("Huawei Browser นี้ยังไม่พบระบบแปลงเสียงภาษาไทย กรุณาใช้ช่องพิมพ์คำสั่งก่อนครับ",false);return}
 if(speech){try{speech.stop()}catch{}return}
 const r=new SpeechAPI();speech=r;r.lang="th-TH";r.continuous=false;r.interimResults=false;
 r.onstart=()=>{$("btnListen").classList.add("listening");$("btnListen").textContent="■ หยุดฟัง";status("กำลังฟังคำสั่งภาษาไทย...")};
 r.onresult=e=>{const t=e.results&&e.results[0]&&e.results[0][0]&&e.results[0][0].transcript;if(t)send(t)};
 r.onerror=e=>{status("รับเสียงไม่สำเร็จ: "+e.error);log("การรับเสียง: "+e.error)};
 r.onend=()=>{speech=null;$("btnListen").classList.remove("listening");$("btnListen").textContent="🎙 เริ่มพูดคำสั่ง"};
 try{r.start()}catch(e){speech=null;respond("เปิดไมโครโฟนไม่ได้: "+e.message,false)}
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
 $("tts").textContent=ttsSupported?"พบระบบเสียง (ทดสอบอีกครั้ง)":"ไม่พบระบบเสียง";
 $("tts").className=ttsSupported?"good":"warning";
 if(ttsSupported){
  const voices=speechSynthesis.getVoices();
  if(voices.some(v=>String(v.lang).toLowerCase().startsWith("th")))$("tts").textContent="พบเสียงภาษาไทย"
 }
 $("voiceInfo").textContent=SpeechAPI?"กดปุ่มเริ่มพูดคำสั่ง แล้วอนุญาตไมโครโฟน การรองรับภาษาไทยต้องทดสอบจริง":"เบราว์เซอร์นี้ไม่รองรับการแปลงเสียงด้วย Web Speech API สามารถพิมพ์คำสั่งได้";
 $("btnListen").disabled=!SpeechAPI;
 if(!isSecureContext)$("micState").textContent="ต้องเปิดผ่าน HTTPS"
}
$("commandForm").addEventListener("submit",e=>{e.preventDefault();send($("command").value)});
$("btnListen").addEventListener("click",listen);
$("btnSpeak").addEventListener("click",()=>respond("สวัสดีครับครูณัฐ ผมจาร์วิส พร้อมรับคำสั่งครับ"));
$("btnStop").addEventListener("click",()=>{if(ttsSupported)speechSynthesis.cancel();if(speech)try{speech.stop()}catch{}status("หยุดเสียงแล้วครับ")});
$("quickGrid").addEventListener("click",e=>{const b=e.target.closest("[data-action]");if(b)execute(b.dataset.action)});
$("btnMicTest").addEventListener("click",micTest);
$("btnSave").addEventListener("click",()=>saveNote());
$("btnExport").addEventListener("click",exportNotes);
$("btnClear").addEventListener("click",()=>{history=[];store.remove("mjv11.history");renderHistory()});
window.addEventListener("online",capabilities);window.addEventListener("offline",capabilities);
if(ttsSupported)speechSynthesis.addEventListener?.("voiceschanged",capabilities);
if("serviceWorker" in navigator&&window.isSecureContext)navigator.serviceWorker.register("./sw.js").catch(()=>{});
renderHistory();capabilities();log("My Jarvis v1.1 เริ่มใช้งาน");
})();