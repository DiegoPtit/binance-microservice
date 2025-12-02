# Copiar archivo de ejemplo de variables de entorno
if not exist .env (
    echo 📄 Creando archivo .env desde .env.example...
    copy .env.example .env
    echo ✅ Archivo .env creado. Por favor configura tus valores antes de continuar.
    echo.
    pause
) else (
    echo ✅ Archivo .env ya existe
    echo.
)

# Instalar dependencias si no existen
if not exist node_modules (
    echo 📦 Instalando dependencias...
    call npm install
    echo.
) else (
    echo ✅ Dependencias ya instaladas
    echo.
)

echo 🚀 Iniciando servidor...
echo.
echo 💡 Endpoints disponibles:
echo    - GET  http://localhost:3000/health
echo    - GET  http://localhost:3000/scrape
echo    - POST http://localhost:3000/update-rate
echo    - GET  http://localhost:3000/config
echo.
echo 🛑 Presiona Ctrl+C para detener el servidor
echo.

call npm start
