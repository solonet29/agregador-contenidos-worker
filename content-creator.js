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

    // Dentro de la función generateStructuredPost, reemplaza el prompt antiguo por este:

    // En content-creator.js, dentro de generateStructuredPost

    const prompt = `
# CONTEXTO
Eres 