const express = require('express');
const axios = require('axios');
const config = require('./config');
const { scrapeBinanceP2P } = require('./scraper');

const app = express();
app.use(express.json());

// Logger middleware simple
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

/**
 * Endpoint de salud
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'Binance P2P Scraper',
        version: '1.0.0'
    });
});

/**
 * Endpoint para scrapear precios manualmente
 */
app.get('/scrape', async (req, res) => {
    try {
        const result = await scrapeBinanceP2P();
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Endpoint para obtener únicamente los promedios y precios resumidos
 */
app.get('/get-averages', async (req, res) => {
    try {
        const result = await scrapeBinanceP2P();

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error,
                timestamp: result.timestamp
            });
        }

        // Devolver únicamente los datos resumidos
        res.json({
            success: true,
            timestamp: result.timestamp,
            data: {
                mejorPrecio: result.data.bestPrice,
                precioPromedio: result.data.avgPrice,
                precioMaximo: result.data.maxPrice,
                mejorPrecioObtenido: result.data.bestPrice // Alias del mejor precio
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Endpoint principal: Scrapear y actualizar precio en la aplicación
 */
app.post('/update-rate', async (req, res) => {
    try {
        console.log('\n🔄 Iniciando proceso de actualización...');

        // 1. Scrapear precios de Binance P2P
        const scrapeResult = await scrapeBinanceP2P();

        if (!scrapeResult.success) {
            throw new Error(`Scraping falló: ${scrapeResult.error}`);
        }

        const bestPrice = scrapeResult.data.bestPrice;
        console.log(`💰 Mejor precio obtenido: ${bestPrice} VES`);

        // 2. Enviar a la aplicación principal
        const updateUrl = `${config.APP_BASE_URL}${config.UPDATE_RATE_ENDPOINT}`;
        console.log(`📤 Enviando a: ${updateUrl}`);

        // Preparar datos en formato form-urlencoded (Yii espera $_POST)
        const params = new URLSearchParams();
        params.append('precio_paralelo', bestPrice);
        params.append('observaciones', `Actualización automática desde Binance P2P. ${scrapeResult.data.totalOffers} ofertas analizadas.`);
        params.append('source', 'binance-p2p-scraper');
        params.append('metadata', JSON.stringify({
            avgPrice: scrapeResult.data.avgPrice,
            maxPrice: scrapeResult.data.maxPrice,
            totalOffers: scrapeResult.data.totalOffers,
            timestamp: scrapeResult.timestamp
        }));

        console.log('📦 Datos a enviar:');
        console.log(`   - precio_paralelo: ${bestPrice}`);
        console.log(`   - source: binance-p2p-scraper`);
        console.log(`   - totalOffers: ${scrapeResult.data.totalOffers}`);

        const updateResponse = await axios.post(updateUrl, params, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'BinanceP2PScraper/1.0'
            }
        });

        console.log('✅ Precio actualizado correctamente en la aplicación');

        res.json({
            success: true,
            message: 'Precio actualizado correctamente',
            data: {
                newPrice: bestPrice,
                scrapeInfo: scrapeResult.data,
                updateResponse: updateResponse.data
            }
        });

    } catch (error) {
        console.error('❌ Error en /update-rate:', error.message);

        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Endpoint para obtener configuración actual
 */
app.get('/config', (req, res) => {
    res.json({
        p2pUrl: config.P2P_URL,
        updateEndpoint: `${config.APP_BASE_URL}${config.UPDATE_RATE_ENDPOINT}`,
        updateInterval: config.UPDATE_INTERVAL,
        timeout: config.PAGE_TIMEOUT,
        retryAttempts: config.RETRY_ATTEMPTS
    });
});

// Manejador de errores 404
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint no encontrado',
        availableEndpoints: [
            'GET /health',
            'GET /scrape',
            'GET /get-averages',
            'POST /update-rate',
            'GET /config'
        ]
    });
});

// Iniciar servidor
const PORT = config.PORT;
app.listen(PORT, () => {
    console.log(`\n🚀 Servidor iniciado en http://localhost:${PORT}`);
    console.log(`📍 Endpoints disponibles:`);
    console.log(`   - GET  /health       (Estado del servicio)`);
    console.log(`   - GET  /scrape       (Scrapear precios)`);
    console.log(`   - GET  /get-averages (Obtener promedios resumidos)`);
    console.log(`   - POST /update-rate  (Scrapear y actualizar)`);
    console.log(`   - GET  /config       (Configuración actual)`);
    console.log(`\n⚙️  Configuración:`);
    console.log(`   - URL P2P: ${config.P2P_URL}`);
    console.log(`   - Endpoint destino: ${config.APP_BASE_URL}${config.UPDATE_RATE_ENDPOINT}`);
    console.log(`\n💡 Tip: Ejecuta POST http://localhost:${PORT}/update-rate para testear\n`);
});

module.exports = app;
