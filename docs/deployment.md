# Guía de despliegue a producción

Stack objetivo: **Next.js 15 + Prisma + PostgreSQL (Neon) + Vercel Blob + Vercel**.

Esta guía es específica de este proyecto. Antes de los pasos hay **cuatro
bloqueadores reales** que hay que resolver sí o sí; ignorarlos rompe en
producción.

---

## 0. Bloqueadores a resolver antes de desplegar

### A. El proyecto usa `prisma db push`, no migraciones

Todo el desarrollo se hizo con `db push`, que sincroniza el schema sin historial.
Para producción eso es peligroso: no hay forma auditable de aplicar cambios ni de
revertir. **Hay que crear una historia de migraciones** (paso 3). Además, los
**índices únicos parciales de firmas** viven solo en
`docs/signature-partial-index.sql` y NO están en el schema: si no se aplican a
producción, dos firmas concurrentes del mismo certificado pueden coexistir.

### B. Falta `BLOB_READ_WRITE_TOKEN`

Sin este token:
- las firmas se guardan como data URL dentro de la fila (funciona pero infla la
  base ~10-30 KB por firma), y
- `finalizeReportPdf` **lanza error** al intentar generar el PDF final.

En producción hay que crear un store de Vercel Blob y setear el token (paso 4).

### C. El seed crea usuarios con contraseña `changeme123`

`prisma/seed.ts` siembra `robert.aubuchon@sig.biz` y `admin@sig.biz` con la misma
contraseña hardcodeada. En producción es una vulnerabilidad. Opciones (paso 7):
cambiar las contraseñas apenas termina el deploy, o parametrizar el seed con una
variable de entorno.

### D. `AUTH_SECRET` y `AUTH_URL` de desarrollo

`AUTH_SECRET` tiene que ser un secreto fuerte y único de producción, y `AUTH_URL`
tiene que apuntar al dominio real, no a `localhost`.

---

## 1. Repositorio en GitHub

Vercel despliega desde un repo Git. Verificá que git funcione en la carpeta:

```bash
git status
```

Si da "not a git repository" (puede pasar en carpetas sincronizadas por OneDrive),
reinicializá:

```bash
git init
git add .
git commit -m "Initial commit"
```

`.gitignore` ya excluye `.env`, `.env.local` y `.next`, así que los secretos no se
suben. Confirmá que `.env` NO aparece en `git status` antes de commitear.

Creá un repo **privado** en GitHub y subí:

```bash
git remote add origin https://github.com/<usuario>/vst-calibration.git
git branch -M main
git push -u origin main
```

---

## 2. Base de datos de producción (Neon)

**No reuses la base de desarrollo.** Creá una base separada para producción.

1. En [neon.tech](https://neon.tech) → New Project (o una nueva branch `production`
   dentro del proyecto existente).
2. Neon da dos connection strings; necesitás las dos:
   - **Pooled** (host con `-pooler`): para el runtime serverless de la app.
   - **Direct** (host sin `-pooler`): para las migraciones (el DDL no funciona
     bien a través del pooler PgBouncer).
3. Agregá `?sslmode=require` a ambas.

Prisma necesita las dos. Editá el datasource en `prisma/schema.prisma`:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")     // pooled
  directUrl = env("DIRECT_URL")       // direct
}
```

`directUrl` solo lo usan las migraciones; `prisma generate` y el runtime no lo
necesitan, así que agregarlo no rompe el entorno local.

---

## 3. Migraciones de Prisma (reemplaza `db push`)

Se hace **una vez** para congelar el schema actual como migración inicial.

Contra una base **vacía** (podés usar una branch efímera de Neon o un Postgres
local como shadow), generá la migración inicial:

```bash
npx prisma migrate dev --name init
```

Esto crea `prisma/migrations/<timestamp>_init/migration.sql` a partir del schema.

Luego agregá los índices parciales de firmas como una segunda migración:

```bash
npx prisma migrate dev --create-only --name signature_partial_indexes
```

Abrí el `migration.sql` recién generado (estará vacío) y pegá el contenido de
`docs/signature-partial-index.sql`. Aplicalo:

```bash
npx prisma migrate dev
```

Commiteá la carpeta `prisma/migrations/`:

```bash
git add prisma/migrations
git commit -m "Add Prisma migration history"
git push
```

A partir de acá, **nunca más `db push`**. Los cambios de schema se hacen con
`prisma migrate dev` en local y se aplican a producción con `prisma migrate
deploy`.

### Aplicar migraciones en cada deploy

Cambiá el script de build en `package.json` para que corra las migraciones antes
de compilar:

```json
"build": "prisma generate && prisma migrate deploy && next build"
```

`migrate deploy` solo aplica migraciones pendientes; es idempotente y seguro de
correr en cada build.

---

## 4. Vercel Blob (firmas y PDFs)

1. En el dashboard de Vercel → Storage → Create → **Blob**.
2. Conectalo al proyecto (o copiá el `BLOB_READ_WRITE_TOKEN` que genera).
3. Ese token va como variable de entorno (paso 6).

Sin esto, la generación del PDF final falla y las firmas no se almacenan bien.

---

## 5. Generar el `AUTH_SECRET` de producción

```bash
openssl rand -base64 32
```

Guardá el resultado; va como `AUTH_SECRET` en Vercel. **No reuses** el de
desarrollo.

---

## 6. Importar el proyecto en Vercel y configurar variables

1. [vercel.com](https://vercel.com) → Add New → Project → importá el repo de GitHub.
2. Framework: Next.js (autodetectado). No cambies el build command (ya lo
   ajustaste en el paso 3).
3. En **Environment Variables**, agregá (scope: Production):

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | connection string **pooled** de Neon + `?sslmode=require` |
   | `DIRECT_URL` | connection string **direct** de Neon + `?sslmode=require` |
   | `AUTH_SECRET` | el secreto del paso 5 |
   | `AUTH_URL` | `https://<tu-dominio>.vercel.app` (o el dominio propio) |
   | `NEXT_PUBLIC_APP_URL` | igual que `AUTH_URL` |
   | `BLOB_READ_WRITE_TOKEN` | el token del paso 4 |

   Nota: `AUTH_URL` y `NEXT_PUBLIC_APP_URL` no los sabés hasta el primer deploy si
   usás el dominio de Vercel. Podés desplegar primero, copiar la URL asignada, y
   volver a setearlas y redeployar. Si vas a usar dominio propio, configuralo
   primero.

