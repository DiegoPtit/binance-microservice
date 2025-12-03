const express = require('express');
const axios = require('axios');
const config = require('./config');
const { scrapeBinanceP2P } = require('./scraper');
const { smartPost, isAntiBotChallenge } = require('./smart-request');

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
    const startTime = Date.now();

    try {
        console.log('\n' + '='.repeat(80));
        console.log(' INICIANDO PROCESO DE ACTUALIZACIÓN');
        console.log('='.repeat(80));
        console.log(` Timestamp: ${new Date().toISOString()}`);

        // 1. Scrapear precios de Binance P2P
        console.log('\n PASO 1: Scraping de Binance P2P...');
        const scrapeResult = await scrapeBinanceP2P();

        if (!scrapeResult.success) {
            throw new Error(`Scraping falló: ${scrapeResult.error}`);
        }

        const bestPrice = scrapeResult.data.bestPrice;
        console.log(` Scraping exitoso`);
        console.log(`   Mejor precio: ${bestPrice} VES`);
        console.log(`   Precio promedio: ${scrapeResult.data.avgPrice} VES`);
        console.log(`   Total ofertas: ${scrapeResult.data.totalOffers}`);

        // 2. Preparar actualización a la aplicación principal
        const updateUrl = `${config.APP_BASE_URL}${config.UPDATE_RATE_ENDPOINT}`;
        console.log('\n PASO 2: Preparando envío al servidor destino');
        console.log(`   URL destino: ${updateUrl}`);

        // Preparar datos como objeto para smartPost
        const postData = {
            precio_paralelo: bestPrice,
            observaciones: `Actualización automática desde Binance P2P. ${scrapeResult.data.totalOffers} ofertas analizadas.`,
            source: 'binance-p2p-scraper',
            metadata: JSON.stringify({
                avgPrice: scrapeResult.data.avgPrice,
                maxPrice: scrapeResult.data.maxPrice,
                totalOffers: scrapeResult.data.totalOffers,
                timestamp: scrapeResult.timestamp
            })
        };

        console.log('\n DATOS A ENVIAR (POST):');
        console.log(`   - precio_paralelo: ${bestPrice}`);
        console.log(`   - observaciones: ${postData.observaciones}`);
        console.log(`   - source: binance-p2p-scraper`);
        console.log(`   - metadata: ${postData.metadata}`);

        console.log('\n HEADERS A ENVIAR:');
        console.log('   - Content-Type: application/x-www-form-urlencoded');
        console.log('   - User-Agent: BinanceP2PScraper/1.0');

        // 3. Enviar al servidor con bypass anti-bot
        console.log('\n PASO 3: Enviando request HTTP POST (con bypass anti-bot)...');
        const requestStartTime = Date.now();

        const updateResponse = await smartPost(updateUrl, postData, {
            timeout: 15000,
            userAgent: 'BinanceP2PScraper/1.0'
        });

        const requestDuration = Date.now() - requestStartTime;

        // 4. Mostrar respuesta DETALLADA del servidor
        console.log('\n' + '='.repeat(80));
        console.log(' RESPUESTA DEL SERVIDOR DESTINO');
        console.log('='.repeat(80));
        console.log(`   Tiempo de respuesta: ${requestDuration}ms`);
        console.log(`   Status Code: ${updateResponse.status}`);
        console.log(`   Status Text: ${updateResponse.statusText || 'OK'}`);

        if (updateResponse.finalUrl) {
            console.log(`   URL Final: ${updateResponse.finalUrl}`);
        }

        console.log('\n RESPONSE HEADERS:');
        if (updateResponse.headers && Object.keys(updateResponse.headers).length > 0) {
            Object.keys(updateResponse.headers).forEach(key => {
                console.log(`   - ${key}: ${updateResponse.headers[key]}`);
            });
        } else {
            console.log('   (No disponibles - usado con Puppeteer)');
        }

        console.log('\n RESPONSE DATA (Contenido completo):');
        console.log('   Tipo de dato:', typeof updateResponse.data);
        if (typeof updateResponse.data === 'string') {
            console.log('   Longitud:', updateResponse.data.length, 'caracteres');
            console.log('   Primeros 1000 caracteres:');
            console.log('   ---');
            console.log(updateResponse.data.substring(0, 1000));
            console.log('   ---');
            if (updateResponse.data.length > 1000) {
                console.log(`   ... (${updateResponse.data.length - 1000} caracteres más)`);
            }

            // Intentar parsear si parece JSON
            if (updateResponse.data.trim().startsWith('{') || updateResponse.data.trim().startsWith('[')) {
                try {
                    const parsed = JSON.parse(updateResponse.data);
                    console.log('\n    Data parseada como JSON:');
                    console.log(JSON.stringify(parsed, null, 2).split('\n').map(line => '   ' + line).join('\n'));
                } catch (e) {
                    console.log('\n     No se pudo parsear como JSON válido');
                }
            }
        } else {
            console.log(JSON.stringify(updateResponse.data, null, 2).split('\n').map(line => '   ' + line).join('\n'));
        }

        console.log('\n' + '='.repeat(80));

        // Verificar si el status code es exitoso
        const isSuccess = updateResponse.status >= 200 && updateResponse.status < 300;

        if (isSuccess) {
            console.log(' ACTUALIZACIÓN COMPLETADA EXITOSAMENTE');
        } else {
            console.log('  ADVERTENCIA: Status code no exitoso (' + updateResponse.status + ')');
        }

        const totalDuration = Date.now() - startTime;
        console.log(`  Duración total del proceso: ${totalDuration}ms`);
        console.log('='.repeat(80) + '\n');

        // Responder al cliente del microservicio
        res.json({
            success: isSuccess,
            message: isSuccess ? 'Precio actualizado correctamente' : 'Request enviado pero status code no exitoso',
            statusCode: updateResponse.status,
            statusText: updateResponse.statusText || 'OK',
            duration: {
                total: totalDuration,
                request: requestDuration
            },
            data: {
                newPrice: bestPrice,
                scrapeInfo: scrapeResult.data,
                updateResponse: {
                    status: updateResponse.status,
                    statusText: updateResponse.statusText || 'OK',
                    headers: updateResponse.headers,
                    data: updateResponse.data
                }
            }
        });

    } catch (error) {
        const totalDuration = Date.now() - startTime;

        console.log('\n' + '='.repeat(80));
        console.error(' ERROR EN /update-rate');
        console.log('='.repeat(80));
        console.error(`    Error message: ${error.message}`);
        console.error(`    Error name: ${error.name}`);
        console.error(`     Duración hasta el error: ${totalDuration}ms`);

        // Si es un error de Axios, mostrar detalles específicos
        if (error.response) {
            console.error('\n    ERROR DE RESPUESTA HTTP:');
            console.error(`   - Status: ${error.response.status}`);
            console.error(`   - Status Text: ${error.response.statusText}`);
            console.error('\n   - Headers:');
            Object.keys(error.response.headers).forEach(key => {
                console.error(`     • ${key}: ${error.response.headers[key]}`);
            });
            console.error('\n   - Response Data:');
            console.error(JSON.stringify(error.response.data, null, 2).split('\n').map(line => '     ' + line).join('\n'));
        } else if (error.request) {
            console.error('\n    ERROR DE REQUEST (No se recibió respuesta):');
            console.error(`   - Timeout: ${error.code === 'ECONNABORTED' ? 'SÍ' : 'NO'}`);
            console.error(`   - Error code: ${error.code}`);
            console.error(`   - Request details:`, error.config ? {
                url: error.config.url,
                method: error.config.method,
                headers: error.config.headers,
                timeout: error.config.timeout
            } : 'No disponible');
        } else {
            console.error('\n     ERROR DE CONFIGURACIÓN O INTERNO:');
            console.error(`   - Stack trace:`);
            console.error(error.stack.split('\n').map(line => '     ' + line).join('\n'));
        }

        console.log('='.repeat(80) + '\n');

        res.status(500).json({
            success: false,
            error: error.message,
            errorName: error.name,
            errorCode: error.code,
            timestamp: new Date().toISOString(),
            duration: totalDuration,
            details: error.response ? {
                status: error.response.status,
                statusText: error.response.statusText,
                headers: error.response.headers,
                data: error.response.data
            } : (error.request ? {
                request: 'Enviado pero sin respuesta',
                timeout: error.code === 'ECONNABORTED'
            } : null)
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
    console.log(`\n Servidor iniciado en http://localhost:${PORT}`);
    console.log(` Endpoints disponibles:`);
    console.log(`   - GET  /health       (Estado del servicio)`);
    console.log(`   - GET  /scrape       (Scrapear precios)`);
    console.log(`   - GET  /get-averages (Obtener promedios resumidos)`);
    console.log(`   - POST /update-rate  (Scrapear y actualizar)`);
    console.log(`   - GET  /config       (Configuración actual)`);
    console.log(`\n Configuración:`);
    console.log(`   - URL P2P: ${config.P2P_URL}`);
    console.log(`   - Endpoint destino: ${config.APP_BASE_URL}${config.UPDATE_RATE_ENDPOINT}`);
    console.log(`\n Tip: Ejecuta POST http://localhost:${PORT}/update-rate para testear\n`);
});

module.exports = app;
