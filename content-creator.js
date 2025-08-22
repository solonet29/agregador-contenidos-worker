// 1. Módulos y dependencias
require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const Groq = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createCanvas, loadImage, registerFont } = require('canvas');
const { publishToAflandBlog, uploadImageToWordPress, downloadImage } = require('./afland-publisher');
const { marked } = require('marked');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');


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
const geminiApiKey = process.env.GEMINI_API_KEY;
const aflandToken = process.env.AFLAND_API_KEY;
const dbName = 'DuendeDB';
const eventsCollectionName = 'events';

const groqModel = process.env.GROQ_MODEL || 'llama3-8b-8192';

if (!mongoUri || !groqApiKey || !aflandToken || !geminiApiKey) {
    throw new Error('Faltan variables de entorno críticas. Revisa tus secretos de GitHub Actions (MONGO_URI, GROQ_API_KEY, GEMINI_API_KEY, AFLAND_API_KEY).');
}

// Inicialización de clientes de IA
const groq = new Groq({ apiKey: groqApiKey });
const genAI = new GoogleGenerativeAI(geminiApiKey);
const geminiModel = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: { responseMimeType: "application/json" }
});


// 3. Funciones de utilidad

async function extractFromSourceURL(url) {
    if (!url) {
        return { imageUrl: null, context: null };
    }
    try {
        const { data } = await axios.get(url, { timeout: 10000 });
        const $ = cheerio.load(data);

        let imageUrl = $('meta[property="og:image"]').attr('content');
        if (!imageUrl) {
            let maxArea = 0;
            $('body img').each((i, element) => {
                const img = $(element);
                const width = parseInt(img.attr('width')) || img.width() || 0;
                const height = parseInt(img.attr('height')) || img.height() || 0;
                const area = width * height;
                if (area > maxArea) {
                    maxArea = area;
                    imageUrl = img.attr('src');
                }
            });
        }
        
        if (imageUrl) {
            try {
                imageUrl = new URL(imageUrl, url).href;
            } catch (e) {
                console.warn(`URL de imagen inválida (${imageUrl}) encontrada en ${url}. Se descartará.`);
                imageUrl = null;
            }
        }

        let context = '';
        $('p').each((i, element) => {
            const paragraph = $(element).text().trim();
            if (paragraph) {
                context += paragraph + '\n\n';
            }
        });

        return { imageUrl, context: context.trim() };
    } catch (error) {
        console.error(`❌ Error al extraer datos de la URL ${url}:`, error.message);
        return { imageUrl: null, context: null };
    }
}

function getPrompt(event, externalContext = '') {
    const eventDateFormatted = new Date(event.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const eventUrl = `https://buscador.afland.es/?eventId=${event._id}`;

    let extraContext = '';
    if (event.nightPlan && event.nightPlan.trim() !== '') {
        extraContext += `

# INFORMACIÓN ADICIONAL (PLAN NOCTURNO)
${event.nightPlan}`;
    }
    if (externalContext) {
        extraContext += `

# CONTEXTO EXTRAÍDO DE LA FUENTE ORIGINAL
${externalContext}`;
    }

    return `
# CONTEXTO
Eres 