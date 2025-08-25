// lib/wordpressClient.js
// VERSIÓN FINAL CON FUNCIÓN PARA ACTUALIZAR POSTS

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

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
 * (Esta función no cambia)
 */
async function uploadImage(imagePath, title) {
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
            timeout: 60000 // Mantenemos el timeout aumentado
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
 * (Esta función no cambia)
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


// ==========================================================
// --- NUEVA FUNCIÓN AÑADIDA PARA EL SANEADOR ---
// ==========================================================
/**
 * Actualiza un post existente en WordPress.
 * @param {number|string} postId - El ID del post a actualizar.
 * @param {object} updateData - Objeto con los campos a actualizar (ej. content, featured_media).
 * @returns {Promise<object>} - La respuesta de la API de WordPress.
 */
async function updateWordPressPost(postId, updateData) {
    // La API de WordPress usa POST también para actualizar, apuntando al ID específico.
    const endpoint = `${WP_URL}/wp-json/wp/v2/posts/${postId}`;
    console.log(`🔄 Actualizando post en WordPress con ID: ${postId}`);
    try {
        const response = await axios.post(endpoint, updateData, {
            headers: { ...authHeaders, 'Content-Type': 'application/json', 'User-Agent': BOT_USER_AGENT },
            timeout: 45000
        });
        console.log(`✅ Post ID ${postId} actualizado con éxito. URL: ${response.data.link}`);
        return response.data;
    } catch (error) {
        console.error(`❌ Error al actualizar el post ID ${postId}:`, error.response?.data || error.message);
        throw new Error('La actualización en WordPress ha fallado.');
    }
}


// Se añade la nueva función a las exportaciones
module.exports = { publishToWordPress, uploadImage, updateWordPressPost };