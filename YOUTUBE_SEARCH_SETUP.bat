@echo off
REM QUICK START: YouTube Search Component Setup (Windows)
REM Run this script to verify and setup the YouTube search component

setlocal enabledelayedexpansion

cls
echo.
echo ================================
echo YouTube Search Component Setup
echo ================================
echo.

REM Check if Angular CLI is installed
echo 07 Checking Angular CLI...
where ng >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Angular CLI found
) else (
    echo [ERROR] Angular CLI not found. Install with: npm install -g @angular/cli
    pause
    exit /b 1
)

REM Check if Node modules exist
echo.
echo 02 Checking dependencies...
if exist "node_modules" (
    echo [OK] node_modules found
) else (
    echo [WARN] Installing dependencies...
    call npm install
)

REM Check if environment file exists
echo.
echo 03 Checking environment configuration...
if exist "src\environments\environment.ts" (
    findstr /M "youtubeApiKey" "src\environments\environment.ts" >nul
    if !ERRORLEVEL! EQU 0 (
        echo [OK] Environment file configured
        echo     Note: Make sure youtubeApiKey is set in src\environments\environment.ts
    ) else (
        echo [WARN] youtubeApiKey not found in environment.ts
        echo       Add: youtubeApiKey: 'YOUR_API_KEY_HERE'
    )
) else (
    echo [ERROR] environment.ts not found
)

REM Check if component files exist
echo.
echo 04 Checking component files...

set "FILES[0]=src\app\core\services\youtube-quota-optimized.service.ts"
set "FILES[1]=src\app\features\youtube-ai\search\search-simple.component.ts"
set "FILES[2]=src\app\core\services\youtube-quota-optimized.service.spec.ts"
set "FILES[3]=src\app\features\youtube-ai\search\search-simple.component.spec.ts"

for /L %%i in (0,1,3) do (
    if exist "!FILES[%%i]!" (
        echo [OK] !FILES[%%i]!
    ) else (
        echo [ERROR] !FILES[%%i]! not found
    )
)

echo.
echo ================================
echo Next Steps
echo ================================
echo.
echo 1. Get YouTube API Key:
echo    - Visit: https://console.cloud.google.com
echo    - Create a project
echo    - Enable: YouTube Data API v3
echo    - Create: API Key (type: Browser)
echo.
echo 2. Add API Key to environment:
echo    - Edit: src\environments\environment.ts
echo    - Set: youtubeApiKey: 'YOUR_KEY_HERE'
echo.
echo 3. Start the application:
echo    ng serve
echo.
echo 4. Navigate to search component:
echo    - Route: /youtube-search
echo    - Or import: YoutubeSearchSimpleComponent
echo.
echo 5. Run tests:
echo    ng test --include="**/youtube-quota-optimized.service.spec.ts"
echo.
echo ================================
echo Documentation
echo ================================
echo.
echo Main README:
echo   src\app\features\youtube-ai\YOUTUBE_SEARCH_README.md
echo.
echo Integration Guide:
echo   src\app\features\youtube-ai\INTEGRATION_GUIDE.md
echo.
echo ================================
echo Monitor Quota Usage
echo ================================
echo.
echo Google Cloud Console:
echo   1. Go to: https://console.cloud.google.com
echo   2. Select your project
echo   3. Navigate to: YouTube Data API v3
echo   4. Click: Quotas
echo   5. Monitor: 'Queries per day'
echo.
echo Free Tier: 10,000 units/day
echo With caching: ~5,000-6,000 units/day (50%% savings)
echo.
echo [OK] Setup complete!
echo.
pause
