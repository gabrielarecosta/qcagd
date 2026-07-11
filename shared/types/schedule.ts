export interface DaySchedule {
  dia: string; // 'lunes', 'martes', etc.
  horario: string; // '08:00 - 17:00'
  cerrado: boolean;
}

export interface BranchSchedule {
  id: string;
  branchId: string;
  horariosAtencion: DaySchedule[];
  horariosRetiro: DaySchedule[];
  diasSinReparto: string[]; // ['domingo']
  feriados: string[];       // ['YYYY-MM-DD']
  fechasBloqueadas: string[]; // ['YYYY-MM-DD']
}
