// lib/imageGenerator.js (Refactorizado)

const sharp = require('sharp');
const path = require('path');

/**
 * Crea la imagen para un post del blog seleccionando una plantilla al azar.
 * @param {object} event - El objeto del evento.
 * @returns {Promise<string>} La ruta a la imagen generada.
 */
async function createPostImage(event) {
    try {
        const imageWidth = 1200;
        const imageHeight = 675;
        const sidebarWidth = 240; // Ancho donde empieza el área de texto

        // Lógica para elegir una plantilla al azar
        const templates = ['template1.png', 'template2.png'];
        const chosenTemplate = templates[Math.floor(Math.random() * templates.length)];
        const templatePath = path.join(__dirname, '..', 'templates', chosenTemplate);

        const eventDate = new Date(event.date);
        const dateOptions = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' };
        const dateText = eventDate.toLocaleDateString('es-ES', dateOptions);
        const cityText = event.city.toUpperCase();

        const textAreaXCenter = 720; // Centro del área de texto

        const svgContent = `
        <svg width="${imageWidth}" height="${imageHeight}">
            <style>
                .date { fill: #FFFFFF; font-size: 55px; font-family: 'Montserrat', sans-serif; font-weight: bold; }
                .city { fill: #FFFFFF; font-size: 36px; font-family: 'Montserrat', sans-serif; font-weight: bold; }
            </style>
            <text x="${textAreaXCenter}" y="330" text-anchor="middle" class="date">${dateText}</text>
            <text x="${textAreaXCenter}" y="390" text-anchor="middle" class="city">${cityText}</text>
        </svg>
        `;

        const svgBuffer = Buffer.from(svgContent);
        const outputPath = path.join(__dirname, '..', `generated_images`, `post-image-${Date.now()}.png`);

        await sharp(templatePath)
            .resize(imageWidth, imageHeight)
            .flatten({ background: '#121212' })
            .composite([{
                input: svgBuffer,
                top: 0,
                left: 0,
            }])
            .toFile(outputPath);

        console.log(`   ✅ Imagen para el post creada en: ${outputPath}`);
        return outputPath;

    } catch (error) {
        console.error("   ❌ Error al crear la imagen del post:", error);
        throw error;
    }
}

// Exportamos únicamente la función que nos interesa
module.exports = { createPostImage };
