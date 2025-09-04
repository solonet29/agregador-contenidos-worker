// config.js
require('dotenv').config();
// Almacena toda la configuración del worker para mantener los scripts de lógica limpios.

const config = {
    // --- NUEVO: Configuración de Lotes Independientes ---
    // Lote para el ENRIQUECEDOR (Paso 1): Cuántos eventos procesar para añadir texto/imagen.
    ENRICH_BATCH_SIZE: 5,
    // Lote para el PUBLICADOR (Paso 2): Cuántos posts crear en WordPress por ejecución.
    PUBLISH_BATCH_SIZE: 4,
    // Lote para el DISTRIBUIDOR (Paso 3): Cuántos posts enviar a redes sociales por ejecución.
    DISTRIBUTE_BATCH_SIZE: 4,


    // Configuración de WordPress
    WORDPRESS_EVENTS_CATEGORY_ID: 96, // ID de la categoría "Eventos"
    WORDPRESS_CIRCUIT_CATEGORY_ID: 101, // ID de la categoría para Circuitos/Peñas Flamencas

    // Prompts de IA (Gemini)
    prompts: {
        // ... (tu prompt de verifyFlamenco sin cambios)
        verifyFlamenco: (eventData) => `...`,
        nightPlan: (event) => `
Eres un asistente de creación de contenido para un blog de flamenco.
Tu tarea es generar un "plan de noche" para un evento de flamenco.
El plan debe estar en formato Markdown y seguir esta estructura:

## Plan de Noche para ${event.name}

### Antes del Espectáculo: Cena y Tapas
* **Opción 1: [Nombre del Restaurante 1]** - Breve descripción y por qué es una buena opción (cercanía, tipo de comida, etc.).
* **Opción 2: [Nombre del Restaurante 2]** - Breve descripción.

### El Evento Principal: ${event.name}
* **Lugar:** ${event.venue.name}, ${event.venue.address}, ${event.city}
* **Hora:** ${event.time}
* **Descripción:** Describe la atmósfera y qué esperar del espectáculo. Menciona a los artistas si se conocen.

### Después del Espectáculo: Copas y Charla
* **Opción 1: [Nombre del Bar 1]** - Breve descripción y por qué es ideal para después del evento.
* **Opción 2: [Nombre del Bar 2]** - Breve descripción.

Genera un plan de noche creativo y útil para alguien que asiste al evento.
Utiliza la información del evento proporcionada:
- Nombre: ${event.name}
- Ciudad: ${event.city}
- Lugar: ${event.venue.name}
- Dirección: ${event.venue.address}
- Hora: ${event.time}
- Artistas: ${event.artists ? event.artists.join(', ') : 'No especificados'}

Asegúrate de que la respuesta contenga los encabezados Markdown (## y ###).
`,
        circuitPostPrompt: (province, events) => `
Eres un asistente de creación de contenido para un blog de flamenco.
Tu tarea es generar un post completo para WordPress sobre el "Circuito Andaluz de Peñas" en la provincia de ${province}.
El post debe ser atractivo, informativo y destacar cada evento.

El post debe tener la siguiente estructura en Markdown:

# Circuito Andaluz de Peñas en ${province}: ¡No te lo pierdas!

[Introducción general sobre el circuito en la provincia, destacando la riqueza cultural y la oportunidad de disfrutar del flamenco.]

## Eventos Destacados en ${province}:

${events.map(event => `
### ${event.name}
*   **Fecha:** ${event.date}
*   **Hora:** ${event.time}
*   **Lugar:** ${event.venue.name}, ${event.venue.address}, ${event.city}
*   **Artistas:** ${event.artists ? event.artists.join(', ') : 'No especificados'}
*   **Descripción:** [Genera una breve descripción atractiva del evento, destacando lo más relevante y por qué es imperdible.]
`).join('\n')}

[Conclusión general, invitando a los lectores a asistir y disfrutar del flamenco en la provincia.]

Considera los siguientes eventos para la provincia de ${province}:
${events.map(event => `- Nombre: ${event.name}, Fecha: ${event.date}, Hora: ${event.time}, Lugar: ${event.venue.name}, Ciudad: ${event.city}, Artistas: ${event.artists ? event.artists.join(', ') : 'No especificados'}`).join('\n')}

Asegúrate de que la respuesta contenga los encabezados Markdown (#, ##, ###) y que la descripción de cada evento sea única y atractiva.
`
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
            subreddits: ['flamenco', 'spain', 'andalucia', 'Flamenco'],
            redditSubreddit: 'flamenco' // Default subreddit for posting
        }
    }
};

module.exports = config;