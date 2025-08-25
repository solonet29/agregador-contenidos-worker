// lib/wordpressClient.js
// VERSIÓN CORREGIDA Y SIMPLIFICADA

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data'); // Asegúrate de haber hecho 'npm install form-data'

const WP_URL = process.env.WORDPRESS_URL;
const WP_USER = process.env.WORDPRESS_USER;
const WP_PASSWORD = process.env.WORDPRESS_APP_PASSWORD;
const BOT_USER_AGENT = 'DuendeFinder-ContentBot/1.0';

if (!WP_URL || !WP_USER || !WP_PASSWORD) {
    throw new Error('Faltan variables de entorno de WordPress.');
}

const wpAuth = Buffer.from(`${WP_USER}:${WP_PASSWORD}`).toString('base64');
const authHeaders = { 'Authorization': `Basic ${wpAuth}` };

/**
 * Sube una imagen a la Biblioteca de Medios de WordPress.
 * @param {string} imagePath - La ruta local de la imagen.
 * @param {string} title - El título para la imagen en WordPress.
 * @returns {Promise<number|null>} - El ID de la imagen subida.
 */
async function uploadImage(imagePath, title) { // <-- NOMBRE CORREGIDO
    if (!imagePath || !fs.existsSync(imagePath)) {
        console.error(`⚠️ La imagen no existe en la ruta: ${imagePath}`);
        return null;
    }
    const endpoint = `${WP_URL}/wp-json/wp/v2/media`;

    try {
        const fileBuffer = fs.readFileSync(imagePath);
        const filename = path.basename(imagePath);
        const form = new FormData();
        form.append('file', fileBuffer, { filename });
        if (title) form.append('title', title);

        const response = await axios.post(endpoint, form, {
            headers: { ...authHeaders, 'User-Agent': BOT_USER_AGENT, ...form.getHeaders() },
            timeout: 30000
        });

        console.log(`✅ Imagen subida con éxito. ID: ${response.data.id}`);
        return response.data.id;

    } catch (error) {
        console.error('❌ Error al subir la imagen a WordPress:', error.response?.data || error.message);
        return null;
    }
}

/**
 * Publica un nuevo post en WordPress.
 * @param {object} postData - El objeto con los datos del post.
 * @returns {Promise<object>} - La respuesta de la API de WordPress.
 */
async function publishToWordPress(postData) {
    const endpoint = `${WP_URL}/wp-json/wp/v2/posts`;
    try {
        console.log(`🚀 Enviando post a WordPress titulado: "${postData.title}"`);
        const response = await axios.post(endpoint, postData, {
            headers: { ...authHeaders, 'Content-Type': 'application/json', 'User-Agent': BOT_USER_AGENT },
            timeout: 45000
        });
        console.log(`✅ Post programado con éxito. URL: ${response.data.link}`);
        return response.data;
    } catch (error) {
        console.error('❌ Error al publicar en WordPress:', error.response?.data || error.message);
        throw error;
    }
}

// CAMBIO: Exportamos la función con el nombre nuevo y correcto
module.exports = { publishToWordPress, uploadImage };