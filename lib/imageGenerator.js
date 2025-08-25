// lib/imageGenerator.js (VERSIÓN CON FONDO DINÁMICO)
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, registerFont } = require('canvas');

// --- REGISTRAR FUENTE PERSONALIZADA ---
const fontPath = path.join(__dirname, '../templates/Cinzel-Bold.ttf');
if (fs.existsSync(fontPath)) {
    registerFont(fontPath, { family: 'Cinzel' });
} else {
    console.warn("Advertencia: No se encontró la fuente Cinzel-Bold.ttf.");
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    // ... (La función wrapText se mantiene exactamente igual)
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

    // --- 2. DIBUJAR EL FONDO (TU IDEA) ---
    // En lugar de cargar una imagen, rellenamos el lienzo con un color.
    // Puedes cambiar este código hexadecimal por el color oscuro que prefieras.
    ctx.fillStyle = '#1A1A1A'; // Un color carbón oscuro, casi negro.
    ctx.fillRect(0, 0, width, height);

    // Si en el futuro quisieras añadir un marco o logo desde una plantilla transparente,
    // lo harías aquí, dibujando esa imagen PNG transparente encima del fondo de color.
    // Ejemplo:
    // const template = await loadImage(path.join(__dirname, '../templates/marco_transparente.png'));
    // ctx.drawImage(template, 0, 0, width, height);


    // --- 3. PREPARAR Y DIBUJAR TEXTOS (Igual que antes) ---
    const eventDate = new Date(event.date);
    const dateOptions = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Madrid' };
    const formattedDate = eventDate.toLocaleDate日にち('es-ES', dateOptions).toUpperCase();

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

    // --- 4. GUARDAR LA IMAGEN FINAL (Igual que antes) ---
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