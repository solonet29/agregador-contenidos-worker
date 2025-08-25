// lib/imageGenerator.js (VERSIÓN CON LA FECHA CORREGIDA)
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, registerFont } = require('canvas');

const fontPath = path.join(__dirname, '../templates/Cinzel-Bold.ttf');
if (fs.existsSync(fontPath)) {
    registerFont(fontPath, { family: 'Cinzel' });
} else {
    console.warn("Advertencia: No se encontró la fuente Cinzel-Bold.ttf.");
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
            ctx.fillText(line, x, y);
            line = words[n] + ' ';
            y += lineHeight;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, x, y);
}

async function createSocialImage(event) {
    console.log("-> Iniciando la creación de la imagen personalizada...");

    const width = 1200;
    const height = 630;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#1A1A1A';
    ctx.fillRect(0, 0, width, height);

    const eventDate = new Date(event.date);
    const dateOptions = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Madrid' };

    // ==========================================================
    // --- AQUÍ ESTÁ LA LÍNEA CORREGIDA ---
    const formattedDate = eventDate.toLocaleDateString('es-ES', dateOptions).toUpperCase();
    // ==========================================================

    // DIBUJAR FECHA
    ctx.fillStyle = '#E0E0E0';
    ctx.font = '28px "Cinzel"';
    ctx.textAlign = 'center';
    ctx.fillText(formattedDate, width / 2, 200);

    // DIBUJAR ARTISTA
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '42px "Cinzel"';
    ctx.textAlign = 'center';
    ctx.fillText(event.artist.toUpperCase(), width / 2, 280);

    // DIBUJAR NOMBRE DEL EVENTO
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 60px "Cinzel"';
    ctx.textAlign = 'center';
    wrapText(ctx, event.name, width / 2, 360, 1000, 70);

    const generatedImagesDir = path.join(__dirname, '../generated_images');
    if (!fs.existsSync(generatedImagesDir)) {
        fs.mkdirSync(generatedImagesDir, { recursive: true });
    }

    const slug = (event.name || 'evento').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
    const imagePath = path.join(generatedImagesDir, `${slug}-${event.date}.png`);

    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(imagePath, buffer);

    console.log(`-> Imagen personalizada guardada en: ${imagePath}`);
    return imagePath;
}

module.exports = { createSocialImage };