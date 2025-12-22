import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Session, Patient, Image, Detection } from '@/lib/db/schema';
import { db } from '@/lib/db/schema';

export interface ReportData {
  patient: Patient;
  session: Session;
  images: Image[];
  detections: Detection[];
  evaluatorNotes?: string;
  areasOfInterest?: Array<{
    imageId: number;
    coords: { x: number; y: number };
    comment: string;
  }>;
}

export type ReportType = 'preview' | 'final';

export class ReportGenerator {
  private doc: jsPDF;
  private readonly pageWidth = 210; // A4 width in mm
  private readonly pageHeight = 297; // A4 height in mm
  private readonly margin = 20;
  private currentY = 20;

  constructor() {
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
  }

  async generateReport(data: ReportData, type: ReportType): Promise<Blob> {
    // Reset
    this.currentY = this.margin;

    // Add content
    this.addHeader(type);
    this.addPatientInfo(data.patient);
    this.addSessionInfo(data.session);
    this.addDetectionSummary(data.detections);
    await this.addImages(data.images, data.detections);
    this.addEvaluatorNotes(data.evaluatorNotes || '');
    this.addFooter();

    // Convert to blob
    return this.doc.output('blob');
  }

  private addHeader(type: ReportType) {
    // Title
    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(32, 181, 174); // primary color
    this.doc.text('DIRD - Reporte de Análisis', this.pageWidth / 2, this.currentY, {
      align: 'center',
    });

    this.currentY += 10;

    // Report type watermark
    if (type === 'preview') {
      this.doc.setFontSize(16);
      this.doc.setTextColor(216, 122, 26); // accent color
      this.doc.text('VERSIÓN PRELIMINAR', this.pageWidth / 2, this.currentY, {
        align: 'center',
      });
      this.currentY += 8;
    }

    this.currentY += 10;
    this.doc.setTextColor(0, 0, 0);
  }

  private addPatientInfo(patient: Patient) {
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Información del Paciente', this.margin, this.currentY);
    this.currentY += 8;

    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'normal');

    const patientInfo = [
      ['Nombre:', patient.name],
      ['ID Paciente:', patient.patientId],
      [
        'Fecha de Nacimiento:',
        new Date(patient.dateOfBirth).toLocaleDateString('es-ES'),
      ],
      ['Edad:', this.calculateAge(patient.dateOfBirth).toString() + ' años'],
    ];

