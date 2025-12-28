# GuidelineEditor Component

## Overview

The **GuidelineEditor** is a comprehensive visual tool for creating and modifying clinical guidelines for diabetic retinopathy classification. This component allows administrators and clinical experts to create custom institutional guidelines without writing JSON manually.

## Features

### 📋 Six Main Tabs

1. **Metadata** - Basic guideline information
2. **Severity Levels** - Define classification severity levels
3. **Classification Rules** - Create logic-based classification rules
4. **Rule 4-2-1** - Configure ETDRS 4-2-1 criteria
5. **Treatment Protocols** - Define treatment recommendations per severity
6. **EMCS Criteria** - Configure Clinically Significant Macular Edema criteria

### ✨ Key Capabilities

- ✅ **Import/Export JSON** - Load existing guidelines or export new ones
- ✅ **Real-time Validation** - Validates guideline structure before export
- ✅ **Visual Interface** - User-friendly forms instead of raw JSON editing
- ✅ **Drag & Reorder** - Arrange severity levels with up/down buttons
- ✅ **Duplicate Levels** - Quickly create similar severity levels
- ✅ **Dynamic Conditions** - Add/remove rule conditions on the fly
- ✅ **Multi-language Support** - Define names/descriptions in Spanish and English

## Usage

### Basic Workflow

1. **Start Fresh or Import**
   - Click "Import JSON" to load an existing guideline (e.g., `minsal_chile_2017.json`)
   - Or start from scratch with the default empty template

2. **Fill in Metadata**
   - Navigate to the **Metadata** tab
   - Enter: Name, Version, Country, Organization, Description
   - The Guideline ID is auto-generated from the name

3. **Define Severity Levels**
   - Go to **Severity Levels** tab
   - Click "Add Level" for each severity level you need
   - Fill in: ID, Name (ES/EN), Color, Description
   - Use arrow buttons to reorder levels by severity (least → most severe)

4. **Create Classification Rules**
   - Navigate to **Classification Rules** tab
   - Click "Add Rule" to create a new rule
   - Select the target severity level
   - Add conditions (field, operator, value)
   - Choose logic type: AND (all must match) or OR (any can match)
   - Set priority (lower number = higher priority)

5. **Configure Rule 4-2-1** (Optional)
   - Go to **Rule 4-2-1** tab
   - Enable the rule with the checkbox
   - Add criteria (hemorrhages, venous beading, IRMA)
   - Define severity mapping for 0, 1, or 2+ criteria met

6. **Add Treatment Protocols**
   - Navigate to **Treatment Protocols** tab
   - Click "Add Protocol" for each severity level
   - Select severity, urgency (routine/accelerated/urgent)
   - Add treatment actions (one per line)
   - Specify follow-up interval in days
   - Write clinical rationale

7. **Configure EMCS Criteria** (Optional)
   - Go to **EMCS Criteria** tab
   - Enable EMCS detection
   - Set geometric distance from fovea (default: 500μm)
   - Set minimum disc areas (default: 1.0)
   - Toggle geometric rule application

8. **Validate & Export**
   - Click "Validate" button to check for errors
   - Fix any validation errors shown
   - Click "Export JSON" to download the guideline file
   - Place the JSON file in `/public/clinical-guidelines/`
   - Update `/public/clinical-guidelines/index.json` to include it

### Example: Creating a Hospital Custom Guideline

```typescript
// 1. Import base guideline (e.g., ICDR 2024)
// 2. Modify metadata
{
  name: "Hospital UC 2025",
  country: "Chile",
  organization: "Pontificia Universidad Católica de Chile",
  status: "custom"
}

// 3. Add custom severity level
{
  id: "questionable_dr",
  name: "RD Cuestionable",
  order: 0.5, // between no_dr (0) and mild_npdr (1)
  color: "#a3e635",
  description: "Hallazgos dudosos que requieren seguimiento acelerado"
}

// 4. Adjust treatment protocols
// For "questionable_dr":
{
  urgency: "accelerated",
  followup_interval_days: 90,
  actions: [
    "Control oftalmológico en 3 meses",
    "Optimizar HbA1c",
    "OCT macular baseline"
  ]
}

// 5. Export as "hospital_uc_2025.json"
```

## Validation Rules

The editor performs automatic validation before export:

### Required Fields (Metadata)
- ✅ Guideline ID
- ✅ Name
- ✅ Version
- ✅ Country

