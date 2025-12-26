# DIRD - Diabetic Retinopathy Detection Platform

DIRD is a privacy-first, edge-computing web application for ophthalmological image analysis. It runs ONNX AI models (YOLOv8n detection + segmentation) entirely in the browser using WebAssembly, ensuring patient data never leaves the device.

- **Patient & Session Management**: Create patients, organize fundus images by sessions
- **Dual AI Models**: Detection (bounding boxes) + Segmentation (masks) with configurable execution
- **Interactive Canvas**: Multi-layer annotation system with manual corrections
- **Version Control**: Track model versions, create session copies for reprocessing
- **Report Generation**: PDF reports with preview/final modes, case locking
- **Offline-First**: PWA with IndexedDB persistence, .dird export format (ZIP-based)
- **Internationalization**: Spanish base, extensible i18n architecture


* [INSTALLATION](#installation)
    * [APP INSTALLATION](#app-installation)
    * [DEVELOPER SETUP](https://github.com/Debaq/Dird/wiki/Installation)
* [USAGE](#usage)
    * [CREATING AND MANAGING PATIENTS](#creating-and-managing-patients)
    * [CREATING AND MANAGING SESSIONS](#creating-and-managing-sessions)

    * [WORKING INSIDE A SESSION](#working-inside-a-session)
        * [ANALYZE AN IMAGE](#analyze-images)
        * [MOVING AND MANAGING IMAGES](#moving-and-managing-images)
        * [VIEW SESSION AND IMAGE STATISTICS](#view-session-and-image-statistics)
        
    * [CREATE REPORTS]
    * [EXPORT AND IMPORTS]
* [CONFIGURATION]
    * []
* [CONTRIBUTIONS]
    * [ANNOTATIONS]
    * [DONATIONS (KO-FI)]
    

# Usage

## Creating and managing patients
When opening the app, you are taken to the Patients view. This is the main page of the system.

Here you can **create, edit or archive** patients.

Press **Create a patient** to create a patient, and fill up the necessary fields.

To modify a patient, press the **pencil button** on the bottom right of the patient card. Every field that was made on creation can be edited, except the ID.

To **Search** an existing patient, click the top left search box, and enter the name of the patient, or the ID of the patient.

Patients can be **archived** to remove them from the main list, to archive an existing patient, click the box button on the bottom right of the patient card you want to archive. To later see these archived patients, toggle the **Show archived** buttton.


## Creating and managing sessions
Each patient can have one or more **sessions**, these represent a clinical visit or examination.

After selecting a patient, their information will be displayed, along with a list of every session they've had.

To **create** a session, press the **New session** button, and fill up the necessary fields. (NOTE: the session notes will appear in the reports created)

Sessions can be **duplicated** to preserve previous work and reprocess images without overwriting earlier results. To do this, press the copy button on the session card.

Sessions can be **edited**, and every space of the session can be edited. To edit, press the pencil button on the right of the session card.
Sessions can be **deleted**, to do this press the trash bin button on the right of the session card.

Multiple sessions can be compared to review differences in statistics, images, and reports over time. To do this press the **Session comparison** button and select two or more sessions.

## Working inside a Session

### Analyze image(s)

To analyze an image inside a session, images must be first uploaded. Images are assigned to either the **Left Eye (LE)** or **Right Eye (RE)**, select the appropiate eye before uploading. If there's no image currently in the session, an upload box will be seen. Images can be uploaded by either uploading files from our computer by clicking on the box, or dragging images to it. 

Once images are uploaded, the upload method will change. To upload more images, click the **Add Image** button and select files from your computer to upload. 

After uploading all required images, press **Process with AI** to process all images. The detections will then be displayed when clicking on an image.

If you wish to only analyze a **select image**, press the brain icon on the top right of the image card.

### Moving and Managing Images
Images can be reassigned to the opposite eye if they were uploaded incorrectly by clicking **"To x eye"** on the bottom right of the image card.

The order of images can be **rearranged** by clicking and holding the top left button on the image card. Images **cannot** be moved to another eye section this way.

Images that are not required can be removed from the session at any time by clicking the trash bin button on the top right of the image card.

### View session and image statistics
Statistics from images and the session itself such as:
* Total images
* Total detections
* Average detections per image
* Individual image statistics
can be viewed by pressing the **AI ANALYSIS** button which will redirect to the statistics tab.