    autoTable(this.doc, {
      startY: this.currentY,
      head: [],
      body: patientInfo,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 50 },
        1: { cellWidth: 'auto' },
      },
    });

    this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
  }

  private addSessionInfo(session: Session) {
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Información de la Sesión', this.margin, this.currentY);
    this.currentY += 8;

    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'normal');

    const sessionInfo = [
      ['Sesión N°:', session.sessionNumber.toString()],
      ['Fecha:', new Date(session.date).toLocaleDateString('es-ES')],
      ['Modelo Detección:', session.modelVersions.detection || 'No utilizado'],
      ['Modelo Segmentación:', session.modelVersions.segmentation || 'No utilizado'],
      ['Notas:', session.notes || 'Ninguna'],
    ];

    autoTable(this.doc, {
      startY: this.currentY,
      head: [],
      body: sessionInfo,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 50 },
        1: { cellWidth: 'auto' },
      },
    });

    this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
  }

  private addDetectionSummary(detections: Detection[]) {
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Resumen de Detecciones', this.margin, this.currentY);
    this.currentY += 8;

    // Count detections by class
    const classCounts = new Map<string, number>();
    detections.forEach((det) => {
      classCounts.set(det.class, (classCounts.get(det.class) || 0) + 1);
    });

    const summaryData = Array.from(classCounts.entries()).map(([className, count]) => [
      this.translateClass(className),
      count.toString(),
    ]);

    summaryData.push(['Total', detections.length.toString()]);

    autoTable(this.doc, {
      startY: this.currentY,
      head: [['Clase', 'Cantidad']],
      body: summaryData,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [32, 181, 174], textColor: 255 },
    });

    this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
  }

  private async addImages(images: Image[], detections: Detection[]) {
    if (images.length === 0) return;

    this.checkPageBreak(60);

    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Imágenes Analizadas', this.margin, this.currentY);
    this.currentY += 8;

    for (const image of images) {
      this.checkPageBreak(100);

      // Image info
      this.doc.setFontSize(11);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(image.filename, this.margin, this.currentY);
      this.currentY += 6;

      // Add image thumbnail
      try {
        const imageUrl = URL.createObjectURL(image.originalBlob);
        const img = await this.loadImage(imageUrl);

        const maxWidth = this.pageWidth - 2 * this.margin;
        const maxHeight = 80;
        const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
        const width = img.width * scale;
        const height = img.height * scale;

        this.doc.addImage(img.src, 'JPEG', this.margin, this.currentY, width, height);
        URL.revokeObjectURL(imageUrl);

        this.currentY += height + 5;
      } catch (error) {
        console.error('Error adding image to PDF:', error);
        this.doc.setFontSize(10);
        this.doc.setTextColor(200, 0, 0);
        this.doc.text('[Error al cargar imagen]', this.margin, this.currentY);
        this.currentY += 10;
        this.doc.setTextColor(0, 0, 0);
      }

      // Detections for this image
      const imageDetections = detections.filter((d) => d.imageId === image.id);
      if (imageDetections.length > 0) {
        this.doc.setFontSize(10);
        this.doc.text(
          `Detecciones encontradas: ${imageDetections.length}`,
          this.margin,
          this.currentY
        );
        this.currentY += 10;
      }
    }
  }

  private addEvaluatorNotes(notes: string) {
    this.checkPageBreak(40);

    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Notas del Evaluador', this.margin, this.currentY);
    this.currentY += 8;

    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'normal');

    if (notes) {
      const splitText = this.doc.splitTextToSize(
        notes,
        this.pageWidth - 2 * this.margin
      );
      this.doc.text(splitText, this.margin, this.currentY);
      this.currentY += splitText.length * 5 + 10;
    } else {
      this.doc.setTextColor(150, 150, 150);
      this.doc.text('Sin notas adicionales', this.margin, this.currentY);
      this.doc.setTextColor(0, 0, 0);
      this.currentY += 10;
    }
  }

  private addFooter() {
    const pageCount = this.doc.getNumberOfPages();

    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);

      // Footer line
      this.doc.setDrawColor(200, 200, 200);
      this.doc.line(
        this.margin,
        this.pageHeight - 15,
        this.pageWidth - this.margin,
        this.pageHeight - 15
      );

      // Footer text
      this.doc.setFontSize(9);
      this.doc.setTextColor(100, 100, 100);
      this.doc.text(
        'DIRD - Detección de Retinopatía Diabética',
        this.margin,
        this.pageHeight - 10
      );

      this.doc.text(
        `Generado el ${new Date().toLocaleDateString('es-ES')}`,
        this.pageWidth / 2,
        this.pageHeight - 10,
        { align: 'center' }
      );

      this.doc.text(
        `Página ${i} de ${pageCount}`,
        this.pageWidth - this.margin,
        this.pageHeight - 10,
        { align: 'right' }
      );
    }
  }

  private checkPageBreak(requiredSpace: number) {
    if (this.currentY + requiredSpace > this.pageHeight - 20) {
      this.doc.addPage();
      this.currentY = this.margin;
    }
  }

  private calculateAge(dateOfBirth: Date): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  private translateClass(className: string): string {
    const translations: Record<string, string> = {
      microaneurysm: 'Microaneurisma',
      hard_exudate: 'Exudado Duro',
      soft_exudate: 'Exudado Blando',
      hemorrhage: 'Hemorragia',
      neovascularization: 'Neovascularización',
    };
    return translations[className] || className;
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }
}

export async function generateSessionReport(
  sessionId: number,
  type: ReportType,
  evaluatorNotes?: string
): Promise<Blob> {
  // Fetch data
  const session = await db.sessions.get(sessionId);
  if (!session) throw new Error('Session not found');

  const patient = await db.patients.get(session.patientId);
  if (!patient) throw new Error('Patient not found');

  const images = await db.images.where('sessionId').equals(sessionId).toArray();
  const allDetections = await Promise.all(
    images.map((img) => db.detections.where('imageId').equals(img.id!).toArray())
  );
  const detections = allDetections.flat();

  const reportData: ReportData = {
    patient,
    session,
    images,
    detections,
    evaluatorNotes,
  };

  // Generate PDF
  const generator = new ReportGenerator();
  const pdfBlob = await generator.generateReport(reportData, type);

  // Save to database
  await db.reports.add({
    sessionId,
    type,
    pdfBlob,
    evaluatorNotes: evaluatorNotes || '',
    areasOfInterest: [],
    generatedAt: new Date(),
  });

  return pdfBlob;
}
