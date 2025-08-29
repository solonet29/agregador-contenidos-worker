// lib/imageGenerator.js (VERSIÓN FINAL CON COLOR DE LÍNEA #817b50)

const sharp = require('sharp');
const path = require('path');

async function createFinderImage(event) {
    try {
        const imageWidth = 1200;
        const imageHeight = 675;
        const sidebarWidth = 240;

        const templates = ['template1.png', 'template2.png'];
        const chosenTemplate = templates[Math.floor(Math.random() * templates.length)];
        const templatePath = path.join(__dirname, '..', 'templates', chosenTemplate);

        const eventDate = new Date(event.date);
        const dateOptions = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' };
        const dateText = eventDate.toLocaleDateString('es-ES', dateOptions);
        const cityText = event.city.toUpperCase();

        // --- COLOR DE LÍNEA ACTUALIZADO ---
        const separatorLineColor = '#817b50';
        const textAreaXCenter = sidebarWidth + ((imageWidth - sidebarWidth) / 2);

        const svgContent = `
        <svg width="${imageWidth}" height="${imageHeight}">
            <style>
                .date { fill: #FFFFFF; font-size: 60px; font-family: 'Montserrat', sans-serif; font-weight: bold; }
                .city { fill: #FFFFFF; font-size: 40px; font-family: 'Montserrat', sans-serif; font-weight: bold; }
            </style>
            
            <rect x="${sidebarWidth - 1}" y="0" width="2" height="${imageHeight}" fill="${separatorLineColor}" />

            <text x="${textAreaXCenter}" y="325" text-anchor="middle" class="date">${dateText}</text>
            <text x="${textAreaXCenter}" y="395" text-anchor="middle" class="city">${cityText}</text>
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