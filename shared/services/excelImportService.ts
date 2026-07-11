export const EXCEL_FORMAT_HELP = {
  columnas: [
    { nombre: 'codigo', obligatorio: 'Sí', tipo: 'Texto', descripcion: 'Código de artículo único' },
    { nombre: 'nombre', obligatorio: 'Sí', tipo: 'Texto', descripcion: 'Nombre descriptivo del artículo' },
    { nombre: 'categoria', obligatorio: 'Sí', tipo: 'Texto', descripcion: 'Limpieza, Químicos, Perfumería, Descartables, Piscina, Industrial, Hogar o Institucional' },
    { nombre: 'presentacion', obligatorio: 'Sí', tipo: 'Texto', descripcion: 'Envase (ej: Bidón 5L, Frasco 500ml)' },
    { nombre: 'unidad', obligatorio: 'No', tipo: 'Texto', descripcion: 'Unidad de medida (ej: litro, kg, unidad)' },
    { nombre: 'precio', obligatorio: 'No', tipo: 'Número', descripcion: 'Precio unitario minorista' },
    { nombre: 'precioMayorista', obligatorio: 'No', tipo: 'Número', descripcion: 'Precio unitario mayorista' },
    { nombre: 'stock', obligatorio: 'No', tipo: 'Entero', descripcion: 'Cantidad inicial de stock' },
    { nombre: 'stockMinimo', obligatorio: 'No', tipo: 'Entero', descripcion: 'Cantidad mínima para alertas' },
    { nombre: 'sucursal', obligatorio: 'No', tipo: 'Texto', descripcion: 'GENERAL DEHEZA 1, GENERAL DEHEZA 2, RIO CUARTO o GIGENA' },
    { nombre: 'descripcion', obligatorio: 'No', tipo: 'Texto', descripcion: 'Detalle adicional' },
    { nombre: 'activo', obligatorio: 'No', tipo: 'Sí/No o 1/0', descripcion: 'Habilitado para la venta' },
    { nombre: 'visibleEnApp', obligatorio: 'No', tipo: 'Sí/No o 1/0', descripcion: 'Visible para clientes en la app' },
  ],
  ejemplo: {
    codigo: 'LIM-0010',
    nombre: 'Lavandina regular',
    categoria: 'Limpieza',
    presentacion: '1L',
    unidad: 'unidad',
    precio: '850',
    precioMayorista: '700',
    stock: '150',
    stockMinimo: '20',
    sucursal: 'GENERAL DEHEZA 1',
    descripcion: 'Lavandina de uso general',
    activo: 'Sí',
    visibleEnApp: 'Sí'
  }
};
