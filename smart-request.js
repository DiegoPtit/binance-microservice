/**
 * Utilidad para hacer requests HTTP con soporte para anti-bot protection
 * Usa Puppeteer para ejecutar JavaScript cuando es necesario
 */

const axios = require('axios');
const { chromium } = require('playwright');

/**
 * Detecta si la respuesta es un challenge anti-bot
 */
function isAntiBotChallenge(html) {
    if (typeof html !== 'string') return false;

    return (
        html.includes('slowAES.decrypt') ||
        html.includes('__test=') ||
        html.includes('This site requires Javascript to work')
    );
}

/**
 * Realiza un POST usando Playwright para bypass anti-bot
 */
async function postWithPlaywright(url, formData, options = {}) {
    const browser = await chromium.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
        ]
    });

    try {
        const context = await browser.newContext();
        const page = await context.newPage();

        // Navegar primero a la página para obtener cookies anti-bot
        console.log(' Navegando a la página para resolver anti-bot...');
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

        // Esperar un poco para que se resuelva el anti-bot
        await page.waitForTimeout(2000);

        // Ahora hacer el POST mediante fetch desde el contexto de la página
        console.log(' Enviando POST request...');
        const result = await page.evaluate(async (targetUrl, data) => {
            // Convertir data a URLSearchParams
            const formBody = new URLSearchParams();
            for (const key in data) {
                formBody.append(key, data[key]);
            }

            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formBody.toString()
            });

            const contentType = response.headers.get('content-type');
            let responseData;

            if (contentType && contentType.includes('application/json')) {
                responseData = await response.json();
            } else {
                responseData = await response.text();
            }

            return {
                status: response.status,
                statusText: response.statusText,
                url: response.url,
                data: responseData
            };

        }, url, formData);

        return {
            status: result.status,
            statusText: result.statusText,
            headers: {},
            data: result.data,
            finalUrl: result.url
        };

    } finally {
        await browser.close();
    }
}

/**
 * Smart POST request - Intenta con axios primero, si encuentra anti-bot usa Puppeteer
 */
async function smartPost(url, formData, options = {}) {
    console.log(' Intentando POST con axios...');

    try {
        // Convertir formData object a URLSearchParams
        const params = new URLSearchParams();
        Object.entries(formData).forEach(([key, value]) => {
            params.append(key, typeof value === 'object' ? JSON.stringify(value) : value);
        });

        const response = await axios.post(url, params, {
            timeout: options.timeout || 10000,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': options.userAgent || 'BinanceP2PScraper/1.0',
                ...options.headers
            },
            validateStatus: () => true
        });

        // Verificar si es un challenge anti-bot
        if (isAntiBotChallenge(response.data)) {
            console.log('  Anti-bot detectado, cambiando a Playwright...');
            return await postWithPlaywright(url, formData, options);
        }

        return response;

    } catch (error) {
        console.error(' Error en axios:', error.message);

        // Si axios falla, intentar con Playwright como fallback
        console.log(' Intentando con Playwright como fallback...');
        return await postWithPlaywright(url, formData, options);
    }
}

module.exports = {
    smartPost,
    isAntiBotChallenge,
    postWithPlaywright
};
