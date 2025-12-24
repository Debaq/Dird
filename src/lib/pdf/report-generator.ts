import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import i18n from '@/i18n/config';
import type { Session, Patient, Image, Detection, Segmentation } from '@/lib/db/schema';
import { db } from '@/lib/db/schema';
import { useConfigStore, DEFAULT_CONFIG } from '@/stores/config-store';
import { getAssetPath } from '@/utils/assets';

// Helper to convert hex to rgb
const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : [0, 0, 0];
};

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

export interface ComparativeReportData {
  patient: Patient;
  sessions: {
    session: Session;
    images: Image[];
    detections: Detection[];
    segmentations: Segmentation[];
  }[];
  evaluatorNotes?: string;
}

export type ReportType = 'preview' | 'final';

export class ReportGenerator {
  private doc: jsPDF;
  private readonly pageWidth = 210; // A4 width in mm
  private readonly pageHeight = 297; // A4 height in mm
  private readonly margin = 15; // Reduced margin
  private currentY = 15;
  private primaryColor: [number, number, number];
  private accentColor: [number, number, number];
  private darkColor: [number, number, number];
  private config = useConfigStore.getState().config.report || DEFAULT_CONFIG.report;

  constructor() {
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    
    this.primaryColor = hexToRgb(this.config.colors.primary);
    this.accentColor = hexToRgb(this.config.colors.secondary);
    this.darkColor = hexToRgb(this.config.colors.text);
  }

  async generateReport(data: ReportData, type: ReportType): Promise<Blob> {
    this.currentY = this.margin;

    // 1. Header
    await this.addHeader(type, 'single');

    // 2. Patient & Session Info
    if (this.config.sections.patientInfo) {
      this.addPatientAndSessionInfo(data.patient, data.session);
    }

    // 3. Statistical Summary
    if (this.config.sections.summary) {
      this.addFindingsSummary(data.detections);
    }

    // 4. Visual Analysis
    if (this.config.sections.gallery) {
      await this.addVisualAnalysis(data.images, data.detections, data.segmentations);
    }

    // 5. Conclusions & Notes
    if (this.config.sections.evaluatorNotes) {
      this.addConclusionSection(data.evaluatorNotes || '');
    }

    // 6. Footer
    this.addFooter();

    return this.doc.output('blob');
  }

  async generateComparativeReport(data: ComparativeReportData, type: ReportType): Promise<Blob> {
    this.currentY = this.margin;

    // 1. Header
    await this.addHeader(type, 'combined');

    // 2. Patient Info (Common)
    this.addPatientInfoOnly(data.patient);

    // 3. Comparative Visual Analysis
    await this.addComparativeVisualAnalysis(data.sessions);

    // 4. Conclusions & Notes
    this.addConclusionSection(data.evaluatorNotes || '');

    // 5. Footer
    this.addFooter();

    return this.doc.output('blob');
  }

  private async addHeader(type: ReportType, category: 'single' | 'combined') {
    // Logo
    let logoToUse = getAssetPath('/logo.svg'); // Default system logo path
    if (this.config.useSystemLogo) {
       // logic already handled by default path
    } else if (this.config.customLogo) {
      logoToUse = this.config.customLogo;
    }

    let textX = this.margin;

    try {
      if (logoToUse) {
         try {
           // Convert image (even SVG) to PNG Data URL via Canvas
           const logoDataUrl = await this.imageToDataUrl(logoToUse);
           const logoSize = 15;
           this.doc.addImage(logoDataUrl, 'PNG', this.margin, this.currentY, logoSize, logoSize);
           textX += logoSize + 5; // Shift text to the right
         } catch (e) {
           console.warn("Could not load logo", e);
         }
      }
    } catch (e) {
      console.warn("Logo error", e);
    }

    // Title & Subtitle
    this.doc.setFontSize(22);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...this.primaryColor);
    const title = category === 'combined' ? 'Informe Evolutivo' : this.config.title;
    this.doc.text(title, textX, this.currentY + 5);

    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(100, 100, 100);
    this.doc.text(this.config.subtitle, textX, this.currentY + 10);

