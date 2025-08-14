// content-creator.js (v13 - Versión final con generación de imágenes)

// 1. Módulos y dependencias
require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const Groq = require('groq-sdk');
const { publishToAflandBlog, uploadImageToWordPress } = require('./afland-publisher');
const { marked } = require('marked');

// --- NUEVOS MÓDULOS PARA GENERACIÓN DE IMÁGENES ---
const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');
// --- FIN NUEVOS MÓDULOS ---

// 2. Configuración
const mongoUri = process.env.MONGO_URI;
const dbName = process.env.DB_NAME || 'DuendeDB';
const eventsCollectionName = 'events';
const aflandToken = process.env.AFLAND_API_KEY;
const groqApiKey = process.env.GROQ_API_KEY;

// Variables de entorno para la cuota y el modelo de Groq
const dailyTokenLimit = parseInt(process.env.DAILY_TOKEN_LIMIT) || 500000;
const groqModel = process.env.GROQ_MODEL || 'llama3-8b-8192';

if (!mongoUri || !groqApiKey || !aflandToken) {
    throw new Error('Faltan variables de entorno críticas (MONGO_URI, GROQ_API_KEY, AFLAND_API_KEY).');
}

const groq = new Groq({ apiKey: groqApiKey });
let tokensUsedToday = 0; // Inicializamos el contador de tokens diarios

