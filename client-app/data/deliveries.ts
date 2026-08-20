import { Deliverer } from '../types';

export const mockDeliverers: Deliverer[] = [
  {
    id: 'rep-1',
    nombre: 'Carlos Rodríguez',
    telefono: '+54 9 351 456-7890',
    vehiculo: 'Camioneta Ford Transit',
    patente: 'AB 123 CD',
    activo: true,
  },
  {
    id: 'rep-2',
    nombre: 'Miguel Torres',
    telefono: '+54 9 351 234-5678',
    vehiculo: 'Furgón Renault Master',
    patente: 'EF 456 GH',
    activo: true,
  },
  {
    id: 'rep-3',
    nombre: 'Alejandro Díaz',
    telefono: '+54 9 351 678-9012',
    vehiculo: 'Camioneta VW Crafter',
    patente: 'IJ 789 KL',
    activo: false,
  },
];
