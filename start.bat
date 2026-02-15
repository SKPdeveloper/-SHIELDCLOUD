@echo off
chcp 65001 >nul 2>&1
title ShieldCloud

echo ========================================
echo        SHIELDCLOUD LAUNCHER
echo ========================================
echo.

:: Check Docker
docker --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker not found. Install Docker Desktop.
    pause
    exit /b 1
)

:: Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running. Start Docker Desktop.
    pause
    exit /b 1
)

echo [OK] Docker found
echo.

:: Menu
echo Select action:
echo   1 - Start (build and run)
echo   2 - Stop
echo   3 - Restart
echo   4 - View logs
echo   5 - Reset demo (unblock users)
echo   6 - Full rebuild (no cache)
echo   7 - Stop and remove data
echo   0 - Exit
echo.

set /p choice="Enter choice: "

if "%choice%"=="1" goto start
if "%choice%"=="2" goto stop
if "%choice%"=="3" goto restart
if "%choice%"=="4" goto logs
if "%choice%"=="5" goto reset
if "%choice%"=="6" goto rebuild
if "%choice%"=="7" goto clean
if "%choice%"=="0" goto end

echo Invalid choice
pause
goto end

:start
echo.
echo [INFO] Starting ShieldCloud...
docker compose up -d --build
if errorlevel 1 (
    echo [ERROR] Failed to start
    pause
    goto end
)
echo.
echo ========================================
echo   ShieldCloud started successfully!
echo ========================================
echo.
echo   Frontend:    http://localhost:3000
echo   Backend:     http://localhost:5000
echo   MinIO:       http://localhost:9001
echo.
echo   Login: admin / admin123
echo          user  / user123
echo.
echo ========================================
pause
goto end

:stop
echo.
echo [INFO] Stopping ShieldCloud...
docker compose down
echo [OK] Stopped
pause
goto end

:restart
echo.
echo [INFO] Restarting ShieldCloud...
docker compose down
docker compose up -d --build
echo [OK] Restarted
echo.
echo   Frontend: http://localhost:3000
pause
goto end

:logs
echo.
echo [INFO] Showing logs (Ctrl+C to exit)...
docker compose logs -f
goto end

:reset
echo.
echo [INFO] Resetting demo mode...
curl -X POST http://localhost:5000/api/users/demo-reset 2>nul
if errorlevel 1 (
    echo [ERROR] Backend not available
) else (
    echo [OK] Demo reset complete
)
pause
goto end

:rebuild
echo.
echo [INFO] Full rebuild (this may take a while)...
docker compose down
docker compose build --no-cache
docker compose up -d
echo [OK] Rebuild complete
echo.
echo   Frontend: http://localhost:3000
pause
goto end

:clean
echo.
echo [WARNING] This will remove all data!
set /p confirm="Are you sure? (y/n): "
if /i "%confirm%"=="y" (
    docker compose down -v
    echo [OK] Stopped and removed all data
) else (
    echo Cancelled
)
pause
goto end

:end
