@echo off
REM Voice Emotion Detection - launcher for Windows
REM Usage: double-click this file, or run start.bat from a terminal
setlocal
cd /d "%~dp0"

set PORT=8000
set URL=http://localhost:%PORT%

if exist "venv\Scripts\uvicorn.exe" goto run

echo First run: creating virtual environment ^(this can take a few minutes^)...
where py >nul 2>nul
if errorlevel 1 goto try_python
py -3 -m venv venv
if errorlevel 1 goto try_python
goto install

:try_python
python -m venv venv
if errorlevel 1 (
    echo Error: Python 3 was not found. Install Python 3.12 from python.org and try again.
    pause
    exit /b 1
)

:install
venv\Scripts\python -m pip install --upgrade pip
venv\Scripts\pip install -r requirements.txt

:run
echo Starting Voice Emotion Detection server on %URL% ...
start "Voice Emotion Detection Server" venv\Scripts\uvicorn main:app --host 127.0.0.1 --port %PORT%

REM Wait until the server answers (model loading takes a few seconds)
:wait_loop
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing %URL% -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>nul
if errorlevel 1 (
    timeout /t 1 /nobreak >nul
    goto wait_loop
)

start "" %URL%
echo Server is running at %URL%  ^(close the server window to stop^)
endlocal
