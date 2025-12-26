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
    * [PATIENTS]
    * [SESSIONS]
    * [REPORTS]
    * [EXPORTS AND IMPORTS]
* [CONFIGURATION]
    * []
* [CONTRIBUTIONS]
    * [ANNOTATIONS]
    * [DONATIONS (KO-FI)]
    

## Usage

### Patients
When first entering the page, we are automatically set into the **patients** tab, here we can create patients, edit, delete, or archive already existing patients.

#### Editing & Creating

We can create patients by pressing the coloured button that says **Create Patient**. Similarly, to edit, archive or delete a patient (in that order), we can hover over the right bottom corner of the patient card and press the symbol for it.

While creating or editing, we have the next fields:
```
Patient ID # Can only be sent during creation, also can be whatever we want it to be
Name # Editable
Birth Date # Editable

Medical History # Diabetes (Type 1, Type 2, Gestational, other), Arterial Hypertension and Dyslipidemia

Medication # Separate by coma
Other background # Mention what is considered important
```


#### Searching
We are able to search by ID or name, by pressing the box on the top left right below the "Patients" label. We can also filter by patients with no open sessions, and patients with at least one open session. 

Those archived patients can also be displayed by toggling the "Show archived" button

### Sessions
Once we click on a patient we'll be directed to it's own tab, which displays all of the information set earlier, as well as a session section on the bottom.

#### Editing & Creating
We can create a session by pressing the coloured button **Create Session**. Similarly, we can duplicate, edit, or delete a session (in that order) by pressing one of the buttons on the right side of the session card.

While creating or editing a session, we have the next fields:
```
Session Name
Date
Session Notes
```

#### In the Session
While inside the newly created session, we can upload images from our computer or drag images into the upload box. We have a Left Eye (LE) section, and a Right Eye (RE) section, whichever section is currently selected, the image will be uploaded into that section. 

Below we have 3 tabs. Image, AI Analysis and Report. 
In the image tab, once we upload an image, the upload section will disappear, and it will be replaced by an **Add Image** button, the LE and RE buttons determine which eye that image will be uploaded to.

If you accidentally uploaded the image of an eye into the wrong eye section, you can move it to the other by hovering to the bottom of the eye card and pressing the button "To X eye"

To process the images with the AI detection, press **Process with AI**, we can then visualize the AI detections by pressing the image. We can "redetect" the detections by pressing the "brain" symbol on the top right