### Severity Levels
- ✅ At least one severity level required
- ✅ Each level must have: ID, Name, Color
- ✅ No duplicate severity IDs

### Classification Rules
- ✅ Each rule must specify a target severity
- ✅ At least one condition per rule

### Treatment Protocols
- ✅ Valid severity reference
- ✅ Urgency level specified
- ✅ Follow-up interval > 0

## Advanced Features

### Conditional Logic

**AND Logic** - All conditions must be true:
```typescript
// Rule for Moderate NPDR
{
  severity: "moderate_npdr",
  logic: "AND",
  conditions: [
    { field: "microaneurysms", operator: ">=", value: 5 },
    { field: "hemorrhages", operator: ">=", value: 3 },
    { field: "total_lesions", operator: "<", value: 20 }
  ]
}
// Triggers ONLY if ALL three conditions match
```

**OR Logic** - Any condition can trigger:
```typescript
// Rule for Severe NPDR
{
  severity: "severe_npdr",
  logic: "OR",
  conditions: [
    { field: "hemorrhages", operator: ">=", value: 20 },
    { field: "soft_exudates", operator: ">=", value: 5 },
    { field: "rule_421_criteria_met", operator: ">=", value: 1 }
  ]
}
// Triggers if ANY of the three conditions match
```

### Rule Priority

Rules are evaluated in **ascending priority order** (1, 2, 3...):
- Lower number = Higher priority
- First matching rule wins
- Use priority to handle edge cases

Example:
```typescript
// Priority 1: Catch PDR first (most severe)
{ priority: 1, severity: "pdr", conditions: [...] }

// Priority 2: Catch severe NPDR
{ priority: 2, severity: "severe_npdr", conditions: [...] }

// Priority 3: Moderate NPDR
{ priority: 3, severity: "moderate_npdr", conditions: [...] }

// Priority 10: Fallback to mild
{ priority: 10, severity: "mild_npdr", conditions: [...] }
```

### Available Fields for Rules

Use these fields in classification rule conditions:

- `microaneurysms` - Count of microaneurysms detected
- `hemorrhages` - Count of hemorrhages
- `hardExudates` - Hard exudates count
- `softExudates` - Soft exudates (cotton wool spots)
- `neovascularization` - Neovascularization areas
- `venous_beading` - Venous beading severity
- `irma` - Intraretinal microvascular abnormalities
- `total_lesions` - Sum of all lesions
- `lesion_types_count` - Number of different lesion types present
- `rule_421_criteria_met` - How many 4-2-1 criteria are satisfied

### Available Operators

- `==` - Equals
- `!=` - Not equals
- `>` - Greater than
- `<` - Less than
- `>=` - Greater than or equal
- `<=` - Less than or equal
- `in` - Value in array (future use)
- `not_in` - Value not in array (future use)

## Integration

### Adding to Settings Page

```typescript
import { GuidelineEditor } from '@/components/settings/GuidelineEditor';

function SettingsPage() {
  return (
    <div>
      <h2>Clinical Guidelines</h2>

      {/* Select active guideline */}
      <GuidelineSelector />

      {/* Edit or create custom guidelines (admin only) */}
      {userRole === 'admin' && (
        <div className="mt-8">
          <h3>Create Custom Guideline</h3>
          <GuidelineEditor />
        </div>
      )}
    </div>
  );
}
```

### Deploying a Custom Guideline

1. **Export from Editor**
   ```bash
   # Editor exports: custom_guideline.json
   ```

2. **Place in Public Directory**
   ```bash
   cp custom_guideline.json public/clinical-guidelines/
   ```

3. **Update Index**
   ```json
   // public/clinical-guidelines/index.json
   {
     "version": "1.0.0",
     "guidelines": [
       {
         "id": "custom_guideline",
         "name": "Custom Hospital Guideline",
         "description": "Internal classification standard",
         "country": "Chile",
         "language": "es",
         "status": "custom",
         "file": "custom_guideline.json",
         "version": "1.0.0"
       }
     ]
   }
   ```

4. **Clear Cache & Reload**
   ```typescript
   import { clearGuidelineCache } from '@/lib/clinical-guidelines/guideline-loader';

   // After deploying new guideline
   clearGuidelineCache();
   window.location.reload();
   ```

## Tips & Best Practices

### Severity Levels
- ✅ **Order matters**: Arrange from least (0) to most (7) severe
- ✅ **Colors**: Use green → yellow → orange → red gradient
- ✅ **Naming**: Be consistent with medical terminology
- ✅ **IDs**: Use snake_case (e.g., `severe_npdr`, not `Severe NPDR`)

