// lib/imageGenerator.js
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, registerFont } = require('canvas');

// --- REGISTRAR FUENTE PERSONALIZADA ---
// Le decimos a canvas dónde encontrar tu fuente para que pueda usarla.
const fontPath = path.join(__dirname, '../templates/Cinzel-Bold.ttf');
registerFont(fontPath, { family: 'Cinzel' });

/**
 * Envuelve el texto si es demasiado largo para el ancho de la imagen.
 * @param {CanvasRenderingContext2D} ctx - El contexto del canvas.
 * @param {string} text - El texto a dibujar.
 * @param {number} x - La coordenada X.
 * @param {number} y - La coordenada Y.
 * @param {number} maxWidth - El ancho máximo permitido para el texto.
 * @param {number} lineHeight - La altura de cada línea.
 */
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


/**
 * Crea una imagen para redes sociales para un evento específico.
 * @param {object} event - El documento del evento de la base de datos.
 * @returns {Promise<string>} - La ruta al archivo de imagen generado.
 */
async function createSocialImage(event) {
    console.log("-> Iniciando la creación de la imagen personalizada...");

    // --- 1. CONFIGURACIÓN DEL LIENZO ---
    const width = 1200;
    const height = 630;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // --- 2. DIBUJAR EL FONDO ---
    const backgroundPath = path.join(__dirname, '../templates/background1.png');
    const background = await loadImage(backgroundPath);
    ctx.drawImage(background, 0, 0, width, height);

    // --- 3. PREPARAR Y DIBUJAR TEXTOS ---

    // Formatear la fecha para que sea más legible
    const eventDate = new Date(event.date);
    const dateOptions = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Madrid' };
    const formattedDate = eventDate.toLocaleDateString('es-ES', dateOptions).toUpperCase();

    // DIBUJAR FECHA
    ctx.fillStyle = '#E0E0E0'; // Un color gris claro
    ctx.font = '32px "Cinzel"';
    ctx.textAlign = 'center';
    ctx.fillText(formattedDate, width / 2, 150);

    // DIBUJAR ARTISTA
    ctx.fillStyle = '#FFFFFF'; // Blanco
    ctx.font = '48px "Cinzel"';
    ctx.textAlign = 'center';
    ctx.fillText(event.artist.toUpperCase(), width / 2, 240);

    // DIBUJAR NOMBRE DEL EVENTO (con ajuste de línea)
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 72px "Cinzel"';
    ctx.textAlign = 'center';
    wrapText(ctx, event.name, width / 2, 350, 1000, 80); // Ancho máximo de 1000px, altura de línea de 80px

    // --- 4. GUARDAR LA IMAGEN FINAL ---
    const generatedImagesDir = path.join(__dirname, '../generated_images');
    if (!fs.existsSync(generatedImagesDir)) {
        fs.mkdirSync(generatedImagesDir, { recursive: true });
    }

    // Crear un nombre de archivo legible y único
    const slug = event.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
    const imagePath = path.join(generatedImagesDir, `${slug}-${event.date}.png`);

    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(imagePath, buffer);

    console.log(`-> Imagen personalizada guardada en: ${imagePath}`);
    return imagePath;
}

module.exports = { createSocialImage };