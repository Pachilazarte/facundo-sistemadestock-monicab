@echo off
REM Genera css/tailwind.css (estilos ya compilados). Correr cada vez que se agreguen o cambien clases de Tailwind
REM en index.html o js\*.js, ANTES de hacer commit/push. Necesita Node.js e internet en ESTA PC (no en la del cliente).
cd /d "%~dp0"
call npx --yes tailwindcss@3.4.16 -c tailwind.config.js -i src/tailwind.input.css -o css/tailwind.css --minify
if errorlevel 1 (echo ERROR al construir el CSS & exit /b 1)
echo Listo: css\tailwind.css actualizado.
