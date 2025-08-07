// afland-publisher.js

const axios = require('axios');

const AFLAND_BLOG_API_URL = 'https://afland.es/wp-json/wp/v2/posts';
const AFLAND_MEDIA_API_URL = 'https://afland.es/wp-json/wp/v2/media';

/**
 * Publica un post en el blog de afland.es.
 * @param {string} postTitle - El título de la entrada del blog.
 * @param {string} postContent - El contenido de la entrada del blog.
 * @param {string} aflandToken - El token de acceso a la API del blog.
 * @param {number} featuredMediaId - El ID de la imagen destacada.
 * @param {Date} publishTime - La fecha y hora de publicación.
 */
async function publishToAflandBlog(postTitle, postContent, aflandToken, featuredMediaId, publishTime) {
    console.log('🔗 Preparando para publicar en el blog de afland.es...');
    
    try {
        const payload = {
            title: postTitle,
            content: postContent,
            status: 'future', // Cambiamos a 'future' para programar el post
            date_gmt: publishTime.toISOString(), // Enviamos la fecha en formato ISO
            featured_media: featuredMediaId, 
        };

        const config = {
            headers: {
                'Authorization': `Basic ${aflandToken}`,
                'Content-Type': 'application/json'
            }
        };

        const response = await axios.post(AFLAND_BLOG_API_URL, payload, config);
        console.log('✅ Publicación enviada al blog con éxito.');
        console.log('Respuesta de la API:', response.data);
    } catch (error) {
        console.error('❌ Error al publicar en el blog:', error);
        throw error;
    }
}

/**
 * Sube una imagen a la biblioteca de medios de WordPress.
 * @param {string} imageUrl - La URL de la imagen a subir.
 * @param {string} aflandToken - El token de acceso a la API del blog.
 * @returns {number|null} El ID de la imagen subida, o null en caso de error.
 */
async function uploadImageToWordPress(imageUrl, aflandToken) {
    console.log(`🖼️ Intentando subir imagen desde: ${imageUrl}`);
    try {
        const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(imageResponse.data, 'binary');
        const fileName = imageUrl.split('/').pop().split('?')[0];

        const config = {
            headers: {
                'Authorization': `Basic ${aflandToken}`,
                'Content-Disposition': `attachment; filename="${fileName}"`,
                'Content-Type': imageResponse.headers['content-type']
            }
        };

        const uploadResponse = await axios.post(AFLAND_MEDIA_API_URL, imageBuffer, config);

        console.log(`✅ Imagen subida a WordPress con ID: ${uploadResponse.data.id}`);
        return uploadResponse.data.id;
    } catch (error) {
        console.error('❌ Error al subir la imagen a WordPress:', error);
        return null;
    }
}

module.exports = { publishToAflandBlog, uploadImageToWordPress };
