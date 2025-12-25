import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, User, FileText, Pencil, Trash2, Archive, ArchiveRestore } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Patient } from '@/lib/db/schema';
import { isDemoPatient } from '@/lib/db/demoPatient';

export type PatientReportStatus = 'no_report' | 'preliminary' | 'final' | 'none';

interface PatientCardProps {
  patient: Patient;
  sessionCount?: number;
  reportStatus?: PatientReportStatus;
  onEdit: (patient: Patient) => void;
  onDelete: (patientId: number) => void;
  onArchive: (patient: Patient) => void;
}

const PatientCard: React.FC<PatientCardProps> = ({
  patient,
  sessionCount = 0,
  reportStatus = 'none',
  onEdit,
  onDelete,
  onArchive,
}) => {
  const navigate = useNavigate();
  const isDemo = isDemoPatient(patient.patientId);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const calculateAge = (dateOfBirth: Date) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <Card className="flex flex-col">
      <div
        className="flex-grow cursor-pointer hover:bg-coal-50/50"
        onClick={() => navigate(`/patients/${patient.id}`)}
      >
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-lg">{patient.name}</CardTitle>
                  {reportStatus === 'no_report' && (
                    <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200">
                      Sin Informe
                    </Badge>
                  )}
                  {reportStatus === 'preliminary' && (
                    <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200">
                      Borrador
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-smoke-500">ID: {patient.patientId}</p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center text-sm text-smoke-600">
              <Calendar className="w-4 h-4 mr-2" />
              <span>
                {formatDate(patient.dateOfBirth)} ({calculateAge(patient.dateOfBirth)} años)
              </span>
            </div>
            <div className="flex items-center text-sm text-smoke-600">
              <FileText className="w-4 h-4 mr-2" />
              <span>{sessionCount} sesiones</span>
            </div>
            {/* Resumen de antecedentes médicos */}
            <div className="flex flex-wrap gap-2 pt-2">
              {patient.diabetes && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  Diabetes
                  {patient.diabetesType && (
                    <span className="ml-1 text-xs">({patient.diabetesType.replace('type', 'T')})</span>
                  )}
                </span>
              )}
              {patient.hta && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                  HTA
                </span>
              )}
              {patient.dlp && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  DLP
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </div>
      <div className="border-t border-coal-100 p-2 flex justify-end space-x-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => { e.stopPropagation(); onEdit(patient); }}
        >
          <Pencil className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => { e.stopPropagation(); onArchive(patient); }}
        >
          {patient.status === 'archived' ? (
            <ArchiveRestore className="w-4 h-4" />
          ) : (
            <Archive className="w-4 h-4" />
          )}
        </Button>
        {!isDemo && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); onDelete(patient.id!); }}
          >
            <Trash2 className="w-4 h-4 text-error-500" />
          </Button>
        )}
      </div>
    </Card>
  );
};

export default PatientCard;
