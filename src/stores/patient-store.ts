import { create } from 'zustand';
import { PatientData, SessionData } from '@/types/patient';

interface PatientStore {
  currentPatient: PatientData | null;
  currentSession: SessionData | null;
  sessionViewTab: string;

  setCurrentPatient: (patient: PatientData | null) => void;
  setCurrentSession: (session: SessionData | null) => void;
  setSessionViewTab: (tab: string) => void;
  clearCurrent: () => void;
}

export const usePatientStore = create<PatientStore>((set) => ({
  currentPatient: null,
  currentSession: null,
  sessionViewTab: 'images',

  setCurrentPatient: (patient) => set({ currentPatient: patient }),
  setCurrentSession: (session) => set({ currentSession: session }),
  setSessionViewTab: (tab) => set({ sessionViewTab: tab }),
  clearCurrent: () => set({ currentPatient: null, currentSession: null, sessionViewTab: 'images' })
}));
