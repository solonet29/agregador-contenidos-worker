// 1. Módulos y dependencias
require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const Groq = require('groq-sdk');
const { createCanvas, loadImage, registerFont } = require('canvas');
const { publishToAflandBlog, uploadImageToWordPress } = require('./afland-publisher');
const { marked } = require('marked');
const path = require('path');
const fs = require('fs');

// 2. Configuración desde variables de entorno
const mongoUri = process.env.MONGO_URI;
const groqApiKey = process.env.GROQ_API_KEY;
const aflandToken = process.env.AFLAND_API_KEY;
const dbName = 'DuendeDB';
const eventsCollectionName = 'events';

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

    const prompt = `
# CONTEXTO
Eres "Duende", un experto redactor de SEO para el blog "Duende Finder" (afland.es). Tu objetivo es crear el contenido para un post sobre un evento de flamenco.

# INSTRUCCIONES PARA EL POST
Tu única salida debe ser un objeto JSON válido, sin texto introductorio, explicaciones, ni envolturas de markdown. El objeto JSON debe contener estrictamente las siguientes propiedades: "slug", "meta_title", "meta_desc", "post_title", "post_content".

# DATOS DEL EVENTO
- Nombre: ${event.name}
- Artista(s): ${event.artist}
- Fecha: ${eventDateFormatted}
- Hora: ${event.time}
- Lugar: ${event.venue}, ${event.city}
- URL de la fuente/compra de entradas: ${event.affiliateLink || 'No disponible'}
- Descripción del evento: ${event.description || 'No se proporcionó una descripción del evento.'}

${extraContext}

# REGLAS DEL CONTENIDO
- **slug:** Crea un slug corto, en minúsculas, sin acentos ni caracteres especiales, optimizado para SEO (4-5 palabras clave).
- **meta_title:** Crea un título SEO de menos de 60 caracteres que sea persuasivo y atractivo.
- **meta_desc:** Crea una meta descripción de menos de 155 caracteres.
- **post_title:** Crea un título H1 atractivo para el post, usando una estructura como "Concierto en [Ciudad]: [Título Atractivo]".
- **post_content:** Escribe el cuerpo del post en formato Markdown (300-400 palabras). Incluye una introducción vibrante, un desarrollo detallado sobre el artista y el evento, y una llamada a la acción clara. El enlace de "Duende Finder" (https://buscador.afland.es/) debe incluirse de forma natural en el texto con el ancla "todos los conciertos y eventos en nuestro buscador".
`;

    try {
        const result = await groq.chat.completions.create({
            model: groqModel,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        });

        let content = result.choices[0].message.content;
        const cleanedContent = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        tokensUsedToday += result.usage.total_tokens;
        return cleanedContent;
    } catch (error) {
        console.error('❌ Error al generar contenido con Groq:', error);
        return null;
    }
}

async function updateEventStatus(collection, eventId, status, fieldsToSet = {}) {
    try {
        const updateDoc = { $set: { contentStatus: status, ...fieldsToSet } };
        await collection.updateOne({ _id: new ObjectId(eventId) }, updateDoc);
        console.log(`🎉 Evento con ID: ${eventId} actualizado a estado: ${status}.`);
    } catch (error) {
        console.error(`❌ Error al actualizar el estado del evento ${eventId}:`, error);
    }
}

function truncateText(context, text, maxWidth) {
    let width = context.measureText(text).width;
    const ellipsis = '...';
    const ellipsisWidth = context.measureText(ellipsis).width;
    if (width <= maxWidth) return text;
    let len = text.length;
    while (width >= maxWidth - ellipsisWidth && len-- > 0) {
        text = text.substring(0, len);
        width = context.measureText(text).width;
    }
    return text + ellipsis;
}

