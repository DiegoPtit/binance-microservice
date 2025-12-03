const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const config = require('./config');
const { scrapeBinanceP2P, getBrowserInstance, closeBrowserInstance } = require('./scraper');
const { smartPost, isAntiBotChallenge } = require('./smart-request');
const { createEndpointLogger } = require('./logger');

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
    const logger = createEndpointLogger('health');
    const startTime = Date.now();

    const response = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'Binance P2P Scraper',
        version: '1.0.0'
    };

    logger.logSuccess(req, { data: response }, Date.now() - startTime);
    res.json(response);
});

/**
 * Endpoint para scrapear precios manualmente
 */
app.get('/scrape', async (req, res) => {
    const logger = createEndpointLogger('scrape');
    const startTime = Date.now();

    try {
        const result = await scrapeBinanceP2P();

        logger.logSuccess(req, {
            data: {
                success: result.success,
                bestPrice: result.data?.bestPrice,
                avgPrice: result.data?.avgPrice,
                totalOffers: result.data?.totalOffers
            }
        }, Date.now() - startTime);

        res.json(result);
    } catch (error) {
        logger.logError(req, error, Date.now() - startTime);

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
    const logger = createEndpointLogger('get-averages');
    const startTime = Date.now();

    try {
        const result = await scrapeBinanceP2P();

        if (!result.success) {
            logger.logError(req, new Error(result.error || 'Scraping failed'), Date.now() - startTime);

            return res.status(500).json({
                success: false,
                error: result.error,
                timestamp: result.timestamp
            });
        }

        // Devolver únicamente los datos resumidos
        const response = {
            success: true,
            timestamp: result.timestamp,
            data: {
                mejorPrecio: result.data.bestPrice,
                precioPromedio: result.data.avgPrice,
                precioMaximo: result.data.maxPrice,
                mejorPrecioObtenido: result.data.bestPrice // Alias del mejor precio
            }
        };

        logger.logSuccess(req, { data: response.data }, Date.now() - startTime);
        res.json(response);

    } catch (error) {
        logger.logError(req, error, Date.now() - startTime);

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
    const logger = createEndpointLogger('update-rate');
    const startTime = Date.now();

    try {
        console.log('\n' + '='.repeat(80));
        console.log('█ INICIANDO PROCESO DE ACTUALIZACIÓN');
        console.log('='.repeat(80));
        console.log(`█ Timestamp: ${new Date().toISOString()}`);

        // 1. Scrapear precios de Binance P2P
        console.log('\n█ PASO 1: Scraping de Binance P2P...');
        const scrapeResult = await scrapeBinanceP2P();

        if (!scrapeResult.success) {
            throw new Error(`Scraping falló: ${scrapeResult.error}`);
        }

        const avgPrice = scrapeResult.data.avgPrice; // CAMBIO: usar precio promedio
        console.log(`█ Scraping exitoso`);
        console.log(`  • Precio promedio (enviando): ${avgPrice} VES`);
        console.log(`  • Mejor precio: ${scrapeResult.data.bestPrice} VES`);
        console.log(`  • Precio máximo: ${scrapeResult.data.maxPrice} VES`);
        console.log(`  • Total ofertas: ${scrapeResult.data.totalOffers}`);

        // 2. Preparar actualización a la aplicación principal
        const updateUrl = `${config.APP_BASE_URL}${config.UPDATE_RATE_ENDPOINT}`;
        console.log('\n█ PASO 2: Preparando envío al servidor destino');
        console.log(`  • URL destino: ${updateUrl}`);

        // Preparar datos como objeto para smartPost
        const postData = {
            precio_paralelo: avgPrice, // CAMBIO: enviar precio promedio
            observaciones: `Actualización automática desde Binance P2P (precio promedio). ${scrapeResult.data.totalOffers} ofertas analizadas.`,
            source: 'binance-p2p-scraper',
            metadata: JSON.stringify({
                avgPrice: scrapeResult.data.avgPrice,
                bestPrice: scrapeResult.data.bestPrice,
                maxPrice: scrapeResult.data.maxPrice,
                totalOffers: scrapeResult.data.totalOffers,
                timestamp: scrapeResult.timestamp
            })
        };

        console.log('\n█ DATOS A ENVIAR (POST):');
        console.log(`  • precio_paralelo: ${avgPrice} (promedio)`);
        console.log(`  • observaciones: ${postData.observaciones}`);
        console.log(`  • source: binance-p2p-scraper`);
        console.log(`  • metadata: ${postData.metadata}`);

        console.log('\n█ HEADERS A ENVIAR:');
        console.log('  • Content-Type: application/x-www-form-urlencoded');
        console.log('  • User-Agent: BinanceP2PScraper/1.0');

        // 3. Enviar al servidor con bypass anti-bot
        console.log('\n█ PASO 3: Enviando request HTTP POST (con bypass anti-bot)...');
        const requestStartTime = Date.now();

        const updateResponse = await smartPost(updateUrl, postData, {
            timeout: 15000,
            userAgent: 'BinanceP2PScraper/1.0'
        });

        const requestDuration = Date.now() - requestStartTime;

        // 4. Mostrar respuesta DETALLADA del servidor
        console.log('\n' + '='.repeat(80));
        console.log('█ RESPUESTA DEL SERVIDOR DESTINO');
        console.log('='.repeat(80));
        console.log(`  • Tiempo de respuesta: ${requestDuration}ms`);
        console.log(`  • Status Code: ${updateResponse.status}`);
        console.log(`  • Status Text: ${updateResponse.statusText || 'OK'}`);

        if (updateResponse.finalUrl) {
            console.log(`  • URL Final: ${updateResponse.finalUrl}`);
        }

        console.log('\n█ RESPONSE HEADERS:');
        if (updateResponse.headers && Object.keys(updateResponse.headers).length > 0) {
            Object.keys(updateResponse.headers).forEach(key => {
                console.log(`  • ${key}: ${updateResponse.headers[key]}`);
            });
        } else {
            console.log('  (No disponibles - usado con Puppeteer)');
        }

        console.log('\n█ RESPONSE DATA (Contenido completo):');
        console.log('  Tipo de dato:', typeof updateResponse.data);
        if (typeof updateResponse.data === 'string') {
            console.log('  Longitud:', updateResponse.data.length, 'caracteres');
            console.log('  Primeros 1000 caracteres:');
            console.log('  ---');
            console.log(updateResponse.data.substring(0, 1000));
            console.log('  ---');
            if (updateResponse.data.length > 1000) {
                console.log(`  ... (${updateResponse.data.length - 1000} caracteres más)`);
            }

            // Intentar parsear si parece JSON
            if (updateResponse.data.trim().startsWith('{') || updateResponse.data.trim().startsWith('[')) {
                try {
                    const parsed = JSON.parse(updateResponse.data);
                    console.log('\n  █ Data parseada como JSON:');
                    console.log(JSON.stringify(parsed, null, 2).split('\n').map(line => '    ' + line).join('\n'));
                } catch (e) {
                    console.log('\n  █ No se pudo parsear como JSON válido');
                }
            }
        } else {
            console.log(JSON.stringify(updateResponse.data, null, 2).split('\n').map(line => '  ' + line).join('\n'));
        }

        console.log('\n' + '='.repeat(80));

        // Verificar si el status code es exitoso
        const isSuccess = updateResponse.status >= 200 && updateResponse.status < 300;

        if (isSuccess) {
            console.log('█ ACTUALIZACIÓN COMPLETADA EXITOSAMENTE');
        } else {
            console.log('█ ADVERTENCIA: Status code no exitoso (' + updateResponse.status + ')');
        }

        const totalDuration = Date.now() - startTime;
        console.log(`█ Duración total del proceso: ${totalDuration}ms`);
        console.log('='.repeat(80) + '\n');

        // Log a archivo
        logger.log({
            request: {
                method: req.method,
                ip: req.ip || req.connection.remoteAddress
            },
            process: {
                'Scraping': `Exitoso - Precio promedio: ${avgPrice} VES`,
                'Ofertas analizadas': scrapeResult.data.totalOffers,
                'URL destino': updateUrl,
                'Duración request': `${requestDuration}ms`
            },
            result: {
                success: isSuccess,
                status: updateResponse.status,
                data: `Precio actualizado a ${avgPrice} VES (promedio)`
            },
            duration: totalDuration
        });

        // Responder al cliente del microservicio
        res.json({
            success: isSuccess,
            message: isSuccess ? 'Precio promedio actualizado correctamente' : 'Request enviado pero status code no exitoso',
            statusCode: updateResponse.status,
            statusText: updateResponse.statusText || 'OK',
            duration: {
                total: totalDuration,
                request: requestDuration
            },
            data: {
                newPrice: avgPrice,
                priceType: 'average',
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
        console.error('█ ERROR EN /update-rate');
        console.log('='.repeat(80));
        console.error(`  • Error message: ${error.message}`);
        console.error(`  • Error name: ${error.name}`);
        console.error(`  • Duración hasta el error: ${totalDuration}ms`);

        // Si es un error de Axios, mostrar detalles específicos
        if (error.response) {
            console.error('\n  █ ERROR DE RESPUESTA HTTP:');
            console.error(`    - Status: ${error.response.status}`);
            console.error(`    - Status Text: ${error.response.statusText}`);
            console.error('\n    - Headers:');
            Object.keys(error.response.headers).forEach(key => {
                console.error(`      • ${key}: ${error.response.headers[key]}`);
            });
            console.error('\n    - Response Data:');
            console.error(JSON.stringify(error.response.data, null, 2).split('\n').map(line => '      ' + line).join('\n'));
        } else if (error.request) {
            console.error('\n  █ ERROR DE REQUEST (No se recibió respuesta):');
            console.error(`    - Timeout: ${error.code === 'ECONNABORTED' ? 'SÍ' : 'NO'}`);
            console.error(`    - Error code: ${error.code}`);
            console.error(`    - Request details:`, error.config ? {
                url: error.config.url,
                method: error.config.method,
                headers: error.config.headers,
                timeout: error.config.timeout
            } : 'No disponible');
        } else {
            console.error('\n  █ ERROR DE CONFIGURACIÓN O INTERNO:');
            console.error(`    - Stack trace:`);
            console.error(error.stack.split('\n').map(line => '      ' + line).join('\n'));
        }

        console.log('='.repeat(80) + '\n');

        // Log a archivo
        logger.logError(req, error, totalDuration);

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
    const logger = createEndpointLogger('config');
    const startTime = Date.now();

    const response = {
        p2pUrl: config.P2P_URL,
        updateEndpoint: `${config.APP_BASE_URL}${config.UPDATE_RATE_ENDPOINT}`,
        updateInterval: config.UPDATE_INTERVAL,
        timeout: config.PAGE_TIMEOUT,
        retryAttempts: config.RETRY_ATTEMPTS
    };

    logger.logSuccess(req, { data: response }, Date.now() - startTime);
    res.json(response);
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
const server = app.listen(PORT, async () => {
    console.log(`\n█ Servidor iniciado en http://localhost:${PORT}`);
    console.log(`█ Endpoints disponibles:`);
    console.log(`  • GET  /health       (Estado del servicio)`);
    console.log(`  • GET  /scrape       (Scrapear precios)`);
    console.log(`  • GET  /get-averages (Obtener promedios resumidos)`);
    console.log(`  • POST /update-rate  (Scrapear y actualizar)`);
    console.log(`  • GET  /config       (Configuración actual)`);
    console.log(`\n█ Configuración:`);
    console.log(`  • URL P2P: ${config.P2P_URL}`);
    console.log(`  • Endpoint destino: ${config.APP_BASE_URL}${config.UPDATE_RATE_ENDPOINT}`);
    console.log(`  • Logs guardados en: ./logs/`);

    // Pre-inicializar navegador persistente
    console.log(`\n█ Pre-inicializando navegador persistente...`);
    try {
        await getBrowserInstance();
        console.log(`[!] Navegador persistente listo`);
    } catch (error) {
        console.error(`[!!!] Error pre-inicializando navegador:`, error.message);
        console.error(`   Se intentará inicializar en el primer uso`);
    }

    console.log(`\n█ Tip: Ejecuta POST http://localhost:${PORT}/update-rate para testear\n`);
});

// ═══════════════════════════════════════════════════════════════════════════
// DAEMON SCHEDULER - Ejecuta /update-rate cada 15 minutos
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Función auxiliar para ejecutar update-rate internamente (sin HTTP)
 */
async function runUpdateRateDaemon() {
    console.log('\n' + '═'.repeat(80));
    console.log('[!] DAEMON: Ejecución automática de update-rate');
    console.log('═'.repeat(80));
    console.log(`[!] Timestamp: ${new Date().toISOString()}\n`);

    try {
        // Hacer un request interno POST a /update-rate
        const axios = require('axios');
        const response = await axios.post(`http://localhost:${PORT}/update-rate`, {}, {
            timeout: 60000 // 60 segundos de timeout
        });

        console.log('[!] DAEMON: Actualización completada exitosamente');
        console.log(`   Status: ${response.status}`);
        console.log(`   Precio actualizado: ${response.data.data?.newPrice} VES`);
        console.log('═'.repeat(80) + '\n');
    } catch (error) {
        console.error('[!!!] DAEMON: Error en actualización automática');
        console.error(`   Error: ${error.message}`);
        if (error.response) {
            console.error(`   HTTP Status: ${error.response.status}`);
        }
        console.log('═'.repeat(80) + '\n');
    }
}

// Configurar cron job: cada 15 minutos
// Formato cron: */15 * * * * = cada 15 minutos
const daemonSchedule = '*/15 * * * *';
console.log(`\n[!] Configurando daemon programado...`);
console.log(`   [!] Frecuencia: Cada 15 minutos`);
console.log(`   [!] Expresión cron: ${daemonSchedule}`);

const cronJob = cron.schedule(daemonSchedule, runUpdateRateDaemon, {
    scheduled: true,
    timezone: "America/Caracas" // Ajusta según tu zona horaria
});

console.log(`\n[!] Daemon programado y activo`);

// Ejecutar inmediatamente al iniciar (opcional, puedes comentar esta línea si no quieres)
console.log(`\n[!] Ejecutando primera actualización inmediata...`);
setTimeout(() => {
    runUpdateRateDaemon().catch(err => console.error('Error en ejecución inicial:', err));
}, 5000); // Esperar 5 segundos después del inicio del servidor

// ═══════════════════════════════════════════════════════════════════════════
// GRACEFUL SHUTDOWN - Limpieza al cerrar el servidor
// ═══════════════════════════════════════════════════════════════════════════

async function gracefulShutdown(signal) {
    console.log(`\n\n${'═'.repeat(80)}`);
    console.log(`[!] Señal ${signal} recibida, cerrando servidor...`);
    console.log('═'.repeat(80));

    // Detener cron job
    console.log('[!] Deteniendo daemon scheduler...');
    cronJob.stop();

    // Cerrar servidor HTTP
    console.log('[!] Cerrando servidor HTTP...');
    server.close(() => {
        console.log('[!] Servidor HTTP cerrado');
    });

    // Cerrar navegador persistente
    console.log('[!] Cerrando navegador persistente...');
    await closeBrowserInstance();
    console.log('[!] Navegador cerrado');

    console.log('═'.repeat(80));
    console.log('Proceso terminado...');
    console.log('═'.repeat(80) + '\n');

    process.exit(0);
}

// Capturar señales de terminación
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
