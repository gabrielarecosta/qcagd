export interface VersionHistoryItem {
  version: string;
  fecha: string;
  descripcion: string;
  esActual?: boolean;
}

export interface VersionInfo {
  latest_version: string;
  history: VersionHistoryItem[];
}
