# Blender - Three.js - Mongo Playground

Monorepo con un backend en Node.js/Express + MongoDB y un videojuego 3D hecho con React, Vite y Three.js. El flujo completo cubre: disenar niveles en Blender, exportar bloques al backend y visualizarlos en el juego con fisicas, enemigos y multijugador ligero mediante Socket.io.

---

## Como funciona la app

1. **Modelado**: se construyen bloques, premios y colliders en Blender. Los scripts de `backend/scripts` convierten esos datos en colecciones JSON listas para MongoDB.
2. **Persistencia**: el backend expone endpoints REST y un seed script para guardar las posiciones/props de cada bloque en la base `threejs_blocks`.
3. **Gameplay**: el frontend consume esos datos desde `VITE_API_URL`, carga los modelos GLB definidos en `game-project/src/Experience/sources.js` y levanta cada nivel en `World`.
4. **Interaccion**: el jugador controla un robot (teclado o movil), recolecta `Prize`, evita `Enemy` y avanza niveles gestionados por `LevelManager`. Cannon-es maneja la fisica y Howler los sonidos.
5. **Multijugador**: Socket.io sincroniza la posicion de cada jugador (`new-player`, `update-position`, etc.) para pruebas colaborativas.

---

## Caracteristicas principales

- Backend Express con endpoints CRUD para bloques (`/api/blocks`, `/api/blocks/batch`) y servidor Socket.io.
- Scripts de soporte (`generate_sources.js`, `generatePhysicsModels.js`, `sync_blocks.js`) para mantener alineados Blender -> Mongo -> Three.js.
- Frontend React + Vite con arquitectura `Experience` (escena, camara, recursos, fisica).
- Sistema de niveles (`LevelManager`), loaders dedicados (`ToyCarLoader`), enemigos basicos y premios coleccionables con feedback visual y sonoro.
- Configuracion lista para trabajar en LAN (usa `npm run dev -- --host` y ajusta `VITE_API_URL`).

---

## Requisitos

- Node.js 18+ y npm 9+
- MongoDB (local o Atlas)
- Opcional: Blender + addon glTF para exportar niveles

---

## Instalacion rapida

```bash
# Backend
cd backend
npm install

# Frontend
cd ../game-project
npm install
```

---

## Variables de entorno

`backend/.env`

```env
MONGO_URI=mongodb://127.0.0.1:27017/threejs_blocks
PORT=3001
API_URL=http://localhost:3001/api/blocks/batch
```

`game-project/.env` (opcional)

```env
VITE_API_URL=http://localhost:3001
VITE_ENEMIES_COUNT=1
```

---

## Ejecutar en desarrollo

```bash
# Terminal 1
cd backend
node app.js         # http://localhost:3001

# Terminal 2
cd game-project
npm run dev         # http://localhost:5173
```

Para exponerlo en LAN usa `npm run dev -- --host` y apunta `VITE_API_URL` a la IP del backend.

---

## API y WebSocket

- `GET /api/blocks?level=1`: devuelve los bloques de un nivel.
- `POST /api/blocks`: crea un bloque.
- `POST /api/blocks/batch`: inserta multiples bloques (usado por los scripts de sincronizacion).
- `GET /api/blocks/ping`: healthcheck rapido.

Socket.io comparte el puerto 3001:

| Evento             | Descripcion                                 |
| ------------------ | ------------------------------------------- |
| `new-player`       | registra y anuncia un jugador nuevo         |
| `existing-players` | envia el estado inicial al cliente que entra |
| `players-update`   | broadcast con snapshot de posiciones        |
| `update-position`  | actualiza posicion y rotacion individual    |
| `remove-player`    | notifica desconexiones                      |

Cliente minimo:

```js
import { io } from 'socket.io-client'
const socket = io('http://localhost:3001')
```

---

## Scripts utiles

- `backend/scripts/generate_sources.js`: convierte datos exportados de Blender en definiciones `sources.js`.
- `backend/scripts/generatePhysicsModels.js`: genera colliders precisos para `cannon-es`.
- `backend/scripts/sync_blocks.js`: sube bloques a Mongo a partir de JSON en `backend/data`.
- `game-project/src/Experience/Utils/Physics.js`: inicializa el mundo fisico.
- `game-project/src/Experience/World/LevelManager.js`: controla niveles y objetivos por puntos.

---

## Estructura del proyecto

```
Blender_Threejs_Mongo/
|- backend/                 # API REST + Socket.io + scripts y datos
|  |- data/                 # JSON exportados desde Blender
|  |- scripts/              # utilidades para generar/sincronizar datos
|  `- app.js                # servidor principal
`- game-project/            # Frontend 3D (React + Vite + Three.js)
   |- public/               # modelos, texturas, sonidos
   `- src/
      |- Experience/        # camara, escena, mundo, fisicas
      |- loaders/           # cargadores GLTF (ToyCarLoader, etc.)
      |- Experience/World/  # Robot, Enemy, Prize, Floor, LevelManager
      `- Experience/Utils/  # teclado, fisicas, factory de shapes
```

---

## Flujo para crear un nivel

1. Disena la escena en Blender y exporta los bloques a JSON/GLB.
2. Ejecuta `backend/scripts/generate_sources.js` para actualizar `sources.js`.
3. Corre `backend/scripts/sync_blocks.js` para subir posiciones a MongoDB.
4. Inicia backend + frontend y verifica el nivel en `World.loadLevel`.
5. Ajusta fisicas en `PhysicsShapeFactory` o `precisePhysicsModels.json` segun sea necesario.

---

## Resolucion de problemas

- **Sin datos en el juego**: confirma que `VITE_API_URL` apunta al backend y que Mongo tiene documentos para ese `level`.
- **Errores CORS**: en desarrollo el backend permite `origin: *`; revisa consola si cambiaste esa configuracion.
- **Socket.io no conecta**: valida que `node app.js` imprima `Server running` y que el puerto 3001 no este ocupado.
- **Modelos desalineados**: vuelve a correr los scripts de generacion y revisa `game-project/public/models`.

---

## Autoria y licencia

- Autor: Gustavo Willyn Sanchez Rodriguez (`guswillsan@gmail.com`)
- Licencia: ISC (revisa archivos adjuntos dentro del repositorio)
