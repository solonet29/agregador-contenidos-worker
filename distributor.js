// distributor.js
// OBJETIVO: Distribuir posts de WordPress a redes sociales (Pinterest y Reddit)

require('dotenv').config();
const { connectToDatabase } = require('./lib/database.js');
const axios = require('axios');
const showdown = require('showdown'); // Necesario para parsear el contenido si se genera un título/descripción desde el post

// Variables de entorno de las redes sociales
const PINTEREST_ACCESS_TOKEN = process.env.PINTEREST_ACCESS_TOKEN;
const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID;
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET;
const REDDIT_USERNAME = process.env.REDDIT_USERNAME;
const REDDIT_PASSWORD = process.env.REDDIT_PASSWORD;

// Subreddits de destino
const REDDIT_SUBREDDITS = ['flamenco', 'spain', 'andalucia', 'Flamenco'];

// --- Funciones de Distribución ---

/**
 * Publica un Pin en Pinterest.
 * @param {string} imageUrl - URL de la imagen del post.
 * @param {string} title - Título del Pin.
 * @param {string} link - Enlace al post del blog.
 */
async function publishToPinterest(imageUrl, title, link) {
    if (!PINTEREST_ACCESS_TOKEN) {
        console.warn('❌ Clave de Pinterest no encontrada. Saltando la publicación en Pinterest.');
        return;
    }
    console.log('🔗 Publicando en Pinterest...');
    try {
        await axios.post('https://api.pinterest.com/v5/pins', {
            board_id: 'TU_ID_DE_TABLERO', // Reemplaza con el ID de tu tablero
            media_source: {
                source_type: 'image_url',
                url: imageUrl
            },
            link: link,
            title: title
        }, {
            headers: {
                Authorization: `Bearer ${PINTEREST_ACCESS_TOKEN}`
            }
        });
        console.log('✅ Pin publicado en Pinterest con éxito.');
    } catch (error) {
        console.error('❌ Error al publicar en Pinterest:', error.response?.data?.message || error.message);
    }
}

/**
 * Publica un post de enlace en Reddit.
 * @param {string} title - Título del post.
 * @param {string} link - URL del post del blog.
 */
async function publishToReddit(title, link) {
    if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET || !REDDIT_USERNAME || !REDDIT_PASSWORD) {
        console.warn('❌ Credenciales de Reddit incompletas. Saltando la publicación en Reddit.');
        return;
    }
    console.log('🔗 Publicando en Reddit...');
    try {
        const tokenResponse = await axios.post(
            'https://www.reddit.com/api/v1/access_token',
            `grant_type=password&username=${REDDIT_USERNAME}&password=${REDDIT_PASSWORD}`,
            {
                headers: {
                    Authorization: `Basic ${Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64')}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        const accessToken = tokenResponse.data.access_token;

        for (const subreddit of REDDIT_SUBREDDITS) {
            await axios.post(
                'https://oauth.reddit.com/api/submit',
                {
                    sr: subreddit,
                    kind: 'link',
                    title: title,
                    url: link
                },
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'User-Agent': 'DuendeFinder-App/1.0'
                    }
                }
            );
            console.log(`✅ Post publicado en r/${subreddit} con éxito.`);
        }
    } catch (error) {
        console.error('❌ Error al publicar en Reddit:', error.response?.data?.message || error.message);
    }
}

// --- Lógica Principal del Distribuidor ---
async function main() {
    console.log('🚀 Iniciando el distribuidor de contenidos...');
    try {
        const db = await connectToDatabase();
        const eventsCollection = db.collection('events');

        // Buscar eventos que ya están publicados en WordPress y aún no se han distribuido
        const postsToDistribute = await eventsCollection.find({
            wordpressPostId: { $exists: true, $ne: null },
            isDistributed: { $exists: false }
        }).toArray();

        if (postsToDistribute.length === 0) {
            console.log('✅ No hay posts nuevos para distribuir. Finalizando.');
            return;
        }

        console.log(`⚙️ Se encontraron ${postsToDistribute.length} posts para distribuir.`);

        for (const event of postsToDistribute) {
            const blogPostUrl = event.blogPostUrl;
            const blogPostTitle = event.blogPostTitle || event.name;

            // Este es un ejemplo de URL de imagen. Deberías guardarla en la BD cuando se suba a WP.
            const imageUrl = `https://afland.es/wp-content/uploads/2025/08/imagen-del-post.jpg`;

            console.log(`--- Distribuyendo post: "${blogPostTitle}" ---`);

            // Publicar en Pinterest
            await publishToPinterest(imageUrl, blogPostTitle, blogPostUrl);

            // Publicar en Reddit
            await publishToReddit(blogPostTitle, blogPostUrl);

            // Marcar como distribuido para no procesarlo de nuevo
            await eventsCollection.updateOne(
                { _id: event._id },
                { $set: { isDistributed: true } }
            );
            console.log(`✅ Evento '${event.name}' marcado como distribuido.`);
        }

    } catch (error) {
        console.error('💥 Ha ocurrido un error fatal en el distribuidor:', error);
    } finally {
        console.log('Proceso de distribución finalizado.');
    }
}

main();