import { supabase } from './supabaseClient';

export interface CompanySettings {
  id: string;
  whatsapp: string;
  direccion: string;
  telefono: string;
  instagram: string;
  facebook: string;
  // Datos bancarios para transferencias
  banco?: string;
  cbu?: string;
  alias_cbu?: string;
  cuit?: string;
  titular?: string;
}

export const companySettingsService = {
  /**
   * Obtiene la configuración general de la empresa
   */
  get: async (): Promise<CompanySettings> => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('id', 'config_main')
        .maybeSingle();

      if (error || !data) {
        console.warn('⚠️ No se pudo obtener la configuración de la base de datos (usando valores predeterminados):', error?.message);
        return {
          id: 'config_main',
          whatsapp: '',
          direccion: '',
          telefono: '',
          instagram: '',
          facebook: '',
        };
      }
      return data;
    } catch (e) {
      console.error('Error fetching company settings:', e);
      return {
        id: 'config_main',
        whatsapp: '',
        direccion: '',
        telefono: '',
        instagram: '',
        facebook: '',
      };
    }
  },

  /**
   * Actualiza la configuración general de la empresa
   */
  update: async (settings: Partial<CompanySettings>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('company_settings')
        .upsert({
          id: 'config_main',
          ...settings,
          updated_at: new Date().toISOString(),
        });
      if (error) {
        console.error('Error updating company settings:', error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('Error updating company settings:', e);
      return false;
    }
  }
};
