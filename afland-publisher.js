// afland-publisher.js
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const BOT_USER_AGENT = 'DuendeFinder-ContentBot/1.0'; // Definimos el User-Agent una vez

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
        if (title) form.append('title', title);
        if (altText) form.append('alt_text', altText);

        const response = await axios.post(wpApiUrl, form, {
            headers: {
                'Authorization': `Basic ${wpAuth}`,
                'User-Agent': BOT_USER_AGENT,
                ...form.getHeaders()
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            timeout: 30000 // Timeout para la subida de la imagen
        });

        if (response.status === 201) {
            console.log(`✅ Imagen subida con éxito a WordPress. ID: ${response.data.id}`);
            return response.data.id;
        }
        return null;
    } catch (error) {
        console.error('❌ Error al subir la imagen a WordPress:', error.response ? JSON.stringify(error.response.data) : error.message);
        return null;
    }
}

async function publishToAflandBlog(postData, appPassword, mediaId) {
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

    console.log('🔗 Preparando para publicar en el blog de afland.es...');

    try {
        const response = await axios.post(wpApiUrl, payload, {
            headers: {
                'Authorization': `Basic ${wpAuth}`,
                'Content-Type': 'application/json',
                'User-Agent': BOT_USER_AGENT
            },
            // 🎉 Corrección: Añadimos un timeout para evitar el socket hang up
            timeout: 45000
        });

        if (response.status === 201) {
            console.log('✅ Publicación enviada al blog con éxito.');
            console.log(`   -> URL del Post: ${response.data.link}`);
            try {
                const imageUrl = response.data._embedded['wp:featuredmedia'][0].source_url;
                console.log(`   -> URL de Imagen Destacada: ${imageUrl}`);
                return { postResponse: response.data, finalImageUrl: imageUrl };
            } catch (e) {
                console.warn('   -> ⚠️ No se pudo extraer la URL de la imagen destacada.');
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