    // Report Status
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...this.darkColor);
    const statusTitle = type === 'final'
      ? i18n.t('reports.status.final')
      : i18n.t('reports.status.preliminary');
    this.doc.text(statusTitle.toUpperCase(), this.pageWidth - this.margin, this.currentY + 5, { align: 'right' });

    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(120, 120, 120);
    this.doc.text(`Generado: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, this.pageWidth - this.margin, this.currentY + 10, { align: 'right' });

    this.currentY += 18;

    // Line
    this.doc.setDrawColor(...this.primaryColor);
    this.doc.setLineWidth(0.5);
    this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY);
    
    this.currentY += 8;
  }

  private addPatientInfoOnly(patient: Patient) {
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...this.primaryColor);
    this.doc.text('INFORMACIÓN CLÍNICA', this.margin, this.currentY);
    this.currentY += 4;

    const fields = this.config.patientInfoFields || DEFAULT_CONFIG.report.patientInfoFields;

    // Build columns for grid layout
    const leftColumn: { label: string, value: string }[] = [];

    if (fields.name) leftColumn.push({ label: i18n.t('patients.name'), value: patient.name });
    if (fields.id) leftColumn.push({ label: i18n.t('patients.id'), value: patient.patientId });
    if (fields.age) leftColumn.push({ label: 'Edad', value: `${this.calculateAge(patient.dateOfBirth)} años` });

    // Merge columns into rows
    const body: any[] = [];
    const maxRows = leftColumn.length;

    for (let i = 0; i < maxRows; i++) {
        const left = leftColumn[i];
        const row = [];

        if (left) {
            row.push({ content: left.label, styles: { fontStyle: 'bold', textColor: this.primaryColor } });
            row.push(left.value);
            // Empty columns for balance if needed, but for now simple 2 col table
        }
        body.push(row);
    }
    
     // History Section
    const historyParts: string[] = [];
    if (fields.diabetes && patient.diabetes) historyParts.push(`Diabetes ${patient.diabetesType || ''} (${patient.diabetesDuration || 0}a)`);
    if (fields.hta && patient.hta) historyParts.push('HTA');
    if (fields.dlp && patient.dlp) historyParts.push('DLP');
    if (fields.medications && patient.medications?.length > 0) historyParts.push(`Meds: ${patient.medications.join(', ')}`);
    if (fields.otherConditions && patient.otherConditions) historyParts.push(`Otros: ${patient.otherConditions}`);

    if (fields.diabetes || fields.hta || fields.dlp || fields.medications || fields.otherConditions) {
        const historyText = historyParts.join(', ') || 'Sin antecedentes relevantes';
        body.push([
            { content: 'Antecedentes', styles: { fontStyle: 'bold', textColor: this.primaryColor } },
            { content: historyText } // Removed colSpan as we only have 2 columns here
        ]);
    }

    if (body.length > 0) {
        autoTable(this.doc, {
            startY: this.currentY,
            head: [],
            body: body,
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 3, lineColor: [230, 230, 230] },
            columnStyles: {
                0: { cellWidth: 35 },
                1: { cellWidth: 'auto' },
            },
        });
        this.currentY = (this.doc as any).lastAutoTable.finalY + 8;
    }
  }

  private addPatientAndSessionInfo(patient: Patient, session: Session) {
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...this.primaryColor);
    this.doc.text('INFORMACIÓN CLÍNICA', this.margin, this.currentY);
    this.currentY += 4;

    const fields = this.config.patientInfoFields || DEFAULT_CONFIG.report.patientInfoFields;

    // Build columns for grid layout
    const leftColumn: { label: string, value: string }[] = [];
    const rightColumn: { label: string, value: string }[] = [];

    if (fields.name) leftColumn.push({ label: i18n.t('patients.name'), value: patient.name });
    if (fields.id) leftColumn.push({ label: i18n.t('patients.id'), value: patient.patientId });
    if (fields.age) leftColumn.push({ label: 'Edad', value: `${this.calculateAge(patient.dateOfBirth)} años` });

    if (fields.sessionDate) rightColumn.push({ label: i18n.t('sessions.fields.date'), value: new Date(session.date).toLocaleString() });
    
    // Always include session number if date is included or as a fallback
    rightColumn.push({ label: i18n.t('sessions.session'), value: `N° ${session.sessionNumber}` });
    
    // Model Info
    rightColumn.push({ label: 'Modelo', value: session.modelVersions.detection || 'N/A' });

    // Merge columns into rows
    const body: any[] = [];
    const maxRows = Math.max(leftColumn.length, rightColumn.length);

    for (let i = 0; i < maxRows; i++) {
        const left = leftColumn[i];
        const right = rightColumn[i];
        const row = [];

        if (left) {
            row.push({ content: left.label, styles: { fontStyle: 'bold', textColor: this.primaryColor } });
            row.push(left.value);
        } else {
            row.push('');
            row.push('');
        }

        if (right) {
            row.push({ content: right.label, styles: { fontStyle: 'bold', textColor: this.primaryColor } });
            row.push(right.value);
        } else {
            row.push('');
            row.push('');
        }
        body.push(row);
    }

    // History Section
    const historyParts: string[] = [];
    if (fields.diabetes && patient.diabetes) historyParts.push(`Diabetes ${patient.diabetesType || ''} (${patient.diabetesDuration || 0}a)`);
    if (fields.hta && patient.hta) historyParts.push('HTA');
    if (fields.dlp && patient.dlp) historyParts.push('DLP');
    if (fields.medications && patient.medications?.length > 0) historyParts.push(`Meds: ${patient.medications.join(', ')}`);
    if (fields.otherConditions && patient.otherConditions) historyParts.push(`Otros: ${patient.otherConditions}`);

    if (fields.diabetes || fields.hta || fields.dlp || fields.medications || fields.otherConditions) {
        const historyText = historyParts.join(', ') || 'Sin antecedentes relevantes';
        body.push([
            { content: 'Antecedentes', styles: { fontStyle: 'bold', textColor: this.primaryColor } },
            { content: historyText, colSpan: 3 }
        ]);
    }

    // Session Notes
    if (fields.sessionNotes) {
        body.push([
            { content: 'Nota Sesión', styles: { fontStyle: 'bold', textColor: this.primaryColor } },
            { content: session.notes || '-', colSpan: 3 }
        ]);
    }

    // Render Table
    if (body.length > 0) {
        autoTable(this.doc, {
            startY: this.currentY,
            head: [],
            body: body,
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 3, lineColor: [230, 230, 230] },
            columnStyles: {
                0: { cellWidth: 35 },
                1: { cellWidth: 55 },
                2: { cellWidth: 35 },
                3: { cellWidth: 'auto' },
            },
        });
        this.currentY = (this.doc as any).lastAutoTable.finalY + 8;
    }
  }

  private addFindingsSummary(detections: Detection[]) {
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...this.primaryColor);
    this.doc.text(i18n.t('analysis.detections'), this.margin, this.currentY);
    this.currentY += 4;

    const classCounts = new Map<string, number>();
    detections.forEach((det) => {
      classCounts.set(det.class, (classCounts.get(det.class) || 0) + 1);
    });

    const summaryData = Array.from(classCounts.entries()).map(([className, count]) => [
      i18n.t(`models.classes.${className}`),
      count.toString(),
    ]);

    if (summaryData.length === 0) {
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'italic');
      this.doc.setTextColor(100, 100, 100);
      this.doc.text('No se encontraron hallazgos significativos.', this.margin, this.currentY + 4);
      this.currentY += 12;
    } else {
      autoTable(this.doc, {
        startY: this.currentY,
        head: [[i18n.t('sessions.fields.type'), i18n.t('patients.fields.results')]],
        body: summaryData,
        theme: 'striped',
        headStyles: { fillColor: this.primaryColor, fontSize: 9, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 2 },
        margin: { right: this.pageWidth / 2 }, // Keep table small (half width)
      });
      // Allow content on the right side if we wanted, but for now just move down
      this.currentY = (this.doc as any).lastAutoTable.finalY + 8;
    }
  }

  private async addComparativeVisualAnalysis(sessions: ComparativeReportData['sessions']) {
    this.checkPageBreak(40);
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...this.primaryColor);
    this.doc.text('EVOLUCIÓN COMPARATIVA', this.margin, this.currentY);
    this.currentY += 6;

    // Sort sessions by date
    const sortedSessions = [...sessions].sort((a, b) => 
        new Date(a.session.date).getTime() - new Date(b.session.date).getTime()
    );

    // Columns config
    const numSessions = sortedSessions.length;
    // Limit to 3 for now to fit page width comfortably
    const maxSessionsToShow = Math.min(numSessions, 3);
    const spacing = 5;
    const colWidth = (this.pageWidth - (this.margin * 2) - (spacing * (maxSessionsToShow - 1))) / maxSessionsToShow;

    // Iterate by Eye Type (OI then OD)
    const eyeTypes = ['OI', 'OD'] as const;

    for (const eyeType of eyeTypes) {
        this.checkPageBreak(80);
        
        // Eye Header
        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(...this.accentColor);
        const eyeLabel = eyeType === 'OI' ? i18n.t('upload.eye.left') : i18n.t('upload.eye.right');
        this.doc.text(eyeLabel, this.margin, this.currentY);
        this.currentY += 5;

        let maxRowHeight = 0;
        let startX = this.margin;
        const rowStartY = this.currentY;

        for (let i = 0; i < maxSessionsToShow; i++) {
            const sessionData = sortedSessions[i];
            const images = sessionData.images.filter(img => img.eyeType === eyeType);
            
            // Session Header (Date)
            this.doc.setFontSize(8);
            this.doc.setFont('helvetica', 'bold');
            this.doc.setTextColor(50, 50, 50);
            const dateStr = new Date(sessionData.session.date).toLocaleDateString();
            this.doc.text(dateStr, startX, rowStartY);

             if (images.length > 0) {
                // Take the first image for this eye type for the session
                // In reality there should be only one per eye per session usually, or we take the first.
                const img = images[0];
                const h = await this.drawImageInGrid(img, sessionData.detections, startX, rowStartY + 4, colWidth, false);
                maxRowHeight = Math.max(maxRowHeight, h);
            } else {
                 this.doc.setFontSize(8);
                 this.doc.setFont('helvetica', 'italic');
                 this.doc.setTextColor(150, 150, 150);
                 this.doc.text('Sin imagen', startX, rowStartY + 10);
                 maxRowHeight = Math.max(maxRowHeight, 20);
            }

            startX += colWidth + spacing;
        }

        this.currentY += maxRowHeight + 10;
    }
  }

  private async addVisualAnalysis(images: Image[], detections: Detection[], _segmentations: Segmentation[]) {
    this.checkPageBreak(40);
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...this.primaryColor);
    this.doc.text(i18n.t('sessions.galleryTitle'), this.margin, this.currentY);
    this.currentY += 6;

    // Group images by eye type
    const oiImages = images.filter(img => img.eyeType === 'OI');
    const odImages = images.filter(img => img.eyeType === 'OD');

    // Calculate max pairs
    const maxCount = Math.max(oiImages.length, odImages.length);
    
    // Grid Layout: 2 columns
    const colWidth = (this.pageWidth - (this.margin * 2) - 10) / 2;

    for (let i = 0; i < maxCount; i++) {
      const imgOI = oiImages[i];
      const imgOD = odImages[i];

      // Determine what to show based on config
      const showTypes = [];
      if (this.config.gallery.includeAnnotated) showTypes.push('annotated');
      if (this.config.gallery.includeOriginal) showTypes.push('original');

      for (const type of showTypes) {
          this.checkPageBreak(70);
          const rowStartY = this.currentY;
          let maxRowHeight = 0;
          const isOriginal = type === 'original';

          // Draw Left Eye (OI)
          if (imgOI) {
             // Label
            this.doc.setFontSize(10);
            this.doc.setFont('helvetica', 'bold');
            this.doc.setTextColor(...this.accentColor);
            let label = i18n.t('upload.eye.left');
            if (showTypes.length > 1) {
                label += isOriginal ? ' (Original)' : ' (IA)';
            }
            this.doc.text(label, this.margin, rowStartY);
            
            const h1 = await this.drawImageInGrid(imgOI, detections, this.margin, rowStartY + 5, colWidth, isOriginal);
            maxRowHeight = Math.max(maxRowHeight, h1 + 5);
          }

          // Draw Right Eye (OD)
          if (imgOD) {
             // Label
            this.doc.setFontSize(10);
            this.doc.setFont('helvetica', 'bold');
            this.doc.setTextColor(...this.accentColor);
            let label = i18n.t('upload.eye.right');
            if (showTypes.length > 1) {
                label += isOriginal ? ' (Original)' : ' (IA)';
            }
            this.doc.text(label, this.margin + colWidth + 10, rowStartY);

            const h2 = await this.drawImageInGrid(imgOD, detections, this.margin + colWidth + 10, rowStartY + 5, colWidth, isOriginal);
            maxRowHeight = Math.max(maxRowHeight, h2 + 5);
          }
          
           this.currentY += maxRowHeight + 10;
      }
    }
  }

  private async drawImageInGrid(image: Image, detections: Detection[], x: number, y: number, width: number, forceOriginal: boolean = false): Promise<number> {
    try {
      // Filename
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(60, 60, 60);
      const label = `${image.filename}`;
      this.doc.text(label, x, y);
      
      const contentY = y + 3;
      
      // Generate annotated image data URL OR original
      let imageUrl: string;
      if (forceOriginal) {
         imageUrl = URL.createObjectURL(image.originalBlob);
         // Ensure we revoke this later? Or rely on GC. createObjectURL can leak if not revoked.
         // Better to read it as dataURL maybe? existing `loadImage` does not handle Blob directly unless it is a URL.
         // `generateAnnotatedImage` handles it.
         // Let's assume loadImage handles blob urls.
      } else {
         imageUrl = await this.generateAnnotatedImage(image, detections);
      }
      
      const img = await this.loadImage(imageUrl);

      // Calculate dimensions to fit in column
      const aspectRatio = img.width / img.height;
      let renderWidth = width;
      let renderHeight = width / aspectRatio;

      // Max height constraint (e.g. 60mm)
      if (renderHeight > 60) {
        renderHeight = 60;
        renderWidth = renderHeight * aspectRatio;
      }

      this.doc.addImage(img, 'JPEG', x, contentY, renderWidth, renderHeight);
      
      if (!forceOriginal) {
          const imgDetections = detections.filter(d => d.imageId === image.id && d.visible);
          if (imgDetections.length > 0) {
            this.doc.setFontSize(7);
            this.doc.setTextColor(...this.accentColor);
            this.doc.text(`Hallazgos: ${imgDetections.length}`, x, contentY + renderHeight + 4);
            return renderHeight + 10; // Total height used
          }
      }

      return renderHeight + 8;
    } catch (e) {
      console.error('Error drawing image', e);
      return 10;
    }
  }

  private async generateAnnotatedImage(image: Image, detections: Detection[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(image.originalBlob);
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve(url); // Fallback to original
          return;
        }

        // Draw original image
        ctx.drawImage(img, 0, 0);

        // Draw detections
        const imgDetections = detections.filter(d => d.imageId === image.id && d.visible);
        
        // Scale stroke and font based on image size
        const scaleFactor = Math.max(img.width, img.height) / 1000;
        const lineWidth = Math.max(2, 2 * scaleFactor);
        const fontSize = Math.max(12, 14 * scaleFactor);
        
        ctx.font = `bold ${fontSize}px Helvetica`;
        ctx.textBaseline = 'bottom';

        imgDetections.forEach(det => {
          const color = det.type === 'manual' ? '#D87A1A' : '#20B5AE'; // Accent or Primary
          
          ctx.strokeStyle = color;
          ctx.lineWidth = lineWidth;
          
          // Draw Box
          ctx.strokeRect(det.bbox.x, det.bbox.y, det.bbox.width, det.bbox.height);

          // Draw Label
          const conf = det.confidence ? ` ${Math.round(det.confidence * 100)}%` : '';
          const text = `${det.class}${conf}`;
          const textMetrics = ctx.measureText(text);
          const textWidth = textMetrics.width;
          const textHeight = fontSize + 4;
          const padding = 4 * scaleFactor;

          // Label Background
          ctx.fillStyle = color;
          ctx.fillRect(
            det.bbox.x, 
            det.bbox.y - textHeight - padding, 
            textWidth + (padding * 2), 
            textHeight + padding
          );

          // Label Text
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(
            text, 
            det.bbox.x + padding, 
            det.bbox.y - (padding/2)
          );
        });

        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };

      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(e);
      };

      img.src = url;
    });
  }

  private addConclusionSection(notes: string) {
    this.checkPageBreak(50);
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...this.primaryColor);
    this.doc.text(i18n.t('reports.evaluatorNotes'), this.margin, this.currentY);
    this.currentY += 5;

    // Box for notes
    const boxWidth = this.pageWidth - (this.margin * 2);
    
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(0, 0, 0);

    const text = notes || 'Sin observaciones adicionales.';
    const splitText = this.doc.splitTextToSize(text, boxWidth - 4); // padding
    const textHeight = splitText.length * 4;
    const boxHeight = Math.max(textHeight + 6, 20); // Min height

    // Background for notes
    this.doc.setFillColor(245, 247, 250);
    this.doc.rect(this.margin, this.currentY, boxWidth, boxHeight, 'F');
    
    this.doc.text(splitText, this.margin + 2, this.currentY + 5);
    
    this.currentY += boxHeight + 15;

    // Signature Area
    this.checkPageBreak(30);
    
    const sigY = this.currentY + 10;
    const sigWidth = 80;
    const centerX = (this.pageWidth / 2) - (sigWidth / 2);

    // Specialist (Centered)
    this.doc.setDrawColor(200, 200, 200);
    this.doc.line(centerX, sigY, centerX + sigWidth, sigY);
    this.doc.setFontSize(8);
    this.doc.setTextColor(100, 100, 100);
    this.doc.text(this.config.signature.text, centerX, sigY + 4, { align: 'left' });
    
    this.currentY = sigY + 20;
  }

  private addFooter() {
    const pageCount = this.doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      this.doc.setFontSize(7);
      this.doc.setTextColor(150, 150, 150);

      const footerY = this.pageHeight - 8;
      this.doc.text(`Generado por DIRD - AI Assistant`, this.margin, footerY);
      this.doc.text(`${i}/${pageCount}`, this.pageWidth - this.margin, footerY, { align: 'right' });
    }
  }

  private checkPageBreak(requiredSpace: number) {
    if (this.currentY + requiredSpace > this.pageHeight - this.margin) {
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

  private async imageToDataUrl(src: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas context not found')); return; }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
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

  // Save report metadata
  await db.reports.add({
    sessionId,
    type,
    reportCategory: 'single',
    pdfBlob,
    evaluatorNotes: evaluatorNotes || '',
    areasOfInterest: [],
    generatedAt: new Date(),
  });

  return pdfBlob;
}

export async function generateCombinedReport(
  sessionIds: number[],
  type: ReportType,
  evaluatorNotes?: string
): Promise<Blob> {
  if (sessionIds.length === 0) throw new Error('No sessions selected');

  // Fetch all sessions
  const sessions = await db.sessions.where('id').anyOf(sessionIds).toArray();
  if (sessions.length === 0) throw new Error('Sessions not found');

  const patient = await db.patients.get(sessions[0].patientId);
  if (!patient) throw new Error('Patient not found');

  // Gather data for each session
  const sessionsData = await Promise.all(sessions.map(async (session) => {
      const images = await db.images.where('sessionId').equals(session.id!).toArray();
      const allDetections = await Promise.all(
        images.map((img) => db.detections.where('imageId').equals(img.id!).toArray())
      );
      const detections = allDetections.flat();

      const allSegmentations = await Promise.all(
        images.map((img) => db.segmentations.where('imageId').equals(img.id!).toArray())
      );
      const segmentations = allSegmentations.flat();

      return {
          session,
          images,
          detections,
          segmentations
      };
  }));

  const reportData: ComparativeReportData = {
    patient,
    sessions: sessionsData,
    evaluatorNotes,
  };

  const generator = new ReportGenerator();
  const pdfBlob = await generator.generateComparativeReport(reportData, type);

  // Save report metadata (associate with the LATEST session for now, or create a new way to store combined reports)
  // For simplicity, we store it against the most recent session
  const sortedSessions = sessions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const latestSessionId = sortedSessions[0].id!;

  await db.reports.add({
    sessionId: latestSessionId,
    type,
    reportCategory: 'combined',
    pdfBlob,
    evaluatorNotes: evaluatorNotes || '',
    areasOfInterest: [],
    generatedAt: new Date(),
  });

  return pdfBlob;
}

export async function regenerateSessionReportBlob(
  sessionId: number,
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
  return await generator.generateReport(reportData, 'preview');
}
