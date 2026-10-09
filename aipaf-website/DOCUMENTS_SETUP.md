# Document Downloads Setup

## Overview
I've integrated the MS Word documents you added to `public/media/` into the website to make them available for download.

## Documents Added

The following documents are now available in the footer under a "Downloads" section:

1. **Project Assurance Body of Knowledge (PABOK)**
   - File: `AIPAF_PABOK.docx` (30KB)
   - Description: Comprehensive guide to project assurance principles and practices

2. **Project Forensics Body of Knowledge (PFBOK)**
   - File: `AIPAF_PFBOK.docx` (30KB)
   - Description: Guide to project investigation and forensic analysis

3. **Certified Project Management Body of Knowledge (AcPMBOK)**
   - File: `AIPAF_AcPMBOK.docx` (35KB)
   - Description: Advanced project management standards for certified professionals

4. **Schedule of Members**
   - File: `AIPAF - Schedule of Members (Annex 2 to Form A).docx` (32KB)
   - Description: Official member registry and organizational structure

## Changes Made

### 1. Footer Updated
**File**: `src/partials/footer.html`

Added a new "Downloads" section in the footer with links to all four documents:
- Added a fourth column to the footer grid (adjusted CSS for 4-column layout on desktop)
- Each link has the `download` attribute to force browser download
- Files are served directly from `/media/` directory

### 2. CMS Integration Script Created
**File**: `scripts/add-downloads-to-cms.mjs`

Created a script to add these documents to the CMS for better management:
- Defines each download with metadata (file URL, type, size, category)
- Can be run after database setup: `npm run cms:add-downloads`
- Prevents duplicates by checking if slug already exists
- Sets status to "published" automatically

### 3. Package.json Updated
**File**: `package.json`

Added new npm script:
```json
"cms:add-downloads": "node scripts/add-downloads-to-cms.mjs"
```

## How It Works

### Direct Download (Current)
Documents are immediately available via the footer links:
- Users can click any download link in the footer
- Files download directly from `/media/` directory
- No database or CMS required for basic functionality

### CMS Integration (Optional)
For better content management, you can add these to the CMS:

```bash
# Set DATABASE_URL environment variable
export DATABASE_URL=postgresql://...

# Run the script to add downloads to CMS
npm run cms:add-downloads
```

This will:
- Add each document as a CMS entry with type "download"
- Store metadata (file URL, type, size, category)
- Allow Secretariat to manage downloads via the CMS admin interface
- Enable features like:
  - Adding descriptions and full content
  - Publishing/unpublishing
  - Tracking download metrics (if implemented later)
  - Managing access permissions

## Access Points

### Footer Downloads Section
Location: Bottom of every page
- New "Downloads" column added to footer
- All 4 documents listed with download links
- Responsive: collapses on mobile, expands on desktop

### Direct File URLs
Documents can also be accessed directly:
- `/media/AIPAF_PABOK.docx`
- `/media/AIPAF_PFBOK.docx`
- `/media/AIPAF_AcPMBOK.docx`
- `/media/AIPAF - Schedule of Members (Annex 2 to Form A).docx`

## Future Enhancements

### Optional Improvements

1. **Dedicated Downloads Page**
   - Create `/downloads` page with full descriptions
   - Add thumbnails or document previews
   - Include version history

2. **Download Tracking**
   - Track download counts
   - Log who downloads what
   - Generate download reports

3. **Access Control**
   - Restrict certain documents to members only
   - Require login for specific downloads
   - Track document access by membership grade

4. **Document Management**
   - Add version control
   - Support for document updates
   - Change notifications
   - Document approval workflow

5. **Additional Formats**
   - Convert to PDF for broader compatibility
   - Add HTML versions for web viewing
   - Provide multiple format options

## CMS Data Structure

Each download in the CMS has:

```javascript
{
  type: 'download',
  slug: 'pabok', // unique identifier
  title: 'Project Assurance Body of Knowledge',
  summary: 'Short description',
  body: 'Full description and content',
  status: 'published',
  metadata: {
    fileUrl: '/media/AIPAF_PABOK.docx',
    fileType: 'docx',
    fileSize: '30KB',
    category: 'body-of-knowledge'
  }
}
```

## Security Considerations

### Current Setup
- Files are publicly accessible in `/media/` directory
- No authentication required
- Suitable for public documents

### If Access Control Needed
For restricted documents, consider:
1. Move files outside public directory
2. Create API endpoint to serve files with authentication
3. Check member permissions before serving
4. Log all access attempts

Example restricted download endpoint:
```
GET /api/downloads/:slug
- Requires authentication
- Checks member permissions
- Serves file if authorized
- Logs access
```

## File Naming Notes

The "Schedule of Members" file has spaces in the filename:
- Original: `AIPAF - Schedule of Members (Annex 2 to Form A).docx`
- URL-encoded in footer link: `AIPAF%20-%20Schedule%20of%20Members%20(Annex%202%20to%20Form%20A).docx`

For better URLs, consider renaming to:
- `schedule-of-members.docx`
- `aipaf-schedule-of-members.docx`

## Testing

### Verify Downloads Work
1. Open the website
2. Scroll to footer
3. Click each download link
4. Verify each file downloads correctly

### Test CMS Integration (Optional)
1. Set up database and run migration
2. Run `npm run cms:add-downloads`
3. Check CMS admin interface
4. Verify downloads appear in CMS
5. Test editing/publishing functionality

## Maintenance

### Adding New Documents
1. Upload file to `public/media/`
2. Add link to footer (or use CMS)
3. Update CMS script if using CMS
4. Run `npm run cms:add-downloads` if using CMS
4. Rebuild: `npm run build`

### Updating Documents
1. Replace file in `public/media/`
2. Update CMS entry if needed
3. Rebuild: `npm run build`

### Removing Documents
1. Remove file from `public/media/`
2. Remove link from footer
3. Delete from CMS if applicable
4. Rebuild: `npm run build`

## Summary

The documents are now:
- ✅ Available for download via footer
- ✅ Properly linked with download attributes
- ✅ Responsive footer layout (4 columns on desktop)
- ✅ Ready for CMS integration (optional)
- ✅ Documented for future maintenance

No database or backend changes required for basic download functionality. The CMS integration is optional and can be added later if you want more advanced document management features.
