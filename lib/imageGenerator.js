// lib/imageGenerator.js (VERSIÓN FINAL)

const sharp = require('sharp');
const path = require('path');

/**
 * Crea una imagen de portada para el buscador usando una plantilla.
 * @param {object} event - El objeto del evento con 'date' y 'city'.
 * @returns {Promise<string>} La ruta al fichero de imagen generado.
 */
async function createFinderImage(event) {
    try {
        const imageWidth = 1200;
        const imageHeight = 675; // Formato 16:9
        const sidebarWidth = 240; // Ancho de la franja de color

        // 1. Seleccionar una plantilla al azar
        const templates = ['template1.png', 'template2.png'];
        const chosenTemplate = templates[Math.floor(Math.random() * templates.length)];
        const templatePath = path.join(__dirname, '..', 'templates', chosenTemplate);

        // 2. Formatear los textos
        const eventDate = new Date(event.date);
        const dateOptions = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' };
        const dateText = eventDate.toLocaleDateString('es-ES', dateOptions);
        const cityText = event.city.toUpperCase();

        // 3. Crear el SVG con el texto y la línea separadora
        const separatorLineColor = '#E1B12C'; // Tono dorado del logo
        const textAreaXCenter = sidebarWidth + ((imageWidth - sidebarWidth) / 2);

        const svgContent = `
        <svg width="${imageWidth}" height="${imageHeight}">
            <style>
                .date { fill: #FFFFFF; font-size: 72px; font-family: 'Montserrat', sans-serif; font-weight: bold; }
                .city { fill: #FFFFFF; font-size: 48px; font-family: 'Montserrat', sans-serif; font-weight: bold; }
            </style>
            
            <rect x="${sidebarWidth}" y="0" width="2" height="${imageHeight}" fill="${separatorLineColor}" />

            <text x="${textAreaXCenter}" y="320" text-anchor="middle" class="date">${dateText}</text>
            <text x="${textAreaXCenter}" y="400" text-anchor="middle" class="city">${cityText}</text>
        </svg>
        `;

        const svgBuffer = Buffer.from(svgContent);
        const outputPath = path.join(__dirname, '..', `finder-image-${Date.now()}.png`);

        // 4. Usar Sharp para componer la imagen final
        await sharp(templatePath)
            .resize(imageWidth, imageHeight)
            .flatten({ background: '#121212' }) // Fondo gris oscuro
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

// Mantenemos la función antigua por si se usa en otro sitio, aunque no la desarrollemos ahora
async function createSocialImage(event) {
    console.log("createSocialImage para posts del blog llamada (función antigua).");
    return null;
}

module.exports = {
    createSocialImage,
    createFinderImage
};