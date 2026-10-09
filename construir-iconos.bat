@echo off
REM Regenera el conjunto de iconos de index.html (solo los que se usan). Correr cuando se agregue un icono nuevo.
cd /d "%~dp0"
node tools\construir-iconos.js
if errorlevel 1 (echo ERROR al construir los iconos & exit /b 1)
