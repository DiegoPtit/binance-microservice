require('dotenv').config();

module.exports = {
    // Configuración del servidor
    PORT: process.env.PORT || 3000,

    // URLs
    APP_BASE_URL: process.env.APP_BASE_URL || 'http://localhost/inventario-app/web',
    UPDATE_RATE_ENDPOINT: process.env.UPDATE_RATE_ENDPOINT || '/index.php?r=site/update-usdt-rate',
    P2P_URL: process.env.P2P_URL || 'https://p2p.binance.com/trade/all-payments/USDT?fiat=VES',

    // Selectores CSS para extraer datos
    SELECTORS: {
        TRADING_CARD: '.bn-flex.flex-col.border-b.border-b-line.py-l',
        PRICE_CONTAINER: '.bn-flex.items-baseline.gap-4xs.flex-row.w-fit',
        // Selector alternativo si el principal falla
        PRICE_ALT: '[data-testid="price"]'
    },

    // Regex para extraer precio
    PRICE_REGEX: /Bs\.?\s*([\d.,]+)/i,

    // Configuración de scraping
    PAGE_TIMEOUT: parseInt(process.env.PAGE_TIMEOUT) || 30000,
    RETRY_ATTEMPTS: parseInt(process.env.RETRY_ATTEMPTS) || 3,
    UPDATE_INTERVAL: parseInt(process.env.UPDATE_INTERVAL) || 5,

    // Configuración de Puppeteer
    PUPPETEER_OPTIONS: {
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
        ]
    }
};
