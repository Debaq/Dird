import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import i18n from '@/i18n/config';
import type { Session, Patient, Image, Detection, Segmentation, Measurement } from '@/lib/db/schema';
import { db } from '@/lib/db/schema';
import { useConfigStore, DEFAULT_CONFIG } from '@/stores/config-store';
import { getAssetPath } from '@/utils/assets';
import { classManager } from '@/lib/classes/class-manager';
import { getClassName } from '@/lib/ai/class-translations';
import { quadrantCalculator } from '@/lib/analysis/quadrant-calculator';

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
  measurements: Measurement[];
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
    measurements: Measurement[];
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

    // 3. Findings & Quadrant Analysis (Combined Section)
    if (this.config.sections.summary) {
      await this.addFindingsAndQuadrants(data.detections, data.images);
    }

    // 4. Visual Analysis
    if (this.config.sections.gallery) {
      await this.addVisualAnalysis(data.images, data.detections, data.segmentations, data.measurements);
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
    const title = category === 'combined' ? i18n.t('reports.pdf.combinedTitle') : this.config.title;
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
    this.doc.text(`${i18n.t('reports.pdf.generatedOn')} ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, this.pageWidth - this.margin, this.currentY + 10, { align: 'right' });

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
    this.doc.text(i18n.t('reports.pdf.clinicalInfo'), this.margin, this.currentY);
    this.currentY += 4;

    const fields = this.config.patientInfoFields || DEFAULT_CONFIG.report.patientInfoFields;

    // Build columns for grid layout
    const leftColumn: { label: string, value: string }[] = [];

    if (fields.name) leftColumn.push({ label: i18n.t('patients.name'), value: patient.name });
    if (fields.id) leftColumn.push({ label: i18n.t('patients.id'), value: patient.patientId });
    if (fields.age) leftColumn.push({ label: i18n.t('reports.pdf.age'), value: `${this.calculateAge(patient.dateOfBirth)} ${i18n.t('patients.years')}` });

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
        const historyText = historyParts.join(', ') || i18n.t('reports.pdf.noRelevantHistory');
        body.push([
            { content: i18n.t('reports.pdf.background'), styles: { fontStyle: 'bold', textColor: this.primaryColor } },
            { content: historyText } 
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
    this.doc.text(i18n.t('reports.pdf.clinicalInfo'), this.margin, this.currentY);
    this.currentY += 4;

    const fields = this.config.patientInfoFields || DEFAULT_CONFIG.report.patientInfoFields;

    // Build columns for grid layout
    const leftColumn: { label: string, value: string }[] = [];
    const rightColumn: { label: string, value: string }[] = [];

    if (fields.name) leftColumn.push({ label: i18n.t('patients.name'), value: patient.name });
    if (fields.id) leftColumn.push({ label: i18n.t('patients.id'), value: patient.patientId });
    if (fields.age) leftColumn.push({ label: i18n.t('reports.pdf.age'), value: `${this.calculateAge(patient.dateOfBirth)} ${i18n.t('patients.years')}` });

    if (fields.sessionDate) rightColumn.push({ label: i18n.t('sessions.fields.date'), value: new Date(session.date).toLocaleString() });
    
    // Always include session number if date is included or as a fallback
    rightColumn.push({ label: i18n.t('sessions.session'), value: `N° ${session.sessionNumber}` });
    
    // Model Info
    rightColumn.push({ label: i18n.t('reports.pdf.model'), value: session.modelVersions.detection || 'N/A' });

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
        const historyText = historyParts.join(', ') || i18n.t('reports.pdf.noRelevantHistory');
        body.push([
            { content: i18n.t('reports.pdf.background'), styles: { fontStyle: 'bold', textColor: this.primaryColor } },
            { content: historyText, colSpan: 3 }
        ]);
    }

    // Session Notes
    if (fields.sessionNotes) {
        body.push([
            { content: i18n.t('reports.pdf.sessionNote'), styles: { fontStyle: 'bold', textColor: this.primaryColor } },
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

  private async addFindingsAndQuadrants(detections: Detection[], images: Image[]) {
    this.checkPageBreak(80); // Ensure enough space
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...this.primaryColor);
    this.doc.text(i18n.t('reports.pdf.findingsAndAnalysis'), this.margin, this.currentY);
    this.currentY += 6;

    const startY = this.currentY;
    const availableWidth = this.pageWidth - (this.margin * 2);
    const colGap = 10;
    const colWidth = (availableWidth - colGap) / 2;

    // --- LEFT COLUMN: Findings Summary ---
    const classCounts = new Map<string, number>();
    detections.forEach((det) => {
      classCounts.set(det.class, (classCounts.get(det.class) || 0) + 1);
    });

    const findingsData = Array.from(classCounts.entries()).map(([className, count]) => [
      getClassName(className, i18n.language),
      count.toString(),
    ]);

    if (findingsData.length === 0) {
        findingsData.push([i18n.t('analysis.noFindings'), '-']);
    }

    autoTable(this.doc, {
      startY: startY,
      head: [[i18n.t('reports.pdf.finding'), i18n.t('reports.pdf.total')]],
      body: findingsData,
      theme: 'striped',
      headStyles: { fillColor: this.primaryColor, fontSize: 9, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 2 },
      margin: { left: this.margin },
      tableWidth: colWidth
    });
    
    const findingsFinalY = (this.doc as any).lastAutoTable.finalY;

    // --- RIGHT COLUMN: Quadrant Analysis (Aggregated) ---
    // First, calculate quadrant stats for both eyes to use later in diagrams, and aggregate for table
    const statsOI = { ST: 0, IT: 0, SN: 0, IN: 0 };
    const statsOD = { ST: 0, IT: 0, SN: 0, IN: 0 };

    for (const image of images) {
        const imgDetections = detections.filter(d => d.imageId === image.id);
        
        // Get dimensions
        let width = 640, height = 640;
        try {
            const img = await this.loadImage(URL.createObjectURL(image.originalBlob));
            width = img.width; height = img.height;
        } catch(e) {}

        const analysis = quadrantCalculator.analyzeQuadrants(imgDetections, width, height);
        
        const targetStats = image.eyeType === 'OI' ? statsOI : statsOD;
        targetStats.ST += analysis['superior-temporal'];
        targetStats.IT += analysis['inferior-temporal'];
        targetStats.SN += analysis['superior-nasal'];
        targetStats.IN += analysis['inferior-nasal'];
    }

    const quadrantData = [
        [i18n.t('analysis.drClassification.detailsModal.quadrantNames.superior-temporal') + ' (ST)', (statsOI.ST + statsOD.ST).toString()],
        [i18n.t('analysis.drClassification.detailsModal.quadrantNames.inferior-temporal') + ' (IT)', (statsOI.IT + statsOD.IT).toString()],
        [i18n.t('analysis.drClassification.detailsModal.quadrantNames.superior-nasal') + ' (SN)', (statsOI.SN + statsOD.SN).toString()],
        [i18n.t('analysis.drClassification.detailsModal.quadrantNames.inferior-nasal') + ' (IN)', (statsOI.IN + statsOD.IN).toString()],
    ];

    autoTable(this.doc, {
      startY: startY, // Align top
      head: [[i18n.t('reports.pdf.quadrant'), i18n.t('reports.pdf.total')]],
      body: quadrantData,
      theme: 'striped',
      headStyles: { fillColor: this.accentColor, fontSize: 9, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 2 },
      margin: { left: this.margin + colWidth + colGap },
      tableWidth: colWidth
    });

    const quadrantFinalY = (this.doc as any).lastAutoTable.finalY;
    this.currentY = Math.max(findingsFinalY, quadrantFinalY) + 10;

    // --- BOTTOM: Eye Diagrams (OI and OD) ---
    this.checkPageBreak(50);
    
    const diagramRadius = 25;
    const diagramY = this.currentY + diagramRadius;
    const quarterPage = this.pageWidth / 4;
    
    // Draw Diagram Helper
    const drawEyeDiagram = (x: number, y: number, label: string, stats: typeof statsOI) => {
        // Circle
        this.doc.setDrawColor(150, 150, 150);
        this.doc.setLineWidth(0.5);
        this.doc.circle(x, y, diagramRadius);
        
        // Cross lines
        this.doc.line(x, y - diagramRadius, x, y + diagramRadius);
        this.doc.line(x - diagramRadius, y, x + diagramRadius, y);

        // Label (Eye)
        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(...this.accentColor);
        this.doc.text(label, x, y - diagramRadius - 5, { align: 'center' });

        // Quadrant Counts
        this.doc.setFontSize(12);
        this.doc.setTextColor(50, 50, 50);
        
        // Top Right (ST)
        this.doc.text(stats.ST.toString(), x + 10, y - 8, { align: 'center' });
        this.doc.setFontSize(7); this.doc.text('ST', x + 10, y - 16, { align: 'center' });
        
        // Top Left (SN)
        this.doc.setFontSize(12);
        this.doc.text(stats.SN.toString(), x - 10, y - 8, { align: 'center' });
        this.doc.setFontSize(7); this.doc.text('SN', x - 10, y - 16, { align: 'center' });

        // Bottom Right (IT)
        this.doc.setFontSize(12);
        this.doc.text(stats.IT.toString(), x + 10, y + 16, { align: 'center' });
        this.doc.setFontSize(7); this.doc.text('IT', x + 10, y + 24, { align: 'center' });

        // Bottom Left (IN)
        this.doc.setFontSize(12);
        this.doc.text(stats.IN.toString(), x - 10, y + 16, { align: 'center' });
        this.doc.setFontSize(7); this.doc.text('IN', x - 10, y + 24, { align: 'center' });
    };

    // Draw Left Eye (OI)
    drawEyeDiagram(quarterPage, diagramY, i18n.t('upload.eye.left'), statsOI);

    // Draw Right Eye (OD)
    drawEyeDiagram(quarterPage * 3, diagramY, i18n.t('upload.eye.right'), statsOD);

    this.currentY += (diagramRadius * 2) + 15;
  }

  private async addComparativeVisualAnalysis(sessions: ComparativeReportData['sessions']) {
    this.checkPageBreak(40);
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...this.primaryColor);
    this.doc.text(i18n.t('reports.pdf.comparativeEvolution'), this.margin, this.currentY);
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
                const img = images[0];
                const h = await this.drawImageInGrid(
                    img, 
                    sessionData.detections, 
                    sessionData.segmentations,
                    sessionData.measurements,
                    startX, 
                    rowStartY + 4, 
                    colWidth, 
                    {
                        forceOriginal: false,
                        showQuadrantLines: false, // Cleaner for comparison
                        showMeasurements: true,
                        showOpticDiscArea: true
                    }
                );
                maxRowHeight = Math.max(maxRowHeight, h);
            } else {
                 this.doc.setFontSize(8);
                 this.doc.setFont('helvetica', 'italic');
                 this.doc.setTextColor(150, 150, 150);
                 this.doc.text(i18n.t('reports.pdf.noImage'), startX, rowStartY + 10);
                 maxRowHeight = Math.max(maxRowHeight, 20);
            }

            startX += colWidth + spacing;
        }

        this.currentY += maxRowHeight + 10;
    }
  }

  private async addVisualAnalysis(images: Image[], detections: Detection[], _segmentations: Segmentation[], measurements: Measurement[]) {
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
    
    // Grid Layout
    const imagesPerRow = this.config.gallery.imagesPerRow || 2;
    const colGap = 10;
    const colWidth = (this.pageWidth - (this.margin * 2) - (colGap * (imagesPerRow - 1))) / imagesPerRow;

    // Flags
    const renderOptions = {
        showQuadrantLines: this.config.gallery.showQuadrantLines !== false,
        showMeasurements: this.config.gallery.showMeasurements !== false,
        showOpticDiscArea: this.config.gallery.showOpticDiscArea !== false,
    };

    for (let i = 0; i < maxCount; i++) {
      const imgOI = oiImages[i];
      const imgOD = odImages[i];

      // Determine what to show based on config
      const showTypes = [];
      if (this.config.gallery.includeAnnotated) showTypes.push('annotated');
      if (this.config.gallery.includeOriginal) showTypes.push('original');

      for (const type of showTypes) {
          const isOriginal = type === 'original';
          const options = { ...renderOptions, forceOriginal: isOriginal };

          if (isOriginal) {
              // Disable overlays for original
              options.showQuadrantLines = false;
              options.showMeasurements = false;
              options.showOpticDiscArea = false;
          }

          // Render Row(s)
          // If imagesPerRow is 2, we try to put OI and OD side by side
          // If imagesPerRow is 1, we stack them
          
          if (imagesPerRow === 2) {
              this.checkPageBreak(70);
              const rowStartY = this.currentY;
              let maxRowHeight = 0;

              // Draw Left Eye (OI)
              if (imgOI) {
                // Label
                this.doc.setFontSize(10);
                this.doc.setFont('helvetica', 'bold');
                this.doc.setTextColor(...this.accentColor);
                let label = i18n.t('upload.eye.left');
                if (showTypes.length > 1) label += isOriginal ? ' (Original)' : ' (IA)';
                this.doc.text(label, this.margin, rowStartY);
                
                const h1 = await this.drawImageInGrid(imgOI, detections, _segmentations, measurements, this.margin, rowStartY + 5, colWidth, options);
                maxRowHeight = Math.max(maxRowHeight, h1 + 5);
              }

              // Draw Right Eye (OD)
              if (imgOD) {
                // Label
                this.doc.setFontSize(10);
                this.doc.setFont('helvetica', 'bold');
                this.doc.setTextColor(...this.accentColor);
                let label = i18n.t('upload.eye.right');
                if (showTypes.length > 1) label += isOriginal ? ' (Original)' : ' (IA)';
                this.doc.text(label, this.margin + colWidth + colGap, rowStartY);

                const h2 = await this.drawImageInGrid(imgOD, detections, _segmentations, measurements, this.margin + colWidth + colGap, rowStartY + 5, colWidth, options);
                maxRowHeight = Math.max(maxRowHeight, h2 + 5);
              }
              
              this.currentY += maxRowHeight + 10;

          } else {
              // 1 Image Per Row (Stacking)
              if (imgOI) {
                  this.checkPageBreak(100);
                  this.doc.setFontSize(10);
                  this.doc.setFont('helvetica', 'bold');
                  this.doc.setTextColor(...this.accentColor);
                  let label = i18n.t('upload.eye.left');
                  if (showTypes.length > 1) label += isOriginal ? ' (Original)' : ' (IA)';
                  this.doc.text(label, this.margin, this.currentY);
                  
                  const h = await this.drawImageInGrid(imgOI, detections, _segmentations, measurements, this.margin, this.currentY + 5, colWidth, options);
                  this.currentY += h + 10;
              }

              if (imgOD) {
                  this.checkPageBreak(100);
                  this.doc.setFontSize(10);
                  this.doc.setFont('helvetica', 'bold');
                  this.doc.setTextColor(...this.accentColor);
                  let label = i18n.t('upload.eye.right');
                  if (showTypes.length > 1) label += isOriginal ? ' (Original)' : ' (IA)';
                  this.doc.text(label, this.margin, this.currentY);
                  
                  const h = await this.drawImageInGrid(imgOD, detections, _segmentations, measurements, this.margin, this.currentY + 5, colWidth, options);
                  this.currentY += h + 10;
              }
          }
      }
    }
  }

  private async drawImageInGrid(
      image: Image, 
      detections: Detection[], 
      segmentations: Segmentation[], 
      measurements: Measurement[],
      x: number, 
      y: number, 
      width: number, 
      options: { forceOriginal: boolean; showQuadrantLines: boolean; showMeasurements: boolean; showOpticDiscArea: boolean }
  ): Promise<number> {
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
      if (options.forceOriginal) {
         imageUrl = URL.createObjectURL(image.originalBlob);
      } else {
         imageUrl = await this.generateAnnotatedImage(image, detections, segmentations, measurements, options);
      }
      
      const img = await this.loadImage(imageUrl);

      // Calculate dimensions to fit in column
      const aspectRatio = img.width / img.height;
      let renderWidth = width;
      let renderHeight = width / aspectRatio;

      // Max height constraint to avoid taking up full page in 1-column mode if too tall
      const maxHeight = 120; // 12cm
      if (renderHeight > maxHeight) {
        renderHeight = maxHeight;
        renderWidth = renderHeight * aspectRatio;
      }

      this.doc.addImage(img, 'JPEG', x, contentY, renderWidth, renderHeight);
      
      if (!options.forceOriginal) {
          const imgDetections = detections.filter(d => d.imageId === image.id && d.visible);
          if (imgDetections.length > 0) {
            this.doc.setFontSize(7);
            this.doc.setTextColor(...this.accentColor);
            this.doc.text(`${i18n.t('reports.pdf.findingsLabel')}: ${imgDetections.length}`, x, contentY + renderHeight + 4);
            return renderHeight + 10; // Total height used
          }
      }

      return renderHeight + 8;
    } catch (e) {
      console.error('Error drawing image', e);
      return 10;
    }
  }

  private async generateAnnotatedImage(
      image: Image, 
      detections: Detection[], 
      segmentations: Segmentation[],
      measurements: Measurement[],
      options: { showQuadrantLines: boolean; showMeasurements: boolean; showOpticDiscArea: boolean }
  ): Promise<string> {
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

        // Filter items for this image
        const imgDetections = detections.filter(d => d.imageId === image.id && d.visible);
        const imgSegmentations = segmentations.filter(s => s.imageId === image.id && s.visible);
        const imgMeasurements = measurements.filter(m => m.imageId === image.id && m.visible);

        // Use async IIFE to handle image loading for masks
        (async () => {
            // 1. Draw Optic Disc Area (Segmentation) if enabled
            if (options.showOpticDiscArea) {
                for (const seg of imgSegmentations) {
                    if (seg.class === 'optic_disc' || seg.class === 'optic disc') {
                        try {
                            const maskImg = new Image();
                            await new Promise((r, rj) => {
                                maskImg.onload = r;
                                maskImg.onerror = rj;
                                maskImg.src = seg.maskData;
                            });
                            // Draw mask with opacity
                            ctx.globalAlpha = 0.4;
                            ctx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);
                            ctx.globalAlpha = 1.0;
                        } catch (e) {
                            console.warn("Failed to draw segmentation mask", e);
                        }
                    }
                }
            }

            // 2. Draw Quadrant Lines if enabled
            if (options.showQuadrantLines) {
                // Find landmarks
                const opticDisc = imgDetections.find(d => d.class === 'optic_disc' || d.class === 'optic disc');
                const fovea = imgDetections.find(d => d.class === 'fovea');
                
                ctx.strokeStyle = 'rgba(100, 180, 255, 0.6)';
                ctx.lineWidth = 2;
                ctx.setLineDash([10, 10]);

                if (opticDisc && fovea) {
                    // Anatomical Logic
                    const odX = opticDisc.bbox.x + opticDisc.bbox.width / 2;
                    const odY = opticDisc.bbox.y + opticDisc.bbox.height / 2;
                    const foveaX = fovea.bbox.x + fovea.bbox.width / 2;
                    const foveaY = fovea.bbox.y + fovea.bbox.height / 2;

                    const dx = foveaX - odX;
                    const dy = foveaY - odY;
                    const angle = Math.atan2(dy, dx);
                    const superiorInferiorAngle = angle + Math.PI / 2;
                    const lineLength = Math.max(img.width, img.height) * 1.5;

                    // TN Line
                    ctx.beginPath();
                    ctx.moveTo(odX - Math.cos(angle) * lineLength, odY - Math.sin(angle) * lineLength);
                    ctx.lineTo(odX + Math.cos(angle) * lineLength, odY + Math.sin(angle) * lineLength);
                    ctx.stroke();

                    // SI Line
                    ctx.beginPath();
                    ctx.moveTo(odX - Math.cos(superiorInferiorAngle) * lineLength, odY - Math.sin(superiorInferiorAngle) * lineLength);
                    ctx.lineTo(odX + Math.cos(superiorInferiorAngle) * lineLength, odY + Math.sin(superiorInferiorAngle) * lineLength);
                    ctx.stroke();
                } else {
                    // Fallback Logic
                    const cx = img.width / 2;
                    const cy = img.height / 2;
                    ctx.beginPath();
                    ctx.moveTo(cx, 0); ctx.lineTo(cx, img.height);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(0, cy); ctx.lineTo(img.width, cy);
                    ctx.stroke();
                }
                ctx.setLineDash([]); // Reset
            }

            // 3. Draw Detections (Boxes)
            // Scale stroke and font based on image size
            const scaleFactor = Math.max(img.width, img.height) / 1000;
            const lineWidth = Math.max(2, 2 * scaleFactor);
            const fontSize = Math.max(12, 14 * scaleFactor);
            
            ctx.font = `bold ${fontSize}px Helvetica`;
            ctx.textBaseline = 'bottom';

            imgDetections.forEach(det => {
              // Obtener color de la clase
              const color = det.type === 'manual' 
                ? classManager.getColorForClass(det.class)
                : classManager.getColorForClass(det.class);
              
              ctx.strokeStyle = color;
              ctx.lineWidth = lineWidth;
              
              // Draw Box
              ctx.strokeRect(det.bbox.x, det.bbox.y, det.bbox.width, det.bbox.height);

              // Label
              const translatedClass = getClassName(det.class, i18n.language);
              const conf = det.confidence ? ` ${Math.round(det.confidence * 100)}%` : '';
              const text = `${translatedClass}${conf}`;
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

            // 4. Draw Measurements if enabled
            if (options.showMeasurements) {
                imgMeasurements.forEach(m => {
                    const color = "#3b82f6"; // Blue
                    ctx.strokeStyle = color;
                    ctx.lineWidth = lineWidth;
                    ctx.setLineDash([5 * scaleFactor, 5 * scaleFactor]);

                    // Line
                    ctx.beginPath();
                    ctx.moveTo(m.originX, m.originY);
                    ctx.lineTo(m.destinationX, m.destinationY);
                    ctx.stroke();
                    ctx.setLineDash([]);

                    // Endpoints
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.arc(m.originX, m.originY, 3 * scaleFactor, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(m.destinationX, m.destinationY, 3 * scaleFactor, 0, 2 * Math.PI);
                    ctx.fill();

                    // Text
                    const distText = m.distanceDD 
                        ? `${m.distanceDD.toFixed(2)} DD`
                        : `${m.distancePixels.toFixed(1)} px`;
                    
                    const midX = (m.originX + m.destinationX) / 2;
                    const midY = (m.originY + m.destinationY) / 2;

                    ctx.font = `bold ${Math.max(14, 16 * scaleFactor)}px Helvetica`;
                    ctx.fillStyle = "#FFFFFF";
                    ctx.strokeStyle = "#000000";
                    ctx.lineWidth = lineWidth / 2;
                    ctx.strokeText(distText, midX, midY);
                    ctx.fillText(distText, midX, midY);
                });
            }

            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
        })();
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

    const text = notes || i18n.t('reports.pdf.noAdditionalObservations');
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
      this.doc.text(i18n.t('reports.pdf.footerText'), this.margin, footerY);
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

  const allMeasurements = await Promise.all(
    images.map((img) => db.measurements.where('imageId').equals(img.id!).toArray())
  );
  const measurements = allMeasurements.flat();

  const reportData: ReportData = {
    patient,
    session,
    images,
    detections,
    segmentations,
    measurements,
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

      const allMeasurements = await Promise.all(
        images.map((img) => db.measurements.where('imageId').equals(img.id!).toArray())
      );
      const measurements = allMeasurements.flat();

      return {
          session,
          images,
          detections,
          segmentations,
          measurements
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

  const allMeasurements = await Promise.all(
    images.map((img) => db.measurements.where('imageId').equals(img.id!).toArray())
  );
  const measurements = allMeasurements.flat();

  const reportData: ReportData = {
    patient,
    session,
    images,
    detections,
    segmentations,
    measurements,
    evaluatorNotes,
  };

  const generator = new ReportGenerator();
  return await generator.generateReport(reportData, 'preview');
}