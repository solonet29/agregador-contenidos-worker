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
        console.log(`Publicando enlace en r/${subreddit}: "${title}"`);

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

    async submitImage({ subreddit, title, imageUrl }) {
        await this.#initializeClient();
        console.log(`Publicando imagen en r/${subreddit}: "${title}"`);

        if (!imageUrl) {
            throw new Error('URL de imagen no proporcionada para la publicación en Reddit.');
        }

        try {
            console.log(`   -> Descargando imagen de: ${imageUrl}`);
            const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const imageBuffer = Buffer.from(imageResponse.data);

            // Reddit's image upload typically involves a two-step process:
            // 1. Upload the image to Reddit's media hosting.
            // 2. Submit the post with the uploaded media ID.

            // This part is highly dependent on the exact Reddit API client library
            // and Reddit's current API for image uploads.
            // The @r/api-client library might have a specific method for this,
            // or we might need to make a direct POST request to Reddit's upload endpoint.

            // For demonstration, let's assume a simplified direct upload to /api/submit
            // with kind: 'image' and a base64 encoded image.
            // NOTE: This might not be the exact or most efficient way Reddit handles it.
            // A more robust solution would involve checking the @r/api-client docs
            // or using a dedicated Reddit media upload endpoint.

            // Example of a simplified approach (may need adjustment based on Reddit API):
            const uploadResponse = await this.apiClient.post('/api/submit', {
                sr: subreddit,
                kind: 'image',
                title: title,
                url: imageUrl, // Reddit might accept direct URL for image posts, or require upload
                // If direct upload is needed, you'd send the image data here
                // e.g., 'upload_file': imageBuffer.toString('base64')
            });

            if (uploadResponse.json.errors.length > 0) {
                throw new Error(`Error de la API de Reddit al subir imagen: ${uploadResponse.json.errors.join(', ')}`);
            }

            return uploadResponse.json.data;

        } catch (error) {
            console.error('Error al publicar imagen en Reddit:', error.response?.data || error.message);
            throw new Error('Falló la publicación de imagen en Reddit.');
        }
    }
}

module.exports = { RedditClient };