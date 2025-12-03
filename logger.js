const fs = require('fs');
const path = require('path');

// Directorio de logs
const LOGS_DIR = path.join(__dirname, 'logs');

// Crear directorio de logs si no existe
if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
}

/**
 * Formatea una fecha para nombre de archivo
 * @returns {string} Formato: YYYY-MM-DD
 */
function getDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Formatea timestamp completo
 * @returns {string} Formato: YYYY-MM-DD HH:MM:SS
 */
function getTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Genera el nombre del archivo de log
 * @param {string} endpoint - Nombre del endpoint (ej: 'update-rate')
 * @returns {string} Path completo al archivo de log
 */
function getLogFilePath(endpoint) {
    const dateStr = getDateString();
    const sanitizedEndpoint = endpoint.replace(/\//g, '-');
    return path.join(LOGS_DIR, `${sanitizedEndpoint}_${dateStr}.log`);
}

/**
 * Trunca strings largos para mantener logs concisos
 * @param {any} data - Datos a truncar
 * @param {number} maxLength - Longitud máxima
 * @returns {string}
 */
function truncate(data, maxLength = 500) {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + `... [${str.length - maxLength} más]`;
}

/**
 * Escribe un log para un endpoint específico
 * @param {string} endpoint - Nombre del endpoint
 * @param {object} logData - Datos a loguear
 */
function writeLog(endpoint, logData) {
    try {
        const filePath = getLogFilePath(endpoint);
        const timestamp = getTimestamp();

        let logEntry = `\n${'='.repeat(80)}\n`;
        logEntry += `[${timestamp}] ${endpoint.toUpperCase()}\n`;
        logEntry += `${'='.repeat(80)}\n`;

        // Agregar información según el tipo de log
        if (logData.request) {
            logEntry += `REQUEST:\n`;
            logEntry += `  Method: ${logData.request.method || 'N/A'}\n`;
            logEntry += `  IP: ${logData.request.ip || 'N/A'}\n`;
            if (logData.request.params && Object.keys(logData.request.params).length > 0) {
                logEntry += `  Params: ${truncate(logData.request.params, 300)}\n`;
            }
            if (logData.request.body && Object.keys(logData.request.body).length > 0) {
                logEntry += `  Body: ${truncate(logData.request.body, 300)}\n`;
            }
        }

        if (logData.process) {
            logEntry += `\nPROCESO:\n`;
            Object.keys(logData.process).forEach(key => {
                logEntry += `  ${key}: ${truncate(logData.process[key], 400)}\n`;
            });
        }

        if (logData.result) {
            logEntry += `\nRESULTADO:\n`;
            logEntry += `  Success: ${logData.result.success ? 'SÍ' : 'NO'}\n`;
            logEntry += `  Status: ${logData.result.status || 'N/A'}\n`;
            if (logData.result.data) {
                logEntry += `  Data: ${truncate(logData.result.data, 400)}\n`;
            }
        }

        if (logData.error) {
            logEntry += `\nERROR:\n`;
            logEntry += `  Message: ${logData.error.message}\n`;
            logEntry += `  Type: ${logData.error.type || logData.error.name || 'Unknown'}\n`;
            if (logData.error.code) {
                logEntry += `  Code: ${logData.error.code}\n`;
            }
            if (logData.error.stack) {
                logEntry += `  Stack: ${truncate(logData.error.stack, 500)}\n`;
            }
        }

        if (logData.duration !== undefined) {
            logEntry += `\nDURACIÓN: ${logData.duration}ms\n`;
        }

        logEntry += `${'='.repeat(80)}\n`;

        // Escribir al archivo (append)
        fs.appendFileSync(filePath, logEntry, 'utf8');

    } catch (error) {
        console.error(`Error escribiendo log para ${endpoint}:`, error.message);
    }
}

/**
 * Helper para crear logger específico para un endpoint
 * @param {string} endpoint - Nombre del endpoint
 * @returns {object} Objeto con métodos de logging
 */
function createEndpointLogger(endpoint) {
    return {
        log: (logData) => writeLog(endpoint, logData),

        logRequest: (req) => {
            return {
                method: req.method,
                ip: req.ip || req.connection.remoteAddress,
                params: req.params || {},
                query: req.query || {},
                body: req.body || {}
            };
        },

        logSuccess: (req, result, duration) => {
            writeLog(endpoint, {
                request: {
                    method: req.method,
                    ip: req.ip || req.connection.remoteAddress,
                    params: req.params,
                    body: req.body
                },
                result: {
                    success: true,
                    status: result.status || 200,
                    data: result.data || result
                },
                duration
            });
        },

        logError: (req, error, duration) => {
            writeLog(endpoint, {
                request: {
                    method: req.method,
                    ip: req.ip || req.connection.remoteAddress,
                    params: req.params,
                    body: req.body
                },
                error: {
                    message: error.message,
                    name: error.name,
                    code: error.code,
                    stack: error.stack
                },
                result: {
                    success: false,
                    status: error.response?.status || 500
                },
                duration
            });
        }
    };
}

module.exports = {
    writeLog,
    createEndpointLogger,
    truncate,
    LOGS_DIR
};
