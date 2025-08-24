// lib/wordpressClient.js
const axios = require('axios');

const WP_URL = process.env.WORDPRESS_URL;
const WP_USER = process.env.WORDPRESS_USER;
const WP_PASSWORD = process.env.WORDPRESS_APP_PASSWORD;

if (!WP_URL || !WP_USER || !WP_PASSWORD) {
    throw new Error('Faltan variables de entorno de WordPress. Revisa tu archivo .env');
}

/**
 * Publica un nuevo post en WordPress usando la API REST.
 * @param {object} postData - El objeto que contiene los datos del post.
 * @returns {Promise<object>} - La respuesta de la API de WordPress.
 */
async function publishToWordPress(postData) {
    const endpoint = `${WP_URL}/wp-json/wp/v2/posts`;
    const credentials = `${WP_USER}:${WP_PASSWORD}`;
    const buffer = Buffer.from(credentials);
    const authToken = buffer.toString('base64');

    const headers = {
        'Authorization': `Basic ${authToken}`,
        'Content-Type': 'application/json',
    };

    try {
        console.log(`🚀 Enviando post a WordPress titulado: "${postData.title}"`);
        const response = await axios.post(endpoint, postData, { headers });
        console.log(`✅ Post publicado/programado con éxito. ID: ${response.data.id}`);
        return response.data;
    } catch (error) {
        console.error('❌ Error al publicar en WordPress:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
        throw new Error('La publicación en WordPress ha fallado.');
    }
}

module.exports = { publishToWordPress };