### Classification Rules
- ✅ **Prioritize specificity**: Specific conditions first, general ones last
- ✅ **Test edge cases**: What if hemorrhages = 19 (just below threshold)?
- ✅ **Use AND sparingly**: Too many AND conditions may never trigger
- ✅ **Document rationale**: Add comments in JSON for complex rules

### Treatment Protocols
- ✅ **Be specific**: "PRP within 2 weeks" vs "Laser treatment"
- ✅ **Include urgency**: Helps with triage and scheduling
- ✅ **Cite sources**: Reference clinical guidelines in rationale
- ✅ **Follow-up intervals**: Use realistic values (30, 90, 180, 365 days)

### Rule 4-2-1
- ⚠️ **Model limitations**: IRMA and venous beading may not be detected yet
- ✅ **Approximations OK**: Use soft exudates as proxy for venous beading
- ✅ **Document workarounds**: Note in description which criteria are approximated

## Troubleshooting

### Validation Errors

**"Guideline ID is required"**
- Fill in the "Name" field in Metadata tab
- ID is auto-generated from the name

**"At least one severity level is required"**
- Go to Severity Levels tab and click "Add Level"

**"Duplicate severity level IDs"**
- Check that each severity level has a unique ID
- IDs are case-sensitive: `no_dr` ≠ `No_DR`

**"Rule X: At least one condition is required"**
- Go to Classification Rules tab
- Find the rule and click "Add Condition"

### Export Issues

**"Cannot export - validation failed"**
- Click "Validate" to see specific errors
- Fix all errors before exporting

**"Exported JSON doesn't load"**
- Validate JSON syntax with https://jsonlint.com
- Check that all required fields are present
- Ensure severity IDs referenced in rules actually exist

### Import Issues

**"Invalid JSON file"**
- Make sure file is valid JSON format
- Check for missing commas, brackets, or quotes

**"Guideline loaded but incomplete"**
- Some fields may be missing or using wrong types
- Export and compare with a known-good guideline file

## Example Workflow: Modifying MINSAL Chile

```typescript
// 1. Import minsal_chile_2017.json
// 2. Change metadata
metadata.name = "MINSAL Chile 2025 (Actualizado)"
metadata.version = "2.0.0"

// 3. Add new severity level for early DR screening
severity_levels.push({
  id: "very_mild_npdr",
  name: "RDNP Muy Leve",
  order: 0.5,
  color: "#84cc16",
  description: "1-5 microaneurismas aislados"
})

// 4. Adjust rule thresholds based on new research
// Change mild NPDR from "1-15 MA" to "6-15 MA"
// Very mild NPDR catches "1-5 MA"

// 5. Update treatment for very mild
treatment_protocols.push({
  severity: "very_mild_npdr",
  urgency: "routine",
  actions: ["Control anual", "Optimizar HbA1c"],
  followup_interval_days: 365,
  rationale: "Hallazgos mínimos - seguimiento estándar suficiente"
})

// 6. Export as "minsal_chile_2025.json"
```

## Future Enhancements

Planned features for future versions:

- [ ] **JSON Schema Validation** - Validate against formal schema
- [ ] **Guideline Comparison** - Compare two guidelines side-by-side
- [ ] **Import from XLSX** - Load guidelines from Excel templates
- [ ] **Version Control** - Track guideline modifications over time
- [ ] **Approval Workflow** - Submit custom guidelines for committee review
- [ ] **Testing Mode** - Test guideline against sample cases
- [ ] **i18n UI** - Fully translated editor interface

## Related Files

- **Component**: `/src/components/settings/GuidelineEditor.tsx`
- **Type Definitions**: `/src/types/clinical-guidelines.ts`
- **Loader Service**: `/src/lib/clinical-guidelines/guideline-loader.ts`
- **Classifier**: `/src/lib/clinical-guidelines/multi-guideline-classifier.ts`
- **Selector Component**: `/src/components/settings/GuidelineSelector.tsx`
- **Guidelines Storage**: `/public/clinical-guidelines/`

## Support

For technical questions or issues:
1. Check validation errors carefully
2. Compare with example guidelines (ICDR, MINSAL Chile)
3. Review type definitions in `clinical-guidelines.ts`
4. Test exported JSON with online validators

---

**Version**: 1.0.0
**Last Updated**: December 27, 2025
**Maintainer**: DIRD Development Team
