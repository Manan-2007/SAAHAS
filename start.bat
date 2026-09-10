@echo off
REM Starts the voice emotion backend and the SAHAAS frontend together.
REM Usage: double-click, or run start.bat -> open http://localhost:3000
setlocal
cd /d "%~dp0"

if exist "backend\venv\Scripts\uvicorn.exe" goto frontend_deps
echo First run: creating the backend virtual environment ^(this can take a few minutes^)...
py -3 -m venv backend\venv || python -m venv backend\venv
if errorlevel 1 (
    echo Error: Python 3.12 is required for the backend.
    pause
    exit /b 1
)
backend\venv\Scripts\python -m pip install --upgrade pip
backend\venv\Scripts\pip install -r backend\requirements.txt

:frontend_deps
if not exist "frontend\node_modules" (
    echo First run: installing frontend dependencies...
    pushd frontend
    call npm install
    popd
)

start "Voice Emotion Backend" cmd /k "cd /d %~dp0backend && venv\Scripts\uvicorn main:app --host 127.0.0.1 --port 8000"

cd frontend
call npm run dev
endlocal
