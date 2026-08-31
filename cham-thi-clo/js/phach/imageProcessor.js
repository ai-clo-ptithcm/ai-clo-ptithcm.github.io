// js/phach/imageProcessor.js
// Tiền xử lý ảnh: cắt vùng số viết tay, phóng lớn, tăng tương phản.

async function blobToImage(blob) {
    const url = URL.createObjectURL(blob);
    try {
        const img = new Image();
        img.decoding = "async";
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = url;
        });
        return img;
    } finally {
        // revoke sau khi image đã decode; pixels vẫn dùng được.
        URL.revokeObjectURL(url);
    }
}

export async function preprocessPhachImage(blob) {
    const img = await blobToImage(blob);
    const sx = Math.max(0, Math.floor(img.naturalWidth * 0.27));
    const sy = Math.max(0, Math.floor(img.naturalHeight * 0.10));
    const sw = Math.max(1, Math.floor(img.naturalWidth * 0.69));
    const sh = Math.max(1, Math.floor(img.naturalHeight * 0.66));
    const scale = 5;

    const canvas = document.createElement("canvas");
    canvas.width = sw * scale;
    canvas.height = sh * scale;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imageData.data;

    // Grayscale + tăng tương phản vừa phải; không threshold cứng để giữ nét bút chì mảnh.
    for (let i = 0; i < d.length; i += 4) {
        let gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        gray = (gray - 128) * 1.7 + 128;
        gray = Math.max(0, Math.min(255, gray));
        d[i] = d[i + 1] = d[i + 2] = gray;
        d[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);

    return canvas;
}
