require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

/**
 * Sube una imagen local a la mediateca de WordPress con textos SEO.
 * @param {string} imagePath - La ruta local de la imagen a subir.
 * @param {string} appPassword - La contraseña de aplicación de WordPress.
 * @param {string} altText - El texto alternativo para la imagen (SEO).
 * @param {string} title - El título para la imagen (SEO).
 * @returns {number|null} El ID de la imagen subida, o null si falla.
 */
// --> CAMBIO: La función ahora acepta altText y title
async function uploadImageToWordPress(imagePath, appPassword, altText, title) {
    if (!imagePath) return null;

    const wpApiUrl = `${process.env.WORDPRESS_URL}/wp-json/wp/v2/media`;
    const wpUser = process.env.WORDPRESS_USER;
    const wpAuth = Buffer.from(`${wpUser}:${appPassword}`).toString('base64');

    console.log(`🖼️  Intentando subir imagen: ${imagePath}`);

    try {
        const fileBuffer = fs.readFileSync(imagePath);
        const filename = path.basename(imagePath);
        const form = new FormData();

        form.append('file', fileBuffer, { filename: filename });

        // --> CAMBIO: Añadimos los campos SEO al formulario que se envía
        if (title) {
            form.append('title', title);
        }
        if (altText) {
            form.append('alt_text', altText);
        }

        const response = await axios.post(wpApiUrl, form, {
            headers: {
                'Authorization': `Basic ${wpAuth}`,
                ...form.getHeaders()
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            timeout: 20000
        });

        if (response.status === 201) {
            console.log(`✅ Imagen subida con éxito a WordPress. ID: ${response.data.id}`);
            return response.data.id;
        }
        return null;

    } catch (error) {
        console.error('❌ Error al subir la imagen a WordPress:');
        if (error.response) {
            console.error('   -> Status:', error.response.status);
            console.error('   -> Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('   -> Mensaje:', error.message);
        }
        return null;
    }
}


/**
 * Publica un post en el blog de Afland.es y devuelve la URL de la imagen destacada.
 * @param {object} postData - Un objeto con toda la información del post.
 * @param {string} appPassword - La contraseña de aplicación de WordPress.
 * @param {number} mediaId - El ID de la imagen destacada.
 * @returns {object} Un objeto con la respuesta del post y la URL final de la imagen.
 */
async function publishToAflandBlog(postData, appPassword, mediaId) {
    // --> CAMBIO: Añadimos "?_embed" para que WordPress nos devuelva más datos
    const wpApiUrl = `${process.env.WORDPRESS_URL}/wp-json/wp/v2/posts?_embed`;
    const wpUser = process.env.WORDPRESS_USER;
    const wpAuth = Buffer.from(`${wpUser}:${appPassword}`).toString('base64');

    const payload = {
        title: postData.title,
        content: postData.content,
        slug: postData.slug,
        status: postData.status || 'publish',
        categories: [96],
        meta: postData.meta,
        featured_media: mediaId
    };

    if (postData.date) {
        payload.date_gmt = new Date(postData.date).toISOString();
    }

    console.log('🔗 Preparando para publicar en el blog de afland.es...');

    try {
        const response = await axios.post(wpApiUrl, payload, {
            headers: {
                'Authorization': `Basic ${wpAuth}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 201) {
            console.log('✅ Publicación enviada al blog con éxito.');
            console.log(`   -> URL del Post: ${response.data.link}`);

            // --> CAMBIO: Extraemos la URL de la imagen de la respuesta y la devolvemos
            try {
                const imageUrl = response.data._embedded['wp:featuredmedia'][0].source_url;
                console.log(`   -> URL de Imagen Destacada: ${imageUrl}`);
                return { postResponse: response.data, finalImageUrl: imageUrl };
            } catch (e) {
                console.warn('   -> ⚠️ No se pudo extraer la URL de la imagen destacada de la respuesta.');
                return { postResponse: response.data, finalImageUrl: null };
            }
        }
        return { postResponse: response.data, finalImageUrl: null };
    } catch (error) {
        console.error('❌ Error al publicar en WordPress:', error.response ? error.response.data : error.message);
        throw error;
    }
}

module.exports = { publishToAflandBlog, uploadImageToWordPress };