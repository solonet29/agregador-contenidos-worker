// 1. Módulos y dependencias
require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const Groq = require('groq-sdk');
const { createCanvas, loadImage, registerFont } = require('canvas');
const { publishToAflandBlog, uploadImageToWordPress } = require('./afland-publisher');
const { marked } = require('marked');
const path = require('path');
const fs = require('fs');
// --- POOL DE ENLACES INTERNOS PARA SEO ---
const INTERNAL_LINKS = [
    { url: 'https://afland.es/', anchor: 'nuestra página principal sobre flamenco' },
    { url: 'https://afland.es/noticias/', anchor: 'noticias de flamenco' },
    { url: 'https://afland.es/viajes-y-rutas/', anchor: 'viajes flamencos' },
];
// --- FIN DEL POOL ---
// 2. Configuración desde variables de entorno
const mongoUri = process.env.MONGO_URI;
const groqApiKey = process.env.GROQ_API_KEY;
const aflandToken = process.env.AFLAND_API_KEY;
const dbName = 'DuendeDB';
const eventsCollectionName = 'events';
const tiendaUrl = process.env.WORDPRESS_STORE_URL || 'https://afland.es/la-tienda-flamenca-afland/';

const dailyTokenLimit = parseInt(process.env.DAILY_TOKEN_LIMIT) || 500000;
const groqModel = process.env.GROQ_MODEL || 'llama3-8b-8192';

if (!mongoUri || !groqApiKey || !aflandToken) {
    throw new Error('Faltan variables de entorno críticas. Revisa tus secretos de GitHub Actions.');
}

const groq = new Groq({ apiKey: groqApiKey });
let tokensUsedToday = 0;

// 3. Funciones de utilidad

async function generateStructuredPost(event) {
    const eventDateFormatted = new Date(event.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    let extraContext = '';
    if (event.nightPlan && event.nightPlan.trim() !== '') {
        extraContext = `# INFORMACIÓN ADICIONAL PARA ENRIQUECER EL POST\nUsa la siguiente guía local...\nContenido Adicional:\n${event.nightPlan}`;
    }

    // Dentro de la función generateStructuredPost, reemplaza el prompt antiguo por este:

    // En content-creator.js, dentro de generateStructuredPost

    const prompt = `
# CONTEXTO
Eres "Duende", un experto redactor de SEO para el blog "Duende Finder" (afland.es). Tu objetivo es crear un post de blog atractivo, bien estructurado y optimizado para SEO sobre un evento de flamenco, siendo preciso y adaptándote a la información disponible del artista.

# INSTRUCCIONES GENERALES
Tu única salida debe ser un objeto JSON válido. No incluyas explicaciones ni envolturas de markdown. El objeto JSON debe contener las propiedades: "slug", "meta_title", "meta_desc", "post_title", "post_content".

# DATOS DEL EVENTO
- Nombre: ${event.name}
- Artista(s): ${event.artist.name}
- Disciplina: ${event.artist.discipline || 'Artista de Flamenco'} 
- Fecha: ${eventDateFormatted}
- Hora: ${event.time}
- Lugar: ${event.venue}, ${event.city}
- URL de la fuente/compra de entradas: ${event.affiliateLink || 'No disponible'}
- Descripción del evento: ${event.description || 'No se proporcionó una descripción del evento.'}

${extraContext}

# REGLAS DE SEO
A lo largo de todo el "post_content", integra de forma natural y variada algunas de las siguientes palabras clave:
- "concierto de flamenco en ${event.city}"
- "entradas para ${event.artist.name}"
- "espectáculo flamenco"
- "duende flamenco"
- "arte flamenco"

# REGLAS DEL CONTENIDO Y LA ESTRUCTURA

- **slug, meta_title, meta_desc, post_title:** Sigue las mismas reglas que antes para estos campos.

- **post_content:** Escribe el cuerpo del post en formato **Markdown** (300-400 palabras), usando negritas y párrafos separados. **IMPORTANTE: Escapa todas las comillas dobles (") con una barra invertida (\") dentro del campo post_content para asegurar que el JSON sea válido.** DEBES seguir estrictamente la siguiente estructura:

\
### ¡Una Cita con el Duende!
* **Cuándo:** ${eventDateFormatted} a las ${event.time}
* **Dónde:** ${event.venue}, ${event.city}

## ${event.name}: Una Noche de Flamenco Inolvidable

[Párrafo 1: Escribe aquí una introducción vibrante sobre el evento. Atrapa al lector y usa emojis como 💃🔥🎶.]

## Sobre el Artista: ${event.artist.name}

[Párrafo 2: Habla sobre ${event.artist.name}. **IMPORTANTE: Si el campo 'Disciplina' contiene un valor específico (como 'Cantaor', 'Guitarrista', 'Bailaor'), céntrate en describir su arte en esa disciplina concreta. Si el campo 'Disciplina' es el genérico 'Artista de Flamenco', entonces describe su talento de forma más general y evocadora, usando términos como 'duende flamenco', 'flamencura', 'pellizco' o 'arte', sin especificar si canta, baila o toca.**]

## El Escenario: Un Lugar con Embrujo

[Párrafo 3: Describe aquí el lugar del evento (${event.venue}). Habla de su ambiente y por qué es un sitio especial para vivir el flamenco.]

## Entradas y Más Información

[Párrafo 4: Escribe aquí la llamada a la acción final. Anima al lector a comprar las entradas o a buscar más eventos en "nuestro buscador de Duende Finder" con el enlace https://buscador.afland.es/.]

# Instrucciones Adicionales para el Contenido:
Considera el tema del evento (música, baile, instrumentos, etc.). Si es relevante, añade un párrafo final con una llamada a la acción (CTA) para invitar a los lectores a la tienda. Utiliza el marcador [LINK_TIENDA] en lugar de la URL real, mi script se encargará de reemplazarlo.
Ejemplo: 'Si buscas guitarras o vestidos de flamenco, visita nuestra tienda en [LINK_TIENDA]'.
\

