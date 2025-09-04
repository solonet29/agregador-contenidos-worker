const { TwitterApi } = require('twitter-api-v2');
const axios = require('axios'); // Import axios

/**
 * Cliente para interactuar con la API de X (Twitter) v2.
 * Se encarga de la autenticación y la publicación de tuits.
 */
class XClient {
    constructor() {
        // Carga las 4 claves necesarias desde el archivo .env
        this.apiKey = process.env.TWITTER_API_KEY;
        this.apiSecret = process.env.TWITTER_API_KEY_SECRET;
        this.accessToken = process.env.TWITTER_ACCESS_TOKEN;
        this.accessSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

        // Valida que todas las credenciales estén presentes
        if (!this.apiKey || !this.apiSecret || !this.accessToken || !this.accessSecret) {
            throw new Error('Faltan credenciales de la API de X en el archivo .env. Asegúrate de tener las 4 claves.');
        }

        // Inicializa el cliente de la API con las credenciales
        const client = new TwitterApi({
            appKey: this.apiKey,
            appSecret: this.apiSecret,
            accessToken: this.accessToken,
            accessSecret: this.accessSecret,
        });

        // Obtenemos una instancia del cliente con permisos de lectura y escritura
        // También necesitamos acceso a la API v1 para la subida de medios
        this.client = client.v2.readWrite;
        this.v1Client = client.v1; // Access to v1 client for media upload
    }

    /**
     * Publica un nuevo tuit.
     * @param {{text: string, imageUrl?: string}} tweetContent - El contenido del tuit y opcionalmente la URL de una imagen.
     * @returns {Promise<object>} La respuesta de la API con los datos del tuit creado.
     */
    async post({ text, imageUrl }) {
        if (!text) {
            throw new Error('El texto del tuit no puede estar vacío.');
        }

        let mediaId = null;
        if (imageUrl) {
            try {
                console.log(`   -> Descargando imagen de: ${imageUrl}`);
                const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                const imageBuffer = Buffer.from(imageResponse.data);

                console.log('   -> Subiendo imagen a X...');
                // Upload media to Twitter (v1.1 API)
                const mediaUploadResult = await this.v1Client.uploadMedia(imageBuffer, {
                    mimeType: imageResponse.headers['content-type'],
                });
                mediaId = mediaUploadResult.media_id_string;
                console.log(`   ✅ Imagen subida a X. Media ID: ${mediaId}`);
            } catch (imageError) {
                console.error('   ❌ Error al descargar o subir la imagen a X:', imageError.message);
                // Decide if you want to throw or continue without image
                // For now, we'll log and continue without the image
                mediaId = null;
            }
        }

        try {
            console.log(`Publicando en X: "${text.substring(0, 60)}..."`);
            const tweetOptions = {
                text: text,
            };

            if (mediaId) {
                tweetOptions.media = { media_ids: [mediaId] };
            }

            // Llama al método para publicar un tuit de la librería
            const { data: createdTweet } = await this.client.tweet(tweetOptions);
            return createdTweet; // La respuesta contiene { id, text }
        } catch (error) {
            console.error('Error detallado al publicar el tuit en X:', error);
            throw new Error('Falló la publicación en X.');
        }
    }
}

module.exports = { XClient };