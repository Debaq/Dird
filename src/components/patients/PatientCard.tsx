import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, User, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Patient } from '@/lib/db/schema';

interface PatientCardProps {
  patient: Patient;
  sessionCount?: number;
}

const PatientCard: React.FC<PatientCardProps> = ({ patient, sessionCount = 0 }) => {
  const navigate = useNavigate();

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
    <Card
      className="hover:shadow-strong transition-shadow cursor-pointer"
      onClick={() => navigate(`/patients/${patient.id}`)}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <CardTitle className="text-lg">{patient.name}</CardTitle>
              <p className="text-sm text-smoke-500">ID: {patient.patientId}</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 mb-4">
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
        </div>
        <Button className="w-full">
          Ver Detalles
        </Button>
      </CardContent>
    </Card>
  );
};

export default PatientCard;
