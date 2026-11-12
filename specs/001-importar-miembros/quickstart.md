# Guía de prueba: Importar miembros de otra competencia

Cómo comprobar que la feature funciona de punta a punta. El contrato está en
[contracts/import_members.md](contracts/import_members.md) y el modelo en
[data-model.md](data-model.md).

## Requisitos previos

- Repo vinculado (`npx supabase migration list` coincide de `0001` a `0014`).
- `.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
- Dos cuentas `@grupokelsoft.com` además de la tuya, que hayan iniciado sesión al menos una vez
  (para poder agregarlas como miembros). Se llaman X e Y abajo.

## 1. Reglas de la base

```bash
npx supabase db push --dry-run   # lista solo 0014_import_members.sql
npx supabase db push
npx supabase db query --linked -f supabase/tests/rules.sql -o json > salida.json
```

**Esperado**: todos los casos con `ok = true`, incluidos los de la sección "Importar miembros"
(tabla de casos en el contrato).

## 2. Puertas de calidad

```bash
npm run types   # regenera database.types.ts con import_members
npm test        # incluye importedMembersMessage y memberCountLabel en labels.test.ts
npm run lint
npm run build
```

## 3. Prueba a mano (`npm run dev`)

Preparación: crea una competencia privada **A** y agrega a X e Y. Finalízala o déjala activa. Crea
una privada **B** (si estás en el límite de 2, finaliza o borra otra antes). Desde la cuenta de Y,
pide acceso a B.

| # | Paso | Resultado esperado |
|---|---|---|
| 1 | En `/c/B/gestion` → "Miembros", toca "Importar de otra competencia" | Diálogo "Importar miembros" con A como "A · [estado] · 2 miembros". B no aparece. Ninguna pública aparece |
| 2 | Sin elegir nada | "Importar" deshabilitado |
| 3 | Elige A y toca "Importar" | Toast "Se sumaron 2 personas". X e Y en la lista con "Agregado por ti". La solicitud de Y desapareció de "Solicitudes" y del contador, sin recargar |
| 4 | Vuelve a importar A en B | Toast informativo "No se sumó nadie nuevo". Nada cambia |
| 5 | Desde la cuenta de X, abre el hub | B aparece con acceso (sin recargar si ya estaba abierto); X entra y participa |
| 6 | Mira la gestión de A | A sigue con X e Y |
| 7 | Crea una privada **C** sin miembros y abre el diálogo en B | C aparece con "0 miembros" y deshabilitada |
| 8 | Abre la gestión de una competencia pública tuya | No hay sección "Miembros" ni botón de importar |
| 9 | Con una cuenta que tenga una sola privada, abre el diálogo en ella | "No tienes otras competencias privadas con miembros" |
| 10 | Como superadmin, entra en "Moderar" de una competencia ajena | No aparece la sección de miembros ni la importación |

## 4. Cierre

- Actualizar `docs/especificacion-v2.md` (secciones de la tabla "Referencia a la especificación v2"
  de la spec), `docs/supabase.md` (fila de `import_members` en "Miembros") y `docs/frontend.md`
  ("Gestionar").
- Marcar la fase en `tasks.md`.
