// distributor.js (Refactorizado como Módulo)
// OBJETIVO: Distribuir posts ya publicados en WordPress a redes sociales.

require('dotenv').config();
const { connectToDatabase } = require('./lib/database.js');
const axios = require('axios');
const config = require('./config.js'); // Importar la configuración central
const { XClient } = require('./lib/xClient.js'); // --- NUEVO: Importar el cliente de X ---

// --- Variables de entorno ---
const PINTEREST_ACCESS_TOKEN = process.env.PINTEREST_ACCESS_TOKEN;
const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID;
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET;
const REDDIT_USERNAME = process.env.REDDIT_USERNAME;
const REDDIT_PASSWORD = process.env.REDDIT_PASSWORD;

// --- NUEVO: Variables para X ---
const TWITTER_API_KEY = process.env.TWITTER_API_KEY;
const TWITTER_API_KEY_SECRET = process.env.TWITTER_API_KEY_SECRET;
const TWITTER_ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN;
const TWITTER_ACCESS_TOKEN_SECRET = process.env.TWITTER_ACCESS_TOKEN_SECRET;

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
        await axios.post('https://api-sandbox.pinterest.com/v5/pins', { // Apuntando al Sandbox por ahora
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
        console.log('   ✅ Pin publicado en Pinterest (Sandbox).');
    } catch (error) {
        console.error('   ❌ Error en Pinterest:', error.response?.data?.message || error.message);
    }
}

/**
 * Publica un post de enlace en Reddit.
 */
async function publishToReddit(title, link) {
    // ... (tu función de Reddit existente, sin cambios)
    if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET || !REDDIT_USERNAME || !REDDIT_PASSWORD) {
        console.warn('   - (Reddit) Credenciales incompletas. Saltando...');
        return;
    }
    console.log('   -> Publicando en Reddit...');
    // ... el resto de la función
}


// --- NUEVA FUNCIÓN ---
/**
 * Publica un tuit en X (Twitter).
 */
async function publishToX(title, link) {
    if (!TWITTER_API_KEY || !TWITTER_API_KEY_SECRET || !TWITTER_ACCESS_TOKEN || !TWITTER_ACCESS_TOKEN_SECRET) {
        console.warn('   - (X) Credenciales incompletas. Saltando...');
        return;
    }
    console.log('   -> Publicando en X (Twitter)...');
    try {
        const xClient = new XClient();
        const tweetText = `${title}\n\nMás información: ${link}`;
        const tweet = await xClient.post({ text: tweetText });
        console.log(`   ✅ Tuit publicado en X. Enlace: https://x.com/user/status/${tweet.id}`);
    } catch (error) {
        console.error('   ❌ Error en X:', error.message);
    }
}


/**
 * Función principal del módulo.
 */
async function distributePosts() {
    const db = await connectToDatabase();
    const eventsCollection = db.collection('events');

    const query = {
        status: 'published',
        isDistributed: { $exists: false }
    };
    const postsToDistribute = await eventsCollection.find(query).limit(config.DISTRIBUTE_BATCH_SIZE).toArray();

    if (postsToDistribute.length === 0) {
        console.log('✅ No hay posts nuevos para distribuir en redes sociales.');
        return;
    }

    console.log(`⚙️ Se encontraron ${postsToDistribute.length} posts para distribuir.`);

    for (const event of postsToDistribute) {
        console.log(`   -> Distribuyendo: "${event.blogPostTitle}"`);

        const imageUrl = event.featuredImageUrl;
        if (!imageUrl) {
            console.warn(`   ⚠️ No se encontró URL de imagen destacada para "${event.name}". No se puede publicar en Pinterest.`);
        }

        // --- Bucle de publicación actualizado ---
        if (imageUrl) await publishToPinterest(imageUrl, event.blogPostTitle, event.blogPostUrl);
        await publishToReddit(event.blogPostTitle, event.blogPostUrl);
        await publishToX(event.blogPostTitle, event.blogPostUrl); // <-- AÑADIDO

        await eventsCollection.updateOne({ _id: event._id }, { $set: { isDistributed: true } });
        console.log(`   ✅ Evento '${event.name}' marcado como distribuido.`);
    }
}

module.exports = { distributePosts };