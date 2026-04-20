# Guía de Solución de Problemas - Joselito Cloud

Si la aplicación no carga o no muestra datos, sigue estos pasos en orden:

## 1. Verificar Variables de Entorno (CRÍTICO)
La aplicación requiere dos claves de Supabase para funcionar con la base de datos en la nube.
Ve al panel de **"Environment Variables"** en Google AI Studio y asegúrate de tener:

*   `VITE_SUPABASE_URL`: La URL de tu proyecto de Supabase (ej: `https://xyz.supabase.co`)
*   `VITE_SUPABASE_ANON_KEY`: La clave "anon public" de tu proyecto.

**Si no están configuradas:** La aplicación entrará en **Modo Offline** automáticamente. Verás un banner naranja en la parte superior. En este modo, los datos son temporales y se guardan solo en tu navegador.

## 2. Problemas de Conexión con Supabase
Si has confirmado que las claves son correctas pero no ves datos:
*   **Estado de Supabase:** Comprueba [status.supabase.com](https://status.supabase.com/) para ver si hay una caída global.
*   **Bloqueadores de Anuncios:** Algunos bloqueadores (uBlock, AdBlock) pueden bloquear las peticiones a dominios de Supabase. Prueba a desactivarlos o usar una ventana de incógnito.
*   **Red Corporativa:** Si estás en una oficina, el firewall podría estar bloqueando el puerto de Supabase. Prueba con una conexión diferente (ej: datos móviles).

## 3. Limpiar el Estado de la Aplicación
Si la pantalla se queda en "Sincronizando..." o "Iniciando...":
1.  Abre la consola del navegador (F12 -> Console).
2.  Escribe `localStorage.clear()` y pulsa Enter.
3.  Recarga la página (Ctrl + F5).

## 4. Diagnóstico Visual
He añadido herramientas de diagnóstico en la pantalla de carga:
*   **Backend Ready:** Debe mostrar ✅. Si muestra ❌, el servidor interno tiene un problema.
*   **Supabase Config:** Debe mostrar ✅. Si muestra ❌, revisa el Paso 1.

## 5. Forzar Modo Offline
Si Supabase está caído y quieres usar la app de todos modos:
La aplicación detectará el fallo de conexión tras 10 segundos y te permitirá trabajar de forma local. Los cambios que hagas en modo offline **no se sincronizarán** con la nube hasta que la conexión se restablezca.

---
*Si el problema persiste tras estos pasos, por favor copia cualquier error rojo que veas en la consola (F12) y envíamelo.*
