# 🎮 CyberRunner - Juego 3D con Autenticación JWT y MongoDB

Un videojuego 3D completo desarrollado con **React + Three.js** en el frontend y **Node.js + Express + MongoDB** en el backend. Incluye sistema de autenticación JWT, puntuaciones dinámicas, multijugador en tiempo real y gestión de niveles con cantidad dinámica de monedas.

## 🚀 Características Principales

### 🔐 **Sistema de Autenticación Completo**
- **Registro y Login** con JWT (JSON Web Tokens)
- **Interfaz futurista** con tema cyberpunk/gaming
- **Sesiones persistentes** en localStorage
- **Middleware de autenticación** en todas las rutas protegidas

### 🎯 **Gameplay Dinámico**
- **Cantidad dinámica de monedas** por nivel (consultada desde MongoDB)
- **Sistema de puntuaciones** guardado en base de datos
- **Leaderboard global** con mejores jugadores
- **3 niveles** con diferentes cantidades de monedas y obstáculos

### 🌐 **Backend Robusto**
- **API RESTful** con Express.js
- **Base de datos MongoDB** para usuarios, puntuaciones y bloques
- **Autenticación JWT** con middleware personalizado
- **Endpoints dinámicos** para conteo de monedas por nivel

### 🎮 **Frontend Moderno**
- **React + Vite** para desarrollo rápido
- **Three.js** para gráficos 3D
- **Cannon-es** para física realista
- **Diseño responsive** adaptado a móviles

---

## 🏗️ Arquitectura del Sistema

### **Frontend (game-project/)**
```
src/
├── api/                    # Clientes HTTP para backend
│   ├── auth.js            # Login/registro
│   ├── scores.js          # Puntuaciones
│   ├── blocks.js          # Bloques y monedas
│   └── client.js          # Cliente base con JWT
├── components/
│   ├── LoginOverlay.jsx   # Interfaz de autenticación
│   └── LeaderboardPanel.jsx # Tabla de puntuaciones
├── Experience/            # Motor 3D del juego
│   ├── World/            # Objetos del mundo
│   ├── Utils/            # Utilidades (física, tracker)
│   └── sources.js        # Recursos 3D
└── utils/
    └── session.js        # Gestión de tokens JWT
```

### **Backend (backend/)**
```
├── controllers/          # Lógica de negocio
│   ├── authController.js # Autenticación JWT
│   ├── scoreController.js # Puntuaciones
│   └── blockController.js # Bloques y monedas
├── models/              # Esquemas de MongoDB
│   ├── User.js         # Modelo de usuario
│   ├── Score.js        # Modelo de puntuación
│   └── Block.js        # Modelo de bloque/moneda
├── routes/             # Rutas de la API
├── middleware/         # Middleware de autenticación
└── scripts/           # Scripts de migración
```

---

## 🔧 Flujo de Funcionamiento

### **1. Autenticación**
```mermaid
Usuario → LoginOverlay → API /auth/register → MongoDB → JWT Token → LocalStorage
```

### **2. Carga de Nivel**
```mermaid
World.loadLevel() → API /blocks/coin-count → MongoDB → Cantidad Dinámica → Spawn Portal
```

### **3. Gameplay**
```mermaid
Recolectar Monedas → Contador Dinámico → Portal Aparece → Completar Nivel → Guardar Score
```

### **4. Puntuaciones**
```mermaid
GameTracker → API /scores → MongoDB → Leaderboard Actualizado
```

## 📋 Requisitos del Sistema

- **Node.js** 18+ y **npm** 9+
- **MongoDB** (local o MongoDB Atlas)
- **Navegador moderno** con soporte para WebGL
- **Opcional:** Blender para crear nuevos niveles

---

## ⚡ Instalación Rápida

### **1. Clonar el repositorio**
```bash
git clone <repository-url>
cd Video_juego
```

### **2. Instalar dependencias del backend**
```bash
cd backend
npm install
```

### **3. Instalar dependencias del frontend**
```bash
cd ../game-project
npm install
```

### **4. Configurar variables de entorno**

**Backend (`backend/.env`):**
```env
PORT=3001
MONGO_URI=mongodb://localhost:27017/gamedb
JWT_SECRET=mi-clave-jwt-super-secreta-cambiala-por-algo-muy-seguro-123456
```

**Frontend (`game-project/.env`):**
```env
VITE_API_URL=http://localhost:3001
VITE_BACKEND_URL=http://localhost:3001
```

### **5. Inicializar la base de datos**
```bash
cd backend
npm run migrate
```

---

## 🚀 Ejecutar en Desarrollo

### **Terminal 1 - Backend**
```bash
cd backend
npm run dev
# ✅ Servidor corriendo en http://localhost:3001
```

### **Terminal 2 - Frontend**
```bash
cd game-project
npm run dev
# ✅ Juego disponible en http://localhost:5173
```

### **Para desarrollo en LAN:**
```bash
cd game-project
npm run dev -- --host
# Actualiza VITE_API_URL con la IP del backend
```

## 📡 API Endpoints

### **🔐 Autenticación**
| Método | Endpoint | Descripción | Autenticación |
|--------|----------|-------------|---------------|
| `POST` | `/api/auth/register` | Registrar nuevo usuario | ❌ |
| `POST` | `/api/auth/login` | Iniciar sesión | ❌ |

**Ejemplo de registro:**
```json
POST /api/auth/register
{
  "username": "CyberWarrior",
  "email": "warrior@cybernet.io",
  "password": "mi-password-seguro"
}
```

