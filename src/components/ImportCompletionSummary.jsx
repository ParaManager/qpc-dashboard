// Shared "Import complete" summary UI for bulk document importers
// (Athletes.jsx's BulkImportDocsModal and Employees.jsx's
// BulkImportEmployeeDocsModal). Extracted so both share one visual
// implementation instead of two copies that can drift apart.
//
// `summary` fields are all optional — any importer that doesn't produce a
// given category (e.g. Athletes currently never produces `noPersonLink`/
// `invalid`) simply shows 0 for it, so nothing is fabricated.
export default function ImportCompletionSummary({ summary, L }) {
  const s = {
    imported: 0, replaced: 0, skippedDuplicates: 0,
    unmatched: 0, ambiguous: 0, noPersonLink: 0, invalid: 0, failed: 0,
    ...summary,
  }
  const processed = s.imported + s.replaced + s.skippedDuplicates
    + s.unmatched + s.ambiguous + s.noPersonLink + s.invalid + s.failed

  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{L('Import complete', 'اكتمل الاستيراد')}</div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>{L(`Processed: ${processed} files`, `تمت معالجة: ${processed} ملفات`)}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        <div className="badge badge-green" style={{ padding: '10px 14px', fontSize: 13, justifyContent: 'flex-start' }}>{L('Imported', 'تم الاستيراد')}: {s.imported}</div>
        <div className="badge badge-blue" style={{ padding: '10px 14px', fontSize: 13, justifyContent: 'flex-start' }}>{L('Replaced', 'تم الاستبدال')}: {s.replaced}</div>
        <div className="badge badge-gray" style={{ padding: '10px 14px', fontSize: 13, justifyContent: 'flex-start' }}>{L('Skipped duplicates', 'تم تخطي المكرر')}: {s.skippedDuplicates}</div>
        <div className="badge badge-amber" style={{ padding: '10px 14px', fontSize: 13, justifyContent: 'flex-start' }}>{L('Unmatched', 'غير مطابق')}: {s.unmatched}</div>
        <div className="badge badge-amber" style={{ padding: '10px 14px', fontSize: 13, justifyContent: 'flex-start' }}>{L('Ambiguous', 'غير مؤكد')}: {s.ambiguous}</div>
        <div className="badge badge-amber" style={{ padding: '10px 14px', fontSize: 13, justifyContent: 'flex-start' }}>{L('No linked person', 'لا يوجد سجل مرتبط')}: {s.noPersonLink}</div>
        <div className="badge badge-red" style={{ padding: '10px 14px', fontSize: 13, justifyContent: 'flex-start' }}>{L('Invalid file', 'ملف غير صالح')}: {s.invalid}</div>
        <div className="badge badge-red" style={{ padding: '10px 14px', fontSize: 13, justifyContent: 'flex-start' }}>{L('Failed', 'فشل')}: {s.failed}</div>
      </div>
    </div>
  )
}
