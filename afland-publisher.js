require('dotenv').config();
const axios = require('axios');
// --- NUEVAS DEPENDENCIAS AÑADIDAS ---
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');


// --- FUNCIÓN DE SUBIDA DE IMAGEN COMPLETAMENTE RECONSTRUIDA ---
/**
 * Sube una imagen local a la mediateca de WordPress.
 * @param {string} imagePath - La ruta local de la imagen a subir.
 * @param {string} appPassword - La contraseña de aplicación de WordPress.
 * @returns {number|null} El ID de la imagen subida, o null si falla.
 */
async function uploadImageToWordPress(imagePath, appPassword) {
    if (!imagePath) return null;

    // Obtenemos las credenciales y la URL de la API desde el .env
    const wpApiUrl = `${process.env.WORDPRESS_URL}/wp-json/wp/v2/media`;
    const wpUser = process.env.WORDPRESS_USER;
    const wpAuth = Buffer.from(`${wpUser}:${appPassword}`).toString('base64');

    console.log(`🖼️  Intentando subir imagen: ${imagePath}`);

    try {
        // 1. Leer el archivo de la imagen desde el disco
        const fileBuffer = fs.readFileSync(imagePath);
        const filename = path.basename(imagePath);

        // 2. Crear un formulario de datos para la subida
        const form = new FormData();
        form.append('file', fileBuffer, { filename: filename });

        // 3. Realizar la petición POST a la API de WordPress
        const response = await axios.post(wpApiUrl, form, {
            headers: {
                'Authorization': `Basic ${wpAuth}`,
                ...form.getHeaders() // Esto establece Content-Type a multipart/form-data
            },
            // Es importante para que axios no falle con archivos grandes
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
        });

        // 4. Si la subida es exitosa (código 201), devolvemos el ID de la imagen
        if (response.status === 201) {
            console.log(`✅ Imagen subida con éxito a WordPress. ID: ${response.data.id}`);
            return response.data.id;
        }
        return null;

    } catch (error) {
        // MEJORA CLAVE: Mostramos el error detallado que nos da WordPress
        console.error('❌ Error al subir la imagen a WordPress:');
        if (error.response) {
            // El servidor respondió con un estado de error (4xx, 5xx)
            console.error('   -> Status:', error.response.status);
            console.error('   -> Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            // Ocurrió un error en la propia petición (ej. red)
            console.error('   -> Mensaje:', error.message);
        }
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

    const payload = {
        title: postData.title,
        content: postData.content,
        slug: postData.slug,
        status: postData.status || 'publish',
        categories: [96],
        meta: postData.meta
    };

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

        if (response.status === 201) {
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
