// js/phach/ocrEngine.js
// OCR số phách bằng Tesseract.js. Nếu Tesseract chưa tải được,
// module trả confidence 0 để chuyển sang xác nhận thủ công.

let workerPromise = null;
let ocrUnavailable = false;

let scriptPromise = null;

async function ensureTesseract() {
    if (globalThis.Tesseract?.createWorker) return globalThis.Tesseract;
    if (scriptPromise) return scriptPromise;

    scriptPromise = new Promise(resolve => {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
        script.async = true;
        let settled = false;
        const finish = value => {
            if (settled) return;
            settled = true;
            resolve(value);
        };
        script.onload = () => finish(globalThis.Tesseract || null);
        script.onerror = () => finish(null);
        document.head.appendChild(script);
        setTimeout(() => finish(globalThis.Tesseract || null), 10000);
    });

    return scriptPromise;
}

function normalizeVisualDigits(text) {
    const raw = String(text || "").toUpperCase();
    const exact = raw.match(/\d{1,10}/g);
    if (exact?.length) {
        return { value: exact.sort((a, b) => b.length - a.length)[0], transformed: false };
    }

    // Chỉ dùng như gợi ý khi OCR đọc chữ giống chữ số; confidence sẽ bị giảm.
    const map = {
        O: "0", Q: "0", D: "0",
        I: "1", L: "1", J: "1", A: "1", "|": "1", "!": "1",
        Z: "2",
        S: "3",
        G: "6",
        B: "8"
    };

    let converted = "";
    for (const ch of raw) {
        if (/\d/.test(ch)) converted += ch;
        else if (map[ch]) converted += map[ch];
        else converted += " ";
    }

    const groups = converted.match(/\d{1,10}/g) || [];
    const value = groups.sort((a, b) => b.length - a.length)[0] || "";
    return { value, transformed: true };
}

async function getWorker(onLog) {
    if (ocrUnavailable) return null;
    if (workerPromise) return workerPromise;

    const Tesseract = await ensureTesseract();
    if (!Tesseract?.createWorker) {
        ocrUnavailable = true;
        return null;
    }

    workerPromise = Tesseract.createWorker("eng", 1, {
        logger: msg => onLog?.(msg)
    }).then(async worker => {
        const psm = Tesseract?.PSM?.SINGLE_LINE || "7";
        await worker.setParameters({
            tessedit_pageseg_mode: psm,
            preserve_interword_spaces: "0"
        });
        return worker;
    }).catch(err => {
        console.warn("Không khởi tạo được OCR:", err);
        workerPromise = null;
        ocrUnavailable = true;
        return null;
    });

    return workerPromise;
}

export async function recognizePhach(canvas, onLog) {
    const worker = await getWorker(onLog);
    if (!worker) {
        return { text: "", value: "", confidence: 0, engineAvailable: false };
    }

    try {
        const result = await worker.recognize(canvas);
        const text = String(result?.data?.text || "").trim();
        const baseConfidence = Number(result?.data?.confidence || 0);
        const parsed = normalizeVisualDigits(text);
        let confidence = baseConfidence;

        if (!parsed.value) confidence = 0;
        if (parsed.transformed && parsed.value) confidence = Math.max(0, confidence - 25);
        if (parsed.value.length === 1) confidence = Math.min(confidence, 65);

        return {
            text,
            value: parsed.value,
            confidence: Math.round(confidence),
            engineAvailable: true,
            transformed: parsed.transformed
        };
    } catch (err) {
        console.warn("OCR lỗi:", err);
        return { text: "", value: "", confidence: 0, engineAvailable: true, error: err };
    }
}

export async function terminateOcr() {
    if (!workerPromise) return;
    try {
        const worker = await workerPromise;
        await worker?.terminate?.();
    } catch (_) {
        // ignore
    } finally {
        workerPromise = null;
    }
}
