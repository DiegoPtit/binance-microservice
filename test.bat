@echo off
echo.
echo ========================================
echo   TEST DEL MICROSERVICIO BINANCE P2P
echo ========================================
echo.

REM Test 1: Health Check
echo [1/4] Probando Health Check...
curl -s http://localhost:3000/health
echo.
echo.

timeout /t 2 /nobreak >nul

REM Test 2: Ver configuración
echo [2/4] Probando endpoint de configuración...
curl -s http://localhost:3000/config
echo.
echo.

timeout /t 2 /nobreak >nul

REM Test 3: Scraping
echo [3/4] Probando scraping (esto puede tomar 10-30 segundos)...
curl -s http://localhost:3000/scrape
echo.
echo.

timeout /t 2 /nobreak >nul

REM Test 4: Update completo
echo [4/4] Probando actualización completa...
curl -X POST -s http://localhost:3000/update-rate
echo.
echo.

echo ========================================
echo   TESTS COMPLETADOS
echo ========================================
echo.
pause
