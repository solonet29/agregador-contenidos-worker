// config.js
require('dotenv').config();
// Almacena toda la configuración del worker para mantener los scripts de lógica limpios.

const config = {
    // --- NUEVO: Configuración de Lotes Independientes ---
    // Lote para el PUBLICADOR (Paso 2): Cuántos posts crear en WordPress por ejecución.
    PUBLISH_BATCH_SIZE: 4,
    // Lote para el DISTRIBUIDOR (Paso 3): Cuántos posts enviar a redes sociales por ejecución.
    DISTRIBUTE_BATCH_SIZE: 4,


    // Configuración de WordPress
    WORDPRESS_EVENTS_CATEGORY_ID: 96, // ID de la categoría "Eventos"

    // Prompts de IA (Gemini)
    prompts: {
        // ... (tu prompt de verifyFlamenco sin cambios)
        verifyFlamenco: (eventData) => `...`,
        // ... (tu prompt de nightPlan sin cambios)
        nightPlan: (event) => `...`,
    },

    // Bloques de HTML reutilizables
    htmlBlocks: {
        // ... (tu bloque postIntro sin cambios)
        postIntro: (event) => `...`,
        // ... (tu bloque postFooter sin cambios)
        postFooter: (event) => `...`,
        // ... (tu bloque ctaBanners sin cambios)
        ctaBanners: `...`
    },

    // Configuración de Redes Sociales
    socialMedia: {
        x: {
            appKey: process.env.TWITTER_API_KEY,
            appSecret: process.env.TWITTER_API_KEY_SECRET,
            accessToken: process.env.TWITTER_ACCESS_TOKEN,
            accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
        },
        pinterest: {
            accessToken: process.env.PINTEREST_ACCESS_TOKEN,
            boardId: process.env.PINTEREST_BOARD_ID || "default-board-id",
        },
        reddit: {
            clientId: process.env.REDDIT_CLIENT_ID,
            clientSecret: process.env.REDDIT_CLIENT_SECRET,
            username: process.env.REDDIT_USERNAME,
            password: process.env.REDDIT_PASSWORD,
            subreddits: ['flamenco', 'spain', 'andalucia', 'Flamenco']
        }
    }
};

module.exports = config;