const { chromium } = require('playwright');

async function testPlaywright() {
    console.log(' Iniciando test de Playwright...');

    const browser = await chromium.launch({
        headless: false, // Mostrar el navegador para debug
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
        ]
    });

    try {
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        });
        const page = await context.newPage();

        console.log(' Navegando a Binance P2P...');
        await page.goto('https://p2p.binance.com/trade/all-payments/USDT?fiat=VES', {
            waitUntil: 'networkidle',
            timeout: 60000
        });

        console.log('⏳ Esperando 5 segundos...');
        await page.waitForTimeout(5000);

        console.log('📸 Tomando screenshot...');
        await page.screenshot({ path: 'test-screenshot.png', fullPage: true });

        // Intentar encontrar las tarjetas con diferentes selectores
        console.log('🔍 Buscando tarjetas de trading...');

        const selectors = [
            '.bn-flex.flex-col.border-b.border-b-line.py-l',
            '[class*="flex-col"][class*="border-b"]',
            '[class*="advertise"]',
            '[class*="card"]',
            'div[class*="p2p"]'
        ];

        for (const selector of selectors) {
            const count = await page.locator(selector).count();
            console.log(`  Selector: ${selector} → ${count} elementos`);
        }

        // Obtener el HTML completo para inspección
        const html = await page.content();
        console.log(`\n Longitud del HTML: ${html.length} caracteres`);

        console.log('\n Test completado. Revisa test-screenshot.png para ver la página.');

        // Esperar 10 segundos antes de cerrar para poder ver la página
        console.log('\n⏳ Esperando 10 segundos antes de cerrar...');
        await page.waitForTimeout(10000);

    } finally {
        await browser.close();
    }
}

testPlaywright()
    .then(() => {
        console.log(' Test finalizado exitosamente');
        process.exit(0);
    })
    .catch(error => {
        console.error(' Error:', error.message);
        process.exit(1);
    });
