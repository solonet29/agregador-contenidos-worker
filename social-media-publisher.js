// social-media-publisher.js
const { TwitterApi } = require('twitter-api-v2');
const config = require('./config');
const redditClient = require('../lib/redditClient');
const pinterestClient = require('../lib/pinterestClient');

/**
 * Publica un post en X (Twitter).
 * @param {string} text - El texto del post a publicar.
 */
async function publishToX(text) {
    const { appKey, appSecret, accessToken, accessSecret } = config.socialMedia.x;

    if (!appKey || !appSecret || !accessToken || !accessSecret) {
        console.error('Missing Twitter credentials. Check your .env file.');
        return;
    }

    try {
        const client = new TwitterApi({ appKey, appSecret, accessToken, accessSecret });
        const { data: createdTweet } = await client.v2.tweet(text);
        console.log('Tweet publicado con éxito:', createdTweet.id);
    } catch (error) {
        console.error('Error al publicar en X:', error);
    }
}

/**
 * Publica en todos los subreddits configurados.
 * @param {string} title - Título del post.
 * @param {string} url - URL del enlace a compartir.
 */
async function publishToReddit(title, url) {
    const { subreddits } = config.socialMedia.reddit;
    if (!subreddits || subreddits.length === 0) {
        console.error('No subreddits configured for Reddit.');
        return;
    }

    for (const subreddit of subreddits) {
        try {
            await redditClient.submitLink(subreddit, title, url);
        } catch (error) {
            // El error ya se loguea en el cliente
        }
    }
}

/**
 * Publica un Pin en Pinterest.
 * @param {string} title - Título del Pin.
 * @param {string} url - URL de destino.
 * @param {string} imageUrl - URL de la imagen.
 */
async function publishToPinterest(title, url, imageUrl) {
    const { boardId } = config.socialMedia.pinterest;
    if (!boardId) {
        console.error('Pinterest boardId not configured.');
        return;
    }
    try {
        await pinterestClient.createPin(boardId, title, imageUrl, url);
    } catch (error) {
        // El error ya se loguea en el cliente
    }
}


/**
 * Módulo para publicar un post en redes sociales.
 * @param {string} platform - La plataforma (ej. "x", "reddit", "pinterest").
 * @param {object} options - Opciones de publicación.
 * @param {string} options.text - Texto para X.
 * @param {string} options.title - Título para Reddit/Pinterest.
 * @param {string} options.url - URL para Reddit/Pinterest.
 * @param {string} options.imageUrl - URL de la imagen para Pinterest.
 */
async function publishToSocialMedia(platform, options = {}) {
    const { text, title, url, imageUrl } = options;

    switch (platform) {
        case 'x':
            if (!text) {
                console.error('Text is required for publishing to X.');
                return;
            }
            await publishToX(text);
            break;

        case 'reddit':
            if (!title || !url) {
                console.error('Title and URL are required for publishing to Reddit.');
                return;
            }
            await publishToReddit(title, url);
            break;

        case 'pinterest':
            if (!title || !url || !imageUrl) {
                console.error('Title, URL, and imageUrl are required for publishing to Pinterest.');
                return;
            }
            await publishToPinterest(title, url, imageUrl);
            break;

        default:
            console.log(`🔗 Plataforma '${platform}' no soportada o simulando:`);
            console.log('-------------------------------------------');
            console.log(options);
            console.log('-------------------------------------------');
            break;
    }
}

module.exports = { publishToSocialMedia };
