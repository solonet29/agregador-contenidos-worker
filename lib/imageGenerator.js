// lib/imageGenerator.js (VERSIÓN FINAL CON AJUSTES DE TEXTO)

const sharp = require('sharp');
const path = require('path');

async function createFinderImage(event) {
    try {
        const imageWidth = 1200;
        const imageHeight = 675;
        const sidebarWidth = 240; // Ancho donde empieza el área de texto

        const templates = ['template1.png', 'template2.png'];
        const chosenTemplate = templates[Math.floor(Math.random() * templates.length)];
        const templatePath = path.join(__dirname, '..', 'templates', chosenTemplate);

        const eventDate = new Date(event.date);
        const dateOptions = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' };
        const dateText = eventDate.toLocaleDateString('es-ES', dateOptions);
        const cityText = event.city.toUpperCase();

        // --- AJUSTES FINALES DE DISEÑO ---
        // El área de texto empieza en el píxel 240 y termina en el 1200.
        // El centro de esa área es: 240 + ((1200 - 240) / 2) = 720
        const textAreaXCenter = 720;

        const svgContent = `
        <svg width="${imageWidth}" height="${imageHeight}">
            <style>
                /* Tamaño de fuente ligeramente reducido */
                .date { fill: #FFFFFF; font-size: 55px; font-family: 'Montserrat', sans-serif; font-weight: bold; }
                .city { fill: #FFFFFF; font-size: 36px; font-family: 'Montserrat', sans-serif; font-weight: bold; }
            </style>
            
            <text x="${textAreaXCenter}" y="330" text-anchor="middle" class="date">${dateText}</text>
            <text x="${textAreaXCenter}" y="390" text-anchor="middle" class="city">${cityText}</text>
        </svg>
        `;

        const svgBuffer = Buffer.from(svgContent);
        const outputPath = path.join(__dirname, '..', `finder-image-${Date.now()}.png`);

        await sharp(templatePath)
            .resize(imageWidth, imageHeight)
            .flatten({ background: '#121212' })
            .composite([{
                input: svgBuffer,
                top: 0,
                left: 0,
            }])
            .toFile(outputPath);

        console.log(`✅ Imagen para el buscador creada en: ${outputPath}`);
        return outputPath;

    } catch (error) {
        console.error("❌ Error al crear la imagen para el buscador:", error);
        throw error;
    }
}

async function createSocialImage(event) {
    console.log("createSocialImage para posts del blog llamada (función antigua).");
    return null;
}

module.exports = {
    createSocialImage,
    createFinderImage
};