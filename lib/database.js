// lib/database.js
// ACTUALIZADO: Usa MONGO_URI en lugar de MONGODB_URI

const { MongoClient } = require('mongodb');

// Leemos la variable de entorno correcta
const MONGO_URI = process.env.MONGO_URI;

// La comprobación ahora usa la variable correcta
if (!MONGO_URI) {
    throw new Error('Define la variable de entorno MONGO_URI en tu archivo .env');
}

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
    if (cachedClient && cachedDb) {
        return cachedDb;
    }

    // La conexión ahora usa la variable correcta
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db();

    cachedClient = client;
    cachedDb = db;

    return db;
}

module.exports = { connectToDatabase };