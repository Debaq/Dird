import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import i18n from '@/i18n/config';
import type { Session, Patient, Image, Detection, Segmentation } from '@/lib/db/schema';
import { db } from '@/lib/db/schema';

export interface ReportData {
  patient: Patient;
  session: Session;
  images: Image[];
  detections: Detection[];
  segmentations: Segmentation[];
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
  private primaryColor: [number, number, number] = [32, 181, 174];
  private accentColor: [number, number, number] = [216, 122, 26];

  constructor() {
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
  }

  async generateReport(data: ReportData, type: ReportType): Promise<Blob> {
    this.currentY = this.margin;

    // 1. Header
    this.addHeader(type);

    // 2. Patient & Clinical History
    this.addPatientSection(data.patient);

    // 3. Session Info
    this.addSessionSection(data.session);

    // 4. Statistical Summary
    this.addFindingsSummary(data.detections);

    // 5. Visual Analysis (Grouped by eye)
    await this.addVisualAnalysis(data.images, data.detections, data.segmentations);

    // 6. Conclusions & Notes
    this.addConclusionSection(data.evaluatorNotes || '');

    // 7. Footer (across all pages)
    this.addFooter();

    return this.doc.output('blob');
  }

  private addHeader(type: ReportType) {
    // App Branding
    this.doc.setFontSize(24);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...this.primaryColor);
    this.doc.text('DIRD', this.margin, this.currentY);

    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(100, 100, 100);
    this.doc.text(i18n.t('app.tagline'), this.margin, this.currentY + 5);

    // Report Title
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(60, 60, 60);
    const title = type === 'final'
      ? i18n.t('reports.status.final')
      : i18n.t('reports.status.preliminary');
    this.doc.text(title, this.pageWidth - this.margin, this.currentY + 2, { align: 'right' });

    this.currentY += 20;

