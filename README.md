# 🤖 Binance P2P Scraper - Microservicio

Microservicio Node.js para extraer automáticamente precios USDT/VES desde Binance P2P y actualizar el sistema de inventario.

## 📋 Requisitos

- **Node.js** v16 o superior
- **npm** v7 o superior
- Conexión a internet estable
- Sistema de inventario en ejecución

## 🚀 Instalación

### 1. Instalar dependencias

```bash
cd microservice
npm install
```

### 2. Configurar variables de entorno

Copiar el archivo de ejemplo y configurar:

```bash
copy .env.example .env
```

Editar `.env` con tus valores:

```env
PORT=3000
APP_BASE_URL=http://localhost
UPDATE_RATE_ENDPOINT=/site/update-usdt-rate
P2P_URL=https://p2p.binance.com/trade/all-payments/USDT?fiat=VES
PAGE_TIMEOUT=30000
RETRY_ATTEMPTS=3
UPDATE_INTERVAL=5
```

## 🎯 Uso

### Modo Servidor (Recomendado)

Iniciar el servidor API:

```bash
npm start
```

El servidor estará disponible en `http://localhost:3000`

### Modo Desarrollo (con auto-reload)

```bash
npm run dev
```

### Prueba Manual (solo scraping)

```bash
npm run scrape
```

## 📡 Endpoints API

### 1. Health Check
```http
GET http://localhost:3000/health
```

**Respuesta:**
```json
{
  "status": "OK",
  "timestamp": "2025-12-02T17:00:00.000Z",
  "service": "Binance P2P Scraper",
  "version": "1.0.0"
}
```

### 2. Scrapear Precios
```http
GET http://localhost:3000/scrape
```

**Respuesta:**
```json
{
  "success": true,
  "timestamp": "2025-12-02T17:00:00.000Z",
  "data": {
    "bestPrice": 45.23,
    "avgPrice": 45.67,
    "maxPrice": 46.12,
    "totalOffers": 15,
    "prices": [...]
  }
}
```

### 3. Scrapear y Actualizar (Principal)
```http
POST http://localhost:3000/update-rate
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Precio actualizado correctamente",
  "data": {
    "newPrice": 45.23,
    "scrapeInfo": {...},
    "updateResponse": {...}
  }
}
```

### 4. Ver Configuración
```http
GET http://localhost:3000/config
```

## 🔧 Integración con el Sistema

El microservicio envía actualizaciones al endpoint de tu aplicación principal:

**POST** `http://localhost/site/update-usdt-rate`

**Payload:**
```json
{
  "precio_paralelo": 45.23,
  "observaciones": "Actualización automática desde Binance P2P. 15 ofertas analizadas.",
  "source": "binance-p2p-scraper",
  "metadata": {
    "avgPrice": 45.67,
    "maxPrice": 46.12,
    "totalOffers": 15,
    "timestamp": "2025-12-02T17:00:00.000Z"
  }
}
```

## 🧪 Pruebas

### Test completo con cURL:

**Bash / CMD:**
```bash
curl -X POST http://localhost:3000/update-rate
```

**PowerShell:**
```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/update-rate"
```

### Test solo scraping:

```bash
curl http://localhost:3000/scrape
```

## 📊 Logging

Los logs se muestran en la consola con el siguiente formato:

```
🚀 Iniciando scraping de Binance P2P...
📍 URL: https://p2p.binance.com/trade/all-payments/USDT?fiat=VES
🌐 Navegando a Binance P2P...
⏳ Esperando tarjetas de trading...
📊 Extrayendo precios...
✅ Extraídos 15 elementos
💰 Mejor precio: 45.23 VES
📈 Precio promedio: 45.67 VES
📉 Precio máximo: 46.12 VES
📤 Enviando a: http://localhost/site/update-usdt-rate
✅ Precio actualizado correctamente en la aplicación
```

## ⚙️ Configuración Avanzada

### Modificar selectores CSS

Si Binance cambia su estructura HTML, edita `config.js`:

```javascript
SELECTORS: {
  TRADING_CARD: '.nueva-clase-tarjeta',
  PRICE_CONTAINER: '.nuevo-selector-precio',
  PRICE_ALT: '[data-testid="nuevo-testid"]'
}
```

### Ajustar timeout

Si la conexión es lenta:

```javascript
PAGE_TIMEOUT: 60000, // 60 segundos
```

## ❌ Solución de Problemas

### Error: "No se pudieron extraer precios válidos"

**Solución:** Binance puede haber cambiado su HTML. Verifica los selectores en `config.js`

### Error: "Cannot connect to localhost"

**Solución:** Asegúrate de que Apache/PHP esté ejecutándose y el sistema de inventario accesible

### Error: "Puppeteer failed to launch"

**Solución en Windows:**
```bash
npm install --force
```

**Solución en Linux:**
```bash
sudo apt-get install -y chromium-browser
```

## 🔄 Automatización (Próximamente)

Para ejecutar automáticamente cada X minutos, puedes usar:

### Windows (Task Scheduler)
- Crear tarea programada que ejecute: `node e:\www\htdocs\inventario-app\microservice\server.js`

### Linux (Cron)
```bash
*/5 * * * * cd /path/to/microservice && npm start
```

## 📝 Notas Importantes

- ⚠️ **Respeta los términos de servicio de Binance**
- 🔒 **No abuses del scraping** - Usa intervalos de 5+ minutos
- 📊 **Monitorea los logs** para detectar cambios en la API
- 💾 **Guarda backups** de precios históricos
- 🔐 **Considera usar un token de autenticación** para el endpoint

## 🛠️ Stack Tecnológico

- **Express.js** - Framework web
- **Puppeteer** - Headless browser para scraping
- **Axios** - Cliente HTTP
- **dotenv** - Gestión de variables de entorno

## 📄 Licencia

MIT

## 👨‍💻 Autor

Sistema de Inventario - Integración Binance P2P