async function createHeaderImage(eventData) {
    try {
        const templatesDir = path.join(__dirname, 'templates');
        const generatedImagesDir = path.join(__dirname, 'generated_images');
        if (!fs.existsSync(generatedImagesDir)) fs.mkdirSync(generatedImagesDir, { recursive: true });

        const fontPath = path.join(templatesDir, 'Cinzel-Bold.ttf');
        registerFont(fontPath, { family: 'Cinzel' });

        const templates = fs.readdirSync(templatesDir).filter(file => file.endsWith('.png'));
        const randomTemplateFile = templates[Math.floor(Math.random() * templates.length)];
        const templatePath = path.join(templatesDir, randomTemplateFile);
        const background = await loadImage(templatePath);

        const canvas = createCanvas(background.width, background.height);
        const ctx = canvas.getContext('2d');

        const purpleBarWidth = 290, titleVerticalOffset = -30, detailsPaddingBottom = 120, horizontalPadding = 100;

        ctx.fillStyle = '#2c2c2c';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(background, 0, 0, background.width, background.height);

        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';

        ctx.font = '60px Cinzel';
        const centerX = purpleBarWidth + (canvas.width - purpleBarWidth) / 2;
        const maxWidth = canvas.width - purpleBarWidth - (horizontalPadding * 2);

        const titleText = truncateText(ctx, eventData.name.toUpperCase(), maxWidth);
        ctx.fillText(titleText, centerX, (canvas.height / 2) + titleVerticalOffset);

        const dateText = new Date(eventData.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
        const locationText = `${eventData.venue}, ${eventData.city}`;
        const detailsText = `${dateText} | ${locationText}`;

        ctx.font = '40px Cinzel';
        ctx.fillText(detailsText, centerX, canvas.height - detailsPaddingBottom);

        const outputFilename = `header-${eventData._id}.png`;
        const outputPath = path.join(generatedImagesDir, outputFilename);
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(outputPath, buffer);

        console.log(`✅ Imagen de cabecera creada con Canvas en: ${outputPath}`);
        return outputPath;
    } catch (error) {
        console.error("🔴 Error al crear la imagen de cabecera con Canvas:", error);
        return null;
    }
}

// 4. Función principal del script
async function runContentCreator() {
    console.log('🚀 Iniciando creador de contenidos por lotes...');
    const BATCH_SIZE = 3;
    const client = new MongoClient(mongoUri);

    try {
        await client.connect();
        console.log('✅ Conectado a MongoDB.');

        const db = client.db(dbName);
        const eventsCollection = db.collection(eventsCollectionName);

        const today = new Date();
        const twoDaysFromNow = new Date(new Date().setDate(today.getDate() + 2));
        const minDateString = twoDaysFromNow.toISOString().split('T')[0];

        const eventsToProcess = await eventsCollection.find({
            contentStatus: 'pending', imageUrl: { $ne: null }, date: { $gte: minDateString }
        }).sort({ verified: -1, date: 1 }).limit(BATCH_SIZE).toArray();

        if (eventsToProcess.length === 0) {
            console.log('✅ No hay eventos pendientes que cumplan los criterios en este lote.');
            return;
        }

        console.log(`📦 Lote de ${eventsToProcess.length} eventos encontrado. Empezando procesamiento...`);

        for (const event of eventsToProcess) {
            await updateEventStatus(eventsCollection, event._id, 'processing');
            console.log(`\n✨ Procesando evento con ID: ${event._id}`);

            const headerImagePath = await createHeaderImage(event);
            if (!headerImagePath) {
                console.log('🔴 No se pudo crear la imagen. Revertiendo para reintentar.');
                await updateEventStatus(eventsCollection, event._id, 'pending');
                continue;
            }

            const structuredPost = await generateStructuredPost(event);
            if (!structuredPost) {
                console.log('🔴 No se pudo generar contenido. Revertiendo para reintentar.');
                await updateEventStatus(eventsCollection, event._id, 'pending');
                continue;
            }

            let parsedPost;
            try {
                parsedPost = JSON.parse(structuredPost);
            } catch (jsonError) {
                console.error('🔴 Error al parsear JSON. Marcando como fallido.', jsonError);
                await updateEventStatus(eventsCollection, event._id, 'failed');
                continue;
            }

            const { slug, meta_title, meta_desc, post_title, post_content } = parsedPost;
            if (!slug || !post_title || !post_content) {
                console.log('🔴 JSON incompleto. Marcando como fallido.');
                await updateEventStatus(eventsCollection, event._id, 'failed');
                continue;
            }

            const htmlContent = marked(post_content);

            // --> INICIO: LÓGICA COMBINADA DE URL Y SEO
            const eventDateForSeo = new Date(event.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
            const imageAltText = `Cartel del evento de ${event.artist} en ${event.venue}, ${event.city} el ${eventDateForSeo}`;
            const imageTitle = `${event.artist} en ${event.city} - ${event.name}`;

            const featuredMediaId = await uploadImageToWordPress(headerImagePath, aflandToken, imageAltText, imageTitle);

            if (!featuredMediaId) {
                console.log('🔴 No se pudo subir la imagen. Revertiendo para reintentar.');
                await updateEventStatus(eventsCollection, event._id, 'pending');
                continue;
            }

            console.log(`⏳ Publicando post "${post_title}"...`);

            const publishResult = await publishToAflandBlog({
                title: post_title,
                content: htmlContent,
                slug: slug,
                status: 'publish',
                meta: { _aioseo_title: meta_title, _aioseo_description: meta_desc }
            }, aflandToken, featuredMediaId);

            let finalFieldsToSet = {};
            if (publishResult && publishResult.finalImageUrl) {
                finalFieldsToSet.headerImageUrl = publishResult.finalImageUrl;
                console.log(`   -> ✅ URL de la imagen guardada en MongoDB.`);
            }

            await updateEventStatus(eventsCollection, event._id, 'processed', finalFieldsToSet);
            // --> FIN: LÓGICA COMBINADA DE URL Y SEO
        }

    } catch (error) {
        console.error('❌ Ha ocurrido un error general:', error);
    } finally {
        if (client) {
            await client.close();
            console.log('\n✅ Conexión a MongoDB cerrada.');
        }
        console.log('✅ Proceso del creador de contenidos finalizado.');
    }
}

// 5. Ejecución del script
runContentCreator();