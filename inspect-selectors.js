const puppeteer = require('puppeteer');

/*
*
* SCRIPT PARA INSPECCIONAR SELECTORES DE BINANCE P2P
*
*/

async function inspectSelectors() {
    console.log(' Inspeccionando selectores de Binance P2P...\n');

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    try {
        const page = await browser.newPage();

        console.log(' Navegando a Binance P2P...');
        await page.goto('https://p2p.binance.com/trade/all-payments/USDT?fiat=VES', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        console.log(' Esperando carga completa...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Buscar todos los elementos que contengan "Bs" (bolivares)
        const pricesInfo = await page.evaluate(() => {
            const results = {
                allText: [],
                possibleCards: [],
                recommendations: {}
            };

            // Buscar todos los elementos que contengan "Bs" o números con decimal
            const allElements = document.querySelectorAll('*');
            const pricePattern = /Bs\.?\s*[\d,\.]+/i;
            const numberPattern = /^\d+[\.,]\d+$/;

            allElements.forEach((el, index) => {
                const text = el.textContent || '';
                const innerText = el.innerText || '';

                // Si contiene "Bs" y número
                if (pricePattern.test(text) && text.length < 100) {
                    const classes = el.className;
                    const tagName = el.tagName.toLowerCase();
                    const parent = el.parentElement;
                    const parentClasses = parent ? parent.className : '';

                    results.allText.push({
                        text: text.trim().substring(0, 50),
                        tag: tagName,
                        classes: classes.toString().substring(0, 100),
                        parentTag: parent ? parent.tagName.toLowerCase() : '',
                        parentClasses: parentClasses.toString().substring(0, 100)
                    });
                }
            });

            // Buscar contenedores que parezcan tarjetas de ofertas
            const possibleCardSelectors = [
                'div[class*="advertise"]',
                'div[class*="order"]',
                'div[class*="item"]',
                'div[class*="card"]',
                'div[class*="list"]',
                '[class*="p2p"][class*="item"]',
                '[role="row"]',
                '[class*="trade"]',
                'tr',
                'tbody tr'
            ];

            possibleCardSelectors.forEach(selector => {
                try {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0 && elements.length < 100) {
                        // Verificar si alguno contiene precios
                        let hasPrice = false;
                        elements.forEach(el => {
                            if (pricePattern.test(el.textContent)) {
                                hasPrice = true;
                            }
                        });

                        if (hasPrice) {
                            results.possibleCards.push({
                                selector: selector,
                                count: elements.length,
                                sample: elements[0].className.toString().substring(0, 150)
                            });
                        }
                    }
                } catch (e) {
                    // Ignorar errores de selector inválido
                }
            });

            return results;
        });

        console.log('\n RESULTADOS DE LA INSPECCIÓN:\n');
        console.log('='.repeat(80));

        console.log('\n  ELEMENTOS QUE CONTIENEN PRECIOS (Bs):');
        console.log('-'.repeat(80));
        pricesInfo.allText.slice(0, 10).forEach((item, i) => {
            console.log(`\n  [${i + 1}] Texto: "${item.text}"`);
            console.log(`      Tag: <${item.tag}> | Classes: ${item.classes || '(ninguna)'}`);
            console.log(`      Parent: <${item.parentTag}> | Parent Classes: ${item.parentClasses || '(ninguna)'}`);
        });

        console.log('\n\n  POSIBLES CONTENEDORES DE TARJETAS:');
        console.log('-'.repeat(80));
        pricesInfo.possibleCards.forEach((item, i) => {
            console.log(`\n  [${i + 1}] Selector: ${item.selector}`);
            console.log(`      Cantidad: ${item.count} elementos`);
            console.log(`      Clases ejemplo: ${item.sample}`);
        });

        // Ahora vamos a extraer los precios usando el mejor selector encontrado
        console.log('\n\n  EXTRACCIÓN DE PRECIOS (usando mejor selector):');
        console.log('-'.repeat(80));

        const bestSelector = pricesInfo.possibleCards.length > 0 ?
            pricesInfo.possibleCards[0].selector :
            'div';

        const extractedPrices = await page.evaluate((selector) => {
            const results = [];
            const elements = document.querySelectorAll(selector);
            const pricePattern = /Bs\.?\s*([\d,\.]+)/i;

            elements.forEach((el, index) => {
                const text = el.textContent || '';
                const match = text.match(pricePattern);

                if (match && match[1]) {
                    // Buscar específicamente el elemento del precio
                    const priceElements = el.querySelectorAll('*');
                    let foundPriceElement = null;

                    priceElements.forEach(pe => {
                        const peText = pe.textContent || '';
                        if (pricePattern.test(peText) && peText.length < 30) {
                            foundPriceElement = {
                                tag: pe.tagName.toLowerCase(),
                                classes: pe.className.toString(),
                                text: peText.trim()
                            };
                        }
                    });

                    results.push({
                        index: index,
                        rawPrice: match[1],
                        fullText: text.substring(0, 100),
                        priceElement: foundPriceElement
                    });
                }
            });

            return results.slice(0, 15); // Primeros 15
        }, bestSelector);

        if (extractedPrices.length > 0) {
            console.log(`\n Encontrados ${extractedPrices.length} precios:`);
            extractedPrices.forEach((item, i) => {
                console.log(`\n  [${i + 1}] Precio: ${item.rawPrice} Bs`);
                if (item.priceElement) {
                    console.log(`      Elemento: <${item.priceElement.tag}>`);
                    console.log(`      Classes: ${item.priceElement.classes.substring(0, 80)}`);
                    console.log(`      Texto completo: "${item.priceElement.text}"`);
                }
            });
        }

        console.log('\n' + '='.repeat(80));
        console.log('\n Inspección completada\n');

    } finally {
        await browser.close();
    }
}

inspectSelectors()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(' Error:', error.message);
        process.exit(1);
    });
