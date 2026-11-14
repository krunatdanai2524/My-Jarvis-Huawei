// My Jarvis v1.2 - record raw microphone PCM and transcribe locally
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const loadBtn = $("btnLoadWhisper"), recBtn = $("btnWhisperRecord");
  const state = $("whisperState"), progress = $("whisperProgress"), heard = $("whisperHeard");
  if (!loadBtn || !recBtn || !state || !progress || !heard) return;
  let worker = null, ready = false, loading = false, transcribing = false, recording = null;
  let lastProgress = "";
  const ackAudio=$("ackAudio"), ackBtn=$("btnAckReplay");
  function playAck(){
    if(!ackAudio)return;
    if(ackBtn)ackBtn.hidden=false;
    try{
      ackAudio.currentTime=0;
      const playback=ackAudio.play();
      if(playback&&typeof playback.catch==="function")playback.catch(()=>{
        setState("รับคำสั่งแล้ว แตะ “ฟังเสียงตอบรับ” หากเบราว์เซอร์ไม่ยอมเล่นอัตโนมัติ");
      });
    }catch(e){setState("เปิดเสียงตอบรับอัตโนมัติไม่ได้ แตะปุ่มฟังเสียงตอบรับ")}
  }
  if(ackBtn)ackBtn.addEventListener("click",playAck);

  const setState = (msg, isError = false) => {
    state.textContent = msg;
    state.style.color = isError ? "#ffb4bb" : "#9ce5fc";
  };
  function createWorker() {
    if (worker) return worker;
    if (!window.Worker) throw new Error("เบราว์เซอร์นี้ไม่มี Web Worker");
    const w = new Worker("./stt-worker.js?v=20261114whisper1", {type:"module"});
    worker = w;
    w.onmessage = ({data}) => {
      const kind = data && data.type;
      if (kind === "model-status") {
        if (!ready) setState("ดาวน์โหลด/เตรียมโมเดล: " + String(data.message || ""));
      } else if (kind === "model-progress") {
        const pct = Number(data.percent);
        progress.hidden = false;
        if (Number.isFinite(pct)) progress.value = Math.max(0, Math.min(100, pct));
        lastProgress = String(data.file || "model") + " " + (Number.isFinite(pct) ? pct.toFixed(0) + "%" : "");
        setState("โหลด: " + lastProgress + " (หลายไฟล์)");
      } else if (kind === "ready") {
        ready = true; loading = false;
        loadBtn.textContent = "โมเดลพร้อม ✓";
        loadBtn.disabled = true;
        recBtn.disabled = false;
        progress.hidden = true;
        setState("Whisper พร้อมใช้งาน กดเริ่มอัดเสียงคำสั่ง");
      } else if (kind === "transcribing") {
        setState(String(data.message || "กำลังถอดเสียง"));
      } else if (kind === "transcribed") {
        transcribing = false;
        recBtn.disabled = false;
        const text = String(data.text || "").trim();
        if (text) {
          heard.textContent = "Whisper ได้ยิน: " + text;
          setState("ถอดเสียงสำเร็จ ส่งคำสั่งเข้า Jarvis แล้ว");
          window.dispatchEvent(new CustomEvent("jarvis:voice-command", {detail:{text}}));
          playAck();
        } else {
          heard.textContent = "Whisper ยังไม่พบคำพูด ลองพูดใกล้ไมโครโฟน";
          setState("ถอดเสียงแล้ว แต่ไม่ได้ข้อความ ลองใหม่อีกครั้ง",true);
        }
      } else if (kind === "error") {
        loading = false; transcribing = false;
        recBtn.disabled = !ready;
        loadBtn.disabled = ready;
        loadBtn.textContent = ready ? "โมเดลพร้อม ✓" : "ลองโหลด Whisper อีกครั้ง";
        setState(String(data.message || "เกิดข้อผิดพลาด"),true);
        progress.hidden = true;
      }
    };
    w.onerror = event => {
      loading = false; transcribing = false; ready = false;
      recBtn.disabled = true; loadBtn.disabled = false;
      loadBtn.textContent = "ลองโหลดโมเดลใหม่";
      setState("เริ่มระบบ Whisper ไม่สำเร็จ: เบราว์เซอร์อาจไม่รองรับ Web Worker แบบโมดูล หรือโหลดไลบรารีไม่ได้ (" + String(event.message || "unknown") + ")",true);
      try{w.terminate()}catch{}
      if (worker === w)worker = null;
    };
    return w;
  }
  loadBtn.addEventListener("click", () => {
    if (loading || ready) return;
    try {
      loading = true;loadBtn.disabled = true;
      loadBtn.textContent = "กำลังเตรียมโมเดล...";
      setState("กำลังเชื่อมต่อคลังโมเดล Hugging Face โปรดเปิดหน้าเว็บค้างไว้");
      createWorker().postMessage({type:"load"});
    } catch(e) {
      loading = false;loadBtn.disabled = false;
      setState("เริ่มโหลดไม่สำเร็จ: " + e.message,true);
    }
  });
  function to16k(chunks, total, fromRate) {
    const raw = new Float32Array(total);
    let i = 0;
    for(const chunk of chunks){raw.set(chunk,i);i+=chunk.length}
    const ratio = fromRate / 16000;
    if(!(ratio > 0)) throw new Error("อัตราสุ่มเสียงไม่ถูกต้อง");
    if(Math.abs(ratio-1)<0.000001)return raw;
    const out = new Float32Array(Math.floor(raw.length / ratio));
    for(let n=0;n<out.length;n++){
      const sourceIndex=n*ratio;
      const left=Math.floor(sourceIndex),right=Math.min(left+1,raw.length-1);
      const frac=sourceIndex-left;
      out[n]=raw[left]*(1-frac)+raw[right]*frac;
    }
    return out;
  }
  async function stopRecording(submit = true) {
    const r = recording;
    if(!r)return;
    recording = null;
    clearTimeout(r.timer);
    clearInterval(r.counter);
    try {r.processor.onaudioprocess=null;r.source.disconnect();r.processor.disconnect();r.mute.disconnect()}catch{}
    r.stream.getTracks().forEach(track=>track.stop());
    try{await r.ctx.close()}catch{}
    recBtn.textContent="2. เริ่มอัดเสียงคำสั่ง";
    if(!submit){setState("หยุดบันทึกเสียงแล้ว");return}
    if(r.total < r.sampleRate * .45){
      setState("เสียงสั้นเกินไป กรุณาอัดอย่างน้อย 1 วินาที",true);return
    }
    try{
      const pcm=to16k(r.chunks,r.total,r.sampleRate);
      transcribing=true;recBtn.disabled=true;
      setState("บันทึกแล้ว "+(r.total/r.sampleRate).toFixed(1)+" วินาที กำลังแปลงเสียงบนแท็บเล็ต...");
      createWorker().postMessage({type:"transcribe",samples:pcm},[pcm.buffer]);
    }catch(e){transcribing=false;recBtn.disabled=false;setState("ประมวลผลเสียงไม่ได้: "+e.message,true)}
  }
  async function startRecording(){
    if(!ready){setState("กรุณาโหลด Whisper ให้สำเร็จก่อนเริ่มอัดเสียง",true);return}
    if(transcribing)return;
    if(recording){await stopRecording(true);return}
    if(!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
      setState("เบราว์เซอร์นี้ไม่เปิดให้บันทึกเสียงผ่านเว็บ ต้องใช้ HTTPS และอนุญาตไมโครโฟน",true);return;
    }
    let stream=null,ctx=null,source=null,processor=null,mute=null;
    try{
      stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,channelCount:1}});
      const AudioCtx=window.AudioContext||window.webkitAudioContext;
      if(!AudioCtx)throw new Error("เบราว์เซอร์ไม่มี Web Audio API");
      ctx=new AudioCtx();
      if(ctx.state==="suspended")await ctx.resume();
      if(typeof ctx.createScriptProcessor!=="function")throw new Error("ไม่พบตัวบันทึก PCM ที่เบราว์เซอร์รองรับ");
      source=ctx.createMediaStreamSource(stream);
      processor=ctx.createScriptProcessor(4096,1,1);
      mute=ctx.createGain();mute.gain.value=0; // no microphone feedback
      const chunks=[];
      const r={stream,ctx,source,processor,mute,chunks,total:0,sampleRate:ctx.sampleRate,timer:null,counter:null};
      processor.onaudioprocess=event=>{
        if(recording!==r)return;
        const data=event.inputBuffer.getChannelData(0);
        chunks.push(new Float32Array(data));r.total+=data.length;
      };
      source.connect(processor);processor.connect(mute);mute.connect(ctx.destination);
      recording=r;
      recBtn.textContent="■ หยุดและแปลงเสียง";
      heard.textContent="ข้อความจากเสียง: กำลังบันทึก...";
      const begun=Date.now();
      r.counter=setInterval(()=>setState("กำลังบันทึกเสียง... "+((Date.now()-begun)/1000).toFixed(0)+" วินาที (สูงสุด 10 วินาที)"),500);
      r.timer=setTimeout(()=>stopRecording(true),10000);
      setState("กำลังบันทึกเสียงแล้ว พูดคำสั่งได้เลย");
    }catch(e){
      if(stream)stream.getTracks().forEach(t=>t.stop());
      try{source&&source.disconnect();processor&&processor.disconnect();mute&&mute.disconnect();ctx&&await ctx.close()}catch{}
      setState("เปิดไมโครโฟนไม่ได้: "+e.name+" "+e.message+" ตรวจสอบสิทธิ์ไมโครโฟนใน Huawei Browser",true);
    }
  }
  recBtn.addEventListener("click",startRecording);
  document.addEventListener("visibilitychange",()=>{if(document.hidden&&recording)stopRecording(false)});
  if(!window.Worker)loadBtn.disabled=true;
  if(!window.isSecureContext)setState("โปรดเปิดเว็บผ่าน HTTPS เพื่อใช้ไมโครโฟน",true);
})();
