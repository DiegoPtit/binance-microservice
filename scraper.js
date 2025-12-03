const puppeteer = require('puppeteer');
const config = require('./config');

// Instancia global de navegador persistente
let globalBrowser = null;
let globalBrowserInitializing = false;

/**
 * Obtiene o inicializa la instancia persistente del navegador
 * @returns {Promise<Browser>} - Instancia de Puppeteer Browser
 */
async function getBrowserInstance() {
    // Si ya existe y está conectado, retornar
    if (globalBrowser && globalBrowser.isConnected()) {
        console.log('[!] Reutilizando instancia de navegador existente');
        return globalBrowser;
    }

    // Si ya se está inicializando, esperar
    if (globalBrowserInitializing) {
        console.log('[!] Esperando inicialización del navegador...');
        while (globalBrowserInitializing) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return globalBrowser;
    }

    // Inicializar nueva instancia
    try {
        globalBrowserInitializing = true;
        console.log('[!] Inicializando nueva instancia de navegador persistente...');

        globalBrowser = await puppeteer.launch(config.PUPPETEER_OPTIONS);

        // Event listener para reiniciar si se desconecta
        globalBrowser.on('disconnected', () => {
            console.log('[!!!] Navegador desconectado, se reiniciará en el próximo uso');
            globalBrowser = null;
        });

        console.log('[!] Navegador persistente inicializado correctamente');
        return globalBrowser;
    } catch (error) {
        console.error('[!!!] Error inicializando navegador:', error.message);
        globalBrowser = null;
        throw error;
    } finally {
        globalBrowserInitializing = false;
    }
}

/**
 * Cierra la instancia persistente del navegador (solo usar al apagar el servidor)
 */
async function closeBrowserInstance() {
    if (globalBrowser && globalBrowser.isConnected()) {
        console.log('[!] Cerrando instancia persistente del navegador...');
        await globalBrowser.close();
        globalBrowser = null;
    }
}

/**
 * Convierte el formato de precio de Binance P2P a número flotante
 * Binance P2P usa PUNTO como separador DECIMAL (formato USA): "389.000" = 389.0 VES
 * @param {string} priceText - Texto del precio
 * @returns {number|null} - Precio como número o null si no es válido
 */
function parsePrice(priceText) {
    try {
        const match = priceText.match(config.PRICE_REGEX);
        if (!match || !match[1]) {
            return null;
        }

        // Binance P2P usa formato USA: punto = decimal, NO separador de miles
        // Ejemplos:
        // "389.000" → 389.0
        // "390.500" → 390.5
        // "45.123" → 45.123

        // Limpiar el string: eliminar espacios y comas (por si acaso)
        let cleanPrice = match[1].trim().replace(/,/g, '');

        // Parsear directamente - el punto ya es separador decimal
        const price = parseFloat(cleanPrice);

        // Validar que sea un número válido
        if (isNaN(price) || price <= 0) {
            return null;
        }

        return price;
    } catch (error) {
        console.error('Error parseando precio:', error.message);
        return null;
    }
}

/**
 * Extrae los precios USDT/VES de Binance P2P
 * @returns {Promise<Object>} - Objeto con precios extraídos y estadísticas
 */
async function scrapeBinanceP2P() {
    let page = null;

    try {
        console.log('[!] Iniciando scraping de Binance P2P...');
        console.log(`[!] URL: ${config.P2P_URL}`);

        // Obtener instancia persistente del navegador
        const browser = await getBrowserInstance();
        page = await browser.newPage();

        // Configurar timeout y user agent
        page.setDefaultTimeout(config.PAGE_TIMEOUT);
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

        // Navegar a la página
        console.log('[!] Navegando a Binance P2P...');
        await page.goto(config.P2P_URL, {
            waitUntil: 'networkidle2',
            timeout: config.PAGE_TIMEOUT
        });

        // Esperar a que carguen las tarjetas de trading
        console.log('[!] Esperando tarjetas de trading...');
        await page.waitForSelector(config.SELECTORS.TRADING_CARD, {
            timeout: config.PAGE_TIMEOUT
        });

        // Esperar un poco más para asegurar que todo cargó
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Extraer precios
        console.log('[!] Extrayendo precios...');
        const prices = await page.evaluate((selectors) => {
            const cards = document.querySelectorAll(selectors.TRADING_CARD);
            const results = [];

            cards.forEach((card, index) => {
                try {
                    // Intentar con el selector principal
                    let priceElement = card.querySelector(selectors.PRICE_CONTAINER);

                    // Si no funciona, intentar con el alternativo
                    if (!priceElement) {
                        priceElement = card.querySelector(selectors.PRICE_ALT);
                    }

                    if (priceElement) {
                        const priceText = priceElement.textContent || priceElement.innerText;
                        results.push({
                            index: index,
                            rawText: priceText.trim(),
                            cardHtml: card.innerHTML.substring(0, 200) // Primer fragmento para debug
                        });
                    }
                } catch (error) {
                    console.error(`Error en card ${index}:`, error.message);
                }
            });

            return results;
        }, config.SELECTORS);

        // Solo cerrar la página, NO el navegador
        await page.close();
        page = null;

        console.log(` Extraídos ${prices.length} elementos`);

        // Parsear precios
        const parsedPrices = prices
            .map(item => {
                const price = parsePrice(item.rawText);
                // Log detallado para debugging
                console.log(` Raw: "${item.rawText}" → Parsed: ${price} VES`);
                return {
                    ...item,
                    price: price
                };
            })
            .filter(item => item.price !== null);

        if (parsedPrices.length === 0) {
            throw new Error('No se pudieron extraer precios válidos');
        }

        // Calcular estadísticas
        const numericPrices = parsedPrices.map(p => p.price);
        const bestPrice = Math.min(...numericPrices);
        const avgPrice = numericPrices.reduce((a, b) => a + b, 0) / numericPrices.length;
        const maxPrice = Math.max(...numericPrices);

        console.log(` Mejor precio: ${bestPrice.toFixed(2)} VES`);
        console.log(` Precio promedio: ${avgPrice.toFixed(2)} VES`);
        console.log(` Precio máximo: ${maxPrice.toFixed(2)} VES`);

        return {
            success: true,
            timestamp: new Date().toISOString(),
            data: {
                bestPrice: parseFloat(bestPrice.toFixed(2)),
                avgPrice: parseFloat(avgPrice.toFixed(2)),
                maxPrice: parseFloat(maxPrice.toFixed(2)),
                totalOffers: parsedPrices.length,
                prices: parsedPrices.slice(0, 10) // Primeras 10 ofertas
            }
        };

    } catch (error) {
        console.error('[!!!] Error en scraping:', error.message);

        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    } finally {
        // Solo cerrar la página si quedó abierta, NO el navegador
        if (page && !page.isClosed()) {
            await page.close().catch(err => console.error('Error cerrando página:', err));
        }
    }
}

// Si se ejecuta directamente (npm run scrape)
if (require.main === module) {
    scrapeBinanceP2P()
        .then(result => {
            console.log('\n[!] Resultado completo:');
            console.log(JSON.stringify(result, null, 2));
            process.exit(result.success ? 0 : 1);
        })
        .catch(error => {
            console.error('[!!!] Error fatal:', error);
            process.exit(1);
        });
}

module.exports = {
    scrapeBinanceP2P,
    getBrowserInstance,
    closeBrowserInstance
};