// 3. Funciones de utilidad (actualizadas para Groq)
async function generateStructuredPost(event) {
    const eventDateFormatted = new Date(event.date).toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    let extraContext = '';
    if (event.nightPlan && event.nightPlan.trim() !== '') {
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

    // --- PROMPT OPTIMIZADO PARA JSON ---
    const prompt = `
# CONTEXTO
Eres "Duende", un experto redactor de SEO para el blog "Duende Finder" (afland.es). Tu objetivo es crear un post de blog atractivo sobre un evento de flamenco.
Tu tono es siempre apasionado, evocador y accesible. Usa emojis 💃🎶🔥 de forma natural.
Crea el contenido en español.

# INSTRUCCIONES PARA EL POST
Genera un objeto JSON con las siguientes propiedades: slug, meta_title, meta_desc, post_title, post_content.

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

    // ESTIMACIÓN DE TOKENS PARA CONTROL DE CUOTA
    const estimatedTokens = prompt.length / 4; // Estimación simple (aprox. 4 caracteres por token)
    if (tokensUsedToday + estimatedTokens > dailyTokenLimit) {
        console.log("⚠️ Límite de tokens diarios alcanzado. Terminando la ejecución.");
        return null;
    }

    try {
        const result = await groq.chat.completions.create({
            model: groqModel,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" } // Indicamos a Groq que esperamos un JSON
        });
        const content = result.choices[0].message.content;

        // Actualizamos el contador de tokens usados
        tokensUsedToday += result.usage.total_tokens;

        return content;
    } catch (error) {
        console.error('❌ Error al generar contenido con Groq:', error);
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

// --- NUEVA FUNCIÓN PARA CREAR IMAGEN DE CABECERA CON JIMPA ---
async function createHeaderImage(eventData) {
    try {
        const generatedImagesDir = path.join(__dirname, 'generated_images');
        if (!fs.existsSync(generatedImagesDir)) {
            fs.mkdirSync(generatedImagesDir);
        }

        const templatesDir = path.join(__dirname, 'templates');

        const templates = fs.readdirSync(templatesDir).filter(file => file.endsWith('.png'));
        if (templates.length === 0) {
            console.error('No se encontraron archivos .png en la carpeta de plantillas.');
            return null;
        }
        const randomTemplateFile = templates[Math.floor(Math.random() * templates.length)];
        const templatePath = path.join(templatesDir, randomTemplateFile);

        const fontTitle = await Jimp.loadFont(path.join(__dirname, 'templates', 'Cinzel-Bold.ttf'));
        const fontDetails = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);

        const image = await Jimp.read(templatePath);
        const imageWidth = image.getWidth();
        const imageHeight = image.getHeight();

        const titleText = eventData.name;
        const dateText = `Fecha: ${eventData.date}`;
        const timeText = `Hora: ${eventData.time}`;
        const locationText = `Lugar: ${eventData.venue}, ${eventData.city}`;

        image.print(fontTitle, 0, 0, {
            text: titleText,
            alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
            alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
        }, imageWidth, imageHeight);

        image.print(fontDetails, imageWidth / 2, imageHeight * 0.7, {
            text: dateText,
            alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
        }, imageWidth / 2, 50);

        image.print(fontDetails, imageWidth / 2, imageHeight * 0.7 + 25, {
            text: timeText,
            alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
        }, imageWidth / 2, 50);

        image.print(fontDetails, imageWidth / 2, imageHeight * 0.8, {
            text: locationText,
            alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
        }, imageWidth / 2, 50);

        const outputFilename = `header-${eventData._id}.png`;
        const outputPath = path.join(generatedImagesDir, outputFilename);

        await image.writeAsync(outputPath);

        console.log(`Imagen de cabecera creada en: ${outputPath}`);
        return outputPath;

    } catch (error) {
        console.error("Error al crear la imagen de cabecera:", error);
        return null;
    }
}
// --- FIN NUEVA FUNCIÓN ---

// 4. Función principal del script
async function runContentCreator() {
    console.log('🚀 Iniciando creador de contenidos con Groq y control de cuota.');
    const client = new MongoClient(mongoUri);
    try {
        await client.connect();
        console.log('✅ Conectado a MongoDB.');

        const db = client.db(dbName);
        const eventsCollection = db.collection(eventsCollectionName);

        const today = new Date();
        const twoDaysFromNow = new Date(today.setDate(today.getDate() + 2));
        const minDateString = twoDaysFromNow.toISOString().split('T')[0];

        // --- BUCLE PARA PROCESAR POSTS UNO A UNO HASTA ACABAR ---
        while (true) {
            // Buscamos un solo evento y lo bloqueamos de inmediato como 'processing'
            const eventToProcess = await eventsCollection.findOneAndUpdate(
                {
                    contentStatus: 'pending',
                    imageUrl: { $ne: null },
                    date: { $gte: minDateString }
                },
                { $set: { contentStatus: 'processing' } },
                { sort: { verified: -1, date: 1 }, returnDocument: 'after' }
            );

            if (!eventToProcess) {
                console.log('✅ No hay más eventos pendientes por procesar.');
                break;
            }

            console.log(`\n✨ Procesando evento con ID: ${eventToProcess._id}`);

            // --- NUEVO PASO: GENERAR IMAGEN DE CABECERA ---
            const headerImagePath = await createHeaderImage(eventToProcess);
            if (!headerImagePath) {
                console.log('🔴 No se pudo crear la imagen de cabecera. Revertiendo estado.');
                await updateEventStatus(eventsCollection, eventToProcess._id, 'pending');
                continue;
            }
            // --- FIN NUEVO PASO ---

            const structuredPost = await generateStructuredPost(eventToProcess);

            if (!structuredPost) {
                console.log('🔴 No se pudo generar contenido. La cuota de tokens puede estar agotada o ha ocurrido un error.');
                // Revertimos el estado para que se intente en la próxima ejecución
                await updateEventStatus(eventsCollection, eventToProcess._id, 'pending');
                break;
            }

            // --- PARSING DEL JSON ---
            let parsedPost;
            try {
                parsedPost = JSON.parse(structuredPost);
            } catch (jsonError) {
                console.error('🔴 Error al parsear la respuesta JSON de Groq:', jsonError);
                await updateEventStatus(eventsCollection, eventToProcess._id, 'failed');
                continue;
            }

            const { slug, meta_title, meta_desc, post_title, post_content } = parsedPost;

            if (!slug || !post_title || !post_content) {
                console.log('🔴 La respuesta JSON no contiene todas las propiedades necesarias. Actualizando a "failed".');
                await updateEventStatus(eventsCollection, eventToProcess._id, 'failed');
                continue;
            }

            const htmlContent = marked(post_content);

            // --- CAMBIO CLAVE: SUBIR LA IMAGEN GENERADA Y OBTENER SU ID ---
            const featuredMediaId = await uploadImageToWordPress(headerImagePath, aflandToken);
            // --- FIN CAMBIO CLAVE ---

            console.log(`⏳ Publicando post "${post_title}"...`);

            // Publicamos el post directamente con estado 'publish'
            await publishToAflandBlog({
                title: post_title,
                content: htmlContent,
                slug: slug,
                status: 'publish',
                meta: {
                    _aioseo_title: meta_title,
                    _aioseo_description: meta_desc
                }
            }, aflandToken, featuredMediaId);

            await updateEventStatus(eventsCollection, eventToProcess._id, 'processed');

            // Pausa entre posts para evitar saturar las APIs
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        // --- FIN DEL BUCLE ---

    } catch (error) {
        console.error('❌ Ha ocurrido un error general:', error);
    } finally {
        await client.close();
        console.log('\n✅ Conexión a MongoDB cerrada.');
        console.log('✅ Proceso del creador de contenidos finalizado.');
    }
}

// 5. Ejecución del script
runContentCreator();