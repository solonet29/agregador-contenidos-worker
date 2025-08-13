// content-creator.js (v8 - Versión Definitiva con Lógica de CTA y Protección de Errores)

// 1. Módulos y dependencias
require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { publishToAflandBlog, uploadImageToWordPress } = require('./afland-publisher');
const { marked } = require('marked');

// 2. Configuración
const mongoUri = process.env.MONGO_URI;
const dbName = process.env.DB_NAME || 'DuendeDB';
const eventsCollectionName = 'events';
const aflandToken = process.env.AFLAND_API_KEY; // Corregido: lee la variable correcta
const geminiApiKey = process.env.GEMINI_API_KEY;

if (!mongoUri || !geminiApiKey || !aflandToken) {
    throw new Error('Faltan variables de entorno críticas.');
}

const genAI = new GoogleGenerativeAI(geminiApiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// ... (Las funciones de utilidad y el prompt se mantienen igual) ...

// ... (código anterior) ...

async function generateStructuredPost(event) {
    const eventDateFormatted = new Date(event.date).toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    let extraContext = '';
    if (event.nightPlan && event.nightPlan.trim() !== '') {
        console.log("    -> ✨ ¡Enriqueciendo post con datos de 'Planear Noche'!");
        extraContext = `
# INFORMACIÓN ADICIONAL PARA ENRIQUECER EL POST
Usa la siguiente guía local para añadir secciones o detalles extra al cuerpo del post. Intégralo de forma natural.
Contenido Adicional:
${event.nightPlan}
`;
    }

    // --- Lógica para la llamada a la acción (CTA) ---
    let callToAction;
    if (event.affiliateLink && event.affiliateLink.trim() !== '') {
        callToAction = `Entradas disponibles aquí: ${event.affiliateLink}`;
    } else {
        callToAction = `Entradas disponibles próximamente.`;
    }

    // --- AQUI ESTÁ EL NUEVO PROMPT INTEGRADO ---
    const prompt = `
# CONTEXTO
Eres "Duende", un experto redactor de SEO para el blog "Duende Finder" (afland.es). Tu objetivo es crear un post de blog atractivo sobre un evento de flamenco.
Tu tono es siempre apasionado, evocador y accesible. Usa emojis 💃🎶🔥 de forma natural.

# INSTRUCCIONES PARA EL POST
Crea un post para Duende Finder sobre un evento de flamenco. El post debe ser atractivo, informativo y optimizado para SEO, compensando la falta de imagen destacada con una estructura clara y un lenguaje evocador.

# DATOS DEL EVENTO
- Nombre: ${event.name}
- Artista(s): ${event.artist}
- Fecha: ${eventDateFormatted}
- Hora: ${event.time}
- Lugar: ${event.venue}, ${event.city}
- URL de la fuente/compra de entradas: ${event.affiliateLink || 'No disponible'}
- Descripción del evento: ${event.description || 'No se proporcionó una descripción del evento.'}

${extraContext}

# TAREA Y REGLAS DE FORMATO
Tu única salida debe ser texto estructurado con las siguientes secciones, separadas por "---". Cada sección debe tener su etiqueta en la primera línea.

SLUG:
[Crea un slug corto, en minúsculas, sin acentos ni caracteres especiales, optimizado para SEO (4-5 palabras clave).]
---
META_TITLE:
[Crea un título SEO de menos de 60 caracteres que sea persuasivo y atractivo. Incluye la palabra clave principal y el nombre del artista o lugar.]
---
META_DESC:
[Crea una meta descripción de menos de 155 caracteres. Incluye la palabra clave principal, un verbo de acción y una frase persuasiva.]
---
POST_TITLE:
[Crea un título H1 atractivo para el post, usando una estructura como "Concierto en [Ciudad]: [Título Atractivo]".]
---
POST_CONTENT:
[Escribe aquí el cuerpo del post en formato Markdown (300-400 palabras). El post debe seguir esta estructura:
1. **Introducción:** Un párrafo corto y vibrante (aprox. 50 palabras) que introduzca el evento, creando una atmósfera emocional.
2. **Cuerpo del Contenido (2-3 Párrafos):** Explica en detalle sobre el artista, el palo que interpretará, la atmósfera del lugar y la historia del evento. Incorpora palabras clave secundarias (LSI) de forma natural (ej. cante, toque, baile, artistas flamencos, agenda flamenca).
3. **Llamada a la Acción (CTA):** Un párrafo final o un subtítulo (H3) con el enlace de compra o el texto de "próximamente".

Incluye el enlace a "Duende Finder" de forma natural en algún punto del texto, con el texto "todos los conciertos y eventos en nuestro buscador" y el enlace a https://buscador.afland.es/.

Finaliza con la llamada a la acción para el usuario, que debe decir: "${callToAction}".]
`;
    try {
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error('❌ Error al generar contenido con Gemini:', error);
        return null;
    }
}

async function updateEventStatus(collection, eventId, status) {
    try {
        await collection.updateOne(
            { _id: new ObjectId(eventId) },
            { $set: { contentStatus: status } }
        );
        console.log(`🎉 Evento con ID: ${eventId} actualizado a estado: ${status}.`);
    } catch (error) {
        console.error(`❌ Error al actualizar el estado del evento ${eventId}:`, error);
    }
}

// 3. Función principal del script
async function runContentCreator() {
    console.log('🚀 Iniciando el creador de contenidos (v8 con lógica de CTA y protección de errores)...');
    const client = new MongoClient(mongoUri);
    try {
        await client.connect();
        console.log('✅ Conectado a MongoDB.');

        const db = client.db(dbName);
        const eventsCollection = db.collection(eventsCollectionName);

        // --- CÁLCULO DE LA FECHA LÍMITE (3 DÍAS EN EL FUTURO) ---
        const today = new Date();
        const threeDaysFromNow = new Date(today.setDate(today.getDate() + 3));
        const minDateString = threeDaysFromNow.toISOString().split('T')[0];

        console.log(`🔎 Buscando eventos pendientes con imagen a partir de: ${minDateString}`);

        // --- LA CONSULTA SÚPER INTELIGENTE CON TODOS LOS FILTROS ---
        const pendingEvents = await eventsCollection.find({
            contentStatus: 'pending',
            imageUrl: { $ne: null },
            date: { $gte: minDateString } // <-- FILTRO DE 3 DÍAS AÑADIDO
        }).sort({
            verified: -1,
            date: 1
        }).limit(5).toArray();
        // --- FIN DE LA CONSULTA ---

        if (pendingEvents.length === 0) {
            console.log('✅ No hay eventos pendientes (que cumplan todos los criterios) por procesar.');
            return;
        }

        console.log(`Encontrados ${pendingEvents.length} eventos prioritarios para procesar.`);

        let publishTime = new Date();
        const timeIncrement = 60 * 60 * 1000;

        for (const event of pendingEvents) {
            console.log(`\n✨ Procesando evento con ID: ${event._id}`);
            const structuredPost = await generateStructuredPost(event);

            if (structuredPost) {
                const parts = structuredPost.split('---');
                const slug = parts[0]?.replace('SLUG:', '').trim();
                const metaTitle = parts[1]?.replace('META_TITLE:', '').trim();
                const metaDesc = parts[2]?.replace('META_DESC:', '').trim();
                const postTitle = parts[3]?.replace('POST_TITLE:', '').trim();
                const markdownContent = parts[4]?.replace('POST_CONTENT:', '').trim();

                if (!slug || !metaTitle || !markdownContent) {
                    console.log('🔴 La IA no devolvió una respuesta estructurada válida. Actualizando a "failed".');
                    await updateEventStatus(eventsCollection, event._id, 'failed');
                    continue;
                }

                const htmlContent = marked(markdownContent);
                let featuredMediaId = null;
                if (event.imageUrl) {
                    featuredMediaId = await uploadImageToWordPress(event.imageUrl, aflandToken);
                }

                publishTime = new Date(publishTime.getTime() + timeIncrement);
                console.log(`⏳ Programando post "${postTitle}" para: ${publishTime.toLocaleString()}`);

                // ... dentro del bucle for (const event of pendingEvents)

                await publishToAflandBlog({
                    title: postTitle,
                    content: htmlContent,
                    slug: slug, // <-- CÓDIGO AÑADIDO: Pasamos el slug a WordPress
                    status: 'future',
                    date: publishTime.toISOString(),
                    meta: {
                        _aioseo_title: metaTitle,
                        _aioseo_description: metaDesc
                    }
                }, aflandToken, featuredMediaId);

                // ...

                await updateEventStatus(eventsCollection, event._id, 'processed');
            } else {
                console.log('🔴 No se pudo generar contenido para el evento. Actualizando a "failed".');
                await updateEventStatus(eventsCollection, event._id, 'failed');
            }
        }
    } catch (error) {
        console.error('❌ Ha ocurrido un error general:', error);
    } finally {
        await client.close();
        console.log('\n✅ Conexión a MongoDB cerrada.');
        console.log('✅ Proceso del creador de contenidos finalizado.');
    }
}

// 6. Ejecución del script
runContentCreator();
