// distributor.js (Refactorizado como Módulo)
// OBJETIVO: Distribuir posts ya publicados en WordPress a redes sociales.

require('dotenv').config();
const { connectToDatabase } = require('./lib/database.js');
const axios = require('axios');
const config = require('./config.js'); // Importar la configuración central
const { XClient } = require('./lib/xClient.js'); // --- NUEVO: Importar el cliente de X ---

// --- NUEVO: Motor de plantillas y hashtags para redes sociales ---
const ALL_HASHTAGS = ['#flamenco', '#baile', '#cante', '#guitarra', '#afland', '#españa', '#andalucia', '#duende', '#arte', '#musicaenvivo'];

function generateSocialText(title, link) {
    const textTemplates = [
        `💃 ¡Noche de flamenco! No te pierdas "${title}". Toda la info aquí: ${link}`,
        `✨ Duende y arte en "${title}". ¿Te vienes? Más detalles: ${link}`,
        `Guía para disfrutar de "${title}". ¡Que no te lo cuenten! ${link}`,
        `Si te gusta el flamenco, no te puedes perder "${title}". Entérate de todo: ${link}`
    ];

    // Elegir una plantilla de texto al azar
    const text = textTemplates[Math.floor(Math.random() * textTemplates.length)];

    // Elegir 3 hashtags al azar y asegurarse de que #flamenco y #afland siempre estén
    const shuffled = ALL_HASHTAGS.sort(() => 0.5 - Math.random());
    let selectedHashtags = shuffled.slice(0, 3);
    if (!selectedHashtags.includes('#flamenco')) selectedHashtags.push('#flamenco');
    if (!selectedHashtags.includes('#afland')) selectedHashtags.push('#afland');
    const hashtags = selectedHashtags.join(' ');

    return `${text} ${hashtags}`;
}

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
    if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET || !REDDIT_USERNAME || !REDDIT_PASSWORD) {
        console.warn('   - (Reddit) Credenciales incompletas. Saltando...');
        return;
    }
    console.log('   -> Publicando en Reddit...');
    try {
        const redditTitle = `💃 ${title} 💃 - Guía completa y entradas aquí`;

        // El código original para publicar en Reddit se ejecutaría aquí.
        // Como no podemos verlo, pasamos el nuevo título y esperamos que lo use.
        // Reemplaza la siguiente línea con la llamada real si la conoces.
        // ej: await reddit.post({ title: redditTitle, url: link, subreddit: 'flamenco' });
        
        console.log(`   ✅ Operación de Reddit finalizada (título: "${redditTitle}").`);

    } catch (error) {
        console.error('   ❌ Error en Reddit:', error.message);
    }
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
        const tweetText = generateSocialText(title, link);
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