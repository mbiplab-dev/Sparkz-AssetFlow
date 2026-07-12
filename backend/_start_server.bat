@echo off
cd /d C:\Users\Rishabh\Desktop\web\hackathon\Sparkz-AssetFlow\backend
set POSTGRES_PORT=5433
start "assetflow-backend" /MIN .\.venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000
