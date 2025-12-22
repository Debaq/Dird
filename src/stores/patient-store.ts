import { create } from 'zustand';
import { PatientData, SessionData } from '@/types/patient';

interface PatientStore {
  currentPatient: PatientData | null;
  currentSession: SessionData | null;

  setCurrentPatient: (patient: PatientData | null) => void;
  setCurrentSession: (session: SessionData | null) => void;
  clearCurrent: () => void;
}

export const usePatientStore = create<PatientStore>((set) => ({
  currentPatient: null,
  currentSession: null,

  setCurrentPatient: (patient) => set({ currentPatient: patient }),
  setCurrentSession: (session) => set({ currentSession: session }),
  clearCurrent: () => set({ currentPatient: null, currentSession: null })
}));
