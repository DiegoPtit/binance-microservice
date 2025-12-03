/**
 * Test rápido del bypass anti-bot con smartPost
 */

const { smartPost } = require('./smart-request');
const config = require('./config');

async function testBypassAntiBot() {
    const updateUrl = `${config.APP_BASE_URL}${config.UPDATE_RATE_ENDPOINT}`;

    console.log('🧪 TEST DE BYPASS ANTI-BOT\n');
    console.log(`URL: ${updateUrl}\n`);

    const postData = {
        precio_paralelo: '46.25',
        observaciones: 'Test de bypass anti-bot con Puppeteer',
        source: 'test-bypass',
        metadata: JSON.stringify({ test: true })
    };

    try {
        const response = await smartPost(updateUrl, postData, {
            timeout: 20000
        });

        console.log('\n✅ RESPUESTA:');
        console.log('Status:', response.status);
        console.log('Data type:', typeof response.data);
        console.log('Data:', response.data);

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error(error.stack);
    }
}

testBypassAntiBot();
