/**
 * Utilidad para hacer requests HTTP con soporte para anti-bot protection
 * Usa puppeteer-core con chromium adaptativo (local o serverless)
 */

const axios = require('axios');
const puppeteer = require('puppeteer-core');

// Detectar si estamos en un entorno serverless o local
const isServerless = !!process.env.AWS_LAMBDA_FUNCTION_VERSION || process.env.REPLIT;

/**
 * Obtiene la ruta del ejecutable de Chromium según el entorno
 */
async function getChromiumPath() {
    if (isServerless) {
        // En entornos serverless (Replit, Lambda, etc.)
        const chromium = require('@sparticuz/chromium');
        return await chromium.executablePath();
    } else {
        // En entornos locales, intentar encontrar Chrome/Chromium instalado
        const os = require('os');
        const platform = os.platform();

        if (platform === 'win32') {
            // Rutas comunes en Windows
            const paths = [
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
            ];

            const fs = require('fs');
            for (const path of paths) {
                if (fs.existsSync(path)) {
                    return path;
                }
            }
        } else if (platform === 'darwin') {
            return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
        } else {
            // Linux
            return 'google-chrome';
        }
    }

    throw new Error('No se pudo encontrar el ejecutable de Chrome/Chromium');
}

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
 * Realiza un POST usando Puppeteer para bypass anti-bot
 */
async function postWithPuppeteer(url, formData, options = {}) {
    const executablePath = await getChromiumPath();

    // Configurar argumentos según el entorno
    let args = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
    ];

    if (isServerless) {
        const chromium = require('@sparticuz/chromium');
        args = chromium.args.concat(args);
    }

    const browser = await puppeteer.launch({
        args: args,
        executablePath: executablePath,
        headless: true,
    });

    try {
        const page = await browser.newPage();

        // Navegar primero a la página para obtener cookies anti-bot
        console.log(' Navegando a la página para resolver anti-bot...');
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        // Esperar un poco para que se resuelva el anti-bot
        await new Promise(resolve => setTimeout(resolve, 2000));

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
            console.log('  Anti-bot detectado, cambiando a Puppeteer...');
            return await postWithPuppeteer(url, formData, options);
        }

        return response;

    } catch (error) {
        console.error(' Error en axios:', error.message);

        // Si axios falla, intentar con Puppeteer como fallback
        console.log(' Intentando con Puppeteer como fallback...');
        return await postWithPuppeteer(url, formData, options);
    }
}

module.exports = {
    smartPost,
    isAntiBotChallenge,
    postWithPuppeteer
};
