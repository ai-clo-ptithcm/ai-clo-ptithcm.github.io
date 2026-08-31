// js/phach/index.js
import { isValidSbd } from "../untNormalizer.js";
import { loadUntWorkbook } from "./excelWorkbook.js";
import { extractPhachImages } from "./imageExtractor.js";
import { preprocessPhachImage } from "./imageProcessor.js";
import { recognizePhach, terminateOcr } from "./ocrEngine.js";

const HIGH_CONFIDENCE = 90;
const REVIEW_THRESHOLD = 70;

function confidenceLevel(confidence) {
    if (confidence >= HIGH_CONFIDENCE) return "high";
    if (confidence >= REVIEW_THRESHOLD) return "medium";
    return "low";
}

/**
 * Đọc OCR cho các SBD còn thiếu nhưng KHÔNG mở hộp thoại.
 * Hàm luôn trả về kết quả của tất cả sinh viên để giao diện có thể hiển thị
 * một bảng xác nhận chung nếu trong UnT có SBD trống.
 */
export async function processPhach(file, untData, { onProgress } = {}) {
    const needsOcr = (untData?.students || []).some(s => !isValidSbd(s.sbd));
    let imageMap = new Map();

    if (needsOcr) {
        const workbook = await loadUntWorkbook(file);
        imageMap = extractPhachImages(workbook, 0);
    }

    const results = [];
    const total = untData.students.length;

    for (let i = 0; i < total; i++) {
        const student = untData.students[i];
        const image = imageMap.get(student.sourceRow);

        if (isValidSbd(student.sbd)) {
            const item = {
                student,
                imageBlob: image?.blob,
                value: student.sbd,
                confidence: 100,
                level: "high",
                status: "existing",
                label: "SBD có sẵn"
            };
            results.push(item);
            onProgress?.({ current: i + 1, total, item, results: [...results] });
            continue;
        }

        let recognized = { value: "", confidence: 0, text: "", engineAvailable: false };
        if (image?.blob) {
            const canvas = await preprocessPhachImage(image.blob);
            recognized = await recognizePhach(canvas);
        }

        const value = String(recognized.value ?? "").trim();
        student.sbd = value;

        let label = "OCR tự động";
        if (!image?.blob) label = "Không có ảnh - cần nhập";
        else if (!recognized.engineAvailable) label = "OCR chưa tải - cần nhập";
        else if (!value) label = "OCR chưa đọc được";
        else if (recognized.confidence < REVIEW_THRESHOLD) label = "OCR tin cậy thấp";

        const item = {
            student,
            imageBlob: image?.blob,
            value,
            rawText: recognized.text,
            confidence: recognized.confidence,
            level: confidenceLevel(recognized.confidence),
            status: "auto",
            label
        };
        results.push(item);
        onProgress?.({ current: i + 1, total, item, results: [...results] });
    }

    await terminateOcr();
    return results;
}
