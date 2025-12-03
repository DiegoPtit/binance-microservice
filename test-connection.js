/**
 * Script de prueba de conexión al servidor destino
 * Ejecutar con: node test-connection.js
 */

const axios = require('axios');
const config = require('./config');

async function testConnection() {
    const updateUrl = `${config.APP_BASE_URL}${config.UPDATE_RATE_ENDPOINT}`;

    console.log('='.repeat(80));
    console.log('🔍 TEST DE CONEXIÓN AL SERVIDOR DESTINO');
    console.log('='.repeat(80));
    console.log('\n📋 CONFIGURACIÓN:');
    console.log(`   - APP_BASE_URL: ${config.APP_BASE_URL}`);
    console.log(`   - UPDATE_RATE_ENDPOINT: ${config.UPDATE_RATE_ENDPOINT}`);
    console.log(`   - URL COMPLETA: ${updateUrl}`);

    console.log('\n🚀 Enviando request de prueba...\n');

    const params = new URLSearchParams();
    params.append('precio_paralelo', '45.50');
    params.append('observaciones', 'Test de conexión desde microservicio');
    params.append('source', 'test-connection-script');
    params.append('metadata', JSON.stringify({
        test: true,
        timestamp: new Date().toISOString()
    }));

    console.log('📦 DATOS DE PRUEBA:');
    console.log(`   - precio_paralelo: 45.50`);
    console.log(`   - observaciones: Test de conexión desde microservicio`);
    console.log(`   - source: test-connection-script`);
    console.log(`   - metadata: ${JSON.stringify({ test: true, timestamp: new Date().toISOString() })}`);

    try {
        const startTime = Date.now();

        const response = await axios.post(updateUrl, params, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'BinanceP2PScraper/1.0-Test'
            },
            validateStatus: function (status) {
                // Aceptar cualquier status
                return true;
            }
        });

        const duration = Date.now() - startTime;

        console.log('\n' + '='.repeat(80));
        console.log('📥 RESPUESTA RECIBIDA');
        console.log('='.repeat(80));
        console.log(`   ⏱️  Tiempo de respuesta: ${duration}ms`);
        console.log(`   🔢 Status Code: ${response.status}`);
        console.log(`   📝 Status Text: ${response.statusText}`);

        console.log('\n📋 RESPONSE HEADERS:');
        Object.keys(response.headers).forEach(key => {
            console.log(`   - ${key}: ${response.headers[key]}`);
        });

        console.log('\n📄 RESPONSE DATA:');
        console.log('   Tipo:', typeof response.data);

        if (typeof response.data === 'string') {
            console.log('   Longitud:', response.data.length, 'caracteres');
            console.log('\n   Contenido (primeros 1000 caracteres):');
            console.log('   ' + '─'.repeat(78));
            console.log(response.data.substring(0, 1000));
            console.log('   ' + '─'.repeat(78));

            if (response.data.length > 1000) {
                console.log(`   ... y ${response.data.length - 1000} caracteres más`);
            }

            // Intentar parsear como JSON
            if (response.data.trim().startsWith('{') || response.data.trim().startsWith('[')) {
                try {
                    const parsed = JSON.parse(response.data);
                    console.log('\n   ✅ JSON Parseado:');
                    console.log(JSON.stringify(parsed, null, 2).split('\n').map(line => '   ' + line).join('\n'));
                } catch (e) {
                    console.log('\n   ⚠️  Parece JSON pero no se pudo parsear');
                }
            }
        } else {
            console.log(JSON.stringify(response.data, null, 2).split('\n').map(line => '   ' + line).join('\n'));
        }

        console.log('\n' + '='.repeat(80));

        if (response.status >= 200 && response.status < 300) {
            console.log('✅ CONEXIÓN EXITOSA');
        } else if (response.status === 404) {
            console.log('❌ ERROR 404: EL ENDPOINT NO EXISTE');
            console.log('\n💡 POSIBLES CAUSAS:');
            console.log('   1. La ruta en config.js no es correcta');
            console.log('   2. El controlador o acción no existe');
            console.log('   3. Problema de routing en Yii2');
            console.log('\n🔧 VERIFICA:');
            console.log(`   - ¿Existe el controlador que maneja esta ruta?`);
            console.log(`   - ¿La acción es pública (sin restricciones de acceso)?`);
        } else if (response.status >= 500) {
            console.log('❌ ERROR DEL SERVIDOR (500)');
            console.log('\n💡 REVISA LOS LOGS DEL SERVIDOR DESTINO');
        } else {
            console.log(`⚠️  STATUS CODE NO ESTÁNDAR: ${response.status}`);
        }

        console.log('='.repeat(80));

    } catch (error) {
        console.log('\n' + '='.repeat(80));
        console.error('❌ ERROR AL CONECTAR');
        console.log('='.repeat(80));
        console.error(`   📛 Error: ${error.message}`);

        if (error.code === 'ECONNABORTED') {
            console.error('\n   ⏱️  TIMEOUT: El servidor no respondió en 10 segundos');
        } else if (error.code === 'ENOTFOUND') {
            console.error('\n   🌐 DNS ERROR: No se pudo resolver el dominio');
            console.error(`   - Verifica que ${config.APP_BASE_URL} sea correcto`);
        } else if (error.code === 'ECONNREFUSED') {
            console.error('\n   🚫 CONEXIÓN RECHAZADA: El servidor no acepta conexiones');
        }

        if (error.response) {
            console.error('\n   📋 Respuesta recibida:');
            console.error(`   - Status: ${error.response.status}`);
            console.error(`   - Data: ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
            console.error('\n   📡 Request enviado pero sin respuesta');
        }

        console.log('='.repeat(80));
        process.exit(1);
    }
}

// Ejecutar test
testConnection().then(() => {
    console.log('\n✅ Test completado\n');
    process.exit(0);
}).catch((error) => {
    console.error('\n❌ Error inesperado:', error);
    process.exit(1);
});
