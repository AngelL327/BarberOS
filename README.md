# BarberOS

Panel de operación para barberías en Honduras: citas, punto de venta, caja,
clientes, servicios, inventario, equipo, gastos y comisiones. Interfaz en español
con moneda HNL y zona horaria de Tegucigalpa.

## Requisitos

- Node.js 20 o posterior
- npm
- Un proyecto de Supabase

## Inicio local

1. Instala dependencias:

   ```sh
   npm install
   ```

2. Copia `.env.example` a `.env.local` y agrega la URL y la clave publicable
   (anon) del proyecto Supabase:

   ```env
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-clave-publicable
   ```

   No uses la clave `service_role` en el navegador.

3. En Supabase, abre **SQL Editor** y ejecuta el contenido de
   [`supabase/schema.sql`](./supabase/schema.sql). El esquema crea las tablas de
   BarberOS, la creación automática de una barbería al registrarse y las
   políticas RLS para aislar los datos por membresía.

4. Inicia Vite:

   ```sh
   npm run dev
   ```

5. Sin sesión iniciada, el panel abre en **modo vista previa** con datos de
   ejemplo y operaciones de escritura deshabilitadas. La autenticación de
   Supabase sigue implementada para reactivarla cuando se necesite.

## Módulos

- **Agenda:** crear citas, consultar el día y actualizar estados.
- **Punto de venta:** cobrar servicios o productos del catálogo, aplicar
  descuento y propina, seleccionar método de pago y registrar la comisión.
  El cobro actualiza las existencias en la misma transacción; efectivo requiere
  una caja abierta.
- **Caja:** apertura con fondo y cierre con arqueo.
- **Clientes, servicios, inventario, equipo y gastos:** altas y consulta de
  registros.
- **Comisiones:** detalle calculado al cobrar.
- **Configuración:** nombre, ciudad y teléfono de la barbería.

Las tablas anteriores del marketplace (si existen en el proyecto Supabase) no
se eliminan ni se modifican para conservar sus datos; BarberOS usa sus propias
tablas protegidas con RLS.
