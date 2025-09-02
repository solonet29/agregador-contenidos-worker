const axios = require('axios');
const { RedditAPIClient, models } = require('@r/api-client');
const config = require('../config');

let apiClient = null;
let tokenInfo = {
    accessToken: null,
    expiresAt: null,
};

/**
 * Obtiene un token de autenticación de Reddit usando las credenciales de script.
 * Refresca el token si ha expirado.
 */
async function getAuthToken() {
    if (tokenInfo.accessToken && tokenInfo.expiresAt > Date.now()) {
        return tokenInfo.accessToken;
    }

    const { clientId, clientSecret, username, password } = config.socialMedia.reddit;
    if (!clientId || !clientSecret || !username || !password) {
        throw new Error('Missing Reddit script credentials in config.');
    }

    const authUrl = 'https://www.reddit.com/api/v1/access_token';
    const authHeader = 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('username', username);
    params.append('password', password);

    try {
        const response = await axios.post(authUrl, params, {
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'DuendeFinder-Worker/1.0'
            },
        });

        const { access_token, expires_in } = response.data;
        tokenInfo.accessToken = access_token;
        // Restar 60 segundos para tener un margen de seguridad
        tokenInfo.expiresAt = Date.now() + (expires_in - 60) * 1000;

        console.log('Successfully obtained new Reddit API token.');
        return tokenInfo.accessToken;

    } catch (error) {
        console.error('Error getting Reddit auth token:', error.response ? error.response.data : error.message);
        throw new Error('Could not authenticate with Reddit API.');
    }
}

/**
 * Inicializa y devuelve el cliente de la API de Reddit.
 */
async function getRedditClient() {
    if (apiClient) {
        return apiClient;
    }
    const token = await getAuthToken();
    apiClient = new RedditAPIClient({ token });
    return apiClient;
}

/**
 * Publica un post con un enlace en un subreddit.
 * @param {string} subredditName - El nombre del subreddit.
 * @param {string} title - El título del post.
 * @param {string} url - El enlace a publicar.
 */
async function submitLink(subredditName, title, url) {
    try {
        const client = await getRedditClient();
        const post = new models.LinkPost({
            title: title,
            url: url,
            subreddit: subredditName,
        });
        await client.submit(post);
        console.log(`Enlace publicado en r/${subredditName}: ${title}`);
    } catch (error) {
        console.error(`Error al publicar enlace en r/${subredditName}:`, error);
        throw error;
    }
}

module.exports = {
    submitLink
};