### **🎯 Puntuaciones**
| Método | Endpoint | Descripción | Autenticación |
|--------|----------|-------------|---------------|
| `POST` | `/api/scores` | Guardar puntuación | ✅ JWT |
| `GET` | `/api/scores?limit=10` | Obtener leaderboard | ❌ |

### **🪙 Bloques y Monedas**
| Método | Endpoint | Descripción | Autenticación |
|--------|----------|-------------|---------------|
| `GET` | `/api/blocks?level=1` | Obtener bloques por nivel | ❌ |
| `GET` | `/api/blocks/coin-count?level=1` | Contar monedas por nivel | ❌ |
| `POST` | `/api/blocks` | Crear bloque | ❌ |
| `POST` | `/api/blocks/batch` | Crear múltiples bloques | ❌ |

### **🌐 WebSocket (Socket.io)**
**Puerto:** 3001 (mismo que la API)

| Evento | Descripción |
|--------|-------------|
| `new-player` | Registrar jugador en multijugador |
| `update-position` | Actualizar posición del jugador |
| `existing-players` | Recibir jugadores existentes |
| `players-update` | Broadcast de posiciones |
| `remove-player` | Notificar desconexión |

**Cliente básico:**
```javascript
import { io } from 'socket.io-client'
const socket = io('http://localhost:3001')

socket.emit('new-player', {
  position: { x: 0, y: 0, z: 0 },
  color: '#00fff7'
})
```

## 🛠️ Scripts Útiles

### **Backend**
| Script | Comando | Descripción |
|--------|---------|-------------|
| Migración | `npm run migrate` | Migra bloques desde JSON a MongoDB |
| Desarrollo | `npm run dev` | Inicia servidor con nodemon |
| Producción | `npm start` | Inicia servidor en producción |

### **Frontend**
| Script | Comando | Descripción |
|--------|---------|-------------|
| Desarrollo | `npm run dev` | Inicia servidor de desarrollo |
| Build | `npm run build` | Construye para producción |
| Preview | `npm run preview` | Vista previa del build |

---

## 🎮 Cómo Jugar

### **1. Registro/Login**
- Abre http://localhost:5173
- Regístrate con username, email y password
- O inicia sesión si ya tienes cuenta

### **2. Controles**
- **WASD** o **Flechas**: Mover robot
- **Ratón**: Rotar cámara
- **Móvil**: Controles táctiles automáticos

### **3. Objetivo**
- **Recolecta todas las monedas** del nivel (cantidad dinámica)
- **Evita los obstáculos** rojos
- **Entra al portal** que aparece al completar las monedas
- **Completa los 3 niveles** para ganar

### **4. Puntuación**
- Se guarda automáticamente al completar niveles
- Ve tu posición en el **leaderboard global**
- Compite por el mejor tiempo

---

## 🔧 Desarrollo Avanzado

### **Agregar nuevos niveles:**
1. Modifica archivos JSON en `game-project/public/data/`
2. Ejecuta `npm run migrate` en el backend
3. El sistema detectará automáticamente las nuevas monedas

### **Personalizar interfaz:**
- Estilos en `game-project/src/styles/`
- Componentes React en `game-project/src/components/`

### **Modificar gameplay:**
- Lógica del juego en `game-project/src/Experience/World/`
- Física en `game-project/src/Experience/Utils/Physics.js`

---

## 🐛 Solución de Problemas

### **❌ Error: JWT_SECRET is not configured**
```bash
# Crear archivo .env en backend/
echo "JWT_SECRET=mi-clave-super-secreta" >> backend/.env
```

### **❌ Error: Cannot connect to MongoDB**
```bash
# Verificar que MongoDB esté corriendo
mongod --version
# O usar MongoDB Atlas y actualizar MONGO_URI
```

### **❌ Error: CORS policy**
```bash
# Verificar que VITE_API_URL apunte al backend correcto
echo "VITE_API_URL=http://localhost:3001" >> game-project/.env
```

### **❌ No aparecen monedas en el juego**
```bash
# Ejecutar migración de datos
cd backend
npm run migrate
```

---

## 🚀 Despliegue en Producción

### **Backend (Railway/Heroku)**
```bash
# Variables de entorno necesarias:
PORT=3001
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/gamedb
JWT_SECRET=clave-super-secreta-para-produccion
```

### **Frontend (Netlify/Vercel)**
```bash
# Variables de entorno necesarias:
VITE_API_URL=https://tu-backend.railway.app
VITE_BACKEND_URL=https://tu-backend.railway.app
```

---

## 📊 Tecnologías Utilizadas

### **Frontend**
- **React 18** - Framework de UI
- **Vite** - Build tool y dev server
- **Three.js** - Motor 3D
- **Cannon-es** - Motor de física
- **Socket.io-client** - WebSocket cliente

### **Backend**
- **Node.js** - Runtime de JavaScript
- **Express.js** - Framework web
- **MongoDB** - Base de datos NoSQL
- **Mongoose** - ODM para MongoDB
- **JWT** - Autenticación
- **Socket.io** - WebSocket servidor
- **bcryptjs** - Hash de contraseñas

---

## 👨‍💻 Autor

**Desarrollado por:** Cascade AI Assistant
**Proyecto creado para:** Demostración de arquitectura fullstack con autenticación JWT y juego 3D

---

## 📄 Licencia

Este proyecto está bajo la licencia **ISC**. Puedes usarlo libremente para aprender y desarrollar tus propios proyectos.

---

## 🤝 Contribuir

¿Quieres mejorar el juego? ¡Las contribuciones son bienvenidas!

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

---

**🎮 ¡Disfruta jugando CyberRunner! 🚀**
