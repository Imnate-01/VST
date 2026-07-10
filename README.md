# VST Calibration Reports — MVP 1

Sistema web para reemplazar el Excel de reportes de calibración de sistemas VST (Vapor Sterilant Technology). MVP 1 cubre 3 tipos de certificado: **Temperature**, **Pressure** y **Vacuum Pressure**.

## Stack

- **Next.js 15** (App Router) + **TypeScript strict**
- **Tailwind CSS** + **shadcn/ui**
- **Prisma** + **PostgreSQL** (Neon en producción)
- **Auth.js v5** con Credentials (email + password)
- **next-safe-action** + **Zod** para Server Actions
- **Vitest** para tests del motor de dominio
- **decimal.js** para precisión numérica (no floats)

## Sprint 1 — completado

Este código corresponde al Sprint 1 del plan del MVP 1:

- [x] Setup del proyecto (Next.js 15, TS strict, Tailwind, shadcn)
- [x] Prisma schema completo del MVP 1 (todas las entidades)
- [x] Seed con catálogo SureFill 100 (11 dispositivos, tags reales del reporte)
- [x] Auth.js con Credentials + bcrypt
- [x] Motor de dominio (`calibration.ts`) con tests exhaustivos
- [x] Generador de número de reporte (`report-number.ts`)
- [x] Layout autenticado con sidebar
- [x] Login funcional
- [x] Dashboard con KPIs
- [x] Historial de reportes (lista vacía por ahora)
- [x] Middleware de protección de rutas

**Tests**: 27/27 pasando, incluyendo casos reales del reporte de Nestlé Fort Smith.

## Setup local

### 1. Requisitos

- Node.js 20 o superior
- pnpm o npm
- Postgres (Neon recomendado, o local)

### 2. Instalación

```bash
npm install
```

### 3. Variables de entorno

Copia `.env.example` a `.env` y llena los valores:

```bash
cp .env.example .env
```

Genera el `AUTH_SECRET`:

```bash
openssl rand -base64 32
```

Para el `DATABASE_URL`:
- **Neon**: crea proyecto en https://neon.tech y copia la URL con `?sslmode=require`
- **Local**: `postgresql://user:pass@localhost:5432/vst_calibration`

### 4. Base de datos

```bash
npx prisma migrate dev --name init
npx prisma db seed
```

Esto crea:
- 2 usuarios: `robert.aubuchon@sig.biz` y `admin@sig.biz` (password: `changeme123`)
- 1 filler model: SureFill 100
- 11 dispositivos en el catálogo (los 3 tipos del MVP 1)
- 1 filler: Nestlé Fort Smith #652
- 2 instrumentos patrón: Fluke 9140 y Fluke 700G06

### 5. Ejecutar

```bash
npm run dev
```

Abre http://localhost:3000. Loguéate con cualquiera de las cuentas seed.

## Scripts

```bash
npm run dev          # Servidor de desarrollo
npm run build        # Build de producción
npm run test         # Tests del motor de dominio (Vitest)
npm run test:watch   # Tests en watch mode
npm run db:migrate   # Aplicar migraciones
npm run db:seed      # Ejecutar seed
npm run db:studio    # Prisma Studio (GUI de la BD)
```

## Arquitectura

```
src/
├── app/                       # Next.js App Router
│   ├── (auth)/login/         # Login público
│   ├── (app)/                # Rutas autenticadas
│   │   ├── dashboard/
│   │   └── reports/
│   ├── api/auth/             # NextAuth handlers
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/                   # shadcn primitives
│   ├── app-sidebar.tsx
│   └── providers.tsx
├── lib/
│   └── utils.ts              # cn, formatDate, etc.
├── server/
│   ├── auth.ts               # Auth.js config
│   ├── db.ts                 # Prisma client singleton
│   ├── safe-action.ts        # next-safe-action clients
│   ├── domain/               # Lógica pura, testeable
│   │   ├── calibration.ts    # Motor de deviations + pass/fail
│   │   └── report-number.ts
│   └── services/
│       └── audit.ts          # Audit logging
└── middleware.ts             # Protección de rutas
```

## Motor de dominio

`src/server/domain/calibration.ts` implementa la lógica de calibración como funciones puras usando `decimal.js` para evitar errores de float. Casos cubiertos con tests basados en el reporte real:

- Tolerancia absoluta (°C): Temperature 1573 low → deviation -0.6, pass
- Tolerancia porcentual (PSI): Pressure 3527 → tolerancia = 10 × 0.05% = 0.005
- Tolerancia porcentual (Hg): Vacuum 1706 high → deviation -3.8, fail
- Edge cases: target cero, target negativo, precisión de floats (0.1 + 0.2)

## Próximos sprints

**Sprint 2** — Wizard parte 1
- Crear reporte draft
- Paso 1: Info del servicio
- Paso 2: Selección de dispositivos con snapshots
- Paso 3: Selección de patrones con validación de vigencia

**Sprint 3** — Certificados
- Componente genérico parametrizado por tipo
- Cálculo automático + semáforo pass/fail
- Autoguardado con debounce

**Sprint 4** — Firma y submit
- Canvas de firma
- Server Action con transacción + hash
- Bloqueo de edición al firmar

**Sprint 5** — PDF
- Plantilla HTML con `@page` para el PDF
- Endpoint con Playwright + chromium-min
- Almacenamiento en Vercel Blob

**Sprint 6** — Pulido y despliegue
- Filtros y búsqueda
- Panel admin mínimo
- Deploy a Vercel + Neon
