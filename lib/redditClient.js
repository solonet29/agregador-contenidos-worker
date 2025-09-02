const { RedditApiClient } = require('@r/api-client');
const axios = require('axios');

class RedditClient {
    constructor() {
        this.clientId = process.env.REDDIT_CLIENT_ID;
        this.clientSecret = process.env.REDDIT_CLIENT_SECRET;
        this.username = process.env.REDDIT_USERNAME;
        this.password = process.env.REDDIT_PASSWORD;
        this.userAgent = process.env.REDDIT_USER_AGENT;
        this.apiClient = null;
    }

    async #getAccessToken() {
        const authUrl = 'https://www.reddit.com/api/v1/access_token';
        const authHeader = `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`;

        const params = new URLSearchParams();
        params.append('grant_type', 'password');
        params.append('username', this.username);
        params.append('password', this.password);

        try {
            const response = await axios.post(authUrl, params, {
                headers: {
                    'Authorization': authHeader,
                    'User-Agent': this.userAgent,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });
            return response.data.access_token;
        } catch (error) {
            console.error('Error al obtener el token de acceso de Reddit:', error.response?.data);
            throw new Error('Falló la autenticación con Reddit.');
        }
    }

    async #initializeClient() {
        if (!this.apiClient) {
            const accessToken = await this.#getAccessToken();
            this.apiClient = new RedditApiClient({
                userAgent: this.userAgent,
                accessToken: accessToken,
            });
        }
    }

    async submitLink({ subreddit, title, url }) {
        await this.#initializeClient();
        console.log(`Publicando en r/${subreddit}: "${title}"`);

        const response = await this.apiClient.post('/api/submit', {
            sr: subreddit,
            kind: 'link',
            title: title,
            url: url,
        });

        if (response.json.errors.length > 0) {
            throw new Error(`Error de la API de Reddit: ${response.json.errors.join(', ')}`);
        }

        return response.json.data;
    }
}

// LA CLAVE ESTÁ AQUÍ: Asegurarnos de que exportamos un objeto
module.exports = { RedditClient };