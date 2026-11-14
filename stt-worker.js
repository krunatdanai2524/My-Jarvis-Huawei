// My Jarvis v1.2: Thai ASR runs in the user's browser via WASM.
import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";
env.allowLocalModels = false;
env.useBrowserCache = true;
// GitHub Pages does not provide COOP/COEP headers; one WASM thread is safer.
if (env.backends && env.backends.onnx && env.backends.onnx.wasm) {
  env.backends.onnx.wasm.numThreads = 1;
}
const MODEL = "onnx-community/whisper-tiny"; // multilingual, supports Thai
let transcriberPromise = null;
let processing = false;
function report(type, payload = {}) {
  self.postMessage({ type, ...payload });
}
async function getModel() {
  if (!transcriberPromise) {
    report("model-status", { message: "เริ่มโหลด Whisper Tiny (ภาษาไทย)" });
    transcriberPromise = pipeline("automatic-speech-recognition", MODEL, {
      dtype: "q8",
      device: "wasm",
      progress_callback: (p) => {
        if (p.status === "progress") {
          report("model-progress", {
            file: String(p.file || "").split("/").pop(),
            percent: typeof p.progress === "number" ? Math.max(0, Math.min(100, p.progress)) : 0
          });
        } else if (p.status === "initiate" || p.status === "download" || p.status === "done") {
          report("model-status", { message: p.status + (p.file ? ": " + String(p.file).split("/").pop() : "") });
        }
      }
    }).catch(err => {
      transcriberPromise = null;
      throw err;
    });
  }
  return await transcriberPromise;
}
self.addEventListener("message", async (event) => {
  const data = event.data || {};
  if (data.type === "load") {
    try {
      await getModel();
      report("ready", { message: "Whisper พร้อมรับเสียงภาษาไทยแล้ว" });
    } catch (err) {
      report("error", { message: "โหลดโมเดลไม่สำเร็จ: " + (err && err.message ? err.message : String(err)) });
    }
    return;
  }
  if (data.type === "transcribe") {
    if (processing) {
      report("error", { message: "ระบบกำลังประมวลผลเสียงก่อนหน้า กรุณารอให้เสร็จ" });
      return;
    }
    processing = true;
    try {
      const model = await getModel();
      const audio = data.samples;
      if (!(audio instanceof Float32Array) || !audio.length) {
        throw new Error("ไม่มีข้อมูลเสียงจากไมโครโฟน");
      }
      report("transcribing", { message: "กำลังถอดเสียงไทยในเครื่อง (อาจใช้เวลาบน CPU)..." });
      const result = await model(audio, {
        language: "thai",
        task: "transcribe",
        return_timestamps: false,
        max_new_tokens: 64
      });
      report("transcribed", { text: String(result && result.text || "").trim() });
    } catch (err) {
      report("error", { message: "แปลงเสียงไม่สำเร็จ: " + (err && err.message ? err.message : String(err)) });
    } finally {
      processing = false;
    }
  }
});
