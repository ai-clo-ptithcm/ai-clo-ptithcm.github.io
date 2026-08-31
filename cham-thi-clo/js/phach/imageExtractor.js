// js/phach/imageExtractor.js
// Trả về Map<rowIndex0Based, imageInfo> cho ảnh ở cột B.

function mimeFromExtension(ext) {
    const e = String(ext || "jpeg").toLowerCase();
    if (e === "png") return "image/png";
    if (e === "gif") return "image/gif";
    return "image/jpeg";
}

export function extractPhachImages(workbook, sheetIndex = 0) {
    const worksheet = workbook.worksheets?.[sheetIndex];
    if (!worksheet) throw new Error("Không tìm thấy sheet UnT để đọc ảnh số phách.");

    const map = new Map();
    const images = worksheet.getImages?.() || [];
    const media = workbook.model?.media || workbook.media || [];

    for (const item of images) {
        const row = Number(item?.range?.tl?.nativeRow);
        const col = Number(item?.range?.tl?.nativeCol);

        // Theo mẫu UnT, ảnh số phách nằm ở cột B (index 1).
        if (!Number.isInteger(row) || col !== 1) continue;

        const mediaItem = media[item.imageId];
        if (!mediaItem?.buffer) continue;

        const blob = new Blob([mediaItem.buffer], {
            type: mimeFromExtension(mediaItem.extension)
        });

        map.set(row, {
            row,
            excelRow: row + 1,
            col,
            imageId: item.imageId,
            extension: mediaItem.extension || "jpeg",
            blob
        });
    }

    return map;
}
