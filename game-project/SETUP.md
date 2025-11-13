# 🎮 Configuración del Frontend

## 📋 Pasos para configurar el frontend con MongoDB local

### 1. **Crear archivo de variables de entorno**

```bash
# En la carpeta game-project:
copy .env.example .env
```

### 2. **Configurar variables de entorno**

Edita el archivo `.env` con:

```env
# Backend API URL - Para MongoDB local
VITE_API_URL=http://localhost:3001

# Backend URL para WebSockets (multiplayer)
VITE_BACKEND_URL=http://localhost:3001

# Entorno de desarrollo
VITE_NODE_ENV=development
```

### 3. **Instalar dependencias**

```bash
npm install
```

### 4. **Iniciar el frontend**

```bash
npm run dev
```

## 🔗 **Configuración actual del frontend**

El frontend ya está preparado para:

- ✅ **Cargar monedas dinámicamente** desde `VITE_API_URL/api/blocks?level=X`
- ✅ **Autenticación JWT** con `VITE_API_URL/api/auth/login` y `/register`
- ✅ **Fallback a archivos locales** si no puede conectar con el backend
- ✅ **Modo offline** si no hay autenticación
- ✅ **Multiplayer** con WebSockets en `VITE_BACKEND_URL`

## 🚀 **Orden de inicio**

1. **Backend primero:**
   ```bash
   cd ../backend
   npm run dev
   ```

2. **Frontend después:**
   ```bash
   cd game-project
   npm run dev
   ```

## 🔍 **Verificar que funciona**

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Test API: http://localhost:3001/api/blocks/ping

El juego debe:
1. Mostrar pantalla de login/registro
2. Al autenticarse, cargar monedas desde MongoDB
3. Si falla la conexión, usar archivos JSON locales como fallback
