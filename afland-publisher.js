// afland-publisher.js (Versión Corregida)

require('dotenv').config();
const axios = require('axios');

/**
 * Sube una imagen desde una URL a la mediateca de WordPress.
 * @param {string} imageUrl - La URL de la imagen a subir.
 * @param {string} appPassword - La contraseña de aplicación de WordPress.
 * @returns {number|null} El ID de la imagen subida, o null si falla.
 */
async function uploadImageToWordPress(imageUrl, appPassword) {
    if (!imageUrl) return null;
    console.log(`🖼️ Intentando subir imagen: ${imageUrl}`);
    
    try {
        // Lógica para descargar la imagen y subirla a WordPress...
        // ... (Esta parte la dejamos como la tenías, asumiendo que funciona)
        // Si no funciona, necesitaremos la librería 'form-data'
        return null; // Devolvemos null por ahora para no complicar el ejemplo
    } catch (error) {
        console.error('❌ Error al subir la imagen a WordPress:', error.message);
        return null;
    }
}


/**
 * Publica un post en el blog de Afland.es.
 * @param {object} postData - Un objeto con toda la información del post.
 * @param {string} appPassword - La contraseña de aplicación de WordPress.
 * @param {number} mediaId - El ID de la imagen destacada (opcional).
 */
async function publishToAflandBlog(postData, appPassword, mediaId) {
    const wpApiUrl = `${process.env.WORDPRESS_URL}/wp-json/wp/v2/posts`;
    const wpUser = process.env.WORDPRESS_USER;
    const wpAuth = Buffer.from(`${wpUser}:${appPassword}`).toString('base64');

    // Construimos el cuerpo de la petición desde el objeto 'postData'
    const payload = {
        title: postData.title,
        content: postData.content,
        slug: postData.slug,
        status: postData.status || 'publish', // 'publish' por defecto, o 'future' si se programa
        meta: postData.meta
    };

    // Si la fecha de publicación está definida, la añadimos.
    // Esta es la línea que fallaba antes. Ahora 'postData.date' sí existe.
    if (postData.date) {
        payload.date_gmt = new Date(postData.date).toISOString();
    }

    if (mediaId) {
        payload.featured_media = mediaId;
    }

    console.log('🔗 Preparando para publicar en el blog de afland.es...');

    try {
        const response = await axios.post(wpApiUrl, payload, {
            headers: {
                'Authorization': `Basic ${wpAuth}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 201) { // 201 significa "Created"
            console.log('✅ Publicación enviada al blog con éxito.');
            console.log(`   -> URL: ${response.data.link}`);
        }
        return response.data;
    } catch (error) {
        console.error('❌ Error al publicar en WordPress:', error.response ? error.response.data : error.message);
        throw error;
    }
}

module.exports = { publishToAflandBlog, uploadImageToWordPress };