    // Separator line
    this.doc.setDrawColor(...this.primaryColor);
    this.doc.setLineWidth(0.5);
    this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY);

    this.currentY += 10;
  }

  private addPatientSection(patient: Patient) {
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...this.primaryColor);
    this.doc.text(i18n.t('patients.infoTitle'), this.margin, this.currentY);
    this.currentY += 8;

    const body = [
      [i18n.t('patients.name'), patient.name, i18n.t('patients.dateOfBirth'), new Date(patient.dateOfBirth).toLocaleDateString()],
      [i18n.t('patients.id'), patient.patientId, i18n.t('patients.fields.medicalHistory'), ''],
    ];

    // Clinical History row
    const historyParts = [];
    if (patient.diabetes) {
      historyParts.push(`Diabetes ${patient.diabetesType || ''} (${patient.diabetesDuration || 0}a)`);
    }
    if (patient.hta) historyParts.push('HTA');
    if (patient.dlp) historyParts.push('DLP');
    const historyText = historyParts.join(', ') || 'Sin antecedentes relevantes';

    autoTable(this.doc, {
      startY: this.currentY,
      head: [],
      body: [
        [i18n.t('patients.name'), patient.name, i18n.t('patients.dateOfBirth'), new Date(patient.dateOfBirth).toLocaleDateString()],
        [i18n.t('patients.id'), patient.patientId, 'Edad', `${this.calculateAge(patient.dateOfBirth)} años`],
        ['Antecedentes', historyText, 'Medicamentos', patient.medications?.join(', ') || 'Ninguno'],
      ],
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 30 },
        1: { cellWidth: 60 },
        2: { fontStyle: 'bold', cellWidth: 35 },
        3: { cellWidth: 'auto' },
      },
    });

    this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
  }

  private addSessionSection(session: Session) {
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...this.primaryColor);
    this.doc.text(i18n.t('sessions.notesTitle'), this.margin, this.currentY);
    this.currentY += 8;

    autoTable(this.doc, {
      startY: this.currentY,
      head: [],
      body: [
        [i18n.t('sessions.fields.date'), new Date(session.date).toLocaleString()],
        [i18n.t('sessions.session'), `N° ${session.sessionNumber}`],
        [i18n.t('models.detection'), session.modelVersions.detection || 'N/A'],
        [i18n.t('sessions.fields.description'), session.notes || '-'],
      ],
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 40 },
        1: { cellWidth: 'auto' },
      },
    });

    this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
  }

  private addFindingsSummary(detections: Detection[]) {
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...this.primaryColor);
    this.doc.text(i18n.t('analysis.detections'), this.margin, this.currentY);
    this.currentY += 8;

    const classCounts = new Map<string, number>();
    detections.forEach((det) => {
      classCounts.set(det.class, (classCounts.get(det.class) || 0) + 1);
    });

    const summaryData = Array.from(classCounts.entries()).map(([className, count]) => [
      i18n.t(`models.classes.${className}`),
      count.toString(),
    ]);

    if (summaryData.length === 0) {
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'italic');
      this.doc.setTextColor(100, 100, 100);
      this.doc.text('No se encontraron hallazgos significativos en este análisis.', this.margin, this.currentY);
      this.currentY += 10;
    } else {
      autoTable(this.doc, {
        startY: this.currentY,
        head: [[i18n.t('sessions.fields.type'), i18n.t('patients.fields.results')]],
        body: summaryData,
        theme: 'striped',
        headStyles: { fillColor: this.primaryColor },
        styles: { fontSize: 9 },
      });
      this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
    }
  }

  private async addVisualAnalysis(images: Image[], detections: Detection[], segmentations: Segmentation[]) {
    this.checkPageBreak(50);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...this.primaryColor);
    this.doc.text(i18n.t('sessions.galleryTitle'), this.margin, this.currentY);
    this.currentY += 8;

    const eyes = ['OD', 'OI'] as const;

    for (const eye of eyes) {
      const eyeImages = images.filter(img => img.eyeType === eye);
      if (eyeImages.length === 0) continue;

      this.checkPageBreak(30);
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(...this.accentColor);
      this.doc.text(i18n.t(`upload.eye.${eye === 'OD' ? 'right' : 'left'}`), this.margin, this.currentY);
      this.currentY += 6;

      for (const image of eyeImages) {
        this.checkPageBreak(90);

        // Image header
        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(60, 60, 60);
        this.doc.text(`${image.filename} (${new Date(image.uploadedAt).toLocaleTimeString()})`, this.margin, this.currentY);
        this.currentY += 4;

        try {
          const imageUrl = URL.createObjectURL(image.originalBlob);
          const img = await this.loadImage(imageUrl);

          const maxWidth = this.pageWidth - 2 * this.margin;
          const maxHeight = 70;
          const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
          const width = img.width * scale;
          const height = img.height * scale;

          this.doc.addImage(img.src, 'JPEG', this.margin, this.currentY, width, height);

          // Add detection counts for this image
          const imgDetections = detections.filter(d => d.imageId === image.id);
          if (imgDetections.length > 0) {
            this.doc.setFontSize(8);
            this.doc.setTextColor(...this.accentColor);
            this.doc.text(`Detecciones: ${imgDetections.length}`, this.margin + width + 5, this.currentY + 5);
          }

          URL.revokeObjectURL(imageUrl);
          this.currentY += height + 10;
        } catch (error) {
          console.error('Error adding image to PDF:', error);
          this.currentY += 10;
        }
      }
    }
  }

  private addConclusionSection(notes: string) {
    this.checkPageBreak(60);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...this.primaryColor);
    this.doc.text(i18n.t('reports.evaluatorNotes'), this.margin, this.currentY);
    this.currentY += 8;

    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(0, 0, 0);

    const text = notes || 'Sin observaciones adicionales.';
    const splitText = this.doc.splitTextToSize(text, this.pageWidth - 2 * this.margin);
    this.doc.text(splitText, this.margin, this.currentY);

    this.currentY += splitText.length * 5 + 20;

    // Signature Area
    const sigWidth = 60;
    this.doc.setDrawColor(200, 200, 200);
    this.doc.line(this.margin, this.currentY, this.margin + sigWidth, this.currentY);
    this.doc.setFontSize(8);
    this.doc.text('Firma del Especialista', this.margin, this.currentY + 5);

    this.doc.line(this.pageWidth - this.margin - sigWidth, this.currentY, this.pageWidth - this.margin, this.currentY);
    this.doc.text('Sello Institucional', this.pageWidth - this.margin - sigWidth, this.currentY + 5);
  }

  private addFooter() {
    const pageCount = this.doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      this.doc.setFontSize(8);
      this.doc.setTextColor(150, 150, 150);

      const footerY = this.pageHeight - 10;
      this.doc.text(`DIRD - ${i18n.t('app.tagline')}`, this.margin, footerY);
      this.doc.text(`${i18n.t('ui.next')} ${i}/${pageCount}`, this.pageWidth - this.margin, footerY, { align: 'right' });
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
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
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
  const session = await db.sessions.get(sessionId);
  if (!session) throw new Error('Session not found');

  const patient = await db.patients.get(session.patientId);
  if (!patient) throw new Error('Patient not found');

  const images = await db.images.where('sessionId').equals(sessionId).toArray();
  const allDetections = await Promise.all(
    images.map((img) => db.detections.where('imageId').equals(img.id!).toArray())
  );
  const detections = allDetections.flat();

  const allSegmentations = await Promise.all(
    images.map((img) => db.segmentations.where('imageId').equals(img.id!).toArray())
  );
  const segmentations = allSegmentations.flat();

  const reportData: ReportData = {
    patient,
    session,
    images,
    detections,
    segmentations,
    evaluatorNotes,
  };

  const generator = new ReportGenerator();
  const pdfBlob = await generator.generateReport(reportData, type);

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