---

## 7. Primer deploy y datos iniciales

1. Dale **Deploy**. El build corre `prisma generate && prisma migrate deploy &&
   next build`: crea las tablas y los índices en la base de producción.
2. La base queda vacía de catálogo. Poblá el catálogo (filler, 26 dispositivos, 6
   instrumentos patrón) corriendo el seed **una vez** apuntando a producción:

   ```bash
   # localmente, con DATABASE_URL y DIRECT_URL apuntando a la base de PRODUCCIÓN
   npm run db:seed
   ```

3. **Seguridad de las cuentas (bloqueador C):** el seed crea dos usuarios con
   contraseña `changeme123`. Cambialas de inmediato. La forma más simple: parametrizá
   el seed antes de correrlo, leyendo la contraseña de una variable de entorno en
   vez del literal `"changeme123"` en `prisma/seed.ts`. O, si ya corriste el seed,
   generá nuevos hashes y actualizalos:

   ```bash
   node -e "console.log(require('bcryptjs').hashSync(process.env.PW, 10))"
   # y actualizá passwordHash de cada usuario con ese valor
   ```

---

## 8. Checklist de verificación post-deploy

- [ ] `/login` carga y se puede iniciar sesión.
- [ ] Se puede crear un reporte y avanzar el wizard.
- [ ] Un certificado se puede capturar y guardar (prueba el cálculo Decimal en el
      servidor).
- [ ] Firmar un certificado funciona **y** sube la imagen a Vercel Blob (revisá que
      `signatureImageUrl` sea una URL de blob, no un `data:`).
- [ ] Editar una medición firmada revoca la firma.
- [ ] **Ver PDF** genera el documento.
- [ ] En Vercel → Logs no hay errores de `BLOB_READ_WRITE_TOKEN` ni de conexión a
      la base.
- [ ] Las contraseñas por defecto fueron cambiadas.

---

## 9. Ciclo de cambios continuo

- **Cambio de schema:** `prisma migrate dev --name <descripcion>` en local →
  commit de la migración → push. Vercel corre `migrate deploy` en el build.
- **Cambio de código:** push a `main` → Vercel despliega automáticamente. Las ramas
  y PRs generan preview deployments.
- **Nunca** corras `prisma db push` ni `migrate reset` contra la base de
  producción.

---

## Notas específicas de este proyecto

- **PDF en runtime Node:** la ruta `/reports/[id]/pdf` declara
  `export const runtime = "nodejs"` porque `@react-pdf/renderer` usa APIs de Node.
  No la migres a Edge.
- **Logo:** el logo SIG es una reconstrucción vectorial
  (`src/components/brand/sig-logo.tsx` y `src/server/pdf/sig-logo.tsx`). Si tenés
  el asset oficial de marca, reemplazalos antes de producción (para el PDF necesitás
  un PNG).
- **Certificados sin implementar:** Ultrasonic, Metering Pump (x2) y Exhaust no
  tienen UI; no aparecen en el wizard ni en el PDF. No son un bloqueador de deploy,
  pero el reporte final no los incluye todavía.
- **Idempotencia del seed:** el seed usa `upsert`, así que correrlo dos veces no
  duplica catálogo. Los usuarios solo se crean si no existen.
