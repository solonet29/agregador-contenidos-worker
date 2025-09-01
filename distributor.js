
// distributor.js (Refactorizado como Módulo)
// OBJETIVO: Distribuir posts ya publicados en WordPress a redes sociales.

require('dotenv').config();
const { connectToDatabase } = require('./lib/database.js');
const axios = require('axios');
const config = require('./config.js'); // Importar la configuración central

// --- Variables de entorno ---
const PINTEREST_ACCESS_TOKEN = process.env.PINTEREST_ACCESS_TOKEN;
const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID;
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET;
const REDDIT_USERNAME = process.env.REDDIT_USERNAME;
const REDDIT_PASSWORD = process.env.REDDIT_PASSWORD;

/**
 * Publica un Pin en Pinterest.
 */
async function publishToPinterest(imageUrl, title, link) {
    if (!PINTEREST_ACCESS_TOKEN) {
        console.warn('   - (Pinterest) Clave de API no encontrada. Saltando...');
        return;
    }
    console.log('   -> Publicando en Pinterest...');
    try {
        await axios.post('https://api.pinterest.com/v5/pins', {
            board_id: config.socialMedia.pinterestBoardId,
            media_source: {
                source_type: 'image_url',
                url: imageUrl
            },
            link: link,
            title: title
        }, {
            headers: { Authorization: `Bearer ${PINTEREST_ACCESS_TOKEN}` }
        });
        console.log('   ✅ Pin publicado en Pinterest.');
    } catch (error) {
        console.error('   ❌ Error en Pinterest:', error.response?.data?.message || error.message);
    }
}

/**
 * Publica un post de enlace en Reddit.
 */
async function publishToReddit(title, link) {
    if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET || !REDDIT_USERNAME || !REDDIT_PASSWORD) {
        console.warn('   - (Reddit) Credenciales incompletas. Saltando...');
        return;
    }
    console.log('   -> Publicando en Reddit...');
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

        for (const subreddit of config.socialMedia.redditSubreddits) {
            await axios.post(
                'https://oauth.reddit.com/api/submit',
                { sr: subreddit, kind: 'link', title: title, url: link },
                { headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'DuendeFinder-App/1.0' } }
            );
            console.log(`      ✅ Post publicado en r/${subreddit}.`);
        }
    } catch (error) {
        console.error('   ❌ Error en Reddit:', error.response?.data?.message || error.message);
    }
}

/**
 * Función principal del módulo.
 * Procesa un lote de posts para distribuirlos en redes sociales.
 */
async function distributePosts() {
    const db = await connectToDatabase();
    const eventsCollection = db.collection('events');

    // Buscamos eventos que ya están publicados en WordPress y aún no se han distribuido
    const query = {
        status: 'published',
        isDistributed: { $exists: false }
    };
    const postsToDistribute = await eventsCollection.find(query).limit(config.BATCH_SIZE).toArray();

    if (postsToDistribute.length === 0) {
        console.log('✅ No hay posts nuevos para distribuir en redes sociales.');
        return;
    }

    console.log(`⚙️ Se encontraron ${postsToDistribute.length} posts para distribuir.`);

    for (const event of postsToDistribute) {
        console.log(`   -> Distribuyendo: "${event.blogPostTitle}"`);

        // La URL de la imagen destacada que se guardó en el paso de publicación
        const imageUrl = event.featuredImageUrl; // Asumiendo que guardamos esto. Si no, necesitamos obtenerlo.
        if (!imageUrl) {
            console.warn(`   ⚠️ No se encontró URL de imagen destacada para "${event.name}". No se puede publicar en Pinterest.`);
        }

        // Publicar en Pinterest (solo si hay imagen)
        if(imageUrl) await publishToPinterest(imageUrl, event.blogPostTitle, event.blogPostUrl);

        // Publicar en Reddit
        await publishToReddit(event.blogPostTitle, event.blogPostUrl);

        // Marcar como distribuido
        await eventsCollection.updateOne({ _id: event._id }, { $set: { isDistributed: true } });
        console.log(`   ✅ Evento '${event.name}' marcado como distribuido.`);
    }
}

// Exportar la función principal
module.exports = { distributePosts };
