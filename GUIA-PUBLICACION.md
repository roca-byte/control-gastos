# Publicar Control de Gastos en GitHub Pages

La app son archivos sueltos (HTML, CSS y JavaScript): no hay que compilar nada. GitHub Pages los
publica gratis en `https://<tu-usuario>.github.io/control-gastos/`.

## 1. Subir los archivos

El repo `control-gastos` ya existe. Los archivos de la app tienen que estar en la rama `main`:

```
index.html  manifest.json  sw.js
css/styles.css
js/reglas.js  js/calculadora.js  js/store.js  js/grafico.js  js/resumen.js  js/app.js
icons/icon.svg  icons/icon-192.png  icons/icon-512.png
```

Desde la web de GitHub (también anda desde el celular, en modo escritorio):
**Add file → Upload files**, arrastrás los archivos respetando las carpetas, y **Commit changes**.

## 2. Activar GitHub Pages

1. En el repo: **Settings → Pages**.
2. En **Source** elegí **Deploy from a branch**.
3. Branch: **main**, carpeta **/ (root)** → **Save**.
4. Esperá uno o dos minutos y entrá a `https://<tu-usuario>.github.io/control-gastos/`.

## 3. Instalarla en el celular

1. Abrí esa dirección en **Chrome** (Android) o **Safari** (iPhone).
2. Android: menú ⋮ → **Instalar app** (o "Agregar a pantalla principal").
   iPhone: botón Compartir → **Agregar a inicio**.
3. Abrila una vez con internet. Desde ahí funciona sin conexión.

## 4. Actualizar

Cada vez que cambia un archivo de la app hay que **subir el número de `VERSION` en `sw.js`**
(`control-gastos-v1` → `v2`…) y subir **siempre `sw.js`** junto con los archivos cambiados.
Así el celular se entera de que hay una versión nueva. La próxima vez que la abra con internet
baja todo; **los datos anotados no se tocan**.

En **Más**, al pie, se ve qué versión tiene instalada el celular.

## Problemas comunes

- **No veo los cambios:** ¿subiste `sw.js` con la versión nueva? Cerrá la app del todo y abrila
  de nuevo con internet.
- **Página 404:** esperá unos minutos después de activar Pages, y revisá que `index.html` esté en
  la raíz del repo (no dentro de una carpeta).
- **Se perdieron los datos:** pasa si se borran los datos del navegador o se desinstala la app.
  Por eso está la copia de seguridad (Más → Guardar copia).
