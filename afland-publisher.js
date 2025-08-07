// afland-publisher.js

/**
 * Módulo para publicar contenido en el blog de afland.es.
 * Utiliza la API de WordPress para crear una nueva entrada
 * con autenticación básica.
 */

const axios = require('axios');

// URL de la API del blog. DEBES REEMPLAZAR ESTA URL con la de tu blog.
const AFLAND_BLOG_API_URL = 'https://afland.es/wp-json/wp/v2/posts';

/**
 * Publica un post en el blog de afland.es.
 * @param {string} postTitle - El título de la entrada del blog.
 * @param {string} postContent - El contenido de la entrada del blog.
 * @param {string} aflandToken - El token de acceso a la API del blog (usuario:contraseña codificado en Base64).
 */
async function publishToAflandBlog(postTitle, postContent, aflandToken) {
    console.log('🔗 Preparando para publicar en el blog de afland.es...');
    
    try {
        const payload = {
            title: postTitle,
            content: postContent,
            status: 'publish', // O 'draft' si prefieres revisarlo antes
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

module.exports = { publishToAflandBlog };
