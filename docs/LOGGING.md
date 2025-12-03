# Sistema de Logging

Este microservicio incluye un sistema de logging automático que registra cada ejecución de los endpoints en archivos de texto.

## Ubicación de los Logs

Los logs se guardan en la carpeta `logs/` en la raíz del proyecto. Esta carpeta se crea automáticamente al ejecutar cualquier endpoint.

## Formato de Archivos

Los archivos de log siguen el formato:
```
{endpoint}_{YYYY-MM-DD}.log
```

**Ejemplos:**
- `health_2025-12-02.log`
- `scrape_2025-12-02.log`
- `get-averages_2025-12-02.log`
- `update-rate_2025-12-02.log`
- `config_2025-12-02.log`

## Contenido de los Logs

Cada entrada de log contiene:

### Para requests exitosos:
```
================================================================================
[2025-12-02 20:50:16] UPDATE-RATE
================================================================================
REQUEST:
  Method: POST
  IP: ::1
  
PROCESO:
  Scraping: Exitoso - Mejor precio: 52.50 VES
  Ofertas analizadas: 15
  URL destino: https://example.com/api/update
  Duración request: 1234ms
  
RESULTADO:
  Success: SÍ
  Status: 200
  Data: Precio actualizado a 52.50 VES
  
DURACIÓN: 2500ms
================================================================================
```

### Para requests con error:
```
================================================================================
[2025-12-02 20:50:16] UPDATE-RATE
================================================================================
REQUEST:
  Method: POST
  IP: ::1
  
ERROR:
  Message: Timeout de conexión
  Type: ECONNABORTED
  Code: ECONNABORTED
  Stack: Error: Timeout de conexión at... [truncado]
  
RESULTADO:
  Success: NO
  Status: 500
  
DURACIÓN: 15000ms
================================================================================
```

## Características

1. **Automático**: Cada endpoint genera logs sin configuración adicional
2. **Conciso**: La información se trunca a 500 caracteres por defecto para mantener los archivos manejables
3. **Organizado**: Un archivo por endpoint por día
4. **Diagnóstico**: Incluye toda la información necesaria para diagnosticar problemas:
   - Timestamp exacto
   - IP del cliente
   - Parámetros de la petición
   - Detalles del proceso
   - Resultado y status code
   - Duración total y parcial
   - Stack traces en caso de error

## Rotación de Logs

Los logs se rotan automáticamente por día. Cada día se crea un nuevo archivo, manteniendo los logs históricos organizados por fecha.

## Limpieza de Logs

Para limpiar logs antiguos, simplemente elimina los archivos `.log` de la carpeta `logs/` que ya no necesites:

```bash
# En Windows PowerShell
Remove-Item logs/*.log -Force

# Mantener solo los últimos 7 días (ejemplo manual)
# Revisar y eliminar archivos con fecha anterior a la deseada
```

## Tamaño de Logs

El sistema trunca automáticamente:
- Datos largos a 400-500 caracteres
- Parámetros a 300 caracteres
- Stack traces a 500 caracteres

Esto asegura que los archivos de log se mantengan pequeños y manejables.

## Endpoints Logueados

Todos los endpoints generan logs:
- ✅ `GET /health` - Checks de salud del servicio
- ✅ `GET /scrape` - Scraping manual de precios
- ✅ `GET /get-averages` - Consultas de promedios
- ✅ `POST /update-rate` - Actualización de precios (el más importante)
- ✅ `GET /config` - Consultas de configuración

## Ejemplo de Uso

1. Ejecuta un endpoint:
```bash
curl -X POST http://localhost:3000/update-rate
```

2. Revisa el log generado:
```bash
# En Windows
type logs\update-rate_2025-12-02.log

# O abre el archivo en tu editor favorito
code logs\update-rate_2025-12-02.log
```

## Troubleshooting

### Los logs no se generan
- Verifica que el módulo `logger.js` exista
- Comprueba los permisos de escritura en la carpeta del proyecto
- Revisa la consola para errores del logger

### Logs muy grandes
- El sistema trunca automáticamente, pero si los archivos crecen demasiado:
  - Implementa rotación por tamaño (no incluida por defecto)
  - Limpia logs antiguos periódicamente

### No encuentro un log específico
- Los logs se nombran por endpoint y fecha
- Verifica que estés buscando el archivo correcto
- Recuerda que `/update-rate` se loguea como `update-rate_YYYY-MM-DD.log`
