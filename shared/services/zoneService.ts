import { supabase } from './supabaseClient';
import { DeliveryZone } from '../types/zone';
import { findZoneForCoordinates } from '../utils/geo';

const DEFAULT_ZONES: DeliveryZone[] = [
  {
    id: 'zone-centro',
    name: 'Zona Centro',
    description: 'Área céntrica y comercial de General Deheza (Plaza San Martín, Bv. San Martín)',
    color: '#0284c7',
    active: true,
    polygon: [
      [-63.7925, -32.7510],
      [-63.7770, -32.7510],
      [-63.7770, -32.7610],
      [-63.7925, -32.7610],
      [-63.7925, -32.7510],
    ],
  },
  {
    id: 'zone-norte',
    name: 'Zona Norte',
    description: 'Sector norte y accesos principales por Ruta 158 hacia Las Perdices',
    color: '#16a34a',
    active: true,
    polygon: [
      [-63.7960, -32.7420],
      [-63.7740, -32.7420],
      [-63.7740, -32.7510],
      [-63.7960, -32.7510],
      [-63.7960, -32.7420],
    ],
  },
  {
    id: 'zone-sur',
    name: 'Zona Sur & Industrial',
    description: 'Sector sur residencial y parque agroindustrial hacia General Cabrera',
    color: '#ea580c',
    active: true,
    polygon: [
      [-63.7960, -32.7610],
      [-63.7720, -32.7610],
      [-63.7720, -32.7740],
      [-63.7960, -32.7740],
      [-63.7960, -32.7610],
    ],
  },
];

export const zoneService = {
  /**
   * Obtiene todas las zonas de reparto de Supabase
   */
  async getAll(): Promise<DeliveryZone[]> {
    try {
      const { data, error } = await supabase
        .from('delivery_zones')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.warn('Error al cargar delivery_zones de Supabase, usando defaults:', error.message);
        return DEFAULT_ZONES;
      }

      if (!data || data.length === 0) {
        return DEFAULT_ZONES;
      }

      return data.map((z: any) => ({
        id: z.id,
        name: z.name || z.nombre || 'Zona',
        nombre: z.name || z.nombre || 'Zona',
        description: z.description || z.descripcion || '',
        descripcion: z.description || z.descripcion || '',
        color: z.color || '#1A56DB',
        active: z.active !== false && z.activo !== false,
        activo: z.active !== false && z.activo !== false,
        polygon: Array.isArray(z.polygon) ? z.polygon : [],
        defaultDriverId: z.default_driver_id || null,
        default_driver_id: z.default_driver_id || null,
        branchId: z.branch_id || 'branch-gd1',
        createdAt: z.created_at,
        updatedAt: z.updated_at,
      }));
    } catch (e) {
      console.warn('Fallo en zoneService.getAll:', e);
      return DEFAULT_ZONES;
    }
  },

  /**
   * Crea una nueva zona de reparto con su polígono
   */
  async create(zone: Omit<DeliveryZone, 'id'> & { id?: string }): Promise<DeliveryZone> {
    const id = zone.id || `zone-${Date.now().toString(36)}`;
    const now = new Date().toISOString();

    const payload = {
      id,
      name: zone.name || zone.nombre,
      description: zone.description || zone.descripcion || '',
      polygon: zone.polygon || [],
      color: zone.color || '#1A56DB',
      active: zone.active !== false,
      default_driver_id: zone.defaultDriverId || zone.default_driver_id || null,
      branch_id: zone.branchId || zone.branch_id || 'branch-gd1',
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from('delivery_zones')
      .upsert(payload)
      .select()
      .single();

    if (error) {
      throw new Error(`No se pudo crear la zona: ${error.message}`);
    }

    return {
      id: data.id,
      name: data.name,
      nombre: data.name,
      description: data.description,
      descripcion: data.description,
      polygon: data.polygon,
      color: data.color,
      active: data.active,
      activo: data.active,
      defaultDriverId: data.default_driver_id,
      default_driver_id: data.default_driver_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  /**
   * Actualiza una zona de reparto
   */
  async update(id: string, updates: Partial<DeliveryZone>): Promise<DeliveryZone> {
    const now = new Date().toISOString();

    const payload: any = {
      updated_at: now,
    };

    if (updates.name !== undefined || updates.nombre !== undefined) payload.name = updates.name || updates.nombre;
    if (updates.description !== undefined || updates.descripcion !== undefined) payload.description = updates.description || updates.descripcion;
    if (updates.polygon !== undefined) payload.polygon = updates.polygon;
    if (updates.color !== undefined) payload.color = updates.color;
    if (updates.active !== undefined) payload.active = updates.active;
    if (updates.activo !== undefined) payload.active = updates.activo;
    if (updates.defaultDriverId !== undefined) payload.default_driver_id = updates.defaultDriverId;
    if (updates.default_driver_id !== undefined) payload.default_driver_id = updates.default_driver_id;

    const { data, error } = await supabase
      .from('delivery_zones')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`No se pudo actualizar la zona: ${error.message}`);
    }

    return {
      id: data.id,
      name: data.name,
      nombre: data.name,
      description: data.description,
      descripcion: data.description,
      polygon: data.polygon,
      color: data.color,
      active: data.active,
      activo: data.active,
      defaultDriverId: data.default_driver_id,
      default_driver_id: data.default_driver_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  /**
   * Elimina una zona
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('delivery_zones')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`No se pudo eliminar la zona: ${error.message}`);
    }
  },

  /**
   * Reevalúa automáticamente las zonas de todos los pedidos no entregados con asignación automática
   */
  async reevaluateAutomaticOrders(): Promise<number> {
    try {
      const zones = await this.getAll();
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, latitude, longitude, zone_assignment_type, estado')
        .neq('estado', 'entregado')
        .neq('estado', 'cancelado');

      if (error || !orders) return 0;

      let updatedCount = 0;

      for (const ord of orders) {
        if (ord.zone_assignment_type === 'manual') continue; // Respetar override manual
        if (ord.latitude && ord.longitude) {
          const matchedZone = findZoneForCoordinates(Number(ord.latitude), Number(ord.longitude), zones);
          const newZoneId = matchedZone ? matchedZone.id : null;

          await supabase
            .from('orders')
            .update({
              zone_id: newZoneId,
              zone_assignment_type: 'automatic',
              zone_assigned_at: new Date().toISOString(),
            })
            .eq('id', ord.id);

          updatedCount++;
        }
      }

      return updatedCount;
    } catch (e) {
      console.warn('Error reevaluando pedidos automáticos:', e);
      return 0;
    }
  },
};
