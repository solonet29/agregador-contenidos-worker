
// config.js
require('dotenv').config();
// Almacena toda la configuración del worker para mantener los scripts de lógica limpios.

const config = {
    // Configuración del proceso
    BATCH_SIZE: 10, // Número de eventos a procesar en cada ejecución

    // Configuración de WordPress
    WORDPRESS_EVENTS_CATEGORY_ID: 96, // ID de la categoría "Eventos"

    // Prompts de IA (Gemini)
    prompts: {
        verifyFlamenco: (eventData) => `
Eres un experto clasificador para una web de flamenco. Tu criterio debe ser inclusivo con artistas que fusionan el flamenco con otros géneros (como soul o jazz), pero sin llegar al pop mainstream. Si un evento o artista tiene una fuerte conexión con el flamenco, clasifícalo como "flamenco". Artistas como Pitingo, Argentina o Arcángel son de interés para el público flamenco.

Analiza la siguiente información y responde SÓLO con "flamenco" o "no-flamenco".

Nombre del evento: ${eventData.name}
Artista: ${eventData.artist}
Descripción: ${eventData.description}`,

        nightPlan: (event) => `
Eres "Duende", un conocedor local y aficionado al flamenco.
Tu tarea es generar una mini-guía para una noche perfecta centrada en un evento de flamenco.
Sé cercano, usa un lenguaje evocador y estructura el plan en secciones con Markdown (usando ## para los títulos).

**REGLA MUY IMPORTANTE: Tu respuesta debe empezar DIRECTAMENTE con el primer título en Markdown (##). No incluyas saludos, introducciones o texto conversacional antes de la guía.**

EVENTO:
- Nombre: ${event.name}
- Artista: ${event.artist}
- Lugar: ${event.venue}, ${event.city}

ESTRUCTURA DE LA GUÍA:
1.  **Un Pellizco de Sabiduría:** Aporta un dato curioso o una anécdota sobre el artista, el lugar o algún palo del flamenco relacionado.
2.  **Calentando Motores (Antes del Espectáculo):** Recomienda 1 o 2 bares de tapas o restaurantes cercanos al lugar del evento, describiendo el ambiente.
3.  **El Templo del Duende (El Espectáculo):** Describe brevemente qué se puede esperar del concierto, centrando en la emoción.
4.  **Para Alargar la Magia (Después del Espectáculo):** Sugiere un lugar cercano para tomar una última copa en un ambiente relajado.

Usa un tono inspirador y práctico.`,
    },

    // Bloques de HTML reutilizables
    htmlBlocks: {
        postIntro: (event) => `
<p>El flamenco es más que un espectáculo; es una experiencia que envuelve todos los sentidos. Si tienes la suerte de asistir a la actuación de <strong>${event.artist || event.name}</strong> en <strong>${event.venue}</strong>, te hemos preparado una guía para que tu velada sea redonda, desde las tapas previas hasta la última copa.</p>
<p>Descubre cómo vivir una noche flamenca completa en ${event.city}.</p>`,

        postFooter: (event) => `
<hr>
<h3>¿Buscas el atuendo perfecto?</h3>
<p>Visita nuestra <a href="https://afland.es/la-tienda-flamenca-afland/">Tienda Flamenca</a> para encontrar moda y accesorios únicos.</p>
<p>➡️ <strong><a href="https://buscador.afland.es/?event_id=${event._id}">Ver todos los detalles de este evento en Duende Finder</a></strong></p>`,

        ctaBanners: `
<hr>
<h2>¿Quieres ver tu negocio aquí?</h2>
<p>Destaca tu bar, restaurante, hotel o tienda ante miles de aficionados al flamenco. <a href="https://afland.es/contact/" target="_blank" rel="noopener">Contacta con nosotros</a> y descubre nuestras opciones de patrocinio.</p>
<img src="https://afland.es/wp-content/uploads/2025/08/banner-publicidad-1.jpg" alt="Publicidad para restaurantes y tablaos flamencos" style="width:100%; height:auto; margin:10px 0; border:1px solid #ddd; border-radius:4px; aspect-ratio: 16/9; object-fit: cover;">
<img src="https://afland.es/wp-content/uploads/2025/08/banner-publicidad-2.jpg" alt="Publicidad para hoteles y alojamientos con encanto" style="width:100%; height:auto; margin:10px 0; border:1px solid #ddd; border-radius:4px; aspect-ratio: 16/9; object-fit: cover;">`
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
